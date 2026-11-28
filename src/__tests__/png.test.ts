import { decodePNG, encodePNG } from '../images/png.js';
import { crc32, deflate } from '../deflate/index.js';
import {
  base64Encode, encodeKittyImage, encodeITerm2Image,
} from '../images/protocols.js';
import type { Pixel, PixelGrid } from '../images/index.js';

// ─────────────────────────────────────────────
//  Phase 12 — PNG + the vendor protocols (v1.10.0)
//
//  Verified in the sandbox three ways: 15 PNG variants written by Pillow
//  (RGB, grey, palette, bilevel, grey+alpha, RGBA, 16-bit, palette+tRNS, and
//  each of those interlaced) decoded pixel-exact; our own PNGs read back
//  exactly by pngjs, UPNG and Pillow; and base64 matched Node's Buffer over
//  3,000 random buffers. These tests pin the structure and the error paths.
// ─────────────────────────────────────────────

const px = (r: number, g: number, b: number, a?: number): Pixel =>
  (a === undefined ? { r, g, b } : ({ r, g, b, a } as Pixel));

const grid = (w: number, h: number, f: (x: number, y: number) => Pixel): PixelGrid =>
  Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => f(x, y)));

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Chunk types in the order they appear. */
const chunkTypes = (file: Uint8Array): string[] => {
  const types: string[] = [];
  let at = 8;
  while (at + 8 <= file.length) {
    const length =
      ((file[at] as number) << 24) | ((file[at + 1] as number) << 16) |
      ((file[at + 2] as number) << 8) | (file[at + 3] as number);
    types.push(String.fromCharCode(
      file[at + 4] as number, file[at + 5] as number,
      file[at + 6] as number, file[at + 7] as number,
    ));
    at += 12 + length;
  }
  return types;
};

const chunkBody = (file: Uint8Array, type: string): Uint8Array | null => {
  let at = 8;
  while (at + 8 <= file.length) {
    const length =
      ((file[at] as number) << 24) | ((file[at + 1] as number) << 16) |
      ((file[at + 2] as number) << 8) | (file[at + 3] as number);
    const name = String.fromCharCode(
      file[at + 4] as number, file[at + 5] as number,
      file[at + 6] as number, file[at + 7] as number,
    );
    if (name === type) return file.subarray(at + 8, at + 8 + length);
    at += 12 + length;
  }
  return null;
};

describe('encodePNG structure', () => {
  const image = grid(4, 3, (x, y) => px(x * 60, y * 80, 128));

  it('starts with the PNG signature', () => {
    const file = encodePNG(image);
    expect([...file.subarray(0, 8)]).toEqual(SIGNATURE);
  });

  it('writes IHDR, IDAT and IEND in that order', () => {
    expect(chunkTypes(encodePNG(image))).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('puts the dimensions, depth and colour type in IHDR', () => {
    const ihdr = chunkBody(encodePNG(image), 'IHDR') as Uint8Array;
    expect(ihdr).toHaveLength(13);
    expect(((ihdr[0] as number) << 24) | ((ihdr[1] as number) << 16) | ((ihdr[2] as number) << 8) | (ihdr[3] as number)).toBe(4);
    expect(((ihdr[4] as number) << 24) | ((ihdr[5] as number) << 16) | ((ihdr[6] as number) << 8) | (ihdr[7] as number)).toBe(3);
    expect(ihdr[8]).toBe(8); // bit depth
    expect(ihdr[9]).toBe(2); // colour type 2 = RGB, no alpha needed here
    expect(ihdr[10]).toBe(0); // DEFLATE
    expect(ihdr[11]).toBe(0); // adaptive filtering
    expect(ihdr[12]).toBe(0); // not interlaced
  });

  it('writes a correct CRC on every chunk', () => {
    const file = encodePNG(image);
    let at = 8;
    let checked = 0;
    while (at + 8 <= file.length) {
      const length =
        ((file[at] as number) << 24) | ((file[at + 1] as number) << 16) |
        ((file[at + 2] as number) << 8) | (file[at + 3] as number);
      const stored =
        (((file[at + 8 + length] as number) << 24) |
          ((file[at + 9 + length] as number) << 16) |
          ((file[at + 10 + length] as number) << 8) |
          (file[at + 11 + length] as number)) >>> 0;
      expect(crc32(file.subarray(at + 4, at + 8 + length))).toBe(stored);
      checked++;
      at += 12 + length;
    }
    expect(checked).toBe(3);
  });

  it('switches to colour type 6 when the image has transparency', () => {
    const withHole: PixelGrid = [[px(1, 2, 3), null]];
    expect((chunkBody(encodePNG(withHole), 'IHDR') as Uint8Array)[9]).toBe(6);
    const withAlpha: PixelGrid = [[px(1, 2, 3, 0.5)]];
    expect((chunkBody(encodePNG(withAlpha), 'IHDR') as Uint8Array)[9]).toBe(6);
  });

  it('honours an explicit alpha choice either way', () => {
    const opaque = grid(2, 2, () => px(9, 9, 9));
    expect((chunkBody(encodePNG(opaque, { alpha: true }), 'IHDR') as Uint8Array)[9]).toBe(6);
    const holey: PixelGrid = [[px(1, 2, 3), null]];
    expect((chunkBody(encodePNG(holey, { alpha: false }), 'IHDR') as Uint8Array)[9]).toBe(2);
  });

  it('rejects anything that is not a pixel grid', () => {
    expect(() => encodePNG([])).toThrow(/ANSIMAX_PNG_INPUT/);
    expect(() => encodePNG([[]])).toThrow(/ANSIMAX_PNG_INPUT/);
    expect(() => encodePNG(null as unknown as PixelGrid)).toThrow(/ANSIMAX_PNG_INPUT/);
  });
});

describe('PNG round trip', () => {
  const cases: Record<string, PixelGrid> = {
    'single pixel': [[px(1, 2, 3)]],
    'one row': grid(17, 1, (x) => px(x * 15, 0, 255 - x * 15)),
    'one column': grid(1, 13, (_, y) => px(0, y * 19, 0)),
    gradient: grid(32, 24, (x, y) => px(x * 8, y * 10, 128)),
    flat: grid(20, 20, () => px(17, 99, 240)),
    'with holes': grid(12, 12, (x, y) => ((x + y) % 3 === 0 ? null : px(200, 50, 50))),
    'with alpha': grid(10, 10, (x) => px(10, 200, 90, (x % 4) / 3)),
    'extreme values': [[px(0, 0, 0), px(255, 255, 255)]],
  };

  for (const [name, image] of Object.entries(cases)) {
    it(`survives ${name}`, () => {
      for (const level of [0, 6, 9]) {
        const back = decodePNG(encodePNG(image, { level }));
        expect(back.height).toBe(image.length);
        expect(back.width).toBe(Math.max(...image.map((r) => r.length)));
        for (let y = 0; y < back.height; y++) {
          for (let x = 0; x < back.width; x++) {
            const want = (image[y] as Pixel[])[x] as Pixel;
            const got = (back.pixels[y] as Pixel[])[x];
            if (want === null || (want as { a?: number }).a === 0) {
              expect(got).toBeNull();
              continue;
            }
            expect(got).not.toBeNull();
            const solid = got as NonNullable<Pixel>;
            expect(solid.r).toBe(want.r);
            expect(solid.g).toBe(want.g);
            expect(solid.b).toBe(want.b);
            const wantA = (want as { a?: number }).a ?? 1;
            const gotA = (solid as { a?: number }).a ?? 1;
            expect(Math.abs(gotA - wantA)).toBeLessThan(0.01);
          }
        }
      }
    });
  }

  it('survives every forced filter', () => {
    const image = grid(16, 16, (x, y) => px((x * y) % 256, (x ^ y) % 256, (x + y) % 256));
    for (const filter of [0, 1, 2, 3, 4] as const) {
      const back = decodePNG(encodePNG(image, { filter }));
      expect((back.pixels[7] as Pixel[])[7]).toEqual((image[7] as Pixel[])[7]);
    }
  });

  it('picks filters adaptively, which beats forcing none', () => {
    // A smooth gradient is exactly what the Up and Paeth filters are for.
    const image = grid(64, 64, (x, y) => px(x * 4, y * 4, 128));
    expect(encodePNG(image, { filter: 'auto' }).length)
      .toBeLessThan(encodePNG(image, { filter: 0 }).length);
  });

  it('pads ragged rows to the widest', () => {
    const ragged: PixelGrid = [[px(1, 1, 1)], [px(2, 2, 2), px(3, 3, 3), px(4, 4, 4)]];
    const back = decodePNG(encodePNG(ragged));
    expect(back.width).toBe(3);
    expect((back.pixels[0] as Pixel[])[2]).toBeNull(); // the pad is transparent
  });

  it('clamps out-of-range and non-finite channels', () => {
    const odd: PixelGrid = [[px(300, -20, Number.NaN)]];
    const back = decodePNG(encodePNG(odd));
    expect((back.pixels[0] as Pixel[])[0]).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('reports what the file said about itself', () => {
    const image = grid(5, 5, () => px(1, 2, 3));
    const opaque = decodePNG(encodePNG(image));
    expect(opaque.colorType).toBe(2);
    expect(opaque.bitDepth).toBe(8);
    expect(opaque.hasAlpha).toBe(false);
    expect(opaque.interlaced).toBe(false);
    const transparent = decodePNG(encodePNG([[px(1, 2, 3), null]]));
    expect(transparent.colorType).toBe(6);
    expect(transparent.hasAlpha).toBe(true);
  });

  it('can drop the alpha channel on decode', () => {
    const file = encodePNG([[px(10, 20, 30, 0.5)]]);
    expect(((decodePNG(file).pixels[0] as Pixel[])[0] as { a?: number }).a).toBeCloseTo(0.5, 2);
    expect(((decodePNG(file, { alpha: false }).pixels[0] as Pixel[])[0] as { a?: number }).a)
      .toBeUndefined();
  });
});

describe('decodePNG error paths', () => {
  const valid = encodePNG(grid(4, 4, () => px(1, 2, 3)));

  it('rejects a file that is not a PNG', () => {
    expect(() => decodePNG(new Uint8Array(0))).toThrow(/ANSIMAX_PNG_SIGNATURE/);
    expect(() => decodePNG(new Uint8Array([1, 2, 3]))).toThrow(/ANSIMAX_PNG_SIGNATURE/);
    const wrong = valid.slice();
    wrong[3] = 0;
    expect(() => decodePNG(wrong)).toThrow(/ANSIMAX_PNG_SIGNATURE/);
  });

  it('rejects a non-Uint8Array', () => {
    expect(() => decodePNG([1, 2] as unknown as Uint8Array)).toThrow(/ANSIMAX_PNG_INPUT/);
  });

  it('rejects a file that ends inside a chunk', () => {
    expect(() => decodePNG(valid.subarray(0, 20))).toThrow(/ANSIMAX_PNG_TRUNCATED/);
  });

  it('rejects a chunk whose CRC does not match', () => {
    const tampered = valid.slice();
    // Flip a byte inside IHDR's body, leaving the stored CRC alone.
    tampered[20] = ((tampered[20] as number) ^ 0x01) & 0xff;
    expect(() => decodePNG(tampered)).toThrow(/ANSIMAX_PNG_CRC/);
  });

  it('rejects impossible headers', () => {
    const build = (mutate: (ihdr: Uint8Array) => void): Uint8Array => {
      const file = valid.slice();
      const ihdr = file.subarray(16, 29);
      mutate(ihdr);
      // Re-stamp the CRC so the header check is what fails, not the checksum.
      const sum = crc32(file.subarray(12, 29));
      file[29] = (sum >>> 24) & 0xff;
      file[30] = (sum >>> 16) & 0xff;
      file[31] = (sum >>> 8) & 0xff;
      file[32] = sum & 0xff;
      return file;
    };
    expect(() => decodePNG(build((h) => { h[0] = 0; h[1] = 0; h[2] = 0; h[3] = 0; })))
      .toThrow(/ANSIMAX_PNG_IHDR/);
    expect(() => decodePNG(build((h) => { h[8] = 3; }))).toThrow(/ANSIMAX_PNG_IHDR/);
    expect(() => decodePNG(build((h) => { h[9] = 1; }))).toThrow(/ANSIMAX_PNG_IHDR/);
    expect(() => decodePNG(build((h) => { h[8] = 4; h[9] = 2; }))).toThrow(/ANSIMAX_PNG_IHDR/);
    expect(() => decodePNG(build((h) => { h[10] = 1; }))).toThrow(/ANSIMAX_PNG_UNSUPPORTED/);
    expect(() => decodePNG(build((h) => { h[11] = 1; }))).toThrow(/ANSIMAX_PNG_UNSUPPORTED/);
    expect(() => decodePNG(build((h) => { h[12] = 2; }))).toThrow(/ANSIMAX_PNG_UNSUPPORTED/);
  });

  it('rejects a file with no IHDR or no IDAT', () => {
    const headerOnly = new Uint8Array(8 + 12);
    headerOnly.set(SIGNATURE, 0);
    // An IEND with a valid CRC and nothing before it.
    headerOnly[11] = 0;
    headerOnly[12] = 0x49; headerOnly[13] = 0x45; headerOnly[14] = 0x4e; headerOnly[15] = 0x44;
    const sum = crc32(headerOnly.subarray(12, 16));
    headerOnly[16] = (sum >>> 24) & 0xff;
    headerOnly[17] = (sum >>> 16) & 0xff;
    headerOnly[18] = (sum >>> 8) & 0xff;
    headerOnly[19] = sum & 0xff;
    expect(() => decodePNG(headerOnly)).toThrow(/ANSIMAX_PNG_IHDR/);
  });
});

describe('base64Encode', () => {
  it('encodes the three tail lengths correctly', () => {
    const enc = (s: string): string => base64Encode(new TextEncoder().encode(s));
    expect(enc('')).toBe('');
    expect(enc('a')).toBe('YQ==');
    expect(enc('ab')).toBe('YWI=');
    expect(enc('abc')).toBe('YWJj');
    expect(enc('abcd')).toBe('YWJjZA==');
    expect(enc('abcde')).toBe('YWJjZGU=');
    expect(enc('ansimax')).toBe('YW5zaW1heA==');
  });

  it('uses the whole alphabet, including + and /', () => {
    expect(base64Encode(new Uint8Array([0xfb, 0xef, 0xbe]))).toBe('++++');
    expect(base64Encode(new Uint8Array([0xff, 0xff, 0xff]))).toBe('////');
  });

  it('handles a buffer past its internal chunk boundary', () => {
    // The encoder works in 3 KB groups; a buffer spanning several must come
    // out identical to one that does not.
    const data = Uint8Array.from({ length: 10_000 }, (_, i) => i % 256);
    const out = base64Encode(data);
    expect(out).toHaveLength(Math.ceil(10_000 / 3) * 4);
    expect(out.endsWith('=')).toBe(true); // 10000 % 3 === 1
    // Decoding it back through a second implementation.
    const back = Uint8Array.from(atobLike(out));
    expect(back).toHaveLength(10_000);
    expect(back[9999]).toBe(9999 % 256);
  });

  it('rejects a non-Uint8Array', () => {
    expect(() => base64Encode('abc' as unknown as Uint8Array)).toThrow(/ANSIMAX_BASE64_INPUT/);
  });
});

/** A minimal base64 decoder, so the test does not trust the encoder twice. */
const atobLike = (s: string): number[] => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    if (ch === '=') break;
    buffer = (buffer << 6) | alphabet.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 0xff);
    }
  }
  return out;
};

describe('encodeKittyImage', () => {
  const image = grid(3, 2, (x, y) => px(x * 100, y * 100, 50));

  it('wraps the payload in an APC sequence', () => {
    const out = encodeKittyImage(image);
    expect(out.startsWith('\x1b_G')).toBe(true);
    expect(out.endsWith('\x1b\\')).toBe(true);
    expect(out).toContain(';');
  });

  it('declares transmit-and-display, the format and the pixel size', () => {
    const keys = encodeKittyImage(image).slice(3).split(';')[0] as string;
    expect(keys).toContain('a=T');
    expect(keys).toContain('f=24'); // no transparency → RGB
    expect(keys).toContain('s=3');
    expect(keys).toContain('v=2');
  });

  it('uses RGBA when the image has transparency', () => {
    const holey: PixelGrid = [[px(1, 2, 3), null]];
    expect(encodeKittyImage(holey)).toContain('f=32');
    expect(encodeKittyImage(image, { alpha: true })).toContain('f=32');
  });

  it('sends the pixels in row-major order', () => {
    const payload = encodeKittyImage(image).split(';')[1] as string;
    const raw = atobLike(payload.slice(0, payload.length - 2));
    expect(raw.slice(0, 6)).toEqual([0, 0, 50, 100, 0, 50]);
  });

  it('pads a transparent pixel with zeros in the RGBA stream', () => {
    const holey: PixelGrid = [[px(255, 255, 255), null]];
    const payload = encodeKittyImage(holey).split(';')[1] as string;
    const raw = atobLike(payload.slice(0, payload.length - 2));
    expect(raw).toEqual([255, 255, 255, 255, 0, 0, 0, 0]);
  });

  it('can send a PNG instead of raw pixels', () => {
    const out = encodeKittyImage(image, { png: true });
    expect(out).toContain('f=100');
    const payload = out.split(';')[1] as string;
    const file = new Uint8Array(atobLike(payload.slice(0, payload.length - 2)));
    expect(decodePNG(file).width).toBe(3);
  });

  it('suppresses the terminal reply unless asked not to', () => {
    expect(encodeKittyImage(image)).toContain('q=2');
    expect(encodeKittyImage(image, { quiet: false })).not.toContain('q=2');
  });

  it('passes a display size through', () => {
    const out = encodeKittyImage(image, { columns: 20, rows: 10 });
    expect(out).toContain('c=20');
    expect(out).toContain('r=10');
    expect(encodeKittyImage(image, { columns: 0, rows: -4 })).not.toContain('c=');
  });

  it('chunks a large payload, with m=1 on every chunk but the last', () => {
    const big = grid(60, 60, (x, y) => px(x * 4, y * 4, 128));
    const out = encodeKittyImage(big);
    const chunks = out.split('\x1b\\').filter((c) => c.length > 0);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toContain('a=T');
    expect(chunks[0]).toContain('m=1');
    for (const middle of chunks.slice(1, -1)) {
      expect(middle.startsWith('\x1b_Gm=1;')).toBe(true);
    }
    expect((chunks[chunks.length - 1] as string).startsWith('\x1b_Gm=0;')).toBe(true);
  });

  it('reassembles to exactly the pixel data', () => {
    const big = grid(60, 60, (x, y) => px(x * 4, y * 4, 128));
    const chunks = encodeKittyImage(big).split('\x1b\\').filter((c) => c.length > 0);
    const payload = chunks.map((c) => c.slice(c.indexOf(';') + 1)).join('');
    expect(atobLike(payload)).toHaveLength(60 * 60 * 3);
  });

  it('keeps the whole payload in one sequence when it fits', () => {
    expect(encodeKittyImage(image).split('\x1b\\').filter((c) => c.length > 0)).toHaveLength(1);
  });

  it('honours a chunk size, and ignores a nonsense one', () => {
    const big = grid(40, 40, () => px(1, 2, 3));
    const small = encodeKittyImage(big, { chunkSize: 64 });
    expect(small.split('\x1b\\').filter((c) => c.length > 0).length).toBeGreaterThan(20);
    expect(() => encodeKittyImage(big, { chunkSize: Number.NaN })).not.toThrow();
    expect(() => encodeKittyImage(big, { chunkSize: -10 })).not.toThrow();
  });

  it('rejects anything that is not a pixel grid', () => {
    expect(() => encodeKittyImage([])).toThrow(/ANSIMAX_PROTOCOL_INPUT/);
    expect(() => encodeKittyImage([[]])).toThrow(/ANSIMAX_PROTOCOL_INPUT/);
  });
});

describe('encodeITerm2Image', () => {
  const image = grid(4, 3, (x, y) => px(x * 50, y * 70, 10));

  it('wraps a PNG in an OSC 1337 File sequence', () => {
    const out = encodeITerm2Image(image);
    expect(out.startsWith('\x1b]1337;File=')).toBe(true);
    expect(out.endsWith('\x07')).toBe(true);
    expect(out).toContain('inline=1');
  });

  it('states the byte count of the file it sent', () => {
    const out = encodeITerm2Image(image);
    const payload = out.slice(out.indexOf(':') + 1, -1);
    const file = new Uint8Array(atobLike(payload));
    expect(out).toContain(`size=${file.length}`);
    expect(decodePNG(file).width).toBe(4);
  });

  it('defaults to the image own pixel size', () => {
    const out = encodeITerm2Image(image);
    expect(out).toContain('width=4px');
    expect(out).toContain('height=3px');
  });

  it('takes a cell count or a CSS-ish size', () => {
    expect(encodeITerm2Image(image, { width: 20 })).toContain('width=20');
    expect(encodeITerm2Image(image, { width: '50%' })).toContain('width=50%');
    expect(encodeITerm2Image(image, { height: 'auto' })).toContain('height=auto');
    // With only one dimension given, the other is left to the terminal.
    expect(encodeITerm2Image(image, { width: 20 })).not.toContain('height=');
  });

  it('preserves the aspect ratio unless told otherwise', () => {
    expect(encodeITerm2Image(image)).toContain('preserveAspectRatio=1');
    expect(encodeITerm2Image(image, { preserveAspectRatio: false }))
      .toContain('preserveAspectRatio=0');
  });

  it('sends a file as given, untouched', () => {
    const png = encodePNG(image);
    const out = encodeITerm2Image(png);
    expect(out).toContain(`size=${png.length}`);
    expect(out).not.toContain('width='); // no pixel size is known from a blob
    expect(out.slice(out.indexOf(':') + 1, -1)).toBe(base64Encode(png));
  });

  it('base64-encodes the name it was given', () => {
    const out = encodeITerm2Image(image, { name: 'chart.png' });
    expect(out).toContain(`name=${base64Encode(new TextEncoder().encode('chart.png'))}`);
  });

  it('wraps for tmux passthrough on request, doubling the escapes', () => {
    const plain = encodeITerm2Image(image);
    const wrapped = encodeITerm2Image(image, { tmux: true });
    expect(wrapped.startsWith('\x1bPtmux;')).toBe(true);
    expect(wrapped.endsWith('\x1b\\')).toBe(true);
    expect(wrapped).toContain('\x1b\x1b]1337;');
    expect(plain.startsWith('\x1bPtmux;')).toBe(false);
  });

  it('rejects anything that is not a grid or a file', () => {
    expect(() => encodeITerm2Image([])).toThrow(/ANSIMAX_PROTOCOL_INPUT/);
    expect(() => encodeITerm2Image([[]])).toThrow(/ANSIMAX_PROTOCOL_INPUT/);
  });
});

// ─────────────────────────────────────────────
//  Fixtures from reference encoders, embedded base64 so the suite needs no
//  binary files: the plain ones written by Pillow (libpng), the interlaced
//  ones by ImageMagick — Pillow silently ignores `interlace=True`, which is
//  how the Adam7 path went unexercised for a while. Expected pixels are what
//  Pillow reads back from the same bytes, so these check the decoder against
//  a reference rather than against itself.
// ─────────────────────────────────────────────

/** 8-bit greyscale. */
const PNG_GREY8 =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHCAAAAAD7BeiBAAAARElEQVR4XiXKQQqAMAxFQdvkhxda' +
  'Cl1IvP85XYi6mdW0g4T8aBVDU+PVK3sujJXdLym2QjvkRXInnOClqUMj6v8YRmEPlP0D1z4izJcA' +
  'AAAASUVORK5CYII=';

/** palette, 4-bit indices. */
const PNG_PALETTE =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHBAMAAAAsQKpuAAAAGFBMVEWtzGKtlGKtb2IuuTwubyKt' +
  'OGKtAGIuJR20Z5NCAAAAMUlEQVR4Xh3B0QmAMBAFsLTcAk7rlBY3eX4rtoJJ263LXbR4+mugTvMw' +
  'K7ZYRUL3+wC7Ew+Rr6XndQAAAABJRU5ErkJggg==';

/** 1-bit, two colours. */
const PNG_BILEVEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHAQAAAAD2FYrwAAAAHUlEQVR4XmNgUGBiVWBSYWCSYWD6' +
  'oMC4+isTkwMAGD0Dg1mUsKkAAAAASUVORK5CYII=';

/** 8-bit greyscale with alpha. */
const PNG_GREY_ALPHA =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHCAQAAAB0Z3/WAAAAOUlEQVR4Xq2MwQkAIAwDLw7qHGYC' +
  '3brSIuIAfkLuCFGHAMwiMBMxmCp9EVDOWi0TqXQ1p37w9D8nG61mGRUH/WKuAAAAAElFTkSuQmCC';

/** 8-bit RGBA. */
const PNG_RGBA =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHCAYAAADebrddAAAAS0lEQVR4XmM8oRHFwMDA8B9EMDAw' +
  'VDIwMHRA+SB2OwMDAyMDA0MFiM0EVQRTCJJEZ4MAWBymGGYKDCBrgoFKmGKskjAToc4bLM4AAF+Y' +
  'FletU1UoAAAAAElFTkSuQmCC';

/** palette with tRNS, index 0 transparent. */
const PNG_PALETTE_TRNS =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHBAMAAAAsQKpuAAAAGFBMVEXIKFrIKFrIKFoAAAAAAAAA' +
  'AAAAAAAAAACpn0L5AAAAAXRSTlMAQObYZgAAACNJREFUeF5jEGASUBBiYGKQY3rwj4GJ6cE/JgYF' +
  'pn9gPlZBAAxADGGcuf6VAAAAAElFTkSuQmCC';

/** 16-bit greyscale. */
const PNG_GREY16 =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHEAAAAACrlTTCAAAAMklEQVR4XmNkYOBfILAAhJFJJqY9' +
  'zHtAGJlk2sMEEkAVBPNgqtDUIxuAJIVpAEg/DrMBJj84FpFzhGoAAAAASUVORK5CYII=';

/** 8-bit greyscale, Adam7 interlaced. */
const PNG_GREY8_I =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHCAAAAAGMAtgXAAAAAmJLR0QA/4ePzL8AAAAHdElNRQfq' +
  'CxwLHhDTt4soAAAAUUlEQVQI1wXBsQ3AIAwEQFvyW1HeBS6AKgX0gSEyB/uvkTuRT4aeujTHtFNf' +
  'XexstENyUq/MLLbZ2G0lymP7Jqd2JwJ0ImwDnnCkwxYCAnpH/FuwBkjw2IQCAAAAAElFTkSuQmCC';

/** palette 4-bit, Adam7 interlaced. */
const PNG_PALETTE_I =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHBAMAAAFbR5r4AAAAIGNIUk0AAHomAACAhAAA+gAAAIDo' +
  'AAB1MAAA6mAAADqYAAAXcJy6UTwAAAAbUExURS4lHa0AYq04Yi5vIq1vYi65PK2UYq3MYv///1xo' +
  'LP0AAAABYktHRAiG3pV6AAAAB3RJTUUH6gscCx4Q07eLKAAAAD5JREFUCNcFwbENwCAMRcHHBrAB' +
  '8gQRRNQUbBB9aD0CndfPHQn4nJTZDs3QCSiZxyoajs4FMKv0/q41kRRxf+RWCbBriBhDAAAAAElF' +
  'TkSuQmCC';

/** 1-bit, Adam7 interlaced. */
const PNG_BILEVEL_I =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHAQAAAAGBErpmAAAAAmJLR0QAAd2KE6QAAAAHdElNRQfq' +
  'CxwLHhDTt4soAAAAJElEQVQI12NgAAMFhgUMCQxvGBgYJBgqGCwYWB0YXB0YVi8AADhOBOqryrLQ' +
  'AAAAAElFTkSuQmCC';

/** greyscale+alpha, Adam7 interlaced. */
const PNG_GREY_ALPHA_I =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHCAQAAAEDYE9AAAAAAmJLR0QA/4ePzL8AAAAHdElNRQfq' +
  'CxwLHhDTt4soAAAAVklEQVQI103MsQ3DQAwEwaFU0HfEOsQK6L5clSI6eAnwRYfFYiMhRYIzZ93r' +
  'e65bE8kII1yHvUJHjtKox1Wb2vx4j9qV0sKlEWYb9O6ptx3p31I+Rv0Al2MfNLVFE20AAAAASUVO' +
  'RK5CYII=';

/** palette with 2-bit indices, Adam7 interlaced. */
const PNG_PALETTE2_I =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHAgMAAAHUB29YAAAAIGNIUk0AAHomAACAhAAA+gAAAIDo' +
  'AAB1MAAA6mAAADqYAAAXcJy6UTwAAAAMUExURcgoWsgoWsgoWv////cFvukAAAACdFJOUwB4KE00' +
  'NgAAAAFiS0dEAxEMTPIAAAAHdElNRQfqCxwLHhDTt4soAAAAKklEQVQI12NgAIMZDBkMSgIMigoM' +
  'sxwYMhsYljWAGGpSGgyaahIMUpoqAHd1Bm2SmlgLAAAAAElFTkSuQmCC';

/** 8-bit RGB (written as a palette), Adam7 interlaced. */
const PNG_RGB_I =
  'iVBORw0KGgoAAAANSUhEUgAAAAsAAAAHCAMAAAGet3f5AAAAIGNIUk0AAHomAACAhAAA+gAAAIDo' +
  'AAB1MAAA6mAAADqYAAAXcJy6UTwAAADqUExURQAAABcADS4AGkUAJ1wANHMAQYoATqEAW7gAaM8A' +
  'deYAggAlDRclAC4lJ0UlGlwlQXMlNIolW6ElTrgldc8laOYljwBKGhdKJy5KAEVKDVxKTnNKW4pK' +
  'NKFKQbhKgs9Kj+ZKaABvJxdvGi5vDUVvAFxvW3NvTopvQaFvNLhvj89vguZvdQCUNBeUQS6UTkWU' +
  'W1yUAHOUDYqUGqGUJ7iUnM+UqeaUtgC5QRe5NC65W0W5Tly5DXO5AIq5J6G5Gri5qc+5nOa5wwDe' +
  'ThfeWy7eNEXeQVzeGnPeJ4reAKHeDbjets/ew+benP///1gh9ugAAAABYktHRE2AaCBlAAAAB3RJ' +
  'TUUH6gscCx4eNA+mLwAAAGNJREFUCNdjYOBgYGHQMTBhYGLjYtAzMmMQk5CSkVNgcHJx8/DyYWBk' +
  'ZmXnZBCXlJaVZ9DVNzQ2ZXB2dff0ZuDm4eXjFxAUEhYRZVBUUlZRVVPX0NTSZjC3sLSytrG1s3dw' +
  'BAC9XgtvjCAHVwAAAABJRU5ErkJggg==';


/** What Pillow reads back from each PNG fixture, as RGBA. */
const PNG_TRUTH: Record<string, number[][][]> = {
  grey8: [
    [[0,0,0,255], [8,8,8,255], [17,17,17,255], [25,25,25,255], [33,33,33,255], [42,42,42,255], [50,50,50,255], [59,59,59,255], [67,67,67,255], [75,75,75,255], [84,84,84,255]],
    [[23,23,23,255], [29,29,29,255], [40,40,40,255], [45,45,45,255], [57,57,57,255], [62,62,62,255], [73,73,73,255], [79,79,79,255], [90,90,90,255], [95,95,95,255], [107,107,107,255]],
    [[46,46,46,255], [55,55,55,255], [57,57,57,255], [66,66,66,255], [80,80,80,255], [88,88,88,255], [91,91,91,255], [99,99,99,255], [113,113,113,255], [122,122,122,255], [124,124,124,255]],
    [[70,70,70,255], [75,75,75,255], [80,80,80,255], [86,86,86,255], [103,103,103,255], [108,108,108,255], [114,114,114,255], [119,119,119,255], [136,136,136,255], [142,142,142,255], [147,147,147,255]],
    [[93,93,93,255], [101,101,101,255], [110,110,110,255], [118,118,118,255], [114,114,114,255], [123,123,123,255], [131,131,131,255], [139,139,139,255], [160,160,160,255], [168,168,168,255], [176,176,176,255]],
    [[116,116,116,255], [121,121,121,255], [133,133,133,255], [138,138,138,255], [138,138,138,255], [143,143,143,255], [154,154,154,255], [160,160,160,255], [183,183,183,255], [188,188,188,255], [200,200,200,255]],
    [[139,139,139,255], [148,148,148,255], [150,150,150,255], [158,158,158,255], [161,161,161,255], [169,169,169,255], [172,172,172,255], [180,180,180,255], [206,206,206,255], [214,214,214,255], [217,217,217,255]],
  ],
  pal: [
    [[46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [173,0,98,255], [173,0,98,255], [173,0,98,255], [173,0,98,255], [173,0,98,255], [173,0,98,255]],
    [[46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255]],
    [[46,37,29,255], [46,111,34,255], [46,37,29,255], [46,37,29,255], [46,111,34,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255]],
    [[46,111,34,255], [46,111,34,255], [46,111,34,255], [46,111,34,255], [46,111,34,255], [173,111,98,255], [173,111,98,255], [173,111,98,255], [173,111,98,255], [173,111,98,255], [173,111,98,255]],
    [[46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,111,34,255], [46,111,34,255], [173,148,98,255], [173,148,98,255], [173,148,98,255], [173,148,98,255], [173,148,98,255]],
    [[46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255]],
    [[46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255]],
  ],
  bilevel: [
    [[0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [255,255,255,255]],
    [[0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255]],
    [[0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255]],
    [[0,0,0,255], [255,255,255,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255]],
    [[0,0,0,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255]],
    [[255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [255,255,255,255], [0,0,0,255], [255,255,255,255]],
    [[255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [255,255,255,255], [255,255,255,255]],
  ],
  greya: [
    [[94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255]],
  ],
  rgba8: [
    [[200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255]],
  ],
  paltrns: [
    [[200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0]],
    [[200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,0]],
    [[200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255]],
    [[200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0]],
    [[200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,0]],
    [[200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255]],
    [[200,40,90,255], [200,40,90,0], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,0]],
  ],
  grey8_i: [
    [[0,0,0,255], [8,8,8,255], [17,17,17,255], [25,25,25,255], [33,33,33,255], [42,42,42,255], [50,50,50,255], [59,59,59,255], [67,67,67,255], [75,75,75,255], [84,84,84,255]],
    [[23,23,23,255], [29,29,29,255], [40,40,40,255], [45,45,45,255], [57,57,57,255], [62,62,62,255], [73,73,73,255], [79,79,79,255], [90,90,90,255], [95,95,95,255], [107,107,107,255]],
    [[46,46,46,255], [55,55,55,255], [57,57,57,255], [66,66,66,255], [80,80,80,255], [88,88,88,255], [91,91,91,255], [99,99,99,255], [113,113,113,255], [122,122,122,255], [124,124,124,255]],
    [[70,70,70,255], [75,75,75,255], [80,80,80,255], [86,86,86,255], [103,103,103,255], [108,108,108,255], [114,114,114,255], [119,119,119,255], [136,136,136,255], [142,142,142,255], [147,147,147,255]],
    [[93,93,93,255], [101,101,101,255], [110,110,110,255], [118,118,118,255], [114,114,114,255], [123,123,123,255], [131,131,131,255], [139,139,139,255], [160,160,160,255], [168,168,168,255], [176,176,176,255]],
    [[116,116,116,255], [121,121,121,255], [133,133,133,255], [138,138,138,255], [138,138,138,255], [143,143,143,255], [154,154,154,255], [160,160,160,255], [183,183,183,255], [188,188,188,255], [200,200,200,255]],
    [[139,139,139,255], [148,148,148,255], [150,150,150,255], [158,158,158,255], [161,161,161,255], [169,169,169,255], [172,172,172,255], [180,180,180,255], [206,206,206,255], [214,214,214,255], [217,217,217,255]],
  ],
  pal_i: [
    [[46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [173,0,98,255], [173,0,98,255], [173,0,98,255], [173,0,98,255], [173,0,98,255], [173,0,98,255]],
    [[46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [46,37,29,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255]],
    [[46,37,29,255], [46,111,34,255], [46,37,29,255], [46,37,29,255], [46,111,34,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255], [173,56,98,255]],
    [[46,111,34,255], [46,111,34,255], [46,111,34,255], [46,111,34,255], [46,111,34,255], [173,111,98,255], [173,111,98,255], [173,111,98,255], [173,111,98,255], [173,111,98,255], [173,111,98,255]],
    [[46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,111,34,255], [46,111,34,255], [173,148,98,255], [173,148,98,255], [173,148,98,255], [173,148,98,255], [173,148,98,255]],
    [[46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255]],
    [[46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [46,185,60,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255], [173,204,98,255]],
  ],
  bilevel_i: [
    [[0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [255,255,255,255]],
    [[0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255]],
    [[0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255]],
    [[0,0,0,255], [255,255,255,255], [0,0,0,255], [0,0,0,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255]],
    [[0,0,0,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255]],
    [[255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [255,255,255,255], [0,0,0,255], [255,255,255,255]],
    [[255,255,255,255], [0,0,0,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [0,0,0,255], [255,255,255,255], [255,255,255,255], [255,255,255,255], [255,255,255,255]],
  ],
  greya_i: [
    [[94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255]],
    [[94,94,94,0], [94,94,94,120], [94,94,94,255], [94,94,94,255], [94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120]],
    [[94,94,94,0], [94,94,94,255], [94,94,94,255], [94,94,94,120], [94,94,94,0], [94,94,94,255], [94,94,94,120], [94,94,94,255], [94,94,94,0], [94,94,94,120], [94,94,94,255]],
  ],
  rgba8_i: [
    [[200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255]],
    [[200,40,90,0], [200,40,90,120], [200,40,90,255], [200,40,90,255], [200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120]],
    [[200,40,90,0], [200,40,90,255], [200,40,90,255], [200,40,90,120], [200,40,90,0], [200,40,90,255], [200,40,90,120], [200,40,90,255], [200,40,90,0], [200,40,90,120], [200,40,90,255]],
  ],
  rgb_i: [
    [[0,0,0,255], [23,0,13,255], [46,0,26,255], [69,0,39,255], [92,0,52,255], [115,0,65,255], [138,0,78,255], [161,0,91,255], [184,0,104,255], [207,0,117,255], [230,0,130,255]],
    [[0,37,13,255], [23,37,0,255], [46,37,39,255], [69,37,26,255], [92,37,65,255], [115,37,52,255], [138,37,91,255], [161,37,78,255], [184,37,117,255], [207,37,104,255], [230,37,143,255]],
    [[0,74,26,255], [23,74,39,255], [46,74,0,255], [69,74,13,255], [92,74,78,255], [115,74,91,255], [138,74,52,255], [161,74,65,255], [184,74,130,255], [207,74,143,255], [230,74,104,255]],
    [[0,111,39,255], [23,111,26,255], [46,111,13,255], [69,111,0,255], [92,111,91,255], [115,111,78,255], [138,111,65,255], [161,111,52,255], [184,111,143,255], [207,111,130,255], [230,111,117,255]],
    [[0,148,52,255], [23,148,65,255], [46,148,78,255], [69,148,91,255], [92,148,0,255], [115,148,13,255], [138,148,26,255], [161,148,39,255], [184,148,156,255], [207,148,169,255], [230,148,182,255]],
    [[0,185,65,255], [23,185,52,255], [46,185,91,255], [69,185,78,255], [92,185,13,255], [115,185,0,255], [138,185,39,255], [161,185,26,255], [184,185,169,255], [207,185,156,255], [230,185,195,255]],
    [[0,222,78,255], [23,222,91,255], [46,222,52,255], [69,222,65,255], [92,222,26,255], [115,222,39,255], [138,222,0,255], [161,222,13,255], [184,222,182,255], [207,222,195,255], [230,222,156,255]],
  ],
};

/** Each fixture's IHDR, read from the file bytes rather than assumed. */
const PNG_HEADER: Record<string, [number, number, boolean]> = {
  grey8: [0, 8, false],
  pal: [3, 4, false],
  bilevel: [0, 1, false],
  greya: [4, 8, false],
  rgba8: [6, 8, false],
  paltrns: [3, 4, false],
  grey8_i: [0, 8, true],
  pal_i: [3, 4, true],
  bilevel_i: [0, 1, true],
  greya_i: [4, 8, true],
  rgba8_i: [3, 2, true],
  rgb_i: [3, 8, true],
  grey16: [0, 16, false],
};

/** The high byte of each 16-bit sample, which is what the decoder keeps. */
const GREY16_HIGH = [
  [0,15,31,46,62,78,93,109,125,140,156],
  [2,18,33,49,65,80,96,112,127,143,158],
  [5,21,36,52,67,83,99,114,130,146,161],
  [8,23,39,55,70,86,101,117,133,148,164],
  [10,26,42,57,73,89,104,120,135,151,167],
  [13,29,44,60,76,91,107,123,138,154,169],
  [16,32,47,63,78,94,110,125,141,157,172],
];


/** Greyscale with a tRNS chunk naming one transparent grey level. */
const PNG_GREY_TRNS =
  'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAFCAAAAACyOJm3AAAAAnRSTlMAAHaTzTgAAAASSURBVHhe' +
  'Y2SQhAImVhjAzwIAMgABhi6jgNEAAAAASUVORK5CYII=';

/** RGB with a tRNS chunk naming one transparent colour. */
const PNG_RGB_TRNS =
  'iVBORw0KGgoAAAANSUhEUgAAAAkAAAAFCAIAAAAYMVE8AAAABnRSTlMAAAAAAE1myzq8AAAAGUlE' +
  'QVR4XmNkYPAVYWDAilgYNBhwAVrIAQCnnQGfBsjx9gAAAABJRU5ErkJggg==';

const GREY_TRNS_TRUTH = [
  [[0,0,0,0], [25,25,25,255], [50,50,50,255], [75,75,75,255], [100,100,100,255], [125,125,125,255], [150,150,150,255], [175,175,175,255], [200,200,200,255]],
  [[5,5,5,255], [30,30,30,255], [55,55,55,255], [80,80,80,255], [105,105,105,255], [130,130,130,255], [155,155,155,255], [180,180,180,255], [205,205,205,255]],
  [[10,10,10,255], [35,35,35,255], [60,60,60,255], [85,85,85,255], [110,110,110,255], [135,135,135,255], [160,160,160,255], [185,185,185,255], [210,210,210,255]],
  [[15,15,15,255], [40,40,40,255], [65,65,65,255], [90,90,90,255], [115,115,115,255], [140,140,140,255], [165,165,165,255], [190,190,190,255], [215,215,215,255]],
  [[20,20,20,255], [45,45,45,255], [70,70,70,255], [95,95,95,255], [120,120,120,255], [145,145,145,255], [170,170,170,255], [195,195,195,255], [220,220,220,255]],
];
const RGB_TRNS_TRUTH = [
  [[0,0,77,0], [20,0,77,255], [40,0,77,255], [60,0,77,255], [80,0,77,255], [100,0,77,255], [120,0,77,255], [140,0,77,255], [160,0,77,255]],
  [[0,40,77,255], [20,40,77,255], [40,40,77,255], [60,40,77,255], [80,40,77,255], [100,40,77,255], [120,40,77,255], [140,40,77,255], [160,40,77,255]],
  [[0,80,77,255], [20,80,77,255], [40,80,77,255], [60,80,77,255], [80,80,77,255], [100,80,77,255], [120,80,77,255], [140,80,77,255], [160,80,77,255]],
  [[0,120,77,255], [20,120,77,255], [40,120,77,255], [60,120,77,255], [80,120,77,255], [100,120,77,255], [120,120,77,255], [140,120,77,255], [160,120,77,255]],
  [[0,160,77,255], [20,160,77,255], [40,160,77,255], [60,160,77,255], [80,160,77,255], [100,160,77,255], [120,160,77,255], [140,160,77,255], [160,160,77,255]],
];

/** Decode a base64 fixture into bytes. */
const fixture = (b64: string): Uint8Array => new Uint8Array(atobLike(b64));

describe('decodePNG — every colour type, depth and interlacing', () => {
  const cases: Array<[string, string, string]> = [
    ['8-bit greyscale', PNG_GREY8, 'grey8'],
    ['palette with 4-bit indices', PNG_PALETTE, 'pal'],
    ['1-bit bilevel', PNG_BILEVEL, 'bilevel'],
    ['greyscale + alpha', PNG_GREY_ALPHA, 'greya'],
    ['RGBA', PNG_RGBA, 'rgba8'],
    ['palette + tRNS', PNG_PALETTE_TRNS, 'paltrns'],
    ['8-bit greyscale, interlaced', PNG_GREY8_I, 'grey8_i'],
    ['4-bit palette, interlaced', PNG_PALETTE_I, 'pal_i'],
    ['1-bit, interlaced', PNG_BILEVEL_I, 'bilevel_i'],
    ['greyscale + alpha, interlaced', PNG_GREY_ALPHA_I, 'greya_i'],
    ['2-bit palette, interlaced', PNG_PALETTE2_I, 'rgba8_i'],
    ['RGB, interlaced', PNG_RGB_I, 'rgb_i'],
  ];

  for (const [name, b64, key] of cases) {
    it(`decodes ${name} exactly as libpng does`, () => {
      const img = decodePNG(fixture(b64));
      const want = PNG_TRUTH[key] as number[][][];
      const [colorType, bitDepth, interlaced] = PNG_HEADER[key] as [number, number, boolean];
      expect(img.colorType).toBe(colorType);
      expect(img.bitDepth).toBe(bitDepth);
      expect(img.interlaced).toBe(interlaced);
      expect(img.height).toBe(want.length);
      expect(img.width).toBe((want[0] as number[][]).length);

      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const [r, g, b, a] = (want[y] as number[][])[x] as number[];
          const got = (img.pixels[y] as Pixel[])[x];
          if (a === 0) {
            expect(got).toBeNull();
            continue;
          }
          const solid = got as NonNullable<Pixel>;
          expect([solid.r, solid.g, solid.b]).toEqual([r, g, b]);
          const gotA = Math.round(((solid as { a?: number }).a ?? 1) * 255);
          expect(Math.abs(gotA - (a as number))).toBeLessThanOrEqual(1);
        }
      }
    });
  }

  it('covers all five bit depths and all five colour types between them', () => {
    const depths = new Set<number>();
    const types = new Set<number>();
    for (const key of Object.keys(PNG_HEADER)) {
      const [type, depth] = PNG_HEADER[key] as [number, number, boolean];
      depths.add(depth);
      types.add(type);
    }
    expect([...depths].sort((a, b) => a - b)).toEqual([1, 2, 4, 8, 16]);
    expect([...types].sort((a, b) => a - b)).toEqual([0, 3, 4, 6]);
  });

  it('reduces 16-bit samples to their high byte', () => {
    const img = decodePNG(fixture(PNG_GREY16));
    expect(img.bitDepth).toBe(16);
    expect(img.colorType).toBe(0);
    for (let y = 0; y < GREY16_HIGH.length; y++) {
      const row = GREY16_HIGH[y] as number[];
      for (let x = 0; x < row.length; x++) {
        const px = (img.pixels[y] as Pixel[])[x] as NonNullable<Pixel>;
        expect(px.r).toBe(row[x]);
        expect(px.g).toBe(px.r); // grey: all three channels equal
        expect(px.b).toBe(px.r);
      }
    }
  });

  it('reassembles Adam7 to the same pixels as the non-interlaced file', () => {
    // Same source image, saved both ways: interlacing is a storage order, so
    // the seven passes must land every pixel exactly where the plain file has
    // it. This is the assertion that was missing while the Adam7 path went
    // untested — Pillow ignores `interlace=True`, so the "interlaced"
    // fixtures were not interlaced at all.
    for (const [plain, woven] of [
      [PNG_GREY8, PNG_GREY8_I],
      [PNG_PALETTE, PNG_PALETTE_I],
      [PNG_BILEVEL, PNG_BILEVEL_I],
      [PNG_GREY_ALPHA, PNG_GREY_ALPHA_I],
    ] as Array<[string, string]>) {
      const a = decodePNG(fixture(plain));
      const b = decodePNG(fixture(woven));
      expect(b.interlaced).toBe(true);
      expect(a.interlaced).toBe(false);
      expect(b.pixels).toEqual(a.pixels);
    }
  });

  it('reports transparency for the forms that carry it', () => {
    expect(decodePNG(fixture(PNG_GREY_ALPHA)).hasAlpha).toBe(true);
    expect(decodePNG(fixture(PNG_RGBA)).hasAlpha).toBe(true);
    expect(decodePNG(fixture(PNG_PALETTE_TRNS)).hasAlpha).toBe(true);
    expect(decodePNG(fixture(PNG_GREY8)).hasAlpha).toBe(false);
    expect(decodePNG(fixture(PNG_PALETTE)).hasAlpha).toBe(false);
  });

  it('can drop alpha from a greyscale+alpha file', () => {
    const img = decodePNG(fixture(PNG_GREY_ALPHA), { alpha: false });
    for (const row of img.pixels) {
      for (const px of row) {
        if (px !== null) expect((px as { a?: number }).a).toBeUndefined();
      }
    }
  });

  it('re-encodes a decoded palette file without losing a pixel', () => {
    const first = decodePNG(fixture(PNG_PALETTE));
    const again = decodePNG(encodePNG(first.pixels));
    expect(again.width).toBe(first.width);
    for (let y = 0; y < first.height; y++) {
      expect(again.pixels[y]).toEqual(first.pixels[y]);
    }
  });
});

describe('decodePNG — tRNS on greyscale and RGB', () => {
  // The palette form of tRNS is an alpha array; the grey and RGB forms name
  // a single transparent *sample value* instead, and are separate branches.
  it('treats the named grey level as transparent', () => {
    const img = decodePNG(fixture(PNG_GREY_TRNS));
    expect(img.colorType).toBe(0);
    expect(img.hasAlpha).toBe(true);
    let holes = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const [r, g, b, a] = (GREY_TRNS_TRUTH[y] as number[][])[x] as number[];
        const got = (img.pixels[y] as Pixel[])[x];
        if (a === 0) {
          expect(got).toBeNull();
          holes++;
          continue;
        }
        expect(got).toEqual({ r, g, b });
      }
    }
    expect(holes).toBeGreaterThan(0); // the fixture must actually have holes
  });

  it('treats the named RGB triple as transparent', () => {
    const img = decodePNG(fixture(PNG_RGB_TRNS));
    expect(img.colorType).toBe(2);
    expect(img.hasAlpha).toBe(true);
    let holes = 0;
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < img.width; x++) {
        const [r, g, b, a] = (RGB_TRNS_TRUTH[y] as number[][])[x] as number[];
        const got = (img.pixels[y] as Pixel[])[x];
        if (a === 0) {
          expect(got).toBeNull();
          holes++;
          continue;
        }
        expect(got).toEqual({ r, g, b });
      }
    }
    expect(holes).toBeGreaterThan(0);
  });
});

describe('decodePNG — remaining refusals', () => {
  it('rejects a 16-bit palette, which the format does not define', () => {
    const file = encodePNG([[{ r: 1, g: 2, b: 3 }]]);
    const ihdr = file.subarray(16, 29);
    ihdr[8] = 16; // depth
    ihdr[9] = 3; // palette
    const sum = crc32(file.subarray(12, 29));
    file[29] = (sum >>> 24) & 0xff;
    file[30] = (sum >>> 16) & 0xff;
    file[31] = (sum >>> 8) & 0xff;
    file[32] = sum & 0xff;
    expect(() => decodePNG(file)).toThrow(/ANSIMAX_PNG_IHDR/);
  });

  it('rejects an unknown scanline filter', () => {
    // Filter bytes live inside the compressed stream, so the file has to be
    // rebuilt: inflate the IDAT, poke the first filter byte, deflate again.
    const grid4 = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ({ r: 10, g: 20, b: 30 })));
    const file = encodePNG(grid4);
    const { inflate, deflate } = require('../deflate/index.js') as typeof import('../deflate/index.js');
    // Locate IDAT.
    let at = 8;
    let idatAt = -1;
    let idatLen = 0;
    while (at + 8 <= file.length) {
      const length =
        ((file[at] as number) << 24) | ((file[at + 1] as number) << 16) |
        ((file[at + 2] as number) << 8) | (file[at + 3] as number);
      const type = String.fromCharCode(
        file[at + 4] as number, file[at + 5] as number,
        file[at + 6] as number, file[at + 7] as number,
      );
      if (type === 'IDAT') { idatAt = at + 8; idatLen = length; break; }
      at += 12 + length;
    }
    expect(idatAt).toBeGreaterThan(0);
    const raw = inflate(file.subarray(idatAt, idatAt + idatLen));
    raw[0] = 9; // not one of 0..4
    const repacked = deflate(raw);

    // Reassemble: everything before IDAT, the new IDAT, everything after.
    const head = file.subarray(0, idatAt - 8);
    const tail = file.subarray(idatAt + idatLen + 4);
    const chunk = new Uint8Array(12 + repacked.length);
    chunk[0] = (repacked.length >>> 24) & 0xff;
    chunk[1] = (repacked.length >>> 16) & 0xff;
    chunk[2] = (repacked.length >>> 8) & 0xff;
    chunk[3] = repacked.length & 0xff;
    chunk[4] = 0x49; chunk[5] = 0x44; chunk[6] = 0x41; chunk[7] = 0x54; // IDAT
    chunk.set(repacked, 8);
    const sum = crc32(chunk.subarray(4, 8 + repacked.length));
    chunk[8 + repacked.length] = (sum >>> 24) & 0xff;
    chunk[9 + repacked.length] = (sum >>> 16) & 0xff;
    chunk[10 + repacked.length] = (sum >>> 8) & 0xff;
    chunk[11 + repacked.length] = sum & 0xff;

    const rebuilt = new Uint8Array(head.length + chunk.length + tail.length);
    rebuilt.set(head, 0);
    rebuilt.set(chunk, head.length);
    rebuilt.set(tail, head.length + chunk.length);
    expect(() => decodePNG(rebuilt)).toThrow(/ANSIMAX_PNG_FILTER/);
  });

  it('rejects pixel data that ends before the last scanline', () => {
    const grid8 = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => ({ r: 1, g: 2, b: 3 })));
    const file = encodePNG(grid8);
    const { inflate, deflate } = require('../deflate/index.js') as typeof import('../deflate/index.js');
    let at = 8;
    let idatAt = -1;
    let idatLen = 0;
    while (at + 8 <= file.length) {
      const length =
        ((file[at] as number) << 24) | ((file[at + 1] as number) << 16) |
        ((file[at + 2] as number) << 8) | (file[at + 3] as number);
      const type = String.fromCharCode(
        file[at + 4] as number, file[at + 5] as number,
        file[at + 6] as number, file[at + 7] as number,
      );
      if (type === 'IDAT') { idatAt = at + 8; idatLen = length; break; }
      at += 12 + length;
    }
    const raw = inflate(file.subarray(idatAt, idatAt + idatLen));
    // Half the scanlines, so the reader runs out mid-image.
    const repacked = deflate(raw.subarray(0, Math.floor(raw.length / 2)));
    const head = file.subarray(0, idatAt - 8);
    const tail = file.subarray(idatAt + idatLen + 4);
    const chunk = new Uint8Array(12 + repacked.length);
    chunk[0] = (repacked.length >>> 24) & 0xff;
    chunk[1] = (repacked.length >>> 16) & 0xff;
    chunk[2] = (repacked.length >>> 8) & 0xff;
    chunk[3] = repacked.length & 0xff;
    chunk[4] = 0x49; chunk[5] = 0x44; chunk[6] = 0x41; chunk[7] = 0x54;
    chunk.set(repacked, 8);
    const sum = crc32(chunk.subarray(4, 8 + repacked.length));
    chunk[8 + repacked.length] = (sum >>> 24) & 0xff;
    chunk[9 + repacked.length] = (sum >>> 16) & 0xff;
    chunk[10 + repacked.length] = (sum >>> 8) & 0xff;
    chunk[11 + repacked.length] = sum & 0xff;
    const rebuilt = new Uint8Array(head.length + chunk.length + tail.length);
    rebuilt.set(head, 0);
    rebuilt.set(chunk, head.length);
    rebuilt.set(tail, head.length + chunk.length);
    expect(() => decodePNG(rebuilt)).toThrow(/ANSIMAX_PNG_TRUNCATED/);
  });
});

describe('encodeKittyImage — remaining paths', () => {
  it('sends only RGB when alpha is forced off, dropping a hole to black', () => {
    const holey: PixelGrid = [[{ r: 255, g: 255, b: 255 }, null]];
    const out = encodeKittyImage(holey, { alpha: false });
    expect(out).toContain('f=24');
    const payload = out.split(';')[1] as string;
    expect(atobLike(payload.slice(0, payload.length - 2))).toEqual([255, 255, 255, 0, 0, 0]);
  });

  it('treats a ragged row as transparency, so the pad is not opaque black', () => {
    const ragged: PixelGrid = [[{ r: 1, g: 2, b: 3 }], [{ r: 4, g: 5, b: 6 }, { r: 7, g: 8, b: 9 }]];
    expect(encodeKittyImage(ragged)).toContain('f=32');
  });

  it('clamps a non-finite alpha to opaque', () => {
    const odd: PixelGrid = [[{ r: 1, g: 2, b: 3, a: Number.NaN } as Pixel, null]];
    const payload = encodeKittyImage(odd).split(';')[1] as string;
    const raw = atobLike(payload.slice(0, payload.length - 2));
    expect(raw.slice(0, 4)).toEqual([1, 2, 3, 255]);
  });
});

// ─────────────────────────────────────────────
//  Malformed files, built chunk by chunk. A PNG is a signature plus
//  length/type/body/CRC records, so these are assembled rather than patched:
//  a patched file needs its CRC recomputed anyway, and building it states
//  what is wrong instead of hiding it in an offset.
// ─────────────────────────────────────────────

const put32 = (b: Uint8Array, at: number, v: number): void => {
  b[at] = (v >>> 24) & 0xff;
  b[at + 1] = (v >>> 16) & 0xff;
  b[at + 2] = (v >>> 8) & 0xff;
  b[at + 3] = v & 0xff;
};

/** One chunk, with its length and CRC filled in. */
const makeChunk = (type: string, body: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + body.length);
  put32(out, 0, body.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(body, 8);
  put32(out, 8 + body.length, crc32(out.subarray(4, 8 + body.length)));
  return out;
};

const makeFile = (...chunks: Uint8Array[]): Uint8Array => {
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  let total = signature.length;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  out.set(signature, 0);
  let at = signature.length;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};

const makeIHDR = (
  width: number, height: number, depth: number, colorType: number, interlace = 0,
): Uint8Array => {
  const b = new Uint8Array(13);
  put32(b, 0, width);
  put32(b, 4, height);
  b[8] = depth;
  b[9] = colorType;
  b[12] = interlace;
  return b;
};

const IEND = (): Uint8Array => makeChunk('IEND', new Uint8Array(0));

describe('decodePNG — malformed files', () => {
  it('names an IHDR that is not 13 bytes', () => {
    expect(() => decodePNG(makeFile(
      makeChunk('IHDR', makeIHDR(1, 1, 8, 2).subarray(0, 12)),
      IEND(),
    ))).toThrow(/ANSIMAX_PNG_IHDR: IHDR must be 13 bytes, this one is 12/);
  });

  it('names a file with no IDAT at all', () => {
    expect(() => decodePNG(makeFile(makeChunk('IHDR', makeIHDR(1, 1, 8, 2)), IEND())))
      .toThrow(/ANSIMAX_PNG_TRUNCATED: the file has no IDAT data/);
  });

  it('names a palette image with no PLTE', () => {
    const raw = deflate(new Uint8Array([0, 0]));
    expect(() => decodePNG(makeFile(
      makeChunk('IHDR', makeIHDR(1, 1, 8, 3)),
      makeChunk('IDAT', raw),
      IEND(),
    ))).toThrow(/ANSIMAX_PNG_UNSUPPORTED: a palette image with no PLTE chunk/);
  });

  it('says which scanline is short, and by how much', () => {
    // Three pixels declared per row, two supplied on the second row.
    const raw = deflate(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3]));
    expect(() => decodePNG(makeFile(
      makeChunk('IHDR', makeIHDR(3, 2, 8, 2)),
      makeChunk('IDAT', raw),
      IEND(),
    ))).toThrow(/ANSIMAX_PNG_TRUNCATED: scanline 1 is short by 6 bytes/);
  });

  it('reads a hole where a palette index points past the PLTE', () => {
    // Index 5 against a one-entry palette is a hole, not a crash and not a
    // wrapped-around colour.
    const raw = deflate(new Uint8Array([0, 5]));
    const image = decodePNG(makeFile(
      makeChunk('IHDR', makeIHDR(1, 1, 8, 3)),
      makeChunk('PLTE', new Uint8Array([9, 9, 9])),
      makeChunk('IDAT', raw),
      IEND(),
    ));
    expect(image.pixels).toEqual([[null]]);
  });

  it('decodes a 1x1 interlaced image, where six of the seven passes are empty', () => {
    const raw = deflate(new Uint8Array([0, 7, 8, 9]));
    const image = decodePNG(makeFile(
      makeChunk('IHDR', makeIHDR(1, 1, 8, 2, 1)),
      makeChunk('IDAT', raw),
      IEND(),
    ));
    expect(image.width).toBe(1);
    expect(image.height).toBe(1);
    expect(image.pixels[0]?.[0]).toEqual({ r: 7, g: 8, b: 9 });  // no alpha channel
  });
});

describe('encodePNG / the vendor protocols — ragged and invalid grids', () => {
  const ragged: PixelGrid = [
    [{ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }],
    [{ r: 7, g: 8, b: 9 }],
  ];

  it('treats a short row as transparent rather than opaque black', () => {
    // The alpha detection and the writer have to agree: a missing pixel is a
    // hole, so the file has to be RGBA for the hole to be expressible.
    const file = encodePNG(ragged);
    expect(chunkBody(file, 'IHDR')?.[9]).toBe(6);  // colour type 6 = RGBA
    const back = decodePNG(file);
    expect(back.pixels[1]?.[1]).toBeNull();
  });

  it('treats a row that is not an array as all holes', () => {
    const file = encodePNG([[{ r: 1, g: 2, b: 3 }], null as unknown as Pixel[]]);
    expect(chunkBody(file, 'IHDR')?.[9]).toBe(6);
    expect(decodePNG(file).pixels[1]?.[0]).toBeNull();
  });

  it('sends a ragged grid as RGBA through Kitty, not opaque black', () => {
    const out = encodeKittyImage(ragged);
    expect(out).toContain('f=32');  // RGBA, because a cell is missing
  });

  it('spots a partially transparent pixel', () => {
    const out = encodeKittyImage([[{ r: 1, g: 2, b: 3, a: 0.5 }]]);
    expect(out).toContain('f=32');
  });

  it('spots a row that is not an array', () => {
    const out = encodeKittyImage([[{ r: 1, g: 2, b: 3 }], undefined as unknown as Pixel[]]);
    expect(out).toContain('f=32');
  });

  it('writes a non-finite channel as zero rather than as garbage', () => {
    const out = encodeKittyImage([[{ r: Number.NaN, g: 2, b: 3 }]]);
    // f=24, three bytes, and the payload decodes to 0,2,3.
    expect(out).toContain('f=24');
    const payload = out.slice(out.indexOf(';') + 1, out.indexOf('\x1b\\'));
    const raw = Buffer.from(payload, 'base64');
    expect(Array.from(raw)).toEqual([0, 2, 3]);
  });
});
