import { encodeQR, renderQR, qrCapacity } from '../qr/index.js';

// ─────────────────────────────────────────────
//  Phase 12 — QR symbols (v1.10.0)
//
//  While this was built, the output was checked two independent ways: every
//  symbol was decoded by a real QR decoder (jsQR) and round-tripped back to
//  the original text, and each matrix was compared module-by-module against a
//  reference encoder with the mask forced on both sides. The fixed snapshot
//  below locks that verified output in so a regression cannot slip through.
// ─────────────────────────────────────────────

/** "HELLO", level L, mask 2 — verified by decode and against a reference. */
const HELLO_L_MASK2 = [
  '111111100100101111111',
  '100000101001001000001',
  '101110100100001011101',
  '101110101001001011101',
  '101110100011101011101',
  '100000101110101000001',
  '111111101010101111111',
  '000000000011100000000',
  '111110111100110101010',
  '101001000000100101111',
  '000000101111010011001',
  '011111010010000110000',
  '011001101111010010100',
  '000000001101111001011',
  '111111101010101100101',
  '100000100111111001001',
  '101110101000100100100',
  '101110101010100100100',
  '101110101001010010100',
  '100000101010000110101',
  '111111101001010010100',
];

const asRows = (modules: boolean[][]): string[] =>
  modules.map((row) => row.map((m) => (m ? '1' : '0')).join(''));

describe('encodeQR — structure', () => {
  it('matches the verified snapshot exactly', () => {
    const qr = encodeQR('HELLO', { level: 'L', mask: 2 });
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(qr.mode).toBe('alnum');
    expect(asRows(qr.modules)).toEqual(HELLO_L_MASK2);
  });

  it('places the three finder patterns', () => {
    const qr = encodeQR('https://example.com', { level: 'M' });
    const { modules, size } = qr;
    for (const [oy, ox] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
      // A finder is a 7x7 ring: dark border, light ring, 3x3 dark core.
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const ring = Math.max(Math.abs(dy - 3), Math.abs(dx - 3));
          expect(modules[(oy as number) + dy]![(ox as number) + dx]).toBe(ring !== 2);
        }
      }
    }
  });

  it('alternates the timing patterns between the finders', () => {
    const { modules, size } = encodeQR('timing', { level: 'L' });
    for (let i = 8; i < size - 8; i++) {
      expect(modules[6]![i]).toBe(i % 2 === 0);
      expect(modules[i]![6]).toBe(i % 2 === 0);
    }
  });

  it('sets the always-dark module', () => {
    const { modules, size } = encodeQR('dark', { level: 'Q' });
    expect(modules[size - 8]![8]).toBe(true);
  });

  it('separates the finders with a light border', () => {
    const { modules, size } = encodeQR('sep', { level: 'L' });
    for (let i = 0; i < 8; i++) {
      expect(modules[7]![i]).toBe(false);
      expect(modules[i]![7]).toBe(false);
      expect(modules[7]![size - 1 - i]).toBe(false);
    }
  });

  it('sizes the symbol as version * 4 + 17', () => {
    for (const version of [1, 2, 7, 10, 25, 40]) {
      expect(encodeQR('x', { version }).size).toBe(version * 4 + 17);
    }
  });

  it('is deterministic', () => {
    const a = encodeQR('repeatable', { level: 'H' });
    const b = encodeQR('repeatable', { level: 'H' });
    expect(asRows(a.modules)).toEqual(asRows(b.modules));
    expect(a.mask).toBe(b.mask);
  });
});

describe('encodeQR — modes and versions', () => {
  it('picks the most compact mode automatically', () => {
    expect(encodeQR('12345').mode).toBe('numeric');
    expect(encodeQR('HELLO WORLD').mode).toBe('alnum');
    expect(encodeQR('Hello World').mode).toBe('byte'); // lowercase isn't alnum in QR
    expect(encodeQR('ñ日本語 😀').mode).toBe('byte');
    expect(encodeQR('').mode).toBe('byte');
  });

  it('honours a forced mode', () => {
    expect(encodeQR('12345', { mode: 'byte' }).mode).toBe('byte');
    expect(encodeQR('12345', { mode: 'alnum' }).mode).toBe('alnum');
  });

  it('grows the version with the payload', () => {
    const short = encodeQR('hi', { level: 'L' }).version;
    const medium = encodeQR('a'.repeat(100), { level: 'L' }).version;
    const long = encodeQR('a'.repeat(1000), { level: 'L' }).version;
    expect(short).toBeLessThan(medium);
    expect(medium).toBeLessThan(long);
  });

  it('needs a higher version at a stronger level', () => {
    const text = 'a'.repeat(100);
    expect(encodeQR(text, { level: 'L' }).version)
      .toBeLessThanOrEqual(encodeQR(text, { level: 'H' }).version);
  });

  it('respects minVersion and maxVersion', () => {
    expect(encodeQR('hi', { minVersion: 5 }).version).toBe(5);
    expect(() => encodeQR('a'.repeat(500), { maxVersion: 2 })).toThrow(/ANSIMAX_QR_TOO_LONG/);
  });

  it('encodes every level', () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      expect(encodeQR('level check', { level }).level).toBe(level);
    }
  });

  it('tries all eight masks by default and reports the chosen one', () => {
    const qr = encodeQR('mask selection', { level: 'M' });
    expect(qr.mask).toBeGreaterThanOrEqual(0);
    expect(qr.mask).toBeLessThanOrEqual(7);
  });

  it('honours a forced mask', () => {
    for (let mask = 0; mask < 8; mask++) {
      expect(encodeQR('forced', { mask }).mask).toBe(mask);
    }
  });
});

describe('encodeQR — input validation', () => {
  it('rejects a non-string payload', () => {
    expect(() => encodeQR(42 as unknown as string)).toThrow(/ANSIMAX_QR_INPUT/);
  });

  it('rejects an unknown level', () => {
    expect(() => encodeQR('x', { level: 'Z' as 'L' })).toThrow(/ANSIMAX_QR_LEVEL/);
  });

  it('rejects an out-of-range version or mask', () => {
    expect(() => encodeQR('x', { version: 0 })).toThrow(/ANSIMAX_QR_VERSION/);
    expect(() => encodeQR('x', { version: 41 })).toThrow(/ANSIMAX_QR_VERSION/);
    expect(() => encodeQR('x', { mask: 8 })).toThrow(/ANSIMAX_QR_MASK/);
    expect(() => encodeQR('x', { mask: -1 })).toThrow(/ANSIMAX_QR_MASK/);
  });

  it('rejects text that cannot fit at all', () => {
    expect(() => encodeQR('y'.repeat(1500), { level: 'H' })).toThrow(/ANSIMAX_QR_TOO_LONG/);
    expect(() => encodeQR('a'.repeat(50), { version: 1 })).toThrow(/ANSIMAX_QR_TOO_LONG/);
  });

  it('handles the empty string', () => {
    const qr = encodeQR('');
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
  });
});

describe('qrCapacity', () => {
  it('matches the canonical table', () => {
    // ISO/IEC 18004 capacity table spot checks.
    expect(qrCapacity(1, 'L', 'numeric')).toBe(41);
    expect(qrCapacity(1, 'L', 'alnum')).toBe(25);
    expect(qrCapacity(1, 'L', 'byte')).toBe(17);
    expect(qrCapacity(1, 'M', 'byte')).toBe(14);
    expect(qrCapacity(1, 'Q', 'byte')).toBe(11);
    expect(qrCapacity(1, 'H', 'byte')).toBe(7);
    expect(qrCapacity(10, 'L', 'byte')).toBe(271);
    expect(qrCapacity(25, 'Q', 'byte')).toBe(715);
    expect(qrCapacity(40, 'L', 'numeric')).toBe(7089);
    expect(qrCapacity(40, 'L', 'alnum')).toBe(4296);
    expect(qrCapacity(40, 'L', 'byte')).toBe(2953);
    expect(qrCapacity(40, 'M', 'byte')).toBe(2331);
    expect(qrCapacity(40, 'Q', 'byte')).toBe(1663);
    expect(qrCapacity(40, 'H', 'byte')).toBe(1273);
  });

  it('grows with version and shrinks with correction strength', () => {
    expect(qrCapacity(5, 'L')).toBeGreaterThan(qrCapacity(4, 'L'));
    expect(qrCapacity(10, 'L')).toBeGreaterThan(qrCapacity(10, 'H'));
  });

  it('agrees with what encodeQR actually accepts', () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      for (const version of [1, 5, 12, 30]) {
        const max = qrCapacity(version, level, 'byte');
        expect(encodeQR('a'.repeat(max), { version, level, mode: 'byte' }).version).toBe(version);
        expect(() => encodeQR('a'.repeat(max + 1), { version, level, mode: 'byte' }))
          .toThrow(/ANSIMAX_QR_TOO_LONG/);
      }
    }
  });

  it('rejects an out-of-range version or level', () => {
    expect(() => qrCapacity(0)).toThrow(/ANSIMAX_QR_VERSION/);
    expect(() => qrCapacity(41)).toThrow(/ANSIMAX_QR_VERSION/);
    expect(() => qrCapacity(1, 'Z' as 'L')).toThrow(/ANSIMAX_QR_LEVEL/);
  });
});

describe('renderQR', () => {
  it('packs two module rows per line, so it is half as tall as wide', () => {
    const qr = encodeQR('half blocks', { level: 'M' });
    const lines = renderQR(qr, { quiet: 2 }).split('\n');
    const span = qr.size + 4;
    expect(lines[0]!.length).toBe(span);
    expect(lines).toHaveLength(Math.ceil(span / 2));
  });

  it('uses only the four half-block characters', () => {
    const out = renderQR('charset', { level: 'L' });
    expect(/^[█▀▄ \n]+$/.test(out)).toBe(true);
  });

  it('recovers every module from the rendered output', () => {
    const qr = encodeQR('https://github.com/Brashkie/ansimax', { level: 'M' });
    const quiet = 2;
    const lines = renderQR(qr, { quiet }).split('\n');
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        const ch = lines[Math.floor((y + quiet) / 2)]![x + quiet] as string;
        const top = (y + quiet) % 2 === 0;
        const painted = top ? ch === '█' || ch === '▀' : ch === '█' || ch === '▄';
        // Default (non-inverted) draws the LIGHT modules.
        expect(painted).toBe(!qr.modules[y]![x]);
      }
    }
  });

  it('inverts for a light background', () => {
    const normal = renderQR('invert me', { level: 'L', mask: 0, quiet: 0 });
    const inverted = renderQR('invert me', { level: 'L', mask: 0, quiet: 0, invert: true });
    expect(inverted).not.toBe(normal);
    // Inverting swaps which modules get a block, so the full/empty counts swap.
    const count = (s: string, ch: string) => s.split(ch).length - 1;
    expect(count(inverted, '█')).toBe(count(normal, ' '));
  });

  it('honours the quiet zone width', () => {
    for (const quiet of [0, 1, 2, 4]) {
      const qr = encodeQR('quiet', { level: 'L' });
      const lines = renderQR(qr, { quiet }).split('\n');
      expect(lines[0]!.length).toBe(qr.size + quiet * 2);
    }
  });

  it('accepts text directly as well as an encoded symbol', () => {
    const fromText = renderQR('same thing', { level: 'Q', mask: 3 });
    const fromCode = renderQR(encodeQR('same thing', { level: 'Q', mask: 3 }));
    expect(fromText).toBe(fromCode);
  });
});
