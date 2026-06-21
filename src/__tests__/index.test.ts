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

// ─────────────────────────────────────────────
//  Coverage: barrel exercise for v1.1.0 additions
//
//  The barrel file (src/index.ts) re-exports many functions. Each
//  re-exported arrow function counts as a separate function for
//  Jest coverage. This block invokes every v1.1.0 addition at least
//  once to lift the funcs % closer to 100.
// ─────────────────────────────────────────────
describe('barrel coverage — v1.1.0 additions', () => {
  it('imports and invokes new tree algorithms', async () => {
    const {
      tree, renderTree, findInTree, countNodes, mapTree, filterTree, walkTree,
    } = await import('../index.js');

    const t = tree({ label: 'r' });
    t.add('a').addLeaf('a1');
    t.add('b');
    expect(typeof renderTree(t)).toBe('string');
    expect(countNodes(t)).toBeGreaterThan(0);
    expect(findInTree(t, (n) => n.label === 'a')?.label).toBe('a');
    walkTree(t, () => { /* noop */ });
    expect(mapTree(t, (n) => n)).toBeTruthy();
    expect(filterTree(t, () => true)).toBeTruthy();
  });

  it('imports and invokes new configure helpers', async () => {
    const {
      configure, getConfig, onConfigKeyChange, withConfig,
      pauseListeners, resumeListeners, CONFIG_DEFAULTS, resetConfig,
    } = await import('../index.js');

    expect(CONFIG_DEFAULTS).toBeDefined();
    expect(getConfig()).toBeDefined();

    const off = onConfigKeyChange('theme', () => { /* noop */ });
    off();

    pauseListeners();
    resumeListeners();

    await withConfig({ animationSpeed: 'fast' }, () => 'ok');
    expect(getConfig()).toBeDefined();
    configure({}); // exercise no-op path

    // Invoke resetConfig to cover its barrel re-export
    configure({ theme: 'nord' });
    resetConfig();
    expect(getConfig().theme).toBe('dracula');
  });

  it('imports and invokes new ANSI utilities', async () => {
    const {
      setTitle, link, bell,
      DEFAULT_TERM_COLS, DEFAULT_TERM_ROWS,
      OSC, ST, BEL,
    } = await import('../index.js');

    expect(typeof setTitle('test')).toBe('string');
    expect(typeof link('text', 'url')).toBe('string');
    expect(bell()).toBe('\x07');
    expect(DEFAULT_TERM_COLS).toBe(80);
    expect(DEFAULT_TERM_ROWS).toBe(24);
    expect(OSC).toBeDefined();
    expect(ST).toBeDefined();
    expect(BEL).toBe('\x07');
  });

  it('imports and invokes new helpers', async () => {
    const {
      once, escapeRegex, safeJson, padBoth, nextTick,
    } = await import('../index.js');

    expect(once(() => 'x')()).toBe('x');
    expect(escapeRegex('a.b')).toBe('a\\.b');
    expect(safeJson({ a: 1 })).toBe('{"a":1}');
    expect(padBoth('x', 5)).toBe('  x  ');
    nextTick(() => { /* noop */ });
  });

  it('imports new image transforms', async () => {
    const { flipHorizontal, flipVertical, rotate90 } = await import('../index.js');
    const grid = [
      [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }],
      [{ r: 0, g: 0, b: 255 }, null],
    ];
    expect(flipHorizontal(grid)).toBeDefined();
    expect(flipVertical(grid)).toBeDefined();
    expect(rotate90(grid)).toBeDefined();
  });

  it('imports new color helpers', async () => {
    const { registerPreset, listPresets, clearColorCache } = await import('../index.js');

    registerPreset('barrel-test-preset', ['#ff0000', '#0000ff']);
    expect(listPresets()).toContain('barrel-test-preset');
    clearColorCache();
  });

  it('imports new theme helpers', async () => {
    const { createTheme, clearThemeColorCache } = await import('../index.js');

    const t = createTheme();
    expect(typeof t.use).toBe('function');
    clearThemeColorCache();
  });

  it('imports frames + cursor reset helpers', async () => {
    const { resetFramesCursorCount, frames } = await import('../index.js');
    expect(typeof resetFramesCursorCount).toBe('function');
    resetFramesCursorCount();
    expect(typeof frames.play).toBe('function');
  });

  it('imports MENU_CANCELLED symbol', async () => {
    const { MENU_CANCELLED } = await import('../index.js');
    expect(typeof MENU_CANCELLED).toBe('symbol');
  });

  it('imports new helper utilities', async () => {
    const {
      memoize, debounce, throttle, onResize,
      requestTerminalFrame, cancelTerminalFrame,
      diffLines, gradientColor, charWidth, graphemes,
      sliceAnsi, wrapAnsi,
    } = await import('../index.js');

    const m = memoize((n: number) => n * 2);
    expect(m(5)).toBe(10);
    expect(m.size()).toBe(1);
    m.clear();

    const d = debounce(() => { /* noop */ }, 10);
    d.cancel();

    const t = throttle(() => { /* noop */ }, 10);
    t.cancel();

    const off = onResize(() => { /* noop */ });
    off();

    const handle = requestTerminalFrame(() => { /* noop */ });
    cancelTerminalFrame(handle);

    expect(diffLines('a', 'b').length).toBe(1);
    expect(gradientColor([{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }], 0.5)).toBeDefined();
    expect(charWidth('x')).toBe(1);
    expect([...graphemes('ab')].length).toBe(2);
    expect(sliceAnsi('hello', 0, 3)).toBe('hel');
    expect(wrapAnsi('hello world', 5)).toBeDefined();
  });

  it('imports ascii helpers', async () => {
    const {
      ascii, registerFont, listFonts, hasFont, clearRenderCache, getRenderCacheSize,
    } = await import('../index.js');

    expect(listFonts().length).toBeGreaterThan(0);
    expect(hasFont('big')).toBe(true);
    expect(hasFont('not-a-font')).toBe(false);
    clearRenderCache();
    expect(getRenderCacheSize()).toBe(0);
    expect(typeof ascii.banner).toBe('function');
    expect(typeof registerFont).toBe('function');
  });

  it('imports loaders namespace', async () => {
    const { loader, SPINNERS } = await import('../index.js');
    expect(typeof loader.spin).toBe('function');
    expect(typeof loader.progress).toBe('function');
    expect(SPINNERS).toBeDefined();
  });

  it('imports animate namespace', async () => {
    const { animate } = await import('../index.js');
    expect(typeof animate.typewriter).toBe('function');
    expect(typeof animate.delay).toBe('function');
    expect(typeof animate.parallel).toBe('function');
  });

  it('imports components namespace', async () => {
    const { components, box } = await import('../index.js');
    expect(typeof components.table).toBe('function');
    expect(typeof components.badge).toBe('function');
    expect(typeof box).toBe('function');
  });

  it('imports images helpers', async () => {
    const { images, clearAnsiCache } = await import('../index.js');
    expect(typeof images.render).toBe('function');
    expect(typeof images.sprite).toBe('function');
    clearAnsiCache();
  });

  it('imports trees namespace', async () => {
    const { trees } = await import('../index.js');
    expect(typeof trees.tree).toBe('function');
    expect(typeof trees.render).toBe('function');
    expect(typeof trees.walk).toBe('function');
    expect(typeof trees.find).toBe('function');
    expect(typeof trees.count).toBe('function');
    expect(typeof trees.map).toBe('function');
    expect(typeof trees.filter).toBe('function');
  });

  it('imports terminal width/height helpers', async () => {
    const {
      getTerminalWidth, getTerminalHeight,
      supportsColor, supportsColorLevel, resetColorSupportCache,
    } = await import('../index.js');

    expect(typeof getTerminalWidth()).toBe('number');
    expect(typeof getTerminalHeight()).toBe('number');
    expect(typeof supportsColor()).toBe('string');
    expect(typeof supportsColorLevel()).toBe('number');
    resetColorSupportCache();
  });

  it('imports OutputBuffer', async () => {
    const { createOutputBuffer } = await import('../index.js');
    const buf = createOutputBuffer();
    buf.push('a').pushln('b').pushIf(true, 'c').reset().push('d');
    expect(buf.length()).toBe(1);
    expect(buf.flush()).toBe(true);
  });

  it('imports sleep + writeAsync + sleepFrame + FRAME_MS', async () => {
    const { sleep, writeAsync, sleepFrame, FRAME_MS } = await import('../index.js');
    await sleep(0);
    await sleepFrame(0);
    await writeAsync('');
    expect(typeof FRAME_MS).toBe('number');
  });
});

// ─────────────────────────────────────────────
//  Coverage: every named re-export from src/index.ts
//
//  The barrel re-exports many functions. Each named arrow function
//  counts as a separate function for Jest coverage. This block
//  invokes every named re-export at least once.
// ─────────────────────────────────────────────
describe('barrel coverage — every named re-export', () => {
  it('colors re-exports — presetNames, chain, colorLevel, stripAnsiColors', async () => {
    const {
      presetNames, chain, colorLevel, stripAnsiColors,
    } = await import('../index.js');

    expect(Array.isArray(presetNames)).toBe(true);
    expect(presetNames.length).toBeGreaterThan(0);

    // chain — fluent style builder (methods are functions, not getters)
    const c = chain().red().bold();
    expect(typeof c.apply).toBe('function');
    expect(typeof c.apply('test')).toBe('string');

    // colorLevel — function returning numeric support level (0-3)
    expect(typeof colorLevel()).toBe('number');

    expect(typeof stripAnsiColors('\x1b[31mhi\x1b[0m')).toBe('string');
  });

  it('animations re-exports — canAnimate, resetCursorRefCount', async () => {
    const { canAnimate, resetCursorRefCount } = await import('../index.js');
    expect(typeof canAnimate()).toBe('boolean');
    resetCursorRefCount();
  });

  it('loaders re-exports — resetLoaderCursorCount', async () => {
    const { resetLoaderCursorCount } = await import('../index.js');
    expect(typeof resetLoaderCursorCount).toBe('function');
    resetLoaderCursorCount();
  });

  it('trees re-exports — renderTreeStream, measureTree', async () => {
    const { tree, renderTreeStream, measureTree } = await import('../index.js');
    const t = tree('root');
    t.add('child');

    // Generator
    const gen = renderTreeStream(t);
    const first = gen.next();
    expect(typeof first.value).toBe('string');

    // Measure
    const dim = measureTree(t);
    expect(dim.width).toBeGreaterThan(0);
    expect(dim.height).toBeGreaterThan(0);
  });

  it('configure re-exports — onConfigChange, getConfigValue', async () => {
    const { onConfigChange, getConfigValue } = await import('../index.js');

    const off = onConfigChange(() => { /* noop */ });
    off();

    expect(getConfigValue('theme')).toBeDefined();
    expect(getConfigValue('colorMode')).toBeDefined();
  });

  it('ansi re-exports — writeErr, writelnErr, hideCursor, showCursor', async () => {
    const { writeErr, writelnErr, hideCursor, showCursor } = await import('../index.js');

    // These write to stderr / stdout — just verify they exist + return boolean
    expect(typeof writeErr).toBe('function');
    expect(typeof writelnErr).toBe('function');
    expect(typeof hideCursor).toBe('function');
    expect(typeof showCursor).toBe('function');

    // Invoke them harmlessly (writes are best-effort, no-op without TTY)
    writeErr('');
    writelnErr('');
    // showCursor + hideCursor are reference-counted, balanced calls
    hideCursor();
    showCursor();
  });

  it('ansi re-exports — fg256, bg256, ESC, CSI, FG, BG, STYLE', async () => {
    const { fg256, bg256, ESC, CSI, FG, BG, STYLE } = await import('../index.js');

    expect(fg256(15)).toContain('38;5;15');
    expect(bg256(15)).toContain('48;5;15');
    expect(ESC).toBe('\x1b');
    expect(CSI).toBe('\x1b[');
    expect(FG.red).toBe(31);
    expect(BG.red).toBe(41);
    expect(STYLE.bold).toBe(1);
  });

  it('utils re-exports — stripAnsiCodes alias', async () => {
    const { stripAnsiCodes } = await import('../index.js');
    expect(stripAnsiCodes('\x1b[31mhi\x1b[0m')).toBe('hi');
  });

  it('default export is the ansimax namespace', async () => {
    const mod = await import('../index.js');
    expect(mod.default).toBeDefined();
  });
});

// ─────────────────────────────────────────────
//  v1.2.0 — Phase 2 additions in barrel
// ─────────────────────────────────────────────
import { animateGradient } from '../index.js';
import type {
  EasingName, EasingFn,
  AnimateGradientOptions, AnimateGradientController,
} from '../index.js';

describe('v1.2.0 barrel exports', () => {
  it('animateGradient is exported from main entry', () => {
    expect(typeof animateGradient).toBe('function');
  });

  it('animateGradient returns a working controller', () => {
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
    });
    expect(ctrl).toBeDefined();
    expect(typeof ctrl.stop).toBe('function');
    expect(ctrl.done).toBeInstanceOf(Promise);
    ctrl.stop();
  });

  it('exports Phase 2 types (compile-time check)', () => {
    // These references force TS to resolve the type exports
    const _easings: EasingName[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier'];
    const _custom: EasingFn = (t) => t;
    const _opts: AnimateGradientOptions = { duration: 100 };
    const _ctrl: AnimateGradientController | null = null;
    // Runtime smoke
    expect(_easings.length).toBe(5);
    expect(_custom(0.5)).toBe(0.5);
    expect(_opts.duration).toBe(100);
    expect(_ctrl).toBeNull();
  });
});


// ─────────────────────────────────────────────
//  Coverage: barrel exercise for v1.3.x re-exports
// ─────────────────────────────────────────────
//
//  Many symbols are re-exported from index.ts but never imported by the
//  module-specific tests (which import directly from src/<module>/index.js).
//  These tests exercise the barrel re-export lines so coverage reflects
//  their use.
// ─────────────────────────────────────────────

describe('barrel coverage — re-exports', () => {
  it('reverseGradient is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.reverseGradient).toBe('function');
    // Smoke: reverseGradient flips an array of stops
    const reversed = main.reverseGradient(['#000000', '#ffffff']);
    expect(Array.isArray(reversed)).toBe(true);
    expect(reversed.length).toBe(2);
    expect(reversed[0]).toBe('#ffffff');
  });

  it('figletText, parseFiglet, fromImage are exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.figletText).toBe('function');
    expect(typeof main.parseFiglet).toBe('function');
    expect(typeof main.fromImage).toBe('function');
  });

  it('ASCII_RAMPS is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.ASCII_RAMPS).toBe('object');
    expect(main.ASCII_RAMPS).not.toBeNull();
  });

  it('panels exports are accessible from main barrel (v1.3.0–v1.3.3)', async () => {
    const main = await import('../index.js');
    // v1.3.0
    expect(typeof main.panels).toBe('object');
    expect(typeof main.vsplit).toBe('function');
    expect(typeof main.hsplit).toBe('function');
    // v1.3.1 (centerBlock = panels.center renamed at barrel)
    expect(typeof main.centerBlock).toBe('function');
    expect(typeof main.frame).toBe('function');
    // v1.3.3
    expect(typeof main.grid).toBe('function');
  });

  it('centerBlock from barrel === panels.center', async () => {
    const main = await import('../index.js');
    // Same function, just exposed under a non-conflicting name at the barrel
    const r1 = main.centerBlock('X', { width: 5 });
    const r2 = main.panels.center('X', { width: 5 });
    expect(r1).toBe(r2);
  });

  it('grid from barrel produces same output as panels.grid', async () => {
    const main = await import('../index.js');
    const r1 = main.grid(['A', 'B', 'C', 'D'], { columns: 2 });
    const r2 = main.panels.grid(['A', 'B', 'C', 'D'], { columns: 2 });
    expect(r1).toBe(r2);
  });

  it('json + jsonPretty are exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.json).toBe('object');
    expect(typeof main.jsonPretty).toBe('function');
    // jsonPretty is the same as json.pretty
    expect(main.jsonPretty({ a: 1 })).toBe(main.json.pretty({ a: 1 }));
  });
});

// ─────────────────────────────────────────────
//  Coverage: barrel exercise for v1.3.4 additions
// ─────────────────────────────────────────────

describe('barrel coverage — v1.3.4 re-exports', () => {
  it('setConfigValue + subscribeConfig are exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.setConfigValue).toBe('function');
    expect(typeof main.subscribeConfig).toBe('function');
  });

  it('hyperlink + clearLine are exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.hyperlink).toBe('function');
    expect(typeof main.clearLine).toBe('function');
    // Smoke: hyperlink produces OSC 8 wrapper
    const result = main.hyperlink('https://example.com', 'link');
    expect(result).toContain('https://example.com');
    expect(result).toContain('link');
    // Smoke: clearLine produces expected escape sequence
    expect(main.clearLine()).toBe('\x1b[2K\r');
  });

  it('gradientStops + escapeForRegex + measureBlock are exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.gradientStops).toBe('function');
    expect(typeof main.escapeForRegex).toBe('function');
    expect(typeof main.measureBlock).toBe('function');
    // Smoke: gradientStops produces valid hex array
    const stops = main.gradientStops('#ff0000', '#0000ff', 3);
    expect(stops.length).toBe(3);
    expect(stops[0]).toBe('#ff0000');
    expect(stops[2]).toBe('#0000ff');
    // Smoke: escapeForRegex escapes meta chars
    expect(main.escapeForRegex('a.b')).toBe('a\\.b');
    // Smoke: measureBlock returns dimensions
    expect(main.measureBlock('hello')).toEqual({ width: 5, height: 1 });
  });
});

// ─────────────────────────────────────────────
//  Coverage: barrel exercise for v1.3.5 additions
// ─────────────────────────────────────────────

describe('barrel coverage — v1.3.5 re-exports', () => {
  it('numeric helpers exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.isFiniteNumber).toBe('function');
    expect(typeof main.safeInt).toBe('function');
    expect(typeof main.clampByte).toBe('function');
    // Smoke tests
    expect(main.isFiniteNumber(42)).toBe(true);
    expect(main.safeInt('abc', 99)).toBe(99);
    expect(main.clampByte(300)).toBe(255);
  });

  it('color space functions exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.rgbToHsl).toBe('function');
    expect(typeof main.hslToRgb).toBe('function');
    expect(typeof main.rgbToOklab).toBe('function');
    expect(typeof main.oklabToRgb).toBe('function');
    // Smoke: HSL roundtrip for red
    const hsl = main.rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(1);
    // Oklab smoke
    const o = main.rgbToOklab({ r: 0, g: 0, b: 0 });
    expect(o.L).toBeCloseTo(0, 2);
  });

  it('mixColors + quantizeColor exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.mixColors).toBe('function');
    expect(typeof main.quantizeColor).toBe('function');
    // Smoke
    const m = main.mixColors('#ff0000', '#0000ff', 0.5);
    expect(m).toEqual({ r: 128, g: 0, b: 128 });
    const q = main.quantizeColor({ r: 0, g: 0, b: 0 }, 4);
    expect(q).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('easings + resolveEasingByName exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.easings).toBe('object');
    expect(typeof main.easings.linear).toBe('function');
    expect(typeof main.easings.easeInOutCubic).toBe('function');
    expect(typeof main.resolveEasingByName).toBe('function');
    // Smoke — strongly typed (Record<EasingName, ...>) so no optional chaining needed
    expect(main.easings.linear(0.5)).toBe(0.5);
    expect(main.resolveEasingByName('linear')).toBe(main.easings.linear);
  });
});
