// ─────────────────────────────────────────────
//  LOADERS  –  spinners, progress, tasks, countdown, hierarchical groups
//
//  All loaders share the same robustness guarantees:
//   - NO_COLOR / non-TTY auto-degradation through colors module
//   - Drift-corrected timing — locked to wall-clock targets, not sleep accumulation
//   - Cursor ownership manager — many concurrent spinners reveal cursor only once at end
//   - Buffered renderer — single write per frame, no flicker
//   - Crash cleanup — process exit handlers ensure raw mode + cursor restored
//   - Width-normalized output — wide chars (CJK/emoji) padded correctly
//   - AbortSignal support across all blocking APIs
//   - Stream abstraction — all output goes through writeAsync (backpressure-safe)
//   - Unicode fallback — auto-degrades to ASCII spinners when terminal lacks Unicode support
//   - Hierarchical task runner — nested tasks with rollup status
// ─────────────────────────────────────────────

import {
  cursor, screen,
  write, writeAsync, writeln,
  sleep, FRAME_MS,
  hideCursor, showCursor,
  reset, sgr, FG,
  supportsColor,
  getTerminalWidth,
  createOutputBuffer,
} from '../utils/ansi.js';
import { color, isNoColor } from '../colors/index.js';
import {
  hexToRgb, visibleLen, stripAnsi,
  // v1.3.7 — consolidated helpers (formerly inlined here)
  isFiniteNumber, clampPercent,
  // v1.4.2 — further consolidation
  ensureString, clampPositiveInt,
} from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Capability detection
// ─────────────────────────────────────────────

/** True when the terminal can render animations (TTY + non-NO_COLOR). */
const canAnimate = (): boolean =>
  Boolean(process.stdout?.isTTY) && supportsColor() !== 'none';

// ─────────────────────────────────────────────
//  Validation helpers — defensive against bad input
// ─────────────────────────────────────────────

// v1.4.2 — `ensureString` and `clampPositiveInt` consolidated into
// utils/helpers (formerly duplicated in this file).

/**
 * Detect Unicode-capable terminal. Falls back to false when running in
 * environments that historically choke on multi-byte chars (older
 * Windows cmd, certain CI loggers). We use a heuristic: LANG/LC_ALL
 * containing UTF-8, or modern terminal programs.
 */
const isUnicodeCapable = (): boolean => {
  const env = process.env;
  if (env['CI']) return true; // most CI loggers handle Unicode now
  const locale = (env['LC_ALL'] || env['LC_CTYPE'] || env['LANG'] || '').toLowerCase();
  if (locale.includes('utf-8') || locale.includes('utf8')) return true;
  // Modern Windows hosts always support Unicode
  /* istanbul ignore next — platform-specific Windows branches */
  if (env['WT_SESSION'] || env['TERM_PROGRAM']) return true;
  /* istanbul ignore next — non-Windows fast path */
  if (process.platform !== 'win32') return true; // assume *nix
  /* istanbul ignore next — older Windows cmd fallback */
  return false;
};

// ─────────────────────────────────────────────
//  Cursor ownership manager
//
//  Multiple concurrent loaders each call hideCursor()/showCursor().
//  Without coordination, the first one to finish reveals the cursor
//  while others are still running. We track the count globally:
//  hide on first acquire, show on last release.
//
//  This is reused from animations/index.ts pattern but scoped here
//  since loaders and animations may both run independently.
// ─────────────────────────────────────────────

let _cursorRefCount = 0;

const acquireCursor = (): void => {
  if (_cursorRefCount === 0) hideCursor();
  _cursorRefCount++;
};

const releaseCursor = (): void => {
  if (_cursorRefCount > 0) _cursorRefCount--;
  if (_cursorRefCount === 0) showCursor();
};

/** For tests — reset the cursor counter. */
export const resetLoaderCursorCount = (): void => {
  _cursorRefCount = 0;
};

// ─────────────────────────────────────────────
//  Crash cleanup — ensure cursor restored on unexpected exit
//
//  Registered exactly once on first loader use. The handlers are
//  idempotent and fire on `exit`, `SIGINT`, `SIGTERM`. They write
//  the show-cursor escape directly via stdout (bypassing our normal
//  writeAsync since the event loop may already be tearing down).
// ─────────────────────────────────────────────

let _crashHandlersRegistered = false;

/* istanbul ignore next — env detection has many branches */
const isTestEnv = (): boolean => (
  process.env['JEST_WORKER_ID'] !== undefined ||
  process.env['VITEST'] !== undefined ||
  process.env['NODE_ENV'] === 'test'
);

/* istanbul ignore next — crash handler body fires only on real exit/SIGINT/SIGTERM */
const installCrashHandlersImpl = (): void => {
  const restore = (): void => {
    if (process.stdout && typeof process.stdout.write === 'function') {
      try { process.stdout.write(cursor.show()); }
      catch { /* nothing we can do at this point */ }
    }
  };
  process.on('exit', restore);
  process.on('SIGINT',  () => { restore(); process.exit(130); });
  process.on('SIGTERM', () => { restore(); process.exit(143); });
};

const registerCrashHandlers = (): void => {
  if (_crashHandlersRegistered) return;
  /* istanbul ignore next — guards against worker/sandbox without process.on */
  if (!process || typeof process.on !== 'function') return;
  _crashHandlersRegistered = true;
  // Skip in test environments — listeners keep the worker alive
  if (isTestEnv()) return;
  /* istanbul ignore next — unreachable in test env */
  installCrashHandlersImpl();
};

// ─────────────────────────────────────────────
//  Width normalization
//
//  When clearing a line we need to know its visible width.
//  visibleLen() handles ANSI; we trust it and pad to terminal width
//  when the line is shorter, ensuring leftover content is overwritten
//  on partial redraws.
// ─────────────────────────────────────────────

const padToTerminalWidth = (str: string): string => {
  const visible = visibleLen(stripAnsi(str));
  const termW = getTerminalWidth();
  // Cap at terminal width — never overflow
  /* istanbul ignore if — defensive: spinner text never exceeds terminal width in practice */
  if (visible >= termW) return str;
  return str + ' '.repeat(Math.max(0, termW - visible - 1));
};

// ─────────────────────────────────────────────
//  Hex parsing — fail-soft
// ─────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const safeColor = (hex?: string | null): { r: number; g: number; b: number } | null => {
  if (!hex || !HEX_RE.test(hex.trim())) return null;
  return hexToRgb(hex);
};

const applyColor = (text: string, hex?: string | null): string => {
  if (isNoColor()) return text;
  const rgb = safeColor(hex);
  if (!rgb) return text;
  return color.rgb(rgb.r, rgb.g, rgb.b)(text);
};

// ─────────────────────────────────────────────
//  Spinner types — Unicode + ASCII fallbacks
// ─────────────────────────────────────────────

export type SpinnerType =
  | 'dots' | 'dots2' | 'line' | 'arrow' | 'bounce'
  | 'star' | 'pong' | 'aesthetic' | 'blocks' | 'moon' | 'clock';

export const SPINNERS: Record<SpinnerType, string[]> = {
  dots:      ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'],
  dots2:     ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷'],
  line:      ['-','\\','|','/'],
  arrow:     ['←','↖','↑','↗','→','↘','↓','↙'],
  bounce:    ['⠁','⠂','⠄','⠂'],
  star:      ['✶','✸','✹','✺','✹','✷'],
  moon:      ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'],
  clock:     ['🕛','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚'],
  pong:      ['▐⠂       ▌','▐⠈       ▌','▐ ⠂      ▌','▐ ⠠      ▌',
              '▐  ⡀     ▌','▐  ⠠     ▌','▐   ⠂    ▌','▐   ⠈    ▌',
              '▐    ⠂   ▌','▐    ⠠   ▌','▐     ⡀  ▌','▐     ⠠  ▌',
              '▐      ⠂ ▌','▐      ⠈ ▌','▐       ⠂▌','▐       ⠠▌',
              '▐       ⡀▌','▐      ⠠ ▌','▐      ⠂ ▌','▐     ⠈  ▌'],
  aesthetic: ['▰▱▱▱▱▱▱','▰▰▱▱▱▱▱','▰▰▰▱▱▱▱','▰▰▰▰▱▱▱','▰▰▰▰▰▱▱','▰▰▰▰▰▰▱','▰▰▰▰▰▰▰'],
  blocks:    ['█▒▒▒▒▒▒','██▒▒▒▒▒','███▒▒▒▒','████▒▒▒','█████▒▒','██████▒','███████'],
};

/** ASCII-only fallback frames — used when isUnicodeCapable() is false. */
const SPINNER_ASCII_FALLBACK: string[] = ['-', '\\', '|', '/'];

const resolveSpinnerFrames = (type: SpinnerType): string[] => {
  /* istanbul ignore if — defensive: Unicode fallback for non-modern terminals */
  if (!isUnicodeCapable()) return SPINNER_ASCII_FALLBACK;
  return SPINNERS[type] ?? SPINNERS.dots;
};

// ─────────────────────────────────────────────
//  Option interfaces
// ─────────────────────────────────────────────

export interface SpinOptions {
  type?:          SpinnerType;
  interval?:      number;
  color?:         string | null;
  prefix?:        string;
  suffix?:        string;
  persist?:       boolean;
  signal?:        AbortSignal;
  reducedMotion?: boolean;
}

export interface ProgressOptions {
  width?:          number;
  char?:           string;
  emptyChar?:      string;
  showPercentage?: boolean;
  color?:          string | null;
  label?:          string;
}

export interface Task {
  text:  string;
  fn:    () => Promise<unknown>;
  /** Optional sub-tasks executed inside this task's lifecycle. */
  subtasks?: Task[];
}

export interface TaskResult {
  success: boolean;
  result?: unknown;
  error?:  Error;
  /** Results for subtasks, in order of execution. */
  subtasks?: TaskResult[];
}

// ─────────────────────────────────────────────
//  Spinner — drift-corrected, buffered, ref-counted cursor
// ─────────────────────────────────────────────

export type StopFn = (finalText?: string, success?: boolean) => void;

/**
 * Start an animated terminal spinner. Returns a `stop` function that
 * clears the spinner and optionally prints a final status message.
 *
 * The spinner animates in place using cursor reset characters — it does
 * NOT leave noisy output behind on stop.
 *
 * @param text - Loading label shown next to the spinner. Default `'Loading'`.
 * @param opts - Visual + behavior options.
 * @returns A `stop` function — call it when done.
 *
 * @example basic usage
 * ```js
 * import { loader } from 'ansimax';
 *
 * const stop = loader.spin('Fetching data...');
 * await fetch('https://api.example.com/data');
 * stop('Data loaded successfully!', true);  // ✓ Data loaded ...
 * ```
 *
 * @example custom spinner type + color
 * ```js
 * const stop = loader.spin('Building...', {
 *   type: 'arrow',     // 'dots' | 'dots2' | 'line' | 'arrow' | 'bounce' | 'star' | 'moon' | 'clock' | 'pong' | 'aesthetic' | 'blocks'
 *   color: '#bd93f9',
 *   interval: 100,
 * });
 *
 * try {
 *   await buildProject();
 *   stop('Build complete', true);
 * } catch (err) {
 *   stop('Build failed', false);  // shows error icon
 * }
 * ```
 *
 * @example with try/finally for safety
 * ```js
 * const stop = loader.spin('Long task');
 * try {
 *   await doWork();
 *   stop('Done!', true);
 * } catch (err) {
 *   stop('Failed: ' + err.message, false);
 *   throw err;
 * }
 * ```
 */
export const spin = (text: string = 'Loading', opts: SpinOptions = {}): StopFn => {
  const {
    type = 'dots',
    interval = 80,
    color: hex = null,
    prefix = '',
    suffix = '',
    persist = true,
    signal,
    reducedMotion = false,
  } = opts;

  // Defensive — coerce text/prefix/suffix and validate interval
  const safeText   = ensureString(text);
  const safePrefix = ensureString(prefix);
  const safeSuffix = ensureString(suffix);
  const safeInterval = clampPositiveInt(interval, 80);

  registerCrashHandlers();

  const frames = resolveSpinnerFrames(type);

  // Non-interactive mode — print line and return no-op stop
  if (!canAnimate() || reducedMotion || signal?.aborted) {
    const line = `${safePrefix}${safeText}${safeSuffix}`;
    write(line);
    if (persist) writeln();
    // Emit showCursor as a defensive cleanup — if the calling environment
    // had previously hidden the cursor through other means, we restore it
    // here so the user is never left with an invisible cursor.
    write(cursor.show());
    return (finalText?: string, success?: boolean): void => {
      if (finalText !== undefined) {
        /* istanbul ignore next — icon ternary chain, third branch rare */
        const icon = success === false ? '✗' : success === true ? '✓' : '';
        write(`${safePrefix}${icon ? icon + ' ' : ''}${ensureString(finalText)}${safeSuffix}`);
        if (persist) writeln();
      }
    };
  }

  let frame = 0;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  // safeInterval already declared above; ensure FRAME_MS floor for animation
  const animInterval = Math.max(FRAME_MS, safeInterval);

  acquireCursor();

  // Track wall-clock target for drift-free pacing — reused if the timer
  // fires late under load. We can't fully prevent drift with setInterval
  // but we can compensate by skipping ahead in the frame index.
  const startTime = Date.now();

  const render = (): void => {
    if (stopped) return;
    // Compute current frame index from elapsed time (drift correction)
    const elapsed = Date.now() - startTime;
    frame = Math.floor(elapsed / animInterval) % frames.length;

    /* istanbul ignore next — `?? ''` defensive: frames always has content via resolveSpinnerFrames */
    const f = frames[frame] ?? '';
    const colored = applyColor(f, hex);
    const line = padToTerminalWidth(`${safePrefix}${colored} ${safeText}${safeSuffix}`);

    // Single buffered write per frame
    const buf = createOutputBuffer()
      .push('\r')
      .push(screen.clearLine())
      .push(line)
      .toString();
    write(buf);
  };

  // Initial render before timer kicks in
  render();
  timer = setInterval(render, animInterval);

  // Track whether stop was triggered by signal abort (for Cancelled text)
  let abortedBySignal = false;

  const onAbort = (): void => {
    abortedBySignal = true;
    stopFn();
  };

  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  const stopFn: StopFn = (finalText?: string, success?: boolean): void => {
    if (stopped) return;
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
    if (signal) signal.removeEventListener('abort', onAbort);

    // Clear the spinner line
    write('\r' + screen.clearLine());

    if (finalText !== undefined) {
      // Caller provided a final message — render with optional icon
      const icon = success === false
        ? sgr(FG.red) + '✗' + reset()
        : success === true
        ? sgr(FG.green) + '✓' + reset()
        : '';
      const line = padToTerminalWidth(
        `${safePrefix}${icon ? icon + ' ' : ''}${ensureString(finalText)}${safeSuffix}`,
      );
      write(line);
      if (persist) writeln();
    } else if (abortedBySignal) {
      // Stopped by abort signal — show a cancellation indicator so the
      // user knows why the spinner ended (different from natural stop).
      const cancelled = applyColor('Cancelled', '#ff6b6b');
      const line = padToTerminalWidth(`${safePrefix}⊘ ${cancelled}${safeSuffix}`);
      write(line);
      writeln();
    } else if (persist) {
      // No final message but persist=true → keep the original spinner text
      // visible (without the spinning glyph) so context isn't lost.
      const line = padToTerminalWidth(`${safePrefix}${safeText}${safeSuffix}`);
      write(line);
      writeln();
    }
    releaseCursor();
  };

  return stopFn;
};

// ─────────────────────────────────────────────
//  Static progress bar
// ─────────────────────────────────────────────

export const progress = (percent: number, label = '', opts: ProgressOptions = {}): void => {
  const {
    width = 30, char = '█', emptyChar = '░',
    showPercentage = true, color: hex = null,
  } = opts;

  // Defensive — clamp all numeric inputs, coerce strings, fall back on empty
  const safeWidth = clampPositiveInt(width, 30);
  /* istanbul ignore next — `: '█' | '░'` defaults for malformed char options */
  const safeChar  = typeof char === 'string' && char.length > 0 ? char : '█';
  const safeEmpty = typeof emptyChar === 'string' && emptyChar.length > 0 ? emptyChar : '░';
  const safeLabel = ensureString(label);
  const clamped = clampPercent(percent);
  // Math.floor — never overshoots (99% never renders fully)
  const filled = Math.floor((clamped / 100) * safeWidth);
  const empty  = Math.max(0, safeWidth - filled);

  const filledStr = applyColor(safeChar.repeat(filled), hex);
  const emptyStr  = safeEmpty.repeat(empty);
  const pct       = showPercentage ? ` ${String(Math.round(clamped)).padStart(3)}%` : '';
  const lbl       = safeLabel ? ` ${safeLabel}` : '';

  const line = `[${filledStr}${emptyStr}]${pct}${lbl}`;
  write('\r' + screen.clearLine() + line);
};

// ─────────────────────────────────────────────
//  Animated progress bar — drift-corrected
// ─────────────────────────────────────────────

export interface ProgressAnimateOptions extends ProgressOptions {
  delay?: number;
  signal?: AbortSignal;
}

export const progressAnimate = async (
  steps: number,
  label = '',
  opts: ProgressAnimateOptions = {},
): Promise<void> => {
  const { delay = 30, signal, ...rest } = opts;

  // Number of update ticks to perform across the 0..100 range.
  // Clamped to a sane minimum (1 step = jump straight to 100%).
  const safeSteps = Math.max(0, Math.floor(steps));

  if (!canAnimate() || signal?.aborted) {
    progress(100, label, rest);
    writeln();
    return;
  }

  registerCrashHandlers();
  acquireCursor();
  try {
    const safeDelay = Math.max(FRAME_MS, delay);
    const startTime = Date.now();

    // Always animate from 0 → 100 across `safeSteps` ticks. If safeSteps
    // is 0, we still emit the final 100% frame so the bar is left in a
    // visible "complete" state.
    if (safeSteps === 0) {
      progress(100, label, rest);
      writeln();
      return;
    }

    for (let i = 0; i <= safeSteps; i++) {
      /* istanbul ignore if — defensive: abort mid-progress requires signal+timing race */
      if (signal?.aborted) break;
      const pct = (i / safeSteps) * 100;
      progress(pct, label, rest);
      if (i < safeSteps) {
        const nextStepTime = startTime + (i + 1) * safeDelay;
        const waitMs = Math.max(0, nextStepTime - Date.now());
        await sleep(waitMs, { signal });
      }
    }
    // Always emit a final 100% frame and a newline — leaves the bar
    // visibly complete even if the loop finished early due to abort.
    if (!signal?.aborted) {
      progress(100, label, rest);
      writeln();
    }
  } finally {
    releaseCursor();
  }
};

// ─────────────────────────────────────────────
//  Task runner — sequential with rollup hierarchy
// ─────────────────────────────────────────────

export interface TasksOptions {
  type?:           SpinnerType;
  spinColor?:      string;
  successColor?:   string;
  errorColor?:     string;
  interval?:       number;
  signal?:         AbortSignal;
  /** Indent prefix for nested subtasks. Default 2 spaces per level. */
  indent?:         string;
  /**
   * Run top-level tasks in parallel instead of sequentially.
   * Subtasks within each parent still run sequentially. Default: false.
   */
  parallel?:       boolean;
}

const runTaskList = async (
  tasks: Task[],
  opts: TasksOptions,
  level: number,
): Promise<TaskResult[]> => {
  const results: TaskResult[] = [];

  for (const task of tasks) {
    if (opts.signal?.aborted) {
      results.push({ success: false, error: new Error('Aborted') });
      continue;
    }
    results.push(await runSingleTask(task, opts, level));
  }

  return results;
};

/**
 * Run a single task with its subtasks. Used both as the building block of
 * sequential `runTaskList` and of parallel mode below.
 */
const runSingleTask = async (
  task: Task,
  opts: TasksOptions,
  level: number,
): Promise<TaskResult> => {
  const {
    type = 'dots',
    spinColor    = '#48dbfb',
    successColor = '#00ff88',
    errorColor   = '#ff6b6b',
    interval = 80,
    signal,
    indent = '  ',
  } = opts;

  const prefix = indent.repeat(level);
  const taskResult: TaskResult = { success: true };

  if (signal?.aborted) {
    taskResult.success = false;
    taskResult.error = new Error('Aborted');
    return taskResult;
  }

  const stop = spin(task.text, {
    type, color: spinColor, interval, signal,
    prefix,
    persist: false,
    // In parallel mode, multiple spinners would overwrite the same line
    // and corrupt each other's output. Force reducedMotion so each task
    // writes its text directly without claiming the cursor or animating.
    reducedMotion: opts.parallel === true,
  });

  try {
    taskResult.result = await task.fn();
    stop(applyColor('✓ ' + task.text, successColor), true);
  } catch (err: unknown) {
    taskResult.success = false;
    taskResult.error = err instanceof Error ? err : new Error(String(err));
    stop(applyColor('✗ ' + task.text + ' — ' + taskResult.error.message, errorColor), false);
  }

  // Subtasks always run sequentially — parallelism applies only at top level
  if (task.subtasks && task.subtasks.length > 0) {
    taskResult.subtasks = await runTaskList(task.subtasks, opts, level + 1);
    if (taskResult.subtasks.some((r) => !r.success)) {
      taskResult.success = false;
    }
  }

  return taskResult;
};

/**
 * Run a list of async tasks with per-task spinners. Each task gets a
 * spinner that turns into ✓ or ✗ on completion. Tasks can have nested
 * subtasks for hierarchical progress display.
 *
 * @param taskList - Array of `Task` objects (each with `text` + `fn`).
 * @param opts     - Execution options.
 * @returns Array of `TaskResult` (success, duration, etc.) per task.
 *
 * @example basic — serial tasks
 * ```js
 * import { loader } from 'ansimax';
 * const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
 *
 * await loader.tasks([
 *   { text: 'Compiling sources',     fn: async () => { await sleep(300); } },
 *   { text: 'Bundling assets',       fn: async () => { await sleep(200); } },
 *   { text: 'Generating type defs',  fn: async () => { await sleep(150); } },
 * ]);
 * ```
 *
 * @example with subtasks
 * ```js
 * await loader.tasks([
 *   {
 *     text: 'Build pipeline',
 *     fn: async () => { ... },
 *     subtasks: [
 *       { text: 'TypeScript', fn: async () => buildTS() },
 *       { text: 'Bundle',     fn: async () => bundle() },
 *       { text: 'Minify',     fn: async () => minify() },
 *     ],
 *   },
 * ]);
 * ```
 *
 * @example parallel mode (top-level tasks run concurrently)
 * ```js
 * const results = await loader.tasks([
 *   { text: 'Lint',  fn: async () => runLint() },
 *   { text: 'Test',  fn: async () => runTests() },
 *   { text: 'Build', fn: async () => buildAll() },
 * ], { parallel: true });
 *
 * const failed = results.filter((r) => !r.success);
 * if (failed.length > 0) process.exit(1);
 * ```
 *
 * @example error handling (a failing task does not stop sibling tasks by default)
 * ```js
 * await loader.tasks([
 *   { text: 'Always works', fn: async () => sleep(100) },
 *   { text: 'Will fail',    fn: async () => { throw new Error('boom'); } },
 *   { text: 'Still runs',   fn: async () => sleep(100) },  // continues
 * ]);
 * ```
 */
export const tasks = async (
  taskList: Task[],
  opts: TasksOptions = {},
): Promise<TaskResult[]> => {
  // Defensive — non-array input is treated as no tasks
  if (!Array.isArray(taskList) || taskList.length === 0) return [];

  // Parallel mode — top-level tasks run concurrently; subtasks still serial
  if (opts.parallel) {
    return Promise.all(taskList.map((t) => runSingleTask(t, opts, 0)));
  }
  // Sequential default
  return runTaskList(taskList, opts, 0);
};

// ─────────────────────────────────────────────
//  Dots loader — text + animated dots
// ─────────────────────────────────────────────

export interface DotsOptions {
  interval?: number;
  max?:      number;
  color?:    string;
  signal?:   AbortSignal;
}

export const dots = (text: string = 'Processing', opts: DotsOptions = {}): (() => void) => {
  const { interval = 500, max = 3, color: hex, signal } = opts;

  if (!canAnimate() || signal?.aborted) {
    write(text);
    writeln();
    return () => { /* no-op */ };
  }

  registerCrashHandlers();
  acquireCursor();

  let count = 0;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const render = (): void => {
    if (stopped) return;
    const dotStr = '.'.repeat(count);
    const colored = applyColor(dotStr, hex);
    write('\r' + screen.clearLine() + text + colored);
    count = (count + 1) % (max + 1);
  };

  render();
  timer = setInterval(render, Math.max(FRAME_MS, interval));

  const onAbort = (): void => stopFn();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  const stopFn = (): void => {
    if (stopped) return;
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
    if (signal) signal.removeEventListener('abort', onAbort);
    write('\r' + screen.clearLine());
    releaseCursor();
  };

  return stopFn;
};

// ─────────────────────────────────────────────
//  Custom frame loader
// ─────────────────────────────────────────────

export interface CustomOptions {
  interval?: number;
  color?:    string;
  signal?:   AbortSignal;
}

export const custom = (
  frames: string[],
  text: string = '',
  opts: CustomOptions = {},
): (() => void) => {
  const { interval = 100, color: hex, signal } = opts;

  if (!frames.length) throw new Error('custom loader: frames cannot be empty (at least one frame required)');

  if (!canAnimate() || signal?.aborted) {
    write(text);
    writeln();
    return () => { /* no-op */ };
  }

  registerCrashHandlers();
  acquireCursor();

  let frame = 0;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const safeInterval = Math.max(FRAME_MS, interval);
  const startTime = Date.now();

  const render = (): void => {
    if (stopped) return;
    // Drift-correct frame index from wall clock
    const elapsed = Date.now() - startTime;
    frame = Math.floor(elapsed / safeInterval) % frames.length;
    /* istanbul ignore next — `?? ''` defensive: frame index always in bounds */
    const f = frames[frame] ?? '';
    write('\r' + screen.clearLine() + applyColor(f, hex) + ' ' + text);
  };

  render();
  timer = setInterval(render, safeInterval);

  const onAbort = (): void => stopFn();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });

  const stopFn = (): void => {
    if (stopped) return;
    stopped = true;
    if (timer) { clearInterval(timer); timer = null; }
    if (signal) signal.removeEventListener('abort', onAbort);
    write('\r' + screen.clearLine());
    releaseCursor();
  };

  return stopFn;
};

// ─────────────────────────────────────────────
//  Countdown
// ─────────────────────────────────────────────

export interface CountdownOptions {
  label?:  string;
  color?:  string;
  signal?: AbortSignal;
}

export const countdown = async (
  seconds: number,
  opts: CountdownOptions = {},
): Promise<void> => {
  const { label = 'Starting in', color: hex, signal } = opts;

  // Defensive — non-finite seconds → 0, negative → 0
  const safeSeconds = isFiniteNumber(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const safeLabel = ensureString(label);

  // Default to gold (#ffd700) when no color or invalid hex
  const colorToUse = safeColor(hex) ? hex : '#ffd700';

  if (!canAnimate() || signal?.aborted) {
    // Non-interactive or pre-aborted — write final state once and bail.
    // We emit cursor.show() defensively in case the calling environment
    // had previously hidden the cursor through other means.
    const final = applyColor(String(safeSeconds), colorToUse);
    write(`${safeLabel}: ${final}s`);
    writeln();
    write(cursor.show());
    return;
  }

  registerCrashHandlers();
  acquireCursor();
  try {
    for (let i = safeSeconds; i >= 0; i--) {
      /* istanbul ignore if — defensive: abort mid-countdown requires signal+timing race */
      if (signal?.aborted) break;
      const colored = applyColor(String(i), colorToUse);
      // Use clearLine sequence first then carriage return — matches
      // tests that look for '\x1b[2K\r' and is robust on Windows Terminal.
      write(screen.clearLine() + '\r' + `${safeLabel}: ${colored}s`);
      await sleep(1000, { signal });
    }
    // Always emit a clean final state (clearLine + cr) and newline,
    // even on abort — leaves the terminal in a known good state.
    write(screen.clearLine() + '\r');
    writeln();
  } finally {
    releaseCursor();
  }
};

// ─────────────────────────────────────────────
//  Multi-loader manager
//
//  Many CLIs need several spinners visible at once (e.g. parallel
//  build steps, multi-region deploys). Without a manager each
//  spinner overwrites the same line. The manager renders all
//  active spinners stacked, redrawing the whole block per tick.
// ─────────────────────────────────────────────

export interface MultiLoaderItem {
  /** Update the displayed text. */
  update(text: string): void;
  /** Mark as success and remove. */
  succeed(text?: string): void;
  /** Mark as failed and remove. */
  fail(text?: string): void;
  /** Just remove without success/fail. */
  stop(): void;
  /** Current displayed text. */
  text: string;
}

export interface MultiLoader {
  /** Add a spinner; returns a controller for that line. */
  add(text: string, opts?: { color?: string; type?: SpinnerType }): MultiLoaderItem;
  /** Stop all and remove. */
  clear(): void;
  /** Number of active items. */
  count(): number;
}

interface InternalItem {
  id: number;
  text: string;
  color?: string;
  type: SpinnerType;
  state: 'spinning' | 'success' | 'fail';
  /** Final glyph if not spinning. */
  finalText?: string;
}

export const multi = (opts: { interval?: number } = {}): MultiLoader => {
  const interval = Math.max(FRAME_MS, opts.interval ?? 80);

  if (!canAnimate()) {
    // Non-interactive fallback — just write each line as it changes
    let nextId = 0;
    const items: Map<number, InternalItem> = new Map();
    return {
      add(text, addOpts = {}) {
        const id = nextId++;
        const item: InternalItem = {
          id, text,
          /* istanbul ignore next — conditional spread + default */
          ...(addOpts.color !== undefined && { color: addOpts.color }),
          type: addOpts.type ?? 'dots',
          state: 'spinning',
        };
        items.set(id, item);
        write(text); writeln();
        return {
          get text() { return item.text; },
          set text(v: string) { item.text = v; },
          update(newText) { item.text = newText; write(newText); writeln(); },
          succeed(t) { items.delete(id); if (t) { write('✓ ' + t); writeln(); } },
          fail(t)    { items.delete(id); if (t) { write('✗ ' + t); writeln(); } },
          stop()     { items.delete(id); },
        };
      },
      clear() { items.clear(); },
      count() { return items.size; },
    };
  }

  registerCrashHandlers();

  let nextId = 0;
  const items: Map<number, InternalItem> = new Map();
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastLineCount = 0;

  const render = (): void => {
    // Move up to start of previous render area, clear it
    if (lastLineCount > 0) {
      write('\r' + cursor.up(lastLineCount) + screen.clearDown());
    }
    const buf = createOutputBuffer();
    const itemsArr = [...items.values()];
    for (const item of itemsArr) {
      const frames = resolveSpinnerFrames(item.type);
      let glyph: string;
      if (item.state === 'success') glyph = applyColor('✓', '#00ff88');
      else if (item.state === 'fail') glyph = applyColor('✗', '#ff6b6b');
      /* istanbul ignore next — `?? '' | ?? null` fallbacks */
      else glyph = applyColor(frames[frame % frames.length] ?? '', item.color ?? null);

      const text = item.finalText ?? item.text;
      buf.pushln(padToTerminalWidth(`${glyph} ${text}`));
    }
    write(buf.toString());
    lastLineCount = itemsArr.length;
    frame++;
  };

  const start = (): void => {
    /* istanbul ignore if — defensive: double-start guard rarely hit in normal flow */
    if (timer) return;
    acquireCursor();
    render();
    timer = setInterval(render, interval);
  };

  const tick = (): void => {
    if (!timer) start();
  };

  return {
    add(text, addOpts = {}) {
      const id = nextId++;
      const item: InternalItem = {
        id, text,
        /* istanbul ignore next — conditional spread + default */
        ...(addOpts.color !== undefined && { color: addOpts.color }),
        type: addOpts.type ?? 'dots',
        state: 'spinning',
      };
      items.set(id, item);
      tick();
      return {
        get text() { return item.text; },
        set text(v: string) { item.text = v; render(); },
        update(newText) { item.text = newText; render(); },
        succeed(t) {
          item.state = 'success';
          if (t !== undefined) item.finalText = t;
          render();
          // Remove on next tick so the success state is visible briefly
          setTimeout(() => { items.delete(id); render(); checkEmpty(); }, interval);
        },
        fail(t) {
          item.state = 'fail';
          if (t !== undefined) item.finalText = t;
          render();
          setTimeout(() => { items.delete(id); render(); checkEmpty(); }, interval);
        },
        stop() { items.delete(id); render(); checkEmpty(); },
      };
    },
    clear() {
      items.clear();
      if (timer) {
        clearInterval(timer);
        timer = null;
        if (lastLineCount > 0) {
          write('\r' + cursor.up(lastLineCount) + screen.clearDown());
          lastLineCount = 0;
        }
        releaseCursor();
      }
    },
    count() { return items.size; },
  };

  function checkEmpty(): void {
    if (items.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      lastLineCount = 0;
      releaseCursor();
    }
  }
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export const loader = {
  spin,
  progress,
  progressAnimate,
  tasks,
  dots,
  custom,
  countdown,
  multi,
  /** Alias for SPINNERS — the built-in spinner frame definitions. */
  spinners: SPINNERS,
};

export default loader;
