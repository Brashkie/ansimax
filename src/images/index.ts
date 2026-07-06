// ─────────────────────────────────────────────
//  IMAGES — pixel art, sprites, canvas
//
//  Performance philosophy:
//   - Stateful renderer: only emit ANSI when color actually changes
//   - Cached escape sequences for repeated colors (LRU 1024 entries)
//   - Squared-distance comparisons (no sqrt in hot loops)
//   - Pre-clipped iteration bounds for shapes
//   - Optional braille mode for 2×4 sub-character resolution
//   - Optional Bayer 4×4 dithering for smoother gradients
//
//  Robustness guarantees:
//   - All numeric inputs (width, height, x, y, radius) clamped
//   - NaN/Infinity in coords → fallback to safe value
//   - Non-array pixels → returns empty string instead of crash
//   - All sprite/canvas mutations use cloneColor (no shared references)
//   - canvas.pixels getter returns deep copy (callers can't break state)
//   - drawSprite tolerates irregular sprites (non-array rows)
// ─────────────────────────────────────────────

import { fgRgb, bgRgb as bgRgbCode, reset, write } from '../utils/ansi.js';
import {
  hexToRgb, clamp, lerpColor, RGB,
  // v1.3.7 — consolidated helpers (formerly inlined here)
  isFiniteNumber, clampInt,
  // v1.4.6 — consolidated hex validation
  isHexColor,
} from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Types — RGB/RGBA, Pixel, Grid
// ─────────────────────────────────────────────

export interface RGBA {
  r: number;
  g: number;
  b: number;
  /** 0..1 alpha. 1 = opaque, 0 = transparent. */
  a: number;
}

/** A pixel can be opaque RGB, semi-transparent RGBA, or null (fully transparent). */
export type Pixel = RGB | RGBA | null;
export type PixelGrid = Pixel[][];

const FULL_BLOCK = '█';
const UPPER_HALF = '▀';
const LOWER_HALF = '▄';

const clampByte = (n: number): number => {
  if (!isFiniteNumber(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
};

/** Maximum reasonable canvas dimension. Prevents Array.from OOM on Infinity. */
const MAX_DIMENSION = 10000;

// ─────────────────────────────────────────────
//  Hex / RGB utilities — exposed via images.colors
// ─────────────────────────────────────────────
const safeHex = (h: unknown): RGB | null => {
  // v1.4.6 — use consolidated isHexColor (was a local HEX_RE copy)
  if (typeof h !== 'string' || !isHexColor(h.trim())) return null;
  /* istanbul ignore next */
  try { return hexToRgb(h); }
  catch { return null; }
};

/** Alpha-blend a foreground pixel over a background. Returns plain RGB. */
const blendRgba = (fg: Pixel, bg: RGB): RGB => {
  /* istanbul ignore if — defensive: callers pre-filter null fg */
  if (!fg) return bg;
  const a = 'a' in fg ? clamp(fg.a, 0, 1) : 1;
  if (a >= 1) return { r: clampByte(fg.r), g: clampByte(fg.g), b: clampByte(fg.b) };
  if (a <= 0) return bg;
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
  };
};

// ─────────────────────────────────────────────
//  ANSI escape cache — bounded LRU
//
//  Packing RGB into a 24-bit int gives a 16M-entry theoretical max.
//  In practice sprites use <1024 distinct colors. Cap and evict FIFO.
// ─────────────────────────────────────────────
const _fgCache = new Map<number, string>();
const _bgCache = new Map<number, string>();
const _CACHE_MAX = 1024;

const rgbKey = (r: number, g: number, b: number): number =>
  ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);

const cachedFg = (r: number, g: number, b: number): string => {
  const k = rgbKey(r, g, b);
  let s = _fgCache.get(k);
  if (s === undefined) {
    s = fgRgb(r, g, b);
    /* istanbul ignore next — LRU eviction triggers after 1024 distinct colors */
    if (_fgCache.size >= _CACHE_MAX) {
      const first = _fgCache.keys().next().value;
      if (first !== undefined) _fgCache.delete(first);
    }
    _fgCache.set(k, s);
  }
  return s;
};

const cachedBg = (r: number, g: number, b: number): string => {
  const k = rgbKey(r, g, b);
  let s = _bgCache.get(k);
  if (s === undefined) {
    s = bgRgbCode(r, g, b);
    /* istanbul ignore next — LRU eviction triggers after 1024 distinct colors */
    if (_bgCache.size >= _CACHE_MAX) {
      const first = _bgCache.keys().next().value;
      if (first !== undefined) _bgCache.delete(first);
    }
    _bgCache.set(k, s);
  }
  return s;
};

/** Clear the ANSI escape caches. Useful for tests or after large palette changes. */
export const clearAnsiCache = (): void => {
  _fgCache.clear();
  _bgCache.clear();
};

// ─────────────────────────────────────────────
//  Pixel → RGB normalization (for rendering)
//
//  A null pixel is treated as transparent → black background.
//  An RGBA pixel pre-blends against black for a sensible visual default
//  (or against a passed background in canvas operations).
// ─────────────────────────────────────────────
const toRgb = (p: Pixel, bg: RGB = { r: 0, g: 0, b: 0 }): RGB => {
  if (!p) return bg;
  if ('a' in p && p.a < 1) return blendRgba(p, bg);
  return { r: clampByte(p.r), g: clampByte(p.g), b: clampByte(p.b) };
};

// ─────────────────────────────────────────────
//  Stateful renderer — only emit ANSI when color changes
// ─────────────────────────────────────────────

export interface RenderOptions {
  scale?: number;
  halfBlock?: boolean;
  /** Use braille (2×4 sub-char resolution). Overrides halfBlock. */
  braille?: boolean;
}

const ensurePixelGrid = (pixels: unknown): PixelGrid | null => {
  if (!Array.isArray(pixels)) return null;
  // Each row should also be an array — filter out malformed rows
  return pixels.map((row) => (Array.isArray(row) ? row : [])) as PixelGrid;
};

/**
 * Render a 2D grid of pixels (`{r, g, b, a?}` objects) as terminal output
 * using half-block characters (`▀`) to fit two vertical pixels per row.
 * This doubles vertical resolution compared to one-character-per-pixel.
 *
 * @param pixels - 2D grid of pixel objects.
 * @param opts   - Render options (scale, background, etc.).
 *
 * @example basic pixel art
 * ```js
 * import { renderPixelArt } from 'ansimax';
 *
 * const heart = [
 *   [null, {r:255,g:0,b:0}, null, {r:255,g:0,b:0}, null],
 *   [{r:255,g:0,b:0}, {r:255,g:0,b:0}, {r:255,g:0,b:0}, {r:255,g:0,b:0}, {r:255,g:0,b:0}],
 *   [{r:255,g:0,b:0}, {r:255,g:0,b:0}, {r:255,g:0,b:0}, {r:255,g:0,b:0}, {r:255,g:0,b:0}],
 *   [null, {r:255,g:0,b:0}, {r:255,g:0,b:0}, {r:255,g:0,b:0}, null],
 *   [null, null, {r:255,g:0,b:0}, null, null],
 * ];
 *
 * console.log(renderPixelArt(heart));
 * ```
 *
 * @example with scale (each pixel rendered as multiple chars)
 * ```js
 * console.log(renderPixelArt(myPixels, { scale: 2 }));
 * // Each pixel becomes 2x2 in the output
 * ```
 *
 * @example with background color (transparent pixels show through)
 * ```js
 * console.log(renderPixelArt(myPixels, {
 *   background: { r: 30, g: 30, b: 30 },
 * }));
 * ```
 *
 * @example combined with a sprite from SPRITES
 * ```js
 * import { renderPixelArt, SPRITES } from 'ansimax';
 *
 * console.log(renderPixelArt(SPRITES.heart.pixels, { scale: 3 }));
 * ```
 */
export const renderPixelArt = (
  pixels: PixelGrid,
  opts: RenderOptions = {},
): string => {
  const grid = ensurePixelGrid(pixels);
  if (!grid || grid.length === 0) return '';

  const { scale = 1, halfBlock = true, braille = false } = opts;
  const safeScale = clampInt(scale, 1, 100, 1);

  if (braille) return _renderBraille(grid);

  const lines: string[] = [];

  if (halfBlock) {
    for (let row = 0; row < grid.length; row += 2) {
      const topRow = grid[row] ?? [];
      const botRow = grid[row + 1] ?? [];
      const colCount = Math.max(topRow.length, botRow.length);

      let line = '';
      let curFg: number = -1;
      let curBg: number = -1;

      for (let col = 0; col < colCount; col++) {
        const top = topRow[col] ?? null;
        const bot = botRow[col] ?? null;

        if (!top && !bot) {
          // Transparent cell — flush state and emit space
          if (curFg !== -1 || curBg !== -1) {
            line += reset();
            curFg = -1; curBg = -1;
          }
          line += ' '.repeat(safeScale);
          continue;
        }

        let fgRgbVal: RGB | null = null;
        let bgRgbVal: RGB | null = null;
        let glyph = FULL_BLOCK;

        if (top && bot) {
          fgRgbVal = toRgb(top);
          bgRgbVal = toRgb(bot);
          glyph = UPPER_HALF;
        } else if (top) {
          fgRgbVal = toRgb(top);
          glyph = FULL_BLOCK;
        } else {
          fgRgbVal = toRgb(bot as Pixel);
          glyph = LOWER_HALF;
        }

        // State diff — only emit escapes when colors change
        const fgKey = fgRgbVal ? rgbKey(fgRgbVal.r, fgRgbVal.g, fgRgbVal.b) : -1;
        const bgKey = bgRgbVal ? rgbKey(bgRgbVal.r, bgRgbVal.g, bgRgbVal.b) : -1;

        if (fgKey !== curFg && fgRgbVal) {
          line += cachedFg(fgRgbVal.r, fgRgbVal.g, fgRgbVal.b);
          curFg = fgKey;
        }
        if (bgKey !== curBg) {
          if (bgRgbVal) {
            line += cachedBg(bgRgbVal.r, bgRgbVal.g, bgRgbVal.b);
            curBg = bgKey;
          } else if (curBg !== -1) {
            // Background cleared — need a reset to remove old bg
            line += reset();
            curFg = -1; curBg = -1;
            // Re-emit fg
            if (fgRgbVal) {
              line += cachedFg(fgRgbVal.r, fgRgbVal.g, fgRgbVal.b);
              curFg = fgKey;
            }
          }
        }

        line += glyph.repeat(safeScale);
      }
      // End-of-line reset
      if (curFg !== -1 || curBg !== -1) line += reset();
      lines.push(line);
    }
  } else {
    // Full-block mode
    for (const row of grid) {
      let line = '';
      let curFg: number = -1;

      for (const pixel of row) {
        if (!pixel) {
          if (curFg !== -1) { line += reset(); curFg = -1; }
          line += ' '.repeat(safeScale);
          continue;
        }
        const rgb = toRgb(pixel);
        const k = rgbKey(rgb.r, rgb.g, rgb.b);
        if (k !== curFg) {
          line += cachedFg(rgb.r, rgb.g, rgb.b);
          curFg = k;
        }
        line += FULL_BLOCK.repeat(safeScale);
      }
      if (curFg !== -1) line += reset();
      lines.push(line);
    }
  }
  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Braille renderer — 2×4 sub-pixel resolution
// ─────────────────────────────────────────────

const BRAILLE_BITS: number[][] = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

const _renderBraille = (pixels: PixelGrid): string => {
  const lines: string[] = [];
  const rows = pixels.length;
  /* istanbul ignore if — defensive: empty-grid case handled at renderPixelArt entry */
  if (rows === 0) return '';
  const cols = Math.max(0, ...pixels.map((r) => r.length));

  for (let by = 0; by < rows; by += 4) {
    let line = '';
    let curFg = -1;

    for (let bx = 0; bx < cols; bx += 2) {
      let bits = 0;
      let rSum = 0, gSum = 0, bSum = 0, count = 0;

      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const px = pixels[by + dy]?.[bx + dx];
          if (px) {
            bits |= (BRAILLE_BITS[dy] as number[])[dx] as number;
            const rgb = toRgb(px);
            rSum += rgb.r; gSum += rgb.g; bSum += rgb.b; count++;
          }
        }
      }

      if (bits === 0 || count === 0) {
        if (curFg !== -1) { line += reset(); curFg = -1; }
        line += ' ';
        continue;
      }

      const r = Math.round(rSum / count);
      const g = Math.round(gSum / count);
      const b = Math.round(bSum / count);
      const k = rgbKey(r, g, b);
      if (k !== curFg) { line += cachedFg(r, g, b); curFg = k; }
      line += String.fromCodePoint(0x2800 + bits);
    }

    if (curFg !== -1) line += reset();
    lines.push(line);
  }
  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Built-in sprites
// ─────────────────────────────────────────────
const R: Pixel = { r: 255, g: 0,   b: 0   };
const Y: Pixel = { r: 255, g: 220, b: 0   };
const G: Pixel = { r: 255, g: 215, b: 0   };
const K: Pixel = { r: 0,   g: 0,   b: 0   };
const N: Pixel = null;

/**
 * Built-in sprite library — small pre-defined pixel art ready for use.
 *
 * Each entry has a `pixels` property containing a `PixelGrid`.
 *
 * Currently available: `heart`, `star`, `arrow`, `check`, `x`, `bell`,
 * `gear`, `bolt`, `flag`, `crown`.
 *
 * @example render a built-in sprite
 * ```js
 * import { renderPixelArt, SPRITES } from 'ansimax';
 *
 * console.log(renderPixelArt(SPRITES.heart.pixels));
 * console.log(renderPixelArt(SPRITES.star.pixels, { scale: 2 }));
 * ```
 *
 * @example list all available sprites
 * ```js
 * console.log('Available sprites:', Object.keys(SPRITES).join(', '));
 * ```
 *
 * @example compose sprites on a canvas
 * ```js
 * import { createCanvas, SPRITES } from 'ansimax';
 *
 * const canvas = createCanvas(30, 10);
 * canvas.drawSprite(2,  2, SPRITES.heart.pixels);
 * canvas.drawSprite(10, 2, SPRITES.star.pixels);
 * canvas.drawSprite(18, 2, SPRITES.crown.pixels);
 * canvas.print();
 * ```
 */
export const SPRITES: Record<string, { pixels: PixelGrid }> = {
  heart: { pixels: [
    [N,R,N,R,N],
    [R,R,R,R,R],
    [R,R,R,R,R],
    [N,R,R,R,N],
    [N,N,R,N,N],
  ]},
  star: { pixels: [
    [N,G,N,G,N],
    [G,G,G,G,G],
    [N,G,G,G,N],
    [G,N,G,N,G],
    [N,N,G,N,N],
  ]},
  smiley: { pixels: [
    [N,Y,Y,Y,N],
    [Y,K,Y,K,Y],
    [Y,Y,Y,Y,Y],
    [Y,K,Y,K,Y],
    [N,Y,Y,Y,N],
  ]},
  pacman: { pixels: [
    [N,Y,Y,Y,N],
    [Y,Y,Y,N,N],
    [Y,Y,N,N,N],
    [Y,Y,Y,N,N],
    [N,Y,Y,Y,N],
  ]},
};

// ─────────────────────────────────────────────
//  Sprite transforms — defensive against malformed grids
// ─────────────────────────────────────────────
export const flipHorizontal = (pixels: PixelGrid): PixelGrid => {
  const grid = ensurePixelGrid(pixels);
  if (!grid) return [];
  return grid.map((row) => [...row].reverse());
};

export const flipVertical = (pixels: PixelGrid): PixelGrid => {
  const grid = ensurePixelGrid(pixels);
  if (!grid) return [];
  return [...grid].reverse();
};

export const rotate90 = (pixels: PixelGrid): PixelGrid => {
  const grid = ensurePixelGrid(pixels);
  if (!grid || grid.length === 0) return [];
  const rows = grid.length;
  // Use the WIDEST row to determine column count — safe for irregular grids
  const cols = Math.max(0, ...grid.map((r) => r.length));
  if (cols === 0) return [];
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (__, r) => grid[rows - 1 - r]?.[c] ?? null),
  );
};

// ─────────────────────────────────────────────
//  Gradient rectangle
// ─────────────────────────────────────────────

// 4×4 Bayer matrix normalized to [0, 1)
const BAYER_4x4 = [
  [ 0/16,  8/16,  2/16, 10/16],
  [12/16,  4/16, 14/16,  6/16],
  [ 3/16, 11/16,  1/16,  9/16],
  [15/16,  7/16, 13/16,  5/16],
];

export interface GradientRectOptions {
  width?: number;
  height?: number;
  colors?: string[];
  /** Built-in style. Use `angle` for arbitrary directions. */
  style?: 'horizontal' | 'vertical' | 'diagonal' | 'radial' | 'conic';
  /** Custom angle in degrees (0=right, 90=down). Overrides `style`. */
  angle?: number;
  /**
   * Starting angle (degrees) for conic gradients. Default `0` (= right of center).
   * Rotates the radial sweep around the center point.
   */
  startAngle?: number;
  /** Dithering algorithm. 'bayer' improves perceived smoothness. */
  dither?: 'none' | 'bayer';
  /** Render in braille mode for 2× horizontal × 4× vertical resolution. */
  braille?: boolean;
}

/**
 * Render a rectangle filled with a multi-color gradient. Supports horizontal,
 * vertical, diagonal, arbitrary-angle, radial, and conic gradient styles.
 *
 * @param opts - Configuration: dimensions, colors, style, dithering.
 *
 * @example horizontal gradient (default)
 * ```js
 * import { gradientRect } from 'ansimax';
 *
 * console.log(gradientRect({
 *   width: 40, height: 10,
 *   colors: ['#ff0000', '#0000ff'],
 * }));
 * ```
 *
 * @example vertical gradient with multiple stops
 * ```js
 * console.log(gradientRect({
 *   width: 30, height: 15,
 *   colors: ['#ff0000', '#ffff00', '#00ff00', '#0000ff'],
 *   style: 'vertical',
 * }));
 * ```
 *
 * @example arbitrary angle (45° = bottom-left to top-right)
 * ```js
 * console.log(gradientRect({
 *   width: 40, height: 20,
 *   colors: ['#bd93f9', '#ff79c6'],
 *   style: 'diagonal',
 *   angle: 45,
 * }));
 * ```
 *
 * @example radial gradient (center to edge)
 * ```js
 * console.log(gradientRect({
 *   width: 30, height: 15,
 *   colors: ['#ffffff', '#000000'],
 *   style: 'radial',
 * }));
 * ```
 *
 * @example conic (rainbow wheel) — v1.2.0+
 * ```js
 * console.log(gradientRect({
 *   width: 30, height: 15,
 *   colors: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
 *   style: 'conic',
 *   startAngle: 0,
 * }));
 * ```
 *
 * @example with Bayer dithering for smoother tonal transitions
 * ```js
 * console.log(gradientRect({
 *   width: 60, height: 20,
 *   colors: ['#000033', '#ffcc00'],
 *   dither: 'bayer',
 * }));
 * ```
 *
 * @example braille mode (4× vertical resolution per cell)
 * ```js
 * console.log(gradientRect({
 *   width: 60, height: 30,
 *   colors: ['#ff0000', '#0000ff'],
 *   braille: true,
 * }));
 * ```
 */
export const gradientRect = (opts: GradientRectOptions = {}): string => {
  const {
    width  = 40,
    height = 10,
    colors = ['#ff0000', '#0000ff'],
    style  = 'horizontal',
    angle,
    startAngle = 0,
    dither = 'none',
    braille = false,
  } = opts;

  // Filter & validate stops
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new TypeError('gradientRect: colors must be a non-empty array');
  }
  const stops = colors.map(safeHex).filter((c): c is RGB => c !== null);
  if (stops.length === 0) {
    throw new Error('gradientRect: no valid hex color stops provided');
  }
  // Single stop → render solid fill (consistent with `gradient()` single-stop UX)
  if (stops.length === 1) {
    const safeW = clampInt(width,  2, MAX_DIMENSION, 40);
    const safeH = clampInt(height, 2, MAX_DIMENSION, 10);
    const pixels: PixelGrid = Array.from({ length: safeH }, () =>
      Array.from({ length: safeW }, () => stops[0] as Pixel),
    );
    return renderPixelArt(pixels, { halfBlock: !braille, braille });
  }

  const safeW = clampInt(width,  2, MAX_DIMENSION, 40);
  const safeH = clampInt(height, 2, MAX_DIMENSION, 10);

  // If angle is set, derive the direction vector
  let cosA = 1, sinA = 0;
  if (isFiniteNumber(angle)) {
    const rad = (angle * Math.PI) / 180;
    cosA = Math.cos(rad);
    sinA = Math.sin(rad);
  }

  const pixels: PixelGrid = [];

  for (let row = 0; row < safeH; row++) {
    const line: Pixel[] = [];
    for (let col = 0; col < safeW; col++) {
      let t: number;
      if (isFiniteNumber(angle)) {
        const projection = (col / (safeW - 1)) * cosA + (row / (safeH - 1)) * sinA;
        t = clamp((projection + 1) / 2, 0, 1);
      } else if (style === 'horizontal') t = col / (safeW - 1);
      else if (style === 'vertical')     t = row / (safeH - 1);
      else if (style === 'diagonal')     t = (col + row) / (safeW + safeH - 2);
      else if (style === 'conic') {
        // Conic gradient: sweep radially around center
        const cx = safeW / 2, cy = safeH / 2;
        const dx = col - cx;
        const dy = row - cy;
        // atan2 returns [-PI, PI] — normalize to [0, 1] starting from startAngle
        const startRad = (Number.isFinite(startAngle) ? startAngle : 0) * Math.PI / 180;
        let angleRad = Math.atan2(dy, dx) - startRad;
        // Normalize to [0, 2*PI)
        angleRad = ((angleRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        t = angleRad / (2 * Math.PI);
      }
      else {
        // Radial (default)
        const cx = safeW / 2, cy = safeH / 2;
        const dx = (col - cx) / cx;
        const dy = (row - cy) / cy;
        t = clamp(Math.sqrt(dx * dx + dy * dy) / Math.SQRT2, 0, 1);
      }

      // Apply Bayer dithering by perturbing t with a threshold matrix
      if (dither === 'bayer') {
        const threshold = (BAYER_4x4[row & 3] as number[])[col & 3] as number;
        const step = 1 / Math.max(1, stops.length - 1);
        t = clamp(t + (threshold - 0.5) * step * 0.5, 0, 1);
      }

      const scaled = t * (stops.length - 1);
      const lo     = Math.floor(scaled);
      const hi     = Math.min(lo + 1, stops.length - 1);
      line.push(lerpColor(stops[lo] as RGB, stops[hi] as RGB, scaled - lo));
    }
    pixels.push(line);
  }
  return renderPixelArt(pixels, { scale: 1, halfBlock: !braille, braille });
};

// ─────────────────────────────────────────────
//  Canvas — defensive everywhere
// ─────────────────────────────────────────────

export interface CanvasRenderOptions extends RenderOptions {
  /** Render only the dirty region instead of the whole canvas. Default: false. */
  dirtyOnly?: boolean;
}

export interface Canvas {
  set:        (x: number, y: number, color: Pixel) => void;
  get:        (x: number, y: number) => Pixel;
  fill:       (color: Pixel) => void;
  drawRect:   (x: number, y: number, w: number, h: number, color: Pixel, fill?: boolean) => void;
  drawCircle: (cx: number, cy: number, radius: number, color: Pixel, fill?: boolean) => void;
  /** Composite a sprite at (x, y) with optional alpha blending. */
  drawSprite: (x: number, y: number, sprite: PixelGrid) => void;
  render:     (opts?: CanvasRenderOptions) => string;
  print:      (opts?: CanvasRenderOptions) => void;
  /** Resize the canvas, preserving content within the new bounds. */
  resize:     (newWidth: number, newHeight: number, fillColor?: Pixel) => void;
  /** Mark all pixels as dirty (forces full redraw on next dirtyOnly render). */
  markDirty:  () => void;
  /** Clear the dirty region tracker (after a full render). */
  clearDirty: () => void;
  width:      number;
  height:     number;
  /** Deep copy of the current pixel grid. Mutations don't affect the canvas. */
  pixels:     PixelGrid;
}

/**
 * Create a mutable in-memory canvas with drawing primitives (line, rect,
 * circle, sprite). The canvas tracks dirty regions so subsequent renders
 * can update only changed pixels (useful for animation).
 *
 * @param width     - Canvas width in pixels (1 to MAX_DIMENSION).
 * @param height    - Canvas height in pixels (1 to MAX_DIMENSION).
 * @param fillColor - Initial fill (`null` for transparent). Default `null`.
 * @returns A Canvas object with drawing methods.
 *
 * @example draw and render a simple scene
 * ```js
 * import { createCanvas } from 'ansimax';
 *
 * const canvas = createCanvas(40, 20, { r: 20, g: 20, b: 30 });
 *
 * canvas.drawRect(5, 5, 30, 10, { r: 100, g: 200, b: 255 }, true);
 * canvas.drawCircle(20, 10, 4, { r: 255, g: 200, b: 0 }, true);
 * canvas.drawLine(0, 0, 39, 19, { r: 255, g: 0, b: 100 });
 *
 * canvas.print();  // render and write to stdout
 * ```
 *
 * @example animated frame with dirty-region tracking
 * ```js
 * const canvas = createCanvas(60, 30);
 *
 * for (let frame = 0; frame < 100; frame++) {
 *   canvas.setPixel(frame % 60, 15, { r: 255, g: 0, b: 0 });
 *
 *   // Only re-render changed pixels (much faster than full redraw)
 *   process.stdout.write(canvas.render({ dirtyOnly: true }));
 *   await new Promise(r => setTimeout(r, 50));
 * }
 * ```
 *
 * @example composite sprites
 * ```js
 * import { createCanvas, SPRITES } from 'ansimax';
 *
 * const canvas = createCanvas(40, 20);
 * canvas.drawSprite(5, 5, SPRITES.heart.pixels);
 * canvas.drawSprite(20, 5, SPRITES.star.pixels);
 * canvas.print();
 * ```
 *
 * @example resize while preserving content
 * ```js
 * const canvas = createCanvas(20, 10, { r: 50, g: 50, b: 50 });
 * canvas.drawCircle(10, 5, 3, { r: 255, g: 0, b: 0 });
 *
 * canvas.resize(40, 20);  // existing pixels remain in upper-left
 * canvas.print();
 * ```
 */
export const createCanvas = (
  width: number,
  height: number,
  fillColor: Pixel = null,
): Canvas => {
  let w = clampInt(width,  1, MAX_DIMENSION, 1);
  let h = clampInt(height, 1, MAX_DIMENSION, 1);

  // Clone fill color so caller mutations don't leak into the canvas
  const cloneColor = (c: Pixel): Pixel => {
    if (!c) return null;
    return 'a' in c
      ? { r: c.r, g: c.g, b: c.b, a: c.a }
      : { r: c.r, g: c.g, b: c.b };
  };

  /** Deep clone the entire pixel grid. */
  const clonePixels = (src: PixelGrid): PixelGrid =>
    src.map((row) => row.map(cloneColor));

  let pixels: PixelGrid = Array.from({ length: h }, () =>
    Array.from({ length: w }, () => cloneColor(fillColor)),
  );

  // Dirty rectangle — minX/minY/maxX/maxY of changes since last render
  let dirtyMinX = Infinity;
  let dirtyMinY = Infinity;
  let dirtyMaxX = -Infinity;
  let dirtyMaxY = -Infinity;

  const markPixelDirty = (x: number, y: number): void => {
    if (x < dirtyMinX) dirtyMinX = x;
    if (y < dirtyMinY) dirtyMinY = y;
    if (x > dirtyMaxX) dirtyMaxX = x;
    if (y > dirtyMaxY) dirtyMaxY = y;
  };

  const setInternal = (x: number, y: number, color: Pixel): void => {
    // Defensive: reject non-finite coords
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (iy < 0 || iy >= h || ix < 0 || ix >= w) return;
    pixels[iy]![ix] = cloneColor(color);
    markPixelDirty(ix, iy);
  };

  const canvas: Canvas = {
    width: w, height: h,
    get pixels() { return clonePixels(pixels); },

    set: setInternal,

    get(x, y) {
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) return null;
      const ix = Math.floor(x), iy = Math.floor(y);
      return cloneColor(pixels[iy]?.[ix] ?? null);
    },

    fill(color) {
      const cloned = cloneColor(color);
      for (let y = 0; y < h; y++) {
        const row = pixels[y] as Pixel[];
        for (let x = 0; x < w; x++) row[x] = cloned ? cloneColor(cloned) : null;
      }
      // Whole canvas is dirty
      dirtyMinX = 0; dirtyMinY = 0;
      dirtyMaxX = w - 1; dirtyMaxY = h - 1;
    },

    drawRect(x, y, rw, rh, color, fill = false) {
      // Defensive — non-finite coords/dims = no-op
      if (!isFiniteNumber(x) || !isFiniteNumber(y) ||
          !isFiniteNumber(rw) || !isFiniteNumber(rh)) return;
      // Negative or zero dims = no-op
      if (rw <= 0 || rh <= 0) return;

      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const irw = Math.floor(rw);
      const irh = Math.floor(rh);

      // Pre-clip iteration bounds — saves bounds checks
      const x0 = Math.max(0, ix);
      const y0 = Math.max(0, iy);
      const x1 = Math.min(w, ix + irw);
      const y1 = Math.min(h, iy + irh);
      const cloned = cloneColor(color);

      for (let dy = y0; dy < y1; dy++) {
        for (let dx = x0; dx < x1; dx++) {
          const onBorder =
            dy === iy || dy === iy + irh - 1 ||
            dx === ix || dx === ix + irw - 1;
          if (fill || onBorder) {
            pixels[dy]![dx] = cloned ? cloneColor(cloned) : null;
            markPixelDirty(dx, dy);
          }
        }
      }
    },

    drawCircle(cx, cy, radius, color, fill = false) {
      if (!isFiniteNumber(cx) || !isFiniteNumber(cy) || !isFiniteNumber(radius)) return;
      if (radius <= 0) return;

      // Pre-clip iteration bounds to the circle's bounding box
      const x0 = Math.max(0, Math.floor(cx - radius - 1));
      const y0 = Math.max(0, Math.floor(cy - radius - 1));
      const x1 = Math.min(w, Math.ceil(cx + radius + 1));
      const y1 = Math.min(h, Math.ceil(cy + radius + 1));

      const r2     = radius * radius;
      const rOut2  = (radius + 0.7) ** 2;
      const rIn2   = Math.max(0, (radius - 0.7) ** 2);
      const cloned = cloneColor(color);

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const dx = x - cx, dy = y - cy;
          const d2 = dx * dx + dy * dy;
          const hit = fill ? d2 <= r2 : (d2 >= rIn2 && d2 <= rOut2);
          if (hit) {
            pixels[y]![x] = cloned ? cloneColor(cloned) : null;
            markPixelDirty(x, y);
          }
        }
      }
    },

    drawSprite(x, y, sprite) {
      /* istanbul ignore next — defensive: NaN coords already covered, but kept for safety */
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) return;
      if (!Array.isArray(sprite)) return;

      const sx = Math.floor(x);
      const sy = Math.floor(y);
      for (let row = 0; row < sprite.length; row++) {
        const srcRow = sprite[row];
        if (!Array.isArray(srcRow)) continue;
        for (let col = 0; col < srcRow.length; col++) {
          const px = srcRow[col];
          if (!px) continue; // null = transparent
          const dx = sx + col, dy = sy + row;
          if (dx < 0 || dx >= w || dy < 0 || dy >= h) continue;
          // Alpha-blend if sprite pixel has alpha
          if ('a' in px && px.a < 1) {
            const bg = toRgb(pixels[dy]![dx] ?? null);
            pixels[dy]![dx] = blendRgba(px, bg);
          } else {
            pixels[dy]![dx] = cloneColor(px);
          }
          markPixelDirty(dx, dy);
        }
      }
    },

    render(opts: CanvasRenderOptions = {}) {
      const { dirtyOnly = false, ...renderOpts } = opts;
      if (!dirtyOnly || dirtyMinX === Infinity) {
        return renderPixelArt(pixels, renderOpts);
      }
      // Render only the dirty rectangle as a mini-grid
      const sub: PixelGrid = [];
      for (let y = dirtyMinY; y <= dirtyMaxY; y++) {
        const row = pixels[y] as Pixel[];
        sub.push(row.slice(dirtyMinX, dirtyMaxX + 1));
      }
      return renderPixelArt(sub, renderOpts);
    },

    print(opts = {}) {
      try { write(this.render(opts) + '\n'); }
      catch { /* stream torn down */ }
    },

    resize(newW, newH, newFillColor = null) {
      const targetW = clampInt(newW, 1, MAX_DIMENSION, w);
      const targetH = clampInt(newH, 1, MAX_DIMENSION, h);
      const cloned = cloneColor(newFillColor);

      const newPixels: PixelGrid = Array.from({ length: targetH }, (_, y) =>
        Array.from({ length: targetW }, (__, x) => {
          // Preserve content within bounds
          if (y < h && x < w) return cloneColor(pixels[y]?.[x] ?? null);
          return cloneColor(cloned);
        }),
      );

      pixels = newPixels;
      w = targetW;
      h = targetH;
      canvas.width = w;
      canvas.height = h;
      // Mark whole canvas dirty
      dirtyMinX = 0; dirtyMinY = 0;
      dirtyMaxX = w - 1; dirtyMaxY = h - 1;
    },

    markDirty() {
      dirtyMinX = 0; dirtyMinY = 0;
      dirtyMaxX = w - 1; dirtyMaxY = h - 1;
    },

    clearDirty() {
      dirtyMinX = Infinity; dirtyMinY = Infinity;
      dirtyMaxX = -Infinity; dirtyMaxY = -Infinity;
    },
  };

  return canvas;
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export const images = {
  render:         renderPixelArt,
  sprites:        SPRITES,
  flipHorizontal,
  flipVertical,
  rotate90,
  sprite(name: string, opts: RenderOptions = {}): string {
    const s = SPRITES[name];
    if (!s) throw new Error(`Sprite "${name}" not found. Available: ${Object.keys(SPRITES).join(', ')}`);
    return renderPixelArt(s.pixels, opts);
  },
  gradientRect,
  createCanvas,
  // Color utilities exposed for advanced users
  colors: {
    hex: safeHex,
    lerp: lerpColor,
    blend: blendRgba,
  },
  // Cache control
  clearAnsiCache,
};

export default images;
