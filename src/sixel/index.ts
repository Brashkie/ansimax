/**
 * ansimax/sixel — the DEC Sixel graphics format, Phase 12.
 *
 * Sixel is the one inline-image format that is an open published standard
 * (DEC VT240 onward, now in xterm, mlterm, foot, WezTerm, Windows Terminal
 * and others), which is why it gets a real encoder here while the vendor
 * protocols in `src/images/protocols.ts` stay opt-in: this is an algorithm,
 * not a vendor escape hatch.
 *
 * The format works in horizontal bands six pixels tall. One character carries
 * six vertical pixels as a bitmask, offset by `?` (0x3F), so `?` is six empty
 * pixels and `~` is six set ones. A band is written once per colour present
 * in it, with `$` returning to the band's start to overlay the next colour
 * and `-` moving down to the next band.
 *
 * ```text
 *   \x1bP0;1;0q                    device control string, transparent
 *   "1;1;64;48                     raster: 1:1 aspect, 64x48 pixels
 *   #0;2;100;0;0                   register 0 = red  (RGB in percent)
 *   #0!16~$                        16 columns of six red pixels, then CR
 *   #1??~~$-                       next colour, then next band
 *   \x1b\\                         string terminator
 * ```
 *
 * @module
 * @since 1.10.0
 */

import { medianCutPalette, ditherColor } from '../ascii/image.js';
import { createPaletteMapper, clampByte } from '../utils/helpers.js';
import type { RGB } from '../utils/helpers.js';
import type { Pixel, PixelGrid } from '../images/index.js';

/** Options for {@link encodeSixel}. */
export interface SixelOptions {
  /**
   * Palette size ceiling. Sixel terminals guarantee 256 colour registers, so
   * that is the default; lower it for a smaller payload.
   */
  maxColors?: number;
  /**
   * A palette to use as given, instead of deriving one from the image. Handy
   * for keeping several frames on one palette so the terminal is not
   * redefining registers every frame.
   */
  palette?: readonly RGB[];
  /**
   * Error-diffusion kernel for mapping the image onto the palette — any name
   * {@link ditherColor} accepts. `'none'` (the default) maps each pixel to
   * its nearest entry with no diffusion, which is what you want for flat
   * graphics; a kernel is worth it for photographs at a small palette.
   */
  dither?: string;
  /**
   * Leave pixels the image marks transparent unpainted, so the terminal's
   * background shows through. Default `true`.
   */
  transparent?: boolean;
  /**
   * Alpha below this counts as transparent, 0..1. Default `0.5`.
   */
  alphaThreshold?: number;
  /**
   * Emit the raster attributes (`"Pan;Pad;Ph;Pv`). Default `true` — without
   * them a terminal cannot size the image before it starts painting, and
   * some leave trailing rows of the previous image visible.
   */
  raster?: boolean;
  /**
   * Pixel aspect ratio as `[numerator, denominator]`. Default `[1, 1]`.
   * The historical Sixel default is 2:1, which is why this is stated.
   */
  aspect?: readonly [number, number];
}

/** What {@link encodeSixel} produced, for callers who want the details. */
export interface SixelResult {
  /** The complete DCS sequence, ready to write to a Sixel terminal. */
  data: string;
  /** Image dimensions in pixels. */
  width: number;
  height: number;
  /** The palette that was actually used, one entry per colour register. */
  palette: RGB[];
  /** Bands of six rows that were emitted. */
  bands: number;
}

const DCS_START = '\x1bP';
const ST = '\x1b\\';

/** Sixel colour components are percentages, not bytes. */
const toPercent = (v: number): number => Math.round((clampByte(v) / 255) * 100);

/** The byte a channel comes back as once it has made the percent round trip. */
const snapToPercent = (v: number): number => Math.round((toPercent(v) / 100) * 255);

const alphaOf = (px: Pixel): number => {
  if (px === null || px === undefined) return 0;
  const a = (px as { a?: number }).a;
  return typeof a === 'number' && Number.isFinite(a) ? a : 1;
};

const asRgb = (px: Pixel): RGB => {
  if (px === null || px === undefined) return { r: 0, g: 0, b: 0 };
  const { r, g, b } = px as RGB;
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b) };
};


/**
 * Encode one band row of six-pixel characters, run-length compressed.
 *
 * `!Pn` repeats the next character Pn times. It costs three characters plus
 * the digits, so a run of three is break-even and only four or more is a
 * saving — compressing a pair makes the output *longer*.
 *
 * Trailing empty pixels are dropped rather than written: the band ends where
 * the data does and the terminal leaves the rest of the row alone. The cutoff
 * is found by scanning backwards, which is cheaper than emitting them and
 * stripping them off the finished string with a regex.
 */
const packRow = (codes: Uint8Array, from: number, width: number): string => {
  let end = width;
  while (end > 0 && codes[from + end - 1] === 0) end--;
  /* istanbul ignore next — unreachable: a register only reaches here once it
     is in `present`, which means at least one pixel set a bit in its plane. */
  if (end === 0) return '';

  const parts: string[] = [];
  let i = 0;
  while (i < end) {
    const code = codes[from + i] as number;
    let run = 1;
    while (i + run < end && codes[from + i + run] === code) run++;
    const ch = String.fromCharCode(0x3f + code);
    parts.push(run >= 4 ? `!${run}${ch}` : ch.repeat(run));
    i += run;
  }
  return parts.join('');
};

/**
 * Encode a pixel grid as a Sixel image.
 *
 * The palette is derived from the image with median cut in Oklab unless one
 * is supplied, then each pixel is mapped to it (optionally dithered), and the
 * result is written band by band, one pass per colour present in each band.
 *
 * @example
 * ```js
 * import { encodeSixel, detectCapabilities } from 'ansimax';
 *
 * if (detectCapabilities().imageProtocol === 'sixel') {
 *   process.stdout.write(encodeSixel(pixels, { maxColors: 64 }));
 * }
 * ```
 *
 * @throws {TypeError} `ANSIMAX_SIXEL_INPUT` — not a non-empty pixel grid.
 * @since 1.10.0
 */
export const encodeSixel = (pixels: PixelGrid, opts: SixelOptions = {}): string =>
  encodeSixelDetailed(pixels, opts).data;

/**
 * {@link encodeSixel}, but returning the palette and geometry alongside the
 * escape sequence — for reusing one palette across the frames of an
 * animation, or for reporting what the encoder decided.
 *
 * @example
 * ```js
 * import { encodeSixelDetailed, encodeSixel } from 'ansimax';
 *
 * const first = encodeSixelDetailed(frames[0], { maxColors: 32 });
 * for (const frame of frames.slice(1)) {
 *   process.stdout.write(encodeSixel(frame, { palette: first.palette }));
 * }
 * ```
 *
 * @throws {TypeError} `ANSIMAX_SIXEL_INPUT` — not a non-empty pixel grid.
 * @since 1.10.0
 */
export const encodeSixelDetailed = (
  pixels: PixelGrid,
  opts: SixelOptions = {},
): SixelResult => {
  if (!Array.isArray(pixels) || pixels.length === 0 || !Array.isArray(pixels[0])) {
    throw new TypeError('ANSIMAX_SIXEL_INPUT: encodeSixel needs a non-empty PixelGrid');
  }
  const height = pixels.length;
  let width = 0;
  for (const row of pixels) {
    if (Array.isArray(row) && row.length > width) width = row.length;
  }
  if (width === 0) {
    throw new TypeError('ANSIMAX_SIXEL_INPUT: every row of the PixelGrid is empty');
  }

  const transparent = opts.transparent !== false;
  const threshold = typeof opts.alphaThreshold === 'number' && Number.isFinite(opts.alphaThreshold)
    ? opts.alphaThreshold
    : 0.5;

  // Transparent pixels must not pull the palette towards whatever RGB sits
  // behind their alpha, so they are excluded from the colour statistics.
  const opaqueOnly: PixelGrid = transparent
    ? pixels.map((row) => (Array.isArray(row) ? row.filter((px) => alphaOf(px) >= threshold) : []))
    : pixels;

  const supplied = Array.isArray(opts.palette) && opts.palette.length > 0;
  const palette: RGB[] = supplied
    ? opts.palette!.map((c) => asRgb(c as Pixel))
    : medianCutPalette(opaqueOnly.some((row) => row.length > 0) ? opaqueOnly : pixels, {
        maxColors: opts.maxColors ?? 256,
      });
  /* istanbul ignore next — unreachable: the input check above rejects a grid
     whose rows are all empty, and medianCutPalette returns at least one
     colour for every other grid, junk cells and all. Verified over null,
     undefined, string, number, {} and NaN-channel grids. */
  if (palette.length === 0) palette.push({ r: 0, g: 0, b: 0 });

  // Sixel states colour registers as percentages (0..100), not bytes, so the
  // terminal can only show 101 levels per channel. Snapping the palette onto
  // that grid before mapping means every nearest-colour decision is made
  // against a colour the terminal will actually display — otherwise the
  // mapping error and the percent-rounding error stack, and the reported
  // palette is not what appears on screen.
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i] as RGB;
    palette[i] = { r: snapToPercent(c.r), g: snapToPercent(c.g), b: snapToPercent(c.b) };
  }

  // Map the image onto the palette. Dithering runs over the whole grid, so it
  // is done once up front rather than per band.
  const useDither = typeof opts.dither === 'string' && opts.dither !== 'none';
  const mapped: RGB[][] = useDither ? ditherColor(pixels, palette, { algorithm: opts.dither }) : [];

  // index[y][x] is the colour register, or -1 for "leave unpainted". The
  // mapper precomputes the palette in Oklab and memoizes by colour — mapping
  // through nearestPerceptual instead re-converted all 256 entries per pixel,
  // which is 19.7M cube roots for a 320x240 image (3.4s, now 0.14s).
  const index: Int16Array[] = [];
  const toRegister = createPaletteMapper(palette);
  for (let y = 0; y < height; y++) {
    const row = Array.isArray(pixels[y]) ? (pixels[y] as Pixel[]) : [];
    const out = new Int16Array(width).fill(-1);
    for (let x = 0; x < width; x++) {
      const px = row[x];
      if (px === undefined) continue;
      if (transparent && alphaOf(px) < threshold) continue;
      const rgb = useDither ? ((mapped[y] as RGB[])[x] as RGB) : asRgb(px);
      out[x] = toRegister(rgb);
    }
    index.push(out);
  }

  // Header. P1 is the legacy aspect-ratio selector, which the raster
  // attributes override wherever they are supported, so it stays 0. P2 = 1 is
  // what makes an unpainted pixel transparent rather than background-filled.
  const [pan, pad] = normalizeAspect(opts.aspect);
  const parts: string[] = [`${DCS_START}0;${transparent ? 1 : 0};0q`];
  if (opts.raster !== false) parts.push(`"${pan};${pad};${width};${height}`);
  for (let i = 0; i < palette.length; i++) {
    const c = palette[i] as RGB;
    parts.push(`#${i};2;${toPercent(c.r)};${toPercent(c.g)};${toPercent(c.b)}`);
  }

  const bands = Math.ceil(height / 6);

  // One pass over each band fills a plane per colour register, instead of
  // re-scanning the band once per colour: that inner loop was
  // bands x registers x width and dominated everything (3.25s for a 320x240
  // image at 256 colours, now 0.1s). The plane buffer is allocated once and
  // only the rows actually touched are cleared between bands.
  const planes = new Uint8Array(palette.length * width);
  const present: number[] = [];
  const seen = new Uint8Array(palette.length);

  for (let band = 0; band < bands; band++) {
    const top = band * 6;
    const rows = Math.min(6, height - top);

    present.length = 0;
    for (let dy = 0; dy < rows; dy++) {
      const line = index[top + dy] as Int16Array;
      const bit = 1 << dy;
      for (let x = 0; x < width; x++) {
        const reg = line[x] as number;
        if (reg < 0) continue;
        planes[reg * width + x] = (planes[reg * width + x] as number) | bit;
        if (seen[reg] === 0) {
          seen[reg] = 1;
          present.push(reg);
        }
      }
    }

    // Registers in ascending order, so a terminal that caches the last
    // selected register sees a predictable sequence.
    present.sort((a, b) => a - b);
    for (let k = 0; k < present.length; k++) {
      const reg = present[k] as number;
      // `$` returns to the band's left edge for the next colour's pass. It is
      // emitted *before* each pass but the first, so no trailing `$` is left
      // on the band — a trailing one is harmless but it is bytes.
      if (k > 0) parts.push('$');
      parts.push(`#${reg}`, packRow(planes, reg * width, width));
    }

    for (const reg of present) {
      seen[reg] = 0;
      planes.fill(0, reg * width, reg * width + width);
    }
    if (band < bands - 1) parts.push('-');
  }

  parts.push(ST);
  const data = parts.join('');
  return { data, width, height, palette, bands };
};

const normalizeAspect = (aspect: readonly [number, number] | undefined): [number, number] => {
  if (!Array.isArray(aspect) || aspect.length !== 2) return [1, 1];
  const pan = Math.max(1, Math.trunc(aspect[0] as number) || 1);
  const pad = Math.max(1, Math.trunc(aspect[1] as number) || 1);
  return [pan, pad];
};

/** Namespace form, for the default export. */
export const sixel = {
  encode: encodeSixel,
  encodeDetailed: encodeSixelDetailed,
};
