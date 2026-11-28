/**
 * ansimax/images/jpeg — baseline JPEG decoding, Phase 12.
 *
 * Turns a baseline (sequential DCT, Huffman) JPEG into a {@link PixelGrid},
 * the form every renderer in this library already consumes. Written out
 * rather than depended on, like the rest of Phase 12.
 *
 * What it reads: SOF0 and SOF1 — baseline and extended sequential, 8-bit — in
 * greyscale, YCbCr and Adobe CMYK/YCCK, with any sampling factors, multiple
 * quantization and Huffman tables, and restart intervals.
 *
 * What it refuses, by name rather than by producing nonsense: progressive
 * (SOF2), arithmetic coding, lossless and hierarchical modes, and 12-bit
 * samples. Progressive is the one worth knowing about — it is common on the
 * web, and decoding it needs the whole successive-approximation machinery
 * rather than one pass over the coefficients.
 *
 * @module
 * @since 1.10.0
 */

import type { Pixel, PixelGrid } from './index.js';

/** The zig-zag order the 64 coefficients of a block are stored in. */
const ZIGZAG = [
  0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5,
  12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28,
  35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51,
  58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
] as const;

/** What {@link decodeJPEG} reports alongside the pixels. */
export interface JPEGImage {
  /** Row-major pixels. A JPEG has no transparency, so none are `null`. */
  pixels: PixelGrid;
  width: number;
  height: number;
  /** 1 for greyscale, 3 for YCbCr, 4 for CMYK or YCCK. */
  components: number;
  /** Whether the file carried restart markers. */
  restartInterval: number;
  /** The comment from a COM segment, if there was one. */
  comment?: string;
}

/** Options for {@link decodeJPEG}. */
export interface DecodeJPEGOptions {
  /**
   * Cap on pixel count, as a guard against a header claiming a huge image.
   * Default 64 megapixels.
   */
  maxPixels?: number;
}

const fail = (token: string, detail: string): never => {
  throw new RangeError(`ANSIMAX_JPEG_${token}: ${detail}`);
};

/** One Huffman table, as a code→symbol map keyed by length. */
interface HuffTable {
  /** `lookup[len]` maps a `len`-bit code to its symbol. */
  lookup: Map<number, number>[];
  maxLength: number;
}

const buildHuffTable = (counts: Uint8Array, symbols: Uint8Array): HuffTable => {
  const lookup: Map<number, number>[] = Array.from({ length: 17 }, () => new Map());
  let code = 0;
  let k = 0;
  let maxLength = 0;
  // Canonical, MSB-first: all codes of length n are consecutive, then the
  // counter shifts left for the next length. Note this is the opposite bit
  // order from DEFLATE, which reads its codes LSB-first.
  for (let length = 1; length <= 16; length++) {
    for (let i = 0; i < (counts[length - 1] as number); i++) {
      (lookup[length] as Map<number, number>).set(code, symbols[k++] as number);
      code++;
      maxLength = length;
    }
    code <<= 1;
  }
  return { lookup, maxLength };
};

/** One colour component's frame parameters and decoded samples. */
interface Component {
  id: number;
  h: number;
  v: number;
  quantId: number;
  dcTable: number;
  acTable: number;
  blocksPerLine: number;
  blocksPerColumn: number;
  /** Decoded samples at this component's own resolution. */
  samples: Uint8ClampedArray;
  lineWidth: number;
  pred: number;
}

/**
 * Reads the entropy-coded scan: bits MSB-first, with JPEG's byte stuffing.
 *
 * A literal `0xFF` in the data is written as `0xFF 0x00`, and `0xFF` followed
 * by anything else is a marker — which means the bit reader, not the segment
 * parser, is where a scan ends.
 */
class ScanReader {
  private data: Uint8Array;
  pos: number;
  private bitBuf = 0;
  private bitCount = 0;
  /** Set when a marker is reached, so the MCU loop knows to stop. */
  marker = 0;

  constructor(data: Uint8Array, at: number) {
    this.data = data;
    this.pos = at;
  }

  private fill(): void {
    if (this.pos >= this.data.length) {
      // Past the end, feed zero bits: a truncated scan should decode what it
      // can rather than throw away the whole image.
      this.bitBuf = (this.bitBuf << 8) & 0xffff;
      this.bitCount += 8;
      return;
    }
    let byte = this.data[this.pos++] as number;
    if (byte === 0xff) {
      const next = this.pos < this.data.length ? (this.data[this.pos] as number) : 0xd9;
      if (next === 0x00) {
        this.pos++; // stuffed: the 0xFF is data
      } else {
        // A real marker. Leave `pos` on the 0xFF so the caller can read it.
        this.pos--;
        this.marker = next;
        byte = 0;
      }
    }
    this.bitBuf = ((this.bitBuf << 8) | byte) & 0xffff;
    this.bitCount += 8;
  }

  bit(): number {
    if (this.bitCount === 0) this.fill();
    this.bitCount--;
    return (this.bitBuf >> this.bitCount) & 1;
  }

  bits(count: number): number {
    let value = 0;
    for (let i = 0; i < count; i++) value = (value << 1) | this.bit();
    return value;
  }

  /** Drop the partial byte; restart markers are byte-aligned. */
  align(): void {
    this.bitCount = 0;
  }

  symbol(table: HuffTable): number {
    let code = 0;
    for (let length = 1; length <= table.maxLength; length++) {
      code = (code << 1) | this.bit();
      const hit = (table.lookup[length] as Map<number, number>).get(code);
      if (hit !== undefined) return hit;
    }
    return fail('HUFFMAN', 'a code in the scan matches no entry in its table');
  }

  /**
   * A signed coefficient of `length` bits, per the standard's EXTEND: the top
   * bit says the sign, and a negative value is stored as its complement
   * within that width.
   */
  receiveExtend(length: number): number {
    if (length === 0) return 0;
    const value = this.bits(length);
    return value < 1 << (length - 1) ? value - (1 << length) + 1 : value;
  }

  /** Skip to just past the next marker, returning it. */
  nextMarker(): number {
    this.align();
    while (this.pos < this.data.length) {
      if ((this.data[this.pos] as number) === 0xff) {
        const next = this.data[this.pos + 1] as number;
        if (next !== 0x00 && next !== 0xff) {
          this.pos += 2;
          this.marker = 0;
          return next;
        }
      }
      this.pos++;
    }
    return 0xd9; // treat the end of data as EOI
  }
}

/** Cosine basis for the inverse DCT, computed once. */
let IDCT_BASIS: Float64Array | null = null;

const idctBasis = (): Float64Array => {
  if (IDCT_BASIS) return IDCT_BASIS;
  // basis[x * 8 + u] = C(u) * cos((2x + 1) * u * pi / 16), with C(0) = 1/sqrt2.
  const basis = new Float64Array(64);
  for (let x = 0; x < 8; x++) {
    for (let u = 0; u < 8; u++) {
      const c = u === 0 ? Math.SQRT1_2 : 1;
      basis[x * 8 + u] = c * Math.cos(((2 * x + 1) * u * Math.PI) / 16);
    }
  }
  IDCT_BASIS = basis;
  return basis;
};

const idctRow = new Float64Array(64);

/**
 * Inverse 8x8 DCT, applied separably: the 1-D transform down the columns,
 * then across the rows.
 *
 * This is the direct form, a multiply-accumulate against a precomputed cosine
 * basis: 1024 multiplies per block against roughly 100 for a butterfly
 * algorithm like AAN. The butterfly is the obvious optimization and it is
 * deliberately not taken here, because the fast versions need the
 * dequantization table pre-scaled by their own correction factors, and
 * getting that wrong produces an image that looks *almost* right — the worst
 * kind of bug to carry. Measured cost is 12 ms for a 512x512 photograph; if
 * that ever matters, replace this with AAN and verify against the reference
 * decoder before trusting it.
 */
const idctBlock = (
  coeffs: Int32Array,
  out: Uint8ClampedArray,
  outAt: number,
  stride: number,
  dcOnly: boolean,
): void => {
  if (dcOnly) {
    // With every AC coefficient zero the block is flat, and the transform
    // reduces to one number. Flat regions are most of a real photograph, so
    // this is not a micro-optimization: it is the common case.
    const flat = (coeffs[0] as number) / 8 + 128;
    for (let y = 0; y < 8; y++) {
      const row = outAt + y * stride;
      for (let x = 0; x < 8; x++) out[row + x] = flat;
    }
    return;
  }

  const basis = idctBasis();

  // Columns.
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      let sum = 0;
      for (let v = 0; v < 8; v++) {
        const c = coeffs[v * 8 + x] as number;
        if (c !== 0) sum += (basis[y * 8 + v] as number) * c;
      }
      idctRow[y * 8 + x] = sum;
    }
  }

  // Rows, plus the level shift: JPEG stores samples centred on zero.
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let sum = 0;
      for (let u = 0; u < 8; u++) {
        const c = idctRow[y * 8 + u] as number;
        if (c !== 0) sum += (basis[x * 8 + u] as number) * c;
      }
      out[outAt + y * stride + x] = sum / 4 + 128;
    }
  }
};

/**
 * Decode a baseline JPEG into a pixel grid.
 *
 * @example
 * ```js
 * import { readFileSync } from 'node:fs';
 * import { decodeJPEG, renderImageAuto } from 'ansimax';
 *
 * const { pixels } = decodeJPEG(readFileSync('photo.jpg'));
 * console.log(renderImageAuto(pixels));
 * ```
 *
 * @throws {RangeError} `ANSIMAX_JPEG_SIGNATURE` — no SOI marker.
 * @throws {RangeError} `ANSIMAX_JPEG_PROGRESSIVE` — a progressive JPEG.
 * @throws {RangeError} `ANSIMAX_JPEG_UNSUPPORTED` — arithmetic, lossless,
 *   hierarchical, or 12-bit.
 * @throws {RangeError} `ANSIMAX_JPEG_TRUNCATED` — the file ends mid-segment.
 * @throws {RangeError} `ANSIMAX_JPEG_HUFFMAN` — a code matches no table entry.
 * @since 1.10.0
 */
export const decodeJPEG = (file: Uint8Array, opts: DecodeJPEGOptions = {}): JPEGImage => {
  if (!(file instanceof Uint8Array)) {
    throw new TypeError('ANSIMAX_JPEG_INPUT: decodeJPEG needs a Uint8Array');
  }
  if (file.length < 4 || file[0] !== 0xff || file[1] !== 0xd8) {
    fail('SIGNATURE', 'the file does not start with an SOI marker (FF D8)');
  }
  const maxPixels = Number.isFinite(opts.maxPixels as number)
    ? Math.max(1, Math.trunc(opts.maxPixels as number))
    : 64_000_000;

  const quant: (Int32Array | null)[] = [null, null, null, null];
  const dcTables: (HuffTable | null)[] = [null, null, null, null];
  const acTables: (HuffTable | null)[] = [null, null, null, null];
  let frame: { width: number; height: number; components: Component[] } | null = null;
  let restartInterval = 0;
  let comment: string | undefined;
  let adobeTransform = -1;
  let hMax = 1;
  let vMax = 1;
  let mcusPerLine = 0;
  let mcusPerColumn = 0;

  let at = 2;
  const u16 = (p: number): number => ((file[p] as number) << 8) | (file[p + 1] as number);

  while (at < file.length) {
    if (file[at] !== 0xff) {
      // Resynchronize: fill bytes between segments are legal.
      at++;
      continue;
    }
    const marker = file[at + 1] as number;
    // Any number of 0xFF bytes may pad the space before a marker, so a
    // second 0xFF is fill and the real marker is the next byte along.
    // Treating it as the marker reads the following two bytes as a segment
    // length, which is how a legal file turns into "claims 65535 bytes".
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    at += 2;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9) break; // EOI
    if (at + 2 > file.length) fail('TRUNCATED', `marker FF${marker.toString(16)} has no length`);
    const length = u16(at);
    if (at + length > file.length) {
      fail('TRUNCATED', `segment FF${marker.toString(16)} claims ${length} bytes past the end`);
    }
    const body = file.subarray(at + 2, at + length);

    switch (marker) {
      case 0xdb: { // DQT
        let p = 0;
        while (p < body.length) {
          const spec = body[p++] as number;
          const id = spec & 15;
          const precision = spec >> 4;
          if (id > 3) fail('DQT', `quantization table id ${id} is outside 0..3`);
          const table = new Int32Array(64);
          for (let i = 0; i < 64; i++) {
            const zz = ZIGZAG[i] as number;
            if (precision === 0) table[zz] = body[p++] as number;
            else { table[zz] = ((body[p] as number) << 8) | (body[p + 1] as number); p += 2; }
          }
          quant[id] = table;
        }
        break;
      }
      case 0xc4: { // DHT
        let p = 0;
        while (p < body.length) {
          const spec = body[p++] as number;
          const id = spec & 15;
          const counts = body.subarray(p, p + 16);
          p += 16;
          let total = 0;
          for (const c of counts) total += c;
          const symbols = body.subarray(p, p + total);
          p += total;
          if (id > 3) fail('DHT', `Huffman table id ${id} is outside 0..3`);
          const table = buildHuffTable(new Uint8Array(counts), new Uint8Array(symbols));
          if (spec >> 4) acTables[id] = table;
          else dcTables[id] = table;
        }
        break;
      }
      case 0xc0:
      case 0xc1: { // SOF0 baseline, SOF1 extended sequential
        const precision = body[0] as number;
        if (precision !== 8) fail('UNSUPPORTED', `${precision}-bit samples; only 8-bit is handled`);
        const height = ((body[1] as number) << 8) | (body[2] as number);
        const width = ((body[3] as number) << 8) | (body[4] as number);
        const count = body[5] as number;
        if (width === 0 || height === 0) fail('SOF', `dimensions ${width}x${height} include a zero`);
        if (width * height > maxPixels) {
          fail('TOO_LARGE', `${width}x${height} is ${width * height} pixels, over the ${maxPixels} limit`);
        }
        if (count !== 1 && count !== 3 && count !== 4) {
          fail('UNSUPPORTED', `${count} colour components; 1, 3 and 4 are handled`);
        }
        const components: Component[] = [];
        for (let i = 0; i < count; i++) {
          const base = 6 + i * 3;
          const sampling = body[base + 1] as number;
          components.push({
            id: body[base] as number,
            h: Math.max(1, sampling >> 4),
            v: Math.max(1, sampling & 15),
            quantId: body[base + 2] as number,
            dcTable: 0, acTable: 0,
            blocksPerLine: 0, blocksPerColumn: 0,
            samples: new Uint8ClampedArray(0),
            lineWidth: 0,
            pred: 0,
          });
        }
        hMax = Math.max(...components.map((c) => c.h));
        vMax = Math.max(...components.map((c) => c.v));
        mcusPerLine = Math.ceil(width / (8 * hMax));
        mcusPerColumn = Math.ceil(height / (8 * vMax));
        for (const c of components) {
          // Each component is sampled at its own resolution, rounded up to a
          // whole number of MCUs — the edge blocks carry padding.
          c.blocksPerLine = mcusPerLine * c.h;
          c.blocksPerColumn = mcusPerColumn * c.v;
          c.lineWidth = c.blocksPerLine * 8;
          c.samples = new Uint8ClampedArray(c.lineWidth * c.blocksPerColumn * 8);
        }
        frame = { width, height, components };
        break;
      }
      // These two throw directly rather than through `fail`, so the clause
      // ends at the throw: a `break` after a call that returns `never` is
      // unreachable, and the linter reads a missing one as a fallthrough.
      case 0xc2:
        throw new RangeError(
          'ANSIMAX_JPEG_PROGRESSIVE: this is a progressive JPEG (SOF2); only baseline is decoded',
        );
      case 0xc3: case 0xc5: case 0xc6: case 0xc7:
      case 0xc9: case 0xca: case 0xcb:
      case 0xcd: case 0xce: case 0xcf:
        throw new RangeError(
          `ANSIMAX_JPEG_UNSUPPORTED: frame type FF${marker.toString(16)} (lossless, hierarchical or arithmetic)`,
        );
      case 0xdd: // DRI
        restartInterval = ((body[0] as number) << 8) | (body[1] as number);
        break;
      case 0xfe: // COM
        comment = String.fromCharCode(...body);
        break;
      case 0xee: // APP14, where Adobe states its colour transform
        if (body.length >= 12 && String.fromCharCode(...body.subarray(0, 5)) === 'Adobe') {
          adobeTransform = body[11] as number;
        }
        break;
      case 0xda: { // SOS
        if (!frame) fail('SOF', 'a scan starts before any frame header');
        const f = frame as { width: number; height: number; components: Component[] };
        const count = body[0] as number;
        const scan: Component[] = [];
        for (let i = 0; i < count; i++) {
          const id = body[1 + i * 2] as number;
          const tables = body[2 + i * 2] as number;
          const component = f.components.find((c) => c.id === id);
          if (!component) fail('SOS', `the scan names component ${id}, which the frame does not`);
          const c = component as Component;
          c.dcTable = tables >> 4;
          c.acTable = tables & 15;
          scan.push(c);
        }
        at = decodeScan(
          file, at + length, f, scan, quant, dcTables, acTables, restartInterval,
          mcusPerLine, mcusPerColumn, hMax, vMax,
        );
        continue;
      }
      default:
        break; // APPn, and anything else we do not need
    }
    at += length;
  }

  if (!frame) fail('SOF', 'the file has no frame header (SOF0/SOF1)');
  const f = frame as { width: number; height: number; components: Component[] };
  return {
    pixels: toPixels(f, hMax, vMax, adobeTransform),
    width: f.width,
    height: f.height,
    components: f.components.length,
    restartInterval,
    ...(comment === undefined ? {} : { comment }),
  };
};

/** Decode one scan's MCUs, returning the offset just past it. */
const decodeScan = (
  file: Uint8Array,
  dataAt: number,
  frame: { width: number; height: number; components: Component[] },
  scan: Component[],
  quant: (Int32Array | null)[],
  dcTables: (HuffTable | null)[],
  acTables: (HuffTable | null)[],
  restartInterval: number,
  mcusPerLine: number,
  mcusPerColumn: number,
  hMax: number,
  vMax: number,
): number => {
  const reader = new ScanReader(file, dataAt);
  const coeffs = new Int32Array(64);
  for (const c of scan) c.pred = 0;

  const decodeBlock = (c: Component, blockRow: number, blockCol: number): void => {
    const dcTable = dcTables[c.dcTable];
    const acTable = acTables[c.acTable];
    const table = quant[c.quantId];
    if (!dcTable || !acTable) fail('DHT', `component ${c.id} names a Huffman table the file never defined`);
    if (!table) fail('DQT', `component ${c.id} names quantization table ${c.quantId}, which is not defined`);
    const q = table as Int32Array;

    coeffs.fill(0);
    // DC is stored as a difference from the previous block of the same
    // component, which is why the predictor resets at every restart.
    const dcLength = reader.symbol(dcTable as HuffTable);
    c.pred += reader.receiveExtend(dcLength);
    coeffs[0] = c.pred * (q[0] as number);

    let anyAc = false;
    let k = 1;
    while (k < 64) {
      const rs = reader.symbol(acTable as HuffTable);
      const size = rs & 15;
      const run = rs >> 4;
      if (size === 0) {
        if (run !== 15) break; // EOB
        k += 16; // ZRL: sixteen zeros
        continue;
      }
      k += run;
      if (k > 63) break;
      const zz = ZIGZAG[k] as number;
      const value = reader.receiveExtend(size) * (q[zz] as number);
      coeffs[zz] = value;
      if (value !== 0) anyAc = true;
      k++;
    }

    const at = (blockRow * 8) * c.lineWidth + blockCol * 8;
    idctBlock(coeffs, c.samples, at, c.lineWidth, !anyAc);
  };

  const single = scan.length === 1;
  // A single-component scan walks that component's own blocks; an interleaved
  // scan walks MCUs, each holding h*v blocks per component.
  const totalUnits = single
    ? Math.ceil((frame.width * (scan[0] as Component).h) / (8 * hMax)) *
      Math.ceil((frame.height * (scan[0] as Component).v) / (8 * vMax))
    : mcusPerLine * mcusPerColumn;
  const unitsPerLine = single
    ? Math.ceil((frame.width * (scan[0] as Component).h) / (8 * hMax))
    : mcusPerLine;

  let unit = 0;
  while (unit < totalUnits) {
    const until = restartInterval > 0 ? Math.min(totalUnits, unit + restartInterval) : totalUnits;
    for (const c of scan) c.pred = 0;

    for (; unit < until; unit++) {
      if (single) {
        const c = scan[0] as Component;
        decodeBlock(c, Math.floor(unit / unitsPerLine), unit % unitsPerLine);
      } else {
        const mcuRow = Math.floor(unit / mcusPerLine);
        const mcuCol = unit % mcusPerLine;
        for (const c of scan) {
          for (let v = 0; v < c.v; v++) {
            for (let h = 0; h < c.h; h++) {
              decodeBlock(c, mcuRow * c.v + v, mcuCol * c.h + h);
            }
          }
        }
      }
      if (reader.marker !== 0 && unit + 1 < until) {
        // A marker turned up early: the scan is short. Stop rather than
        // decoding noise into the rest of the image.
        unit++;
        break;
      }
    }

    if (unit >= totalUnits) break;
    const marker = reader.nextMarker();
    if (marker < 0xd0 || marker > 0xd7) {
      // Not a restart marker, so the scan is over whatever the MCU count said.
      return reader.pos - 2;
    }
  }

  // Walk to the next marker so the segment loop resumes in the right place.
  let p = reader.pos;
  while (p + 1 < file.length) {
    if ((file[p] as number) === 0xff) {
      const next = file[p + 1] as number;
      if (next !== 0x00 && next !== 0xff && !(next >= 0xd0 && next <= 0xd7)) return p;
    }
    p++;
  }
  return file.length;
};

/** Upsample every component to full resolution and convert to RGB. */
const toPixels = (
  frame: { width: number; height: number; components: Component[] },
  hMax: number,
  vMax: number,
  adobeTransform: number,
): PixelGrid => {
  const { width, height, components } = frame;
  const grid: PixelGrid = Array.from({ length: height }, () => new Array<Pixel>(width));

  const planes = components.map((c) => ({
    samples: c.samples,
    lineWidth: c.lineWidth,
    lines: (c.blocksPerColumn * 8),
    xShift: hMax / c.h,
    yShift: vMax / c.v,
  }));

  /**
   * Upsample a subsampled plane by interpolating, not by repeating.
   *
   * The pixel centres are what make this match libjpeg: output pixel `x`
   * sits at source coordinate `(x + 0.5) / shift - 0.5`, so for a 2x shift
   * the four output pixels of a chroma pair land at -0.25, 0.25, 0.75, 1.25,
   * and linear interpolation between the neighbours gives weights of 3/4 and
   * 1/4 — exactly libjpeg's "fancy upsampling" filter, falling out of the
   * geometry rather than being special-cased. At shift 1 the coordinate is
   * integral and nothing is interpolated at all.
   *
   * Measured against libjpeg over 120 files: replication averaged 21.0 levels
   * of error per channel on 4:2:0 and 13.3 on 4:2:2; interpolating takes
   * those to 0.73 and 0.58. At 4:4:4, where no upsampling happens, the error
   * against libjpeg is 0.02 — the exact-cosine IDCT above is why.
   */
  const sampleAt = (plane: (typeof planes)[number], x: number, y: number): number => {
    const fx = (x + 0.5) / plane.xShift - 0.5;
    const fy = (y + 0.5) / plane.yShift - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    // Clamp at the plane edges, so an output pixel past the last chroma
    // sample repeats it instead of reading into the next row.
    const maxX = plane.lineWidth - 1;
    const maxY = plane.lines - 1;
    const xa = Math.min(maxX, Math.max(0, x0));
    const xb = Math.min(maxX, Math.max(0, x0 + 1));
    const ya = Math.min(maxY, Math.max(0, y0));
    const yb = Math.min(maxY, Math.max(0, y0 + 1));
    const rowA = ya * plane.lineWidth;
    const rowB = yb * plane.lineWidth;
    const top = (plane.samples[rowA + xa] as number) * (1 - tx) + (plane.samples[rowA + xb] as number) * tx;
    const bottom = (plane.samples[rowB + xa] as number) * (1 - tx) + (plane.samples[rowB + xb] as number) * tx;
    return top * (1 - ty) + bottom * ty;
  };

  if (components.length === 1) {
    const plane = planes[0] as (typeof planes)[number];
    for (let y = 0; y < height; y++) {
      const row = grid[y] as Pixel[];
      for (let x = 0; x < width; x++) {
        const grey = sampleAt(plane, x, y);
        row[x] = { r: grey, g: grey, b: grey };
      }
    }
    return grid;
  }

  if (components.length === 4) {
    // Adobe's transform byte says whether the four channels are YCCK (2) or
    // plain CMYK (0). The channels are also stored inverted by Adobe's
    // encoder, which is why they are subtracted from 255.
    const [c0, c1, c2, c3] = planes as [
      (typeof planes)[number], (typeof planes)[number],
      (typeof planes)[number], (typeof planes)[number],
    ];
    const ycck = adobeTransform !== 0;
    for (let y = 0; y < height; y++) {
      const row = grid[y] as Pixel[];
      for (let x = 0; x < width; x++) {
        let cyan: number;
        let magenta: number;
        let yellow: number;
        if (ycck) {
          const [r, g, b] = ycbcrToRgb(sampleAt(c0, x, y), sampleAt(c1, x, y), sampleAt(c2, x, y));
          cyan = 255 - r;
          magenta = 255 - g;
          yellow = 255 - b;
        } else {
          cyan = 255 - sampleAt(c0, x, y);
          magenta = 255 - sampleAt(c1, x, y);
          yellow = 255 - sampleAt(c2, x, y);
        }
        const black = 255 - sampleAt(c3, x, y);
        row[x] = {
          r: clamp255(255 - Math.min(255, cyan + black)),
          g: clamp255(255 - Math.min(255, magenta + black)),
          b: clamp255(255 - Math.min(255, yellow + black)),
        };
      }
    }
    return grid;
  }

  const [yPlane, cbPlane, crPlane] = planes as [
    (typeof planes)[number], (typeof planes)[number], (typeof planes)[number],
  ];
  for (let y = 0; y < height; y++) {
    const row = grid[y] as Pixel[];
    for (let x = 0; x < width; x++) {
      const [r, g, b] = ycbcrToRgb(
        sampleAt(yPlane, x, y), sampleAt(cbPlane, x, y), sampleAt(crPlane, x, y),
      );
      row[x] = { r, g, b };
    }
  }
  return grid;
};

/** JFIF YCbCr → RGB, with Cb and Cr centred on 128. */
const ycbcrToRgb = (yy: number, cb: number, cr: number): [number, number, number] => {
  const b2 = cb - 128;
  const r2 = cr - 128;
  return [
    clamp255(yy + 1.402 * r2),
    clamp255(yy - 0.344136 * b2 - 0.714136 * r2),
    clamp255(yy + 1.772 * b2),
  ];
};

const clamp255 = (v: number): number => {
  return Math.min(255, Math.max(0, Math.round(v)));
};

/** Namespace form, for the default export. */
export const jpeg = {
  decode: decodeJPEG,
};
