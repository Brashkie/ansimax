// ─────────────────────────────────────────────
//  ansimax/ascii — Public types
//
//  v1.4.10 — Extracted from index.ts during the module split.
// ─────────────────────────────────────────────

import type { ColorFn } from '../colors/index.js';

/** A glyph is an array of equal-length strings (one per row). */
export type Glyph = string[];

/** Maps a character to its glyph. Every font must define ' ' or '?'. */
export type FontMap = Record<string, Glyph>;

/** Built-in font name. */
export type FontName = 'big' | 'small';

export type BoxStyle = 'single' | 'double' | 'rounded' | 'heavy' | 'dashed' | 'ascii';

export interface BoxOptions {
  padding?: number;
  borderStyle?: BoxStyle;
  /** Fix inner content width. Lines are padded/truncated to fit. */
  width?: number | null;
  /**
   * Optional title shown in the top border, e.g. `─ Title ─────`.
   * When set, the box expands to fit the title if content is narrower.
   *
   * @since 1.3.3
   */
  title?: string | null;
  /**
   * Title alignment in the top border: `'left'` | `'center'` (default) | `'right'`.
   * Only applies when `title` is set.
   *
   * @since 1.3.3
   */
  titleAlign?: 'left' | 'center' | 'right';
}

export interface BannerOptions {
  font?: FontName | string;
  colorFn?: ColorFn | null;
  /** Apply colorFn per-character instead of per-line (true gradients). */
  perCharColor?: boolean;
  align?: 'left' | 'center';
  /** Spaces between glyphs (default: 1). */
  letterSpacing?: number;
}

export interface DividerOptions {
  char?: string;
  width?: number | null;
  label?: string | null;
  style?: BoxStyle;
  /**
   * Label alignment: `'left'` | `'center'` (default) | `'right'`.
   * Only applies when `label` is set.
   *
   * @since 1.3.3
   */
  align?: 'left' | 'center' | 'right';
}

export interface LogoOptions {
  gradient?: ColorFn | null;
  boxStyle?: BoxStyle;
  /** Center the rendered ASCII inside the box (default: true). */
  centered?: boolean;
}

export interface RegisterFontOptions {
  /** Allow overwriting reserved built-in fonts (big, small). Default: false. */
  force?: boolean;
}

export interface Dimensions { width: number; height: number }

export interface StreamOptions {
  /** Font name to use. Default: 'big'. */
  font?: FontName | string;
  /** Spaces between glyphs. Default: 1. */
  letterSpacing?: number;
  /** Stream granularity: 'row' yields one line at a time, 'char' yields one char. */
  granularity?: 'row' | 'char';
  /** Abort signal — stops yielding when triggered. */
  signal?: AbortSignal;
}

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
export interface FromImageOptions {
  /** Output character width. Default `80`. Aspect ratio is preserved. */
  width?: number;
  /**
   * Output character height. If omitted, computed from `width` and source
   * aspect ratio (with a 0.5 vertical correction for typical terminal cells
   * which are ~2x as tall as wide).
   */
  height?: number;
  /** Character ramp (dark → light). Default `'standard'`. A named ramp
   *  (`'standard'`, `'simple'`, `'blocks'`, …) or a custom character string. */
  ramp?: string;
  /** Invert luminance (dark areas become bright chars). */
  invert?: boolean;
  /**
   * Apply dithering for better tonal range.
   * - `'none'` (default) — direct mapping
   * - `'floyd-steinberg'` — error diffusion, better for photos
   */
  dither?: 'none' | 'floyd-steinberg';
  /**
   * Edge detection mode. Renders edges as the brightest chars.
   * - `'none'` (default)
   * - `'sobel'` — classical 3x3 Sobel operator
   */
  edgeDetect?: 'none' | 'sobel';
  /** Sobel threshold (only when `edgeDetect: 'sobel'`). Default `40`. */
  edgeThreshold?: number;
  /**
   * Render in color. When `true`, each char is colored with the average
   * color of its source pixel. Default `false` (monochrome).
   */
  color?: boolean;
  /**
   * Use face-optimized rendering. Applies histogram stretching to enhance
   * midtone detail (where faces typically live). Best for portrait input.
   */
  faceMode?: boolean;
  /**
   * Render the source pixel's color as the **background** instead of the
   * foreground. Useful when paired with `ramp: 'binary'` for a photo-like
   * effect where chars become "pixels". Default `false`.
   *
   * Implies `color: true` — does not need to be set separately.
   *
   * @since 1.2.6
   */
  bgColor?: boolean;
  /**
   * Brightness adjustment applied to luminance before quantization.
   * Range `[-1, 1]`. `0` = no change, `0.2` = lighter, `-0.2` = darker.
   * Default `0`.
   *
   * @since 1.2.6
   */
  brightness?: number;
  /**
   * Contrast adjustment applied to luminance before quantization.
   * Range `[-1, 1]`. `0` = no change, `0.5` = boosted, `-0.5` = flattened.
   * Default `0`.
   *
   * @since 1.2.6
   */
  contrast?: number;
}

/** A parsed FIGfont — opaque to the user; pass to `ascii.figlet()`. */
export interface FigletFont {
  /** Font hardblank character (used as a space inside glyphs). */
  hardblank: string;
  /** Glyph height in rows. */
  height: number;
  /** Map from ASCII codepoint → glyph rows. */
  glyphs: Map<number, string[]>;
}

/**
 * Render text using a parsed FIGfont (.flf).
 * Unknown characters render as a space-equivalent.
 *
 * @example
 * ```ts
 * import { readFileSync } from 'node:fs';
 * import { parseFiglet, ascii } from 'ansimax';
 *
 * const font = parseFiglet(readFileSync('./big.flf', 'utf8'));
 * console.log(ascii.figlet('NICE', font));
 * ```
 */
export interface FigletOptions {
  /** Trim leading/trailing blank rows. Default `true`. */
  trim?: boolean;
  /** Color function applied to the assembled output. */
  colorFn?: ColorFn | null;
  /**
   * Extra spacing (in characters) inserted between each glyph.
   * `0` = touching glyphs, `1` = one-space gap, etc. Default `0`.
   *
   * @since 1.2.6
   */
  kerning?: number;
  /**
   * Vertical spacing (blank lines) between rendered lines when `text`
   * contains `\n`. Default `0`.
   *
   * @since 1.2.6
   */
  lineSpacing?: number;
}
