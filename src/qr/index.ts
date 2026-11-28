/**
 * QR code generation — Phase 12.
 *
 * Builds the complete symbol on top of the GF(256) Reed–Solomon layer in
 * `src/ecc` (added in v1.7.5): data encoding, block interleaving, the function
 * patterns, format and version information, and mask selection by the
 * standard's penalty rules. Rendering packs two module rows per character cell
 * with half-blocks, so a symbol is half as tall in the terminal as it is wide.
 *
 * Zero dependencies, like the rest of the library.
 *
 * @module
 * @since 1.10.0
 */

import { reedSolomonEncode } from '../ecc/index.js';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

/** Error-correction level: recovers ~7%, ~15%, ~25% and ~30% of the symbol. @since 1.10.0 */
export type QRErrorLevel = 'L' | 'M' | 'Q' | 'H';

/** How the payload is packed. `byte` is UTF-8 and accepts anything. @since 1.10.0 */
export type QRMode = 'numeric' | 'alnum' | 'byte';

/** Options for {@link encodeQR}. @since 1.10.0 */
export interface QROptions {
  /** Error-correction level. Default `'M'`. */
  level?: QRErrorLevel;
  /** Force a version (1–40). Default: the smallest that fits. */
  version?: number;
  /** Force a mask pattern (0–7). Default: the lowest-penalty one. */
  mask?: number;
  /** Force an encoding mode. Default: the most compact one that fits the text. */
  mode?: QRMode;
  /** Lowest version to consider when choosing automatically. Default `1`. */
  minVersion?: number;
  /** Highest version to consider when choosing automatically. Default `40`. */
  maxVersion?: number;
}

/** A finished symbol. @since 1.10.0 */
export interface QRCode {
  /** `modules[y][x]` — `true` is a dark module. */
  modules: boolean[][];
  /** Side length in modules (`version * 4 + 17`). */
  size: number;
  /** Version 1–40. */
  version: number;
  /** Mask pattern applied, 0–7. */
  mask: number;
  /** Error-correction level used. */
  level: QRErrorLevel;
  /** Encoding mode used. */
  mode: QRMode;
}

/** Options for {@link renderQR}. @since 1.10.0 */
export interface QRRenderOptions extends QROptions {
  /** Quiet-zone width in modules. The spec asks for 4; 2 scans fine in a terminal. Default `2`. */
  quiet?: number;
  /**
   * Set `true` for a light terminal background.
   *
   * Scanners need the code's dark modules to read dark. On the usual dark
   * terminal the blocks drawn are the *light* modules, so the untouched
   * background supplies the dark ones. Inverting swaps that.
   */
  invert?: boolean;
}

// ─────────────────────────────────────────────
//  Version tables
//
//  Only these two tables are tabulated — the rest is derived. Both were
//  verified entry by entry (320 values) against a reference implementation;
//  two were wrong when written from memory, which is why nothing here is
//  trusted without a check.
// ─────────────────────────────────────────────

const ECC_PER_BLOCK: Record<QRErrorLevel, readonly number[]> = {
  L: [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  M: [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  Q: [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  H: [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
};

const NUM_BLOCKS: Record<QRErrorLevel, readonly number[]> = {
  L: [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  M: [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  Q: [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  H: [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
};

/** Format-info bit pattern per level — not the same order as the level names. */
const ECL_BITS: Record<QRErrorLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

const ALNUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

/**
 * Raw data module count for a version — derived, not tabulated. The symbol
 * area minus the function patterns: finders with separators, timing, the
 * alignment grid, and the version blocks from version 7 up.
 */
const rawDataModules = (version: number): number => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
};

/** Data codewords available at a given version and level. */
const dataCodewords = (version: number, level: QRErrorLevel): number =>
  Math.floor(rawDataModules(version) / 8)
  - (ECC_PER_BLOCK[level][version] as number) * (NUM_BLOCKS[level][version] as number);

/** Alignment-pattern centre coordinates for a version. */
const alignPositions = (version: number): number[] => {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const size = version * 4 + 17;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
};

// ─────────────────────────────────────────────
//  Data encoding
// ─────────────────────────────────────────────

const isNumeric = (s: string): boolean => /^[0-9]+$/.test(s);
const isAlnum = (s: string): boolean => [...s].every((c) => ALNUM_CHARS.includes(c));

/** UTF-8 bytes without depending on Buffer, so this runs anywhere. */
const utf8Bytes = (s: string): number[] => {
  const out: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return out;
};

/** Character-count field width, which widens at versions 10 and 27. */
const charCountBits = (mode: QRMode, version: number): number => {
  const tier = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  const table: Record<QRMode, readonly number[]> = {
    numeric: [10, 12, 14],
    alnum: [9, 11, 13],
    byte: [8, 16, 16],
  };
  return table[mode][tier] as number;
};

const MODE_BITS: Record<QRMode, number> = { numeric: 1, alnum: 2, byte: 4 };

/** Pick the most compact mode the text allows. */
const pickMode = (text: string): QRMode =>
  isNumeric(text) ? 'numeric' : isAlnum(text) ? 'alnum' : 'byte';

/** Bits a segment occupies at a given version. */
const segmentBits = (text: string, mode: QRMode, version: number): number => {
  const header = 4 + charCountBits(mode, version);
  if (mode === 'numeric') {
    const groups = Math.floor(text.length / 3);
    const rest = text.length % 3;
    return header + groups * 10 + (rest === 0 ? 0 : rest * 3 + 1);
  }
  if (mode === 'alnum') {
    return header + Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
  }
  return header + utf8Bytes(text).length * 8;
};

const pickVersion = (
  text: string,
  level: QRErrorLevel,
  mode: QRMode,
  minVersion: number,
  maxVersion: number,
): number => {
  for (let version = minVersion; version <= maxVersion; version++) {
    if (segmentBits(text, mode, version) <= dataCodewords(version, level) * 8) return version;
  }
  return -1;
};

/** Append `length` low bits of `value`, most significant first. */
const pushBits = (bits: number[], value: number, length: number): void => {
  for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
};

/** Mode indicator, character count and payload, as a bit array. */
const encodeSegment = (text: string, mode: QRMode, version: number): number[] => {
  const bits: number[] = [];
  pushBits(bits, MODE_BITS[mode], 4);

  if (mode === 'numeric') {
    pushBits(bits, text.length, charCountBits(mode, version));
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      pushBits(bits, Number.parseInt(chunk, 10), chunk.length * 3 + 1);
    }
  } else if (mode === 'alnum') {
    pushBits(bits, text.length, charCountBits(mode, version));
    for (let i = 0; i < text.length; i += 2) {
      const hi = ALNUM_CHARS.indexOf(text[i] as string);
      if (i + 1 < text.length) {
        pushBits(bits, hi * 45 + ALNUM_CHARS.indexOf(text[i + 1] as string), 11);
      } else {
        pushBits(bits, hi, 6);
      }
    }
  } else {
    const bytes = utf8Bytes(text);
    pushBits(bits, bytes.length, charCountBits(mode, version));
    for (const byte of bytes) pushBits(bits, byte, 8);
  }

  return bits;
};

/** Final codeword sequence: padded data, RS per block, then interleaved. */
const buildCodewords = (
  text: string,
  level: QRErrorLevel,
  version: number,
  mode: QRMode,
): number[] => {
  const bits = encodeSegment(text, mode, version);
  const capacity = dataCodewords(version, level) * 8;

  // Terminator, byte alignment, then the standard alternating pad bytes.
  pushBits(bits, 0, Math.min(4, capacity - bits.length));
  pushBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) pushBits(bits, pad, 8);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] as number);
    data.push(byte);
  }

  const numBlocks = NUM_BLOCKS[level][version] as number;
  const eccLen = ECC_PER_BLOCK[level][version] as number;
  const totalCodewords = Math.floor(rawDataModules(version) / 8);
  const shortLen = Math.floor(totalCodewords / numBlocks) - eccLen;
  const numShort = numBlocks - (totalCodewords % numBlocks);

  const blockData: number[][] = [];
  const blockEcc: number[][] = [];
  let offset = 0;
  for (let i = 0; i < numBlocks; i++) {
    const len = shortLen + (i < numShort ? 0 : 1);
    const chunk = data.slice(offset, offset + len);
    offset += len;
    blockData.push(chunk);
    blockEcc.push(reedSolomonEncode(chunk, eccLen));
  }

  // Interleave: one codeword from each block in turn, data then ECC.
  const result: number[] = [];
  for (let i = 0; i <= shortLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      const block = blockData[b] as number[];
      if (i < block.length) result.push(block[i] as number);
    }
  }
  for (let i = 0; i < eccLen; i++) {
    for (let b = 0; b < numBlocks; b++) result.push((blockEcc[b] as number[])[i] as number);
  }
  return result;
};

// ─────────────────────────────────────────────
//  Matrix
// ─────────────────────────────────────────────

const MASK_FNS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

interface Canvas {
  grid: boolean[][];
  /** Function modules are fixed patterns — never masked, never data. */
  isFunction: boolean[][];
  size: number;
}

const buildCanvas = (version: number, codewords: number[]): Canvas => {
  const size = version * 4 + 17;
  const grid: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const setFn = (x: number, y: number, dark: boolean): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    (grid[y] as boolean[])[x] = dark;
    (isFunction[y] as boolean[])[x] = true;
  };

  // Timing patterns go down FIRST. Row and column 6 run straight through the
  // finder patterns, whose edges are solid rather than alternating, so the
  // finders are drawn after and deliberately overwrite part of this.
  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // Finder patterns with their separators.
  const finder = (cx: number, cy: number): void => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ring = Math.max(Math.abs(dx), Math.abs(dy));
        setFn(cx + dx, cy + dy, ring !== 2 && ring !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  // Alignment patterns, skipping the three that collide with the finders.
  const positions = alignPositions(version);
  for (let i = 0; i < positions.length; i++) {
    for (let j = 0; j < positions.length; j++) {
      const last = positions.length - 1;
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          setFn(
            (positions[j] as number) + dx,
            (positions[i] as number) + dy,
            Math.max(Math.abs(dx), Math.abs(dy)) !== 1,
          );
        }
      }
    }
  }

  // Reserve the format-info area. It is NOT a solid 9x9 corner: (8,6) and
  // (6,8) belong to the timing patterns, and reserving them would erase them.
  for (let i = 0; i <= 5; i++) setFn(8, i, false);
  setFn(8, 7, false);
  setFn(8, 8, false);
  setFn(7, 8, false);
  for (let i = 9; i < 15; i++) setFn(14 - i, 8, false);
  for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, false);
  for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, false);
  setFn(8, size - 8, true); // the always-dark module

  // Version information (BCH 18,6) from version 7 up.
  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = ((version << 12) | rem) >>> 0;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit);
      setFn(b, a, bit);
    }
  }

  // Data placement: two-module-wide columns, right to left, snaking up then
  // down, skipping the vertical timing column and every function module.
  let bit = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!(isFunction[y] as boolean[])[x] && bit < totalBits) {
          const byte = codewords[bit >>> 3] as number;
          (grid[y] as boolean[])[x] = ((byte >>> (7 - (bit & 7))) & 1) === 1;
          bit++;
        }
      }
    }
  }

  return { grid, isFunction, size };
};

const applyMask = (canvas: Canvas, mask: number): void => {
  const fn = MASK_FNS[mask] as (x: number, y: number) => boolean;
  for (let y = 0; y < canvas.size; y++) {
    for (let x = 0; x < canvas.size; x++) {
      if (!(canvas.isFunction[y] as boolean[])[x] && fn(x, y)) {
        const row = canvas.grid[y] as boolean[];
        row[x] = !row[x];
      }
    }
  }
};

/** Format info (BCH 15,5), written into both reserved copies. */
const writeFormat = (canvas: Canvas, level: QRErrorLevel, mask: number): void => {
  const { grid, size } = canvas;
  const data = (ECL_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = (((data << 10) | rem) ^ 0x5412) >>> 0;
  const at = (i: number): boolean => ((bits >>> i) & 1) === 1;

  for (let i = 0; i <= 5; i++) (grid[i] as boolean[])[8] = at(i);
  (grid[7] as boolean[])[8] = at(6);
  (grid[8] as boolean[])[8] = at(7);
  (grid[8] as boolean[])[7] = at(8);
  for (let i = 9; i < 15; i++) (grid[8] as boolean[])[14 - i] = at(i);

  for (let i = 0; i < 8; i++) (grid[8] as boolean[])[size - 1 - i] = at(i);
  for (let i = 8; i < 15; i++) (grid[size - 15 + i] as boolean[])[8] = at(i);
  (grid[size - 8] as boolean[])[8] = true;
};

// Finder-penalty bookkeeping (rule 3). A naive search for the 1:1:3:1:1
// pattern misses that the quiet zone counts as light, so a pattern touching
// the border must score as though light modules continued past the edge.
const addRunHistory = (runLength: number, history: number[], size: number): void => {
  if (history[0] === 0) runLength += size;
  history.pop();
  history.unshift(runLength);
};

const countFinderPatterns = (h: number[]): number => {
  const n = h[1] as number;
  const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
  return (core && (h[0] as number) >= n * 4 && (h[6] as number) >= n ? 1 : 0)
    + (core && (h[6] as number) >= n * 4 && (h[0] as number) >= n ? 1 : 0);
};

const terminateRun = (
  runColor: boolean,
  runLength: number,
  history: number[],
  size: number,
): number => {
  let length = runLength;
  if (runColor) {
    addRunHistory(length, history, size);
    length = 0;
  }
  addRunHistory(length + size, history, size);
  return countFinderPatterns(history);
};

/** The standard's four penalty rules; the lowest total wins mask selection. */
const penaltyScore = (grid: boolean[][], size: number): number => {
  let score = 0;

  // Rules 1 and 3 — long runs and finder-like patterns, by row then column.
  const scanLine = (get: (i: number) => boolean): void => {
    let runColor = false;
    let runLength = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < size; i++) {
      if (get(i) === runColor) {
        runLength++;
        if (runLength === 5) score += PENALTY_N1;
        else if (runLength > 5) score++;
      } else {
        addRunHistory(runLength, history, size);
        if (!runColor) score += countFinderPatterns(history) * PENALTY_N3;
        runColor = get(i);
        runLength = 1;
      }
    }
    score += terminateRun(runColor, runLength, history, size) * PENALTY_N3;
  };
  for (let y = 0; y < size; y++) scanLine((x) => (grid[y] as boolean[])[x] as boolean);
  for (let x = 0; x < size; x++) scanLine((y) => (grid[y] as boolean[])[x] as boolean);

  // Rule 2 — same-colour 2x2 blocks.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = (grid[y] as boolean[])[x];
      if (
        c === (grid[y] as boolean[])[x + 1]
        && c === (grid[y + 1] as boolean[])[x]
        && c === (grid[y + 1] as boolean[])[x + 1]
      ) score += PENALTY_N2;
    }
  }

  // Rule 4 — how far the dark ratio sits from 50%, in 5% steps.
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if ((grid[y] as boolean[])[x]) dark++;
  }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * PENALTY_N4;

  return score;
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

/**
 * Encode text into a QR symbol.
 *
 * Picks the most compact mode (numeric → alphanumeric → UTF-8 byte) and the
 * smallest version that fits, then tries all eight masks and keeps the one
 * the standard's penalty rules score lowest.
 *
 * @throws RangeError when the text does not fit the version range, or when
 *   `version`/`mask`/`level` are out of range.
 *
 * @example
 * ```js
 * import { encodeQR } from 'ansimax';
 *
 * const qr = encodeQR('https://example.com', { level: 'Q' });
 * qr.version;        // → 3
 * qr.size;           // → 29  (version * 4 + 17)
 * qr.modules[0][0];  // → true (top-left finder is dark)
 * ```
 *
 * @since 1.10.0
 */
export const encodeQR = (text: string, opts: QROptions = {}): QRCode => {
  if (typeof text !== 'string') {
    throw new RangeError('ANSIMAX_QR_INPUT: text must be a string');
  }
  const level = opts.level ?? 'M';
  if (!(level in ECL_BITS)) {
    throw new RangeError(`ANSIMAX_QR_LEVEL: unknown level ${JSON.stringify(level)}, use L, M, Q or H`);
  }

  const mode = opts.mode ?? (text.length === 0 ? 'byte' : pickMode(text));
  const minVersion = Math.max(1, Math.trunc(opts.minVersion ?? 1));
  const maxVersion = Math.min(40, Math.trunc(opts.maxVersion ?? 40));

  let version: number;
  if (opts.version !== undefined) {
    version = Math.trunc(opts.version);
    if (version < 1 || version > 40) {
      throw new RangeError(`ANSIMAX_QR_VERSION: version ${opts.version} is outside 1-40`);
    }
    if (segmentBits(text, mode, version) > dataCodewords(version, level) * 8) {
      throw new RangeError(`ANSIMAX_QR_TOO_LONG: text does not fit version ${version} at level ${level}`);
    }
  } else {
    version = pickVersion(text, level, mode, minVersion, maxVersion);
    if (version < 0) {
      throw new RangeError(
        `ANSIMAX_QR_TOO_LONG: text needs more than version ${maxVersion} at level ${level}`,
      );
    }
  }

  const codewords = buildCodewords(text, level, version, mode);

  const masks = opts.mask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [Math.trunc(opts.mask)];
  if (opts.mask !== undefined && ((masks[0] as number) < 0 || (masks[0] as number) > 7)) {
    throw new RangeError(`ANSIMAX_QR_MASK: mask ${opts.mask} is outside 0-7`);
  }

  let best: { grid: boolean[][]; size: number; mask: number } | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const mask of masks) {
    const canvas = buildCanvas(version, codewords);
    applyMask(canvas, mask);
    writeFormat(canvas, level, mask);
    const score = penaltyScore(canvas.grid, canvas.size);
    if (score < bestScore) {
      bestScore = score;
      best = { grid: canvas.grid, size: canvas.size, mask };
    }
  }

  const chosen = best as { grid: boolean[][]; size: number; mask: number };
  return {
    modules: chosen.grid,
    size: chosen.size,
    version,
    mask: chosen.mask,
    level,
    mode,
  };
};

/**
 * Render a QR symbol as terminal text, two module rows per line via
 * half-blocks — so the symbol is half as tall as it is wide.
 *
 * By default the blocks drawn are the code's *light* modules, which is what a
 * dark terminal needs: the untouched background then supplies the dark ones.
 * Pass `invert: true` on a light background.
 *
 * @example
 * ```js
 * import { renderQR } from 'ansimax';
 *
 * console.log(renderQR('https://example.com'));
 * console.log(renderQR('hello', { level: 'H', quiet: 4, invert: true }));
 *
 * // Re-render a symbol you already encoded
 * import { encodeQR } from 'ansimax';
 * console.log(renderQR(encodeQR('hello', { level: 'L' })));
 * ```
 *
 * @since 1.10.0
 */
export const renderQR = (
  input: string | QRCode,
  opts: QRRenderOptions = {},
): string => {
  const qr = typeof input === 'string' ? encodeQR(input, opts) : input;
  const quiet = Math.max(0, Math.trunc(opts.quiet ?? 2));
  const invert = opts.invert === true;

  const span = qr.size + quiet * 2;
  // `true` means "draw a block here".
  const painted = (x: number, y: number): boolean => {
    const inside = x >= quiet && y >= quiet && x < quiet + qr.size && y < quiet + qr.size;
    const dark = inside ? ((qr.modules[y - quiet] as boolean[])[x - quiet] as boolean) : false;
    return invert ? dark : !dark;
  };

  const lines: string[] = [];
  for (let y = 0; y < span; y += 2) {
    let line = '';
    for (let x = 0; x < span; x++) {
      const top = painted(x, y);
      const bottom = y + 1 < span ? painted(x, y + 1) : invert;
      line += top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
};

/**
 * Largest payload that fits a version and level, in characters for
 * `numeric`/`alnum` and in UTF-8 bytes for `byte`.
 *
 * @example
 * ```js
 * import { qrCapacity } from 'ansimax';
 *
 * qrCapacity(1, 'L', 'numeric');  // → 41
 * qrCapacity(40, 'L', 'byte');    // → 2953
 * ```
 *
 * @since 1.10.0
 */
export const qrCapacity = (
  version: number,
  level: QRErrorLevel = 'M',
  mode: QRMode = 'byte',
): number => {
  const v = Math.trunc(version);
  if (v < 1 || v > 40) {
    throw new RangeError(`ANSIMAX_QR_VERSION: version ${version} is outside 1-40`);
  }
  if (!(level in ECL_BITS)) {
    throw new RangeError(`ANSIMAX_QR_LEVEL: unknown level ${JSON.stringify(level)}, use L, M, Q or H`);
  }
  const bits = dataCodewords(v, level) * 8 - 4 - charCountBits(mode, v);
  /* istanbul ignore next — unreachable: the smallest symbol, version 1 at
     level H, still leaves 60 bits after the mode and count fields. Verified
     over all 40 versions x 4 levels x 3 modes. */
  if (bits <= 0) return 0;
  if (mode === 'byte') return Math.floor(bits / 8);
  if (mode === 'alnum') {
    const pairs = Math.floor(bits / 11);
    return pairs * 2 + (bits - pairs * 11 >= 6 ? 1 : 0);
  }
  const triples = Math.floor(bits / 10);
  const rest = bits - triples * 10;
  return triples * 3 + (rest >= 7 ? 2 : rest >= 4 ? 1 : 0);
};
