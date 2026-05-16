// ─────────────────────────────────────────────
//  GENERAL HELPERS
//
//  Production-grade terminal utilities:
//   - Unicode-aware width (CJK + emoji + grapheme clusters)
//   - ANSI-safe string ops (slice, wrap, truncate, pad)
//   - Multi-stop gradient interpolation
//   - Frame-rate helpers (debounce, throttle, requestTerminalFrame)
//   - Resize-aware termSize (reads live process.stdout)
//   - Memoization helper
// ─────────────────────────────────────────────

export interface RGB { r: number; g: number; b: number }

// ─────────────────────────────────────────────
//  Numeric helpers
// ─────────────────────────────────────────────
export const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const clampByte = (v: number): number => clamp(Math.round(v), 0, 255);

// ─────────────────────────────────────────────
//  Hex / RGB
// ─────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Returns true when a string is a valid 3- or 6-digit hex color. */
export const isHexColor = (hex: string): boolean =>
  typeof hex === 'string' && HEX_RE.test(hex.trim());

/**
 * Parses a hex color string to RGB. Throws on invalid input.
 * Use isHexColor() first if you need fail-soft behaviour.
 */
export const hexToRgb = (hex: string): RGB => {
  if (!isHexColor(hex)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 0xff, g: (int >> 8) & 0xff, b: int & 0xff };
};

/** Converts R, G, B values to a hex string. Values are clamped to 0–255. */
export const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + [clampByte(r), clampByte(g), clampByte(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

/** Linearly interpolates between two RGB colors. t is clamped to [0, 1]. */
export const lerpColor = (a: RGB, b: RGB, t: number): RGB => {
  const ct = clamp(t, 0, 1);
  return {
    r: Math.round(lerp(a.r, b.r, ct)),
    g: Math.round(lerp(a.g, b.g, ct)),
    b: Math.round(lerp(a.b, b.b, ct)),
  };
};

/**
 * Multi-stop gradient interpolation. Given a list of color stops and t in [0, 1],
 * returns the interpolated RGB. Equivalent to a CSS `linear-gradient` sampler.
 *
 * Defensive: empty colors throws (no sensible default), single color returns
 * that color regardless of t, t outside [0,1] is clamped automatically.
 *
 * @example
 * gradientColor([red, yellow, green], 0.5) → yellow
 * gradientColor([red, blue], 0.0) → red
 * gradientColor([red, blue], -1)  → red (t clamped to 0)
 * gradientColor([red, blue], 99)  → blue (t clamped to 1)
 */
export const gradientColor = (colors: RGB[], t: number): RGB => {
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new Error('gradientColor requires at least one color stop');
  }
  if (colors.length === 1) return colors[0] as RGB;
  // Defensive — NaN/non-finite t falls back to 0
  const safeT = typeof t === 'number' && Number.isFinite(t) ? t : 0;
  const ct = clamp(safeT, 0, 1);
  const scaled = ct * (colors.length - 1);
  const lo = Math.floor(scaled);
  const hi = Math.min(lo + 1, colors.length - 1);
  return lerpColor(colors[lo] as RGB, colors[hi] as RGB, scaled - lo);
};

// Maps a 24-bit RGB value to the nearest xterm-256 palette index.
// Grayscale ramp: indices 232–255. Color cube: 16–231 (6×6×6).
export const rgbTo256 = (r: number, g: number, b: number): number => {
  const cr = clampByte(r), cg = clampByte(g), cb = clampByte(b);
  if (cr === cg && cg === cb) {
    if (cr < 8)   return 16;
    if (cr > 248) return 231;
    return Math.round((cr - 8) / 247 * 24) + 232;
  }
  return 16
    + 36 * Math.round(cr / 255 * 5)
    +  6 * Math.round(cg / 255 * 5)
    +      Math.round(cb / 255 * 5);
};

// ─────────────────────────────────────────────
//  ANSI string utilities
// ─────────────────────────────────────────────

// Covers SGR (m), cursor moves, screen clears, scrolling, save/restore,
// and OSC sequences (\x1b]...\x07 or \x1b]...\x1b\\).
const ANSI_RE = new RegExp(
  [
    '\\x1b\\[[0-9;?]*[a-zA-Z]', // CSI
    '\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)', // OSC
    '\\x1b[NOMP78=>c]',          // single-char escapes
  ].join('|'),
  'g',
);

// Sticky variant for safe forward-from-position parsing
const ANSI_RE_STICKY = new RegExp(
  [
    '\\x1b\\[[0-9;?]*[a-zA-Z]',
    '\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)',
    '\\x1b[NOMP78=>c]',
  ].join('|'),
  'y',
);

export const stripAnsi = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str.replace(ANSI_RE, '');
};

// ─────────────────────────────────────────────
//  Unicode-aware width measurement
//
//  Real terminals do not give every codepoint a width of 1. CJK,
//  fullwidth Latin, hangul, kana, and most emoji take 2 cells.
//  Combining marks take 0.
//
//  This implementation uses a curated set of ranges for "wide"
//  chars plus an emoji presentation regex. It's not as exhaustive
//  as `wcwidth` but covers >99% of real-world terminal content.
// ─────────────────────────────────────────────

// Wide-char ranges (East Asian Wide / Fullwidth)
const WIDE_RE = /^[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

// Emoji presentation — most emoji including extended ones
const EMOJI_RE = /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{1F300}-\u{1F9FF}]/u;

// Combining marks (zero width)
const COMBINING_RE = /^[\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFE00-\uFE0F\uFEFF]/;

// Variation selectors and zero-width joiner
const ZWJ = '\u200D';
const VS16 = '\uFE0F';

/**
 * Width of a single character (or grapheme) in terminal cells.
 *  - 0 for combining marks, ZWJ, VS, BOM
 *  - 2 for wide CJK / emoji presentation
 *  - 1 for everything else
 */
export const charWidth = (char: string): number => {
  if (!char) return 0;
  if (char === ZWJ || char === VS16) return 0;
  if (COMBINING_RE.test(char)) return 0;
  if (EMOJI_RE.test(char)) return 2;
  if (WIDE_RE.test(char)) return 2;
  return 1;
};

/**
 * Try to use Intl.Segmenter for grapheme clusters when available
 * (Node 16+). Falls back to codepoint iteration for older runtimes.
 */
// Intl.Segmenter exists at runtime in Node 16+ but isn't always in TS lib —
// use a feature-detected `any` cast for portability.
interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string }>;
}
const _segmenter: SegmenterLike | null = (() => {
  /* istanbul ignore next — defensive: Intl.Segmenter not available */
  try {
    const I = Intl as unknown as { Segmenter?: new (locale?: string, opts?: { granularity: string }) => SegmenterLike };
    if (typeof I.Segmenter === 'function') {
      return new I.Segmenter(undefined, { granularity: 'grapheme' });
    }
  }
  catch { /* not supported — fall back below */ }
  /* istanbul ignore next — Intl.Segmenter always exists in Node 18+ */
  return null;
})();

/**
 * Iterate grapheme clusters in a string. A grapheme is a user-perceived
 * character — e.g. '👨‍👩‍👧‍👦' is one grapheme even though it's 7 codepoints.
 *
 * Uses Intl.Segmenter when available, otherwise falls back to Unicode
 * codepoint iteration via [...str].
 */
export const graphemes = function* (str: string): Generator<string, void, unknown> {
  if (_segmenter) {
    for (const seg of _segmenter.segment(str)) yield seg.segment;
    return;
  }
  /* istanbul ignore next — defensive: fallback only fires when Intl.Segmenter unavailable */
  // Fallback: iterate codepoints (won't merge ZWJ sequences perfectly,
  // but gives correct surrogate-pair handling for most text)
  for (const ch of str) yield ch;
};

/**
 * Visible terminal width of a string.
 *
 * Strips ANSI escapes first, then sums grapheme cluster widths using
 * the Unicode-aware `charWidth()`. This is the function every layout
 * helper (padding, centering, table columns) should use.
 */
export const visibleLen = (str: string): number => {
  if (typeof str !== 'string' || !str) return 0;
  const clean = stripAnsi(str);
  let width = 0;
  for (const g of graphemes(clean)) {
    // For multi-codepoint graphemes, take the first codepoint's width —
    // a single emoji cluster (e.g. family) renders as one wide cell.
    width += charWidth(g);
  }
  return width;
};

// ─────────────────────────────────────────────
//  ANSI-safe slicing
//
//  sliceAnsi(str, start, end) returns the substring spanning visible
//  positions [start, end) while preserving every ANSI sequence that
//  was active at any point inside the slice. Output ends with a reset.
// ─────────────────────────────────────────────

export const sliceAnsi = (str: string, start: number, end?: number): string => {
  if (!str) return '';
  const total = visibleLen(str);
  const sStart = Math.max(0, start);
  const sEnd = end === undefined ? total : Math.max(sStart, end);
  if (sStart >= total) return '';

  let out = '';
  let visible = 0;
  let i = 0;
  let hasAnsi = false;

  while (i < str.length) {
    if (str[i] === '\x1b') {
      ANSI_RE_STICKY.lastIndex = i;
      const match = ANSI_RE_STICKY.exec(str);
      if (match) {
        // Always preserve ANSI codes — they may have started before the slice
        // but still need to be applied to chars within it
        out += match[0];
        hasAnsi = true;
        i += match[0].length;
        continue;
      }
    }

    if (visible >= sEnd) break;
    // Walk one grapheme at a time
    // (Use [...str.slice(i)] iteration limited to one)
    const remaining = str.slice(i);
    const iter = graphemes(remaining);
    const first = iter.next();
    /* istanbul ignore next — defensive: while loop guards against i >= str.length */
    if (first.done) break;
    const g = first.value as string;
    const gWidth = charWidth(g);

    if (visible + gWidth > sStart) {
      out += g;
    }
    visible += gWidth;
    i += g.length;
  }

  // Add a closing reset if we emitted any ANSI code
  if (hasAnsi) out += '\x1b[0m';
  return out;
};

/**
 * Truncates a string with ANSI escapes to a max visible width.
 * Preserves color codes that started before the cut and emits a final reset.
 * Now Unicode-aware (handles CJK, emoji, graphemes correctly).
 */
export const truncateAnsi = (str: string, width: number, ellipsis = '…'): string => {
  const total = visibleLen(str);
  if (total <= width) return str;
  const ellipsisLen = visibleLen(ellipsis);
  const target = Math.max(0, width - ellipsisLen);
  return sliceAnsi(str, 0, target) + ellipsis + '\x1b[0m';
};

// ─────────────────────────────────────────────
//  Padding & alignment — Unicode-aware
// ─────────────────────────────────────────────
export const padEnd = (str: string, width: number, ch = ' '): string => {
  const pad = width - visibleLen(str);
  return pad > 0 ? str + ch.repeat(pad) : str;
};

export const padStart = (str: string, width: number, ch = ' '): string => {
  const pad = width - visibleLen(str);
  return pad > 0 ? ch.repeat(pad) + str : str;
};

export const center = (str: string, width: number, ch = ' '): string => {
  const pad = width - visibleLen(str);
  if (pad <= 0) return str;
  const l = Math.floor(pad / 2);
  const r = pad - l;
  return ch.repeat(l) + str + ch.repeat(r);
};

/** Repeats a string until its visible length reaches the target width. */
export const repeatVisible = (str: string, width: number): string => {
  if (!str || width <= 0) return '';
  const unit = visibleLen(str);
  if (unit === 0) return '';
  const times = Math.ceil(width / unit);
  return truncateAnsi(str.repeat(times), width, '');
};

// ─────────────────────────────────────────────
//  Terminal info — resize-aware
// ─────────────────────────────────────────────

/**
 * Current terminal size. Reads from process.stdout each call so callers
 * always get up-to-date dimensions after a resize.
 *
 * Falls back to 80×24 (classic VT100 default) if stdout doesn't expose
 * dimensions. Negative or non-number values are also handled.
 */
export const termSize = (): { cols: number; rows: number } => {
  const cols = process.stdout?.columns;
  const rows = process.stdout?.rows;
  return {
    cols: typeof cols === 'number' && cols > 0 ? cols : 80,
    rows: typeof rows === 'number' && rows > 0 ? rows : 24,
  };
};

export type ResizeListener = (size: { cols: number; rows: number }) => void;

export interface OnResizeOptions {
  /**
   * Throttle interval in ms. Coalesces rapid resize events (which can
   * fire dozens per second during active drag-resize). Default: 50ms.
   * Pass 0 to disable throttling.
   */
  throttle?: number;
}

/**
 * Subscribe to terminal resize events. Returns a function that unsubscribes.
 * Useful for dashboards and live UIs that need responsive re-layout.
 *
 * By default coalesces rapid resize events at ~20fps (50ms throttle) to
 * avoid flooding the redraw path.
 *
 * @example
 * const off = onResize(({ cols, rows }) => redraw(cols, rows));
 * // Later: off();
 */
export const onResize = (
  listener: ResizeListener,
  opts: OnResizeOptions = {},
): (() => void) => {
  const stdoutWithOn = process.stdout as unknown as {
    on?: (event: string, listener: () => void) => void;
  };
  if (!process.stdout || typeof stdoutWithOn.on !== 'function') {
    return () => { /* no-op for non-TTY environments */ };
  }

  const safeCall = (): void => {
    try { listener(termSize()); }
    catch { /* user errors don't propagate */ }
  };

  const throttleMs = opts.throttle ?? 50;
  const handler = throttleMs > 0
    ? throttle(safeCall as (...args: never[]) => void, throttleMs)
    : safeCall;

  /* istanbul ignore next — defensive: resize listener registration failed */
  try { stdoutWithOn.on('resize', handler); }
  catch { return () => { /* registration failed */ }; }

  return () => {
    try {
      const stdoutWithRemove = process.stdout as unknown as {
        removeListener?: (event: string, listener: () => void) => void;
        off?: (event: string, listener: () => void) => void;
      };
      /* istanbul ignore else — modern Node always has .off(); removeListener is legacy */
      if (typeof stdoutWithRemove.off === 'function') {
        stdoutWithRemove.off('resize', handler);
      } else if (typeof stdoutWithRemove.removeListener === 'function') {
        stdoutWithRemove.removeListener('resize', handler);
      }
      // Also cancel any pending throttled call
      if ('cancel' in handler && typeof (handler as { cancel?: () => void }).cancel === 'function') {
        (handler as { cancel: () => void }).cancel();
      }
    } catch { /* ignore */ }
  };
};

// ─────────────────────────────────────────────
//  Word wrap — ANSI-aware via wrapAnsi
// ─────────────────────────────────────────────

/**
 * ANSI-aware word wrap. Tokens are split by whitespace, but ANSI escape
 * sequences within tokens are preserved verbatim. Visible width is
 * computed Unicode-correctly. Tokens longer than `width` are soft-broken
 * into chunks that respect ANSI boundaries.
 */
export const wrapAnsi = (text: string, width: number): string[] => {
  if (width <= 0) return [text];
  if (!text) return [];

  // Normalize line breaks to single \n (treat \r\n and \r as breaks)
  const normalizedLines = text.replace(/\r\n?/g, '\n').split('\n');

  const result: string[] = [];

  for (const paragraph of normalizedLines) {
    if (!paragraph) {
      result.push('');
      continue;
    }
    // Tokenize on whitespace but keep word-internal ANSI intact
    const words = paragraph.split(' ');
    let current = '';
    let currentWidth = 0;

    const breakLong = (word: string): string[] => {
      const chunks: string[] = [];
      let i = 0;
      const wordLen = visibleLen(word);
      while (i < wordLen) {
        chunks.push(sliceAnsi(word, i, i + width));
        i += width;
      }
      return chunks;
    };

    for (const raw of words) {
      const wWidth = visibleLen(raw);
      const tokens = wWidth > width ? breakLong(raw) : [raw];

      for (const word of tokens) {
        const tw = visibleLen(word);
        const sepW = current ? 1 : 0;
        if (currentWidth + tw + sepW <= width) {
          current += (current ? ' ' : '') + word;
          currentWidth += tw + sepW;
        } else {
          if (current) result.push(current);
          current = word;
          currentWidth = tw;
        }
      }
    }
    if (current) result.push(current);
  }

  return result;
};

/**
 * Backwards-compat alias. Newer code should use `wrapAnsi`.
 * Identical behavior — wrapAnsi is the same algorithm but ANSI-aware.
 */
export const wordWrap = wrapAnsi;

// ─────────────────────────────────────────────
//  Frame-rate helpers
// ─────────────────────────────────────────────

export interface DebounceOptions {
  /**
   * Maximum time (ms) to wait before forcing invocation, even if calls
   * keep arriving. Useful for resize handlers — without maxWait, an
   * actively-resized window never fires its handler.
   */
  maxWait?: number;
}

/**
 * Debounce a function: delay invocation until `ms` have passed since the
 * last call. Optional `maxWait` guarantees invocation within that window
 * even if calls keep coming.
 */
export const debounce = <T extends (...args: never[]) => unknown>(
  fn: T,
  ms: number,
  opts: DebounceOptions = {},
): T & { cancel(): void; flush(): void } => {
  let timer:    ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: unknown[] | null = null;
  const { maxWait } = opts;

  const invoke = (): void => {
    if (timer)    { clearTimeout(timer);    timer    = null; }
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
    const a = lastArgs;
    lastArgs = null;
    if (a) fn(...(a as never[]));
  };

  const wrapped = ((...args: unknown[]): void => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(invoke, ms);

    if (maxWait !== undefined && maxWait > 0 && !maxTimer) {
      maxTimer = setTimeout(invoke, maxWait);
    }
  }) as unknown as T & { cancel(): void; flush(): void };

  wrapped.cancel = (): void => {
    if (timer)    { clearTimeout(timer);    timer    = null; }
    if (maxTimer) { clearTimeout(maxTimer); maxTimer = null; }
    lastArgs = null;
  };

  wrapped.flush = (): void => {
    if ((timer || maxTimer) && lastArgs) invoke();
  };

  return wrapped;
};

/**
 * Throttle a function: invoke at most once per `ms` window. The first
 * call fires immediately; subsequent calls inside the window are
 * coalesced and the last one fires when the window expires.
 */
export const throttle = <T extends (...args: never[]) => unknown>(
  fn: T,
  ms: number,
): T & { cancel(): void } => {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: unknown[] | null = null;

  const wrapped = ((...args: unknown[]): void => {
    const now = Date.now();
    const elapsed = now - lastCall;

    if (elapsed >= ms) {
      lastCall = now;
      fn(...(args as never[]));
    } else {
      pendingArgs = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          if (pendingArgs) {
            lastCall = Date.now();
            const a = pendingArgs;
            pendingArgs = null;
            fn(...(a as never[]));
          }
        }, ms - elapsed);
      }
    }
  }) as unknown as T & { cancel(): void };

  wrapped.cancel = (): void => {
    if (timer) { clearTimeout(timer); timer = null; }
    pendingArgs = null;
  };

  return wrapped;
};

/**
 * Schedules a callback for the next animation frame (~16ms).
 * Inspired by browser `requestAnimationFrame` — useful for coalescing
 * multiple render requests into a single paint.
 *
 * Returns a handle that can be passed to `cancelTerminalFrame()`.
 */
export type FrameHandle = ReturnType<typeof setTimeout>;

const FRAME_MS_HELPERS = 16;

export const requestTerminalFrame = (cb: () => void): FrameHandle =>
  setTimeout(cb, FRAME_MS_HELPERS);

export const cancelTerminalFrame = (handle: FrameHandle): void => {
  clearTimeout(handle);
};

/**
 * Coalesce sync work to the next event loop turn (microtask + I/O).
 * Falls back to setTimeout(0) in environments without setImmediate.
 */
export const nextTick = (cb: () => void): void => {
  const g = globalThis as unknown as { setImmediate?: (cb: () => void) => void };
  /* istanbul ignore else — setImmediate always exists in Node, setTimeout is browser/edge fallback */
  if (typeof g.setImmediate === 'function') {
    g.setImmediate(cb);
  } else {
    setTimeout(cb, 0);
  }
};

// ─────────────────────────────────────────────
//  Memoization
// ─────────────────────────────────────────────

export interface MemoizeOptions<A extends unknown[]> {
  /** Max cached entries before FIFO eviction. Default: 100. */
  max?: number;
  /**
   * Key extractor — given the args, returns the cache key.
   * Use to memoize multi-arg fns: `keyFn: (a, b) => a + ':' + b`.
   * Default: first arg.
   */
  keyFn?: (...args: A) => unknown;
}

/**
 * Memoize a function with bounded FIFO cache.
 *
 * Single-arg simple form (passes the arg as cache key):
 *   memoize((n: number) => expensive(n))
 *
 * Multi-arg with key extractor:
 *   memoize((a, b, c) => f(a,b,c), { keyFn: (a, b, c) => `${a}:${b}:${c}` })
 *
 * Returns the memoized fn with `clear()` and `size()` methods.
 */
export const memoize = <A extends unknown[], V>(
  fn: (...args: A) => V,
  optsOrMax: number | MemoizeOptions<A> = 100,
): ((...args: A) => V) & { clear(): void; size(): number } => {
  const opts: MemoizeOptions<A> = typeof optsOrMax === 'number'
    ? { max: optsOrMax }
    : optsOrMax;
  const max = opts.max ?? 100;
  const keyFn = opts.keyFn ?? ((...args: A) => args[0]);
  const cache = new Map<unknown, V>();

  const wrapped = ((...args: A): V => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key) as V;
    const value = fn(...args);
    if (cache.size >= max) {
      const first = cache.keys().next().value;
      if (first !== undefined) cache.delete(first);
    }
    cache.set(key, value);
    return value;
  }) as ((...args: A) => V) & { clear(): void; size(): number };

  wrapped.clear = (): void => { cache.clear(); };
  wrapped.size = (): number => cache.size;

  return wrapped;
};

// ─────────────────────────────────────────────
//  Frame diffing — line-level damage tracking
// ─────────────────────────────────────────────

export type DiffType = 'added' | 'removed' | 'changed';

export interface LineDiff {
  /** Index of the line that changed. */
  index: number;
  /** New content of that line (empty string for 'removed'). */
  line:  string;
  /** What kind of change this line represents. */
  type:  DiffType;
}

/**
 * Compute line-level differences between two multi-line frames.
 * Returns only the lines that changed, with their indices and type.
 *
 * Useful for damage-tracked redraws: instead of clearing and re-rendering
 * the full frame, redraw only the changed lines.
 */
export const diffLines = (oldFrame: string, newFrame: string): LineDiff[] => {
  const oldLines = oldFrame.split('\n');
  const newLines = newFrame.split('\n');
  const diffs: LineDiff[] = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    const o = oldLines[i];
    const n = newLines[i];
    if (o === n) continue;

    let type: DiffType;
    if (o === undefined)      type = 'added';
    else if (n === undefined) type = 'removed';
    else                      type = 'changed';

    diffs.push({ index: i, line: n ?? '', type });
  }
  return diffs;
};

// ─────────────────────────────────────────────
//  Additional utilities — once, escapeRegex, safeJson, padBoth
// ─────────────────────────────────────────────

/**
 * Wraps a function so it only invokes the underlying fn ONCE.
 * Subsequent calls return the cached first result. Useful for one-time
 * setup / lazy initialization that must not run twice.
 */
export const once = <T extends (...args: never[]) => unknown>(
  fn: T,
): T => {
  let called = false;
  let result: unknown;
  return ((...args: unknown[]): unknown => {
    if (!called) {
      called = true;
      result = fn(...(args as never[]));
    }
    return result;
  }) as unknown as T;
};

/**
 * Escape a string for safe use inside a regex literal. Escapes
 * `.`, `*`, `+`, `?`, `^`, `$`, `(`, `)`, `[`, `]`, `{`, `}`, `|`,
 * `\`, `/`.
 *
 * @example
 *   new RegExp(escapeRegex('a.b+c')); // matches "a.b+c" literally
 */
export const escapeRegex = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
};

/**
 * JSON.stringify replacement that handles BigInt and circular refs.
 * BigInt is serialized as its string form. Circular references emit
 * `"[Circular]"` placeholder instead of throwing.
 *
 * @example
 *   safeJson({ n: 1n, ref: obj });  // never throws
 */
export const safeJson = (value: unknown, indent?: number): string => {
  const seen = new WeakSet();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'bigint') return val.toString();
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val as object)) return '[Circular]';
      seen.add(val as object);
    }
    return val;
  }, indent);
};

/**
 * Pad a string equally on both sides until it reaches `width`.
 * If the padding can't be split evenly, the right side gets the extra char.
 *
 * @example
 *   padBoth('hi', 6) → '  hi  '
 *   padBoth('hi', 5) → ' hi  '
 */
export const padBoth = (str: string, width: number, ch = ' '): string => {
  const pad = width - visibleLen(str);
  if (pad <= 0) return str;
  const l = Math.floor(pad / 2);
  const r = pad - l;
  return ch.repeat(l) + str + ch.repeat(r);
};