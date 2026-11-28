// ─────────────────────────────────────────────
//  ansimax/ascii — Image → ASCII engine
//
//  v1.4.10 — Split out from index.ts. Phase 3 (v1.2.5) image-to-ASCII:
//  luminance mapping, Sobel edge detection, Floyd–Steinberg dithering,
//  bilinear resize, face-mode contrast, and per-char color.
// ─────────────────────────────────────────────

import { fgRgb, bgRgb, reset } from '../utils/ansi.js';
import { isNoColor } from '../colors/index.js';
import { nearestPerceptual, rgbToOklab } from '../utils/helpers.js';
import type { RGB } from '../utils/helpers.js';
import type { Pixel, PixelGrid } from '../images/index.js';
import type { FromImageOptions } from './types.js';

export const ASCII_RAMPS = {
  standard: ' .:-=+*#%@',
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks:   ' ░▒▓█',
  simple:   ' .+#',
  // v1.2.6 — new ramps
  binary:   ' █',
  dots:     ' ⠁⠃⠇⠧⠷⡷⣷⣿',
  shades:   ' ⠁⠃⠇⠧⠷⡷⣷⣿█',
  ascii64:  ' `.\'^,_:-+=<>i!lI?/\\|()1{}[]rcvunxzjftLCJUYXZO0Qoahkbdpqwm*WMB8&%$#@',
  // v1.4.13 — new ramps
  minimal:  ' .oO@',
  thermal:  ' .:coPO?@█',
  hearts:   ' ·♡♥',
} as const;

export type AsciiRamp = keyof typeof ASCII_RAMPS | string;

// v1.4.13 — Named ramp registry storage (declared before _resolveRamp,
// which reads it). Full registry API is defined further below.
const _rampRegistry = new Map<string, string>();

const _resolveRamp = (r: AsciiRamp | undefined): string => {
  if (typeof r === 'string' && r.length > 0) {
    // Runtime-registered ramps take precedence over built-ins so a user can
    // shadow a built-in name if they really want to.
    const custom = _rampRegistry.get(r.trim().toLowerCase());
    if (custom !== undefined) return custom;
    if (r in ASCII_RAMPS) return ASCII_RAMPS[r as keyof typeof ASCII_RAMPS];
    return r; // literal custom ramp string (the characters themselves)
  }
  return ASCII_RAMPS.standard;
};

// ─────────────────────────────────────────────
//  v1.4.13 — Named ramp registry
//
//  Mirrors the font registry (registerFont) and markdown theme registry.
//  A ramp is a string of characters ordered dark → light; index 0 maps to
//  the darkest luminance. Registering a name lets callers pass that name as
//  `ramp` instead of repeating the raw character string.
// ─────────────────────────────────────────────

const BUILT_IN_RAMP_NAMES: ReadonlyArray<string> = Object.keys(ASCII_RAMPS);

/**
 * Register a named ASCII ramp (a string of characters, dark → light).
 *
 * @example
 * ```js
 * import { registerAsciiRamp, ascii } from 'ansimax';
 *
 * registerAsciiRamp('retro', ' .oO0');
 * ascii.fromImage(pixels, { ramp: 'retro' });
 * ```
 *
 * @param name  non-empty ramp name (trimmed + lowercased)
 * @param chars ramp characters, at least 2, ordered dark → light
 * @throws TypeError on an empty name or a ramp shorter than 2 characters
 * @since 1.4.13
 */
export const registerAsciiRamp = (name: string, chars: string): void => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TypeError('registerAsciiRamp: name must be a non-empty string');
  }
  if (typeof chars !== 'string' || [...chars].length < 2) {
    throw new TypeError('registerAsciiRamp: chars must be a string of 2+ characters');
  }
  _rampRegistry.set(name.trim().toLowerCase(), chars);
};

/**
 * Remove a registered ramp. Built-ins cannot be removed.
 * @returns true when a registered ramp was removed.
 * @since 1.4.13
 */
export const unregisterAsciiRamp = (name: string): boolean => {
  if (typeof name !== 'string') return false;
  return _rampRegistry.delete(name.trim().toLowerCase());
};

/**
 * List every available ramp name — built-ins first, then registered ones.
 * @since 1.4.13
 */
export const listAsciiRamps = (): string[] => {
  const custom = [...(_rampRegistry.keys())].filter((k) => !BUILT_IN_RAMP_NAMES.includes(k));
  return [...BUILT_IN_RAMP_NAMES, ...custom];
};

/**
 * True when `name` resolves to a built-in or registered ramp.
 * @since 1.4.13
 */
export const hasAsciiRamp = (name: string): boolean => {
  if (typeof name !== 'string') return false;
  const key = name.trim().toLowerCase();
  return _rampRegistry.has(key) || BUILT_IN_RAMP_NAMES.includes(key);
};

/**
 * Clear every registered ramp (built-ins are untouched).
 * @since 1.4.13
 */
export const clearAsciiRamps = (): void => { _rampRegistry.clear(); };

/** Compute perceived luminance (BT.709) — returns [0, 255]. */
const _luminance = (p: Pixel): number => {
  if (!p) return 0;
  // Standard ITU-R BT.709 coefficients
  return 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
};

/**
 * Sobel edge detection — returns a same-sized grid of edge magnitudes [0, 255].
 * Used internally for `edgeDetect: 'sobel'` mode.
 */
const _sobelEdges = (pixels: PixelGrid): number[][] => {
  const h = pixels.length;
  /* istanbul ignore next — `: 0` defensive: callers always pass a resized non-empty grid */
  const w = h > 0 ? (pixels[0] as Pixel[]).length : 0;
  const out: number[][] = Array.from({ length: h }, () => new Array<number>(w).fill(0));

  // Gx and Gy kernels
  // Gx: [-1 0 1; -2 0 2; -1 0 1]
  // Gy: [-1 -2 -1; 0 0 0; 1 2 1]
  for (let y = 1; y < h - 1; y++) {
    const rowPrev = pixels[y - 1] as Pixel[];
    const row     = pixels[y]     as Pixel[];
    const rowNext = pixels[y + 1] as Pixel[];
    const outRow  = out[y]        as number[];
    for (let x = 1; x < w - 1; x++) {
      const tl = _luminance(rowPrev[x - 1] as Pixel);
      const t  = _luminance(rowPrev[x]     as Pixel);
      const tr = _luminance(rowPrev[x + 1] as Pixel);
      const l  = _luminance(row[x - 1]     as Pixel);
      const r  = _luminance(row[x + 1]     as Pixel);
      const bl = _luminance(rowNext[x - 1] as Pixel);
      const b  = _luminance(rowNext[x]     as Pixel);
      const br = _luminance(rowNext[x + 1] as Pixel);

      const gx = -tl + tr - 2 * l + 2 * r - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      const mag = Math.sqrt(gx * gx + gy * gy);
      outRow[x] = Math.min(255, mag);
    }
  }
  return out;
};

/**
 * An error-diffusion kernel: a list of `[dx, dy, weight]` taps plus a shared
 * `divisor`. The quantization error at each pixel is spread to forward
 * neighbors (dy ≥ 0; dy = 0 only for dx > 0) scaled by `weight / divisor`.
 * Different classic dithering algorithms are simply different kernels.
 *
 * @since 1.6.2
 */
interface DiffusionKernel {
  divisor: number;
  taps: ReadonlyArray<readonly [number, number, number]>; // [dx, dy, weight]
}

// Classic error-diffusion kernels. Each spreads the quantization error to
// not-yet-processed neighbors; larger kernels distribute more smoothly at a
// higher cost.
const DIFFUSION_KERNELS: Record<string, DiffusionKernel> = {
  // Floyd–Steinberg (1976) — the classic 4-tap kernel.
  'floyd-steinberg': {
    divisor: 16,
    taps: [
      [1, 0, 7],
      [-1, 1, 3], [0, 1, 5], [1, 1, 1],
    ],
  },
  // Atkinson (Apple, 1980s) — diffuses only 6/8 of the error, giving higher
  // contrast and cleaner highlights (loses some detail, looks "crisp").
  atkinson: {
    divisor: 8,
    taps: [
      [1, 0, 1], [2, 0, 1],
      [-1, 1, 1], [0, 1, 1], [1, 1, 1],
      [0, 2, 1],
    ],
  },
  // Jarvis–Judice–Ninke (1976) — a wide 12-tap kernel; very smooth gradients,
  // the most expensive of these.
  jjn: {
    divisor: 48,
    taps: [
      [1, 0, 7], [2, 0, 5],
      [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
      [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
    ],
  },
  // Sierra (1989) — a balance between JJN's smoothness and FS's speed.
  sierra: {
    divisor: 32,
    taps: [
      [1, 0, 5], [2, 0, 3],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
      [-1, 2, 2], [0, 2, 3], [1, 2, 2],
    ],
  },
  // Stucki (1981) — a refinement of JJN with the same 12-tap footprint but
  // weights that sum to a power-of-two-friendly 42; very smooth, slightly
  // sharper than JJN. @since 1.7.4
  stucki: {
    divisor: 42,
    taps: [
      [1, 0, 8], [2, 0, 4],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
      [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
    ],
  },
  // Burkes (1988) — Stucki's two-row cousin: drops the third row for roughly
  // half the work while keeping most of the smoothness. @since 1.7.4
  burkes: {
    divisor: 32,
    taps: [
      [1, 0, 8], [2, 0, 4],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
    ],
  },
  // Sierra Lite (Sierra-2-4A, 1990) — the cheapest error-diffusion kernel:
  // just 3 taps over a power-of-two divisor. Fast, a touch grainier than the
  // larger kernels — a good default for very large images. @since 1.8.0
  'sierra-lite': {
    divisor: 4,
    taps: [
      [1, 0, 2],
      [-1, 1, 1], [0, 1, 1],
    ],
  },
};

/** Names of the available error-diffusion dithering algorithms. @since 1.6.2 */
export const DITHER_ALGORITHMS = Object.keys(DIFFUSION_KERNELS) as ReadonlyArray<string>;

/**
 * Generic error-diffusion dithering on a luminance grid. Works for any
 * `DiffusionKernel`, so Floyd–Steinberg, Atkinson, JJN, and Sierra all share
 * one implementation. Mutates a copy of the input and returns the quantized
 * grid.
 *
 * @param lum    luminance grid (row-major, values in [0,255])
 * @param levels number of output quantization levels (≥ 2)
 * @param kernel the diffusion kernel to use
 */
const _errorDiffuse = (
  lum: number[][],
  levels: number,
  kernel: DiffusionKernel,
): number[][] => {
  const h = lum.length;
  /* istanbul ignore if — defensive: callers (fromImage) validate non-empty grids upstream */
  if (h === 0) return lum;
  const w = (lum[0] as number[]).length;
  /* istanbul ignore if — defensive: callers validate non-empty rows upstream */
  if (w === 0) return lum;

  // Work on a copy so we don't mutate the caller's data
  const out = lum.map((row) => [...row]);
  const step = 255 / Math.max(1, levels - 1);
  const { divisor, taps } = kernel;

  for (let y = 0; y < h; y++) {
    const row = out[y] as number[];
    for (let x = 0; x < w; x++) {
      const oldPixel = row[x] as number;
      const quantLevel = Math.round(oldPixel / step);
      const newPixel = quantLevel * step;
      row[x] = newPixel;
      const err = oldPixel - newPixel;
      if (err === 0) continue;

      // Spread the error across the kernel's taps.
      for (const [dx, dy, weight] of taps) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        const target = out[ny] as number[];
        target[nx] = (target[nx] as number) + (err * weight) / divisor;
      }
    }
  }
  return out;
};

// Coerce any Pixel (RGB, RGBA, or null) to a plain RGB. null → black.
const _pixelToRgb = (p: Pixel): RGB =>
  p == null ? { r: 0, g: 0, b: 0 } : { r: p.r, g: p.g, b: p.b };

// NaN is a perfectly ordinary `number`, and it passes straight through a
// comparison-only clamp: `NaN < 0` and `NaN > 255` are both false, so the
// value would come out as NaN and poison whatever consumes it.
const _clamp255 = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
};

// Nearest palette index by squared RGB (L2) distance.
const _nearestRgb = (c: RGB, palette: RGB[]): number => {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i] as RGB;
    const dr = c.r - p.r;
    const dg = c.g - p.g;
    const db = c.b - p.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
};

/** Options for {@link ditherColor}. @since 1.7.4 */
export interface DitherColorOptions {
  /**
   * Error-diffusion kernel by name — any of {@link DITHER_ALGORITHMS}
   * (`'floyd-steinberg'`, `'atkinson'`, `'jjn'`, `'sierra'`, `'stucki'`,
   * `'burkes'`). Default `'floyd-steinberg'`.
   */
  algorithm?: string;
  /**
   * Nearest-color metric. `'oklab'` (default) picks the perceptually closest
   * palette entry by Oklab ΔE — far less hue drift and banding than RGB
   * distance. `'rgb'` uses plain squared Euclidean distance (faster).
   */
  metric?: 'oklab' | 'rgb';
}

/**
 * Quantize a color image to a palette with error-diffusion dithering, choosing
 * each pixel's replacement by **perceptual (Oklab ΔE) distance** rather than
 * RGB distance. This is the Phase 12 pairing of ansimax's perceptual color
 * metric (v1.7.0) with the classic diffusion kernels (v1.6.2): the error that
 * quantization introduces is spread to neighbouring pixels, and the nearest
 * palette entry is judged the way the eye judges it, so gradients and skin
 * tones keep their shape instead of banding or shifting hue.
 *
 * Pure: returns a fresh `RGB[][]` the same shape as the input; `null`/
 * transparent pixels are treated as black. Falls back to Floyd–Steinberg for
 * an unknown `algorithm`. An empty palette returns the input coerced to RGB,
 * unchanged.
 *
 * @example
 * ```js
 * import { ditherColor } from 'ansimax';
 *
 * const palette = [
 *   { r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 },
 *   { r: 255, g: 0, b: 0 }, { r: 0, g: 128, b: 255 },
 * ];
 * const out = ditherColor(pixels, palette, { algorithm: 'stucki' });
 * ```
 *
 * @since 1.7.4
 */
export const ditherColor = (
  pixels: PixelGrid,
  palette: RGB[],
  opts: DitherColorOptions = {},
): RGB[][] => {
  const h = Array.isArray(pixels) ? pixels.length : 0;
  if (h === 0) return [];
  const w = (pixels[0] as Pixel[]).length;

  // Working grid of plain RGB (float, so diffused error accumulates cleanly).
  const work: RGB[][] = pixels.map((row) => row.map(_pixelToRgb));
  if (!Array.isArray(palette) || palette.length === 0) return work;

  const kernel = DIFFUSION_KERNELS[opts.algorithm ?? 'floyd-steinberg']
    ?? (DIFFUSION_KERNELS['floyd-steinberg'] as DiffusionKernel);
  const usePerceptual = (opts.metric ?? 'oklab') === 'oklab';
  const { divisor, taps } = kernel;

  const out: RGB[][] = [];
  for (let y = 0; y < h; y++) {
    const row = work[y] as RGB[];
    const outRow: RGB[] = new Array(w);
    for (let x = 0; x < w; x++) {
      const old = row[x] as RGB;
      const idx = usePerceptual ? nearestPerceptual(old, palette) : _nearestRgb(old, palette);
      const chosen = palette[idx] as RGB;
      outRow[x] = { r: _clamp255(chosen.r), g: _clamp255(chosen.g), b: _clamp255(chosen.b) };
      const er = old.r - chosen.r;
      const eg = old.g - chosen.g;
      const eb = old.b - chosen.b;
      if (er === 0 && eg === 0 && eb === 0) continue;
      for (const [dx, dy, weight] of taps) {
        const nx = x + dx;
        const ny = y + dy;
        if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
        const t = (work[ny] as RGB[])[nx] as RGB;
        const f = weight / divisor;
        t.r += er * f;
        t.g += eg * f;
        t.b += eb * f;
      }
    }
    out.push(outRow);
  }
  return out;
};

/**
 * Resize a PixelGrid using nearest-neighbor sampling. Fast and good enough
 * for ASCII output where loss of detail is expected.
 */
const _resizePixels = (
  pixels: PixelGrid,
  targetW: number,
  targetH: number,
): PixelGrid => {
  const srcH = pixels.length;
  /* istanbul ignore if — defensive: callers validate non-empty grids upstream */
  if (srcH === 0) return [];
  const srcW = (pixels[0] as Pixel[]).length;
  /* istanbul ignore if — defensive: callers validate non-empty rows upstream */
  if (srcW === 0) return [];

  const out: PixelGrid = [];
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y / targetH) * srcH));
    const srcRow = pixels[sy] as Pixel[];
    // v1.2.7: handle non-rectangular grids — use actual row width per row
    const actualRowW = Array.isArray(srcRow) ? srcRow.length : 0;
    const newRow: Pixel[] = new Array(targetW);
    for (let x = 0; x < targetW; x++) {
      if (actualRowW === 0) {
        newRow[x] = null;
        continue;
      }
      const sx = Math.min(actualRowW - 1, Math.floor((x / targetW) * actualRowW));
      // Coalesce undefined → null (so render code's null-check handles it)
      newRow[x] = (srcRow[sx] ?? null) as Pixel;
    }
    out.push(newRow);
  }
  return out;
};

/**
 * Compute a luminance grid (one number per pixel, [0, 255]).
 * Null pixels become 0.
 */
const _toLuminanceGrid = (pixels: PixelGrid): number[][] => {
  return pixels.map((row) => row.map((p) => _luminance(p)));
};

/**
 * Apply a small histogram stretch for portraits to enhance contrast in
 * the midtones (where faces live). Returns a new luminance grid.
 *
 * Strategy: stretch [10%, 90%] percentiles to [0, 255]. Simple but
 * effective for portraits with limited dynamic range.
 */
const _enhanceForFace = (lum: number[][]): number[][] => {
  const flat: number[] = [];
  for (const row of lum) for (const v of row) flat.push(v);
  /* istanbul ignore if — defensive: callers validate non-empty grids upstream */
  if (flat.length === 0) return lum;
  flat.sort((a, b) => a - b);
  const lo = flat[Math.floor(flat.length * 0.10)] as number;
  const hi = flat[Math.floor(flat.length * 0.90)] as number;
  const range = Math.max(1, hi - lo);
  return lum.map((row) =>
    row.map((v) => {
      const stretched = ((v - lo) / range) * 255;
      return Math.max(0, Math.min(255, stretched));
    }),
  );
};

/**
 * Apply brightness and contrast adjustments to a luminance grid.
 *
 * - `brightness` is added to each value (scaled to 0-255 range)
 * - `contrast` stretches values around the midpoint (128)
 *
 * Both parameters are in `[-1, 1]`. Returns a new grid; never mutates input.
 *
 * @since 1.2.6
 */
const _adjustBrightnessContrast = (
  lum: number[][],
  brightness: number,
  contrast: number,
): number[][] => {
  // Clamp inputs to [-1, 1]
  const safeBrightness = Math.max(-1, Math.min(1, brightness)) * 255;
  const safeContrast = Math.max(-1, Math.min(1, contrast));
  // Standard contrast formula: out = (in - 128) * factor + 128
  // where factor = (1 + contrast) for contrast in [-1, 1]
  const contrastFactor = 1 + safeContrast;

  return lum.map((row) =>
    row.map((v) => {
      // Apply contrast (around 128 midpoint), then brightness
      const adjusted = (v - 128) * contrastFactor + 128 + safeBrightness;
      return Math.max(0, Math.min(255, adjusted));
    }),
  );
};

/**
 * Convert a pixel grid into colored or monochrome ASCII art.
 *
 * @example basic monochrome conversion
 * ```ts
 * import sharp from 'sharp';
 *
 * const { data, info } = await sharp('photo.png')
 *   .raw().toBuffer({ resolveWithObject: true });
 * const pixels: PixelGrid = bufferToPixelGrid(data, info.width, info.height);
 *
 * console.log(ascii.fromImage(pixels, { width: 80 }));
 * ```
 *
 * @example with color + dither
 * ```ts
 * console.log(ascii.fromImage(pixels, {
 *   width: 100,
 *   color: true,
 *   dither: 'floyd-steinberg',
 *   ramp: 'detailed',
 * }));
 * ```
 *
 * @example with edge detection
 * ```ts
 * console.log(ascii.fromImage(pixels, {
 *   width: 80,
 *   edgeDetect: 'sobel',
 *   ramp: 'blocks',
 * }));
 * ```
 */
export const fromImage = (
  pixels: PixelGrid,
  opts: FromImageOptions = {},
): string => {
  // Validation
  if (!Array.isArray(pixels) || pixels.length === 0) return '';
  const firstRow = pixels[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) return '';

  // v1.2.7: reject invalid dimensions explicitly instead of silently
  // coercing them to 1 (which produces unexpected single-character output)
  const requestedW = opts.width ?? 80;
  if (!Number.isFinite(requestedW) || requestedW <= 0) return '';
  if (opts.height !== undefined) {
    if (!Number.isFinite(opts.height) || opts.height <= 0) return '';
  }

  const {
    ramp = 'standard',
    invert = false,
    dither = 'none',
    edgeDetect = 'none',
    edgeThreshold = 40,
    color = false,
    faceMode = false,
    // v1.2.6
    bgColor = false,
    brightness = 0,
    contrast = 0,
  } = opts;

  const srcH = pixels.length;
  const srcW = (pixels[0] as Pixel[]).length;
  const safeW = Math.max(1, Math.floor(requestedW));
  // Terminal cells are ~2x tall as wide; halve the height to keep aspect ratio
  const computedH = Math.max(1, Math.round((srcH / srcW) * safeW * 0.5));
  const safeH = opts.height != null ? Math.max(1, Math.floor(opts.height)) : computedH;

  // 1. Resize to target dimensions
  const resized = _resizePixels(pixels, safeW, safeH);

  // 2. Compute luminance grid
  let lum = _toLuminanceGrid(resized);

  // 3. Brightness / contrast pre-adjustment (v1.2.6)
  if (brightness !== 0 || contrast !== 0) {
    lum = _adjustBrightnessContrast(lum, brightness, contrast);
  }

  // 4. Face-mode contrast enhancement (before quantization)
  if (faceMode) lum = _enhanceForFace(lum);

  // 5. Edge detection (overrides luminance if enabled)
  let edgeGrid: number[][] | null = null;
  if (edgeDetect === 'sobel') {
    edgeGrid = _sobelEdges(resized);
  }

  // 5. Ramp resolution
  const rampStr = _resolveRamp(ramp);
  const rampLen = rampStr.length;

  // 6. Optional dithering (only when not in edge mode — they don't combine well)
  if (dither !== 'none' && !edgeGrid) {
    const kernel = DIFFUSION_KERNELS[dither];
    if (kernel) lum = _errorDiffuse(lum, rampLen, kernel);
  }

  // 7. Render output
  const useColor = (color || bgColor) && !isNoColor();
  const lines: string[] = [];
  for (let y = 0; y < safeH; y++) {
    const lumRow  = lum[y]      as number[];
    const pxRow   = resized[y]  as Pixel[];
    const edgeRow = edgeGrid ? (edgeGrid[y] as number[]) : null;
    let line = '';
    for (let x = 0; x < safeW; x++) {
      let charIdx: number;
      if (edgeRow) {
        // Edge mode: high edge → bright char, low edge → dark char
        const edge = edgeRow[x] as number;
        const t = edge >= edgeThreshold ? Math.min(1, edge / 255) : 0;
        // Math.round for fairer distribution at range extremes (vs floor)
        charIdx = invert
          ? Math.round((1 - t) * (rampLen - 1))
          : Math.round(t * (rampLen - 1));
      } else {
        const l = (lumRow[x] as number) / 255;
        const tNorm = invert ? 1 - l : l;
        // Math.round + clamp: ensures bright pixels reach the brightest char
        charIdx = Math.min(rampLen - 1, Math.max(0, Math.round(tNorm * (rampLen - 1))));
      }
      const ch = rampStr[charIdx] as string;

      if (useColor) {
        const p = pxRow[x];
        if (p) {
          // v1.2.6: bgColor option puts color on background instead of foreground
          if (bgColor) {
            line += bgRgb(p.r, p.g, p.b) + ch;
          } else {
            line += fgRgb(p.r, p.g, p.b) + ch;
          }
        } else {
          line += ch;
        }
      } else {
        line += ch;
      }
    }
    if (useColor) line += reset();
    lines.push(line);
  }

  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Adaptive palette — median cut (v1.10.0)
// ─────────────────────────────────────────────

/** Options for {@link medianCutPalette}. @since 1.10.0 */
export interface MedianCutOptions {
  /** Palette size ceiling. Default `256`, the Sixel register limit. */
  maxColors?: number;
  /**
   * Which space to split boxes in. `'oklab'` (default) splits where the eye
   * sees the most variation; `'rgb'` splits along raw channels, which is
   * faster but spends entries on differences nobody notices.
   */
  space?: 'oklab' | 'rgb';
}

interface ColorBucket {
  /** Indices into the unique-colour arrays. */
  items: number[];
  /** Total pixel count, so a split favours the box carrying more image. */
  weight: number;
  /** Longest axis and its extent, cached from the last split. */
  axis: 0 | 1 | 2;
  spread: number;
}

/**
 * Build an adaptive palette for an image with Heckbert's median cut.
 *
 * The image's own colours are boxed and the box with the widest spread is
 * split at its weighted median, repeatedly, until there are `maxColors`
 * boxes; each box's average is one palette entry. Splitting in Oklab means
 * the subdivisions follow perceived difference, so a photograph does not
 * spend half its palette on greens the eye reads as one colour.
 *
 * Pair it with {@link ditherColor} to map the image onto the result, or with
 * {@link nearestPerceptual} for a direct mapping.
 *
 * @example
 * ```js
 * import { medianCutPalette, ditherColor } from 'ansimax';
 *
 * const palette = medianCutPalette(pixels, { maxColors: 64 });
 * const mapped = ditherColor(pixels, palette, { algorithm: 'atkinson' });
 * ```
 *
 * @since 1.10.0
 */
export const medianCutPalette = (pixels: PixelGrid, opts: MedianCutOptions = {}): RGB[] => {
  const maxColors = Math.max(1, Math.min(4096, Math.trunc(opts.maxColors ?? 256) || 256));
  const perceptual = opts.space !== 'rgb';
  if (!Array.isArray(pixels) || pixels.length === 0) return [];

  // Unique colours with pixel counts. Packing RGB into one integer key keeps
  // this a single Map lookup per pixel instead of string building.
  const counts = new Map<number, number>();
  for (const row of pixels) {
    if (!Array.isArray(row)) continue;
    for (const px of row) {
      const c = _pixelToRgb(px);
      // Clamp before packing: a channel outside 0..255, or NaN, would make
      // the bit-packed key collide with an unrelated colour and come back
      // out as one.
      const key = (_clamp255(c.r) << 16) | (_clamp255(c.g) << 8) | _clamp255(c.b);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return [];

  const keys = [...counts.keys()];
  const n = keys.length;
  const r = new Float64Array(n);
  const g = new Float64Array(n);
  const b = new Float64Array(n);
  const w = new Float64Array(n);
  // Split coordinates: Oklab, or the raw channels when asked.
  const c0 = new Float64Array(n);
  const c1 = new Float64Array(n);
  const c2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const key = keys[i] as number;
    const rr = (key >> 16) & 0xff;
    const gg = (key >> 8) & 0xff;
    const bb = key & 0xff;
    r[i] = rr; g[i] = gg; b[i] = bb;
    w[i] = counts.get(key) as number;
    if (perceptual) {
      const o = rgbToOklab({ r: rr, g: gg, b: bb });
      c0[i] = o.L; c1[i] = o.a; c2[i] = o.b;
    } else {
      // Scale RGB to Oklab's rough magnitude so one `spread` threshold fits both.
      c0[i] = rr / 255; c1[i] = gg / 255; c2[i] = bb / 255;
    }
  }
  const coord = [c0, c1, c2] as const;

  /**
   * Widest axis, its extent, and the box's total weight — in one pass over
   * the items rather than four.
   *
   * Measured next step, not taken here: holding every bucket as a range in
   * one shared Int32Array and splitting with a weighted quickselect would
   * drop the per-split allocation and sort (16.4 ms for a 128x96 image at 64
   * colours today, most of it the sorts). It is left alone because the cut
   * point has to come out identical to the sort-based weighted median, and
   * that needs verifying against the current output before it is trusted.
   */
  const makeBucket = (items: number[]): ColorBucket => {
    let weight = 0;
    let lo0 = Number.POSITIVE_INFINITY;
    let hi0 = Number.NEGATIVE_INFINITY;
    let lo1 = Number.POSITIVE_INFINITY;
    let hi1 = Number.NEGATIVE_INFINITY;
    let lo2 = Number.POSITIVE_INFINITY;
    let hi2 = Number.NEGATIVE_INFINITY;
    for (let k = 0; k < items.length; k++) {
      const i = items[k] as number;
      weight += w[i] as number;
      const v0 = c0[i] as number;
      const v1 = c1[i] as number;
      const v2 = c2[i] as number;
      if (v0 < lo0) lo0 = v0;
      if (v0 > hi0) hi0 = v0;
      if (v1 < lo1) lo1 = v1;
      if (v1 > hi1) hi1 = v1;
      if (v2 < lo2) lo2 = v2;
      if (v2 > hi2) hi2 = v2;
    }
    const d0 = hi0 - lo0;
    const d1 = hi1 - lo1;
    const d2 = hi2 - lo2;
    let axis: 0 | 1 | 2 = 0;
    let spread = d0;
    if (d1 > spread) { spread = d1; axis = 1; }
    if (d2 > spread) { spread = d2; axis = 2; }
    return { items, weight, axis, spread };
  };

  const buckets: ColorBucket[] = [makeBucket([...Array(n).keys()])];

  while (buckets.length < maxColors) {
    // Split the box that costs the most to leave merged: spread times the
    // image area it covers. A wide box holding three pixels can wait.
    let pick = -1;
    let worst = 0;
    for (let i = 0; i < buckets.length; i++) {
      const bk = buckets[i] as ColorBucket;
      if (bk.items.length < 2 || bk.spread <= 0) continue;
      const cost = bk.spread * bk.weight;
      if (cost > worst) { worst = cost; pick = i; }
    }
    if (pick < 0) break; // every box is a single colour

    const bk = buckets[pick] as ColorBucket;
    const arr = coord[bk.axis] as Float64Array;
    const sorted = bk.items.slice().sort((x, y) => (arr[x] as number) - (arr[y] as number));
    // Weighted median: the cut lands where half the *pixels* are, not half
    // the distinct colours, so a flat background cannot drag the split.
    const half = bk.weight / 2;
    let acc = 0;
    let cut = 0;
    while (cut < sorted.length - 1) {
      acc += w[sorted[cut] as number] as number;
      cut++;
      if (acc >= half) break;
    }
    buckets.splice(pick, 1, makeBucket(sorted.slice(0, cut)), makeBucket(sorted.slice(cut)));
  }

  return buckets.map((bk) => {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sw = 0;
    for (const i of bk.items) {
      const weight = w[i] as number;
      sr += (r[i] as number) * weight;
      sg += (g[i] as number) * weight;
      sb += (b[i] as number) * weight;
      sw += weight;
    }
    return sw === 0
      ? { r: 0, g: 0, b: 0 }
      : { r: Math.round(sr / sw), g: Math.round(sg / sw), b: Math.round(sb / sw) };
  });
};
