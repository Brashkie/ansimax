// ─────────────────────────────────────────────
//  src/index.ts  –  entry point coverage
// ─────────────────────────────────────────────

// Test named exports from main entry point
import ansimax, {
  color, gradient, rainbow, colorPresets,
  animate,
  ascii,
  loader, SPINNERS,
  frames,
  components,
  themes,
  images, createCanvas, renderPixelArt, gradientRect, SPRITES,
  configure, getConfig, getSpeedMultiplier,
  sleep, write, writeln, cursor, screen, supportsColor, fgRgb, bgRgb, sgr, reset,
  termSize, hexToRgb, rgbToHex, stripAnsi, visibleLen, clamp, lerpColor,
  isHexColor, truncateAnsi, repeatVisible, padEnd, padStart, center, wordWrap, lerp, rgbTo256,
  compose, setNoColor, isNoColor, resetNoColor,
} from '../index.js';
import type { RGB } from '../index.js';

describe('default export', () => {
  it('exports ansimax object with all modules', () => {
    expect(ansimax).toBeDefined();
    expect(ansimax.color).toBeDefined();
    expect(ansimax.animate).toBeDefined();
    expect(ansimax.ascii).toBeDefined();
    expect(ansimax.loader).toBeDefined();
    expect(ansimax.frames).toBeDefined();
    expect(ansimax.components).toBeDefined();
    expect(ansimax.themes).toBeDefined();
    expect(ansimax.images).toBeDefined();
    expect(ansimax.configure).toBeDefined();
  });
});

describe('named exports — modules', () => {
  it('color is exported', () => {
    expect(typeof color.red).toBe('function');
  });

  it('gradient is exported', () => {
    expect(typeof gradient).toBe('function');
    expect(stripAnsi(gradient('hi', ['#ff0000', '#0000ff']))).toBe('hi');
  });

  it('rainbow is exported', () => {
    expect(typeof rainbow).toBe('function');
    expect(stripAnsi(rainbow('abc'))).toBe('abc');
  });

  it('colorPresets is exported', () => {
    expect(typeof colorPresets.sunset).toBe('function');
    expect(typeof colorPresets.ocean).toBe('function');
  });

  it('animate is exported', () => {
    expect(typeof animate.typewriter).toBe('function');
    expect(typeof animate.fadeIn).toBe('function');
    expect(typeof animate.glitch).toBe('function');
  });

  it('ascii is exported', () => {
    expect(typeof ascii.big).toBe('function');
    expect(typeof ascii.box).toBe('function');
    expect(typeof ascii.divider).toBe('function');
  });

  it('loader is exported', () => {
    expect(typeof loader.spin).toBe('function');
    expect(typeof loader.progress).toBe('function');
    expect(typeof loader.tasks).toBe('function');
  });

  it('SPINNERS is exported', () => {
    expect(SPINNERS).toBeDefined();
    expect(Array.isArray(SPINNERS.dots)).toBe(true);
  });

  it('frames is exported', () => {
    expect(typeof frames.play).toBe('function');
    expect(typeof frames.live).toBe('function');
    expect(typeof frames.generate).toBe('function');
  });

  it('components is exported', () => {
    expect(typeof components.table).toBe('function');
    expect(typeof components.badge).toBe('function');
    expect(typeof components.status).toBe('function');
  });

  it('themes is exported', () => {
    expect(typeof themes.use).toBe('function');
    expect(typeof themes.list).toBe('function');
  });

  it('images is exported', () => {
    expect(typeof images.sprite).toBe('function');
    expect(typeof images.gradientRect).toBe('function');
    expect(typeof images.createCanvas).toBe('function');
  });

  it('createCanvas is exported directly', () => {
    const canvas = createCanvas(3, 3);
    expect(canvas.width).toBe(3);
  });

  it('renderPixelArt is exported directly', () => {
    expect(typeof renderPixelArt).toBe('function');
  });

  it('gradientRect is exported directly', () => {
    expect(typeof gradientRect).toBe('function');
  });

  it('SPRITES is exported', () => {
    expect(SPRITES).toBeDefined();
    expect(SPRITES).toHaveProperty('heart');
  });
});

describe('named exports — configure', () => {
  it('configure is exported and callable', () => {
    expect(typeof configure).toBe('function');
    expect(() => configure({ theme: 'nord' })).not.toThrow();
    configure({ theme: 'dracula' }); // reset
  });

  it('getConfig returns config object', () => {
    const cfg = getConfig();
    expect(cfg).toHaveProperty('colorMode');
    expect(cfg).toHaveProperty('animationSpeed');
    expect(cfg).toHaveProperty('theme');
  });

  it('getSpeedMultiplier returns a number', () => {
    expect(typeof getSpeedMultiplier()).toBe('number');
  });
});

describe('named exports — utils', () => {
  it('sleep is exported', () => {
    expect(typeof sleep).toBe('function');
  });

  it('cursor is exported with all methods', () => {
    expect(typeof cursor.up).toBe('function');
    expect(typeof cursor.hide).toBe('function');
    expect(cursor.hide()).toBe('\x1b[?25l');
  });

  it('screen is exported with all methods', () => {
    expect(typeof screen.clear).toBe('function');
    expect(screen.clearLine()).toBe('\x1b[2K');
  });

  it('supportsColor returns a valid value', () => {
    const result = supportsColor();
    expect(['none', 'basic', '256', 'truecolor']).toContain(result);
  });

  it('fgRgb generates correct escape', () => {
    expect(fgRgb(255, 0, 0)).toBe('\x1b[38;2;255;0;0m');
  });

  it('bgRgb generates correct escape', () => {
    expect(bgRgb(0, 0, 255)).toBe('\x1b[48;2;0;0;255m');
  });

  it('sgr generates escape sequence', () => {
    expect(sgr(1, 31)).toBe('\x1b[1;31m');
  });

  it('reset generates reset sequence', () => {
    expect(reset()).toBe('\x1b[0m');
  });

  it('termSize returns cols and rows', () => {
    const { cols, rows } = termSize();
    expect(typeof cols).toBe('number');
    expect(typeof rows).toBe('number');
  });

  it('hexToRgb converts hex to rgb', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('rgbToHex converts rgb to hex', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
  });

  it('stripAnsi removes escape codes', () => {
    expect(stripAnsi('\x1b[31mhello\x1b[0m')).toBe('hello');
  });

  it('visibleLen ignores ansi codes', () => {
    expect(visibleLen('\x1b[31mhello\x1b[0m')).toBe(5);
  });

  it('clamp works correctly', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
  });

  it('lerpColor interpolates correctly', () => {
    const result = lerpColor({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, 0.5);
    expect(result).toEqual({ r: 50, g: 50, b: 50 });
  });

  it('write and writeln are exported', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    write('test');
    writeln('line');
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────
//  New utility re-exports
// ─────────────────────────────────────────────
describe('utility re-exports from main entry', () => {
  it('isHexColor is exported and works', () => {
    expect(isHexColor('#ff0000')).toBe(true);
    expect(isHexColor('banana')).toBe(false);
  });

  it('truncateAnsi is exported and works', () => {
    const result = truncateAnsi('hello world', 5);
    expect(result.length).toBeGreaterThan(0);
  });

  it('repeatVisible is exported and works', () => {
    expect(repeatVisible('-', 5)).toBe('-----');
  });

  it('padEnd is exported and works', () => {
    expect(padEnd('hi', 5)).toBe('hi   ');
  });

  it('padStart is exported and works', () => {
    expect(padStart('hi', 5)).toBe('   hi');
  });

  it('center is exported and works', () => {
    expect(center('hi', 6)).toBe('  hi  ');
  });

  it('wordWrap is exported and works', () => {
    expect(wordWrap('hello world foo bar', 10)).toEqual(['hello', 'world foo', 'bar']);
  });

  it('lerp is exported and works', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it('rgbTo256 is exported and works', () => {
    expect(typeof rgbTo256(128, 128, 128)).toBe('number');
  });

  it('RGB type is exported (compile-time check)', () => {
    const rgb: RGB = { r: 255, g: 0, b: 0 };
    expect(rgb.r).toBe(255);
  });
});

// ─────────────────────────────────────────────
//  Color utilities re-exports
// ─────────────────────────────────────────────
describe('color utility re-exports', () => {
  afterEach(() => resetNoColor());

  it('compose is exported and works', () => {
    setNoColor(false);
    const styled = compose(color.bold, color.red);
    const result = styled('hi');
    expect(result).toContain('hi');
    expect(result).toContain('\x1b[');
  });

  it('setNoColor is exported and toggles suppression', () => {
    setNoColor(true);
    expect(isNoColor()).toBe(true);
    setNoColor(false);
    expect(isNoColor()).toBe(false);
  });

  it('isNoColor is exported and returns boolean', () => {
    setNoColor(false);
    expect(typeof isNoColor()).toBe('boolean');
  });

  it('resetNoColor is exported and clears override', () => {
    setNoColor(true);
    resetNoColor();
    // After reset, isNoColor returns auto-detect value (likely true in Jest, no TTY)
    expect(typeof isNoColor()).toBe('boolean');
  });
});