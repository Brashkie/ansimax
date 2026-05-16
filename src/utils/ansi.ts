// ─────────────────────────────────────────────
//  ANSI ESCAPE CODE PRIMITIVES
//
//  Foundation layer for the entire library. All other modules build
//  on top of this. Robustness matters here more than anywhere else
//  because a single bug propagates to every consumer.
//
//  Design principles:
//   - Pure functions for escape generation (cursor.up(), fgRgb(), etc.)
//   - Stream-safe I/O (write, writeAsync) — never throws on missing stdout
//   - Cached capability detection with manual reset (resetColorSupportCache)
//   - Crash-safe cursor restore via process exit hooks
//   - All numeric inputs clamped to safe ranges
//   - Output buffer for batched writes (animation frames)
// ─────────────────────────────────────────────

import os from 'node:os';

export const ESC = '\x1b';
export const CSI = `${ESC}[`;
/** OSC sequence introducer (Operating System Command). */
export const OSC = `${ESC}]`;
/** String terminator used to close OSC sequences. */
export const ST  = `${ESC}\\`;
/** BEL — alternative OSC terminator (older terminals). */
export const BEL = '\x07';

// ─────────────────────────────────────────────
//  Strict numeric typing for ANSI codes
// ─────────────────────────────────────────────
export type AnsiCode = number;

// ─────────────────────────────────────────────
//  Internal clamp helpers — defensive for non-numeric inputs
// ─────────────────────────────────────────────
const MAX_COORD = 9999;

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

const clampByte = (n: number): number => {
  if (!isFiniteNumber(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
};

/** Clamp a positive integer to [min, MAX_COORD]. min defaults to 1. */
const clampPositive = (n: number, min = 1): number => {
  if (!isFiniteNumber(n)) return min;
  return Math.max(min, Math.min(MAX_COORD, Math.round(n)));
};

/** Default fallback dimensions when stdout is not a TTY. */
export const DEFAULT_TERM_COLS = 80;
export const DEFAULT_TERM_ROWS = 24;

// ─────────────────────────────────────────────
//  Stream safety helpers
//
//  process.stdout/stderr can be undefined in workers, bundled
//  environments, or some test runners. Every write goes through
//  these helpers so we never throw on a missing stream.
// ─────────────────────────────────────────────
const safeStreamWrite = (
  stream: { write?(s: string): boolean } | undefined,
  str: string,
): boolean => {
  /* istanbul ignore next — defensive: stream missing or torn down */
  if (!stream || typeof stream.write !== 'function') return false;
  /* istanbul ignore next */
  try { return stream.write(str); }
  catch { return false; }
};

// ─────────────────────────────────────────────
//  Cursor control
// ─────────────────────────────────────────────
export const cursor = {
  up:      (n = 1): string => `${CSI}${clampPositive(n)}A`,
  down:    (n = 1): string => `${CSI}${clampPositive(n)}B`,
  right:   (n = 1): string => `${CSI}${clampPositive(n)}C`,
  left:    (n = 1): string => `${CSI}${clampPositive(n)}D`,
  to:      (x: number, y: number): string =>
    `${CSI}${clampPositive(y)};${clampPositive(x)}H`,
  /** Move cursor to absolute column n (1-based). */
  column:  (n: number): string => `${CSI}${clampPositive(n)}G`,
  /** Save cursor (CSI s — DEC private). */
  save:    (): string => `${CSI}s`,
  /** Restore cursor (CSI u). */
  restore: (): string => `${CSI}u`,
  /** Save cursor (ESC 7 — VT100 standard). */
  saveCompat:    (): string => `${ESC}7`,
  /** Restore cursor (ESC 8). */
  restoreCompat: (): string => `${ESC}8`,
  hide:    (): string => `${CSI}?25l`,
  show:    (): string => `${CSI}?25h`,
  /** Query cursor position. Terminal responds with CSI <row>;<col>R. */
  position: (): string => `${CSI}6n`,
  /** Move cursor to next line (CR + line down). */
  nextLine: (n = 1): string => `${CSI}${clampPositive(n)}E`,
  /** Move cursor to previous line. */
  prevLine: (n = 1): string => `${CSI}${clampPositive(n)}F`,
} as const;

// ─────────────────────────────────────────────
//  Cursor visibility safety — restore on exit
//
//  If a program crashes or exits while the cursor is hidden,
//  the user is stuck with an invisible cursor in their shell.
//  Register once on first hide() call to be safe.
//
//  The handlers are idempotent — multiple hide()/show() calls
//  produce the same single cleanup.
// ─────────────────────────────────────────────
let _exitHandlerRegistered = false;

/* istanbul ignore next — env detection has many branches */
const _isTestEnv = (): boolean => (
  process.env['JEST_WORKER_ID'] !== undefined ||
  process.env['VITEST'] !== undefined ||
  process.env['NODE_ENV'] === 'test'
);

/* istanbul ignore next — cursor restore body fires only on real exit/SIGINT/SIGTERM */
const _installCursorRestoreImpl = (): void => {
  const restore = (): void => {
    try { safeStreamWrite(process.stdout, cursor.show()); }
    catch { /* nothing we can do at exit time */ }
  };
  process.on('exit', restore);
  // SIGINT/SIGTERM: restore THEN exit with conventional codes
  process.on('SIGINT',  () => { restore(); process.exit(130); });
  process.on('SIGTERM', () => { restore(); process.exit(143); });
};

const _registerCursorRestore = (): void => {
  if (_exitHandlerRegistered) return;
  /* istanbul ignore next — guards against worker/sandbox without process.on */
  if (!process || typeof process.on !== 'function') return;
  _exitHandlerRegistered = true;
  // Skip in test environments — listeners keep the worker alive past test completion
  if (_isTestEnv()) return;
  /* istanbul ignore next — unreachable in test env, only runs in production */
  _installCursorRestoreImpl();
};

/**
 * Hide cursor and register an exit handler that restores it on crash/SIGINT.
 * Use this instead of writing `cursor.hide()` directly when you care about
 * leaving the user's shell in a clean state.
 */
export const hideCursor = (): boolean => {
  _registerCursorRestore();
  return safeStreamWrite(process.stdout, cursor.hide());
};

export const showCursor = (): boolean =>
  safeStreamWrite(process.stdout, cursor.show());

// ─────────────────────────────────────────────
//  Screen / line clearing
// ─────────────────────────────────────────────
export type EraseMode = 'down' | 'up' | 'all';

const ERASE_MODE_CODE: Record<EraseMode, number> = {
  down: 0,
  up:   1,
  all:  2,
};

export const screen = {
  clear:        (): string => `${CSI}2J${CSI}H`,
  /** Alias for clear() — covers `screen.clearAll()` callers. */
  clearAll:     (): string => `${CSI}2J${CSI}H`,
  clearLine:    (): string => `${CSI}2K`,
  clearRight:   (): string => `${CSI}0K`,
  clearLeft:    (): string => `${CSI}1K`,
  clearDown:    (): string => `${CSI}0J`,
  clearUp:      (): string => `${CSI}1J`,
  eraseDisplay: (mode: EraseMode = 'all'): string =>
    `${CSI}${ERASE_MODE_CODE[mode] ?? 2}J`,
  scrollUp:     (n = 1): string => `${CSI}${clampPositive(n)}S`,
  scrollDown:   (n = 1): string => `${CSI}${clampPositive(n)}T`,
} as const;

// ─────────────────────────────────────────────
//  Color and style codes
// ─────────────────────────────────────────────
export const FG = {
  black: 30, red: 31, green: 32, yellow: 33,
  blue: 34, magenta: 35, cyan: 36, white: 37,
  brightBlack: 90, brightRed: 91, brightGreen: 92,
  brightYellow: 93, brightBlue: 94, brightMagenta: 95,
  brightCyan: 96, brightWhite: 97,
} as const;

export const BG = {
  black: 40, red: 41, green: 42, yellow: 43,
  blue: 44, magenta: 45, cyan: 46, white: 47,
  brightBlack: 100, brightRed: 101, brightGreen: 102,
  brightYellow: 103, brightBlue: 104, brightMagenta: 105,
  brightCyan: 106, brightWhite: 107,
} as const;

export const STYLE = {
  reset: 0, bold: 1, dim: 2, italic: 3,
  underline: 4, blink: 5, inverse: 7,
  hidden: 8, strikethrough: 9,
} as const;

// ─────────────────────────────────────────────
//  SGR builders — never throw on bad input
// ─────────────────────────────────────────────
export const sgr = (...codes: AnsiCode[]): string => `${CSI}${codes.join(';')}m`;
export const reset = (): string => sgr(STYLE.reset);

export const fgRgb = (r: number, g: number, b: number): string =>
  `${CSI}38;2;${clampByte(r)};${clampByte(g)};${clampByte(b)}m`;

export const bgRgb = (r: number, g: number, b: number): string =>
  `${CSI}48;2;${clampByte(r)};${clampByte(g)};${clampByte(b)}m`;

export const fg256 = (n: number): string => `${CSI}38;5;${clampByte(n)}m`;
export const bg256 = (n: number): string => `${CSI}48;5;${clampByte(n)}m`;

// ─────────────────────────────────────────────
//  OSC sequences — terminal-wide effects
// ─────────────────────────────────────────────

/**
 * Set the terminal window title (OSC 2). Most terminals support this.
 * Returns the escape sequence; caller is responsible for writing it.
 */
export const setTitle = (text: string): string => {
  const safe = typeof text === 'string' ? text.replace(/[\x00-\x1f]/g, '') : '';
  return `${OSC}2;${safe}${BEL}`;
};

/**
 * Make `text` a clickable hyperlink to `url` (OSC 8).
 * Supported by iTerm2, Terminal.app (macOS 13+), WezTerm, Kitty, modern xterm.
 * Falls back gracefully (just prints text) on terminals that don't support it.
 */
export const link = (text: string, url: string): string => {
  // Strip control chars from both — they break the OSC parser
  const safeUrl = typeof url === 'string' ? url.replace(/[\x00-\x1f]/g, '') : '';
  const safeText = typeof text === 'string' ? text : String(text);
  if (!safeUrl) return safeText;
  return `${OSC}8;;${safeUrl}${BEL}${safeText}${OSC}8;;${BEL}`;
};

/** Ring the terminal bell. Most modern terminals visualize, not audio. */
export const bell = (): string => BEL;

// ─────────────────────────────────────────────
//  Capability detection
//
//  Order matters here: explicit signals (NO_COLOR, FORCE_COLOR,
//  TERM=dumb) win over heuristics. CI providers come next, then
//  COLORTERM/TERM_PROGRAM, then TERM string heuristics, then
//  Windows version fallback.
// ─────────────────────────────────────────────
export type ColorSupport = 'none' | 'basic' | '256' | 'truecolor';
export type ColorLevel = 0 | 1 | 2 | 3;

const COLOR_TO_LEVEL: Record<ColorSupport, ColorLevel> = {
  none: 0, basic: 1, '256': 2, truecolor: 3,
};

let _cachedSupport: ColorSupport | null = null;

const detectColorSupport = (): ColorSupport => {
  const env = process.env;

  // 1. Explicit overrides (highest priority)
  if (env['TERM'] === 'dumb') return 'none';
  if (env['NO_COLOR'] !== undefined && env['NO_COLOR'] !== '') return 'none';

  const forceColor = env['FORCE_COLOR'];
  if (forceColor !== undefined) {
    if (forceColor === '0' || forceColor === 'false') return 'none';
    if (forceColor === '1' || forceColor === 'true')  return 'basic';
    if (forceColor === '2')                           return '256';
    if (forceColor === '3')                           return 'truecolor';
    return 'basic';
  }

  // 2. Non-TTY → no color (unless overridden above)
  const stdout = process.stdout;
  if (!stdout || stdout.isTTY !== true) return 'none';

  // 3. CI providers — explicit knowledge of which support what
  if (env['CI']) {
    if (
      env['GITHUB_ACTIONS']  ||
      env['CIRCLECI']        ||
      env['GITLAB_CI']       ||
      env['BUILDKITE']       ||
      env['DRONE']
    ) return 'truecolor';
    if (env['TRAVIS']) return 'basic';
    return 'none';
  }

  // 4. COLORTERM is the strongest non-CI signal
  const colorterm = env['COLORTERM'];
  if (colorterm === 'truecolor' || colorterm === '24bit') return 'truecolor';

  // 5. Known terminal programs
  const termProgram = env['TERM_PROGRAM'];
  if (termProgram === 'iTerm.app')      return 'truecolor';
  if (termProgram === 'Apple_Terminal') return '256';
  if (termProgram === 'vscode')         return 'truecolor';
  if (termProgram === 'WezTerm')        return 'truecolor';
  if (termProgram === 'Hyper')          return 'truecolor';

  // 6. Windows Terminal — explicit truecolor signal
  if (env['WT_SESSION']) return 'truecolor';

  // 7. TERM heuristics — checked BEFORE Windows version fallback so an
  //    explicit TERM=xterm-256color is honored over OS version guessing.
  const term = env['TERM'];
  if (term) {
    if (term.includes('truecolor') || term.includes('24bit')) return 'truecolor';
    if (term.includes('256color') || term.includes('256'))    return '256';
    if (term.includes('color') || term === 'xterm' || term === 'screen' || term === 'tmux' || term === 'rxvt') {
      return 'basic';
    }
  }

  // 8. Windows version fallback — only when TERM didn't match
  /* istanbul ignore next — platform-specific Windows branches */
  if (process.platform === 'win32') {
    try {
      const release = os.release().split('.');
      const major = Number(release[0]);
      const build = Number(release[2]);
      if (major >= 10 && build >= 14931) return 'truecolor';
      if (major >= 10) return '256';
      return 'basic';
    } catch { return 'basic'; }
  }

  /* istanbul ignore next — only reached on non-Windows when all detection misses */
  return 'basic';
};

export const supportsColor = (): ColorSupport => {
  if (_cachedSupport !== null) return _cachedSupport;
  _cachedSupport = detectColorSupport();
  return _cachedSupport;
};

export const supportsColorLevel = (): ColorLevel =>
  COLOR_TO_LEVEL[supportsColor()];

/**
 * Reset the cached capability — call after changing FORCE_COLOR /
 * NO_COLOR env vars at runtime, or before a test that needs to
 * exercise different code paths.
 */
export const resetColorSupportCache = (): void => {
  _cachedSupport = null;
};

// ─────────────────────────────────────────────
//  Terminal dimensions
//
//  Read live from process.stdout each call so callers always see
//  current size after a SIGWINCH/resize. Fall back to 80x24 (the
//  classic VT100 default) when stdout is missing or not a TTY.
// ─────────────────────────────────────────────

/** Returns terminal width in columns. Falls back to DEFAULT_TERM_COLS. */
export const getTerminalWidth = (): number => {
  const cols = process.stdout?.columns;
  return typeof cols === 'number' && cols > 0 ? cols : DEFAULT_TERM_COLS;
};

/** Returns terminal height in rows. Falls back to DEFAULT_TERM_ROWS. */
export const getTerminalHeight = (): number => {
  const rows = process.stdout?.rows;
  return typeof rows === 'number' && rows > 0 ? rows : DEFAULT_TERM_ROWS;
};

// ─────────────────────────────────────────────
//  Strip ANSI sequences
//
//  The regex covers CSI, OSC, DCS/SOS/PM/APC, charset selection, and
//  single-character escapes. This is intentionally broader than just
//  `[0-9;]m` so it strips cursor moves, screen clears, hyperlinks, etc.
// ─────────────────────────────────────────────
const ANSI_RE = new RegExp(
  [
    '\\x1b\\[[0-?]*[ -/]*[@-~]',         // CSI
    '\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)', // OSC
    '\\x1b[PX^_][\\s\\S]*?\\x1b\\\\',    // DCS / SOS / PM / APC
    '\\x1b[()][A-Za-z0-9]',              // Charset selection
    '\\x1b[@-Z\\\\-_NOMP78=>c]',          // single-char escapes
  ].join('|'),
  'g',
);

export const stripAnsi = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str.replace(ANSI_RE, '');
};

// ─────────────────────────────────────────────
//  I/O — stream-safe write functions
//
//  All accept anything; non-string is coerced. Never throw.
// ─────────────────────────────────────────────

const ensureString = (str: unknown): string =>
  typeof str === 'string' ? str : String(str ?? '');

/** Sync write to stdout. Returns false if stdout is missing or full. */
export const write = (str: string): boolean =>
  safeStreamWrite(process.stdout, ensureString(str));

/** Sync write to stderr. Useful for CLI errors and logs. */
export const writeErr = (str: string): boolean =>
  safeStreamWrite(process.stderr, ensureString(str));

export const writeln = (str = ''): boolean =>
  safeStreamWrite(process.stdout, ensureString(str) + '\n');

export const writelnErr = (str = ''): boolean =>
  safeStreamWrite(process.stderr, ensureString(str) + '\n');

/**
 * Async write with backpressure handling.
 *  - Resolves immediately when the buffer accepted the data
 *  - Waits for `'drain'` when full
 *  - Resolves on `'error'` instead of hanging forever
 *  - No-ops gracefully if stdout is missing
 *  - Optional timeout (ms) — resolves anyway after timeout to prevent
 *    infinite hangs on broken streams
 */
export interface WriteAsyncOptions {
  /** Max time (ms) to wait for drain. Default: 5000. 0 disables. */
  timeout?: number;
}

export const writeAsync = (
  str: string,
  opts: WriteAsyncOptions = {},
): Promise<void> => {
  const stdout = process.stdout;
  const safeStr = ensureString(str);
  if (!stdout || typeof stdout.write !== 'function') return Promise.resolve();

  let writeOk = false;
  /* istanbul ignore next */
  try { writeOk = stdout.write(safeStr); }
  catch { return Promise.resolve(); }

  if (writeOk) return Promise.resolve();

  const timeout = opts.timeout ?? 5000;

  return new Promise<void>((resolve) => {
    let resolved = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    /* istanbul ignore next — backpressure cleanup only fires when stream blocks */
    const cleanup = (): void => {
      if (resolved) return;
      resolved = true;
      if (timeoutHandle) { clearTimeout(timeoutHandle); timeoutHandle = null; }
      const stream = stdout as { off?(event: string, fn: () => void): void };
      if (typeof stream.off === 'function') {
        try {
          stream.off('drain', onDrain);
          stream.off('error', onError);
        } catch { /* ignore */ }
      }
      resolve();
    };
    const onDrain = (): void => cleanup();
    const onError = (): void => cleanup();

    /* istanbul ignore next */
    try { stdout.once('drain', onDrain); }
    catch { cleanup(); return; }
    /* istanbul ignore next */
    try { stdout.once('error', onError); }
    catch { /* error listener registration failed — drain still works */ }

    if (timeout > 0) {
      timeoutHandle = setTimeout(cleanup, timeout);
    }
  });
};

// ─────────────────────────────────────────────
//  Output buffer — batched rendering
//
//  Building up many small writes into a single buffer and flushing
//  once is much faster than many individual write() calls.
//  Use for animation frames or complex UI updates.
// ─────────────────────────────────────────────

export interface OutputBuffer {
  /** Append a string to the buffer. */
  push(str: string): OutputBuffer;
  /** Append a string with a trailing newline. */
  pushln(str?: string): OutputBuffer;
  /** Append `str` only when `cond` is truthy. Useful for conditional escapes. */
  pushIf(cond: unknown, str: string): OutputBuffer;
  /** Get the buffered content without flushing. */
  toString(): string;
  /** Number of characters currently buffered. */
  length(): number;
  /** Clear the buffer without writing. */
  reset(): OutputBuffer;
  /** Flush to stdout synchronously. Returns false on backpressure. */
  flush(): boolean;
  /** Flush to stdout asynchronously. Awaits drain on backpressure. */
  flushAsync(opts?: WriteAsyncOptions): Promise<void>;
}

export const createOutputBuffer = (): OutputBuffer => {
  let buf = '';
  const api: OutputBuffer = {
    push(str: string)         { buf += ensureString(str); return api; },
    pushln(str = '')          { buf += ensureString(str) + '\n'; return api; },
    pushIf(cond, str)         { if (cond) buf += ensureString(str); return api; },
    toString()                { return buf; },
    length()                  { return buf.length; },
    reset()                   { buf = ''; return api; },
    flush()                   {
      if (buf.length === 0) return true;
      const out = buf;
      buf = '';
      return write(out);
    },
    async flushAsync(opts) {
      if (buf.length === 0) return;
      const out = buf;
      buf = '';
      await writeAsync(out, opts);
    },
  };
  return api;
};

// ─────────────────────────────────────────────
//  Frame throttling — avoid CPU saturation in animations
// ─────────────────────────────────────────────

/** Recommended frame interval (ms) for animations. ~60 fps. */
export const FRAME_MS = 16;

// ─────────────────────────────────────────────
//  sleep — cancellable via AbortSignal
// ─────────────────────────────────────────────

export interface SleepOptions {
  /** Optional AbortSignal — sleep resolves immediately when aborted. */
  signal?: AbortSignal;
}

/**
 * Pause for `ms` milliseconds. Cancellable via AbortSignal.
 * - Negative or NaN ms is clamped to 0
 * - Resolves silently on abort (no rejection)
 * - Cleans up timer + listener on every path
 */
export const sleep = (ms: number, opts: SleepOptions = {}): Promise<void> =>
  new Promise((resolve) => {
    const safeMs = isFiniteNumber(ms) ? Math.max(0, ms) : 0;
    const { signal } = opts;
    if (signal?.aborted) {
      resolve();
      return;
    }

    let resolved = false;
    const finish = (): void => {
      /* istanbul ignore if — defensive: double-call guard for timer+abort race */
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = (): void => finish();

    const timer = setTimeout(finish, safeMs);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Like sleep, but rounds the wait time up to the next frame boundary.
 * Useful inside animation loops to throttle output to a reasonable framerate.
 */
export const sleepFrame = (
  ms: number = FRAME_MS,
  opts: SleepOptions = {},
): Promise<void> => sleep(
  Math.max(FRAME_MS, Math.round((isFiniteNumber(ms) ? ms : FRAME_MS) / FRAME_MS) * FRAME_MS),
  opts,
);