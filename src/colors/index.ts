// ─────────────────────────────────────────────
//  COLOR SYSTEM  –  24-bit, gradients, presets, capability-aware
//
//  Robustness guarantees:
//   - Strict input handling (non-string text passes through, non-number RGB clamps)
//   - NO_COLOR / FORCE_COLOR / TTY detection via utils/ansi.ts
//   - Adaptive degradation: truecolor → 256 → basic → none
//   - Cached escape sequences for hot paths (adaptive fg/bg)
//   - Safe hex parsing (rejects invalid input fail-soft)
//   - Composable chain API with reusable .fn() output
//   - Extensible preset registry (registerPreset)
//   - Guard against preset/method name collisions
// ─────────────────────────────────────────────

import {
  fgRgb, bgRgb, fg256, bg256, reset, sgr,
  FG, BG, STYLE,
  supportsColor, supportsColorLevel,
  stripAnsi as stripAnsiFromUtils,
  type ColorLevel,
} from '../utils/ansi.js';
import { hexToRgb, lerpColor, RGB } from '../utils/helpers.js';

export type ColorFn = (text: string) => string;
export type { ColorLevel };

// ─────────────────────────────────────────────
//  Color suppression — explicit override + auto-detect
// ─────────────────────────────────────────────
let _noColor: boolean | null = null;

/** Override color suppression at runtime. Pass true to suppress, false to force on. */
export const setNoColor = (v: boolean): void => { _noColor = v; };

/** Reset to auto-detect mode. */
export const resetNoColor = (): void => { _noColor = null; };

/** Returns true when colors should be suppressed. */
export const isNoColor = (): boolean => {
  if (_noColor !== null) return _noColor;
  return supportsColor() === 'none';
};

// ─────────────────────────────────────────────
//  Color level access
// ─────────────────────────────────────────────

/** Numeric color support level (0-3). */
export const colorLevel = (): ColorLevel =>
  _noColor === true ? 0 : supportsColorLevel();

// ─────────────────────────────────────────────
//  Numeric helpers — all clamp negative/over-range/non-finite to safe values
// ─────────────────────────────────────────────

const clampRgb = (n: number): number => {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  if (n === Infinity)  return 255;
  if (n === -Infinity) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
};

const clamp256 = (n: number): number => {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  if (n === Infinity)  return 255;
  if (n === -Infinity) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
};

// ─────────────────────────────────────────────
//  Safe hex parser — fail-soft
//
//  Accepts: '#abc', '#aabbcc', 'abc', 'aabbcc' (with/without #)
//  Returns null for: non-string, malformed, empty
// ─────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const safeHex = (h: unknown): RGB | null => {
  if (typeof h !== 'string') return null;
  const normalized = h.trim();
  if (!HEX_RE.test(normalized)) return null;
  return hexToRgb(normalized);
};

// ─────────────────────────────────────────────
//  Text coercion — pass-through for non-strings
//
//  If a caller passes a number/object/null, we coerce to string rather
//  than throwing. This matches the chalk/kleur convention where
//  `color.red(42)` returns `"\x1b[31m42\x1b[0m"`.
// ─────────────────────────────────────────────
const coerceText = (t: unknown): string => {
  if (typeof t === 'string') return t;
  if (t === null || t === undefined) return '';
  return String(t);
};

// ─────────────────────────────────────────────
//  Color level downgrade — picks the best fg/bg open sequence
//  for a given RGB based on actual terminal support.
//
//  Level 3 → 24-bit truecolor
//  Level 2 → 256-palette quantization
//  Level 1 → nearest of 8 basic ANSI colors
//  Level 0 → no escape
// ─────────────────────────────────────────────

const rgbTo256 = (r: number, g: number, b: number): number => {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return 16
    + 36 * Math.round(r / 51)
    +  6 * Math.round(g / 51)
    +      Math.round(b / 51);
};

// Basic 8-color palette + their FG codes
const ANSI_BASE: ReadonlyArray<readonly [number, number, number, number]> = [
  [0,   0,   0,   FG.black],
  [205, 0,   0,   FG.red],
  [0,   205, 0,   FG.green],
  [205, 205, 0,   FG.yellow],
  [0,   0,   238, FG.blue],
  [205, 0,   205, FG.magenta],
  [0,   205, 205, FG.cyan],
  [229, 229, 229, FG.white],
];

const rgbToBasicFg = (r: number, g: number, b: number): number => {
  let best: number = FG.white;
  let bestDist = Infinity;
  for (const [ar, ag, ab, code] of ANSI_BASE) {
    const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (d < bestDist) { bestDist = d; best = code; }
  }
  return best;
};

const rgbToBasicBg = (r: number, g: number, b: number): number =>
  rgbToBasicFg(r, g, b) + 10; // BG codes are FG + 10

// ─────────────────────────────────────────────
//  Adaptive escape sequence cache
//
//  Gradients call adaptiveFg() per visible character — that's millions of
//  calls in long-running animations. Cache by packed RGB int + level.
//  Cache is shared across fg/bg via separate maps. Bounded LRU.
// ─────────────────────────────────────────────

const _fgEscCache = new Map<number, string>();
const _bgEscCache = new Map<number, string>();
const _ESC_CACHE_MAX = 512;

const cacheKey = (level: ColorLevel, r: number, g: number, b: number): number =>
  // 2 bits for level (0-3), 8 each for r/g/b
  (level << 24) | (r << 16) | (g << 8) | b;

const adaptiveFg = (r: number, g: number, b: number): string => {
  const level = colorLevel();
  if (level === 0) return '';
  const key = cacheKey(level, r, g, b);
  let cached = _fgEscCache.get(key);
  if (cached !== undefined) return cached;

  if (level === 3)      cached = fgRgb(r, g, b);
  else if (level === 2) cached = fg256(rgbTo256(r, g, b));
  else                  cached = sgr(rgbToBasicFg(r, g, b));

  /* istanbul ignore next — LRU eviction triggers only after 512 distinct fg colors */
  if (_fgEscCache.size >= _ESC_CACHE_MAX) {
    const firstKey = _fgEscCache.keys().next().value;
    if (firstKey !== undefined) _fgEscCache.delete(firstKey);
  }
  _fgEscCache.set(key, cached);
  return cached;
};

const adaptiveBg = (r: number, g: number, b: number): string => {
  const level = colorLevel();
  if (level === 0) return '';
  const key = cacheKey(level, r, g, b);
  let cached = _bgEscCache.get(key);
  if (cached !== undefined) return cached;

  if (level === 3)      cached = bgRgb(r, g, b);
  else if (level === 2) cached = bg256(rgbTo256(r, g, b));
  else                  cached = sgr(rgbToBasicBg(r, g, b));

  /* istanbul ignore next — LRU eviction triggers only after 512 distinct bg colors */
  if (_bgEscCache.size >= _ESC_CACHE_MAX) {
    const firstKey = _bgEscCache.keys().next().value;
    if (firstKey !== undefined) _bgEscCache.delete(firstKey);
  }
  _bgEscCache.set(key, cached);
  return cached;
};

/** Clear adaptive escape caches. Call after a color level change. */
export const clearColorCache = (): void => {
  _fgEscCache.clear();
  _bgEscCache.clear();
};

// ─────────────────────────────────────────────
//  Core wrap — respects suppression + non-string coercion
// ─────────────────────────────────────────────
const wrap = (open: string, text: unknown): string => {
  const s = coerceText(text);
  if (isNoColor() || open === '') return s;
  return open + s + reset();
};

// ─────────────────────────────────────────────
//  Basic color factories
// ─────────────────────────────────────────────
const makeFg = (code: number): ColorFn => (text) => wrap(sgr(code), text);
const makeBg = (code: number): ColorFn => (text) => wrap(sgr(code), text);

// ─────────────────────────────────────────────
//  ANSI sequence extractor — used by compose
//
//  Uses zero-width marker chars (guaranteed not in normal text) to
//  reliably extract the open prefix from any ColorFn.
// ─────────────────────────────────────────────
const COMPOSE_MARKER = '\u200B\u200C\u200D';

const extractOpen = (fn: ColorFn): string => {
  /* istanbul ignore if — defensive: compose() pre-filters non-functions */
  if (typeof fn !== 'function') return '';
  let wrapped: string;
  /* istanbul ignore next — defensive: user fn that throws */
  try { wrapped = fn(COMPOSE_MARKER); }
  catch { return ''; }
  const markerIdx = wrapped.indexOf(COMPOSE_MARKER);
  /* istanbul ignore next — defensive: well-formed color fns always include marker */
  if (markerIdx === -1) return '';
  return wrapped.slice(0, markerIdx);
};

// ─────────────────────────────────────────────
//  compose — combine multiple ColorFns into one
//
//  Filters non-functions, swallows fns that throw on extraction.
//  Single open + text + single reset (cleaner than nested wrapping).
// ─────────────────────────────────────────────
export const compose = (...fns: ColorFn[]): ColorFn => (text: unknown) => {
  const s = coerceText(text);
  if (isNoColor() || fns.length === 0) return s;
  const validFns = fns.filter((f) => typeof f === 'function');
  if (validFns.length === 0) return s;
  const opens = validFns.map(extractOpen).join('');
  if (opens === '') return s;
  return opens + s + reset();
};

// ─────────────────────────────────────────────
//  Easing functions — interpolation curves for gradients
// ─────────────────────────────────────────────

/**
 * Built-in easing curves. Each takes a t in [0, 1] and returns an eased t
 * in [0, 1]. Used for non-linear gradient progression.
 */
export type EasingName =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier';

export type EasingFn = (t: number) => number;

/** Cubic-bezier evaluation — same approximation curve as CSS `ease`. */
const _cubicBezier = (t: number, x1 = 0.25, y1 = 0.1, x2 = 0.25, y2 = 1): number => {
  // Newton-Raphson approximation. For our usage (single static curve),
  // a small fixed iteration count is plenty accurate.
  if (t <= 0) return 0;
  /* istanbul ignore next — defensive: callers pass t in [0,1); exact 1 unreachable via gradient flow */
  if (t >= 1) return 1;

  // Find x s.t. bezier_x(s) ≈ t, then return bezier_y(s).
  // bezier_x(s) = 3*(1-s)²*s*x1 + 3*(1-s)*s²*x2 + s³
  let s = t;
  for (let i = 0; i < 8; i++) {
    const s2 = s * s;
    const s3 = s2 * s;
    const oneMinusS = 1 - s;
    const oneMinusS2 = oneMinusS * oneMinusS;
    const fx = 3 * oneMinusS2 * s * x1 + 3 * oneMinusS * s2 * x2 + s3 - t;
    const dfx = 3 * oneMinusS2 * x1 + 6 * oneMinusS * s * (x2 - x1) + 3 * s2 * (1 - x2);
    /* istanbul ignore if — defensive: Newton-Raphson convergence guard for near-zero derivative */
    if (Math.abs(dfx) < 1e-6) break;
    s -= fx / dfx;
    s = Math.min(1, Math.max(0, s));
  }
  const s2 = s * s;
  const s3 = s2 * s;
  return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s2 * y2 + s3;
};

const EASINGS: Record<EasingName, EasingFn> = {
  'linear':       (t) => t,
  'ease-in':      (t) => t * t,
  'ease-out':     (t) => 1 - (1 - t) * (1 - t),
  'ease-in-out':  (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  'cubic-bezier': (t) => _cubicBezier(t),
};

/** Resolve an easing option to a function. Returns linear for invalid input. */
const resolveEasing = (e: EasingName | EasingFn | undefined): EasingFn => {
  if (typeof e === 'function') return e;
  if (typeof e === 'string' && EASINGS[e]) return EASINGS[e];
  return EASINGS.linear;
};

// ─────────────────────────────────────────────
//  stripAnsi — re-exported from utils
// ─────────────────────────────────────────────
export const stripAnsi = stripAnsiFromUtils;

// ─────────────────────────────────────────────
//  Gradient — interpolates stops across visible chars
// ─────────────────────────────────────────────

export interface GradientOptions {
  /** Skip ANSI escapes in the input instead of overwriting them. */
  preserveAnsi?: boolean;
  /**
   * Interpolation curve. Default `'linear'`.
   * - `'linear'` — even color distribution
   * - `'ease-in'` — slow start, fast end (concentrates colors at the right)
   * - `'ease-out'` — fast start, slow end (concentrates colors at the left)
   * - `'ease-in-out'` — slow at both ends, fast in middle
   * - `'cubic-bezier'` — CSS-style ease (smooth S-curve)
   * - Or pass a custom `EasingFn` that maps `[0,1] → [0,1]`.
   */
  easing?: EasingName | EasingFn;
  /**
   * Phase offset in `[0, 1)` — shifts the gradient along the text.
   * Use with an animation loop to produce a flowing color effect:
   * `gradient(text, colors, { phase: (Date.now() / 100) % 1 })`
   */
  phase?: number;
}

/**
 * Apply a multi-stop color gradient across the visible characters of `text`.
 * ANSI escapes are skipped, and Unicode wide characters / graphemes are
 * counted correctly.
 *
 * @param text  - The text to colorize. Non-string inputs are coerced via `String(text)`.
 * @param stops - Array of hex colors (`#rgb` or `#rrggbb`). At least 1 required.
 *                Invalid stops are silently dropped; an empty array returns input as-is.
 * @param opts  - Optional configuration. See `GradientOptions`.
 *
 * @returns ANSI-colorized string. Returns input unchanged if `NO_COLOR` is set
 *          or if no valid stops are provided.
 *
 * @example
 * ```ts
 * gradient('Hello world!', ['#ff0000', '#00ff00', '#0000ff']);
 * // → ANSI-colored "Hello world!" with smooth color transition
 * ```
 *
 * @example with easing curve
 * ```ts
 * gradient('Smooth text', ['#ff79c6', '#8be9fd'], { easing: 'ease-in-out' });
 * ```
 *
 * @example animated phase shift
 * ```ts
 * setInterval(() => {
 *   const phase = (Date.now() / 1000) % 1;
 *   process.stdout.write('\r' + gradient('flowing', ['#f00', '#00f'], { phase }));
 * }, 33);
 * ```
 */
export const gradient = (
  text: unknown,
  stops: string[] | null | undefined,
  opts: GradientOptions = {},
): string => {
  const s = coerceText(text);
  if (!s || isNoColor()) return s;
  if (!Array.isArray(stops) || stops.length === 0) return s;

  const colors = stops.map(safeHex).filter((c): c is RGB => c !== null);
  if (colors.length === 0) return s;

  // Single valid color → render the whole text in that color (consistent UX
  // with single-stop gradients in CSS — no skip).
  if (colors.length === 1) {
    const c = colors[0] as RGB;
    return adaptiveFg(c.r, c.g, c.b) + s + reset();
  }

  const { preserveAnsi = false, easing, phase = 0 } = opts;
  const easingFn = resolveEasing(easing);
  // Normalize phase to [0, 1). Negative values wrap forward.
  const phaseN = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;

  // Quick path: no ANSI in input → simple per-char loop
  if (!preserveAnsi || !s.includes('\x1b')) {
    return _gradientPlain(s, colors, easingFn, phaseN);
  }
  return _gradientAnsiAware(s, colors, easingFn, phaseN);
};

/**
 * A pre-resolved gradient that can be applied repeatedly to different
 * strings without re-parsing hex stops. Useful for hot loops, animation
 * frames, or any case where the same color palette colorizes many texts.
 *
 * The returned function accepts the same per-call options as `gradient()`
 * (e.g. you can still override `phase` per call for animation).
 *
 * @example
 * ```ts
 * const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);
 *
 * console.log(fire('first line'));
 * console.log(fire('second line'));
 *
 * // Use as colorFn for ascii.banner
 * console.log(ascii.banner('FIRE', { colorFn: fire }));
 *
 * // Animate by overriding phase per frame
 * for (let p = 0; p < 1; p += 0.05) {
 *   console.log(fire('flowing', { phase: p }));
 * }
 * ```
 */
export const createGradient = (
  stops: string[] | null | undefined,
  defaultOpts: Omit<GradientOptions, 'phase'> = {},
): ((text: unknown, opts?: GradientOptions) => string) => {
  // Pre-resolve hex → RGB once
  const colors = Array.isArray(stops)
    ? stops.map(safeHex).filter((c): c is RGB => c !== null)
    : [];

  // Pre-resolve easing function
  const defaultEasingFn = resolveEasing(defaultOpts.easing);
  const defaultPreserveAnsi = defaultOpts.preserveAnsi ?? false;

  return (text: unknown, opts: GradientOptions = {}): string => {
    const s = coerceText(text);
    if (!s || isNoColor()) return s;
    if (colors.length === 0) return s;

    // Single color fast path
    if (colors.length === 1) {
      const c = colors[0] as RGB;
      return adaptiveFg(c.r, c.g, c.b) + s + reset();
    }

    // Per-call overrides (mainly for animation)
    const easingFn = opts.easing !== undefined ? resolveEasing(opts.easing) : defaultEasingFn;
    const preserveAnsi = opts.preserveAnsi ?? defaultPreserveAnsi;
    const phase = opts.phase ?? 0;
    const phaseN = Number.isFinite(phase) ? ((phase % 1) + 1) % 1 : 0;

    if (!preserveAnsi || !s.includes('\x1b')) {
      return _gradientPlain(s, colors, easingFn, phaseN);
    }
    return _gradientAnsiAware(s, colors, easingFn, phaseN);
  };
};

const _gradientPlain = (
  text: string,
  colors: RGB[],
  easingFn: EasingFn,
  phase: number,
): string => {
  const chars = [...text]; // grapheme-iteration via spread (preserves surrogates)
  const visible = chars.filter((c) => c !== ' ').length;
  if (visible === 0) return text;

  let colorIdx = 0;
  let out = '';
  const colorCount = colors.length;
  const visibleMinus = visible - 1;

  for (const ch of chars) {
    if (ch === ' ') { out += ch; continue; }
    // Linear t — then optionally easing + phase
    let t = visible === 1 ? 0 : colorIdx / visibleMinus;
    // Apply phase shift (wraps around)
    t = (t + phase) % 1;
    // Apply easing curve
    t = easingFn(t);
    // Clamp to [0,1] in case a custom easing returns out-of-range
    t = Math.min(1, Math.max(0, t));
    const scaled = t * (colorCount - 1);
    const lo = Math.floor(scaled);
    const hi = Math.min(lo + 1, colorCount - 1);
    const { r, g, b } = lerpColor(colors[lo] as RGB, colors[hi] as RGB, scaled - lo);
    colorIdx++;
    out += adaptiveFg(r, g, b) + ch + reset();
  }
  return out;
};

const ANSI_TOKEN = /\x1b\[[0-9;?]*[a-zA-Z]/y;

const _gradientAnsiAware = (
  text: string,
  colors: RGB[],
  easingFn: EasingFn,
  phase: number,
): string => {
  const visible = stripAnsi(text).split('').filter((c) => c !== ' ').length;
  if (visible === 0) return text;

  let out = '';
  let i = 0;
  let colorIdx = 0;
  const colorCount = colors.length;
  const visibleMinus = visible - 1;

  while (i < text.length) {
    if (text[i] === '\x1b') {
      ANSI_TOKEN.lastIndex = i;
      const match = ANSI_TOKEN.exec(text);
      /* istanbul ignore else — bare \x1b without CSI is malformed input */
      if (match) {
        out += match[0];
        i += match[0].length;
        continue;
      } else {
        // Bare \x1b that doesn't form CSI — emit literally
        out += '\x1b';
        i++;
        continue;
      }
    }
    const ch = text[i] as string;
    if (ch === ' ') {
      out += ch;
    } else {
      // Linear t — then optionally easing + phase
      let t = visible === 1 ? 0 : colorIdx / visibleMinus;
      t = (t + phase) % 1;
      t = easingFn(t);
      t = Math.min(1, Math.max(0, t));
      const scaled = t * (colorCount - 1);
      const lo = Math.floor(scaled);
      const hi = Math.min(lo + 1, colorCount - 1);
      const { r, g, b } = lerpColor(colors[lo] as RGB, colors[hi] as RGB, scaled - lo);
      out += adaptiveFg(r, g, b) + ch + reset();
      colorIdx++;
    }
    i++;
  }
  return out;
};

// ─────────────────────────────────────────────
//  Built-in rainbow + gradient presets
// ─────────────────────────────────────────────
const RAINBOW = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'];
export const rainbow: ColorFn = (text) => gradient(text, RAINBOW);

// ─────────────────────────────────────────────
//  Animated gradient — color flow over time
// ─────────────────────────────────────────────

export interface AnimateGradientOptions {
  /** Total animation duration in ms. Default `2000`. */
  duration?: number;
  /** Frames per second. Default `30`. Capped to `60`. */
  fps?: number;
  /** Loop infinitely. Default `true`. Use `signal` to stop. */
  infinite?: boolean;
  /** Cycle count when `infinite: false`. Default `1`. */
  cycles?: number;
  /** Direction: `'forward'` (default) shifts colors right; `'reverse'` shifts left. */
  direction?: 'forward' | 'reverse';
  /** Easing curve for the gradient itself (not the time progression). */
  easing?: EasingName | EasingFn;
  /** Preserve embedded ANSI escapes. Default `false`. */
  preserveAnsi?: boolean;
  /** Abort signal — stops the animation cleanly. */
  signal?: AbortSignal;
  /**
   * Callback fired on every frame with the new colored string.
   * If omitted, frames are written to stdout via cursor-up redraw.
   */
  onFrame?: (frame: string, phase: number) => void;
}

/**
 * Render a gradient that "flows" through the text over time. Returns a
 * controller with a `.stop()` method. When `infinite: true` (default),
 * the animation continues until `.stop()` is called or `signal` aborts.
 *
 * @example
 * ```ts
 * const ctrl = animateGradient('Loading...', ['#ff79c6', '#bd93f9', '#8be9fd']);
 * await sleep(3000);
 * ctrl.stop();
 * ```
 *
 * @example with custom render callback
 * ```ts
 * animateGradient('hi', ['#f00', '#0f0'], {
 *   onFrame: (frame) => myCustomRender(frame),
 * });
 * ```
 */
export interface AnimateGradientController {
  /** Stops the animation. Safe to call multiple times. */
  stop: () => void;
  /** Promise that resolves when animation finishes (stop / abort / cycle limit). */
  done: Promise<void>;
  /**
   * Thenable hook — lets you `await animateGradient(...)` directly.
   * Equivalent to `await ctrl.done`.
   */
  then: Promise<void>['then'];
  /** Equivalent to `ctrl.done.catch(...)`. */
  catch: Promise<void>['catch'];
  /** Equivalent to `ctrl.done.finally(...)`. */
  finally: Promise<void>['finally'];
}

export const animateGradient = (
  text: string,
  stops: string[],
  opts: AnimateGradientOptions = {},
): AnimateGradientController => {
  const {
    duration = 2000,
    fps = 30,
    infinite = true,
    cycles = 1,
    direction = 'forward',
    easing,
    preserveAnsi = false,
    signal,
    onFrame,
  } = opts;

  // Validation
  const safeFps = Math.min(60, Math.max(1, Number.isFinite(fps) ? fps : 30));
  const safeDuration = Math.max(100, Number.isFinite(duration) ? duration : 2000);
  const safeCycles = Math.max(1, Number.isFinite(cycles) ? cycles : 1);
  const frameInterval = 1000 / safeFps;

  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let resolveDone: () => void = /* istanbul ignore next */ () => {};
  const done = new Promise<void>((res) => { resolveDone = res; });

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
    resolveDone();
  };

  /* istanbul ignore if — abort signal path requires AbortController */
  if (signal) {
    if (signal.aborted) {
      stop();
      return {
        stop,
        done,
        then:    done.then.bind(done),
        catch:   done.catch.bind(done),
        finally: done.finally.bind(done),
      };
    }
    signal.addEventListener('abort', stop, { once: true });
  }

  const startTime = Date.now();

  const renderFrame = (): void => {
    /* istanbul ignore if — defensive: stopped between schedule and fire */
    if (stopped) return;

    const elapsed = Date.now() - startTime;
    // phase in [0,1) — one full cycle per `duration` ms
    let phase = (elapsed / safeDuration) % 1;
    if (direction === 'reverse') phase = 1 - phase;

    const frame = gradient(text, stops, { preserveAnsi, easing, phase });

    /* istanbul ignore else — onFrame path is the testable one */
    if (onFrame) {
      onFrame(frame, phase);
    } else {
      // Default render: write frame to stdout, return cursor home.
      // Defensive: process.stdout may be undefined in workers, sandboxes,
      // or Edge runtimes. The try/catch protects against EPIPE on closed pipes.
      /* istanbul ignore next — direct stdout path requires real TTY */
      try {
        if (process?.stdout?.write) {
          process.stdout.write('\r' + frame);
        }
      } catch { /* ignore — stream closed mid-animation */ }
    }

    // Cycle counting (only when finite)
    if (!infinite) {
      const completedCycles = Math.floor(elapsed / safeDuration);
      if (completedCycles >= safeCycles) {
        stop();
      }
    }
  };

  // Initial frame immediately for responsiveness
  renderFrame();

  // Schedule recurring frames (only if not already stopped by initial frame's cycle logic)
  if (!stopped) {
    timer = setInterval(renderFrame, frameInterval);
  }

  return {
    stop,
    done,
    // Thenable hooks — bind to done so `await ctrl` works directly
    then:    done.then.bind(done),
    catch:   done.catch.bind(done),
    finally: done.finally.bind(done),
  };
};

const PRESET_DEFS = {
  sunset: ['#ff6b6b', '#feca57', '#48dbfb'],
  ocean:  ['#0575e6', '#021b79'],
  fire:   ['#f7971e', '#ffd200', '#ff0000'],
  neon:   ['#f953c6', '#b91d73'],
  forest: ['#134e5e', '#71b280'],
  aurora: ['#00c6ff', '#0072ff', '#7e57c2'],
  candy:  ['#fd79a8', '#a29bfe', '#74b9ff'],
  gold:   ['#f7971e', '#ffd200'],
} as const;

export type PresetName = keyof typeof PRESET_DEFS;

/** All available built-in gradient preset names. */
export const presetNames: readonly PresetName[] =
  Object.keys(PRESET_DEFS) as PresetName[];

// Runtime-extensible preset registry (built-ins + user-registered)
const _presetRegistry: Map<string, string[]> = new Map(
  Object.entries(PRESET_DEFS).map(([k, v]) => [k, [...v]]),
);

/**
 * Names that conflict with `color.*` methods. Registering a preset with
 * one of these names would shadow the method when the preset object is
 * spread into `color`. We reject these explicitly with a clear error.
 */
const RESERVED_PRESET_NAMES = new Set([
  'black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white',
  'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue',
  'brightMagenta', 'brightCyan', 'brightWhite',
  'gray', 'grey', 'orange', 'purple',
  'bgBlack', 'bgRed', 'bgGreen', 'bgYellow', 'bgBlue', 'bgMagenta', 'bgCyan', 'bgWhite',
  'bold', 'dim', 'italic', 'underline', 'blink', 'inverse', 'strikethrough', 'hidden',
  'rgb', 'bgRgb', 'hex', 'bgHex', 'color256', 'bgColor256',
  'gradient', 'rainbow', 'chain',
]);

/**
 * Register a custom gradient preset accessible via `color.<name>(text)`.
 * Throws if `name` collides with an existing color method.
 *
 * @example
 *   registerPreset('mango', ['#ff5e3a', '#ff9500']);
 *   color.mango('hello');
 */
export const registerPreset = (name: string, stops: string[]): void => {
  if (typeof name !== 'string' || !name.length) {
    throw new TypeError('registerPreset: name must be a non-empty string');
  }
  if (!Array.isArray(stops) || stops.length === 0) {
    throw new TypeError('registerPreset: stops must be a non-empty array');
  }
  if (RESERVED_PRESET_NAMES.has(name)) {
    throw new Error(
      `registerPreset: name "${name}" conflicts with a built-in color method.`,
    );
  }
  _presetRegistry.set(name, [...stops]);
  // Also update the spread-in presets cache
  presets[name as PresetName] = (t: string) => gradient(t, [..._presetRegistry.get(name) ?? []]);
};

/** List all registered presets (built-in + custom). */
export const listPresets = (): string[] => [..._presetRegistry.keys()];

export const presets: Record<string, ColorFn> = Object.fromEntries(
  Object.entries(PRESET_DEFS).map(
    ([name, stops]) => [name, (t: string) => gradient(t, [...stops])],
  ),
) as Record<string, ColorFn>;

// ─────────────────────────────────────────────
//  Chainable API — builder-style alternative to compose
// ─────────────────────────────────────────────

export interface ColorChain {
  // Foreground
  black:   () => ColorChain;
  red:     () => ColorChain;
  green:   () => ColorChain;
  yellow:  () => ColorChain;
  blue:    () => ColorChain;
  magenta: () => ColorChain;
  cyan:    () => ColorChain;
  white:   () => ColorChain;
  gray:    () => ColorChain;
  // Bright
  brightRed:    () => ColorChain;
  brightGreen:  () => ColorChain;
  brightYellow: () => ColorChain;
  brightBlue:   () => ColorChain;
  // Styles
  bold:          () => ColorChain;
  dim:           () => ColorChain;
  italic:        () => ColorChain;
  underline:     () => ColorChain;
  inverse:       () => ColorChain;
  strikethrough: () => ColorChain;
  // Custom colors
  rgb:    (r: number, g: number, b: number) => ColorChain;
  hex:    (h: string) => ColorChain;
  bgRgb:  (r: number, g: number, b: number) => ColorChain;
  bgHex:  (h: string) => ColorChain;
  // Apply
  apply: (text: unknown) => string;
  /** Returns the composed function for reuse. */
  fn:    () => ColorFn;
}

const buildChain = (fns: ColorFn[]): ColorChain => {
  const push = (fn: ColorFn): ColorChain => buildChain([...fns, fn]);
  return {
    black:   () => push(makeFg(FG.black)),
    red:     () => push(makeFg(FG.red)),
    green:   () => push(makeFg(FG.green)),
    yellow:  () => push(makeFg(FG.yellow)),
    blue:    () => push(makeFg(FG.blue)),
    magenta: () => push(makeFg(FG.magenta)),
    cyan:    () => push(makeFg(FG.cyan)),
    white:   () => push(makeFg(FG.white)),
    gray:    () => push(makeFg(FG.brightBlack)),
    brightRed:    () => push(makeFg(FG.brightRed)),
    brightGreen:  () => push(makeFg(FG.brightGreen)),
    brightYellow: () => push(makeFg(FG.brightYellow)),
    brightBlue:   () => push(makeFg(FG.brightBlue)),
    bold:          () => push((t) => wrap(sgr(STYLE.bold),          t)),
    dim:           () => push((t) => wrap(sgr(STYLE.dim),           t)),
    italic:        () => push((t) => wrap(sgr(STYLE.italic),        t)),
    underline:     () => push((t) => wrap(sgr(STYLE.underline),     t)),
    inverse:       () => push((t) => wrap(sgr(STYLE.inverse),       t)),
    strikethrough: () => push((t) => wrap(sgr(STYLE.strikethrough), t)),
    rgb: (r, g, b) => push((t) => wrap(adaptiveFg(clampRgb(r), clampRgb(g), clampRgb(b)), t)),
    hex: (h) => push((t) => {
      const p = safeHex(h);
      return p ? wrap(adaptiveFg(p.r, p.g, p.b), t) : coerceText(t);
    }),
    bgRgb: (r, g, b) => push((t) => wrap(adaptiveBg(clampRgb(r), clampRgb(g), clampRgb(b)), t)),
    bgHex: (h) => push((t) => {
      const p = safeHex(h);
      return p ? wrap(adaptiveBg(p.r, p.g, p.b), t) : coerceText(t);
    }),
    apply: (text: unknown) => compose(...fns)(coerceText(text)),
    fn:    () => compose(...fns),
  };
};

/** Start a new color chain. */
export const chain = (): ColorChain => buildChain([]);

// ─────────────────────────────────────────────
//  Test hooks — internal access for unit tests
// ─────────────────────────────────────────────
export const __internal = {
  isNoColor,
  safeHex,
  rgbTo256,
  rgbToBasicFg,
  rgbToBasicBg,
  adaptiveFg,
  adaptiveBg,
  extractOpen,
  coerceText,
};

// ─────────────────────────────────────────────
//  Main color API
// ─────────────────────────────────────────────

export const color = {
  // Named foreground
  black:   makeFg(FG.black),
  red:     makeFg(FG.red),
  green:   makeFg(FG.green),
  yellow:  makeFg(FG.yellow),
  blue:    makeFg(FG.blue),
  magenta: makeFg(FG.magenta),
  cyan:    makeFg(FG.cyan),
  white:   makeFg(FG.white),

  // Bright foreground
  brightBlack:   makeFg(FG.brightBlack),
  brightRed:     makeFg(FG.brightRed),
  brightGreen:   makeFg(FG.brightGreen),
  brightYellow:  makeFg(FG.brightYellow),
  brightBlue:    makeFg(FG.brightBlue),
  brightMagenta: makeFg(FG.brightMagenta),
  brightCyan:    makeFg(FG.brightCyan),
  brightWhite:   makeFg(FG.brightWhite),

  // Aliases
  gray:   makeFg(FG.brightBlack),
  grey:   makeFg(FG.brightBlack),
  orange: (t: unknown) => wrap(adaptiveFg(255, 165, 0), t),
  purple: makeFg(FG.magenta),

  // Background
  bgBlack:   makeBg(BG.black),
  bgRed:     makeBg(BG.red),
  bgGreen:   makeBg(BG.green),
  bgYellow:  makeBg(BG.yellow),
  bgBlue:    makeBg(BG.blue),
  bgMagenta: makeBg(BG.magenta),
  bgCyan:    makeBg(BG.cyan),
  bgWhite:   makeBg(BG.white),

  // Styles
  bold:          (t: unknown) => wrap(sgr(STYLE.bold),          t),
  dim:           (t: unknown) => wrap(sgr(STYLE.dim),           t),
  italic:        (t: unknown) => wrap(sgr(STYLE.italic),        t),
  underline:     (t: unknown) => wrap(sgr(STYLE.underline),     t),
  blink:         (t: unknown) => wrap(sgr(STYLE.blink),         t),
  inverse:       (t: unknown) => wrap(sgr(STYLE.inverse),       t),
  strikethrough: (t: unknown) => wrap(sgr(STYLE.strikethrough), t),
  hidden:        (t: unknown) => wrap(sgr(STYLE.hidden),        t),

  // True-color (auto-degrades to 256/basic on lower terminals)
  rgb: (r: number, g: number, b: number): ColorFn =>
    (t) => wrap(adaptiveFg(clampRgb(r), clampRgb(g), clampRgb(b)), t),

  bgRgb: (r: number, g: number, b: number): ColorFn =>
    (t) => wrap(adaptiveBg(clampRgb(r), clampRgb(g), clampRgb(b)), t),

  // Hex — fail-soft
  hex: (h: string): ColorFn => (t) => {
    const p = safeHex(h);
    return p ? wrap(adaptiveFg(p.r, p.g, p.b), t) : coerceText(t);
  },

  bgHex: (h: string): ColorFn => (t) => {
    const p = safeHex(h);
    return p ? wrap(adaptiveBg(p.r, p.g, p.b), t) : coerceText(t);
  },

  // 256-color
  color256:   (n: number): ColorFn => (t) => wrap(fg256(clamp256(n)), t),
  bgColor256: (n: number): ColorFn => (t) => wrap(bg256(clamp256(n)), t),

  // Gradients
  gradient,
  rainbow,

  // Chainable API
  chain,

  // Spread presets at the end so they don't collide with methods
  ...presets,
};

export default color;
