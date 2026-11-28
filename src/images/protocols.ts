/**
 * ansimax/images/protocols — the two vendor inline-image protocols, Phase 12.
 *
 * These are **opt-in and never the default**. `renderImageAuto` picks a
 * portable rendering (half-blocks, or ASCII without colour) that works in any
 * terminal; a vendor protocol works beautifully in the terminal that defines
 * it and not at all anywhere else, so emitting one is a decision for the
 * caller to make, with {@link detectCapabilities} to inform it.
 *
 * Sixel gets a module of its own (`src/sixel`) because it is an open
 * published standard with a real algorithm behind it. These two are framing:
 * Kitty takes raw pixels, iTerm2 takes an image file, and both want base64.
 *
 * @module
 * @since 1.10.0
 */

import { encodePNG } from './png.js';
import type { Pixel, PixelGrid } from './index.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64, written out rather than reached for.
 *
 * Node has `Buffer.from(x).toString('base64')` and browsers have `btoa`, and
 * neither is available everywhere this library runs. Three bytes become four
 * characters of six bits each; a short final group is padded with `=`.
 *
 * @example
 * ```js
 * import { base64Encode } from 'ansimax';
 *
 * base64Encode(new TextEncoder().encode('ansimax')); // → 'YW5zaW1heA=='
 * ```
 *
 * @since 1.10.0
 */
export const base64Encode = (data: Uint8Array): string => {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('ANSIMAX_BASE64_INPUT: base64Encode needs a Uint8Array');
  }
  const parts: string[] = [];
  let i = 0;
  // Build in chunks so the intermediate strings stay short: a single += over
  // a megabyte of output is what makes naive implementations crawl.
  const CHUNK = 3 * 1024;
  while (i < data.length) {
    const end = Math.min(i + CHUNK, data.length);
    let piece = '';
    for (; i + 2 < end; i += 3) {
      const n = ((data[i] as number) << 16) | ((data[i + 1] as number) << 8) | (data[i + 2] as number);
      piece += (B64[(n >>> 18) & 63] as string) + (B64[(n >>> 12) & 63] as string) +
        (B64[(n >>> 6) & 63] as string) + (B64[n & 63] as string);
    }
    parts.push(piece);
    if (end !== data.length) continue;
    // The tail: one or two bytes left over.
    const left = data.length - i;
    if (left === 1) {
      const n = (data[i] as number) << 16;
      parts.push(`${B64[(n >>> 18) & 63]}${B64[(n >>> 12) & 63]}==`);
    } else if (left === 2) {
      const n = ((data[i] as number) << 16) | ((data[i + 1] as number) << 8);
      parts.push(`${B64[(n >>> 18) & 63]}${B64[(n >>> 12) & 63]}${B64[(n >>> 6) & 63]}=`);
    }
    break;
  }
  return parts.join('');
};

/** Options for {@link encodeKittyImage}. */
export interface KittyImageOptions {
  /**
   * Send RGBA instead of RGB. Default is `true` when the grid has any
   * transparency, `false` otherwise — RGB is a quarter smaller.
   */
  alpha?: boolean;
  /**
   * Send a PNG rather than raw pixels (`f=100`). Much smaller on the wire for
   * anything but noise, at the cost of compressing it here. Default `false`.
   */
  png?: boolean;
  /** Display width in character cells, if the image should be scaled. */
  columns?: number;
  /** Display height in character cells. */
  rows?: number;
  /**
   * Ask the terminal not to reply. Default `true`: a reply the caller is not
   * reading gets typed into whatever reads stdin next.
   */
  quiet?: boolean;
  /**
   * Base64 characters per escape sequence. The protocol's limit is 4096 and
   * that is the default; there is no reason to change it.
   */
  chunkSize?: number;
}

/** Options for {@link encodeITerm2Image}. */
export interface ITerm2ImageOptions {
  /** DEFLATE level for the PNG this builds. Default `6`. */
  level?: number;
  /**
   * Display width — a cell count, `'<n>px'`, `'<n>%'` or `'auto'`.
   * Omitted means the image's own pixel size.
   */
  width?: number | string;
  /** Display height, same forms as `width`. */
  height?: number | string;
  /** Keep the aspect ratio when only one dimension is given. Default `true`. */
  preserveAspectRatio?: boolean;
  /**
   * A file name to show the image under. Pure metadata, but iTerm2 uses it
   * for the "download" affordance on the image.
   */
  name?: string;
  /**
   * Wrap the sequence for tmux's passthrough. Default `false`: whether the
   * output is going through tmux is something only the caller knows.
   */
  tmux?: boolean;
}

const ESC = '\x1b';
const APC = `${ESC}_G`;
const ST = `${ESC}\\`;
const BEL = '\x07';

const gridSize = (pixels: PixelGrid): [number, number] => {
  if (!Array.isArray(pixels) || pixels.length === 0 || !Array.isArray(pixels[0])) {
    throw new TypeError('ANSIMAX_PROTOCOL_INPUT: this needs a non-empty PixelGrid');
  }
  let width = 0;
  for (const row of pixels) if (Array.isArray(row) && row.length > width) width = row.length;
  if (width === 0) throw new TypeError('ANSIMAX_PROTOCOL_INPUT: every row of the PixelGrid is empty');
  return [width, pixels.length];
};

/**
 * Whether the grid needs an alpha channel. A row shorter than the widest
 * counts, because {@link rawPixels} pads those cells as transparent — without
 * this they would be sent as opaque black in an `f=24` stream.
 */
const hasTransparency = (pixels: PixelGrid, width: number): boolean => {
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

const byteOf = (v: number): number => {
  if (!Number.isFinite(v)) return 0;
  return Math.min(255, Math.max(0, Math.round(v)));
};

/** Flatten a grid to raw RGB or RGBA bytes, row by row. */
const rawPixels = (pixels: PixelGrid, width: number, height: number, alpha: boolean): Uint8Array => {
  const channels = alpha ? 4 : 3;
  const out = new Uint8Array(width * height * channels);
  let at = 0;
  for (let y = 0; y < height; y++) {
    const row = Array.isArray(pixels[y]) ? (pixels[y] as Pixel[]) : [];
    for (let x = 0; x < width; x++) {
      const px = row[x];
      if (px === null || px === undefined) {
        at += channels; // already zero, which is transparent black
        continue;
      }
      out[at++] = byteOf(px.r);
      out[at++] = byteOf(px.g);
      out[at++] = byteOf(px.b);
      if (alpha) {
        const a = (px as { a?: number }).a;
        out[at++] = typeof a === 'number' && Number.isFinite(a) ? byteOf(a * 255) : 255;
      }
    }
  }
  return out;
};

/**
 * Encode an image for the Kitty graphics protocol.
 *
 * Kitty takes the pixels directly — `f=24` for RGB, `f=32` for RGBA — so no
 * image format is involved unless `png: true` is passed. The payload is
 * base64 and must be split across escape sequences of at most 4096 payload
 * characters each, with `m=1` on every chunk but the last; the first chunk
 * carries the control keys and the rest carry only `m`.
 *
 * Nothing here checks whether the terminal speaks this protocol. That is
 * {@link detectCapabilities}'s job, and the decision is the caller's.
 *
 * @example
 * ```js
 * import { encodeKittyImage, detectCapabilities } from 'ansimax';
 *
 * if (detectCapabilities().imageProtocol === 'kitty') {
 *   process.stdout.write(encodeKittyImage(pixels, { png: true }));
 * }
 * ```
 *
 * @throws {TypeError} `ANSIMAX_PROTOCOL_INPUT` — not a non-empty pixel grid.
 * @since 1.10.0
 */
export const encodeKittyImage = (pixels: PixelGrid, opts: KittyImageOptions = {}): string => {
  const [width, height] = gridSize(pixels);
  const alpha = opts.alpha ?? hasTransparency(pixels, width);
  const usePng = opts.png === true;

  const payload = base64Encode(
    usePng ? encodePNG(pixels, { alpha }) : rawPixels(pixels, width, height, alpha),
  );

  const keys: string[] = ['a=T'];
  keys.push(`f=${usePng ? 100 : alpha ? 32 : 24}`);
  // Raw pixels carry no dimensions of their own, so s and v are mandatory
  // there; for PNG they are redundant but harmless and let the terminal
  // allocate before it parses.
  keys.push(`s=${width}`, `v=${height}`);
  if (typeof opts.columns === 'number' && opts.columns > 0) keys.push(`c=${Math.trunc(opts.columns)}`);
  if (typeof opts.rows === 'number' && opts.rows > 0) keys.push(`r=${Math.trunc(opts.rows)}`);
  if (opts.quiet !== false) keys.push('q=2');

  const chunkSize = toChunkSize(opts.chunkSize);
  if (payload.length <= chunkSize) {
    return `${APC}${keys.join(',')};${payload}${ST}`;
  }

  const parts: string[] = [];
  for (let at = 0; at < payload.length; at += chunkSize) {
    const slice = payload.slice(at, at + chunkSize);
    const more = at + chunkSize < payload.length ? 1 : 0;
    if (at === 0) {
      parts.push(`${APC}${keys.join(',')},m=1;${slice}${ST}`);
    } else {
      parts.push(`${APC}m=${more};${slice}${ST}`);
    }
  }
  return parts.join('');
};

const toChunkSize = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 4096;
  const n = Math.trunc(value);
  return n > 0 ? n : 4096;
};

/**
 * Encode an image for iTerm2's inline-image protocol.
 *
 * iTerm2 wants an image *file*, not pixels, so this builds a PNG with
 * {@link encodePNG} and base64s it into an OSC 1337 sequence. Pass a
 * `Uint8Array` to send a file you already have — a JPEG or a GIF, say —
 * untouched.
 *
 * Under tmux the sequence has to be wrapped in a passthrough or tmux will
 * swallow it; `tmux: true` does that, but whether the output is going through
 * tmux is something only the caller knows.
 *
 * @example
 * ```js
 * import { encodeITerm2Image, detectCapabilities } from 'ansimax';
 *
 * if (detectCapabilities().imageProtocol === 'iterm2') {
 *   process.stdout.write(encodeITerm2Image(pixels, { width: 40 }));
 * }
 * ```
 *
 * @throws {TypeError} `ANSIMAX_PROTOCOL_INPUT` — not a pixel grid or a file.
 * @since 1.10.0
 */
export const encodeITerm2Image = (
  image: PixelGrid | Uint8Array,
  opts: ITerm2ImageOptions = {},
): string => {
  let file: Uint8Array;
  let pixelWidth: number | null = null;
  let pixelHeight: number | null = null;
  if (image instanceof Uint8Array) {
    file = image;
  } else {
    const [w, h] = gridSize(image);
    pixelWidth = w;
    pixelHeight = h;
    file = encodePNG(image, { level: opts.level });
  }

  const args: string[] = ['inline=1', `size=${file.length}`];
  if (typeof opts.name === 'string' && opts.name.length > 0) {
    args.push(`name=${base64Encode(new Uint8Array([...opts.name].map((c) => c.charCodeAt(0) & 0xff)))}`);
  }
  const dim = (value: number | string | undefined, fallback: number | null): string | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(Math.trunc(value));
    if (typeof value === 'string' && value.length > 0) return value;
    // With no explicit size, state the image's own pixels so the terminal
    // does not scale it to the text area.
    return fallback === null ? null : `${fallback}px`;
  };
  const w = dim(opts.width, opts.height === undefined ? pixelWidth : null);
  const h = dim(opts.height, opts.width === undefined ? pixelHeight : null);
  if (w !== null) args.push(`width=${w}`);
  if (h !== null) args.push(`height=${h}`);
  args.push(`preserveAspectRatio=${opts.preserveAspectRatio === false ? 0 : 1}`);

  const sequence = `${ESC}]1337;File=${args.join(';')}:${base64Encode(file)}${BEL}`;
  if (opts.tmux !== true) return sequence;
  // tmux passthrough: wrap in DCS tmux;… and double every ESC inside.
  return `${ESC}Ptmux;${sequence.replace(/\x1b/g, '\x1b\x1b')}${ST}`;
};

/** Namespace form, for the default export. */
export const protocols = {
  kitty: encodeKittyImage,
  iterm2: encodeITerm2Image,
  base64: base64Encode,
};
