import {
  isHexColor, truncateAnsi, repeatVisible, rgbTo256,
  clamp, lerp, hexToRgb, rgbToHex, lerpColor,
  stripAnsi, visibleLen, padEnd, padStart, center, wordWrap,
} from '../utils/helpers.js';

describe('clamp', () => {
  it('returns value when within range', () => expect(clamp(5, 0, 10)).toBe(5));
  it('clamps to min', () => expect(clamp(-5, 0, 10)).toBe(0));
  it('clamps to max', () => expect(clamp(15, 0, 10)).toBe(10));
  it('handles boundary min', () => expect(clamp(0, 0, 10)).toBe(0));
  it('handles boundary max', () => expect(clamp(10, 0, 10)).toBe(10));
});

describe('lerp', () => {
  it('returns a at t=0', () => expect(lerp(0, 100, 0)).toBe(0));
  it('returns b at t=1', () => expect(lerp(0, 100, 1)).toBe(100));
  it('returns midpoint at t=0.5', () => expect(lerp(0, 100, 0.5)).toBe(50));
  it('works with negative values', () => expect(lerp(-10, 10, 0.5)).toBe(0));
});

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('parses 3-digit hex shorthand', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('parses without hash', () => {
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });
  it('parses white', () => {
    expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('parses black', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('parses mid-range values', () => {
    expect(hexToRgb('#4ecdc4')).toEqual({ r: 78, g: 205, b: 196 });
  });
});

describe('rgbToHex', () => {
  it('converts red', () => expect(rgbToHex(255, 0, 0)).toBe('#ff0000'));
  it('converts white', () => expect(rgbToHex(255, 255, 255)).toBe('#ffffff'));
  it('converts black', () => expect(rgbToHex(0, 0, 0)).toBe('#000000'));
  it('pads single-digit hex', () => expect(rgbToHex(0, 1, 15)).toBe('#00010f'));
  it('round-trips with hexToRgb', () => {
    const hex = '#1a2b3c';
    const { r, g, b } = hexToRgb(hex);
    expect(rgbToHex(r, g, b)).toBe(hex);
  });
});

describe('lerpColor', () => {
  it('returns first color at t=0', () => {
    expect(lerpColor({ r:255,g:0,b:0 }, { r:0,g:0,b:255 }, 0)).toEqual({ r:255, g:0, b:0 });
  });
  it('returns second color at t=1', () => {
    expect(lerpColor({ r:255,g:0,b:0 }, { r:0,g:0,b:255 }, 1)).toEqual({ r:0, g:0, b:255 });
  });
  it('blends at midpoint', () => {
    const result = lerpColor({ r:0,g:0,b:0 }, { r:100,g:100,b:100 }, 0.5);
    expect(result).toEqual({ r:50, g:50, b:50 });
  });
});

describe('stripAnsi', () => {
  it('removes escape sequences', () => {
    expect(stripAnsi('\x1b[31mhello\x1b[0m')).toBe('hello');
  });
  it('removes multiple sequences', () => {
    expect(stripAnsi('\x1b[1m\x1b[36mtest\x1b[0m')).toBe('test');
  });
  it('leaves plain text unchanged', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });
  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });
  it('removes 24-bit color sequences', () => {
    expect(stripAnsi('\x1b[38;2;255;0;0mred\x1b[0m')).toBe('red');
  });
});

describe('visibleLen', () => {
  it('returns length of plain text', () => {
    expect(visibleLen('hello')).toBe(5);
  });
  it('ignores ANSI codes', () => {
    expect(visibleLen('\x1b[31mhello\x1b[0m')).toBe(5);
  });
  it('handles empty string', () => {
    expect(visibleLen('')).toBe(0);
  });
  it('handles unicode', () => {
    expect(visibleLen('café')).toBe(4);
  });
});

describe('padEnd', () => {
  it('pads short string', () => {
    expect(padEnd('hi', 5)).toBe('hi   ');
  });
  it('does not pad string at exact width', () => {
    expect(padEnd('hello', 5)).toBe('hello');
  });
  it('does not truncate long string', () => {
    expect(padEnd('toolong', 4)).toBe('toolong');
  });
  it('uses custom pad character', () => {
    expect(padEnd('x', 4, '-')).toBe('x---');
  });
  it('accounts for ANSI in visible length', () => {
    const colored = '\x1b[31mhi\x1b[0m'; // visible length = 2
    const result = padEnd(colored, 5);
    expect(visibleLen(result)).toBe(5);
  });
});

describe('padStart', () => {
  it('pads from start', () => {
    expect(padStart('hi', 5)).toBe('   hi');
  });
  it('does not pad at exact width', () => {
    expect(padStart('hello', 5)).toBe('hello');
  });
});

describe('center', () => {
  it('centers text in even space', () => {
    expect(center('hi', 6)).toBe('  hi  ');
  });
  it('centers text in odd space (left bias)', () => {
    const result = center('x', 4);
    expect(result.length).toBe(4);
    expect(result.includes('x')).toBe(true);
  });
  it('returns text unchanged if no padding needed', () => {
    expect(center('hello', 5)).toBe('hello');
  });
  it('returns text unchanged if width < text', () => {
    expect(center('hello', 3)).toBe('hello');
  });
});

describe('wordWrap', () => {
  it('wraps at word boundary', () => {
    const lines = wordWrap('hello world', 6);
    expect(lines).toEqual(['hello', 'world']);
  });
  it('does not wrap short text', () => {
    expect(wordWrap('hi', 10)).toEqual(['hi']);
  });
  it('handles multiple wraps', () => {
    const lines = wordWrap('one two three four', 8);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(8);
    }
  });
  it('handles empty string', () => {
    expect(wordWrap('', 10)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  isHexColor (new)
// ─────────────────────────────────────────────
describe('isHexColor', () => {
  it('accepts 6-digit hex with #', () => {
    expect(isHexColor('#ff0000')).toBe(true);
  });

  it('accepts 6-digit hex without #', () => {
    expect(isHexColor('ff0000')).toBe(true);
  });

  it('accepts 3-digit shorthand', () => {
    expect(isHexColor('#fff')).toBe(true);
    expect(isHexColor('abc')).toBe(true);
  });

  it('rejects invalid strings', () => {
    expect(isHexColor('banana')).toBe(false);
    expect(isHexColor('zzz')).toBe(false);
    expect(isHexColor('')).toBe(false);
    expect(isHexColor('#1234')).toBe(false);  // 4 digits
    expect(isHexColor('#1234567')).toBe(false); // 7 digits
  });

  it('handles whitespace', () => {
    expect(isHexColor('  #ff0000  ')).toBe(true);
  });

  it('rejects non-strings safely', () => {
    expect(isHexColor(null as unknown as string)).toBe(false);
    expect(isHexColor(undefined as unknown as string)).toBe(false);
    expect(isHexColor(123 as unknown as string)).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  hexToRgb — new fail-fast behavior
// ─────────────────────────────────────────────
describe('hexToRgb fail-fast', () => {
  it('throws on invalid hex string', () => {
    expect(() => hexToRgb('banana')).toThrow('Invalid hex color');
  });

  it('throws on empty string', () => {
    expect(() => hexToRgb('')).toThrow('Invalid hex color');
  });

  it('throws on partial hex', () => {
    expect(() => hexToRgb('#1234')).toThrow();
  });

  it('still parses valid 6-digit hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('still parses valid 3-digit shorthand', () => {
    expect(hexToRgb('#f00')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('parses without leading #', () => {
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('handles whitespace', () => {
    expect(hexToRgb('  #0000ff  ')).toEqual({ r: 0, g: 0, b: 255 });
  });
});

// ─────────────────────────────────────────────
//  rgbToHex — clamping
// ─────────────────────────────────────────────
describe('rgbToHex clamping', () => {
  it('clamps values above 255', () => {
    expect(rgbToHex(999, 0, 0)).toBe('#ff0000');
  });

  it('clamps negative values to 0', () => {
    expect(rgbToHex(-50, 100, 50)).toBe('#006432');
  });

  it('rounds float values', () => {
    expect(rgbToHex(127.7, 128.2, 64)).toBe('#808040');
  });

  it('produces valid hex for normal values', () => {
    expect(rgbToHex(255, 0, 128)).toBe('#ff0080');
  });
});

// ─────────────────────────────────────────────
//  lerpColor — clamps t
// ─────────────────────────────────────────────
describe('lerpColor t clamping', () => {
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };

  it('t=0 returns first color', () => {
    expect(lerpColor(black, white, 0)).toEqual(black);
  });

  it('t=1 returns second color', () => {
    expect(lerpColor(black, white, 1)).toEqual(white);
  });

  it('t=2 clamps to t=1 (no extrapolation)', () => {
    expect(lerpColor(black, white, 2)).toEqual(white);
  });

  it('t=-1 clamps to t=0', () => {
    expect(lerpColor(black, white, -1)).toEqual(black);
  });

  it('t=0.5 returns midpoint', () => {
    expect(lerpColor(black, white, 0.5)).toEqual({ r: 128, g: 128, b: 128 });
  });
});

// ─────────────────────────────────────────────
//  rgbTo256 — clamping
// ─────────────────────────────────────────────
describe('rgbTo256 clamping', () => {
  it('clamps above 255', () => {
    expect(rgbTo256(999, 0, 0)).toBeGreaterThanOrEqual(16);
    expect(rgbTo256(999, 0, 0)).toBeLessThanOrEqual(231);
  });

  it('handles grayscale', () => {
    expect(rgbTo256(128, 128, 128)).toBeGreaterThanOrEqual(232);
  });

  it('returns 16 for very dark grayscale', () => {
    expect(rgbTo256(0, 0, 0)).toBe(16);
  });

  it('returns 231 for very light grayscale', () => {
    expect(rgbTo256(255, 255, 255)).toBe(231);
  });
});

// ─────────────────────────────────────────────
//  truncateAnsi (new)
// ─────────────────────────────────────────────
describe('truncateAnsi', () => {
  it('returns string unchanged when shorter than width', () => {
    expect(truncateAnsi('hi', 10)).toBe('hi');
  });

  it('truncates and appends ellipsis', () => {
    expect(truncateAnsi('hello world', 8)).toBe('hello w…\x1b[0m');
  });

  it('preserves ANSI codes within the kept portion', () => {
    const colored = '\x1b[31mred\x1b[0m world';
    const result = truncateAnsi(colored, 5);
    expect(result).toContain('\x1b[31m');
    expect(result).toContain('…');
  });

  it('uses custom ellipsis', () => {
    // width=7, ellipsis='...'(3 chars), target=4 visible chars + ellipsis
    expect(truncateAnsi('hello world', 7, '...')).toBe('hell...\x1b[0m');
  });

  it('width 0 returns just ellipsis + reset', () => {
    const result = truncateAnsi('hello', 0);
    expect(result).toContain('…');
  });
});

// ─────────────────────────────────────────────
//  repeatVisible (new)
// ─────────────────────────────────────────────
describe('repeatVisible', () => {
  it('repeats char to width', () => {
    expect(repeatVisible('-', 5)).toBe('-----');
  });

  it('repeats multi-char string and truncates to width', () => {
    expect(repeatVisible('ab', 5)).toBe('abab' + 'a' + '\x1b[0m'); // truncated
  });

  it('returns empty for width 0', () => {
    expect(repeatVisible('x', 0)).toBe('');
  });

  it('returns empty for negative width', () => {
    expect(repeatVisible('x', -5)).toBe('');
  });

  it('returns empty when input is empty', () => {
    expect(repeatVisible('', 10)).toBe('');
  });

  it('returns empty when input is only ANSI codes (visibleLen=0)', () => {
    // String is non-empty but has zero visible chars → unit=0 branch
    expect(repeatVisible('\x1b[31m\x1b[0m', 10)).toBe('');
  });

  it('returns empty when input contains only escape sequences', () => {
    expect(repeatVisible('\x1b[2J\x1b[1A', 5)).toBe('');
  });
});

// ─────────────────────────────────────────────
//  wordWrap — long token soft-break
// ─────────────────────────────────────────────
describe('wordWrap long tokens', () => {
  it('breaks tokens longer than width', () => {
    const lines = wordWrap('supercalifragilisticexpialidocious', 10);
    // Token is 34 chars — should be split into chunks of 10
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
  });

  it('mixes long and short tokens correctly', () => {
    const lines = wordWrap('hi supercalifragilistic ok', 10);
    expect(lines.length).toBeGreaterThan(1);
  });

  it('width 0 returns text unchanged', () => {
    expect(wordWrap('hi there', 0)).toEqual(['hi there']);
  });

  it('handles short text without changes', () => {
    expect(wordWrap('hi there', 20)).toEqual(['hi there']);
  });
});

// ─────────────────────────────────────────────
//  stripAnsi — extended sequences
// ─────────────────────────────────────────────
describe('stripAnsi extended', () => {
  it('strips OSC sequences (terminal title)', () => {
    expect(stripAnsi('\x1b]0;title\x07hello')).toBe('hello');
  });

  it('strips cursor movement', () => {
    expect(stripAnsi('\x1b[2Ahello')).toBe('hello');
  });

  it('strips screen clear', () => {
    expect(stripAnsi('\x1b[2Jhello')).toBe('hello');
  });

  it('strips multiple sequences', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m and \x1b[32mgreen\x1b[0m')).toBe('red and green');
  });

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain')).toBe('plain');
  });
});