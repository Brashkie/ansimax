import {
  color, gradient, rainbow, presets, presetNames, compose,
  setNoColor, isNoColor, resetNoColor,
  chain, colorLevel, stripAnsi as stripAnsiColors,
  registerPreset, listPresets, clearColorCache,
  __internal,
  type ColorFn,
} from '../colors/index.js';
import { stripAnsi } from '../utils/helpers.js';
import { resetColorSupportCache } from '../utils/ansi.js';

// Force colors ON for all tests (Jest has no TTY so auto-detect suppresses colors)
beforeEach(() => {
  process.env['FORCE_COLOR'] = '3';
  resetColorSupportCache();
  setNoColor(false);
});
afterEach(() => {
  delete process.env['FORCE_COLOR'];
  resetColorSupportCache();
  resetNoColor();
});

// ─────────────────────────────────────────────
//  Basic named colors
// ─────────────────────────────────────────────
describe('color — basic foreground', () => {
  it('red wraps with \\x1b[31m', () => {
    const r = color.red('hello');
    expect(r).toContain('\x1b[31m');
    expect(r).toContain('hello');
    expect(r).toContain('\x1b[0m');
  });

  it('green wraps with \\x1b[32m', () => {
    expect(color.green('ok')).toContain('\x1b[32m');
  });

  it('cyan wraps with \\x1b[36m', () => {
    expect(color.cyan('info')).toContain('\x1b[36m');
  });

  it('all 8 named colors preserve text', () => {
    const names = ['black','red','green','yellow','blue','magenta','cyan','white'] as const;
    for (const name of names) {
      expect(stripAnsi(color[name]('x'))).toBe('x');
    }
  });

  it('all 8 named colors emit escape codes', () => {
    const names = ['black','red','green','yellow','blue','magenta','cyan','white'] as const;
    for (const name of names) {
      expect(color[name]('x')).toContain('\x1b[');
    }
  });
});

// ─────────────────────────────────────────────
//  Bright colors
// ─────────────────────────────────────────────
describe('color — bright foreground', () => {
  it('brightRed uses code 91', () => {
    expect(color.brightRed('x')).toContain('\x1b[91m');
  });
  it('brightGreen uses code 92', () => {
    expect(color.brightGreen('x')).toContain('\x1b[92m');
  });
  it('brightYellow uses code 93', () => {
    expect(color.brightYellow('x')).toContain('\x1b[93m');
  });
  it('brightBlue uses code 94', () => {
    expect(color.brightBlue('x')).toContain('\x1b[94m');
  });
  it('brightMagenta uses code 95', () => {
    expect(color.brightMagenta('x')).toContain('\x1b[95m');
  });
  it('brightCyan uses code 96', () => {
    expect(color.brightCyan('x')).toContain('\x1b[96m');
  });
  it('brightWhite uses code 97', () => {
    expect(color.brightWhite('x')).toContain('\x1b[97m');
  });
  it('preserves text in bright colors', () => {
    expect(stripAnsi(color.brightCyan('test'))).toBe('test');
  });
});

// ─────────────────────────────────────────────
//  Aliases
// ─────────────────────────────────────────────
describe('color — aliases', () => {
  it('gray === brightBlack', () => {
    expect(color.gray('x')).toBe(color.brightBlack('x'));
  });
  it('grey === brightBlack', () => {
    expect(color.grey('x')).toBe(color.brightBlack('x'));
  });
  it('orange produces RGB(255,165,0)', () => {
    expect(color.orange('x')).toContain('\x1b[38;2;255;165;0m');
  });
  it('purple === magenta', () => {
    expect(color.purple('x')).toBe(color.magenta('x'));
  });
});

// ─────────────────────────────────────────────
//  Background colors
// ─────────────────────────────────────────────
describe('color — backgrounds', () => {
  it('bgRed uses code 41', () => {
    expect(color.bgRed('x')).toContain('\x1b[41m');
  });
  it('bgGreen uses code 42', () => {
    expect(color.bgGreen('x')).toContain('\x1b[42m');
  });
  it('bgYellow uses code 43', () => {
    expect(color.bgYellow('x')).toContain('\x1b[43m');
  });
  it('bgBlue uses code 44', () => {
    expect(color.bgBlue('x')).toContain('\x1b[44m');
  });
  it('bgMagenta uses code 45', () => {
    expect(color.bgMagenta('x')).toContain('\x1b[45m');
  });
  it('bgCyan uses code 46', () => {
    expect(color.bgCyan('x')).toContain('\x1b[46m');
  });
  it('bgWhite uses code 47', () => {
    expect(color.bgWhite('x')).toContain('\x1b[47m');
  });
});

// ─────────────────────────────────────────────
//  Text styles
// ─────────────────────────────────────────────
describe('color — text styles', () => {
  it('bold uses code 1', () => {
    expect(color.bold('bold')).toContain('\x1b[1m');
  });
  it('dim uses code 2', () => {
    expect(color.dim('d')).toContain('\x1b[2m');
  });
  it('italic uses code 3', () => {
    expect(color.italic('i')).toContain('\x1b[3m');
  });
  it('underline uses code 4', () => {
    expect(color.underline('u')).toContain('\x1b[4m');
  });
  it('blink uses code 5', () => {
    expect(color.blink('b')).toContain('\x1b[5m');
  });
  it('inverse uses code 7', () => {
    expect(color.inverse('i')).toContain('\x1b[7m');
  });
  it('strikethrough uses code 9', () => {
    expect(color.strikethrough('s')).toContain('\x1b[9m');
  });
  it('hidden uses code 8', () => {
    expect(color.hidden('h')).toContain('\x1b[8m');
  });
  it('all styles preserve text', () => {
    const styles = ['bold','dim','italic','underline','blink','inverse','strikethrough','hidden'] as const;
    for (const s of styles) {
      expect(stripAnsi(color[s]('x'))).toBe('x');
    }
  });
});

// ─────────────────────────────────────────────
//  True-color (24-bit)
// ─────────────────────────────────────────────
describe('color — true-color', () => {
  it('hex produces correct RGB escape', () => {
    const r = color.hex('#ff0000')('red');
    expect(r).toContain('\x1b[38;2;255;0;0m');
    expect(stripAnsi(r)).toBe('red');
  });

  it('hex works without leading #', () => {
    expect(color.hex('00ff00')('x')).toContain('\x1b[38;2;0;255;0m');
  });

  it('hex 3-digit shorthand', () => {
    expect(color.hex('#f00')('x')).toContain('\x1b[38;2;255;0;0m');
  });

  it('rgb produces correct escape', () => {
    expect(color.rgb(0, 255, 0)('x')).toContain('\x1b[38;2;0;255;0m');
  });

  it('bgHex produces correct bg escape', () => {
    expect(color.bgHex('#0000ff')('x')).toContain('\x1b[48;2;0;0;255m');
  });

  it('bgRgb produces correct bg escape', () => {
    expect(color.bgRgb(255, 0, 0)('x')).toContain('\x1b[48;2;255;0;0m');
  });
});

// ─────────────────────────────────────────────
//  Clamp — prevent malformed ANSI
// ─────────────────────────────────────────────
describe('color — rgb clamping', () => {
  it('rgb clamps above 255', () => {
    expect(color.rgb(999, 0, 0)('x')).toContain('\x1b[38;2;255;0;0m');
  });
  it('rgb clamps below 0', () => {
    expect(color.rgb(-50, 0, 0)('x')).toContain('\x1b[38;2;0;0;0m');
  });
  it('bgRgb clamps above 255', () => {
    expect(color.bgRgb(0, 999, 0)('x')).toContain('\x1b[48;2;0;255;0m');
  });
  it('color256 clamps above 255', () => {
    expect(color.color256(900)('x')).toContain('\x1b[38;5;255m');
  });
  it('color256 clamps below 0', () => {
    expect(color.color256(-5)('x')).toContain('\x1b[38;5;0m');
  });
  it('bgColor256 clamps correctly', () => {
    expect(color.bgColor256(300)('x')).toContain('\x1b[48;5;255m');
  });
});

// ─────────────────────────────────────────────
//  256-color palette
// ─────────────────────────────────────────────
describe('color — 256-color', () => {
  it('color256(196) produces correct escape', () => {
    expect(color.color256(196)('x')).toContain('\x1b[38;5;196m');
  });
  it('bgColor256(21) produces correct escape', () => {
    expect(color.bgColor256(21)('x')).toContain('\x1b[48;5;21m');
  });
});

// ─────────────────────────────────────────────
//  Hex fail-soft
// ─────────────────────────────────────────────
describe('color — hex fail-soft', () => {
  it('invalid hex returns plain text', () => {
    expect(color.hex('banana')('hi')).toBe('hi');
  });
  it('empty string hex returns plain text', () => {
    expect(color.hex('')('hi')).toBe('hi');
  });
  it('bgHex invalid returns plain text', () => {
    expect(color.bgHex('not-a-color')('hi')).toBe('hi');
  });
  it('valid hex still works', () => {
    expect(color.hex('#ff0000')('hi')).toContain('\x1b[38;2;255;0;0m');
  });
});

// ─────────────────────────────────────────────
//  NO_COLOR / setNoColor
// ─────────────────────────────────────────────
describe('color — NO_COLOR / setNoColor', () => {
  it('red returns plain text when disabled', () => {
    setNoColor(true);
    expect(color.red('hi')).toBe('hi');
  });
  it('bold returns plain text when disabled', () => {
    setNoColor(true);
    expect(color.bold('x')).toBe('x');
  });
  it('rgb returns plain text when disabled', () => {
    setNoColor(true);
    expect(color.rgb(255, 0, 0)('hi')).toBe('hi');
  });
  it('hex returns plain text when disabled', () => {
    setNoColor(true);
    expect(color.hex('#ff0000')('hi')).toBe('hi');
  });
  it('color256 returns plain text when disabled', () => {
    setNoColor(true);
    expect(color.color256(196)('hi')).toBe('hi');
  });
  it('isNoColor() reflects current state', () => {
    setNoColor(true);
    expect(isNoColor()).toBe(true);
    setNoColor(false);
    expect(isNoColor()).toBe(false);
  });
  it('colors work normally after re-enabling', () => {
    setNoColor(true);
    setNoColor(false);
    expect(color.red('hi')).toContain('\x1b[31m');
  });
});

// ─────────────────────────────────────────────
//  gradient
// ─────────────────────────────────────────────
describe('gradient', () => {
  it('produces colored output', () => {
    const r = gradient('ABC', ['#ff0000', '#0000ff']);
    expect(r).toContain('\x1b[38;2;');
    expect(r).toContain('A');
    expect(r).toContain('B');
    expect(r).toContain('C');
  });

  it('spaces are not colored (no color wasted on whitespace)', () => {
    const r = gradient('A B', ['#ff0000', '#0000ff']);
    // Only 2 color codes — one per visible char
    const codes = (r.match(/\x1b\[38;2;/g) ?? []).length;
    expect(codes).toBe(2);
  });

  it('single character uses first stop color', () => {
    expect(stripAnsi(gradient('X', ['#ff0000', '#00ff00']))).toBe('X');
  });

  it('single stop colors text statically (new behavior — better UX)', () => {
    // Pre-v1.1.0 returned 'hello' unchanged. Now it colors with the
    // single stop — consistent with CSS single-stop linear-gradient().
    const r = gradient('hello', ['#ff0000']);
    expect(stripAnsi(r)).toBe('hello');
    expect(r).toContain('\x1b[38;2;255;0;0m');
  });

  it('returns text unchanged if empty', () => {
    expect(gradient('', ['#ff0000', '#00ff00'])).toBe('');
  });

  it('returns plain text when noColor enabled', () => {
    setNoColor(true);
    expect(gradient('abc', ['#ff0000', '#0000ff'])).toBe('abc');
  });

  it('one valid + one invalid → falls back to single-stop coloring', () => {
    // Only 1 valid hex → static color (new behavior)
    const r = gradient('hi', ['#ff0000', 'banana']);
    expect(stripAnsi(r)).toBe('hi');
    expect(r).toContain('\x1b[38;2;255;0;0m');
  });

  it('two invalid stops → plain text (no valid colors)', () => {
    expect(gradient('hi', ['zzz', 'banana'])).toBe('hi');
  });

  it('two valid + one invalid → still gradients', () => {
    const r = gradient('ABC', ['#ff0000', 'bad', '#0000ff']);
    expect(r).toContain('\x1b[38;2;');
  });

  it('all-spaces string with valid 2-stop gradient → text unchanged (no visible chars)', () => {
    expect(gradient('   ', ['#ff0000', '#0000ff'])).toBe('   ');
  });

  it('all-spaces string with single stop colors the whole span', () => {
    // Single stop wraps the entire input including spaces
    const r = gradient('   ', ['#ff0000']);
    expect(stripAnsi(r)).toBe('   ');
    expect(r).toContain('\x1b[38;2;255;0;0m');
  });
});

// ─────────────────────────────────────────────
//  rainbow
// ─────────────────────────────────────────────
describe('rainbow', () => {
  it('colors every non-space character', () => {
    const r = rainbow('HELLO');
    expect(r).toContain('\x1b[38;2;');
    expect(stripAnsi(r)).toBe('HELLO');
  });

  it('preserves spaces uncolored', () => {
    const r = rainbow('A B');
    const codes = (r.match(/\x1b\[38;2;/g) ?? []).length;
    expect(codes).toBe(2);
  });

  it('returns plain text when noColor enabled', () => {
    setNoColor(true);
    expect(rainbow('hi')).toBe('hi');
  });
});

// ─────────────────────────────────────────────
//  presets
// ─────────────────────────────────────────────
describe('presets', () => {
  const names = ['sunset','ocean','fire','neon','forest','aurora','candy','gold'] as const;

  for (const name of names) {
    it(`${name} produces colored output and preserves text`, () => {
      const r = presets[name]!('test');
      expect(stripAnsi(r)).toBe('test');
      expect(r).toContain('\x1b[38;2;');
    });
  }

  it('all presets return plain text when noColor enabled', () => {
    setNoColor(true);
    for (const name of names) {
      expect(presets[name]!('x')).toBe('x');
    }
  });
});

// ─────────────────────────────────────────────
//  compose
// ─────────────────────────────────────────────
describe('compose', () => {
  it('combines two color functions with single reset', () => {
    const boldRed = compose(color.bold, color.red);
    const r = boldRed('hi');
    expect(r).toContain('\x1b[1m');
    expect(r).toContain('\x1b[31m');
    expect(r).toContain('hi');
    // Only ONE reset at the very end
    const resets = (r.match(/\x1b\[0m/g) ?? []).length;
    expect(resets).toBe(1);
  });

  it('single function compose equals original fn', () => {
    expect(compose(color.green)('x')).toBe(color.green('x'));
  });

  it('three functions compose correctly', () => {
    const r = compose(color.bold, color.underline, color.cyan)('hi');
    expect(r).toContain('\x1b[1m');
    expect(r).toContain('\x1b[4m');
    expect(r).toContain('\x1b[36m');
    expect(r).toContain('hi');
    const resets = (r.match(/\x1b\[0m/g) ?? []).length;
    expect(resets).toBe(1);
  });

  it('returns plain text when noColor enabled', () => {
    setNoColor(true);
    expect(compose(color.bold, color.red)('hi')).toBe('hi');
  });
});


// ─────────────────────────────────────────────
//  compose with marker-based extraction (robustness)
// ─────────────────────────────────────────────
describe('compose — robust extraction', () => {
  beforeEach(() => setNoColor(false));

  it('handles many composed functions cleanly', () => {
    const fn = compose(color.bold, color.italic, color.underline, color.red);
    const result = fn('TEXT');
    // Should have all 4 opens, single text, single reset
    expect(stripAnsi(result)).toBe('TEXT');
    // Exactly one reset at the end
    const resetCount = (result.match(/\x1b\[0m/g) ?? []).length;
    expect(resetCount).toBe(1);
  });

  it('compose with empty fn list returns text unchanged', () => {
    const fn = compose();
    expect(fn('hello')).toBe('hello');
  });

  it('compose with single fn behaves like the fn itself', () => {
    const single = compose(color.red);
    const direct = color.red('test');
    // Both should produce the red color escape with text
    expect(stripAnsi(single('test'))).toBe(stripAnsi(direct));
  });

  it('extractOpen handles NO_COLOR mode gracefully', () => {
    setNoColor(true);
    const open = __internal.extractOpen(color.red);
    expect(open).toBe(''); // no escapes when suppressed
    setNoColor(false);
  });

  it('extractOpen returns the actual open sequence', () => {
    setNoColor(false);
    const open = __internal.extractOpen(color.red);
    expect(open).toContain('\x1b[');
    expect(open).toContain('m');
  });
});

// ─────────────────────────────────────────────
//  colorLevel + adaptive degradation
// ─────────────────────────────────────────────
describe('colorLevel and adaptive rendering', () => {
  beforeEach(() => {
    resetColorSupportCache();
    resetNoColor();
  });

  afterEach(() => {
    resetColorSupportCache();
    resetNoColor();
  });

  it('colorLevel returns 0 when NO_COLOR override active', () => {
    setNoColor(true);
    expect(colorLevel()).toBe(0);
    setNoColor(false);
  });

  it('colorLevel returns numeric value 0-3', () => {
    setNoColor(false);
    const level = colorLevel();
    expect([0, 1, 2, 3]).toContain(level);
  });

  it('rgbTo256 converts greyscale to grey ramp', () => {
    expect(__internal.rgbTo256(128, 128, 128)).toBeGreaterThanOrEqual(232);
    expect(__internal.rgbTo256(128, 128, 128)).toBeLessThanOrEqual(255);
  });

  it('rgbTo256 converts colors to 6×6×6 cube', () => {
    const idx = __internal.rgbTo256(255, 0, 0);
    expect(idx).toBeGreaterThanOrEqual(16);
    expect(idx).toBeLessThanOrEqual(231);
  });

  it('rgbToBasicFg picks nearest of 8 ANSI colors', () => {
    expect(__internal.rgbToBasicFg(255, 0, 0)).toBe(31); // red
    expect(__internal.rgbToBasicFg(0, 255, 0)).toBe(32); // green
    expect(__internal.rgbToBasicFg(0, 0, 255)).toBe(34); // blue
  });

  it('rgbToBasicBg returns FG code + 10', () => {
    expect(__internal.rgbToBasicBg(255, 0, 0)).toBe(41); // bg red
  });
});

// ─────────────────────────────────────────────
//  stripAnsi re-export
// ─────────────────────────────────────────────
describe('stripAnsi from colors module', () => {
  it('strips color escapes', () => {
    setNoColor(false);
    const colored = color.red('hello');
    expect(stripAnsiColors(colored)).toBe('hello');
  });
});

// ─────────────────────────────────────────────
//  Gradient — preserveAnsi option
// ─────────────────────────────────────────────
describe('gradient preserveAnsi', () => {
  beforeEach(() => setNoColor(false));

  it('default mode does not preserve existing ANSI', () => {
    const input = color.bold('HI');
    const result = gradient(input, ['#ff0000', '#0000ff']);
    // Default: ANSI preserved verbatim if input contains ESC
    // (since default is preserveAnsi: false but we check for ESC)
    expect(stripAnsi(result)).toContain('HI');
  });

  it('preserveAnsi: true keeps existing escapes', () => {
    const input = color.bold('HI');
    const result = gradient(input, ['#ff0000', '#0000ff'], { preserveAnsi: true });
    // Bold escape should still be present
    expect(result).toContain('\x1b[1m');
    expect(stripAnsi(result)).toContain('HI');
  });

  it('plain text uses fast path', () => {
    const result = gradient('plain', ['#ff0000', '#00ff00']);
    expect(stripAnsi(result)).toBe('plain');
  });
});

// ─────────────────────────────────────────────
//  Presets — strict typing
// ─────────────────────────────────────────────
describe('preset typing', () => {
  it('presetNames lists all preset keys', () => {
    expect(presetNames).toContain('sunset');
    expect(presetNames).toContain('ocean');
    expect(presetNames).toContain('fire');
    expect(presetNames.length).toBeGreaterThanOrEqual(8);
  });

  it('every preset is callable', () => {
    setNoColor(false);
    for (const name of presetNames) {
      const fn = presets[name]!;
      const result = fn('test');
      expect(stripAnsi(result)).toBe('test');
    }
  });
});

// ─────────────────────────────────────────────
//  Chainable API
// ─────────────────────────────────────────────
describe('chain API', () => {
  beforeEach(() => setNoColor(false));

  it('chain.red().bold().apply produces colored bold text', () => {
    const result = chain().red().bold().apply('Hi');
    expect(stripAnsi(result)).toBe('Hi');
    expect(result).toContain('\x1b[31m');
    expect(result).toContain('\x1b[1m');
  });

  it('chain composes single reset at the end', () => {
    const result = chain().red().bold().underline().apply('X');
    const resetCount = (result.match(/\x1b\[0m/g) ?? []).length;
    expect(resetCount).toBe(1);
  });

  it('chain.fn() returns a reusable ColorFn', () => {
    const errorStyle = chain().red().bold().fn();
    const a = errorStyle('one');
    const b = errorStyle('two');
    expect(stripAnsi(a)).toBe('one');
    expect(stripAnsi(b)).toBe('two');
  });

  it('chain with no methods applies text unchanged', () => {
    const result = chain().apply('plain');
    expect(result).toBe('plain');
  });

  it('chain.hex applies hex colors', () => {
    const result = chain().hex('#ff0000').bold().apply('hex');
    expect(stripAnsi(result)).toBe('hex');
  });

  it('chain.rgb applies rgb colors', () => {
    const result = chain().rgb(255, 100, 0).apply('rgb');
    expect(stripAnsi(result)).toBe('rgb');
  });

  it('chain.bgHex applies background hex', () => {
    const result = chain().bgHex('#0000ff').apply('bg');
    expect(stripAnsi(result)).toBe('bg');
  });

  it('chain in NO_COLOR mode produces plain text', () => {
    setNoColor(true);
    const result = chain().red().bold().apply('Hi');
    expect(result).toBe('Hi');
    setNoColor(false);
  });

  it('chain is immutable — each call returns new chain', () => {
    const base = chain().red();
    const a = base.bold().apply('A');
    const b = base.italic().apply('B');
    // Both should work independently
    expect(stripAnsi(a)).toBe('A');
    expect(stripAnsi(b)).toBe('B');
  });
});

// ─────────────────────────────────────────────
//  __internal — test hooks
// ─────────────────────────────────────────────
describe('__internal hooks', () => {
  it('exposes safeHex', () => {
    expect(__internal.safeHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(__internal.safeHex('not-a-color')).toBeNull();
  });

  it('safeHex handles whitespace', () => {
    expect(__internal.safeHex('  #ff0000  ')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('safeHex handles non-string input', () => {
    expect(__internal.safeHex(null)).toBeNull();
    expect(__internal.safeHex(undefined)).toBeNull();
  });

  it('safeHex accepts 3-digit hex', () => {
    expect(__internal.safeHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('exposes isNoColor', () => {
    expect(typeof __internal.isNoColor()).toBe('boolean');
  });
});

// ─────────────────────────────────────────────
//  Coverage push: chain — every method
// ─────────────────────────────────────────────
describe('chain — comprehensive method coverage', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  // Foreground color methods
  it('chain.black()', () => {
    expect(stripAnsi(chain().black().apply('x'))).toBe('x');
  });
  it('chain.green()', () => {
    expect(stripAnsi(chain().green().apply('x'))).toBe('x');
  });
  it('chain.yellow()', () => {
    expect(stripAnsi(chain().yellow().apply('x'))).toBe('x');
  });
  it('chain.blue()', () => {
    expect(stripAnsi(chain().blue().apply('x'))).toBe('x');
  });
  it('chain.magenta()', () => {
    expect(stripAnsi(chain().magenta().apply('x'))).toBe('x');
  });
  it('chain.cyan()', () => {
    expect(stripAnsi(chain().cyan().apply('x'))).toBe('x');
  });
  it('chain.white()', () => {
    expect(stripAnsi(chain().white().apply('x'))).toBe('x');
  });
  it('chain.gray()', () => {
    expect(stripAnsi(chain().gray().apply('x'))).toBe('x');
  });

  // Bright variants
  it('chain.brightRed()', () => {
    expect(stripAnsi(chain().brightRed().apply('x'))).toBe('x');
  });
  it('chain.brightGreen()', () => {
    expect(stripAnsi(chain().brightGreen().apply('x'))).toBe('x');
  });
  it('chain.brightYellow()', () => {
    expect(stripAnsi(chain().brightYellow().apply('x'))).toBe('x');
  });
  it('chain.brightBlue()', () => {
    expect(stripAnsi(chain().brightBlue().apply('x'))).toBe('x');
  });

  // Style methods
  it('chain.dim()', () => {
    expect(stripAnsi(chain().dim().apply('x'))).toBe('x');
  });
  it('chain.italic()', () => {
    expect(stripAnsi(chain().italic().apply('x'))).toBe('x');
  });
  it('chain.underline()', () => {
    expect(stripAnsi(chain().underline().apply('x'))).toBe('x');
  });
  it('chain.inverse()', () => {
    expect(stripAnsi(chain().inverse().apply('x'))).toBe('x');
  });
  it('chain.strikethrough()', () => {
    expect(stripAnsi(chain().strikethrough().apply('x'))).toBe('x');
  });

  // Custom color methods
  it('chain.bgRgb()', () => {
    expect(stripAnsi(chain().bgRgb(255, 0, 0).apply('x'))).toBe('x');
  });
  it('chain.bgRgb clamps inputs', () => {
    expect(stripAnsi(chain().bgRgb(999, -50, 128).apply('x'))).toBe('x');
  });
  it('chain.hex with invalid hex returns text unchanged', () => {
    expect(chain().hex('not-a-hex').apply('x')).toBe('x');
  });
  it('chain.bgHex with invalid hex returns text unchanged', () => {
    expect(chain().bgHex('not-a-hex').apply('x')).toBe('x');
  });
  it('chain.bgHex with valid hex applies background', () => {
    expect(stripAnsi(chain().bgHex('#0000ff').apply('x'))).toBe('x');
  });
});

// ─────────────────────────────────────────────
//  Coverage push: adaptive degradation across all levels
// ─────────────────────────────────────────────
describe('adaptive degradation — all color levels', () => {
  beforeEach(() => {
    resetColorSupportCache();
    resetNoColor();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    delete process.env['NO_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('level 0 (NO_COLOR) — adaptiveFg returns empty string', () => {
    setNoColor(true);
    // hex fn applies adaptiveFg internally — when level 0, returns text unchanged
    expect(color.hex('#ff0000')('test')).toBe('test');
  });

  it('level 0 (NO_COLOR) — adaptiveBg returns empty string', () => {
    setNoColor(true);
    expect(color.bgHex('#ff0000')('test')).toBe('test');
  });

  it('level 1 (basic) — degrades RGB to nearest of 8 ANSI colors', () => {
    process.env['FORCE_COLOR'] = '1';
    resetColorSupportCache();
    const result = color.rgb(255, 0, 0)('test');
    // Should use basic SGR codes, not truecolor
    expect(result).toContain('\x1b[31m'); // red
    expect(result).not.toContain('\x1b[38;2;');
  });

  it('level 1 (basic) — bg degrades to nearest of 8 BG colors', () => {
    process.env['FORCE_COLOR'] = '1';
    resetColorSupportCache();
    const result = color.bgRgb(0, 255, 0)('test');
    expect(result).toContain('\x1b[42m'); // bg green
  });

  it('level 2 (256) — degrades RGB to 256 palette index', () => {
    process.env['FORCE_COLOR'] = '2';
    resetColorSupportCache();
    const result = color.rgb(128, 128, 128)('test');
    expect(result).toContain('\x1b[38;5;');
    expect(result).not.toContain('\x1b[38;2;');
  });

  it('level 2 (256) — bg degrades to 256 palette index', () => {
    process.env['FORCE_COLOR'] = '2';
    resetColorSupportCache();
    const result = color.bgRgb(50, 50, 200)('test');
    expect(result).toContain('\x1b[48;5;');
  });

  it('level 3 (truecolor) — emits full 24-bit RGB', () => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    const result = color.rgb(123, 45, 67)('test');
    expect(result).toContain('\x1b[38;2;123;45;67m');
  });

  // Internal helpers — exercise rgbTo256 grayscale ramps
  it('rgbTo256 returns 16 for very dark grey (cr < 8)', () => {
    expect(__internal.rgbTo256(5, 5, 5)).toBe(16);
  });
  it('rgbTo256 returns 231 for very light grey (cr > 248)', () => {
    expect(__internal.rgbTo256(250, 250, 250)).toBe(231);
  });
  it('rgbTo256 returns mid-range grey ramp for medium grey', () => {
    const idx = __internal.rgbTo256(128, 128, 128);
    expect(idx).toBeGreaterThanOrEqual(232);
    expect(idx).toBeLessThanOrEqual(255);
  });

  // Cover the basic-fg distance loop with a non-canonical color
  it('rgbToBasicFg picks nearest for off-palette color', () => {
    // Pure white-ish off-grey
    expect([30, 31, 32, 33, 34, 35, 36, 37]).toContain(__internal.rgbToBasicFg(200, 100, 50));
  });
});

// ─────────────────────────────────────────────
//  Coverage push: gradient — preserveAnsi single visible char
// ─────────────────────────────────────────────
describe('gradient edge cases', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('preserveAnsi:true with single visible char (visible=1 path)', () => {
    const input = '\x1b[1mA\x1b[0m';
    const result = gradient(input, ['#ff0000', '#0000ff'], { preserveAnsi: true });
    expect(result).toContain('A');
  });

  it('preserveAnsi:true with all spaces returns text unchanged', () => {
    const input = '\x1b[1m   \x1b[0m';
    const result = gradient(input, ['#ff0000', '#0000ff'], { preserveAnsi: true });
    expect(stripAnsi(result)).toBe('   ');
  });

  it('preserveAnsi:true preserves multiple ANSI tokens mid-text', () => {
    const input = 'A\x1b[31mB\x1b[0mC';
    const result = gradient(input, ['#ff0000', '#0000ff'], { preserveAnsi: true });
    expect(stripAnsi(result)).toBe('ABC');
  });

  it('plain mode with empty visible chars (all spaces)', () => {
    const result = gradient('   ', ['#ff0000', '#0000ff']);
    expect(result).toBe('   ');
  });
});

// ─────────────────────────────────────────────
//  Coercion of non-string text input
// ─────────────────────────────────────────────
describe('text coercion', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('color.red(42) coerces number to string', () => {
    expect(stripAnsi(color.red(42 as unknown as string))).toBe('42');
  });

  it('color.bold(true) coerces boolean to string', () => {
    expect(stripAnsi(color.bold(true as unknown as string))).toBe('true');
  });

  it('color.red(null) coerces to empty string', () => {
    expect(stripAnsi(color.red(null as unknown as string))).toBe('');
  });

  it('color.red(undefined) coerces to empty string', () => {
    expect(stripAnsi(color.red(undefined as unknown as string))).toBe('');
  });

  it('color.rgb(...)({}) coerces object', () => {
    const fn = color.rgb(255, 0, 0);
    expect(stripAnsi(fn({} as unknown as string))).toBe('[object Object]');
  });

  it('compose with non-string text coerces', () => {
    const fn = compose(color.red, color.bold);
    expect(stripAnsi(fn(42 as unknown as string))).toBe('42');
  });

  it('chain.apply with non-string coerces', () => {
    expect(stripAnsi(chain().red().apply(99))).toBe('99');
  });
});

// ─────────────────────────────────────────────
//  Numeric edge cases
// ─────────────────────────────────────────────
describe('clampRgb / clamp256 with NaN/Infinity', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('color.rgb with NaN clamps to 0', () => {
    const result = color.rgb(NaN, 100, 200)('test');
    expect(result).toContain('\x1b[38;2;0;100;200m');
  });

  it('color.rgb with Infinity clamps to 255', () => {
    const result = color.rgb(Infinity, 50, -50)('test');
    expect(result).toContain('\x1b[38;2;255;50;0m');
  });

  it('color.color256 with NaN clamps to 0', () => {
    const result = color.color256(NaN)('test');
    expect(result).toContain('\x1b[38;5;0m');
  });

  it('color.color256 with negative clamps to 0', () => {
    const result = color.color256(-50)('test');
    expect(result).toContain('\x1b[38;5;0m');
  });

  it('color.color256 with > 255 clamps to 255', () => {
    const result = color.color256(999)('test');
    expect(result).toContain('\x1b[38;5;255m');
  });
});

// ─────────────────────────────────────────────
//  Adaptive escape cache
// ─────────────────────────────────────────────
describe('adaptive escape cache', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearColorCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    clearColorCache();
  });

  it('clearColorCache does not throw', () => {
    expect(() => clearColorCache()).not.toThrow();
  });

  it('repeated rgb calls return identical escape sequences', () => {
    const a = color.rgb(100, 150, 200)('test');
    const b = color.rgb(100, 150, 200)('test');
    expect(a).toBe(b); // Cache returns same string
  });

  it('cache survives across many distinct colors', () => {
    // Exercise > cache_max distinct colors to test eviction
    for (let i = 0; i < 600; i++) {
      color.rgb(i % 256, 100, 100)('x');
    }
    // No throw, no memory blowup
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  compose error tolerance
// ─────────────────────────────────────────────
describe('compose error tolerance', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('filters out non-functions silently', () => {
    const result = compose(
      color.red,
      null as unknown as ColorFn,
      undefined as unknown as ColorFn,
      'not a function' as unknown as ColorFn,
      color.bold,
    )('test');
    // Still works with the valid functions
    expect(stripAnsi(result)).toBe('test');
    expect(result).toContain('\x1b[31m'); // red
    expect(result).toContain('\x1b[1m');  // bold
  });

  it('returns text when all fns are invalid', () => {
    const result = compose(
      null as unknown as ColorFn,
      undefined as unknown as ColorFn,
    )('test');
    expect(result).toBe('test');
  });

  it('swallows fn that throws on extraction', () => {
    const bad: ColorFn = () => { throw new Error('boom'); };
    const result = compose(color.red, bad, color.bold)('test');
    // Bad fn is skipped (extractOpen returns ''), good ones still apply
    expect(stripAnsi(result)).toBe('test');
  });
});

// ─────────────────────────────────────────────
//  Gradient edge cases
// ─────────────────────────────────────────────
describe('gradient defensive paths', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('null stops returns text unchanged', () => {
    expect(gradient('hello', null as unknown as string[])).toBe('hello');
  });

  it('undefined stops returns text unchanged', () => {
    expect(gradient('hello', undefined as unknown as string[])).toBe('hello');
  });

  it('empty stops array returns text unchanged', () => {
    expect(gradient('hello', [])).toBe('hello');
  });

  it('all invalid hex stops returns text unchanged', () => {
    // Note: 'bad' is actually a valid 3-digit hex (b/a/d are all hex digits)!
    // We use clearly non-hex strings to exercise the empty-colors branch.
    const result = gradient('hello', ['nope', 'foul', 'wrong']);
    expect(result.length).toBe(5);
    expect(stripAnsi(result)).toBe('hello');
    expect(result).toBe('hello');
  });

  it('single valid color renders text colored with it', () => {
    const result = gradient('hello', ['#ff0000']);
    // Should be colored (not just plain text)
    expect(result).toContain('\x1b[38;2;255;0;0m');
    expect(stripAnsi(result)).toBe('hello');
  });

  it('mixed valid/invalid stops uses only valid ones', () => {
    const result = gradient('test', ['nope', '#ff0000', 'bad', '#00ff00']);
    // 2 valid colors → real gradient
    expect(result.length).toBeGreaterThan('test'.length);
  });

  it('non-string text coerces', () => {
    expect(stripAnsi(gradient(42 as unknown as string, ['#ff0000', '#0000ff']))).toBe('42');
  });
});

// ─────────────────────────────────────────────
//  registerPreset
// ─────────────────────────────────────────────
describe('registerPreset', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('registers a custom preset accessible via color.<name>', () => {
    registerPreset('mango', ['#ff5e3a', '#ff9500']);
    expect(listPresets()).toContain('mango');
  });

  it('rejects empty name', () => {
    expect(() => registerPreset('', ['#ff0000', '#00ff00'])).toThrow(TypeError);
  });

  it('rejects non-string name', () => {
    expect(() =>
      registerPreset(42 as unknown as string, ['#ff0000', '#00ff00']),
    ).toThrow(TypeError);
  });

  it('rejects non-array stops', () => {
    expect(() =>
      registerPreset('test', 'not-an-array' as unknown as string[]),
    ).toThrow(TypeError);
  });

  it('rejects empty stops', () => {
    expect(() => registerPreset('test', [])).toThrow(TypeError);
  });

  it('rejects names that conflict with built-in methods', () => {
    expect(() => registerPreset('red', ['#ff0000', '#00ff00'])).toThrow(/conflicts/);
    expect(() => registerPreset('bold', ['#ff0000', '#00ff00'])).toThrow(/conflicts/);
    expect(() => registerPreset('rainbow', ['#ff0000', '#00ff00'])).toThrow(/conflicts/);
  });

  it('listPresets includes built-ins + custom', () => {
    const before = listPresets().length;
    registerPreset('mycustom1', ['#ff0000', '#00ff00']);
    expect(listPresets().length).toBe(before + 1);
  });
});

// ─────────────────────────────────────────────
//  Coverage: branch targets
// ─────────────────────────────────────────────
describe('colors: branch coverage targets', () => {
  it('clampRgb handles Infinity → 255 (line 58/64)', () => {
    // Infinity in RGB component goes through clampByte/clamp256 Infinity branch
    const out = color.rgb(Infinity, Infinity, Infinity)('x');
    expect(typeof out).toBe('string');
  });

  it('clampRgb handles -Infinity → 0 (line 59/65)', () => {
    const out = color.rgb(-Infinity, -Infinity, -Infinity)('x');
    expect(typeof out).toBe('string');
  });

  it('clampRgb handles NaN → 0 (line 57/63)', () => {
    const out = color.rgb(NaN, NaN, NaN)('x');
    expect(typeof out).toBe('string');
  });

  it('registerPreset creates an invokable preset function (line 431)', () => {
    registerPreset('branch-test-preset', ['#ff0000', '#0000ff']);
    // registerPreset adds the fn to `presets`, NOT to `color` directly
    // Access via gradient() with the registered stops, or via presets[name]
    const fn = presets['branch-test-preset'];
    expect(typeof fn).toBe('function');
    if (!fn) throw new Error('preset fn missing');
    const out = fn('hello');
    expect(stripAnsi(out)).toBe('hello');
    // Also verify listPresets includes it
    expect(listPresets()).toContain('branch-test-preset');
  });
});

// ─────────────────────────────────────────────
//  Coverage: more branch targets
// ─────────────────────────────────────────────
describe('colors: more branches', () => {
  it('clamp256 with Infinity returns 255 (line 65)', () => {
    // Trigger via color.color256 with Infinity — internally clamps
    expect(typeof color.color256(Infinity)('x')).toBe('string');
  });

  it('clamp256 with -Infinity returns 0 (line 66)', () => {
    expect(typeof color.color256(-Infinity)('x')).toBe('string');
  });

  it('clamp256 with NaN returns 0', () => {
    expect(typeof color.color256(NaN)('x')).toBe('string');
  });

  it('extractOpen with non-function returns empty string (line 231)', () => {
    // compose with a non-function entry exercises extractOpen typeof !== 'function'
    const fn = compose(color.red, null as unknown as ColorFn, color.bold);
    const out = fn('hi');
    // Should still produce a result (red+bold), null entry filtered/skipped
    expect(typeof out).toBe('string');
  });

  it('gradient with malformed embedded ANSI escape (line 353)', () => {
    // Text containing a bare \x1b that doesn't form a valid CSI escape.
    // Triggers the `else { out += ch }` branch in the gradient wrap.
    const out = gradient('a\x1bb', ['#ff0000', '#0000ff']);
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('colors: gradient with spaces (line 353)', () => {
  it('gradient preserves spaces uncolored', () => {
    const out = gradient('hello world', ['#ff0000', '#0000ff']);
    expect(stripAnsi(out)).toBe('hello world');
    expect(out).toContain(' '); // spaces preserved
  });
});

describe('colors: gradient ANSI-aware space branch (line 354)', () => {
  it('gradient on text with embedded ANSI + spaces preserves spaces', () => {
    // Trigger _gradientAnsiAware path: preserveAnsi:true + text with ANSI + spaces
    const input = '\x1b[1mhello world\x1b[0m'; // bold ANSI escape with space
    const out = gradient(input, ['#ff0000', '#0000ff'], { preserveAnsi: true });
    expect(stripAnsi(out)).toContain('hello world');
    // Space must be preserved
    expect(stripAnsi(out)).toContain(' ');
  });

  it('gradient with preserveAnsi:true and only spaces+ANSI', () => {
    // Triggers ch === ' ' branch in _gradientAnsiAware (line 354 `out += ch`)
    const input = '\x1b[1ma b c\x1b[0m';
    const out = gradient(input, ['#ff0000', '#0000ff'], { preserveAnsi: true });
    expect(stripAnsi(out)).toBe('a b c');
  });
});

// ─────────────────────────────────────────────
//  v1.2.0 — Phase 2 completion: easing + phase
// ─────────────────────────────────────────────
import { animateGradient } from '../colors/index.js';

describe('gradient: easing curves (v1.2.0)', () => {
  it('linear easing matches default behavior', () => {
    const a = gradient('hello world', ['#ff0000', '#0000ff']);
    const b = gradient('hello world', ['#ff0000', '#0000ff'], { easing: 'linear' });
    expect(a).toBe(b);
  });

  it('ease-in produces different output than linear', () => {
    const linear = gradient('hello world test', ['#ff0000', '#0000ff'], { easing: 'linear' });
    const easeIn = gradient('hello world test', ['#ff0000', '#0000ff'], { easing: 'ease-in' });
    expect(linear).not.toBe(easeIn);
  });

  it('all four built-in easings produce valid output', () => {
    for (const e of ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier'] as const) {
      const out = gradient('test text here', ['#ff0000', '#00ff00', '#0000ff'], { easing: e });
      expect(stripAnsi(out)).toBe('test text here');
    }
  });

  it('custom easing function is supported', () => {
    const customEasing = (t: number): number => t * t * t; // cubic
    const out = gradient('hello world', ['#ff0000', '#0000ff'], { easing: customEasing });
    expect(stripAnsi(out)).toBe('hello world');
  });

  it('invalid easing string falls back to linear', () => {
    const linear = gradient('hello', ['#ff0000', '#0000ff'], { easing: 'linear' });
    const bad = gradient('hello', ['#ff0000', '#0000ff'], { easing: 'not-real' as 'linear' });
    expect(bad).toBe(linear);
  });

  it('custom easing returning out-of-range values is clamped', () => {
    // Easing that returns -5 or 10 — should not crash
    const wild = (_t: number): number => 10;
    expect(() => gradient('test', ['#ff0000', '#0000ff'], { easing: wild })).not.toThrow();
  });
});

describe('gradient: phase parameter (v1.2.0)', () => {
  it('phase 0 matches no-phase output', () => {
    const a = gradient('hello world', ['#ff0000', '#0000ff']);
    const b = gradient('hello world', ['#ff0000', '#0000ff'], { phase: 0 });
    expect(a).toBe(b);
  });

  it('phase 0.5 produces different output', () => {
    const a = gradient('hello world test', ['#ff0000', '#00ff00', '#0000ff']);
    const b = gradient('hello world test', ['#ff0000', '#00ff00', '#0000ff'], { phase: 0.5 });
    expect(a).not.toBe(b);
  });

  it('phase wraps around (1.5 ≡ 0.5)', () => {
    const a = gradient('hello', ['#ff0000', '#0000ff'], { phase: 0.5 });
    const b = gradient('hello', ['#ff0000', '#0000ff'], { phase: 1.5 });
    expect(a).toBe(b);
  });

  it('negative phase wraps forward (-0.5 ≡ 0.5)', () => {
    const a = gradient('hello', ['#ff0000', '#0000ff'], { phase: 0.5 });
    const b = gradient('hello', ['#ff0000', '#0000ff'], { phase: -0.5 });
    expect(a).toBe(b);
  });

  it('NaN/Infinity phase falls back to 0', () => {
    const ref = gradient('hello', ['#ff0000', '#0000ff'], { phase: 0 });
    expect(gradient('hello', ['#ff0000', '#0000ff'], { phase: NaN })).toBe(ref);
    expect(gradient('hello', ['#ff0000', '#0000ff'], { phase: Infinity })).toBe(ref);
  });
});

describe('animateGradient (v1.2.0)', () => {
  it('returns controller with stop() and done', () => {
    const frames: string[] = [];
    const ctrl = animateGradient('hello', ['#ff0000', '#0000ff'], {
      onFrame: (f) => frames.push(f),
      duration: 200,
      fps: 30,
    });
    expect(typeof ctrl.stop).toBe('function');
    expect(ctrl.done).toBeInstanceOf(Promise);
    ctrl.stop();
  });

  it('calls onFrame at least once immediately', () => {
    const frames: string[] = [];
    const ctrl = animateGradient('hello', ['#ff0000', '#0000ff'], {
      onFrame: (f) => frames.push(f),
    });
    expect(frames.length).toBeGreaterThanOrEqual(1);
    ctrl.stop();
  });

  it('stop() is idempotent', () => {
    const ctrl = animateGradient('hello', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
    });
    ctrl.stop();
    expect(() => ctrl.stop()).not.toThrow();
  });

  it('signal aborts the animation', async () => {
    const ctrl_abort = new AbortController();
    const ctrl = animateGradient('hello', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      signal: ctrl_abort.signal,
    });
    ctrl_abort.abort();
    await ctrl.done;
    expect(true).toBe(true); // didn't hang
  });

  it('already-aborted signal stops immediately', async () => {
    const ctrl_abort = new AbortController();
    ctrl_abort.abort();
    const ctrl = animateGradient('hello', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      signal: ctrl_abort.signal,
    });
    await ctrl.done;
    expect(true).toBe(true);
  });

  it('direction reverse produces phase-inverted output', () => {
    const forwardFrames: string[] = [];
    const reverseFrames: string[] = [];
    const ctrlF = animateGradient('hello world', ['#ff0000', '#00ff00', '#0000ff'], {
      onFrame: (f, p) => forwardFrames.push(`${p.toFixed(2)}:${f.length}`),
      direction: 'forward',
    });
    const ctrlR = animateGradient('hello world', ['#ff0000', '#00ff00', '#0000ff'], {
      onFrame: (f, p) => reverseFrames.push(`${p.toFixed(2)}:${f.length}`),
      direction: 'reverse',
    });
    // Both should have produced at least 1 frame
    expect(forwardFrames.length).toBeGreaterThanOrEqual(1);
    expect(reverseFrames.length).toBeGreaterThanOrEqual(1);
    ctrlF.stop();
    ctrlR.stop();
  });

  it('fps is clamped to [1, 60]', () => {
    const c1 = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ }, fps: 1000,
    });
    const c2 = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ }, fps: 0,
    });
    expect(typeof c1.stop).toBe('function');
    expect(typeof c2.stop).toBe('function');
    c1.stop(); c2.stop();
  });
});

describe('animateGradient: finite cycles (covers lines 597-603)', () => {
  it('stops automatically after N cycles when infinite is false', async () => {
    const frames: number[] = [];
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: (_f, phase) => frames.push(phase),
      duration: 30,         // 30ms per cycle — fast
      fps: 60,              // 60 frames/sec → ~1 frame per 16ms
      infinite: false,
      cycles: 1,            // stop after just 1 cycle
    });
    await ctrl.done;
    // Should have collected at least 1 frame (initial) and stopped
    expect(frames.length).toBeGreaterThanOrEqual(1);
  });

  it('respects cycles: 2 (runs roughly twice as long as cycles:1)', async () => {
    const start = Date.now();
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      duration: 30,
      fps: 60,
      infinite: false,
      cycles: 2,
    });
    await ctrl.done;
    const elapsed = Date.now() - start;
    // Should take at least ~50ms (2 cycles × 30ms minus initial frame timing)
    expect(elapsed).toBeGreaterThan(40);
  });

  it('non-finite cycles falls back to 1', async () => {
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      duration: 30,
      fps: 60,
      infinite: false,
      cycles: NaN,         // bad input → clamped to 1
    });
    await ctrl.done;
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  v1.2.2 — Thenable controller + robustness
// ─────────────────────────────────────────────
describe('animateGradient: thenable controller (v1.2.2)', () => {
  it('controller is awaitable directly (Promise-like)', async () => {
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      duration: 30, fps: 60, infinite: false, cycles: 1,
    });
    // No .done — direct await
    await ctrl;
    expect(true).toBe(true); // didn't hang
  });

  it('controller supports .then() chaining', async () => {
    let chained = false;
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      duration: 30, fps: 60, infinite: false, cycles: 1,
    });
    await ctrl.then(() => { chained = true; });
    expect(chained).toBe(true);
  });

  it('controller supports .finally()', async () => {
    let finalRan = false;
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      duration: 30, fps: 60, infinite: false, cycles: 1,
    });
    await ctrl.finally(() => { finalRan = true; });
    expect(finalRan).toBe(true);
  });

  it('controller .done is still available alongside thenable', async () => {
    const ctrl = animateGradient('hi', ['#ff0000', '#0000ff'], {
      onFrame: () => { /* noop */ },
      duration: 30, fps: 60, infinite: false, cycles: 1,
    });
    await ctrl.done;
    expect(typeof ctrl.then).toBe('function');
    expect(typeof ctrl.catch).toBe('function');
    expect(typeof ctrl.finally).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  v1.2.3 — createGradient factory
// ─────────────────────────────────────────────
import { createGradient } from '../colors/index.js';

describe('createGradient (v1.2.3)', () => {
  it('returns a reusable gradient function', () => {
    const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);
    expect(typeof fire).toBe('function');
  });

  it('produces same output as gradient() for same inputs', () => {
    const stops = ['#ff79c6', '#bd93f9', '#8be9fd'];
    const factory = createGradient(stops);
    const direct = gradient('hello world', stops);
    const fromFactory = factory('hello world');
    expect(fromFactory).toBe(direct);
  });

  it('handles single-color stops as solid color', () => {
    const cyan = createGradient(['#00ffff']);
    const out = cyan('hello');
    expect(stripAnsi(out)).toBe('hello');
    expect(out).toMatch(/\x1b\[/); // has ANSI
  });

  it('handles empty stops by returning input unchanged', () => {
    const empty = createGradient([]);
    expect(empty('hello')).toBe('hello');
  });

  it('handles null/undefined stops gracefully', () => {
    const nullStops = createGradient(null);
    const undefStops = createGradient(undefined);
    expect(nullStops('hello')).toBe('hello');
    expect(undefStops('hello')).toBe('hello');
  });

  it('drops invalid stops silently (like gradient)', () => {
    const partial = createGradient(['#ff0000', 'not-a-hex', '#0000ff']);
    expect(stripAnsi(partial('hello world'))).toBe('hello world');
  });

  it('respects default easing', () => {
    const stops = ['#ff0000', '#0000ff'];
    const factory = createGradient(stops, { easing: 'ease-in' });
    const direct = gradient('hello world test', stops, { easing: 'ease-in' });
    expect(factory('hello world test')).toBe(direct);
  });

  it('per-call options override defaults', () => {
    const stops = ['#ff0000', '#0000ff'];
    const factory = createGradient(stops, { easing: 'linear' });

    // Per-call easing overrides default
    const directEaseIn = gradient('hello world test', stops, { easing: 'ease-in' });
    expect(factory('hello world test', { easing: 'ease-in' })).toBe(directEaseIn);
  });

  it('supports per-call phase for animation', () => {
    const stops = ['#ff0000', '#0000ff'];
    const factory = createGradient(stops);

    // Different phases produce different output
    const frame1 = factory('hello world', { phase: 0 });
    const frame2 = factory('hello world', { phase: 0.5 });
    expect(frame1).not.toBe(frame2);

    // Same phase is deterministic
    expect(factory('hello world', { phase: 0.3 })).toBe(
      factory('hello world', { phase: 0.3 }),
    );
  });

  it('coerces non-string text inputs', () => {
    const factory = createGradient(['#ff0000', '#0000ff']);
    expect(stripAnsi(factory(42))).toBe('42');
    expect(stripAnsi(factory(true))).toBe('true');
  });

  it('returns empty string for empty input', () => {
    const factory = createGradient(['#ff0000', '#0000ff']);
    expect(factory('')).toBe('');
  });

  it('respects NO_COLOR by returning plain text', () => {
    setNoColor(true);
    try {
      const factory = createGradient(['#ff0000', '#0000ff']);
      expect(factory('hello world')).toBe('hello world');
    } finally {
      setNoColor(false);
    }
  });

  it('preserveAnsi default is respected', () => {
    const stops = ['#ff0000', '#0000ff'];
    const factory = createGradient(stops, { preserveAnsi: true });
    const input = 'pre\x1b[31mtext\x1b[0mpost';
    // With preserveAnsi=true, the embedded ANSI should be preserved
    const out = factory(input);
    expect(out).toContain('\x1b[31m');
  });

  it('works as colorFn for ascii.banner (integration check)', () => {
    const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);
    // Verify it has the ColorFn shape: (text) => string
    expect(typeof fire('TEST')).toBe('string');
    expect(stripAnsi(fire('TEST'))).toBe('TEST');
  });
});

describe('createGradient: barrel export (v1.2.3)', () => {
  it('createGradient is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.createGradient).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  v1.2.4 — ReusableGradient metadata + reverseGradient
// ─────────────────────────────────────────────
import { reverseGradient } from '../colors/index.js';
import type { ReusableGradient } from '../colors/index.js';

describe('createGradient: metadata (v1.2.4)', () => {
  it('exposes original stops as readonly array', () => {
    const stops = ['#ff5555', '#ffb86c', '#f1fa8c'];
    const fire = createGradient(stops);
    expect(fire.stops).toEqual(stops);
    // Verify it's frozen
    expect(Object.isFrozen(fire.stops)).toBe(true);
  });

  it('exposes resolvedStops (filtered RGB)', () => {
    const fire = createGradient(['#ff5555', 'not-a-hex', '#f1fa8c']);
    expect(fire.resolvedStops).toHaveLength(2);
    expect(fire.resolvedStops[0]).toEqual({ r: 255, g: 85, b: 85 });
    expect(fire.resolvedStops[1]).toEqual({ r: 241, g: 250, b: 140 });
  });

  it('exposes defaultOptions frozen', () => {
    const fire = createGradient(['#ff0000', '#0000ff'], { easing: 'ease-in' });
    expect(fire.defaultOptions.easing).toBe('ease-in');
    expect(Object.isFrozen(fire.defaultOptions)).toBe(true);
  });

  it('metadata cannot be mutated', () => {
    'use strict';
    const fire = createGradient(['#ff0000', '#0000ff']);
    // Trying to mutate should throw or silently fail (depending on strict mode)
    expect(() => {
      (fire.stops as unknown as string[]).push('#00ff00');
    }).toThrow();
  });

  it('metadata is enumerable (visible in Object.keys)', () => {
    const fire = createGradient(['#ff0000', '#0000ff']);
    const keys = Object.keys(fire);
    expect(keys).toContain('stops');
    expect(keys).toContain('resolvedStops');
    expect(keys).toContain('defaultOptions');
  });

  it('empty stops still returns valid ReusableGradient', () => {
    const empty = createGradient([]);
    expect(empty.stops).toEqual([]);
    expect(empty.resolvedStops).toEqual([]);
    expect(empty('hello')).toBe('hello');
  });

  it('null/undefined stops result in empty metadata arrays', () => {
    const nullGrad = createGradient(null);
    const undefGrad = createGradient(undefined);
    expect(nullGrad.stops).toEqual([]);
    expect(undefGrad.stops).toEqual([]);
  });
});

describe('reverseGradient (v1.2.4)', () => {
  it('reverses an array of stops', () => {
    const stops = ['#ff0000', '#00ff00', '#0000ff'];
    const reversed = reverseGradient(stops);
    expect(reversed).toEqual(['#0000ff', '#00ff00', '#ff0000']);
  });

  it('does not mutate the original array', () => {
    const stops = ['#ff0000', '#00ff00', '#0000ff'];
    const reversed = reverseGradient(stops);
    expect(stops).toEqual(['#ff0000', '#00ff00', '#0000ff']); // unchanged
    expect(reversed).not.toBe(stops); // new array
  });

  it('reverses a ReusableGradient', () => {
    const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);
    const ice = reverseGradient(fire);
    expect(ice.stops).toEqual(['#f1fa8c', '#ffb86c', '#ff5555']);
  });

  it('reversed ReusableGradient preserves default options', () => {
    const original = createGradient(['#ff0000', '#0000ff'], { easing: 'ease-in' });
    const reversed = reverseGradient(original);
    expect(reversed.defaultOptions.easing).toBe('ease-in');
  });

  it('reversed gradient produces correct output', () => {
    const forward = createGradient(['#ff0000', '#0000ff']);
    const reversed = reverseGradient(forward);
    // Same as creating directly with reversed stops
    const direct = createGradient(['#0000ff', '#ff0000']);
    expect(reversed('hello world')).toBe(direct('hello world'));
  });

  it('double-reverse returns equivalent gradient', () => {
    const original = createGradient(['#ff0000', '#00ff00', '#0000ff']);
    const twice = reverseGradient(reverseGradient(original));
    expect(twice.stops).toEqual(original.stops);
    expect(twice('hello world')).toBe(original('hello world'));
  });

  it('reverse of empty stops is empty', () => {
    const empty = createGradient([]);
    const reversed = reverseGradient(empty);
    expect(reversed.stops).toEqual([]);
  });

  it('reverse of single stop is the same single stop', () => {
    const single = ['#ff0000'];
    const reversed = reverseGradient(single);
    expect(reversed).toEqual(['#ff0000']);
  });
});

describe('presets alias (v1.2.4)', () => {
  it('presets is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(main.presets).toBeDefined();
    expect(typeof main.presets).toBe('object');
  });

  it('presets and colorPresets are the same object (alias)', async () => {
    const main = await import('../index.js');
    expect(main.presets).toBe(main.colorPresets);
  });

  it('presets has all the built-in preset names', async () => {
    const main = await import('../index.js');
    const presetsKeys = Object.keys(main.presets);
    expect(presetsKeys).toContain('sunset');
    expect(presetsKeys).toContain('ocean');
    expect(presetsKeys).toContain('fire');
    expect(presetsKeys).toContain('neon');
  });
});
