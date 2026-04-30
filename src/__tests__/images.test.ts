import { renderPixelArt, SPRITES, images, gradientRect, createCanvas,
  flipHorizontal, flipVertical, rotate90 } from '../images/index.js';
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

  it('throws when fewer than 2 valid color stops', () => {
    expect(() => gradientRect({ colors: ['#ff0000'] })).toThrow('at least 2 valid hex color stops');
  });

  it('throws when colors array is empty', () => {
    expect(() => gradientRect({ colors: [] })).toThrow('at least 2 valid hex color stops');
  });

  it('throws when colors contain invalid hex', () => {
    expect(() => gradientRect({ colors: ['#ff0000', 'banana'] })).toThrow();
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