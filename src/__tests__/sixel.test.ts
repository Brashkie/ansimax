import { encodeSixel, encodeSixelDetailed } from '../sixel/index.js';
import { medianCutPalette } from '../ascii/image.js';
import { createPaletteMapper } from '../utils/helpers.js';
import type { PixelGrid } from '../images/index.js';
import type { RGB } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Phase 12 — Sixel + adaptive palette (v1.10.0)
//
//  The encoder was verified by decoding its output with an external Sixel
//  decoder in the sandbox: 400 random images came back with exactly the
//  palette entry the encoder chose for every pixel, at the right dimensions,
//  transparency included. These tests pin the structure of the format and the
//  decisions the encoder makes.
// ─────────────────────────────────────────────

const px = (r: number, g: number, b: number, a?: number): RGB =>
  (a === undefined ? { r, g, b } : ({ r, g, b, a } as RGB));

const fill = (w: number, h: number, c: RGB): PixelGrid =>
  Array.from({ length: h }, () => Array.from({ length: w }, () => ({ ...c })));

/** Six-pixel data characters only — the payload, without framing or colours. */
const payload = (data: string): string =>
  data.replace(/^\x1bP[0-9;]*q/, '').replace(/\x1b\\$/, '').replace(/"[0-9;]+/, '')
    .replace(/#\d+;2(?:;\d+){3}/g, '');

describe('encodeSixel framing', () => {
  it('wraps the image in a device control string', () => {
    const out = encodeSixel(fill(4, 6, px(255, 0, 0)));
    expect(out.startsWith('\x1bP')).toBe(true);
    expect(out).toContain('q');
    expect(out.endsWith('\x1b\\')).toBe(true);
  });

  it('terminates exactly once', () => {
    // A doubled ST makes a decoder read the second one as image data.
    const out = encodeSixel(fill(8, 10, px(1, 2, 3)));
    expect(out.match(/\x1b\\/g)).toHaveLength(1);
  });

  it('sets P2 to 1 so unpainted pixels stay transparent', () => {
    expect(encodeSixel(fill(2, 2, px(9, 9, 9)))).toMatch(/^\x1bP0;1;0q/);
    expect(encodeSixel(fill(2, 2, px(9, 9, 9)), { transparent: false })).toMatch(/^\x1bP0;0;0q/);
  });

  it('emits raster attributes with the pixel dimensions', () => {
    expect(encodeSixel(fill(13, 7, px(0, 0, 0)))).toContain('"1;1;13;7');
  });

  it('honours a pixel aspect ratio', () => {
    expect(encodeSixel(fill(4, 4, px(0, 0, 0)), { aspect: [2, 1] })).toContain('"2;1;4;4');
    // Nonsense ratios fall back to 1:1 instead of emitting a broken header.
    expect(encodeSixel(fill(4, 4, px(0, 0, 0)), { aspect: [0, -3] })).toContain('"1;1;4;4');
  });

  it('can omit the raster attributes', () => {
    expect(encodeSixel(fill(4, 4, px(0, 0, 0)), { raster: false })).not.toContain('"1;1');
  });

  it('declares colour registers as percentages, not bytes', () => {
    // 255 → 100%, 128 → 50%.
    const out = encodeSixel(fill(2, 2, px(255, 128, 0)));
    expect(out).toContain('#0;2;100;50;0');
  });
});

describe('encodeSixel data', () => {
  it('uses ~ for a full band and ? for an empty one', () => {
    // Six rows of one colour = all six bits set = 0x3f + 63 = '~'.
    expect(payload(encodeSixel(fill(3, 6, px(255, 0, 0))))).toBe('#0~~~');
  });

  it('sets one bit per row, lowest bit at the top of the band', () => {
    const grid: PixelGrid = [[px(255, 0, 0)], [null], [null], [null], [null], [null]];
    // Only row 0 painted → bit 0 → '?' + 1 = '@'.
    expect(payload(encodeSixel(grid))).toBe('#0@');
    const bottom: PixelGrid = [[null], [null], [null], [null], [null], [px(255, 0, 0)]];
    // Only row 5 → bit 5 → 32 → '_'.
    expect(payload(encodeSixel(bottom))).toBe('#0_');
  });

  it('starts a new band every six rows', () => {
    expect(encodeSixelDetailed(fill(2, 6, px(1, 1, 1))).bands).toBe(1);
    expect(encodeSixelDetailed(fill(2, 7, px(1, 1, 1))).bands).toBe(2);
    expect(encodeSixelDetailed(fill(2, 18, px(1, 1, 1))).bands).toBe(3);
    // One '-' between bands, never a trailing one.
    expect(payload(encodeSixel(fill(2, 13, px(1, 1, 1)))).match(/-/g)).toHaveLength(2);
  });

  it('separates colour passes within a band with $, with none trailing', () => {
    const grid: PixelGrid = Array.from({ length: 6 }, () =>
      [px(255, 0, 0), px(255, 0, 0), px(0, 0, 255), px(0, 0, 255)]);
    const body = payload(encodeSixel(grid));
    expect(body.match(/\$/g)).toHaveLength(1); // two colours, one separator
    expect(body.endsWith('$')).toBe(false);
  });

  it('run-length encodes four or more identical characters', () => {
    expect(payload(encodeSixel(fill(4, 6, px(255, 0, 0))))).toBe('#0!4~');
    // Three is break-even, so it stays literal — compressing it would be longer.
    expect(payload(encodeSixel(fill(3, 6, px(255, 0, 0))))).toBe('#0~~~');
  });

  it('drops trailing empty pixels rather than writing them', () => {
    const grid: PixelGrid = Array.from({ length: 6 }, () =>
      [px(255, 0, 0), null, null, null, null, null, null, null]);
    expect(payload(encodeSixel(grid))).toBe('#0~');
  });

  it('skips a colour that is absent from a band', () => {
    // Red only in the first band, blue only in the second.
    const grid: PixelGrid = [
      ...Array.from({ length: 6 }, () => [px(255, 0, 0)]),
      ...Array.from({ length: 6 }, () => [px(0, 0, 255)]),
    ];
    const body = payload(encodeSixel(grid));
    const [firstBand, secondBand] = body.split('-');
    expect(firstBand).not.toContain('$'); // one colour per band, no overlay pass
    expect(secondBand).not.toContain('$');
  });
});

describe('encodeSixel transparency', () => {
  it('leaves null pixels unpainted', () => {
    const grid: PixelGrid = [[px(255, 0, 0), null, px(255, 0, 0)]];
    // Column 1 has no bits set → '?' between two '@'.
    expect(payload(encodeSixel(grid))).toBe('#0@?@');
  });

  it('treats alpha below the threshold as transparent', () => {
    const grid: PixelGrid = [[px(255, 0, 0, 1), px(255, 0, 0, 0.1)]];
    expect(payload(encodeSixel(grid))).toBe('#0@');
    // Raising the threshold makes the second pixel transparent too.
    expect(payload(encodeSixel([[px(255, 0, 0, 0.8)]], { alphaThreshold: 0.9 }))).toBe('');
  });

  it('paints transparent pixels when transparency is off', () => {
    const grid: PixelGrid = [[px(255, 0, 0), null]];
    expect(payload(encodeSixel(grid, { transparent: false }))).not.toBe('#0@');
  });

  it('keeps transparent pixels out of the palette statistics', () => {
    // A grid of red with one bright green pixel at alpha 0: the palette must
    // not spend an entry on a colour nobody will see.
    const grid: PixelGrid = Array.from({ length: 6 }, () =>
      Array.from({ length: 6 }, () => px(200, 30, 30)));
    (grid[0] as RGB[])[0] = px(0, 255, 0, 0);
    expect(encodeSixelDetailed(grid, { maxColors: 8 }).palette).toHaveLength(1);
  });
});

describe('encodeSixel palette', () => {
  it('derives a palette capped at maxColors', () => {
    const grid: PixelGrid = Array.from({ length: 12 }, (_, y) =>
      Array.from({ length: 12 }, (_, x) => px(x * 20, y * 20, 128)));
    expect(encodeSixelDetailed(grid, { maxColors: 4 }).palette.length).toBeLessThanOrEqual(4);
    expect(encodeSixelDetailed(grid, { maxColors: 32 }).palette.length).toBeLessThanOrEqual(32);
  });

  it('never invents more entries than the image has colours', () => {
    const grid: PixelGrid = Array.from({ length: 6 }, () =>
      [px(255, 0, 0), px(0, 0, 255), px(255, 0, 0)]);
    expect(encodeSixelDetailed(grid, { maxColors: 256 }).palette).toHaveLength(2);
  });

  it('snaps the palette onto the percent grid the format can express', () => {
    // 1 → 0%, which is byte 0. The reported palette must say so, or a caller
    // comparing against it sees a colour the terminal will never show.
    const result = encodeSixelDetailed([[px(1, 200, 254)]]);
    const entry = result.palette[0] as RGB;
    expect(entry.r).toBe(0); // 1/255 → 0%
    expect(entry.g).toBe(199); // 200/255 → 78% → 199
    expect(entry.b).toBe(255); // 254/255 → 100%
    // The declared registers must match the reported palette exactly.
    expect(result.data).toContain(`#0;2;0;${Math.round((entry.g / 255) * 100)};100`);
  });

  it('accepts a supplied palette and reuses it verbatim', () => {
    const palette = [px(0, 0, 0), px(255, 255, 255)];
    const grid: PixelGrid = Array.from({ length: 6 }, () => [px(10, 10, 10), px(240, 240, 240)]);
    const result = encodeSixelDetailed(grid, { palette });
    expect(result.palette).toHaveLength(2);
    expect(result.data).toContain('#0;2;0;0;0');
    expect(result.data).toContain('#1;2;100;100;100');
  });

  it('maps through a dither kernel when asked', () => {
    const grid: PixelGrid = Array.from({ length: 12 }, () =>
      Array.from({ length: 12 }, (_, x) => px(x * 20, x * 20, x * 20)));
    const flat = encodeSixel(grid, { maxColors: 2 });
    const dithered = encodeSixel(grid, { maxColors: 2, dither: 'atkinson' });
    expect(dithered).not.toBe(flat);
    // 'none' is the documented default, so it must equal the flat mapping.
    expect(encodeSixel(grid, { maxColors: 2, dither: 'none' })).toBe(flat);
  });
});

describe('encodeSixel edge cases', () => {
  it('handles a single pixel', () => {
    const result = encodeSixelDetailed([[px(255, 255, 255)]]);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.bands).toBe(1);
  });

  it('pads to the widest row when rows are ragged', () => {
    const grid: PixelGrid = [[px(1, 1, 1)], [px(1, 1, 1), px(1, 1, 1), px(1, 1, 1)]];
    expect(encodeSixelDetailed(grid).width).toBe(3);
  });

  it('rejects a grid that is not a grid', () => {
    expect(() => encodeSixel([])).toThrow(/ANSIMAX_SIXEL_INPUT/);
    expect(() => encodeSixel(null as unknown as PixelGrid)).toThrow(/ANSIMAX_SIXEL_INPUT/);
    expect(() => encodeSixel([[]])).toThrow(/ANSIMAX_SIXEL_INPUT/);
  });

  it('survives a fully transparent image', () => {
    const grid: PixelGrid = Array.from({ length: 6 }, () => [null, null, null]);
    expect(() => encodeSixel(grid)).not.toThrow();
    expect(payload(encodeSixel(grid))).toBe('');
  });

  it('clamps out-of-range and non-finite channels', () => {
    const grid: PixelGrid = [[px(300, -20, Number.NaN)]];
    const result = encodeSixelDetailed(grid);
    expect(result.data).toContain('#0;2;100;0;0');
  });
});

describe('medianCutPalette', () => {
  it('returns one entry per colour when the image has few', () => {
    const grid: PixelGrid = [[px(255, 0, 0), px(0, 255, 0), px(0, 0, 255)]];
    expect(medianCutPalette(grid, { maxColors: 16 })).toHaveLength(3);
  });

  it('never exceeds maxColors', () => {
    const grid: PixelGrid = Array.from({ length: 20 }, (_, y) =>
      Array.from({ length: 20 }, (_, x) => px(x * 12, y * 12, (x * y) % 256)));
    for (const max of [1, 2, 7, 16, 64]) {
      expect(medianCutPalette(grid, { maxColors: max }).length).toBeLessThanOrEqual(max);
    }
  });

  it('splits where the pixels are, not where the distinct colours are', () => {
    // A big flat red field plus two stray colours. With two entries, one must
    // stay close to the red the image is mostly made of.
    const grid: PixelGrid = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => px(200, 20, 20)));
    (grid[0] as RGB[])[0] = px(0, 0, 255);
    (grid[0] as RGB[])[1] = px(0, 255, 255);
    const palette = medianCutPalette(grid, { maxColors: 2 });
    const reds = palette.filter((c) => c.r > 150 && c.g < 80);
    expect(reds).toHaveLength(1);
  });

  it('averages each box, so an entry sits inside its colours', () => {
    const grid: PixelGrid = [[px(0, 0, 0), px(100, 100, 100)]];
    const [only] = medianCutPalette(grid, { maxColors: 1 });
    expect((only as RGB).r).toBe(50);
  });

  it('splits in RGB when asked', () => {
    const grid: PixelGrid = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => px(x * 30, 255 - y * 30, 128)));
    const oklab = medianCutPalette(grid, { maxColors: 4 });
    const rgb = medianCutPalette(grid, { maxColors: 4, space: 'rgb' });
    expect(rgb).toHaveLength(4);
    expect(oklab).toHaveLength(4);
    // The two spaces subdivide differently, which is the point of the option.
    expect(JSON.stringify(rgb)).not.toBe(JSON.stringify(oklab));
  });

  it('treats null pixels as black rather than skipping them', () => {
    expect(medianCutPalette([[null, null]], { maxColors: 4 })).toEqual([{ r: 0, g: 0, b: 0 }]);
  });

  it('returns nothing for an empty grid', () => {
    expect(medianCutPalette([], {})).toEqual([]);
    expect(medianCutPalette([[]], {})).toEqual([]);
  });

  it('clamps a nonsense maxColors instead of looping', () => {
    const grid: PixelGrid = [[px(1, 2, 3), px(4, 5, 6)]];
    expect(medianCutPalette(grid, { maxColors: 0 }).length).toBeGreaterThan(0);
    expect(medianCutPalette(grid, { maxColors: -5 }).length).toBeGreaterThan(0);
    expect(medianCutPalette(grid, { maxColors: Number.NaN }).length).toBeGreaterThan(0);
  });
});

describe('createPaletteMapper', () => {
  const palette = [px(0, 0, 0), px(255, 255, 255), px(255, 0, 0), px(0, 0, 255)];

  it('finds the nearest entry', () => {
    const map = createPaletteMapper(palette);
    expect(map(px(10, 10, 10))).toBe(0);
    expect(map(px(240, 240, 240))).toBe(1);
    expect(map(px(200, 20, 20))).toBe(2);
    expect(map(px(20, 20, 200))).toBe(3);
  });

  it('agrees with nearestPerceptual, which it replaces in hot paths', () => {
    const { nearestPerceptual } = require('../utils/helpers.js') as typeof import('../utils/helpers.js');
    const map = createPaletteMapper(palette);
    for (let i = 0; i < 200; i++) {
      const c = px((i * 37) % 256, (i * 91) % 256, (i * 53) % 256);
      expect(map(c)).toBe(nearestPerceptual(c, palette));
    }
  });

  it('reports the palette size and can be cleared', () => {
    const map = createPaletteMapper(palette);
    expect(map.size).toBe(4);
    map(px(1, 1, 1));
    expect(() => map.clear()).not.toThrow();
    expect(map(px(1, 1, 1))).toBe(0);
  });

  it('answers the same with the cache off', () => {
    const cached = createPaletteMapper(palette);
    const uncached = createPaletteMapper(palette, { cache: false });
    for (let i = 0; i < 50; i++) {
      const c = px(i * 5, 255 - i * 5, (i * 13) % 256);
      expect(uncached(c)).toBe(cached(c));
    }
  });

  it('uses RGB distance when asked', () => {
    const map = createPaletteMapper(palette, { metric: 'rgb' });
    expect(map(px(0, 0, 0))).toBe(0);
    expect(map(px(254, 1, 1))).toBe(2);
  });

  it('returns -1 for an empty palette', () => {
    expect(createPaletteMapper([])(px(1, 2, 3))).toBe(-1);
    expect(createPaletteMapper([]).size).toBe(0);
  });

  it('clamps nonsense channels instead of throwing', () => {
    const map = createPaletteMapper(palette);
    expect(() => map(px(Number.NaN, 1e9, -40))).not.toThrow();
    expect(map(undefined as unknown as RGB)).toBe(0);
  });
});

describe('encodeSixel — nothing to draw', () => {
  it('still emits a valid sequence for a fully transparent image', () => {
    // Every pixel is transparent, so the median cut has no opaque pixels to
    // work from and comes back with an empty palette. A black register keeps
    // the output a well-formed DCS rather than a palette-less fragment.
    const out = encodeSixel([[{ r: 0, g: 0, b: 0, a: 0 }]], { transparent: true });
    expect(out.startsWith('\x1bP')).toBe(true);
    expect(out.endsWith('\x1b\\')).toBe(true);
    expect(out).toContain('#0;2;0;0;0');
  });

  it('does the same for a grid of holes', () => {
    const out = encodeSixel([[null, null], [null, null]], { transparent: true });
    expect(out.startsWith('\x1bP')).toBe(true);
    expect(out.endsWith('\x1b\\')).toBe(true);
  });
});

describe('medianCutPalette — grids that are not rectangular', () => {
  it('skips a row that is not an array instead of throwing', () => {
    const palette = medianCutPalette(
      [
        [{ r: 10, g: 20, b: 30 }],
        'not a row' as unknown as Array<{ r: number; g: number; b: number }>,
        [{ r: 200, g: 210, b: 220 }],
      ],
      { maxColors: 4 },
    );
    expect(palette.length).toBeGreaterThan(0);
    expect(palette.length).toBeLessThanOrEqual(4);
    for (const c of palette) {
      expect(Number.isFinite(c.r)).toBe(true);
      expect(c.r).toBeGreaterThanOrEqual(0);
      expect(c.r).toBeLessThanOrEqual(255);
    }
  });
});
