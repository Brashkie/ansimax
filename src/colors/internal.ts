// ─────────────────────────────────────────────
//  colors/internal — shared color primitives
//
//  v1.6.4 — extracted from the former ~1,180-line colors/index.ts. This
//  holds the state + helpers every color path depends on: suppression
//  (_noColor), color-level resolution, numeric clamps, the fail-soft hex
//  parser, text coercion, level-downgrade math, the adaptive escape cache,
//  and the core wrap(). Keeping these in one module avoids duplicating the
//  cache/state across the split files. Public API is unchanged — the barrel
//  re-exports setNoColor/resetNoColor/isNoColor/colorLevel/clearColorCache.
// ─────────────────────────────────────────────

import {
  fgRgb, bgRgb, fg256, bg256, reset, sgr,
  FG,
  supportsColor, supportsColorLevel,
  type ColorLevel,
} from '../utils/ansi.js';
import { hexToRgb, RGB, isHexColor } from '../utils/helpers.js';

export type ColorFn = (text: string) => string;

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

export const clampRgb = (n: number): number => {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  if (n === Infinity)  return 255;
  if (n === -Infinity) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
};

export const clamp256 = (n: number): number => {
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
export const safeHex = (h: unknown): RGB | null => {
  if (typeof h !== 'string') return null;
  const normalized = h.trim();
  // v1.4.6 — use consolidated isHexColor (was a local HEX_RE copy)
  if (!isHexColor(normalized)) return null;
  return hexToRgb(normalized);
};

// ─────────────────────────────────────────────
//  Text coercion — pass-through for non-strings
//
//  If a caller passes a number/object/null, we coerce to string rather
//  than throwing. This matches the chalk/kleur convention where
//  `color.red(42)` returns `"\x1b[31m42\x1b[0m"`.
// ─────────────────────────────────────────────
export const coerceText = (t: unknown): string => {
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

export const rgbTo256 = (r: number, g: number, b: number): number => {
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
export const ANSI_BASE: ReadonlyArray<readonly [number, number, number, number]> = [
  [0,   0,   0,   FG.black],
  [205, 0,   0,   FG.red],
  [0,   205, 0,   FG.green],
  [205, 205, 0,   FG.yellow],
  [0,   0,   238, FG.blue],
  [205, 0,   205, FG.magenta],
  [0,   205, 205, FG.cyan],
  [229, 229, 229, FG.white],
];

export const rgbToBasicFg = (r: number, g: number, b: number): number => {
  let best: number = FG.white;
  let bestDist = Infinity;
  for (const [ar, ag, ab, code] of ANSI_BASE) {
    const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (d < bestDist) { bestDist = d; best = code; }
  }
  return best;
};

export const rgbToBasicBg = (r: number, g: number, b: number): number =>
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

export const adaptiveFg = (r: number, g: number, b: number): string => {
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

export const adaptiveBg = (r: number, g: number, b: number): string => {
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
export const wrap = (open: string, text: unknown): string => {
  const s = coerceText(text);
  if (isNoColor() || open === '') return s;
  return open + s + reset();
};
