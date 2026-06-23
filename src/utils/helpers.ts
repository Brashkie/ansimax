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
//  v1.3.5 — Numeric helpers (advanced)
// ─────────────────────────────────────────────

/**
 * Type guard: true when `n` is a finite number (rejects NaN, ±Infinity,
 * non-numbers). Useful for input validation.
 *
 * @since 1.3.5
 */
export const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/**
 * Coerce any value to a safe integer. Handles non-numbers, NaN, Infinity,
 * and floats. Consolidates the `Math.max(0, Math.floor(Number(x) || 0))`
 * pattern that appears across the codebase.
 *
 * @param value    - Any value (will be coerced via `Number()`).
 * @param fallback - Returned when `value` is non-finite. Default `0`.
 * @param min      - Lower bound (inclusive). Default `-Infinity`.
 * @param max      - Upper bound (inclusive). Default `Infinity`.
 *
 * @example
 * ```ts
 * safeInt('abc')                  // → 0
 * safeInt(3.7)                    // → 3
 * safeInt(-5, 0, 0, 100)          // → 0  (clamped to min)
 * safeInt(NaN, 50)                // → 50 (fallback)
 * safeInt(null, 1)                // → 1  (fallback — null is not a real number)
 * ```
 *
 * @since 1.3.5
 */
export const safeInt = (
  value: unknown,
  fallback = 0,
  min = -Infinity,
  max = Infinity,
): number => {
  // null, undefined, booleans, and empty strings should fall back —
  // `Number()` coerces them to 0/1 which would silently mask invalid input.
  const isRealNumeric = (typeof value === 'number')
    || (typeof value === 'string' && value.trim().length > 0
        && Number.isFinite(Number(value)));
  if (!isRealNumeric) {
    return Math.max(min, Math.min(max, Math.floor(fallback)));
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return Math.max(min, Math.min(max, Math.floor(fallback)));
  return Math.max(min, Math.min(max, Math.floor(n)));
};

// ─────────────────────────────────────────────
//  Numeric helpers
// ─────────────────────────────────────────────
export const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Clamp + round a number to the 0–255 byte range. Exported as of v1.3.5.
 *
 * @since 1.3.5
 */
export const clampByte = (v: number): number => clamp(Math.round(v), 0, 255);

/**
 * Clamp + coerce a number to the 0–100 percentage range. Returns `0` for
 * non-finite input. Consolidates duplicate `clampPercent` definitions
 * previously living in `components/index.ts` and `loaders/index.ts`.
 *
 * @example
 * ```ts
 * clampPercent(50)     // → 50
 * clampPercent(150)    // → 100
 * clampPercent(-5)     // → 0
 * clampPercent(NaN)    // → 0
 * clampPercent('abc')  // → 0
 * ```
 *
 * @since 1.3.7
 */
export const clampPercent = (p: unknown): number => {
  if (!isFiniteNumber(p)) return 0;
  return Math.max(0, Math.min(100, p));
};

/**
 * Coerce any value to an integer clamped between `[min, max]`. Returns
 * `fallback` (which is also clamped) when input is non-finite.
 *
 * More flexible than `safeInt` for the common pattern
 * `Math.max(min, Math.min(max, Math.floor(n)))` that appears 30+ times
 * across the codebase.
 *
 * @example
 * ```ts
 * clampInt(50, 0, 100)             // → 50
 * clampInt(150, 0, 100)            // → 100
 * clampInt(NaN, 0, 100, 25)        // → 25 (fallback)
 * clampInt('abc', 0, 100, 25)      // → 25 (fallback)
 * ```
 *
 * @since 1.3.7
 */
export const clampInt = (
  value: unknown,
  min: number,
  max: number,
  fallback = 0,
): number => {
  if (!isFiniteNumber(value)) {
    return Math.max(min, Math.min(max, Math.floor(fallback)));
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
};

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

// ─────────────────────────────────────────────
//  v1.3.5 — HSL color space
//
//  HSL (Hue, Saturation, Lightness) is useful for color manipulation:
//  rotating hues, adjusting saturation, building palettes. Conversions
//  follow the standard formulae (https://www.w3.org/TR/css-color-3/).
// ─────────────────────────────────────────────

export interface HSL {
  /** Hue in degrees, 0–360 (wraps; 360 ≡ 0). */
  h: number;
  /** Saturation in [0, 1] (0 = grayscale, 1 = pure color). */
  s: number;
  /** Lightness in [0, 1] (0 = black, 0.5 = pure, 1 = white). */
  l: number;
}

/**
 * Convert RGB (0–255) to HSL.
 *
 * @example
 * rgbToHsl({ r: 255, g: 0, b: 0 })  // → { h: 0,   s: 1, l: 0.5 }
 * rgbToHsl({ r: 0, g: 255, b: 0 })  // → { h: 120, s: 1, l: 0.5 }
 *
 * @since 1.3.5
 */
export const rgbToHsl = (rgb: RGB): HSL => {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };   // achromatic
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  } else if (max === g) {
    h = ((b - r) / d + 2) * 60;
  } else {
    h = ((r - g) / d + 4) * 60;
  }

  return { h, s, l };
};

/**
 * Convert HSL to RGB (0–255). Hue wraps modulo 360.
 *
 * @example
 * hslToRgb({ h: 0,   s: 1, l: 0.5 })  // → { r: 255, g: 0,   b: 0   }
 * hslToRgb({ h: 240, s: 1, l: 0.5 })  // → { r: 0,   g: 0,   b: 255 }
 *
 * @since 1.3.5
 */
export const hslToRgb = (hsl: HSL): RGB => {
  // Normalize hue to [0, 360)
  const h = ((hsl.h % 360) + 360) % 360 / 360;
  const s = clamp(hsl.s, 0, 1);
  const l = clamp(hsl.l, 0, 1);

  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
};

// ─────────────────────────────────────────────
//  v1.3.5 — Oklab color space (perceptually uniform)
//
//  Oklab is a modern perceptual color space — interpolating in Oklab
//  produces smoother, more natural-looking gradients than naive RGB.
//  Reference: https://bottosson.github.io/posts/oklab/
//
//  RGB ⇄ Oklab via linear sRGB intermediate. Values:
//    L ∈ [0, 1]  (perceptual lightness)
//    a ∈ ~[-0.4, 0.4]  (green ↔ red axis)
//    b ∈ ~[-0.4, 0.4]  (blue ↔ yellow axis)
// ─────────────────────────────────────────────

export interface Oklab {
  /** Perceptual lightness in [0, 1]. */
  L: number;
  /** Green↔Red axis, roughly [-0.4, 0.4]. */
  a: number;
  /** Blue↔Yellow axis, roughly [-0.4, 0.4]. */
  b: number;
}

/** sRGB byte → linear sRGB (gamma-decoded). */
const _srgbToLinear = (c: number): number => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};

/** Linear sRGB → sRGB byte (gamma-encoded). */
const _linearToSrgb = (c: number): number => {
  const x = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clampByte(x * 255);
};

/**
 * Convert RGB (0–255) to Oklab. Perceptually uniform — interpolating in
 * this space produces smoother gradients than naive RGB.
 *
 * @since 1.3.5
 */
export const rgbToOklab = (rgb: RGB): Oklab => {
  const r = _srgbToLinear(rgb.r);
  const g = _srgbToLinear(rgb.g);
  const b = _srgbToLinear(rgb.b);

  // Linear sRGB → LMS (long, medium, short cone responses)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  // Non-linear compression
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  // LMS → Oklab
  return {
    L: 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  };
};

/**
 * Convert Oklab back to RGB (0–255). Out-of-gamut values are clamped.
 *
 * @since 1.3.5
 */
export const oklabToRgb = (oklab: Oklab): RGB => {
  const l_ = oklab.L + 0.3963377774 * oklab.a + 0.2158037573 * oklab.b;
  const m_ = oklab.L - 0.1055613458 * oklab.a - 0.0638541728 * oklab.b;
  const s_ = oklab.L - 0.0894841775 * oklab.a - 1.2914855480 * oklab.b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  // LMS → linear sRGB
  const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

  return {
    r: _linearToSrgb(r),
    g: _linearToSrgb(g),
    b: _linearToSrgb(b),
  };
};

// ─────────────────────────────────────────────
//  Color interpolation (v1.3.5: multi-space)
// ─────────────────────────────────────────────

/** Color space to interpolate in. Default `'rgb'` for backward compatibility. */
export type ColorSpace = 'rgb' | 'hsl' | 'oklab';

/**
 * Linearly interpolate between two RGB colors. `t` is clamped to [0, 1].
 *
 * **v1.3.5+**: Accepts an optional 4th argument `space` to control which
 * color space the interpolation happens in. `'oklab'` produces the
 * smoothest, most perceptually uniform gradients but is ~3× slower than
 * naive RGB. `'hsl'` is useful for hue rotation.
 *
 * @param a     - Start color (RGB, 0–255).
 * @param b     - End color (RGB, 0–255).
 * @param t     - Mixing factor in [0, 1] (clamped).
 * @param space - Interpolation space. Default `'rgb'` (backward-compat).
 *
 * @example
 * ```ts
 * lerpColor(red, blue, 0.5);                   // naive RGB midpoint
 * lerpColor(red, blue, 0.5, 'oklab');          // perceptual midpoint
 * lerpColor(red, blue, 0.5, 'hsl');            // through purple via hue
 * ```
 */
export const lerpColor = (a: RGB, b: RGB, t: number, space: ColorSpace = 'rgb'): RGB => {
  const ct = clamp(t, 0, 1);

  if (space === 'oklab') {
    const la = rgbToOklab(a);
    const lb = rgbToOklab(b);
    return oklabToRgb({
      L: lerp(la.L, lb.L, ct),
      a: lerp(la.a, lb.a, ct),
      b: lerp(la.b, lb.b, ct),
    });
  }

  if (space === 'hsl') {
    const ha = rgbToHsl(a);
    const hb = rgbToHsl(b);
    // Hue interpolation along the SHORTER arc on the color wheel.
    // Standard practice — avoids weird detours when going 350° → 10°.
    let dh = hb.h - ha.h;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
    const h = ha.h + dh * ct;
    return hslToRgb({
      h,
      s: lerp(ha.s, hb.s, ct),
      l: lerp(ha.l, hb.l, ct),
    });
  }

  // Default — naive RGB lerp (preserves pre-v1.3.5 behavior)
  return {
    r: Math.round(lerp(a.r, b.r, ct)),
    g: Math.round(lerp(a.g, b.g, ct)),
    b: Math.round(lerp(a.b, b.b, ct)),
  };
};

/**
 * Semantic alias for `lerpColor`. Reads more naturally for the "blend
 * two colors" use case, especially with a named color space.
 *
 * @example
 * ```ts
 * mixColors('#ff0000', '#0000ff', 0.5, 'oklab');
 * // Accepts hex strings OR RGB objects
 * ```
 *
 * @since 1.3.5
 */
export const mixColors = (
  a: RGB | string,
  b: RGB | string,
  t: number,
  space: ColorSpace = 'rgb',
): RGB => {
  const ra = typeof a === 'string' ? hexToRgb(a) : a;
  const rb = typeof b === 'string' ? hexToRgb(b) : b;
  return lerpColor(ra, rb, t, space);
};

/**
 * Quantize a color to N levels per channel. Useful for palette
 * reduction, posterization effects, or matching a constrained color
 * palette (e.g., 16-color terminals).
 *
 * Mathematically: maps each channel to the nearest of `levels` evenly
 * spaced values in [0, 255]. With `levels=2` you get pure on/off per
 * channel (8 colors total). With `levels=4` you get a 64-color palette.
 *
 * @param color  - Input RGB (0–255).
 * @param levels - Number of discrete levels per channel (≥2, default `4`).
 *
 * @example
 * ```ts
 * quantizeColor({ r: 100, g: 150, b: 200 }, 4);
 * // → snaps each channel to nearest of [0, 85, 170, 255]
 * ```
 *
 * @since 1.3.5
 */
export const quantizeColor = (color: RGB, levels = 4): RGB => {
  const safeLevels = Math.max(2, Math.floor(levels));
  const step = 255 / (safeLevels - 1);
  return {
    r: Math.round(clampByte(color.r) / step) * step | 0,
    g: Math.round(clampByte(color.g) / step) * step | 0,
    b: Math.round(clampByte(color.b) / step) * step | 0,
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
export const gradientColor = (colors: RGB[], t: number, space: ColorSpace = 'rgb'): RGB => {
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new Error('gradientColor requires at least one color stop');
  }
  if (colors.length === 1) return colors[0] as RGB;
  // Defensive — NaN/non-finite t falls back to 0
  const safeT = isFiniteNumber(t) ? t : 0;
  const ct = clamp(safeT, 0, 1);
  const scaled = ct * (colors.length - 1);
  const lo = Math.floor(scaled);
  const hi = Math.min(lo + 1, colors.length - 1);
  return lerpColor(colors[lo] as RGB, colors[hi] as RGB, scaled - lo, space);
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

// ─────────────────────────────────────────────
//  v1.3.4 — Additional utility helpers
// ─────────────────────────────────────────────

/**
 * Interpolate a sequence of N colors between two endpoint hex colors.
 * Useful for procedurally generating gradient stops without calling the
 * full gradient pipeline.
 *
 * @param start - Start hex color (e.g. `'#ff0000'`).
 * @param end   - End hex color (e.g. `'#0000ff'`).
 * @param count - Number of stops (>= 2; clamped if smaller).
 * @param space - **v1.3.5+** Color space for interpolation:
 *                `'rgb'` (default, fast), `'hsl'` (hue rotation),
 *                or `'oklab'` (perceptually uniform).
 * @returns Array of hex strings, including both endpoints.
 *
 * @example
 * ```ts
 * import { gradientStops } from 'ansimax';
 *
 * // Naive RGB (default)
 * const stops = gradientStops('#ff0000', '#0000ff', 5);
 *
 * // Perceptually uniform (smoother visual transition)
 * const smooth = gradientStops('#ff0000', '#0000ff', 5, 'oklab');
 * ```
 */
export const gradientStops = (
  start: string,
  end: string,
  count: number,
  space: ColorSpace = 'rgb',
): string[] => {
  const safeCount = Math.max(2, Math.floor(Number.isFinite(count) ? count : 2));
  if (!isHexColor(start) || !isHexColor(end)) return [];
  const a = hexToRgb(start);
  const b = hexToRgb(end);
  const result: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const t = i / (safeCount - 1);
    const c = lerpColor(a, b, t, space);
    result.push(rgbToHex(c.r, c.g, c.b));
  }
  return result;
};

/**
 * Escape a string for safe use inside a regular expression literal.
 * Escapes all 12 regex meta-characters: `. * + ? ^ $ { } ( ) | [ ] \`.
 *
 * @example
 * ```ts
 * import { escapeForRegex } from 'ansimax';
 *
 * const userInput = 'hello.world+code';
 * const re = new RegExp(escapeForRegex(userInput));
 * // Matches the literal string, not as a regex pattern
 * ```
 */
export const escapeForRegex = (str: string): string => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Measure a pre-rendered string block's dimensions: width (max visible
 * width of any line) and height (line count). ANSI escapes are ignored.
 *
 * @example
 * ```ts
 * import { measureBlock } from 'ansimax';
 *
 * const box = ascii.box('Hello world!');
 * const { width, height } = measureBlock(box);
 * // → { width: 15, height: 3 }
 * ```
 */
export const measureBlock = (block: string): { width: number; height: number } => {
  if (typeof block !== 'string' || block.length === 0) {
    return { width: 0, height: 0 };
  }
  const lines = block.split('\n');
  let width = 0;
  for (const line of lines) {
    const w = visibleLen(line);
    if (w > width) width = w;
  }
  return { width, height: lines.length };
};
