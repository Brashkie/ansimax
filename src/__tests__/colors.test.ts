import { color, gradient, rainbow, presets, compose, setNoColor, isNoColor, resetNoColor } from '../colors/index.js';
import { stripAnsi } from '../utils/helpers.js';

// Force colors ON for all tests (Jest has no TTY so auto-detect suppresses colors)
beforeEach(() => setNoColor(false));
// Restore auto-detect after each test
afterEach(() => resetNoColor());

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

  it('returns text unchanged with fewer than 2 stops', () => {
    expect(gradient('hello', ['#ff0000'])).toBe('hello');
  });

  it('returns text unchanged if empty', () => {
    expect(gradient('', ['#ff0000', '#00ff00'])).toBe('');
  });

  it('returns plain text when noColor enabled', () => {
    setNoColor(true);
    expect(gradient('abc', ['#ff0000', '#0000ff'])).toBe('abc');
  });

  it('filters out invalid hex stops gracefully', () => {
    // 'banana' is invalid → only 1 valid stop → returns plain text
    expect(gradient('hi', ['#ff0000', 'banana'])).toBe('hi');
  });

  it('two invalid stops → plain text', () => {
    expect(gradient('hi', ['zzz', 'banana'])).toBe('hi');
  });

  it('two valid + one invalid → still gradients', () => {
    const r = gradient('ABC', ['#ff0000', 'bad', '#0000ff']);
    expect(r).toContain('\x1b[38;2;');
  });

  it('all-spaces string → plain text', () => {
    expect(gradient('   ', ['#ff0000', '#0000ff'])).toBe('   ');
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
      const r = presets[name]('test');
      expect(stripAnsi(r)).toBe('test');
      expect(r).toContain('\x1b[38;2;');
    });
  }

  it('all presets return plain text when noColor enabled', () => {
    setNoColor(true);
    for (const name of names) {
      expect(presets[name]('x')).toBe('x');
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