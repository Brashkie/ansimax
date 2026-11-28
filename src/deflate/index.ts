/**
 * ansimax/deflate — DEFLATE, zlib and the two checksums, from scratch.
 *
 * Phase 12 needs PNG in both directions: encoded, so a terminal that speaks
 * iTerm2's protocol can be handed an image file, and decoded, so a PNG on
 * disk can become a pixel grid. PNG's payload is a zlib stream, so that is
 * what this module is: RFC 1950 (zlib), RFC 1951 (DEFLATE), plus CRC-32 and
 * Adler-32.
 *
 * Node ships `node:zlib`, which is C and faster than this will ever be. It is
 * not used, for one reason: an import of it would tie every consumer of the
 * image code to a Node-shaped runtime, and this library renders terminals, not
 * just Node terminals. The cost of that choice is measured rather than
 * assumed — see the benchmark notes in the README.
 *
 * The encoder emits fixed-Huffman blocks (BTYPE=01) with LZ77 matching, and
 * falls back to stored blocks where compression would make things worse.
 * Dynamic Huffman (BTYPE=10) would buy another 10–15% at several times the
 * code; the *decoder* reads all three types, because a file from anywhere
 * else will certainly use dynamic.
 *
 * @module
 * @since 1.10.0
 */

// ─────────────────────────────────────────────
//  Checksums
// ─────────────────────────────────────────────

let CRC_TABLE: Int32Array | null = null;

const crcTable = (): Int32Array => {
  if (CRC_TABLE) return CRC_TABLE;
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      // The reversed CRC-32 polynomial, 0xEDB88320.
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  CRC_TABLE = table;
  return table;
};

/**
 * CRC-32 (IEEE 802.3), the checksum PNG puts on every chunk.
 *
 * @example
 * ```js
 * import { crc32 } from 'ansimax';
 *
 * crc32(new Uint8Array([0x49, 0x45, 0x4e, 0x44])); // → IEND's checksum
 * ```
 *
 * @since 1.10.0
 */
export const crc32 = (data: Uint8Array, seed = 0): number => {
  const table = crcTable();
  let c = ~seed;
  for (let i = 0; i < data.length; i++) {
    c = (table[(c ^ (data[i] as number)) & 0xff] as number) ^ (c >>> 8);
  }
  return (~c) >>> 0;
};

/**
 * Adler-32, the checksum a zlib stream ends with.
 *
 * Two running sums mod 65521 — the largest prime below 2^16, which is what
 * makes the modulus worth its weight: a prime modulus spreads single-byte
 * changes across both sums instead of letting them cancel.
 *
 * @example
 * ```js
 * import { adler32 } from 'ansimax';
 *
 * adler32(new TextEncoder().encode('abc')); // → 38600999
 * ```
 *
 * @since 1.10.0
 */
export const adler32 = (data: Uint8Array): number => {
  let a = 1;
  let b = 0;
  // 5552 is the most bytes that can be summed before `b` could overflow a
  // 32-bit signed int, so the modulo only runs once per block.
  for (let i = 0; i < data.length;) {
    const end = Math.min(i + 5552, data.length);
    for (; i < end; i++) {
      a += data[i] as number;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
};

// ─────────────────────────────────────────────
//  DEFLATE tables (RFC 1951 §3.2.5)
// ─────────────────────────────────────────────

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258,
] as const;
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
] as const;
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
] as const;
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
] as const;
/** The order code lengths are themselves written in, for dynamic blocks. */
const CLEN_ORDER = [
  16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
] as const;

/** Errors this module throws, all with an `ANSIMAX_DEFLATE_*` token. */
const fail = (token: string, detail: string): never => {
  throw new RangeError(`ANSIMAX_DEFLATE_${token}: ${detail}`);
};

// ─────────────────────────────────────────────
//  Huffman decoding
// ─────────────────────────────────────────────

/**
 * A canonical Huffman decoder, held as counts per bit length plus the symbols
 * in canonical order.
 *
 * This is the shape that needs no table to be built: decoding walks one bit
 * at a time, tracking the first code of the current length and its offset
 * into the symbol list. A flat lookup table decodes faster per symbol but
 * costs 2^maxBits entries to build, and a PNG's zlib stream is a handful of
 * blocks — the build would dominate. See the benchmark before changing this.
 */
interface Huffman {
  counts: Int32Array;
  symbols: Int32Array;
  /**
   * Flat lookup for codes of at most {@link FAST_BITS} bits, indexed by the
   * next bits of the stream read LSB-first. Each entry packs the symbol and
   * the code's length; `-1` means "longer than the table, walk it".
   *
   * The table is what makes this decoder competitive: walking bit by bit is
   * one loop iteration per bit, and most symbols in real data are short. A
   * full 15-bit table would be 32768 entries to build per block, which for a
   * PNG's handful of blocks would cost more than it saves — 9 bits is the
   * balance point measured here.
   */
  fast: Int32Array;
}

/** Bits resolved by the flat table. 9 covers the great majority of symbols. */
const FAST_BITS = 9;
const FAST_SIZE = 1 << FAST_BITS;

const buildHuffman = (lengths: Uint8Array | number[], n: number): Huffman => {
  const counts = new Int32Array(16);
  for (let i = 0; i < n; i++) counts[lengths[i] as number] = (counts[lengths[i] as number] as number) + 1;
  counts[0] = 0;

  const offsets = new Int32Array(16);
  for (let len = 1; len < 16; len++) {
    offsets[len] = (offsets[len - 1] as number) + (counts[len - 1] as number);
  }
  const symbols = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const len = lengths[i] as number;
    if (len !== 0) {
      symbols[offsets[len] as number] = i;
      offsets[len] = (offsets[len] as number) + 1;
    }
  }

  // Canonical code per symbol, then the flat table. A code of `len` bits
  // occupies every table slot whose low `len` bits match it reversed, because
  // the stream is read LSB-first while codes are assigned MSB-first.
  const fast = new Int32Array(FAST_SIZE).fill(-1);
  const next = new Int32Array(16);
  let code = 0;
  for (let len = 1; len < 16; len++) {
    code = (code + (counts[len - 1] as number)) << 1;
    next[len] = code;
  }
  for (let i = 0; i < n; i++) {
    const len = lengths[i] as number;
    if (len === 0 || len > FAST_BITS) {
      if (len > 0) next[len] = (next[len] as number) + 1;
      continue;
    }
    const canonical = next[len] as number;
    next[len] = canonical + 1;
    let reversed = 0;
    for (let b = 0; b < len; b++) reversed |= ((canonical >>> (len - 1 - b)) & 1) << b;
    const packed = (i << 4) | len;
    for (let slot = reversed; slot < FAST_SIZE; slot += 1 << len) fast[slot] = packed;
  }
  return { counts, symbols, fast };
};

/** Reads a DEFLATE bitstream, least-significant bit first. */
class BitReader {
  private data: Uint8Array;
  private pos = 0;
  private bitBuf = 0;
  private bitCount = 0;

  constructor(data: Uint8Array, offset = 0) {
    this.data = data;
    this.pos = offset;
  }

  bits(need: number): number {
    let val = this.bitBuf;
    while (this.bitCount < need) {
      if (this.pos >= this.data.length) fail('TRUNCATED', 'the stream ends inside a block');
      val |= (this.data[this.pos++] as number) << this.bitCount;
      this.bitCount += 8;
    }
    this.bitBuf = val >>> need;
    this.bitCount -= need;
    return val & ((1 << need) - 1);
  }

  /** Drop the partial byte, which stored blocks are aligned to. */
  align(): void {
    this.bitBuf = 0;
    this.bitCount = 0;
  }

  byte(): number {
    if (this.pos >= this.data.length) fail('TRUNCATED', 'the stream ends inside a stored block');
    return this.data[this.pos++] as number;
  }

  copyInto(out: Uint8Array, at: number, count: number): void {
    if (this.pos + count > this.data.length) {
      fail('TRUNCATED', `a stored block claims ${count} bytes but only ${this.data.length - this.pos} remain`);
    }
    out.set(this.data.subarray(this.pos, this.pos + count), at);
    this.pos += count;
  }

  /** The next `need` bits without consuming them; short reads pad with zeros. */
  private peek(need: number): number {
    let val = this.bitBuf;
    let have = this.bitCount;
    let at = this.pos;
    while (have < need && at < this.data.length) {
      val |= (this.data[at++] as number) << have;
      have += 8;
    }
    // At the very end of the stream there may be fewer than `need` bits left.
    // Padding with zeros is safe: the table entry is only trusted if the code
    // it names is no longer than what actually remains, and a truncated
    // stream is caught by `bits()` when the symbol is consumed.
    return val & (need >= 32 ? -1 : (1 << need) - 1);
  }

  private skip(count: number): void {
    let left = count;
    while (this.bitCount < left) {
      if (this.pos >= this.data.length) fail('TRUNCATED', 'the stream ends inside a block');
      this.bitBuf |= (this.data[this.pos++] as number) << this.bitCount;
      this.bitCount += 8;
    }
    this.bitBuf >>>= left;
    this.bitCount -= left;
    left = 0;
  }

  /**
   * Decode one symbol.
   *
   * The flat table answers in one lookup for codes of up to {@link FAST_BITS}
   * bits. Otherwise it falls back to the canonical walk, where `code`
   * accumulates the bits read, `first` is the first code of the current
   * length and `index` where that length's symbols start — the three numbers
   * that make the walk need no table at all.
   */
  symbol(table: Huffman): number {
    const entry = table.fast[this.peek(FAST_BITS)] as number;
    if (entry >= 0) {
      this.skip(entry & 15);
      return entry >>> 4;
    }

    let code = 0;
    let first = 0;
    let index = 0;
    for (let len = 1; len < 16; len++) {
      code |= this.bits(1);
      const count = table.counts[len] as number;
      if (code - first < count) return table.symbols[index + (code - first)] as number;
      index += count;
      first = (first + count) << 1;
      code <<= 1;
    }
    return fail('HUFFMAN', 'no symbol matches the bits read (over 15 bits deep)');
  }
}

let FIXED_LIT: Huffman | null = null;
let FIXED_DIST: Huffman | null = null;

const fixedTables = (): [Huffman, Huffman] => {
  if (!FIXED_LIT || !FIXED_DIST) {
    // RFC 1951 §3.2.6: 8 bits for 0..143, 9 for 144..255, 7 for 256..279,
    // 8 for 280..287. Distances are all 5 bits.
    const lit = new Uint8Array(288);
    lit.fill(8, 0, 144);
    lit.fill(9, 144, 256);
    lit.fill(7, 256, 280);
    lit.fill(8, 280, 288);
    FIXED_LIT = buildHuffman(lit, 288);
    FIXED_DIST = buildHuffman(new Uint8Array(30).fill(5), 30);
  }
  return [FIXED_LIT, FIXED_DIST];
};

/** Smallest output buffer worth allocating, and the ceiling on a size hint. */
const INITIAL_SINK = 1024;
const MAX_SINK_HINT = 1 << 26; // 64 MiB; the buffer still grows past it

/** A growable output buffer — the decompressed size is not known up front. */
class Sink {
  buf: Uint8Array;
  len = 0;

  constructor(hint: number) {
    // The hint comes from a caller, so it can be anything. A non-finite one
    // made `Math.max(1024, hint)` NaN, which `new Uint8Array` reads as a
    // length of 0 — and then `size *= 2` in grow() never moved off zero and
    // the process hung instead of throwing. Both ends are guarded.
    const want = Number.isFinite(hint) ? Math.trunc(hint) : INITIAL_SINK;
    this.buf = new Uint8Array(Math.min(Math.max(INITIAL_SINK, want), MAX_SINK_HINT));
  }

  private grow(need: number): void {
    if (this.len + need <= this.buf.length) return;
    let size = Math.max(INITIAL_SINK, this.buf.length);
    while (size < this.len + need) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  push(byte: number): void {
    this.grow(1);
    this.buf[this.len++] = byte;
  }

  room(count: number): void {
    this.grow(count);
  }

  /**
   * LZ77 back-reference. The copy must be byte by byte: a run can reference
   * bytes it is itself producing (distance 1, length 100 repeats one byte a
   * hundred times), so a bulk copy of the source range would read stale data.
   */
  repeat(distance: number, length: number): void {
    if (distance > this.len) {
      fail('DISTANCE', `a match points ${distance} bytes back but only ${this.len} have been written`);
    }
    this.grow(length);
    let from = this.len - distance;
    for (let i = 0; i < length; i++) this.buf[this.len++] = this.buf[from++] as number;
  }

  done(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }
}

/** Options for {@link inflateRaw} and {@link inflate}. */
export interface InflateOptions {
  /**
   * Expected output size, if known — PNG knows it exactly from the header.
   * Only an allocation hint; a wrong value costs a copy, never correctness.
   */
  sizeHint?: number;
}

/**
 * Decompress a raw DEFLATE stream (no zlib or gzip wrapper).
 *
 * Reads all three block types: stored, fixed Huffman and dynamic Huffman.
 *
 * @example
 * ```js
 * import { inflateRaw, deflateRaw } from 'ansimax';
 *
 * const packed = deflateRaw(new TextEncoder().encode('aaaaaaaaaab'));
 * new TextDecoder().decode(inflateRaw(packed)); // → 'aaaaaaaaaab'
 * ```
 *
 * @throws {RangeError} `ANSIMAX_DEFLATE_TRUNCATED` — the stream ends early.
 * @throws {RangeError} `ANSIMAX_DEFLATE_BLOCKTYPE` — reserved block type 3.
 * @throws {RangeError} `ANSIMAX_DEFLATE_HUFFMAN` — the bits decode to nothing.
 * @throws {RangeError} `ANSIMAX_DEFLATE_DISTANCE` — a match points before the start.
 * @since 1.10.0
 */
export const inflateRaw = (data: Uint8Array, opts: InflateOptions = {}): Uint8Array => {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('ANSIMAX_DEFLATE_INPUT: inflate needs a Uint8Array');
  }
  const reader = new BitReader(data);
  const out = new Sink(opts.sizeHint ?? data.length * 4);

  for (;;) {
    const final = reader.bits(1);
    const type = reader.bits(2);

    if (type === 0) {
      reader.align();
      const len = reader.byte() | (reader.byte() << 8);
      const nlen = reader.byte() | (reader.byte() << 8);
      // LEN and its one's complement must agree; if they do not, the stream
      // is misaligned and everything after it is noise.
      if ((len ^ 0xffff) !== nlen) {
        fail('STORED', `LEN ${len} and NLEN ${nlen} are not complements`);
      }
      out.room(len);
      reader.copyInto(out.buf, out.len, len);
      out.len += len;
    } else if (type === 1 || type === 2) {
      let litTable: Huffman;
      let distTable: Huffman;
      if (type === 1) {
        [litTable, distTable] = fixedTables();
      } else {
        const hlit = reader.bits(5) + 257;
        const hdist = reader.bits(5) + 1;
        const hclen = reader.bits(4) + 4;
        const clens = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) clens[CLEN_ORDER[i] as number] = reader.bits(3);
        const clenTable = buildHuffman(clens, 19);

        // The literal and distance code lengths share one RLE stream.
        const lengths = new Uint8Array(hlit + hdist);
        for (let i = 0; i < lengths.length;) {
          const sym = reader.symbol(clenTable);
          if (sym < 16) {
            lengths[i++] = sym;
          } else if (sym === 16) {
            if (i === 0) fail('CLEN', 'a repeat-previous code opens the length stream');
            const prev = lengths[i - 1] as number;
            let repeat = 3 + reader.bits(2);
            while (repeat-- > 0 && i < lengths.length) lengths[i++] = prev;
          } else if (sym === 17) {
            let repeat = 3 + reader.bits(3);
            while (repeat-- > 0 && i < lengths.length) lengths[i++] = 0;
          } else {
            let repeat = 11 + reader.bits(7);
            while (repeat-- > 0 && i < lengths.length) lengths[i++] = 0;
          }
        }
        litTable = buildHuffman(lengths.subarray(0, hlit), hlit);
        distTable = buildHuffman(lengths.subarray(hlit), hdist);
      }

      for (;;) {
        const sym = reader.symbol(litTable);
        if (sym < 256) {
          out.push(sym);
        } else if (sym === 256) {
          break;
        } else {
          const li = sym - 257;
          if (li >= LENGTH_BASE.length) fail('LENGTH', `length symbol ${sym} is out of range`);
          const length = (LENGTH_BASE[li] as number) + reader.bits(LENGTH_EXTRA[li] as number);
          const di = reader.symbol(distTable);
          if (di >= DIST_BASE.length) fail('DISTANCE', `distance symbol ${di} is out of range`);
          const distance = (DIST_BASE[di] as number) + reader.bits(DIST_EXTRA[di] as number);
          out.repeat(distance, length);
        }
      }
    } else {
      fail('BLOCKTYPE', 'block type 3 is reserved');
    }

    if (final) break;
  }
  return out.done();
};

/**
 * Decompress a zlib stream (RFC 1950) — a two-byte header, a DEFLATE body and
 * an Adler-32 trailer. This is what a PNG's IDAT holds.
 *
 * The checksum is verified, which is the point of having one.
 *
 * @example
 * ```js
 * import { inflate, deflate } from 'ansimax';
 *
 * inflate(deflate(new Uint8Array([1, 1, 1, 1, 1])));  // → the five bytes back
 * ```
 *
 * @throws {RangeError} `ANSIMAX_DEFLATE_ZLIB` — bad header, method or FCHECK.
 * @throws {RangeError} `ANSIMAX_DEFLATE_ADLER` — the checksum disagrees.
 * @since 1.10.0
 */
export const inflate = (data: Uint8Array, opts: InflateOptions = {}): Uint8Array => {
  if (!(data instanceof Uint8Array) || data.length < 6) {
    throw new TypeError('ANSIMAX_DEFLATE_INPUT: inflate needs a zlib stream of at least 6 bytes');
  }
  const cmf = data[0] as number;
  const flg = data[1] as number;
  if ((cmf & 0x0f) !== 8) fail('ZLIB', `compression method ${cmf & 0x0f} is not DEFLATE`);
  // FCHECK: the two header bytes as a big-endian number must be a multiple
  // of 31. It is the only integrity check on the header.
  if (((cmf << 8) | flg) % 31 !== 0) fail('ZLIB', 'the header fails its FCHECK multiple-of-31 test');
  if (flg & 0x20) fail('ZLIB', 'a preset dictionary is not supported');

  const body = data.subarray(2, data.length - 4);
  const out = inflateRaw(body, opts);

  const end = data.length;
  const want =
    (((data[end - 4] as number) << 24) |
      ((data[end - 3] as number) << 16) |
      ((data[end - 2] as number) << 8) |
      (data[end - 1] as number)) >>> 0;
  const got = adler32(out);
  if (got !== want) {
    fail('ADLER', `checksum ${got.toString(16)} does not match the stored ${want.toString(16)}`);
  }
  return out;
};

// ─────────────────────────────────────────────
//  Huffman encoding
// ─────────────────────────────────────────────

/** Writes a DEFLATE bitstream, least-significant bit first. */
class BitWriter {
  private bytes: number[] = [];
  private bitBuf = 0;
  private bitCount = 0;

  bits(value: number, count: number): void {
    this.bitBuf |= (value & ((1 << count) - 1)) << this.bitCount;
    this.bitCount += count;
    while (this.bitCount >= 8) {
      this.bytes.push(this.bitBuf & 0xff);
      this.bitBuf >>>= 8;
      this.bitCount -= 8;
    }
  }

  /**
   * Huffman codes go out most-significant bit first, unlike every other field
   * in the format. Getting this backwards produces a stream that inflates to
   * garbage rather than failing, so it is worth saying out loud.
   */
  code(value: number, count: number): void {
    for (let i = count - 1; i >= 0; i--) this.bits((value >>> i) & 1, 1);
  }

  align(): void {
    if (this.bitCount > 0) {
      this.bytes.push(this.bitBuf & 0xff);
      this.bitBuf = 0;
      this.bitCount = 0;
    }
  }

  byte(value: number): void {
    this.bytes.push(value & 0xff);
  }

  finish(): Uint8Array {
    this.align();
    return new Uint8Array(this.bytes);
  }
}

/** The length symbol and extra bits for a match length of 3..258. */
const lengthCode = (length: number): [number, number, number] => {
  for (let i = LENGTH_BASE.length - 1; i >= 0; i--) {
    if (length >= (LENGTH_BASE[i] as number)) {
      return [257 + i, length - (LENGTH_BASE[i] as number), LENGTH_EXTRA[i] as number];
    }
  }
  /* istanbul ignore next — unreachable: the matcher never emits a match
     shorter than LENGTH_BASE[0], which is 3. */
  return [257, 0, 0];
};

/** The distance symbol and extra bits for a distance of 1..32768. */
const distanceCode = (distance: number): [number, number, number] => {
  for (let i = DIST_BASE.length - 1; i >= 0; i--) {
    if (distance >= (DIST_BASE[i] as number)) {
      return [i, distance - (DIST_BASE[i] as number), DIST_EXTRA[i] as number];
    }
  }
  /* istanbul ignore next — unreachable: a match distance is at least 1,
     which is DIST_BASE[0]. */
  return [0, 0, 0];
};

/** Options for {@link deflateRaw} and {@link deflate}. */
export interface DeflateOptions {
  /**
   * 0–9. `0` stores the data uncompressed; 1–9 trade match-search effort for
   * ratio by bounding how far back the hash chain is followed. Default `6`.
   */
  level?: number;
}

const MIN_MATCH = 3;
const MAX_MATCH = 258;
const WINDOW = 32768;
const HASH_BITS = 15;
const HASH_SIZE = 1 << HASH_BITS;

/** Chain depth per level — how many candidate matches are examined. */
const CHAIN_BY_LEVEL = [0, 4, 8, 16, 32, 64, 128, 256, 1024, 4096] as const;

/**
 * Code lengths for an optimal Huffman code over `freqs`, capped at `maxBits`.
 *
 * The cap is the awkward part: DEFLATE allows no code longer than 15 bits (7
 * for the code-length alphabet), and a plain Huffman tree over a very skewed
 * distribution can go deeper. Rather than the fiddly length-redistribution
 * loop, this halves every frequency and rebuilds whenever the tree is too
 * deep — flattening the distribution shortens the longest code, and in the
 * limit all frequencies are equal, giving a balanced tree of depth
 * ceil(log2 n), which for 288 symbols is 9. So it always terminates, and the
 * cost is a slightly suboptimal code in the rare cases it triggers at all.
 */
const codeLengths = (freqs: Int32Array, maxBits: number): Uint8Array => {
  const n = freqs.length;
  const lengths = new Uint8Array(n);
  const work = Int32Array.from(freqs);

  for (;;) {
    const used: number[] = [];
    for (let i = 0; i < n; i++) if ((work[i] as number) > 0) used.push(i);

    if (used.length === 0) return lengths;
    if (used.length === 1) {
      // A single symbol still needs a code to be written at all, and a
      // one-code tree is incomplete; callers pad to two symbols.
      lengths[used[0] as number] = 1;
      return lengths;
    }

    // Huffman by repeated merging. Two queues — leaves sorted by frequency
    // and the internal nodes produced so far, which come out in sorted order
    // — give the standard O(n log n) with one sort and no heap.
    const leaves = used.slice().sort((a, b) => (work[a] as number) - (work[b] as number));
    const nodeFreq: number[] = [];
    const nodeLeft: number[] = [];
    const nodeRight: number[] = [];
    let li = 0;
    let ni = 0;

    // -1 marks "take from the node queue", otherwise the leaf's symbol.
    const takeLowest = (): { freq: number; node: number; sym: number } => {
      const leafFreq = li < leaves.length ? (work[leaves[li] as number] as number) : Infinity;
      const nodeF = ni < nodeFreq.length ? (nodeFreq[ni] as number) : Infinity;
      if (leafFreq <= nodeF) {
        const sym = leaves[li++] as number;
        return { freq: leafFreq, node: -1, sym };
      }
      const node = ni++;
      return { freq: nodeF, node, sym: -1 };
    };

    // Merge until one node is left: that node is the root. Both queues feed
    // the same merge, and the node queue is produced in non-decreasing order,
    // so taking the smaller head of the two is a correct priority queue.
    while ((leaves.length - li) + (nodeFreq.length - ni) >= 2) {
      const a = takeLowest();
      const b = takeLowest();
      nodeFreq.push(a.freq + b.freq);
      nodeLeft.push(a.node === -1 ? ~(a.sym) : a.node);
      nodeRight.push(b.node === -1 ? ~(b.sym) : b.node);
    }

    // Depth of every leaf, walking down from the last node built (the root).
    const depth = new Int32Array(n);
    let deepest = 0;
    const stack: Array<[number, number]> = [[nodeFreq.length - 1, 0]];
    while (stack.length > 0) {
      const [node, d] = stack.pop() as [number, number];
      for (const child of [nodeLeft[node] as number, nodeRight[node] as number]) {
        if (child < 0) {
          const sym = ~child;
          depth[sym] = d + 1;
          if (d + 1 > deepest) deepest = d + 1;
        } else {
          stack.push([child, d + 1]);
        }
      }
    }

    if (deepest <= maxBits) {
      for (let i = 0; i < n; i++) lengths[i] = depth[i] as number;
      return lengths;
    }
    for (let i = 0; i < n; i++) {
      const f = work[i] as number;
      if (f > 0) work[i] = (f + 1) >> 1;
    }
  }
};

/** Canonical codes for a set of code lengths (RFC 1951 §3.2.2). */
const canonicalCodes = (lengths: Uint8Array): Int32Array => {
  const counts = new Int32Array(16);
  for (const len of lengths) if (len > 0) counts[len] = (counts[len] as number) + 1;
  const next = new Int32Array(16);
  let code = 0;
  for (let len = 1; len < 16; len++) {
    code = (code + (counts[len - 1] as number)) << 1;
    next[len] = code;
  }
  const codes = new Int32Array(lengths.length);
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i] as number;
    if (len > 0) {
      codes[i] = next[len] as number;
      next[len] = (next[len] as number) + 1;
    }
  }
  return codes;
};

/**
 * The code-length alphabet, run-length encoded: symbol 16 repeats the
 * previous length 3..6 times, 17 writes 3..10 zeros and 18 writes 11..138.
 * This is what makes a dynamic block's header affordable.
 */
const packCodeLengths = (lengths: Uint8Array): { syms: number[]; extra: number[]; bits: number[] } => {
  const syms: number[] = [];
  const extra: number[] = [];
  const bits: number[] = [];
  let i = 0;
  while (i < lengths.length) {
    const len = lengths[i] as number;
    let run = 1;
    while (i + run < lengths.length && lengths[i + run] === len) run++;

    if (len === 0) {
      while (run >= 11) {
        const take = Math.min(138, run);
        syms.push(18); extra.push(take - 11); bits.push(7);
        run -= take;
        i += take;
      }
      while (run >= 3) {
        const take = Math.min(10, run);
        syms.push(17); extra.push(take - 3); bits.push(3);
        run -= take;
        i += take;
      }
      while (run-- > 0) { syms.push(0); extra.push(0); bits.push(0); i++; }
    } else {
      syms.push(len); extra.push(0); bits.push(0);
      i++;
      run--;
      while (run >= 3) {
        const take = Math.min(6, run);
        syms.push(16); extra.push(take - 3); bits.push(2);
        run -= take;
        i += take;
      }
      while (run-- > 0) { syms.push(len); extra.push(0); bits.push(0); i++; }
    }
  }
  return { syms, extra, bits };
};

/** Trailing zero lengths carry no information, so they are not written. */
const trimLengths = (lengths: Uint8Array, min: number): number => {
  let n = lengths.length;
  while (n > min && lengths[n - 1] === 0) n--;
  return n;
};

/** The LZ77 token stream. Frequencies are counted per block, not globally. */
interface Tokens {
  /** Literal byte, or the match length when `dists[i]` is non-zero. */
  vals: Uint16Array;
  /** Match distance, or 0 for a literal. */
  dists: Uint16Array;
  count: number;
}

/**
 * LZ77 over a hash chain — the classic zlib structure: a table holding the
 * most recent position per three-byte hash, and a per-position link to the
 * one before it. `maxChain` bounds how far down that chain to walk.
 */
const lz77 = (data: Uint8Array, maxChain: number): Tokens => {
  const head = new Int32Array(HASH_SIZE).fill(-1);
  const prev = new Int32Array(data.length).fill(-1);
  const vals = new Uint16Array(data.length);
  const dists = new Uint16Array(data.length);
  let count = 0;

  const hashAt = (i: number): number =>
    ((((data[i] as number) << 10) ^ ((data[i + 1] as number) << 5) ^ (data[i + 2] as number)) *
      0x9e3779b1) >>> (32 - HASH_BITS);

  let i = 0;
  while (i < data.length) {
    let bestLen = 0;
    let bestDist = 0;

    if (i + MIN_MATCH <= data.length) {
      const h = hashAt(i);
      let candidate = head[h] as number;
      let chain = maxChain;
      const limit = Math.max(0, i - WINDOW);
      while (candidate >= limit && chain-- > 0) {
        // Check the byte that would extend the current best first: if it does
        // not match, this candidate cannot beat it, and that one comparison
        // skips the whole length walk.
        if ((data[candidate + bestLen] as number) === (data[i + bestLen] as number)) {
          let len = 0;
          const max = Math.min(MAX_MATCH, data.length - i);
          while (len < max && (data[candidate + len] as number) === (data[i + len] as number)) len++;
          if (len > bestLen) {
            bestLen = len;
            bestDist = i - candidate;
            if (len >= max) break; // nothing can beat a maximal match
          }
        }
        candidate = prev[candidate] as number;
      }
      prev[i] = head[h] as number;
      head[h] = i;
    }

    if (bestLen >= MIN_MATCH) {
      vals[count] = bestLen;
      dists[count] = bestDist;
      count++;
      for (let k = 1; k < bestLen; k++) {
        const at = i + k;
        if (at + MIN_MATCH > data.length) break;
        const h = hashAt(at);
        prev[at] = head[h] as number;
        head[h] = at;
      }
      i += bestLen;
    } else {
      vals[count] = data[i] as number;
      dists[count] = 0;
      count++;
      i++;
    }
  }
  return { vals, dists, count };
};

/**
 * The initial block granularity, before merging.
 *
 * Block boundaries are not a detail: one block over a whole image averages
 * statistics that are locally very skewed. A 256x256 test gradient whose
 * middle channel is constant within each row compressed to *nothing* as a
 * single block — the three channels together are uniform over 0..255 — and to
 * 12% smaller than the input in 2 KB blocks. That is where zlib's advantage
 * over an earlier version of this encoder lived: adaptive block boundaries,
 * not better Huffman.
 *
 * But small blocks are a loss on highly compressible text, where the same
 * tables serve the whole file and each extra header is pure overhead: 2 KB
 * blocks took a 90 KB repeated sentence to 847 bytes where one block took it
 * to 355. So the encoder starts fine-grained and merges adjacent blocks for
 * as long as merging measurably costs fewer bits, which lets each kind of
 * data settle at its own granularity instead of picking one and hoping.
 */
const BLOCK_BYTES = 2048;

/** Token-index cuts at roughly `BLOCK_BYTES` of input each. */
const initialCuts = (t: Tokens): number[] => {
  const cuts: number[] = [0];
  let consumed = 0;
  for (let i = 0; i < t.count; i++) {
    consumed += (t.dists[i] as number) === 0 ? 1 : (t.vals[i] as number);
    if (consumed >= BLOCK_BYTES) {
      cuts.push(i + 1);
      consumed = 0;
    }
  }
  if ((cuts[cuts.length - 1] as number) !== t.count) cuts.push(t.count);
  return cuts;
};

/** Symbol frequencies for one token range. */
const rangeFreqs = (t: Tokens, from: number, to: number): [Int32Array, Int32Array] => {
  const litFreq = new Int32Array(288);
  const distFreq = new Int32Array(30);
  for (let i = from; i < to; i++) {
    const dist = t.dists[i] as number;
    if (dist === 0) {
      const byte = t.vals[i] as number;
      litFreq[byte] = (litFreq[byte] as number) + 1;
    } else {
      const ls = lengthCode(t.vals[i] as number)[0];
      const ds = distanceCode(dist)[0];
      litFreq[ls] = (litFreq[ls] as number) + 1;
      distFreq[ds] = (distFreq[ds] as number) + 1;
    }
  }
  litFreq[256] = 1; // end-of-block, exactly once per block
  return [litFreq, distFreq];
};

/** Bit cost of the token stream under a given pair of code-length tables. */
const tokenCost = (
  t: Tokens, from: number, to: number, litLen: Uint8Array, distLen: Uint8Array,
): number => {
  let bits = litLen[256] as number;
  for (let i = from; i < to; i++) {
    const dist = t.dists[i] as number;
    if (dist === 0) {
      const len = litLen[t.vals[i] as number] as number;
      /* istanbul ignore next — unreachable from either call site: both pass
         tables that cover [from, to), so every symbol used has a length. The
         guard stands so a future caller gets Infinity instead of a stream it
         cannot write. */
      if (len === 0) return Infinity;
      bits += len;
    } else {
      const [lsym, , lbits] = lengthCode(t.vals[i] as number);
      const [dsym, , dbits] = distanceCode(dist);
      const ll = litLen[lsym] as number;
      const dl = distLen[dsym] as number;
      /* istanbul ignore next — unreachable, same reason as the literal case. */
      if (ll === 0 || dl === 0) return Infinity;
      bits += ll + lbits + dl + dbits;
    }
  }
  return bits;
};

/** Emit the token stream with the given code tables. */
const writeTokens = (
  w: BitWriter,
  t: Tokens,
  from: number,
  to: number,
  litLen: Uint8Array,
  litCode: Int32Array,
  distLen: Uint8Array,
  distCode: Int32Array,
): void => {
  for (let i = from; i < to; i++) {
    const dist = t.dists[i] as number;
    if (dist === 0) {
      const sym = t.vals[i] as number;
      w.code(litCode[sym] as number, litLen[sym] as number);
    } else {
      const [lsym, lextra, lbits] = lengthCode(t.vals[i] as number);
      w.code(litCode[lsym] as number, litLen[lsym] as number);
      if (lbits > 0) w.bits(lextra, lbits);
      const [dsym, dextra, dbits] = distanceCode(dist);
      w.code(distCode[dsym] as number, distLen[dsym] as number);
      if (dbits > 0) w.bits(dextra, dbits);
    }
  }
  w.code(litCode[256] as number, litLen[256] as number);
};

/** The fixed code lengths, as tables, so both block types share one path. */
let FIXED_LIT_LEN: Uint8Array | null = null;
let FIXED_DIST_LEN: Uint8Array | null = null;
const fixedLengthTables = (): [Uint8Array, Uint8Array] => {
  if (!FIXED_LIT_LEN || !FIXED_DIST_LEN) {
    const lit = new Uint8Array(288);
    lit.fill(8, 0, 144);
    lit.fill(9, 144, 256);
    lit.fill(7, 256, 280);
    lit.fill(8, 280, 288);
    FIXED_LIT_LEN = lit;
    FIXED_DIST_LEN = new Uint8Array(30).fill(5);
  }
  return [FIXED_LIT_LEN, FIXED_DIST_LEN];
};

/**
 * Compress to a raw DEFLATE stream.
 *
 * One LZ77 pass produces the token stream, then all three block types are
 * costed and the cheapest is written: stored, fixed Huffman, or dynamic
 * Huffman with code tables built from the stream's own frequencies.
 *
 * Dynamic is not a luxury here. PNG scanlines are literal-heavy with a skewed
 * byte distribution — a gradient's channel values are a handful of multiples
 * — and fixed Huffman spends 8 or 9 bits on every one of them regardless. On
 * a 64x64 gradient, fixed could not compress at all (12,363 bytes from
 * 12,352) where dynamic reaches 7,787.
 *
 * @example
 * ```js
 * import { deflateRaw, inflateRaw } from 'ansimax';
 *
 * const packed = deflateRaw(data, { level: 9 });
 * inflateRaw(packed); // → data
 * ```
 *
 * @since 1.10.0
 */
export const deflateRaw = (data: Uint8Array, opts: DeflateOptions = {}): Uint8Array => {
  if (!(data instanceof Uint8Array)) {
    throw new TypeError('ANSIMAX_DEFLATE_INPUT: deflate needs a Uint8Array');
  }
  const level = clampLevel(opts.level);
  if (level === 0 || data.length < MIN_MATCH) return storedBlocks(data);

  const tokens = lz77(data, CHAIN_BY_LEVEL[level] as number);
  const plans = planBlocks(tokens, level);

  const w = new BitWriter();
  for (let b = 0; b < plans.length; b++) {
    writeBlock(w, tokens, plans[b] as BlockPlan, b === plans.length - 1);
  }
  const compressed = w.finish();

  // If no Huffman form beat the raw bytes — random data, tiny inputs — the
  // stored form is the honest answer.
  const stored = storedBlocks(data);
  return compressed.length <= stored.length ? compressed : stored;
};

/** Everything decided about one block: its range, its tables, its bit cost. */
interface BlockPlan {
  from: number;
  to: number;
  bits: number;
  dynamic: boolean;
  litLen: Uint8Array;
  distLen: Uint8Array;
  clenLen: Uint8Array;
  packed: { syms: number[]; extra: number[]; bits: number[] };
  hlit: number;
  hdist: number;
  hclen: number;
}

/**
 * Cost out one block: build its dynamic tables, price them against the fixed
 * ones including the header, and keep whichever wins.
 */
const planBlock = (t: Tokens, from: number, to: number): BlockPlan => {
  const [litFreq, distFreq] = rangeFreqs(t, from, to);
  const [fixedLit, fixedDist] = fixedLengthTables();
  const fixedBits = 3 + tokenCost(t, from, to, fixedLit, fixedDist);

  const litLen = codeLengths(litFreq, 15);
  let distLen = codeLengths(distFreq, 15);
  // An all-zero distance table is legal but awkward for decoders; one code of
  // length 1 is what every encoder emits for a block with no matches.
  if (!distLen.some((l) => l > 0)) {
    distLen = new Uint8Array(30);
    distLen[0] = 1;
  }
  padIncompleteTree(litLen);
  padIncompleteTree(distLen);

  const hlit = Math.max(257, trimLengths(litLen, 257));
  const hdist = Math.max(1, trimLengths(distLen, 1));
  const merged = new Uint8Array(hlit + hdist);
  merged.set(litLen.subarray(0, hlit), 0);
  merged.set(distLen.subarray(0, hdist), hlit);
  const packed = packCodeLengths(merged);

  const clenFreq = new Int32Array(19);
  for (const sym of packed.syms) clenFreq[sym] = (clenFreq[sym] as number) + 1;
  const clenLen = codeLengths(clenFreq, 7);
  padIncompleteTree(clenLen);
  let hclen = 19;
  while (hclen > 4 && (clenLen[CLEN_ORDER[hclen - 1] as number] as number) === 0) hclen--;

  let dynamicBits = 3 + 5 + 5 + 4 + hclen * 3;
  for (let i = 0; i < packed.syms.length; i++) {
    dynamicBits += (clenLen[packed.syms[i] as number] as number) + (packed.bits[i] as number);
  }
  dynamicBits += tokenCost(t, from, to, litLen, distLen);

  const dynamic = dynamicBits <= fixedBits;
  return {
    from, to,
    bits: dynamic ? dynamicBits : fixedBits,
    dynamic,
    litLen: dynamic ? litLen : fixedLit,
    distLen: dynamic ? distLen : fixedDist,
    clenLen, packed, hlit, hdist, hclen,
  };
};

/**
 * Decide the block boundaries by measuring, not by guessing a size.
 *
 * The stream is cut fine (see {@link BLOCK_BYTES}) and then adjacent blocks
 * are merged for as long as the merged block costs fewer bits than the two
 * apart — one header instead of two, against whatever entropy is lost by
 * describing both regions with one set of tables. Repeating the sweep lets
 * runs of similar data coalesce all the way up, so a repetitive text file
 * ends as one block while an image stays fine-grained, with no size constant
 * deciding it either way.
 *
 * Merging is capped by level so the planning cost stays proportional to the
 * effort the caller asked for: every test is an exact cost evaluation over
 * the merged range, which is the expensive part.
 */
const planBlocks = (t: Tokens, level: number): BlockPlan[] => {
  const cuts = initialCuts(t);
  let plans: BlockPlan[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    plans.push(planBlock(t, cuts[i] as number, cuts[i + 1] as number));
  }
  if (plans.length < 2) return plans.length === 1 ? plans : [planBlock(t, 0, t.count)];

  const maxSweeps = level <= 2 ? 1 : level <= 6 ? 4 : 12;
  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    const next: BlockPlan[] = [];
    let merges = 0;
    let i = 0;
    while (i < plans.length) {
      const current = plans[i] as BlockPlan;
      if (i + 1 >= plans.length) {
        next.push(current);
        break;
      }
      const neighbour = plans[i + 1] as BlockPlan;
      const joined = planBlock(t, current.from, neighbour.to);
      if (joined.bits < current.bits + neighbour.bits) {
        next.push(joined);
        merges++;
        i += 2;
      } else {
        next.push(current);
        i += 1;
      }
    }
    plans = next;
    if (merges === 0) break;
  }
  return plans;
};

/** Write one planned block. */
const writeBlock = (w: BitWriter, t: Tokens, plan: BlockPlan, last: boolean): void => {
  w.bits(last ? 1 : 0, 1); // BFINAL
  if (plan.dynamic) {
    w.bits(2, 2); // BTYPE = dynamic
    w.bits(plan.hlit - 257, 5);
    w.bits(plan.hdist - 1, 5);
    w.bits(plan.hclen - 4, 4);
    for (let i = 0; i < plan.hclen; i++) {
      w.bits(plan.clenLen[CLEN_ORDER[i] as number] as number, 3);
    }
    const clenCode = canonicalCodes(plan.clenLen);
    for (let i = 0; i < plan.packed.syms.length; i++) {
      const sym = plan.packed.syms[i] as number;
      w.code(clenCode[sym] as number, plan.clenLen[sym] as number);
      const extraBits = plan.packed.bits[i] as number;
      if (extraBits > 0) w.bits(plan.packed.extra[i] as number, extraBits);
    }
  } else {
    w.bits(1, 2); // BTYPE = fixed
  }
  writeTokens(
    w, t, plan.from, plan.to,
    plan.litLen, canonicalCodes(plan.litLen),
    plan.distLen, canonicalCodes(plan.distLen),
  );
};

/**
 * A tree holding a single one-bit code is incomplete: its Kraft sum is 1/2,
 * not 1, and a strict inflater rejects it. Padding to two one-bit codes costs
 * nothing and makes the tree complete.
 */
const padIncompleteTree = (lengths: Uint8Array): void => {
  let used = 0;
  let first = -1;
  for (let i = 0; i < lengths.length; i++) {
    if ((lengths[i] as number) > 0) {
      used++;
      if (first < 0) first = i;
    }
  }
  if (used === 1) {
    lengths[first] = 1;
    lengths[first === 0 ? 1 : 0] = 1;
  }
};

/** Uncompressed DEFLATE blocks: BTYPE=00, 65535 bytes at a time. */
const storedBlocks = (data: Uint8Array): Uint8Array => {
  const w = new BitWriter();
  if (data.length === 0) {
    w.bits(1, 1);
    w.bits(0, 2);
    w.align();
    w.byte(0); w.byte(0); w.byte(0xff); w.byte(0xff);
    return w.finish();
  }
  for (let at = 0; at < data.length; at += 65535) {
    const len = Math.min(65535, data.length - at);
    w.bits(at + len >= data.length ? 1 : 0, 1);
    w.bits(0, 2);
    w.align();
    w.byte(len & 0xff);
    w.byte((len >>> 8) & 0xff);
    w.byte(~len & 0xff);
    w.byte((~len >>> 8) & 0xff);
    for (let k = 0; k < len; k++) w.byte(data[at + k] as number);
  }
  return w.finish();
};

const clampLevel = (level: number | undefined): number => {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 6;
  return Math.min(9, Math.max(0, Math.trunc(level)));
};

/**
 * Compress to a zlib stream (RFC 1950) — the header, the DEFLATE body and the
 * Adler-32 trailer. This is the form PNG's IDAT expects.
 *
 * @example
 * ```js
 * import { deflate, inflate } from 'ansimax';
 *
 * inflate(deflate(bytes)); // → bytes
 * ```
 *
 * @since 1.10.0
 */
export const deflate = (data: Uint8Array, opts: DeflateOptions = {}): Uint8Array => {
  const body = deflateRaw(data, opts);
  const out = new Uint8Array(body.length + 6);
  // CMF: method 8, window 32K. FLG: 0x01, which is not a free choice — RFC
  // 1950 requires CMF*256 + FLG to be a multiple of 31, and 0x7801 is 31*991
  // exactly. No correction term is needed, so there is none to get wrong.
  out[0] = 0x78;
  out[1] = 0x01;
  out.set(body, 2);
  const sum = adler32(data);
  out[out.length - 4] = (sum >>> 24) & 0xff;
  out[out.length - 3] = (sum >>> 16) & 0xff;
  out[out.length - 2] = (sum >>> 8) & 0xff;
  out[out.length - 1] = sum & 0xff;
  return out;
};

/** Namespace form, for the default export. */
export const compress = {
  deflate,
  deflateRaw,
  inflate,
  inflateRaw,
  crc32,
  adler32,
};
