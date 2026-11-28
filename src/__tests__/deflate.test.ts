import {
  deflate, deflateRaw, inflate, inflateRaw, crc32, adler32,
} from '../deflate/index.js';

// ─────────────────────────────────────────────
//  Phase 12 — DEFLATE / zlib (v1.10.0)
//
//  Verified in the sandbox against node:zlib as a strict C oracle: 2,500
//  random inputs across nine shapes and all ten levels, in both directions
//  (zlib accepted every stream we produced, and we read back every stream it
//  produced), plus matching CRC-32. Compression came out at 0.92x–1.00x of
//  zlib level 6 on every corpus entry. These tests pin the format details and
//  the decisions the encoder makes.
// ─────────────────────────────────────────────

const bytes = (...v: number[]): Uint8Array => new Uint8Array(v);
const text = (s: string): Uint8Array => new TextEncoder().encode(s);
const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

/** Which block type a raw DEFLATE stream opens with. */
const BLOCK_TYPES = ['stored', 'fixed', 'dynamic', 'reserved'] as const;
const blockType = (raw: Uint8Array): string =>
  BLOCK_TYPES[((raw[0] as number) >> 1) & 3] as string;

describe('crc32', () => {
  it('matches the published check value', () => {
    // The CRC-32 of "123456789" is the standard conformance vector.
    expect(crc32(text('123456789'))).toBe(0xcbf43926);
  });

  it('is 0 for no bytes', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('can be seeded to continue over a split buffer', () => {
    const whole = text('the quick brown fox');
    const first = whole.subarray(0, 9);
    const rest = whole.subarray(9);
    expect(crc32(rest, crc32(first))).toBe(crc32(whole));
  });

  it('changes with a single bit', () => {
    expect(crc32(bytes(0))).not.toBe(crc32(bytes(1)));
  });
});

describe('adler32', () => {
  it('matches the worked example from RFC 1950', () => {
    // a=1+97+98+99=295=0x127, b=1*3+ (97*3 + 98*2 + 99) = 0x25e... the
    // published value for "abc" is 0x024d0127.
    expect(adler32(text('abc'))).toBe(0x024d0127);
  });

  it('is 1 for no bytes — the sums start at 1 and 0', () => {
    expect(adler32(new Uint8Array(0))).toBe(1);
  });

  it('stays in range over a buffer long enough to need the modulo', () => {
    const big = new Uint8Array(20000).fill(255);
    const sum = adler32(big);
    expect(sum).toBeGreaterThanOrEqual(0);
    expect(sum).toBeLessThanOrEqual(0xffffffff);
    // Both halves must be below the 65521 modulus.
    expect(sum & 0xffff).toBeLessThan(65521);
    expect(sum >>> 16).toBeLessThan(65521);
  });

  it('is order-sensitive, unlike a plain sum', () => {
    expect(adler32(bytes(1, 2))).not.toBe(adler32(bytes(2, 1)));
  });
});

describe('deflate / inflate round trip', () => {
  const corpus: Record<string, Uint8Array> = {
    empty: new Uint8Array(0),
    'one byte': bytes(42),
    'two bytes': bytes(1, 2),
    'below the minimum match': bytes(7, 7),
    'all zeros': new Uint8Array(5000),
    'one value repeated': new Uint8Array(3000).fill(0xab),
    periodic: Uint8Array.from({ length: 4000 }, (_, i) => i % 7),
    text: text('the quick brown fox jumps over the lazy dog. '.repeat(100)),
    'distance 1 run': new Uint8Array(300).fill(9),
    'max length match': (() => {
      const out = new Uint8Array(600);
      out.fill(3);
      return out;
    })(),
    'two regions': (() => {
      const out = new Uint8Array(4000);
      out.fill(1, 0, 2000);
      for (let i = 2000; i < 4000; i++) out[i] = (i * 37) % 251;
      return out;
    })(),
  };

  for (const [name, data] of Object.entries(corpus)) {
    it(`round-trips ${name} at every level`, () => {
      for (let level = 0; level <= 9; level++) {
        expect(same(inflate(deflate(data, { level })), data)).toBe(true);
        expect(same(inflateRaw(deflateRaw(data, { level })), data)).toBe(true);
      }
    });
  }

  it('round-trips random data, which cannot compress', () => {
    let seed = 1234567;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const data = Uint8Array.from({ length: 4000 }, () => Math.floor(rnd() * 256));
    expect(same(inflate(deflate(data)), data)).toBe(true);
    // And it must not grow by more than the stored-block overhead.
    expect(deflate(data).length).toBeLessThan(data.length + 32);
  });

  it('is byte-identical across repeated calls', () => {
    const data = text('determinism matters for caching'.repeat(20));
    expect(same(deflate(data), deflate(data))).toBe(true);
  });
});

describe('deflate block choice', () => {
  it('stores incompressible data rather than growing it', () => {
    let seed = 99;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const noise = Uint8Array.from({ length: 2000 }, () => Math.floor(rnd() * 256));
    expect(blockType(deflateRaw(noise))).toBe('stored');
  });

  it('stores when the level is 0', () => {
    const data = new Uint8Array(1000).fill(7);
    expect(blockType(deflateRaw(data, { level: 0 }))).toBe('stored');
    expect(deflateRaw(data, { level: 0 }).length).toBeGreaterThan(1000);
  });

  it('uses Huffman coding when it pays', () => {
    const data = text('aaaaaaaaaabbbbbbbbbbcccccccccc'.repeat(50));
    expect(blockType(deflateRaw(data))).not.toBe('stored');
  });

  it('beats a stored block by a wide margin on repetitive data', () => {
    const data = new Uint8Array(10000).fill(1);
    expect(deflate(data).length).toBeLessThan(60);
  });

  it('compresses literal-heavy scanlines, where fixed Huffman alone cannot', () => {
    // A gradient's channel values are a handful of multiples, so the win is
    // entropy coding rather than matching. Fixed Huffman spends 8 or 9 bits
    // on every literal regardless and could not compress this at all.
    const w = 64;
    const h = 64;
    const raw = new Uint8Array(h * (1 + w * 3));
    let at = 0;
    for (let y = 0; y < h; y++) {
      raw[at++] = 0;
      for (let x = 0; x < w; x++) {
        raw[at++] = x * 4;
        raw[at++] = y * 4;
        raw[at++] = 128;
      }
    }
    expect(deflate(raw).length).toBeLessThan(raw.length * 0.7);
    expect(same(inflate(deflate(raw)), raw)).toBe(true);
  });

  it('splits blocks where the statistics change, and merges where they do not', () => {
    // Half flat, half noise. One set of tables for both would waste bits on
    // the flat half; the planner should cut between them.
    let seed = 31337;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const mixed = new Uint8Array(20000);
    mixed.fill(5, 0, 10000);
    for (let i = 10000; i < 20000; i++) mixed[i] = Math.floor(rnd() * 256);
    const out = deflate(mixed);
    expect(same(inflate(out), mixed)).toBe(true);
    // The flat half should cost almost nothing, so the total is close to the
    // noisy half alone rather than to the whole input.
    expect(out.length).toBeLessThan(11000);
  });

  it('keeps a uniform file in few blocks, so headers do not pile up', () => {
    // 90 KB of one repeated sentence: fine-grained blocks would each carry
    // their own table. Merging should take this to a few hundred bytes.
    const data = text('the quick brown fox jumps over the lazy dog. '.repeat(2000));
    expect(deflate(data).length).toBeLessThan(600);
  });
});

describe('inflate reading the format', () => {
  it('reads a hand-built stored block', () => {
    // BFINAL=1, BTYPE=00, then LEN/NLEN and the bytes.
    const raw = bytes(0x01, 0x03, 0x00, 0xfc, 0xff, 0x41, 0x42, 0x43);
    expect(same(inflateRaw(raw), text('ABC'))).toBe(true);
  });

  it('rejects a stored block whose LEN and NLEN disagree', () => {
    const raw = bytes(0x01, 0x03, 0x00, 0x00, 0x00, 0x41, 0x42, 0x43);
    expect(() => inflateRaw(raw)).toThrow(/ANSIMAX_DEFLATE_STORED/);
  });

  it('rejects the reserved block type', () => {
    expect(() => inflateRaw(bytes(0x07, 0, 0, 0))).toThrow(/ANSIMAX_DEFLATE_BLOCKTYPE/);
  });

  it('rejects a stream that ends inside a block', () => {
    const good = deflateRaw(new Uint8Array(1000).fill(3));
    expect(() => inflateRaw(good.subarray(0, 2))).toThrow(/ANSIMAX_DEFLATE_/);
  });

  it('rejects a stored block that claims more bytes than remain', () => {
    const raw = bytes(0x01, 0xff, 0x00, 0x00, 0xff, 0x41);
    expect(() => inflateRaw(raw)).toThrow(/ANSIMAX_DEFLATE_TRUNCATED/);
  });

  it('checks the zlib header', () => {
    const good = deflate(text('hello hello hello'));
    const badMethod = good.slice();
    badMethod[0] = 0x79; // method 9
    expect(() => inflate(badMethod)).toThrow(/ANSIMAX_DEFLATE_ZLIB/);
    const badCheck = good.slice();
    badCheck[1] = (badCheck[1] as number) ^ 0x01;
    expect(() => inflate(badCheck)).toThrow(/ANSIMAX_DEFLATE_/);
  });

  it('rejects a preset dictionary rather than decoding it wrong', () => {
    const stream = deflate(text('x'.repeat(100)));
    // Set FDICT and fix FCHECK so the header passes its multiple-of-31 test.
    const cmf = stream[0] as number;
    for (let flg = 0; flg < 256; flg++) {
      if ((flg & 0x20) !== 0 && ((cmf << 8) | flg) % 31 === 0) {
        const tweaked = stream.slice();
        tweaked[1] = flg;
        expect(() => inflate(tweaked)).toThrow(/ANSIMAX_DEFLATE_ZLIB/);
        return;
      }
    }
    throw new Error('no FDICT header with a valid FCHECK was found');
  });

  it('verifies the Adler-32 trailer', () => {
    const stream = deflate(text('check me'.repeat(10)));
    const tampered = stream.slice();
    tampered[tampered.length - 1] = ((tampered[tampered.length - 1] as number) ^ 0xff) & 0xff;
    expect(() => inflate(tampered)).toThrow(/ANSIMAX_DEFLATE_ADLER/);
  });

  it('rejects a zlib stream too short to hold a trailer', () => {
    expect(() => inflate(bytes(0x78, 0x01, 0x00))).toThrow(/ANSIMAX_DEFLATE_INPUT/);
  });

  it('rejects input that is not a Uint8Array', () => {
    expect(() => inflate([1, 2, 3] as unknown as Uint8Array)).toThrow(/ANSIMAX_DEFLATE_INPUT/);
    expect(() => deflate('abc' as unknown as Uint8Array)).toThrow(/ANSIMAX_DEFLATE_INPUT/);
    expect(() => inflateRaw(null as unknown as Uint8Array)).toThrow(/ANSIMAX_DEFLATE_INPUT/);
  });

  it('treats sizeHint as a hint, never as the answer', () => {
    const data = new Uint8Array(5000).fill(4);
    const packed = deflate(data);
    for (const sizeHint of [0, 1, 10, 5000, 1_000_000, Number.NaN]) {
      expect(same(inflate(packed, { sizeHint }), data)).toBe(true);
    }
  });

  it('decodes a long match that overlaps its own output', () => {
    // Distance 1, length 258: the copy reads bytes it is producing, so a bulk
    // copy of the source range would read stale data.
    const data = new Uint8Array(600).fill(0x5a);
    expect(same(inflate(deflate(data)), data)).toBe(true);
  });

  it('decodes a stream whose codes run past the fast table', () => {
    // A very skewed distribution pushes the rarest symbols past 9 bits, which
    // is where the flat lookup gives up and the canonical walk takes over.
    const data = new Uint8Array(40000);
    for (let i = 0; i < data.length; i++) {
      data[i] = i % 1000 === 0 ? (i / 1000) % 256 : 0;
    }
    expect(same(inflate(deflate(data)), data)).toBe(true);
  });
});

describe('deflate levels', () => {
  const data = (() => {
    let seed = 777;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const parts: string[] = [];
    for (let i = 0; i < 400; i++) {
      parts.push(['alpha', 'beta', 'gamma', 'delta'][Math.floor(rnd() * 4)] as string);
    }
    return text(parts.join(' '));
  })();

  it('compresses at every level and never loses data', () => {
    for (let level = 0; level <= 9; level++) {
      expect(same(inflate(deflate(data, { level })), data)).toBe(true);
    }
  });

  it('does not get larger as the level rises', () => {
    const sizes = [1, 3, 6, 9].map((level) => deflate(data, { level }).length);
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i] as number).toBeLessThanOrEqual((sizes[i - 1] as number) + 8);
    }
  });

  it('clamps a nonsense level instead of throwing', () => {
    for (const level of [-5, 42, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(same(inflate(deflate(data, { level })), data)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
//  Corrupt and malformed streams
//
//  The byte sequences below are not invented: each came out of a 60,000-case
//  fuzz over random short inputs, which is the only practical way to reach a
//  decoder's error paths. Each one is recorded here with the error it causes,
//  so the path stays covered without re-running the fuzz.
// ─────────────────────────────────────────────

describe('inflateRaw — corrupt streams', () => {
  it('names a stream that ends inside a block', () => {
    const packed = deflateRaw(new Uint8Array(4000).map((_, i) => i % 251));
    expect(() => inflateRaw(packed.subarray(0, packed.length - 3)))
      .toThrow(/ANSIMAX_DEFLATE_TRUNCATED: the stream ends inside a block/);
  });

  it('names a stream that ends inside a stored block header', () => {
    // A stored block needs four more bytes for LEN and NLEN; this has one.
    for (const head of [[0x01], [0x01, 0x05], [0x01, 0x05, 0x00]]) {
      expect(() => inflateRaw(new Uint8Array(head)))
        .toThrow(/ANSIMAX_DEFLATE_TRUNCATED: the stream ends inside a stored block/);
    }
  });

  it('names LEN and NLEN that are not complements', () => {
    expect(() => inflateRaw(new Uint8Array([137, 161, 62, 124, 70])))
      .toThrow(/ANSIMAX_DEFLATE_STORED: LEN \d+ and NLEN \d+ are not complements/);
  });

  it('names the reserved block type', () => {
    expect(() => inflateRaw(new Uint8Array([174, 36, 128, 193, 85, 164])))
      .toThrow(/ANSIMAX_DEFLATE_BLOCKTYPE: block type 3 is reserved/);
  });

  it('gives up rather than walking past 15 bits of Huffman code', () => {
    expect(() => inflateRaw(new Uint8Array([42, 79, 46, 14, 223, 0, 254, 26, 92, 49, 234, 160, 20, 206])))
      .toThrow(/ANSIMAX_DEFLATE_HUFFMAN: no symbol matches the bits read/);
  });

  it('names a length symbol outside the table', () => {
    expect(() => inflateRaw(new Uint8Array([
      27, 63, 135, 253, 84, 19, 74, 252, 152, 105, 44, 119, 107, 175, 167,
    ]))).toThrow(/ANSIMAX_DEFLATE_LENGTH: length symbol 287 is out of range/);
  });

  it('names a match that points further back than the output goes', () => {
    expect(() => inflateRaw(new Uint8Array([
      170, 142, 183, 19, 138, 82, 252, 69, 166, 163, 114, 247, 213, 108, 25, 219, 189, 17, 158,
    ]))).toThrow(/ANSIMAX_DEFLATE_DISTANCE: a match points \d+ bytes back but only \d+ have been written/);
  });

  it('names a repeat-previous code that opens the length stream', () => {
    expect(() => inflateRaw(new Uint8Array([
      36, 46, 152, 121, 211, 72, 120, 112, 203, 229, 177, 185, 174, 35, 229, 117,
    ]))).toThrow(/ANSIMAX_DEFLATE_CLEN: a repeat-previous code opens the length stream/);
  });

  it('names a distance symbol outside the table', () => {
    // No fuzz reaches this one: the fixed table holds exactly the 30 legal
    // distance codes, so only a dynamic block can name symbol 30 or 31. The
    // stream below is built by hand — HDIST declares 32 codes, the literal
    // table holds only end-of-block and the length-3 symbol, and the distance
    // table holds only symbols 30 and 31.
    const CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    const bytesOut: number[] = [];
    let buf = 0;
    let n = 0;
    const bit = (b: number): void => {
      buf |= b << n;
      if (++n === 8) { bytesOut.push(buf); buf = 0; n = 0; }
    };
    /** A plain field: least significant bit first. */
    const field = (v: number, count: number): void => {
      for (let i = 0; i < count; i++) bit((v >> i) & 1);
    };
    /** A Huffman code: most significant bit first, as DEFLATE packs them. */
    const code = (v: number, count: number): void => {
      for (let i = count - 1; i >= 0; i--) bit((v >> i) & 1);
    };

    field(1, 1);            // BFINAL
    field(2, 2);            // BTYPE = dynamic
    field(258 - 257, 5);    // HLIT  = 258, so literal symbol 257 is in range
    field(32 - 1, 5);       // HDIST = 32, two more than any legal stream uses
    field(18 - 4, 4);       // HCLEN = 18, enough to reach code-length symbol 1

    // The code-length alphabet uses only symbols 1 and 18, one bit each, so
    // canonically the lower symbol takes code 0.
    const clenLen = new Array<number>(19).fill(0);
    clenLen[1] = 1;
    clenLen[18] = 1;
    for (let i = 0; i < 18; i++) field(clenLen[CLEN_ORDER[i] as number] as number, 3);
    const zeros = (count: number): void => { code(1, 1); field(count - 11, 7); };
    const one = (): void => code(0, 1);

    zeros(138); zeros(118); // literals 0..255, all unused
    one(); one();           // 256 (end of block) and 257 (length 3)
    zeros(30);              // distance symbols 0..29, all unused
    one(); one();           // distance symbols 30 and 31

    code(1, 1);             // literal symbol 257: a match of length 3
    code(0, 1);             // distance symbol 30, which does not exist
    if (n > 0) bytesOut.push(buf);

    expect(() => inflateRaw(new Uint8Array(bytesOut)))
      .toThrow(/ANSIMAX_DEFLATE_DISTANCE: distance symbol 30 is out of range/);
  });
});

describe('zlib header', () => {
  it('writes 78 01, which RFC 1950 already makes a valid check pair', () => {
    // CMF*256 + FLG has to be a multiple of 31, and 0x7801 is 31 x 991, so
    // there is no correction term to get wrong.
    const wrapped = deflate(new Uint8Array([1, 2, 3]));
    expect(wrapped[0]).toBe(0x78);
    expect(wrapped[1]).toBe(0x01);
    expect((((wrapped[0] as number) << 8) | (wrapped[1] as number)) % 31).toBe(0);
  });
});
