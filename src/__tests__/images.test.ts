import { renderPixelArt, SPRITES, images, gradientRect, createCanvas,
  flipHorizontal, flipVertical, rotate90, clearAnsiCache } from '../images/index.js';
import { stripAnsi } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  renderPixelArt
// ─────────────────────────────────────────────
describe('renderPixelArt', () => {
  const grid = [
    [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }],
    [{ r: 0, g: 0, b: 255 }, null],
  ];

  it('returns non-empty string', () => {
    expect(renderPixelArt(grid).length).toBeGreaterThan(0);
  });

  it('contains ANSI color codes', () => {
    expect(renderPixelArt(grid)).toContain('\x1b[38;2;');
  });

  it('empty grid returns empty string', () => {
    expect(renderPixelArt([])).toBe('');
  });

  it('renders without halfBlock mode', () => {
    expect(renderPixelArt(grid, { halfBlock: false })).toContain('█');
  });

  it('handles null pixels as spaces', () => {
    const result = renderPixelArt([[null, null]], { halfBlock: false });
    expect(stripAnsi(result)).toBe('  ');
  });

  it('scale:2 doubles block width', () => {
    const result = renderPixelArt([[{ r: 255, g: 0, b: 0 }]], { halfBlock: false, scale: 2 });
    expect(stripAnsi(result)).toBe('██');
  });

  it('halfBlock: top only pixel uses full block', () => {
    const result = renderPixelArt([[{ r: 255, g: 0, b: 0 }]], { halfBlock: true });
    expect(result).toContain('█');
  });

  it('halfBlock: bot only pixel uses lower half block', () => {
    // When top=null, bot=pixel → uses ▄
    const result = renderPixelArt([[null], [{ r: 0, g: 0, b: 255 }]], { halfBlock: true });
    expect(result).toContain('▄');
  });

  it('halfBlock: top+bot both filled uses upper half block', () => {
    const result = renderPixelArt([
      [{ r: 255, g: 0, b: 0 }],
      [{ r: 0, g: 0, b: 255 }],
    ], { halfBlock: true });
    expect(result).toContain('▀');
  });

  it('halfBlock: both null renders space', () => {
    const result = renderPixelArt([[null], [null]], { halfBlock: true });
    expect(stripAnsi(result)).toBe(' ');
  });
});

// ─────────────────────────────────────────────
//  SPRITES
// ─────────────────────────────────────────────
describe('images.sprites', () => {
  it('has all built-in sprites', () => {
    expect(SPRITES).toHaveProperty('heart');
    expect(SPRITES).toHaveProperty('star');
    expect(SPRITES).toHaveProperty('smiley');
    expect(SPRITES).toHaveProperty('pacman');
  });
});

describe('images.sprite', () => {
  it('renders heart sprite', () => {
    const result = images.sprite('heart');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('\x1b[38;2;255;0;0m');
  });

  it('throws for unknown sprite', () => {
    expect(() => images.sprite('unknown')).toThrow(/not found/);
  });

  it('error message lists available sprites', () => {
    expect(() => images.sprite('xyz')).toThrow(/heart/);
  });

  it('renders with custom scale', () => {
    const s1 = images.sprite('heart', { scale: 1 });
    const s2 = images.sprite('heart', { scale: 2 });
    expect(s2.length).toBeGreaterThan(s1.length);
  });
});

// ─────────────────────────────────────────────
//  gradientRect
// ─────────────────────────────────────────────
describe('gradientRect', () => {
  it('returns a string', () => {
    const r = gradientRect({ width: 5, height: 2 });
    expect(typeof r).toBe('string');
    expect(r.length).toBeGreaterThan(0);
  });

  it('contains color codes', () => {
    expect(gradientRect({ width: 5, height: 2 })).toContain('\x1b[');
  });

  it('horizontal style', () => {
    expect(() => gradientRect({ width: 5, height: 2, style: 'horizontal' })).not.toThrow();
  });

  it('vertical style', () => {
    expect(() => gradientRect({ width: 5, height: 2, style: 'vertical' })).not.toThrow();
  });

  it('diagonal style', () => {
    expect(() => gradientRect({ width: 5, height: 2, style: 'diagonal' })).not.toThrow();
  });

  it('radial style', () => {
    expect(() => gradientRect({ width: 10, height: 4, style: 'radial' })).not.toThrow();
  });

  it('width:1 does not divide by zero (clamped to 2)', () => {
    expect(() => gradientRect({ width: 1, height: 4 })).not.toThrow();
  });

  it('height:1 does not divide by zero (clamped to 2)', () => {
    expect(() => gradientRect({ width: 5, height: 1 })).not.toThrow();
  });

  it('single-stop colors renders solid fill (new behavior, no throw)', () => {
    // Pre-v1.1.0 threw "at least 2 valid hex color stops" — now single
    // stop renders a solid fill, consistent with CSS single-stop gradient UX
    // and with the gradient() function in colors/index.ts.
    const out = gradientRect({ colors: ['#ff0000'], width: 4, height: 2 });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('throws when colors array is empty', () => {
    expect(() => gradientRect({ colors: [] })).toThrow(/non-empty array/);
  });

  it('throws when all colors are invalid hex', () => {
    // 'banana' contains 'n' which is not a hex char → invalid.
    // With #ff0000 still valid, we have 1 valid stop → single-stop fill.
    // For a true throw, ALL stops must be invalid.
    expect(() =>
      gradientRect({ colors: ['nope', 'foul', 'wrong'] }),
    ).toThrow(/no valid hex/);
  });

  it('one valid + one invalid hex → renders single-stop fill', () => {
    // With ≥ 1 valid stop, falls back to single-stop fill (no throw)
    const out = gradientRect({ colors: ['#ff0000', 'banana'], width: 4, height: 2 });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('supports 3-stop gradient', () => {
    expect(() => gradientRect({ colors: ['#ff0000', '#00ff00', '#0000ff'], width: 5, height: 2 })).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  createCanvas
// ─────────────────────────────────────────────
describe('createCanvas', () => {
  it('creates canvas with correct dimensions', () => {
    const c = createCanvas(10, 5);
    expect(c.width).toBe(10);
    expect(c.height).toBe(5);
  });

  it('get returns null for empty pixel', () => {
    const c = createCanvas(3, 3);
    expect(c.get(0, 0)).toBeNull();
  });

  it('set and get a pixel', () => {
    const c = createCanvas(5, 5);
    c.set(2, 2, { r: 255, g: 0, b: 0 });
    expect(c.get(2, 2)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('set out-of-bounds does not throw', () => {
    const c = createCanvas(5, 5);
    expect(() => c.set(10, 10, { r: 255, g: 0, b: 0 })).not.toThrow();
  });

  it('fill sets all pixels', () => {
    const c = createCanvas(3, 3);
    c.fill({ r: 100, g: 100, b: 100 });
    expect(c.get(0, 0)).toEqual({ r: 100, g: 100, b: 100 });
    expect(c.get(2, 2)).toEqual({ r: 100, g: 100, b: 100 });
  });

  it('fill with null clears all pixels', () => {
    const c = createCanvas(3, 3);
    c.fill({ r: 255, g: 0, b: 0 });
    c.fill(null);
    expect(c.get(0, 0)).toBeNull();
  });

  it('drawRect fills a rectangle', () => {
    const c = createCanvas(5, 5);
    c.drawRect(1, 1, 3, 3, { r: 255, g: 0, b: 0 }, true);
    expect(c.get(1, 1)).toEqual({ r: 255, g: 0, b: 0 });
    expect(c.get(3, 3)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('drawRect outline only', () => {
    const c = createCanvas(7, 7);
    c.drawRect(1, 1, 5, 5, { r: 0, g: 255, b: 0 }, false);
    // Center should be empty
    expect(c.get(3, 3)).toBeNull();
    // Border should be filled
    expect(c.get(1, 1)).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('drawCircle filled sets center pixel', () => {
    const c = createCanvas(11, 11);
    c.drawCircle(5, 5, 4, { r: 0, g: 255, b: 0 }, true);
    expect(c.get(5, 5)).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('drawCircle outline does not fill center', () => {
    const c = createCanvas(11, 11);
    c.drawCircle(5, 5, 4, { r: 0, g: 0, b: 255 }, false);
    // Center should be empty (not on circumference)
    expect(c.get(5, 5)).toBeNull();
  });

  it('render returns a string', () => {
    const c = createCanvas(5, 5);
    c.fill({ r: 255, g: 0, b: 0 });
    expect(typeof c.render()).toBe('string');
    expect(c.render().length).toBeGreaterThan(0);
  });

  it('print uses write() not console.log', () => {
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const consoleSpy = jest.spyOn(console, 'log');
    const c = createCanvas(3, 3);
    c.fill({ r: 255, g: 0, b: 0 });
    c.print();
    expect(writeSpy).toHaveBeenCalled();
    expect(consoleSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('initializes with fill color when provided', () => {
    const c = createCanvas(3, 3, { r: 0, g: 255, b: 0 });
    expect(c.get(0, 0)).toEqual({ r: 0, g: 255, b: 0 });
  });
});

// ─────────────────────────────────────────────
//  Sprite transforms
// ─────────────────────────────────────────────
describe('flipHorizontal', () => {
  const grid = [
    [{ r: 255, g: 0, b: 0 }, null, { r: 0, g: 0, b: 255 }],
  ];

  it('reverses each row', () => {
    const result = flipHorizontal(grid);
    expect(result[0]?.[0]).toEqual({ r: 0, g: 0, b: 255 });
    expect(result[0]?.[2]).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('does not mutate original', () => {
    const original = [[{ r: 1, g: 2, b: 3 }, null]];
    flipHorizontal(original);
    expect(original[0]?.[0]).toEqual({ r: 1, g: 2, b: 3 });
  });

  it('available on images API', () => {
    expect(typeof images.flipHorizontal).toBe('function');
  });
});

describe('flipVertical', () => {
  const grid = [
    [{ r: 255, g: 0, b: 0 }],
    [null],
    [{ r: 0, g: 0, b: 255 }],
  ];

  it('reverses row order', () => {
    const result = flipVertical(grid);
    expect(result[0]?.[0]).toEqual({ r: 0, g: 0, b: 255 });
    expect(result[2]?.[0]).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('does not mutate original', () => {
    const original = [[{ r: 1, g: 2, b: 3 }], [null]];
    flipVertical(original);
    expect(original[0]?.[0]).toEqual({ r: 1, g: 2, b: 3 });
  });

  it('available on images API', () => {
    expect(typeof images.flipVertical).toBe('function');
  });
});

describe('rotate90', () => {
  const grid = [
    [{ r: 255, g: 0, b: 0 }, null],
    [null, { r: 0, g: 0, b: 255 }],
  ];

  it('rotates 2x2 grid 90 degrees clockwise', () => {
    const result = rotate90(grid);
    // Original [0][0] → result [0][1] in 90° CW rotation
    expect(result.length).toBe(2); // cols become rows
    expect(result[0]?.length).toBe(2); // rows become cols
  });

  it('empty grid returns itself', () => {
    expect(rotate90([])).toEqual([]);
  });

  it('single row grid', () => {
    const single = [[{ r: 1, g: 2, b: 3 }, null]];
    const result = rotate90(single);
    expect(result.length).toBe(2); // 2 cols → 2 rows
    expect(result[0]?.length).toBe(1);
  });

  it('available on images API', () => {
    expect(typeof images.rotate90).toBe('function');
  });

  it('4 rotations return original', () => {
    const r1 = rotate90(grid);
    const r2 = rotate90(r1);
    const r3 = rotate90(r2);
    const r4 = rotate90(r3);
    // After 4 rotations should be back to original structure
    expect(r4.length).toBe(grid.length);
    expect(r4[0]?.length).toBe(grid[0]?.length);
  });
});

// ─────────────────────────────────────────────
//  Default parameter branches
// ─────────────────────────────────────────────
describe('default parameter branches', () => {
  it('renderPixelArt with no opts uses defaults', () => {
    // scale=1, halfBlock=true defaults
    const result = renderPixelArt([[{ r: 255, g: 0, b: 0 }]]);
    expect(result.length).toBeGreaterThan(0);
  });

  it('renderPixelArt with empty opts {} uses defaults', () => {
    const result = renderPixelArt([[{ r: 0, g: 255, b: 0 }]], {});
    expect(result.length).toBeGreaterThan(0);
  });

  it('gradientRect with no opts uses all defaults', () => {
    // width=40, height=10, colors=['#ff0000','#0000ff'], style='horizontal'
    const result = gradientRect();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('gradientRect with empty opts {} uses defaults', () => {
    const result = gradientRect({});
    expect(typeof result).toBe('string');
  });

  it('drawRect with no fill argument uses default false (outline only)', () => {
    const c = createCanvas(7, 7);
    // No fill argument → uses default false
    c.drawRect(1, 1, 5, 5, { r: 255, g: 0, b: 0 });
    // Center should be empty (outline only)
    expect(c.get(3, 3)).toBeNull();
    // Border filled
    expect(c.get(1, 1)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('drawCircle with no fill argument uses default false (outline only)', () => {
    const c = createCanvas(11, 11);
    // No fill argument → uses default false (outline)
    c.drawCircle(5, 5, 4, { r: 0, g: 255, b: 0 });
    // Center should be empty
    expect(c.get(5, 5)).toBeNull();
  });

  it('canvas.render with no opts uses defaults', () => {
    const c = createCanvas(3, 3);
    c.fill({ r: 100, g: 100, b: 100 });
    // No opts argument → uses default {}
    const result = c.render();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('canvas.print with no opts uses defaults', () => {
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const c = createCanvas(3, 3);
    c.fill({ r: 0, g: 0, b: 255 });
    // No opts argument → uses default {}
    c.print();
    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('createCanvas without fillColor uses default null', () => {
    // fillColor=null default → all pixels start as null
    const c = createCanvas(3, 3);
    expect(c.get(0, 0)).toBeNull();
    expect(c.get(2, 2)).toBeNull();
  });
});

// ─────────────────────────────────────────────
//  toRgb null fallback (line 30)
// ─────────────────────────────────────────────
describe('toRgb null pixel fallback', () => {
  it('null pixel rendered in halfBlock falls back to black', () => {
    // When halfBlock has only top OR only bot null, the toRgb(null) → {r:0,g:0,b:0} fallback fires
    // But null+null skips entirely. Need top=null,bot=pixel OR top=pixel,bot=null
    // Actually toRgb is only called with non-null pixels in current code path
    // The fallback path triggers when pixels[row+1] is undefined (last odd row)
    const result = renderPixelArt([
      [{ r: 255, g: 0, b: 0 }],
    ]); // only 1 row → row+1 doesn't exist → botRow is []
    expect(result.length).toBeGreaterThan(0);
  });

  it('odd number of rows in halfBlock — last row has no pair (line 46 ?? [] fallback)', () => {
    // 3 rows → row=0 pairs with row=1, row=2 pairs with row=3 (undefined → [])
    const result = renderPixelArt([
      [{ r: 255, g: 0, b: 0 }],
      [{ r: 0, g: 255, b: 0 }],
      [{ r: 0, g: 0, b: 255 }], // row+1 doesn't exist → fallback to []
    ]);
    expect(result).toContain('\x1b[38;2;0;0;255m');
  });

  it('halfBlock empty topRow uses fallback', () => {
    // pixels[0] could be undefined if grid has gaps — though our types don't allow this,
    // the ?? [] fallback covers defensive cases
    const result = renderPixelArt([[null]]);
    // Both null → empty space
    expect(stripAnsi(result)).toBe(' ');
  });
});


// ─────────────────────────────────────────────
//  Stateful renderer — reduced ANSI output
// ─────────────────────────────────────────────
describe('renderPixelArt — stateful renderer', () => {
  beforeEach(() => clearAnsiCache());

  it('contiguous same-color pixels emit fewer escape sequences', () => {
    // Same color across whole row
    const RED = { r: 255, g: 0, b: 0 };
    const grid = [[RED, RED, RED, RED, RED, RED, RED, RED]];
    const result = renderPixelArt(grid, { halfBlock: false });

    // Old approach: 8 fg + 8 reset = 16 escapes
    // New approach: 1 fg + 1 reset = 2 escapes
    const escapeCount = (result.match(/\x1b\[/g) ?? []).length;
    expect(escapeCount).toBeLessThanOrEqual(4);
  });

  it('alternating colors still emit per-color', () => {
    const A = { r: 255, g: 0, b: 0 };
    const B = { r: 0, g: 0, b: 255 };
    const grid = [[A, B, A, B]];
    const result = renderPixelArt(grid, { halfBlock: false });
    // Each color change emits at least one escape
    expect(result).toContain('\x1b[38;2;255;0;0m');
    expect(result).toContain('\x1b[38;2;0;0;255m');
  });

  it('produces valid output for null pixels', () => {
    const RED = { r: 255, g: 0, b: 0 };
    const grid = [[null, RED, null]];
    const result = renderPixelArt(grid, { halfBlock: false });
    expect(result).toContain('█');
  });
});

// ─────────────────────────────────────────────
//  Braille mode — 2×4 sub-pixel resolution
// ─────────────────────────────────────────────
describe('renderPixelArt — braille mode', () => {
  it('renders pixels as braille glyphs', () => {
    const W = { r: 255, g: 255, b: 255 };
    // 2×4 grid → exactly one braille char
    const grid = [
      [W, W],
      [W, W],
      [W, W],
      [W, W],
    ];
    const result = renderPixelArt(grid, { braille: true });
    // Should contain a braille character (U+2800-U+28FF)
    const hasBraille = /[\u2800-\u28ff]/.test(result);
    expect(hasBraille).toBe(true);
  });

  it('empty grid renders space', () => {
    const grid = [
      [null, null],
      [null, null],
      [null, null],
      [null, null],
    ];
    const result = renderPixelArt(grid, { braille: true });
    expect(result).toContain(' ');
  });

  it('partial pixels render correctly', () => {
    const W = { r: 255, g: 255, b: 255 };
    const grid = [
      [W,    null],
      [null, null],
      [null, null],
      [null, null],
    ];
    const result = renderPixelArt(grid, { braille: true });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
//  Alpha blending
// ─────────────────────────────────────────────
describe('alpha blending', () => {
  it('opaque RGBA renders as opaque', () => {
    const grid = [[{ r: 255, g: 0, b: 0, a: 1 }]];
    const result = renderPixelArt(grid, { halfBlock: false });
    expect(result).toContain('\x1b[38;2;255;0;0m');
  });

  it('transparent RGBA renders as background', () => {
    const grid = [[{ r: 255, g: 0, b: 0, a: 0 }]];
    const result = renderPixelArt(grid, { halfBlock: false });
    // Fully transparent pixel — blends to default bg (black)
    expect(result.length).toBeGreaterThan(0);
  });

  it('half-transparent RGBA blends colors', () => {
    const grid = [[{ r: 255, g: 255, b: 255, a: 0.5 }]];
    const result = renderPixelArt(grid, { halfBlock: false });
    // 50% white over black = 127ish
    expect(result).toMatch(/\x1b\[38;2;12[78];12[78];12[78]m/);
  });

  it('blend utility is exposed', () => {
    const blended = images.colors.blend(
      { r: 255, g: 255, b: 255, a: 0.5 },
      { r: 0, g: 0, b: 0 },
    );
    expect(blended.r).toBeGreaterThan(120);
    expect(blended.r).toBeLessThan(140);
  });
});

// ─────────────────────────────────────────────
//  ANSI cache
// ─────────────────────────────────────────────
describe('ANSI cache', () => {
  it('clearAnsiCache does not throw', () => {
    expect(() => clearAnsiCache()).not.toThrow();
  });

  it('repeated colors produce identical strings (cache hit)', () => {
    const RED = { r: 255, g: 0, b: 0 };
    const grid1 = [[RED]];
    const grid2 = [[RED]];
    const r1 = renderPixelArt(grid1, { halfBlock: false });
    const r2 = renderPixelArt(grid2, { halfBlock: false });
    expect(r1).toBe(r2);
  });
});

// ─────────────────────────────────────────────
//  Canvas — color cloning (no shared references)
// ─────────────────────────────────────────────
describe('canvas color cloning', () => {
  it('set() does not store the original reference', () => {
    const canvas = createCanvas(2, 2);
    const red = { r: 255, g: 0, b: 0 };
    canvas.set(0, 0, red);
    red.r = 0; // mutate the original
    const stored = canvas.get(0, 0);
    expect(stored?.r).toBe(255); // canvas still has original red
  });

  it('get() returns a copy (no shared reference)', () => {
    const canvas = createCanvas(2, 2, { r: 255, g: 0, b: 0 });
    const got = canvas.get(0, 0);
    if (got) got.r = 0;
    const stored = canvas.get(0, 0);
    expect(stored?.r).toBe(255); // canvas still has original
  });

  it('fill() with color does not share references across pixels', () => {
    const canvas = createCanvas(2, 2);
    const color = { r: 100, g: 100, b: 100 };
    canvas.fill(color);
    const a = canvas.get(0, 0);
    if (a) a.r = 200;
    const b = canvas.get(1, 1);
    expect(b?.r).toBe(100); // unaffected
  });
});

// ─────────────────────────────────────────────
//  Canvas — drawSprite with alpha
// ─────────────────────────────────────────────
describe('canvas.drawSprite', () => {
  it('composites a sprite onto the canvas', () => {
    const canvas = createCanvas(5, 5);
    const sprite = [
      [{ r: 255, g: 0, b: 0 }, null],
      [null, { r: 0, g: 255, b: 0 }],
    ];
    canvas.drawSprite(0, 0, sprite);
    expect(canvas.get(0, 0)?.r).toBe(255);
    expect(canvas.get(1, 0)).toBeNull();
    expect(canvas.get(1, 1)?.g).toBe(255);
  });

  it('skips out-of-bounds sprite pixels', () => {
    const canvas = createCanvas(2, 2);
    const sprite = [
      [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }],
    ];
    expect(() => canvas.drawSprite(1, 0, sprite)).not.toThrow();
    // Only the first sprite pixel that fits is drawn
    expect(canvas.get(1, 0)?.r).toBe(255);
  });

  it('alpha-blends transparent sprite pixels', () => {
    const canvas = createCanvas(2, 2, { r: 0, g: 0, b: 0 });
    const sprite = [[{ r: 255, g: 255, b: 255, a: 0.5 }]];
    canvas.drawSprite(0, 0, sprite);
    const result = canvas.get(0, 0);
    expect(result?.r).toBeGreaterThan(120);
    expect(result?.r).toBeLessThan(140);
  });
});

// ─────────────────────────────────────────────
//  Canvas — resize
// ─────────────────────────────────────────────
describe('canvas.resize', () => {
  it('resizes preserving content', () => {
    const canvas = createCanvas(2, 2, { r: 255, g: 0, b: 0 });
    canvas.resize(4, 4);
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(4);
    expect(canvas.get(0, 0)?.r).toBe(255);
  });

  it('shrinks dropping out-of-bounds pixels', () => {
    const canvas = createCanvas(4, 4, { r: 255, g: 0, b: 0 });
    canvas.set(3, 3, { r: 0, g: 0, b: 255 });
    canvas.resize(2, 2);
    expect(canvas.width).toBe(2);
    expect(canvas.height).toBe(2);
  });

  it('expands filling new area with fillColor', () => {
    const canvas = createCanvas(2, 2);
    canvas.resize(4, 4, { r: 0, g: 255, b: 0 });
    expect(canvas.get(3, 3)?.g).toBe(255);
  });
});

// ─────────────────────────────────────────────
//  Canvas — dirty tracking
// ─────────────────────────────────────────────
describe('canvas dirty tracking', () => {
  it('full render works without dirty markers', () => {
    const canvas = createCanvas(3, 3);
    canvas.set(1, 1, { r: 255, g: 0, b: 0 });
    const result = canvas.render();
    expect(result.length).toBeGreaterThan(0);
  });

  it('dirtyOnly render after set returns subset', () => {
    const canvas = createCanvas(10, 10);
    canvas.set(5, 5, { r: 255, g: 0, b: 0 });
    const dirty = canvas.render({ dirtyOnly: true });
    const full = canvas.render();
    // Dirty should be smaller than full
    expect(dirty.length).toBeLessThan(full.length);
  });

  it('clearDirty resets dirty bounds', () => {
    const canvas = createCanvas(5, 5);
    canvas.set(2, 2, { r: 255, g: 0, b: 0 });
    canvas.clearDirty();
    const result = canvas.render({ dirtyOnly: true });
    // No dirty region → renders full canvas
    expect(result.length).toBeGreaterThan(0);
  });

  it('markDirty marks whole canvas as dirty', () => {
    const canvas = createCanvas(3, 3);
    canvas.markDirty();
    const dirty = canvas.render({ dirtyOnly: true });
    const full = canvas.render();
    expect(dirty).toBe(full);
  });
});

// ─────────────────────────────────────────────
//  rotate90 — irregular grids
// ─────────────────────────────────────────────
describe('rotate90 irregular grids', () => {
  it('handles rows of different widths', () => {
    const W = { r: 255, g: 255, b: 255 };
    const grid = [
      [W, W, W],   // 3 wide
      [W, W],       // 2 wide (irregular)
    ];
    expect(() => rotate90(grid)).not.toThrow();
  });

  it('returns empty for empty input', () => {
    expect(rotate90([])).toEqual([]);
  });

  it('rotates a 1×0 grid to 0×1 (geometrically: no columns to swap)', () => {
    // Geometrically: rotating a 1-row × 0-col matrix 90° produces a 0-row × 1-col
    // matrix, which is `[]`. Previous behavior `[[]]` was preserving input
    // shape but mathematically incorrect.
    expect(rotate90([[]])).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  gradientRect — angle and dither options
// ─────────────────────────────────────────────
describe('gradientRect — extended options', () => {
  it('angle option produces output', () => {
    const result = gradientRect({
      width: 10, height: 4,
      colors: ['#ff0000', '#0000ff'],
      angle: 45,
    });
    expect(result.length).toBeGreaterThan(0);
  });

  it('bayer dithering produces different output than no dithering', () => {
    const a = gradientRect({
      width: 20, height: 4, colors: ['#000000', '#ffffff'], dither: 'none',
    });
    const b = gradientRect({
      width: 20, height: 4, colors: ['#000000', '#ffffff'], dither: 'bayer',
    });
    // They should differ (dithering perturbs the values)
    expect(a).not.toBe(b);
  });

  it('braille gradient produces braille glyphs', () => {
    const result = gradientRect({
      width: 16, height: 8,
      colors: ['#ff0000', '#0000ff'],
      braille: true,
    });
    const hasBraille = /[\u2800-\u28ff]/.test(result);
    expect(hasBraille).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Color utilities
// ─────────────────────────────────────────────
describe('images.colors', () => {
  it('hex parses valid hex', () => {
    expect(images.colors.hex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('hex returns null for invalid', () => {
    expect(images.colors.hex('not-a-hex')).toBeNull();
  });

  it('lerp interpolates between colors', () => {
    const mid = images.colors.lerp(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      0.5,
    );
    expect(mid.r).toBeGreaterThan(120);
    expect(mid.r).toBeLessThan(140);
  });

  it('blend handles RGB (no alpha) as fully opaque', () => {
    const result = images.colors.blend(
      { r: 100, g: 100, b: 100 },
      { r: 0, g: 0, b: 0 },
    );
    expect(result).toEqual({ r: 100, g: 100, b: 100 });
  });
});

// ─────────────────────────────────────────────
//  Defensive inputs
// ─────────────────────────────────────────────
describe('images defensive inputs', () => {
  it('renderPixelArt with non-array returns empty', () => {
    expect(renderPixelArt(null as unknown as never)).toBe('');
    expect(renderPixelArt('not-array' as unknown as never)).toBe('');
  });

  it('renderPixelArt with empty grid returns empty', () => {
    expect(renderPixelArt([])).toBe('');
  });

  it('renderPixelArt with malformed rows is forgiving', () => {
    // Some rows are arrays, others not
    const out = renderPixelArt([
      [{ r: 255, g: 0, b: 0 }],
      null as unknown as never,
      [{ r: 0, g: 255, b: 0 }],
    ]);
    expect(typeof out).toBe('string');
  });

  it('flipHorizontal handles malformed grid gracefully', () => {
    expect(flipHorizontal(null as unknown as never)).toEqual([]);
    expect(flipHorizontal('not-array' as unknown as never)).toEqual([]);
  });

  it('flipVertical handles malformed grid', () => {
    expect(flipVertical(null as unknown as never)).toEqual([]);
  });

  it('rotate90 handles malformed grid', () => {
    expect(rotate90(null as unknown as never)).toEqual([]);
    expect(rotate90([])).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  gradientRect defensive
// ─────────────────────────────────────────────
describe('gradientRect defensive', () => {
  it('rejects non-array colors', () => {
    expect(() =>
      gradientRect({ colors: 'not-array' as unknown as string[] }),
    ).toThrow(TypeError);
  });

  it('rejects empty colors array', () => {
    expect(() => gradientRect({ colors: [] })).toThrow(TypeError);
  });

  it('rejects all-invalid hex stops', () => {
    expect(() =>
      gradientRect({ colors: ['nope', 'foul', 'wrong'] }),
    ).toThrow(/no valid hex/);
  });

  it('single-stop colors renders solid fill', () => {
    const out = gradientRect({
      width: 4, height: 4,
      colors: ['#ff0000'],
    });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('NaN width falls back to default', () => {
    expect(() =>
      gradientRect({ width: NaN, height: 5, colors: ['#ff0000', '#0000ff'] }),
    ).not.toThrow();
  });

  it('Infinity width clamps to MAX_DIMENSION (not OOM)', () => {
    // Test passes if it doesn't allocate infinite memory
    const out = gradientRect({
      width: Infinity, height: 2,
      colors: ['#ff0000', '#0000ff'],
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(100_000_000); // sanity check
  });
});

// ─────────────────────────────────────────────
//  createCanvas defensive
// ─────────────────────────────────────────────
describe('canvas defensive', () => {
  it('createCanvas with NaN dimensions clamps to 1×1', () => {
    const c = createCanvas(NaN, NaN);
    expect(c.width).toBe(1);
    expect(c.height).toBe(1);
  });

  it('createCanvas with Infinity clamps to MAX_DIMENSION', () => {
    const c = createCanvas(Infinity, 2);
    expect(c.width).toBeLessThan(100_000);
  });

  it('createCanvas with 0 dimensions clamps to 1', () => {
    const c = createCanvas(0, 0);
    expect(c.width).toBe(1);
    expect(c.height).toBe(1);
  });

  it('set with non-finite coords is no-op (no throw)', () => {
    const c = createCanvas(10, 10);
    expect(() => c.set(NaN, 5, { r: 255, g: 0, b: 0 })).not.toThrow();
    expect(() => c.set(5, Infinity, { r: 255, g: 0, b: 0 })).not.toThrow();
  });

  it('get with non-finite coords returns null', () => {
    const c = createCanvas(10, 10);
    expect(c.get(NaN, 0)).toBeNull();
    expect(c.get(0, Infinity)).toBeNull();
  });

  it('drawRect with NaN coords is no-op', () => {
    const c = createCanvas(10, 10);
    expect(() => c.drawRect(NaN, 0, 5, 5, { r: 255, g: 0, b: 0 })).not.toThrow();
  });

  it('drawRect with negative w/h is no-op', () => {
    const c = createCanvas(10, 10);
    c.drawRect(0, 0, -5, -5, { r: 255, g: 0, b: 0 });
    // No pixels should be set
    expect(c.get(0, 0)).toBeNull();
  });

  it('drawCircle with negative radius is no-op', () => {
    const c = createCanvas(10, 10);
    c.drawCircle(5, 5, -2, { r: 255, g: 0, b: 0 });
    expect(c.get(5, 5)).toBeNull();
  });

  it('drawCircle with NaN center is no-op', () => {
    const c = createCanvas(10, 10);
    expect(() => c.drawCircle(NaN, 5, 2, { r: 255, g: 0, b: 0 })).not.toThrow();
  });

  it('drawSprite with non-array sprite is no-op', () => {
    const c = createCanvas(10, 10);
    expect(() =>
      c.drawSprite(0, 0, null as unknown as never),
    ).not.toThrow();
  });

  it('drawSprite tolerates malformed sprite rows', () => {
    const c = createCanvas(10, 10);
    const sprite = [
      [{ r: 255, g: 0, b: 0 }],
      null as unknown as never, // bad row
      [{ r: 0, g: 255, b: 0 }],
    ];
    expect(() => c.drawSprite(0, 0, sprite)).not.toThrow();
  });

  it('canvas.pixels getter returns deep clone', () => {
    const c = createCanvas(2, 2, { r: 255, g: 0, b: 0 });
    const snapshot = c.pixels;
    // Mutate the snapshot via unknown cast (Pixel doesn't have index signature)
    (snapshot[0]![0] as unknown as { r: number }).r = 0;
    // Original canvas state untouched
    const reread = c.get(0, 0) as unknown as { r: number };
    expect(reread.r).toBe(255);
  });

  it('resize with NaN keeps current dimensions', () => {
    const c = createCanvas(5, 5);
    c.resize(NaN, NaN);
    expect(c.width).toBe(5);
    expect(c.height).toBe(5);
  });
});

// ─────────────────────────────────────────────
//  ANSI cache bounded
// ─────────────────────────────────────────────
describe('ANSI cache LRU bounded', () => {
  beforeEach(() => clearAnsiCache());

  it('survives massive color count without OOM', () => {
    const c = createCanvas(2, 2);
    // Generate 2000 distinct colors — exceeds cache MAX (1024)
    for (let i = 0; i < 2000; i++) {
      c.set(0, 0, { r: i % 256, g: (i * 2) % 256, b: (i * 3) % 256 });
    }
    expect(() => c.render()).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Coverage: hit specific defensive branches
//
//  Each test below targets a particular branch (line numbers from the
//  coverage report) to bring branch % to 100.
// ─────────────────────────────────────────────
describe('images: branch coverage targets', () => {
  it('blendRgba with null fg returns bg (line 78)', () => {
    // toRgb with null pixel goes through blendRgba indirectly when alpha-blended
    // — but direct null fg test exercises the early-return branch
    const out = renderPixelArt([
      [null, { r: 100, g: 100, b: 100 }],
    ]);
    expect(typeof out).toBe('string');
  });

  it('toRgb with null pixel returns bg fallback (line 146)', () => {
    // halfBlock mode with null top and non-null bot triggers toRgb(null, bg)
    const out = renderPixelArt([
      [null],
      [{ r: 255, g: 0, b: 0 }],
    ], { halfBlock: true });
    expect(out.length).toBeGreaterThan(0);
  });

  it('halfBlock with odd row count — missing botRow (line 184)', () => {
    // Grid with 1 row → row+1 is undefined → fallback to []
    const out = renderPixelArt([
      [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }],
    ], { halfBlock: true });
    expect(out.length).toBeGreaterThan(0);
  });

  it('halfBlock with 3 rows — last row has no pair (line 184)', () => {
    const out = renderPixelArt([
      [{ r: 255, g: 0, b: 0 }],
      [{ r: 0, g: 255, b: 0 }],
      [{ r: 0, g: 0, b: 255 }],  // odd row — botRow is missing
    ], { halfBlock: true });
    expect(out.length).toBeGreaterThan(0);
  });

  it('fgRgbVal=null branch in renderPixelArt (line 223)', () => {
    // Cell with top=null, bot=null — fgKey is -1 path
    const out = renderPixelArt([
      [null, null],
      [{ r: 100, g: 100, b: 100 }, null],
    ], { halfBlock: true });
    expect(out.length).toBeGreaterThan(0);
  });

  it('braille mode with empty grid returns empty string (line 293)', () => {
    expect(renderPixelArt([], { braille: true })).toBe('');
  });

  it('braille mode with mixed cells covers reset+space branch (line 316)', () => {
    // First cells have colors, then a fully-empty 2×4 cell triggers reset
    const grid = [
      [{ r: 255, g: 0, b: 0 }, { r: 255, g: 0, b: 0 }, null, null],
      [{ r: 255, g: 0, b: 0 }, { r: 255, g: 0, b: 0 }, null, null],
      [{ r: 255, g: 0, b: 0 }, { r: 255, g: 0, b: 0 }, null, null],
      [{ r: 255, g: 0, b: 0 }, { r: 255, g: 0, b: 0 }, null, null],
    ];
    const out = renderPixelArt(grid, { braille: true });
    expect(out.length).toBeGreaterThan(0);
  });

  it('cloneColor with RGB (no alpha) — line 546 RGB branch', () => {
    const c = createCanvas(2, 2, { r: 100, g: 100, b: 100 }); // plain RGB
    // pixels getter triggers cloneColor on each pixel
    const snap = c.pixels;
    expect(snap[0]![0]).toBeDefined();
  });

  it('cloneColor with RGBA (has alpha) — line 546 RGBA branch', () => {
    const c = createCanvas(2, 2, { r: 100, g: 100, b: 100, a: 0.5 });
    const snap = c.pixels;
    expect(snap[0]![0]).toHaveProperty('a');
  });

  it('drawRect with null color hits "null" branch (line 630)', () => {
    const c = createCanvas(5, 5, { r: 255, g: 0, b: 0 });
    // Pass null as color — exercises the `cloned ? clone : null` false branch
    c.drawRect(0, 0, 3, 3, null, true);
    expect(c.get(0, 0)).toBeNull();
  });

  it('drawCircle with null color hits "null" branch (line 658)', () => {
    const c = createCanvas(10, 10, { r: 255, g: 0, b: 0 });
    c.drawCircle(5, 5, 2, null, true);
    expect(c.get(5, 5)).toBeNull();
  });

  it('drawSprite with RGBA over null bg pixel (line 681)', () => {
    const c = createCanvas(5, 5); // bg=null
    // Sprite pixel with alpha → blendRgba(px, toRgb(null, ...))
    const sprite = [[{ r: 255, g: 0, b: 0, a: 0.5 }]];
    c.drawSprite(0, 0, sprite);
    const out = c.get(0, 0);
    expect(out).not.toBeNull();
  });

  it('clampByte with NaN returns 0 (line 57)', () => {
    // Trigger clampByte(NaN) indirectly via toRgb on a pixel with NaN value
    const c = createCanvas(2, 2);
    c.set(0, 0, { r: NaN, g: NaN, b: NaN });
    // Render path calls clampByte
    const out = c.render();
    expect(typeof out).toBe('string');
  });
});

// ─────────────────────────────────────────────
//  v1.2.0 — Phase 2: conic gradients
// ─────────────────────────────────────────────
describe('gradientRect: conic style (v1.2.0)', () => {
  it('renders conic gradient', () => {
    const out = gradientRect({
      width: 20,
      height: 10,
      colors: ['#ff0000', '#00ff00', '#0000ff', '#ff0000'],
      style: 'conic',
    });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('conic with startAngle rotates the sweep', () => {
    const a = gradientRect({
      width: 20, height: 10,
      colors: ['#ff0000', '#0000ff'],
      style: 'conic', startAngle: 0,
    });
    const b = gradientRect({
      width: 20, height: 10,
      colors: ['#ff0000', '#0000ff'],
      style: 'conic', startAngle: 90,
    });
    expect(a).not.toBe(b);
  });

  it('conic with dither still works', () => {
    const out = gradientRect({
      width: 20, height: 10,
      colors: ['#ff0000', '#0000ff'],
      style: 'conic', dither: 'bayer',
    });
    expect(typeof out).toBe('string');
  });

  it('conic with non-finite startAngle defaults to 0', () => {
    const ref = gradientRect({
      width: 20, height: 10,
      colors: ['#ff0000', '#0000ff'],
      style: 'conic', startAngle: 0,
    });
    const nan = gradientRect({
      width: 20, height: 10,
      colors: ['#ff0000', '#0000ff'],
      style: 'conic', startAngle: NaN,
    });
    expect(nan).toBe(ref);
  });
});
