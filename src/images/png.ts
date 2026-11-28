/**
 * ansimax/images/png — PNG in both directions, Phase 12.
 *
 * Decoding turns a PNG into a {@link PixelGrid}, which is what every renderer
 * in this library already consumes; encoding produces a file, which is what
 * iTerm2's inline-image protocol wants handed to it.
 *
 * The compressed payload goes through `src/deflate`, written from scratch for
 * exactly this. Everything else PNG needs is here: the chunk layout, the CRC
 * on each chunk, the five scanline filters, the five colour types, 8- and
 * 16-bit depths, the palette, transparency in its three forms, and Adam7
 * interlacing.
 *
 * @module
 * @since 1.10.0
 */

import { crc32, deflate, inflate } from '../deflate/index.js';
import type { Pixel, PixelGrid } from './index.js';

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** PNG colour types, as the IHDR byte numbers them. */
const ColorType = {
  Grey: 0,
  RGB: 2,
  Palette: 3,
  GreyAlpha: 4,
  RGBA: 6,
} as const;

/** Channels per pixel for each colour type. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** What {@link decodePNG} reports alongside the pixels. */
export interface PNGImage {
  /** Row-major pixels, `null` where fully transparent. */
  pixels: PixelGrid;
  width: number;
  height: number;
  /** The IHDR colour type: 0 grey, 2 RGB, 3 palette, 4 grey+alpha, 6 RGBA. */
  colorType: number;
  /** Bits per channel as stored: 1, 2, 4, 8 or 16. */
  bitDepth: number;
  /** Whether the file carried any transparency. */
  hasAlpha: boolean;
  /** Whether the file was Adam7 interlaced. */
  interlaced: boolean;
}

/** Options for {@link decodePNG}. */
export interface DecodePNGOptions {
  /**
   * Keep the alpha channel on each pixel instead of dropping it. Default
   * `true`. Fully transparent pixels come back as `null` either way, which is
   * what the renderers read as "leave this cell alone".
   */
  alpha?: boolean;
}

/** Options for {@link encodePNG}. */
export interface EncodePNGOptions {
  /** DEFLATE level, 0–9. Default `6`. */
  level?: number;
  /**
   * Write an alpha channel (colour type 6 instead of 2). Default is `true`
   * when any pixel in the grid is transparent, `false` otherwise.
   */
  alpha?: boolean;
  /**
   * Scanline filter. `'auto'` (the default) picks per row by minimum absolute
   * sum of the filtered bytes, which is the heuristic the PNG specification
   * itself suggests; a number forces one filter for every row.
   */
  filter?: 'auto' | 0 | 1 | 2 | 3 | 4;
}

const fail = (token: string, detail: string): never => {
  throw new RangeError(`ANSIMAX_PNG_${token}: ${detail}`);
};

const readU32 = (data: Uint8Array, at: number): number =>
  (((data[at] as number) << 24) |
    ((data[at + 1] as number) << 16) |
    ((data[at + 2] as number) << 8) |
    (data[at + 3] as number)) >>> 0;

const writeU32 = (out: Uint8Array, at: number, value: number): void => {
  out[at] = (value >>> 24) & 0xff;
  out[at + 1] = (value >>> 16) & 0xff;
  out[at + 2] = (value >>> 8) & 0xff;
  out[at + 3] = value & 0xff;
};

// ─────────────────────────────────────────────
//  Scanline filters (PNG §9)
// ─────────────────────────────────────────────

/**
 * Undo one scanline's filter in place.
 *
 * `bpp` is the byte offset to the pixel on the left — not the bit depth. For
 * depths below 8 it is 1, because the filters work on bytes and a sub-byte
 * pixel has no byte of its own to the left.
 */
const unfilter = (
  type: number,
  line: Uint8Array,
  prev: Uint8Array | null,
  bpp: number,
): void => {
  const n = line.length;
  switch (type) {
    case 0:
      return;
    case 1: // Sub — the byte bpp to the left
      for (let i = bpp; i < n; i++) line[i] = ((line[i] as number) + (line[i - bpp] as number)) & 0xff;
      return;
    case 2: // Up — the byte above
      if (!prev) return;
      for (let i = 0; i < n; i++) line[i] = ((line[i] as number) + (prev[i] as number)) & 0xff;
      return;
    case 3: // Average — of left and above, floored
      for (let i = 0; i < n; i++) {
        const left = i >= bpp ? (line[i - bpp] as number) : 0;
        const up = prev ? (prev[i] as number) : 0;
        line[i] = ((line[i] as number) + ((left + up) >> 1)) & 0xff;
      }
      return;
    case 4: // Paeth — whichever of left, above, upper-left is nearest their gradient
      for (let i = 0; i < n; i++) {
        const a = i >= bpp ? (line[i - bpp] as number) : 0;
        const b = prev ? (prev[i] as number) : 0;
        const c = prev && i >= bpp ? (prev[i - bpp] as number) : 0;
        line[i] = ((line[i] as number) + paeth(a, b, c)) & 0xff;
      }
      return;
    default:
      fail('FILTER', `scanline filter ${type} is not one of 0..4`);
  }
};

/**
 * The Paeth predictor: of left, above and upper-left, the one closest to
 * `a + b - c`, the plane those three define. Ties go to `a`, then `b` — the
 * order is part of the format, not a choice.
 */
const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

// ─────────────────────────────────────────────
//  Adam7 interlacing (PNG §8.2)
// ─────────────────────────────────────────────

/** The seven passes, as (xStart, yStart, xStep, yStep). */
const ADAM7 = [
  [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
] as const;

// ─────────────────────────────────────────────
//  Decoding
// ─────────────────────────────────────────────

/**
 * Decode a PNG into a pixel grid.
 *
 * Handles every non-animated form the specification defines: colour types 0,
 * 2, 3, 4 and 6, bit depths 1, 2, 4, 8 and 16, `tRNS` transparency for grey,
 * RGB and palette images, and Adam7 interlacing. 16-bit channels are reduced
 * to 8 bits, since that is what a terminal can show.
 *
 * `cHRM`, `gAMA`, `iCCP` and the rest of the ancillary chunks are skipped:
 * colour management for a terminal rendering is not a thing a reader should
 * guess at. `APNG` animation chunks are ignored, so an animated PNG decodes
 * to its first frame.
 *
 * @example
 * ```js
 * import { readFileSync } from 'node:fs';
 * import { decodePNG, renderPixelArt } from 'ansimax';
 *
 * const { pixels } = decodePNG(readFileSync('logo.png'));
 * console.log(renderPixelArt(pixels));
 * ```
 *
 * @throws {RangeError} `ANSIMAX_PNG_SIGNATURE` — not a PNG.
 * @throws {RangeError} `ANSIMAX_PNG_TRUNCATED` — the file ends mid-chunk.
 * @throws {RangeError} `ANSIMAX_PNG_CRC` — a chunk's checksum disagrees.
 * @throws {RangeError} `ANSIMAX_PNG_IHDR` — bad dimensions, depth or type.
 * @throws {RangeError} `ANSIMAX_PNG_UNSUPPORTED` — a compression, filter or
 *   interlace method the format does not define.
 * @since 1.10.0
 */
export const decodePNG = (file: Uint8Array, opts: DecodePNGOptions = {}): PNGImage => {
  if (!(file instanceof Uint8Array)) {
    throw new TypeError('ANSIMAX_PNG_INPUT: decodePNG needs a Uint8Array');
  }
  if (file.length < 8) fail('SIGNATURE', 'the file is too short to be a PNG');
  for (let i = 0; i < 8; i++) {
    if (file[i] !== SIGNATURE[i]) fail('SIGNATURE', 'the 8-byte PNG signature does not match');
  }

  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType: number = ColorType.RGB;
  let interlace = 0;
  let palette: Uint8Array | null = null;
  let paletteAlpha: Uint8Array | null = null;
  let transparent: number[] | null = null;
  const idat: Uint8Array[] = [];
  let sawIHDR = false;

  let at = 8;
  while (at + 8 <= file.length) {
    const length = readU32(file, at);
    const type = String.fromCharCode(
      file[at + 4] as number, file[at + 5] as number,
      file[at + 6] as number, file[at + 7] as number,
    );
    const dataAt = at + 8;
    if (dataAt + length + 4 > file.length) {
      fail('TRUNCATED', `chunk ${type} claims ${length} bytes but the file ends first`);
    }
    const body = file.subarray(dataAt, dataAt + length);
    const stored = readU32(file, dataAt + length);
    // The CRC covers the type and the body, not the length.
    const actual = crc32(file.subarray(at + 4, dataAt + length));
    if (actual !== stored) {
      fail('CRC', `chunk ${type} has checksum ${actual.toString(16)}, the file says ${stored.toString(16)}`);
    }

    if (type === 'IHDR') {
      if (length !== 13) fail('IHDR', `IHDR must be 13 bytes, this one is ${length}`);
      width = readU32(body, 0);
      height = readU32(body, 4);
      bitDepth = body[8] as number;
      colorType = body[9] as number;
      const compression = body[10] as number;
      const filterMethod = body[11] as number;
      interlace = body[12] as number;
      if (width === 0 || height === 0) fail('IHDR', `dimensions ${width}x${height} include a zero`);
      if (![1, 2, 4, 8, 16].includes(bitDepth)) fail('IHDR', `bit depth ${bitDepth} is not 1, 2, 4, 8 or 16`);
      if (CHANNELS[colorType] === undefined) fail('IHDR', `colour type ${colorType} is not 0, 2, 3, 4 or 6`);
      // Only the palette type allows depths below 8 for anything but grey.
      if (colorType !== ColorType.Grey && colorType !== ColorType.Palette && bitDepth < 8) {
        fail('IHDR', `colour type ${colorType} requires 8 or 16 bits, not ${bitDepth}`);
      }
      if (colorType === ColorType.Palette && bitDepth === 16) {
        fail('IHDR', 'a palette image cannot have 16-bit indices');
      }
      if (compression !== 0) fail('UNSUPPORTED', `compression method ${compression} is not DEFLATE`);
      if (filterMethod !== 0) fail('UNSUPPORTED', `filter method ${filterMethod} is not the adaptive one`);
      if (interlace !== 0 && interlace !== 1) fail('UNSUPPORTED', `interlace method ${interlace} is not 0 or Adam7`);
      sawIHDR = true;
    } else if (type === 'PLTE') {
      palette = body.slice();
    } else if (type === 'tRNS') {
      if (colorType === ColorType.Palette) paletteAlpha = body.slice();
      else if (colorType === ColorType.Grey) transparent = [readU16(body, 0)];
      else if (colorType === ColorType.RGB) {
        transparent = [readU16(body, 0), readU16(body, 2), readU16(body, 4)];
      }
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    at = dataAt + length + 4;
  }

  if (!sawIHDR) fail('IHDR', 'the file has no IHDR chunk');
  if (idat.length === 0) fail('TRUNCATED', 'the file has no IDAT data');
  if (colorType === ColorType.Palette && !palette) fail('UNSUPPORTED', 'a palette image with no PLTE chunk');

  // IDAT may be split across any number of chunks; the zlib stream spans them.
  let total = 0;
  for (const part of idat) total += part.length;
  const zstream = new Uint8Array(total);
  let off = 0;
  for (const part of idat) { zstream.set(part, off); off += part.length; }

  const channels = CHANNELS[colorType] as number;
  const bitsPerPixel = channels * bitDepth;
  const expected = interlace === 1
    ? adam7Size(width, height, bitsPerPixel)
    : height * (1 + Math.ceil((width * bitsPerPixel) / 8));
  const raw = inflate(zstream, { sizeHint: expected });

  const keepAlpha = opts.alpha !== false;
  const grid: PixelGrid = Array.from({ length: height }, () => new Array(width).fill(null));

  const readPixels = (
    source: Uint8Array,
    sourceAt: number,
    passWidth: number,
    passHeight: number,
    place: (x: number, y: number, px: Pixel) => void,
  ): number => {
    const bytesPerLine = Math.ceil((passWidth * bitsPerPixel) / 8);
    // Filters address the byte of the pixel to the left; below 8 bits a pixel
    // has no byte of its own, so the offset is 1.
    const bpp = Math.max(1, bitsPerPixel >> 3);
    let prev: Uint8Array | null = null;
    let cursor = sourceAt;
    for (let y = 0; y < passHeight; y++) {
      if (cursor >= source.length) fail('TRUNCATED', 'the pixel data ends before the last scanline');
      const filterType = source[cursor++] as number;
      if (cursor + bytesPerLine > source.length) {
        fail('TRUNCATED', `scanline ${y} is short by ${cursor + bytesPerLine - source.length} bytes`);
      }
      const line = source.subarray(cursor, cursor + bytesPerLine);
      unfilter(filterType, line, prev, bpp);
      cursor += bytesPerLine;

      for (let x = 0; x < passWidth; x++) {
        place(x, y, samplePixel(line, x, bitDepth, colorType, channels, palette, paletteAlpha, transparent, keepAlpha));
      }
      prev = line;
    }
    return cursor;
  };

  if (interlace === 1) {
    let cursor = 0;
    for (const [xStart, yStart, xStep, yStep] of ADAM7) {
      const passWidth = Math.ceil((width - xStart) / xStep);
      const passHeight = Math.ceil((height - yStart) / yStep);
      if (passWidth <= 0 || passHeight <= 0) continue;
      cursor = readPixels(raw, cursor, passWidth, passHeight, (x, y, px) => {
        const gx = xStart + x * xStep;
        const gy = yStart + y * yStep;
        if (gx < width && gy < height) (grid[gy] as Pixel[])[gx] = px;
      });
    }
  } else {
    readPixels(raw, 0, width, height, (x, y, px) => {
      (grid[y] as Pixel[])[x] = px;
    });
  }

  return {
    pixels: grid,
    width,
    height,
    colorType,
    bitDepth,
    hasAlpha:
      colorType === ColorType.RGBA || colorType === ColorType.GreyAlpha ||
      paletteAlpha !== null || transparent !== null,
    interlaced: interlace === 1,
  };
};

const readU16 = (data: Uint8Array, at: number): number =>
  ((data[at] as number) << 8) | (data[at + 1] as number);

/** How much raw data the seven Adam7 passes add up to. */
const adam7Size = (width: number, height: number, bitsPerPixel: number): number => {
  let total = 0;
  for (const [xStart, yStart, xStep, yStep] of ADAM7) {
    const w = Math.ceil((width - xStart) / xStep);
    const h = Math.ceil((height - yStart) / yStep);
    if (w > 0 && h > 0) total += h * (1 + Math.ceil((w * bitsPerPixel) / 8));
  }
  return total;
};

/** Pull one pixel out of an unfiltered scanline. */
const samplePixel = (
  line: Uint8Array,
  x: number,
  bitDepth: number,
  colorType: number,
  channels: number,
  palette: Uint8Array | null,
  paletteAlpha: Uint8Array | null,
  transparent: number[] | null,
  keepAlpha: boolean,
): Pixel => {
  const sample = (channel: number): number => {
    if (bitDepth === 8) return line[x * channels + channel] as number;
    if (bitDepth === 16) {
      // Reduce 16 bits to 8 by taking the high byte. Scaling by 255/65535
      // would be marginally more accurate and costs a divide per channel for
      // a difference no terminal can display.
      return line[(x * channels + channel) * 2] as number;
    }
    // 1, 2 or 4 bits, packed big-endian within each byte.
    const index = x * channels + channel;
    const perByte = 8 / bitDepth;
    const byte = line[Math.floor(index / perByte)] as number;
    const shift = 8 - bitDepth * ((index % perByte) + 1);
    return (byte >> shift) & ((1 << bitDepth) - 1);
  };

  if (colorType === ColorType.Palette) {
    const index = sample(0);
    if (!palette || index * 3 + 2 >= palette.length) return null;
    const alpha = paletteAlpha && index < paletteAlpha.length ? (paletteAlpha[index] as number) : 255;
    if (alpha === 0) return null;
    const px: Pixel = {
      r: palette[index * 3] as number,
      g: palette[index * 3 + 1] as number,
      b: palette[index * 3 + 2] as number,
    };
    return keepAlpha && alpha !== 255 ? { ...px, a: alpha / 255 } : px;
  }

  // Below 8 bits a grey sample is a fraction of its own range, so it has to
  // be scaled to 0..255 — a 1-bit image is 0 or 1, not 0 or 255.
  const max = (1 << bitDepth) - 1;
  const toByte = (v: number): number => (bitDepth >= 8 ? v : Math.round((v / max) * 255));

  if (colorType === ColorType.Grey || colorType === ColorType.GreyAlpha) {
    const raw = sample(0);
    const grey = toByte(raw);
    const alpha = colorType === ColorType.GreyAlpha ? (sample(1) as number) / 255 : 1;
    if (transparent && raw === transparent[0]) return null;
    if (colorType === ColorType.GreyAlpha && alpha === 0) return null;
    const px: Pixel = { r: grey, g: grey, b: grey };
    return keepAlpha && alpha !== 1 ? { ...px, a: alpha } : px;
  }

  const r = sample(0);
  const g = sample(1);
  const b = sample(2);
  if (transparent && r === transparent[0] && g === transparent[1] && b === transparent[2]) return null;
  const alpha = colorType === ColorType.RGBA ? (sample(3) as number) / 255 : 1;
  if (alpha === 0) return null;
  const px: Pixel = { r, g, b };
  return keepAlpha && alpha !== 1 ? { ...px, a: alpha } : px;
};

// ─────────────────────────────────────────────
//  Encoding
// ─────────────────────────────────────────────

/** Build one chunk: length, type, body, CRC over type and body. */
const chunk = (type: string, body: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + body.length);
  writeU32(out, 0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  writeU32(out, 8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
};

/**
 * Encode a pixel grid as a PNG file.
 *
 * Writes 8-bit RGB or RGBA (colour types 2 and 6) — not because the other
 * types are hard, but because nothing a terminal renders benefits from them,
 * and a palette would have to be derived from the image anyway. Rows are
 * filtered adaptively: each of the five filters is applied and the one with
 * the smallest absolute byte sum wins, which is the heuristic the
 * specification itself recommends.
 *
 * @example
 * ```js
 * import { writeFileSync } from 'node:fs';
 * import { encodePNG } from 'ansimax';
 *
 * writeFileSync('out.png', encodePNG(pixels, { level: 9 }));
 * ```
 *
 * @throws {TypeError} `ANSIMAX_PNG_INPUT` — not a non-empty pixel grid.
 * @since 1.10.0
 */
export const encodePNG = (pixels: PixelGrid, opts: EncodePNGOptions = {}): Uint8Array => {
  if (!Array.isArray(pixels) || pixels.length === 0 || !Array.isArray(pixels[0])) {
    throw new TypeError('ANSIMAX_PNG_INPUT: encodePNG needs a non-empty PixelGrid');
  }
  const height = pixels.length;
  let width = 0;
  for (const row of pixels) if (Array.isArray(row) && row.length > width) width = row.length;
  if (width === 0) throw new TypeError('ANSIMAX_PNG_INPUT: every row of the PixelGrid is empty');

  const alpha = opts.alpha ?? gridHasAlpha(pixels, width);
  const channels = alpha ? 4 : 3;
  const stride = width * channels;

  // Filter each row, with the filter byte in front: the raw form PNG deflates.
  const raw = new Uint8Array(height * (1 + stride));
  const current = new Uint8Array(stride);
  let previous = new Uint8Array(stride);
  let out = 0;

  for (let y = 0; y < height; y++) {
    const row = Array.isArray(pixels[y]) ? (pixels[y] as Pixel[]) : [];
    for (let x = 0; x < width; x++) {
      const px = row[x];
      const at = x * channels;
      if (px === null || px === undefined) {
        current[at] = 0;
        current[at + 1] = 0;
        current[at + 2] = 0;
        if (alpha) current[at + 3] = 0;
        continue;
      }
      current[at] = byteOf(px.r);
      current[at + 1] = byteOf(px.g);
      current[at + 2] = byteOf(px.b);
      if (alpha) {
        const a = (px as { a?: number }).a;
        current[at + 3] = typeof a === 'number' && Number.isFinite(a)
          ? byteOf(a * 255)
          : 255;
      }
    }

    const { type, line } = filterRow(current, previous, channels, opts.filter ?? 'auto');
    raw[out++] = type;
    raw.set(line, out);
    out += stride;
    // The *unfiltered* row is what the next row predicts from, so keep a copy
    // before `current` is overwritten.
    previous = current.slice();
  }

  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, width);
  writeU32(ihdr, 4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = alpha ? ColorType.RGBA : ColorType.RGB;
  ihdr[10] = 0; // DEFLATE
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const idat = deflate(raw, { level: opts.level });
  const parts = [
    new Uint8Array(SIGNATURE),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ];
  let size = 0;
  for (const part of parts) size += part.length;
  const file = new Uint8Array(size);
  let at = 0;
  for (const part of parts) { file.set(part, at); at += part.length; }
  return file;
};

const byteOf = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return Math.min(255, Math.max(0, Math.round(v)));
};

/**
 * Whether the grid needs an alpha channel.
 *
 * A row shorter than the widest counts: the writer pads those cells as
 * transparent, so without this the pad would come out as opaque black in a
 * colour-type-2 file — the detection and the writer have to agree on what a
 * missing pixel means.
 */
const gridHasAlpha = (pixels: PixelGrid, width: number): boolean => {
  for (const row of pixels) {
    if (!Array.isArray(row)) return true;
    if (row.length < width) return true;
    for (const px of row) {
      if (px === null || px === undefined) return true;
      const a = (px as { a?: number }).a;
      if (typeof a === 'number' && a < 1) return true;
    }
  }
  return false;
};

/**
 * Apply the filter that compresses best, or a forced one.
 *
 * "Best" is the minimum sum of absolute signed byte values — the heuristic
 * from the specification's own encoder notes. It is a proxy for entropy, not
 * a measurement of it, but trying all five against the actual deflater would
 * cost five compressions per row.
 */
const filterRow = (
  row: Uint8Array,
  prev: Uint8Array,
  bpp: number,
  choice: 'auto' | 0 | 1 | 2 | 3 | 4,
): { type: number; line: Uint8Array } => {
  const n = row.length;
  const apply = (type: number): Uint8Array => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const a = i >= bpp ? (row[i - bpp] as number) : 0;
      const b = prev[i] as number;
      const c = i >= bpp ? (prev[i - bpp] as number) : 0;
      const v = row[i] as number;
      out[i] =
        (type === 0 ? v
          : type === 1 ? v - a
            : type === 2 ? v - b
              : type === 3 ? v - ((a + b) >> 1)
                : v - paeth(a, b, c)) & 0xff;
    }
    return out;
  };

  if (choice !== 'auto') return { type: choice, line: apply(choice) };

  let bestType = 0;
  let bestLine = apply(0);
  let bestScore = score(bestLine);
  for (let type = 1; type <= 4; type++) {
    const line = apply(type);
    const s = score(line);
    if (s < bestScore) { bestScore = s; bestType = type; bestLine = line; }
  }
  return { type: bestType, line: bestLine };
};

/** Sum of |signed byte| — small when the row is mostly near-zero deltas. */
const score = (line: Uint8Array): number => {
  let sum = 0;
  for (let i = 0; i < line.length; i++) {
    const v = line[i] as number;
    sum += v < 128 ? v : 256 - v;
  }
  return sum;
};

/** Namespace form, for the default export. */
export const png = {
  encode: encodePNG,
  decode: decodePNG,
};
