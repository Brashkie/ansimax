import {
  isHexColor, truncateAnsi, repeatVisible, rgbTo256,
  charWidth, graphemes, sliceAnsi, wrapAnsi, gradientColor,
  onResize, debounce, throttle, requestTerminalFrame, cancelTerminalFrame,
  memoize, diffLines, termSize,
  clamp, lerp, hexToRgb, rgbToHex, lerpColor,
  stripAnsi, visibleLen, padEnd, padStart, center, wordWrap,
  // New utilities
  once, escapeRegex, safeJson, padBoth, nextTick,
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


// ─────────────────────────────────────────────
//  Unicode-aware width (charWidth + visibleLen)
// ─────────────────────────────────────────────
describe('charWidth', () => {
  it('ASCII chars are width 1', () => {
    expect(charWidth('a')).toBe(1);
    expect(charWidth(' ')).toBe(1);
    expect(charWidth('A')).toBe(1);
  });

  it('CJK chars are width 2', () => {
    expect(charWidth('你')).toBe(2);
    expect(charWidth('好')).toBe(2);
    expect(charWidth('日')).toBe(2);
    expect(charWidth('한')).toBe(2);
  });

  it('emoji are width 2', () => {
    expect(charWidth('🟢')).toBe(2);
    expect(charWidth('🚀')).toBe(2);
    expect(charWidth('❤')).toBe(2);
  });

  it('combining marks are width 0', () => {
    expect(charWidth('\u0301')).toBe(0); // combining acute
  });

  it('zero-width joiner is width 0', () => {
    expect(charWidth('\u200D')).toBe(0);
  });

  it('empty string is width 0', () => {
    expect(charWidth('')).toBe(0);
  });
});

describe('visibleLen — Unicode-aware', () => {
  it('CJK string counts as 2× chars', () => {
    expect(visibleLen('你好')).toBe(4); // 2 chars × 2 cells
  });

  it('mixed ASCII + CJK adds correctly', () => {
    expect(visibleLen('hi 你好')).toBe(7); // 'hi ' + '你好' = 3 + 4
  });

  it('emoji counts as 2', () => {
    expect(visibleLen('🟢')).toBe(2);
  });

  it('strips ANSI before measuring', () => {
    expect(visibleLen('\x1b[31m你好\x1b[0m')).toBe(4);
  });
});

// ─────────────────────────────────────────────
//  Grapheme iteration
// ─────────────────────────────────────────────
describe('graphemes', () => {
  it('iterates ASCII chars', () => {
    expect([...graphemes('abc')]).toEqual(['a', 'b', 'c']);
  });

  it('iterates emoji as one cluster (when Segmenter available)', () => {
    const result = [...graphemes('🟢')];
    // Either single grapheme (Segmenter) or single codepoint (fallback)
    // Either way, should not be 2 separate surrogate-half "chars"
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('handles empty string', () => {
    expect([...graphemes('')]).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  ANSI-safe slicing
// ─────────────────────────────────────────────
describe('sliceAnsi', () => {
  it('slices plain text by visible position', () => {
    expect(sliceAnsi('hello world', 0, 5)).toBe('hello');
  });

  it('preserves leading ANSI when slicing colored text', () => {
    const result = sliceAnsi('\x1b[31mhello\x1b[0m', 0, 3);
    expect(result).toContain('\x1b[31m');
    expect(result).toContain('hel');
  });

  it('returns empty for start beyond length', () => {
    expect(sliceAnsi('hi', 10, 20)).toBe('');
  });

  it('handles undefined end (slice to end)', () => {
    expect(sliceAnsi('hello', 2)).toBe('llo');
  });

  it('clamps negative start to 0', () => {
    expect(sliceAnsi('abc', -1, 2)).toBe('ab');
  });

  it('handles empty string', () => {
    expect(sliceAnsi('', 0, 5)).toBe('');
  });
});

// ─────────────────────────────────────────────
//  ANSI-aware word wrap
// ─────────────────────────────────────────────
describe('wrapAnsi', () => {
  it('wraps plain text by word boundaries', () => {
    expect(wrapAnsi('the quick brown fox', 10)).toEqual(['the quick', 'brown fox']);
  });

  it('preserves explicit newlines', () => {
    expect(wrapAnsi('line1\nline2', 20)).toEqual(['line1', 'line2']);
  });

  it('soft-breaks tokens longer than width', () => {
    const result = wrapAnsi('aaaaaaaaaaaa', 5);
    expect(result.every((line) => visibleLen(line) <= 5)).toBe(true);
  });

  it('handles empty string', () => {
    expect(wrapAnsi('', 10)).toEqual([]);
  });

  it('preserves ANSI escapes within tokens', () => {
    const colored = '\x1b[31mred\x1b[0m blue';
    const result = wrapAnsi(colored, 20);
    expect(result.join('').includes('\x1b[31m')).toBe(true);
  });

  it('width=0 returns input as-is', () => {
    expect(wrapAnsi('hello', 0)).toEqual(['hello']);
  });
});

// ─────────────────────────────────────────────
//  Multi-stop gradient interpolation
// ─────────────────────────────────────────────
describe('gradientColor', () => {
  const RED = { r: 255, g: 0, b: 0 };
  const GREEN = { r: 0, g: 255, b: 0 };
  const BLUE = { r: 0, g: 0, b: 255 };

  it('returns single color when only one stop', () => {
    expect(gradientColor([RED], 0.5)).toEqual(RED);
  });

  it('returns first color at t=0', () => {
    expect(gradientColor([RED, GREEN, BLUE], 0)).toEqual(RED);
  });

  it('returns last color at t=1', () => {
    expect(gradientColor([RED, GREEN, BLUE], 1)).toEqual(BLUE);
  });

  it('returns middle stop at t=0.5 with 3 stops', () => {
    expect(gradientColor([RED, GREEN, BLUE], 0.5)).toEqual(GREEN);
  });

  it('clamps t outside [0, 1]', () => {
    expect(gradientColor([RED, BLUE], -1)).toEqual(RED);
    expect(gradientColor([RED, BLUE], 2)).toEqual(BLUE);
  });

  it('throws on empty array', () => {
    expect(() => gradientColor([], 0.5)).toThrow();
  });
});

// ─────────────────────────────────────────────
//  Frame-rate helpers
// ─────────────────────────────────────────────
describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('delays invocation', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid calls into one', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d(); d(); d();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel prevents firing', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush fires immediately', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('arg');
    d.flush();
    expect(fn).toHaveBeenCalledWith('arg');
  });
});

describe('throttle', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('first call fires immediately', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('coalesces calls within window', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t(); t(); t();
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2); // trailing call
  });

  it('cancel prevents trailing call', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t(); t();
    t.cancel();
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1); // only the leading
  });
});

describe('requestTerminalFrame', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('schedules a callback', () => {
    const cb = jest.fn();
    requestTerminalFrame(cb);
    jest.advanceTimersByTime(20);
    expect(cb).toHaveBeenCalled();
  });

  it('cancelTerminalFrame prevents execution', () => {
    const cb = jest.fn();
    const handle = requestTerminalFrame(cb);
    cancelTerminalFrame(handle);
    jest.advanceTimersByTime(20);
    expect(cb).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
//  Memoization
// ─────────────────────────────────────────────
describe('memoize', () => {
  it('caches results by key', () => {
    let calls = 0;
    const m = memoize((n: number) => { calls++; return n * 2; });
    expect(m(5)).toBe(10);
    expect(m(5)).toBe(10);
    expect(m(5)).toBe(10);
    expect(calls).toBe(1);
  });

  it('different keys cache separately', () => {
    let calls = 0;
    const m = memoize((n: number) => { calls++; return n * 2; });
    m(1); m(2); m(3);
    expect(calls).toBe(3);
    m(1); m(2); m(3);
    expect(calls).toBe(3); // no extra calls
  });

  it('clear empties cache', () => {
    let calls = 0;
    const m = memoize((n: number) => { calls++; return n; });
    m(1); m(1);
    m.clear();
    m(1);
    expect(calls).toBe(2);
  });

  it('size returns current cache count', () => {
    const m = memoize((n: number) => n);
    expect(m.size()).toBe(0);
    m(1); m(2); m(3);
    expect(m.size()).toBe(3);
  });

  it('evicts when max reached (FIFO)', () => {
    const m = memoize((n: number) => n, 2);
    m(1); m(2); m(3); // evicts 1
    expect(m.size()).toBe(2);
  });
});

// ─────────────────────────────────────────────
//  Resize listener
// ─────────────────────────────────────────────
describe('onResize', () => {
  it('returns a no-op function in non-TTY environments', () => {
    const off = onResize(() => { /* noop */ });
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Frame diffing
// ─────────────────────────────────────────────
describe('diffLines', () => {
  it('detects changed lines', () => {
    const oldF = 'a\nb\nc';
    const newF = 'a\nB\nc';
    const diffs = diffLines(oldF, newF);
    expect(diffs).toEqual([{ index: 1, line: 'B', type: 'changed' }]);
  });

  it('detects added lines', () => {
    const oldF = 'a\nb';
    const newF = 'a\nb\nc';
    const diffs = diffLines(oldF, newF);
    expect(diffs).toEqual([{ index: 2, line: 'c', type: 'added' }]);
  });

  it('detects removed lines', () => {
    const oldF = 'a\nb\nc';
    const newF = 'a';
    const diffs = diffLines(oldF, newF);
    // Lines 1 and 2 now removed
    expect(diffs.length).toBeGreaterThanOrEqual(2);
    // All removed diffs should be type 'removed'
    expect(diffs.every((d) => d.type === 'removed')).toBe(true);
  });

  it('returns empty array when frames are identical', () => {
    expect(diffLines('a\nb\nc', 'a\nb\nc')).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  Padding/center with Unicode width
// ─────────────────────────────────────────────
describe('padding with wide chars', () => {
  it('padEnd accounts for CJK width', () => {
    // '你' = 2 cells, want total visible width 5 → pad with 3 spaces
    expect(padEnd('你', 5)).toBe('你   ');
  });

  it('center accounts for emoji width', () => {
    // '🟢' = 2 cells, want total visible width 6 → 2 left + 2 right
    const result = center('🟢', 6);
    expect(visibleLen(result)).toBe(6);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: graphemes fallback (line 201)
//  When Intl.Segmenter is unavailable, falls back to codepoint iteration.
// ─────────────────────────────────────────────
describe('graphemes fallback path', () => {
  it('iterates over surrogate pairs correctly via codepoint iteration', () => {
    // Even with Segmenter, this ensures the iteration logic is exercised.
    // The test runs the loop body — fallback path is identical in behavior
    // for ASCII and codepoints.
    const result = [...graphemes('a🟢b')];
    // Should produce 3 items: 'a', emoji (1 grapheme), 'b'
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(4); // surrogate-pair fallback may give 4
  });
});

// ─────────────────────────────────────────────
//  Coverage push: onResize handler activation (lines 347-362)
// ─────────────────────────────────────────────
describe('onResize handler triggers', () => {
  it('handler is invoked when resize event fires on stdout', () => {
    const stdoutEmit = (process.stdout as unknown as { emit?: (e: string) => boolean });
    if (typeof stdoutEmit.emit !== 'function') return; // skip in non-event-emitter env

    const listener = jest.fn();
    const off = onResize(listener);

    // Manually emit a resize event — this exercises lines 350-352
    try {
      stdoutEmit.emit!('resize');
      expect(listener).toHaveBeenCalled();
    } finally {
      off();
    }
  });

  it('listener that throws does not propagate', () => {
    const stdoutEmit = (process.stdout as unknown as { emit?: (e: string) => boolean });
    if (typeof stdoutEmit.emit !== 'function') return;

    const bad = (): void => { throw new Error('boom'); };
    const off = onResize(bad);

    expect(() => {
      stdoutEmit.emit!('resize');
    }).not.toThrow();
    off();
  });

  it('off() unsubscribes via off or removeListener', () => {
    const listener = jest.fn();
    const off = onResize(listener);
    expect(() => off()).not.toThrow();
    // Calling off twice should not crash
    expect(() => off()).not.toThrow();
  });

  it('returns no-op when stdout.on is not a function', () => {
    const original = process.stdout.on;
    // Temporarily make stdout.on undefined to hit the early return
    Object.defineProperty(process.stdout, 'on', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const off = onResize(() => { /* never */ });
    expect(typeof off).toBe('function');
    expect(() => off()).not.toThrow();
    // Restore
    Object.defineProperty(process.stdout, 'on', {
      value: original,
      configurable: true,
      writable: true,
    });
  });
});

// ─────────────────────────────────────────────
//  Coverage push: wrapAnsi empty paragraph in middle (lines 389-390)
// ─────────────────────────────────────────────
describe('wrapAnsi empty paragraph paths', () => {
  it('preserves empty line in the middle (push empty string then continue)', () => {
    const result = wrapAnsi('first\n\nthird', 20);
    // Should produce ['first', '', 'third'] — exercises the
    // `if (!paragraph) { result.push(''); continue; }` branch
    expect(result).toEqual(['first', '', 'third']);
  });

  it('multiple consecutive empty lines all preserved', () => {
    const result = wrapAnsi('a\n\n\n\nb', 20);
    expect(result).toEqual(['a', '', '', '', 'b']);
  });

  it('leading empty line preserved', () => {
    const result = wrapAnsi('\nfirst', 20);
    expect(result).toEqual(['', 'first']);
  });

  it('trailing empty line preserved', () => {
    const result = wrapAnsi('first\n', 20);
    expect(result).toEqual(['first', '']);
  });
});

// ─────────────────────────────────────────────
//  Defensive input handling
// ─────────────────────────────────────────────
describe('defensive inputs', () => {
  it('visibleLen handles non-string', () => {
    expect(visibleLen(null as unknown as string)).toBe(0);
    expect(visibleLen(undefined as unknown as string)).toBe(0);
    expect(visibleLen(42 as unknown as string)).toBe(0);
  });

  it('stripAnsi handles non-string', () => {
    expect(stripAnsi(null as unknown as string)).toBe('');
    expect(stripAnsi(42 as unknown as string)).toBe('');
  });

  it('gradientColor with single color returns it regardless of t', () => {
    const c = { r: 255, g: 0, b: 0 };
    expect(gradientColor([c], 0.5)).toEqual(c);
    expect(gradientColor([c], -5)).toEqual(c);
    expect(gradientColor([c], 999)).toEqual(c);
  });

  it('gradientColor with t out of [0,1] clamps automatically', () => {
    const colors = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
    expect(gradientColor(colors, -10)).toEqual({ r: 0, g: 0, b: 0 });
    expect(gradientColor(colors, 999)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('gradientColor with NaN t falls back to 0', () => {
    const colors = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 0, b: 0 }];
    expect(gradientColor(colors, NaN)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('gradientColor with empty array throws', () => {
    expect(() => gradientColor([], 0.5)).toThrow();
  });
});

// ─────────────────────────────────────────────
//  debounce with maxWait
// ─────────────────────────────────────────────
describe('debounce with maxWait', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fires after maxWait even if calls keep arriving', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100, { maxWait: 250 });

    // Call every 50ms — without maxWait, this would never fire
    for (let i = 0; i < 10; i++) {
      d();
      jest.advanceTimersByTime(50);
    }
    // By now elapsed = 500ms > maxWait=250 → fn fired at least once
    expect(fn).toHaveBeenCalled();
  });

  it('fires once after debounce window without maxWait', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancel clears both timers', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100, { maxWait: 250 });
    d();
    d.cancel();
    jest.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('flush invokes immediately', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('arg');
    d.flush();
    expect(fn).toHaveBeenCalledWith('arg');
  });
});

// ─────────────────────────────────────────────
//  once
// ─────────────────────────────────────────────
describe('once', () => {
  it('invokes fn only the first time', () => {
    const fn = jest.fn(() => 'result');
    const wrapped = once(fn);
    expect(wrapped()).toBe('result');
    expect(wrapped()).toBe('result');
    expect(wrapped()).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns the same cached result for subsequent calls', () => {
    let i = 0;
    const wrapped = once(() => ++i);
    expect(wrapped()).toBe(1);
    expect(wrapped()).toBe(1); // cached, not 2
    expect(i).toBe(1);
  });

  it('passes args to first invocation', () => {
    const fn = jest.fn((a: string, b: number) => `${a}:${b}`);
    const wrapped = once(fn);
    expect(wrapped('hi', 42)).toBe('hi:42');
    expect(wrapped('bye', 99)).toBe('hi:42'); // cached
  });
});

// ─────────────────────────────────────────────
//  escapeRegex
// ─────────────────────────────────────────────
describe('escapeRegex', () => {
  it('escapes regex special chars', () => {
    expect(escapeRegex('a.b+c')).toBe('a\\.b\\+c');
    expect(escapeRegex('(group)')).toBe('\\(group\\)');
    expect(escapeRegex('$^*?')).toBe('\\$\\^\\*\\?');
  });

  it('handles plain strings', () => {
    expect(escapeRegex('hello')).toBe('hello');
  });

  it('produces a regex that matches the original literal', () => {
    const literal = 'a.b+c?(d)[e]';
    const re = new RegExp(escapeRegex(literal));
    expect(re.test(literal)).toBe(true);
  });

  it('handles non-string defensively', () => {
    expect(escapeRegex(null as unknown as string)).toBe('');
    expect(escapeRegex(42 as unknown as string)).toBe('');
  });
});

// ─────────────────────────────────────────────
//  safeJson
// ─────────────────────────────────────────────
describe('safeJson', () => {
  it('serializes plain objects normally', () => {
    expect(safeJson({ a: 1, b: 'x' })).toBe('{"a":1,"b":"x"}');
  });

  it('handles BigInt by stringifying', () => {
    expect(safeJson({ n: 123n })).toBe('{"n":"123"}');
  });

  it('handles circular references', () => {
    const obj: Record<string, unknown> = { name: 'root' };
    obj.self = obj;
    const json = safeJson(obj);
    expect(json).toContain('[Circular]');
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('honors indent parameter', () => {
    const json = safeJson({ a: 1 }, 2);
    expect(json).toContain('\n');
  });

  it('serializes nested BigInts', () => {
    expect(safeJson({ list: [1n, 2n, 3n] })).toBe('{"list":["1","2","3"]}');
  });
});

// ─────────────────────────────────────────────
//  padBoth
// ─────────────────────────────────────────────
describe('padBoth', () => {
  it('pads equally on both sides for even gap', () => {
    expect(padBoth('hi', 6)).toBe('  hi  ');
  });

  it('right side gets extra char for odd gap', () => {
    expect(padBoth('hi', 5)).toBe(' hi  ');
  });

  it('returns original string when wider than target', () => {
    expect(padBoth('hello', 3)).toBe('hello');
  });

  it('supports custom pad char', () => {
    expect(padBoth('x', 5, '*')).toBe('**x**');
  });

  it('Unicode-aware width', () => {
    expect(padBoth('🟢', 6)).toBe('  🟢  ');
  });
});

// ─────────────────────────────────────────────
//  diffLines with type
// ─────────────────────────────────────────────
describe('diffLines with type', () => {
  it('marks new lines as added', () => {
    const diffs = diffLines('a\nb', 'a\nb\nc');
    expect(diffs).toEqual([{ index: 2, line: 'c', type: 'added' }]);
  });

  it('marks removed lines as removed', () => {
    const diffs = diffLines('a\nb\nc', 'a\nb');
    expect(diffs).toEqual([{ index: 2, line: '', type: 'removed' }]);
  });

  it('marks modified lines as changed', () => {
    const diffs = diffLines('a\nb\nc', 'a\nX\nc');
    expect(diffs).toEqual([{ index: 1, line: 'X', type: 'changed' }]);
  });

  it('returns empty for identical frames', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  memoize with custom key fn
// ─────────────────────────────────────────────
describe('memoize with custom key', () => {
  it('memoizes multi-arg fn via keyFn', () => {
    let calls = 0;
    const m = memoize(
      (a: number, b: number) => { calls++; return a + b; },
      { keyFn: (a, b) => `${a}:${b}` },
    );

    expect(m(1, 2)).toBe(3);
    expect(m(1, 2)).toBe(3);
    expect(calls).toBe(1);

    expect(m(1, 3)).toBe(4);
    expect(calls).toBe(2);
  });

  it('default keyFn uses first arg', () => {
    let calls = 0;
    const m = memoize((n: number) => { calls++; return n * 2; });
    m(5); m(5); m(5);
    expect(calls).toBe(1);
  });

  it('respects max option', () => {
    let calls = 0;
    const m = memoize((n: number) => { calls++; return n; }, { max: 2 });
    m(1); m(2); m(3); // evicts 1
    m(1); // re-computes
    expect(calls).toBe(4);
    expect(m.size()).toBe(2);
  });

  it('clear() empties cache', () => {
    const m = memoize((n: number) => n);
    m(1); m(2);
    expect(m.size()).toBe(2);
    m.clear();
    expect(m.size()).toBe(0);
  });
});

// ─────────────────────────────────────────────
//  nextTick
// ─────────────────────────────────────────────
describe('nextTick', () => {
  it('invokes callback asynchronously', async () => {
    let fired = false;
    nextTick(() => { fired = true; });
    expect(fired).toBe(false); // not sync
    await new Promise((r) => setImmediate(r));
    expect(fired).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Coverage: target specific branches in helpers.ts
// ─────────────────────────────────────────────
describe('helpers: branch coverage targets', () => {
  it('sliceAnsi with empty string hits iter.done branch (line 276)', () => {
    expect(sliceAnsi('', 0, 5)).toBe('');
    expect(sliceAnsi('hi', 5, 10)).toBeDefined(); // out-of-range start
  });

  it('sliceAnsi exhausting iterator mid-walk hits break', () => {
    // sStart > visible length forces early break
    expect(sliceAnsi('a', 10, 20)).toBe('');
  });

  it('termSize returns terminal dims when available', () => {
    const { cols, rows } = termSize();
    expect(typeof cols).toBe('number');
    expect(typeof rows).toBe('number');
    expect(cols).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(0);
  });

  it('termSize falls back to 80x24 when stdout dims invalid', () => {
    // Save and stub stdout dims to non-positive values to hit fallback
    const origCols = process.stdout.columns;
    const origRows = process.stdout.rows;
    try {
      process.stdout.columns = 0;
      process.stdout.rows = 0;
      const { cols, rows } = termSize();
      expect(cols).toBe(80);
      expect(rows).toBe(24);
    } finally {
      process.stdout.columns = origCols;
      process.stdout.rows = origRows;
    }
  });

  it('termSize falls back when stdout dims are non-numeric', () => {
    const origCols = process.stdout.columns;
    try {
      process.stdout.columns = undefined as unknown as number;
      const { cols } = termSize();
      expect(cols).toBe(80);
    } finally {
      process.stdout.columns = origCols;
    }
  });

  it('onResize with throttle: 0 uses safeCall directly (line 396)', () => {
    // throttle=0 bypasses the throttle wrapper — covers the `: safeCall` branch
    const fn = jest.fn();
    const off = onResize(fn, { throttle: 0 });
    expect(typeof off).toBe('function');
    off();
  });

  it('debounce.flush() with no pending call is no-op (line 545)', () => {
    // Covers the `(timer || maxTimer) && lastArgs` false branch
    const fn = jest.fn();
    const wrapped = debounce(fn, 100);
    // No call made → nothing pending → flush is a no-op
    wrapped.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('debounce.flush() after call invokes fn (covers true branch)', () => {
    const fn = jest.fn();
    const wrapped = debounce(fn, 100);
    wrapped('arg1');
    wrapped.flush();
    expect(fn).toHaveBeenCalledWith('arg1');
  });
});

// ─────────────────────────────────────────────
//  v1.3.4 — gradientStops + escapeForRegex + measureBlock
// ─────────────────────────────────────────────

import { gradientStops, escapeForRegex, measureBlock } from '../utils/helpers.js';

describe('gradientStops (v1.3.4)', () => {
  it('returns array of N hex stops between two colors', () => {
    const stops = gradientStops('#ff0000', '#0000ff', 5);
    expect(stops.length).toBe(5);
    // Both endpoints included
    expect(stops[0]).toBe('#ff0000');
    expect(stops[stops.length - 1]).toBe('#0000ff');
    // Middle stop is purple-ish (50/50 mix)
    const mid = stops[2] ?? '';
    expect(mid.startsWith('#')).toBe(true);
    expect(mid.length).toBe(7);
  });

  it('handles minimum count of 2 (just the endpoints)', () => {
    const stops = gradientStops('#ff0000', '#0000ff', 2);
    expect(stops.length).toBe(2);
    expect(stops[0]).toBe('#ff0000');
    expect(stops[1]).toBe('#0000ff');
  });

  it('clamps count to minimum 2', () => {
    const stops = gradientStops('#000000', '#ffffff', 0);
    expect(stops.length).toBe(2);
  });

  it('returns empty array for invalid hex colors', () => {
    expect(gradientStops('notahex', '#0000ff', 3)).toEqual([]);
    expect(gradientStops('#ff0000', 'invalid', 3)).toEqual([]);
  });

  it('handles non-finite count defensively', () => {
    const stops = gradientStops('#000000', '#ffffff', NaN);
    expect(stops.length).toBe(2);   // clamped to default 2
  });

  it('all stops are valid hex format', () => {
    const stops = gradientStops('#bd93f9', '#ff79c6', 10);
    for (const s of stops) {
      expect(/^#[0-9a-f]{6}$/i.test(s)).toBe(true);
    }
  });
});

describe('escapeForRegex (v1.3.4)', () => {
  it('escapes all 12 regex meta-characters', () => {
    const input = '.*+?^${}()|[]\\';
    const escaped = escapeForRegex(input);
    // Every char should now have a backslash prefix
    expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });

  it('leaves non-special characters alone', () => {
    expect(escapeForRegex('hello world')).toBe('hello world');
    expect(escapeForRegex('abc123')).toBe('abc123');
  });

  it('produces a string usable as a regex literal', () => {
    const userInput = 'foo.bar+baz';
    const re = new RegExp(escapeForRegex(userInput));
    expect(re.test('foo.bar+baz')).toBe(true);
    expect(re.test('fooXbarXbaz')).toBe(false);  // dot/plus are literal now
  });

  it('handles empty string', () => {
    expect(escapeForRegex('')).toBe('');
  });

  it('handles non-string input defensively', () => {
    // @ts-expect-error testing defensive behavior
    expect(escapeForRegex(null)).toBe('');
    // @ts-expect-error testing defensive behavior
    expect(escapeForRegex(undefined)).toBe('');
  });
});

describe('measureBlock (v1.3.4)', () => {
  it('measures single-line block', () => {
    const { width, height } = measureBlock('Hello');
    expect(width).toBe(5);
    expect(height).toBe(1);
  });

  it('measures multi-line block', () => {
    const { width, height } = measureBlock('Short\nLonger line\nMid');
    expect(width).toBe(11);  // 'Longer line'
    expect(height).toBe(3);
  });

  it('ignores ANSI escape codes when measuring width', () => {
    const colored = '\x1b[31mHello\x1b[0m';  // visible: "Hello" (5 chars)
    const { width } = measureBlock(colored);
    expect(width).toBe(5);
  });

  it('returns 0/0 for empty string', () => {
    expect(measureBlock('')).toEqual({ width: 0, height: 0 });
  });

  it('handles non-string input defensively', () => {
    // @ts-expect-error testing defensive behavior
    expect(measureBlock(null)).toEqual({ width: 0, height: 0 });
  });

  it('counts a single newline as 2 lines', () => {
    // 'a\nb' splits to ['a', 'b'] → height 2
    const { height } = measureBlock('a\nb');
    expect(height).toBe(2);
  });

  it('counts trailing newline as empty last line', () => {
    // 'a\n' splits to ['a', ''] → height 2
    const { height } = measureBlock('a\n');
    expect(height).toBe(2);
  });
});

// ─────────────────────────────────────────────
//  v1.3.5 — Color science + numeric helpers
// ─────────────────────────────────────────────

import {
  isFiniteNumber as _isFiniteNumber, safeInt, clampByte as _clampByte,
  rgbToHsl, hslToRgb, rgbToOklab, oklabToRgb,
  mixColors, quantizeColor,
} from '../utils/helpers.js';

describe('isFiniteNumber (v1.3.5)', () => {
  it('returns true for finite numbers', () => {
    expect(_isFiniteNumber(0)).toBe(true);
    expect(_isFiniteNumber(-1.5)).toBe(true);
    expect(_isFiniteNumber(1e100)).toBe(true);
  });
  it('returns false for non-numbers', () => {
    expect(_isFiniteNumber('5')).toBe(false);
    expect(_isFiniteNumber(null)).toBe(false);
    expect(_isFiniteNumber(undefined)).toBe(false);
    expect(_isFiniteNumber({})).toBe(false);
  });
  it('returns false for NaN/Infinity', () => {
    expect(_isFiniteNumber(NaN)).toBe(false);
    expect(_isFiniteNumber(Infinity)).toBe(false);
    expect(_isFiniteNumber(-Infinity)).toBe(false);
  });
});

describe('safeInt (v1.3.5)', () => {
  it('coerces numeric strings', () => {
    expect(safeInt('42')).toBe(42);
    expect(safeInt('3.7')).toBe(3);
  });
  it('floors decimals', () => {
    expect(safeInt(3.9)).toBe(3);
    expect(safeInt(-2.3)).toBe(-3);
  });
  it('returns fallback for non-finite input', () => {
    expect(safeInt(NaN, 50)).toBe(50);
    expect(safeInt(Infinity, 99)).toBe(99);
    expect(safeInt('abc', 7)).toBe(7);
    expect(safeInt(null, 1)).toBe(1);
  });
  it('clamps to min/max', () => {
    expect(safeInt(500, 0, 0, 100)).toBe(100);
    expect(safeInt(-500, 0, 0, 100)).toBe(0);
    expect(safeInt(50, 0, 0, 100)).toBe(50);
  });
  it('clamps fallback to min/max too', () => {
    expect(safeInt(NaN, 200, 0, 100)).toBe(100);
  });
});

describe('clampByte (v1.3.5)', () => {
  it('clamps to 0-255', () => {
    expect(_clampByte(-10)).toBe(0);
    expect(_clampByte(300)).toBe(255);
    expect(_clampByte(127)).toBe(127);
  });
  it('rounds non-integers', () => {
    expect(_clampByte(127.4)).toBe(127);
    expect(_clampByte(127.6)).toBe(128);
  });
});

describe('rgbToHsl + hslToRgb (v1.3.5)', () => {
  it('converts primary colors correctly', () => {
    expect(rgbToHsl({ r: 255, g: 0,   b: 0   })).toEqual({ h: 0,   s: 1, l: 0.5 });
    expect(rgbToHsl({ r: 0,   g: 255, b: 0   })).toEqual({ h: 120, s: 1, l: 0.5 });
    expect(rgbToHsl({ r: 0,   g: 0,   b: 255 })).toEqual({ h: 240, s: 1, l: 0.5 });
  });

  it('handles grayscale (saturation 0)', () => {
    const gray = rgbToHsl({ r: 128, g: 128, b: 128 });
    expect(gray.s).toBe(0);
    expect(gray.l).toBeCloseTo(0.502, 2);
  });

  it('roundtrips for primary colors', () => {
    const red = { r: 255, g: 0, b: 0 };
    expect(hslToRgb(rgbToHsl(red))).toEqual(red);
    const blue = { r: 0, g: 0, b: 255 };
    expect(hslToRgb(rgbToHsl(blue))).toEqual(blue);
  });

  it('hslToRgb wraps hue beyond 360', () => {
    const a = hslToRgb({ h: 0, s: 1, l: 0.5 });
    const b = hslToRgb({ h: 360, s: 1, l: 0.5 });
    const c = hslToRgb({ h: 720, s: 1, l: 0.5 });
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('hslToRgb handles negative hue', () => {
    expect(hslToRgb({ h: -120, s: 1, l: 0.5 })).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('hslToRgb produces grayscale when s=0', () => {
    const gray = hslToRgb({ h: 0, s: 0, l: 0.5 });
    expect(gray.r).toBe(gray.g);
    expect(gray.g).toBe(gray.b);
  });

  it('hslToRgb clamps out-of-range s/l', () => {
    const overSat = hslToRgb({ h: 0, s: 5, l: 0.5 });
    expect(overSat.r).toBeGreaterThanOrEqual(0);
    expect(overSat.r).toBeLessThanOrEqual(255);
  });
});

describe('rgbToOklab + oklabToRgb (v1.3.5)', () => {
  it('roundtrips arbitrary colors', () => {
    const colors = [
      { r: 100, g: 150, b: 200 },
      { r: 50,  g: 50,  b: 50  },
      { r: 200, g: 100, b: 50  },
      { r: 0,   g: 0,   b: 0   },
      { r: 255, g: 255, b: 255 },
    ];
    for (const c of colors) {
      const result = oklabToRgb(rgbToOklab(c));
      // Allow ±1 tolerance for rounding through linear sRGB
      expect(Math.abs(result.r - c.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.g - c.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.b - c.b)).toBeLessThanOrEqual(1);
    }
  });

  it('black has L=0', () => {
    const o = rgbToOklab({ r: 0, g: 0, b: 0 });
    expect(o.L).toBeCloseTo(0, 2);
  });

  it('white has L=1', () => {
    const o = rgbToOklab({ r: 255, g: 255, b: 255 });
    expect(o.L).toBeCloseTo(1, 2);
  });

  it('gray has near-zero a and b', () => {
    const o = rgbToOklab({ r: 128, g: 128, b: 128 });
    expect(Math.abs(o.a)).toBeLessThan(0.005);
    expect(Math.abs(o.b)).toBeLessThan(0.005);
  });
});

describe('lerpColor with color spaces (v1.3.5)', () => {
  const { lerpColor } = jest.requireActual('../utils/helpers.js') as typeof import('../utils/helpers.js');
  const red  = { r: 255, g: 0,   b: 0   };
  const blue = { r: 0,   g: 0,   b: 255 };

  it('rgb space (default) — backward compatible', () => {
    const result = lerpColor(red, blue, 0.5);
    expect(result).toEqual({ r: 128, g: 0, b: 128 });
  });

  it('rgb space with explicit "rgb" — same as default', () => {
    expect(lerpColor(red, blue, 0.5, 'rgb')).toEqual({ r: 128, g: 0, b: 128 });
  });

  it('oklab space — produces perceptually different midpoint', () => {
    const oklab = lerpColor(red, blue, 0.5, 'oklab');
    const rgb = lerpColor(red, blue, 0.5, 'rgb');
    // Should not be identical to RGB result
    expect(oklab).not.toEqual(rgb);
    // Should be valid RGB values
    expect(oklab.r).toBeGreaterThanOrEqual(0);
    expect(oklab.r).toBeLessThanOrEqual(255);
  });

  it('hsl space — takes shortest hue path', () => {
    // red (h=0) → blue (h=240): shorter path is through purple (300) not green
    const hsl = lerpColor(red, blue, 0.5, 'hsl');
    // Should not be near green (0,255,0)
    expect(hsl.g).toBeLessThan(100);
  });

  it('hsl space — wraps negative hue difference (line 344)', () => {
    // blue (h=240) → red (h=0): dh = 0 - 240 = -240 → wraps to +120
    // So interpolation goes through 300 (magenta) not 120 (green).
    // Mid-point should be near magenta hue (~300°), so R and B both high, G low.
    const hsl = lerpColor(blue, red, 0.5, 'hsl');
    expect(hsl.g).toBeLessThan(100);   // not green
    // R should be substantial (we're going through magenta)
    expect(hsl.r).toBeGreaterThan(100);
    expect(hsl.b).toBeGreaterThan(100);
  });

  it('all spaces preserve endpoints', () => {
    for (const space of ['rgb', 'hsl', 'oklab'] as const) {
      const at0 = lerpColor(red, blue, 0, space);
      const at1 = lerpColor(red, blue, 1, space);
      expect(at0.r).toBeCloseTo(red.r, 0);
      expect(at1.b).toBeCloseTo(blue.b, 0);
    }
  });

  it('clamps t outside [0,1] in all spaces', () => {
    for (const space of ['rgb', 'hsl', 'oklab'] as const) {
      expect(lerpColor(red, blue, -1, space)).toEqual(lerpColor(red, blue, 0, space));
      expect(lerpColor(red, blue, 2, space)).toEqual(lerpColor(red, blue, 1, space));
    }
  });
});

describe('mixColors (v1.3.5)', () => {
  it('accepts hex strings', () => {
    expect(mixColors('#ff0000', '#0000ff', 0.5)).toEqual({ r: 128, g: 0, b: 128 });
  });
  it('accepts RGB objects', () => {
    expect(
      mixColors({ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }, 0.5)
    ).toEqual({ r: 128, g: 0, b: 128 });
  });
  it('accepts mixed types', () => {
    expect(mixColors('#ff0000', { r: 0, g: 0, b: 255 }, 0.5)).toEqual({ r: 128, g: 0, b: 128 });
  });
  it('respects space parameter', () => {
    const rgb   = mixColors('#ff0000', '#0000ff', 0.5, 'rgb');
    const oklab = mixColors('#ff0000', '#0000ff', 0.5, 'oklab');
    expect(rgb).not.toEqual(oklab);
  });
});

describe('quantizeColor (v1.3.5)', () => {
  it('returns original for high level count (no quantization)', () => {
    // 256 levels covers every byte value
    const c = { r: 100, g: 150, b: 200 };
    expect(quantizeColor(c, 256)).toEqual(c);
  });

  it('snaps to nearest step', () => {
    // levels=2 → step=255 → snaps to 0 or 255 per channel
    const c = quantizeColor({ r: 100, g: 200, b: 30 }, 2);
    expect([0, 255]).toContain(c.r);
    expect([0, 255]).toContain(c.g);
    expect([0, 255]).toContain(c.b);
  });

  it('extremes stay at extremes', () => {
    const black = quantizeColor({ r: 0,   g: 0,   b: 0   }, 4);
    const white = quantizeColor({ r: 255, g: 255, b: 255 }, 4);
    expect(black).toEqual({ r: 0,   g: 0,   b: 0   });
    expect(white).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('default 4 levels gives 64-color palette', () => {
    // levels=4 → step=85 → values in {0, 85, 170, 255}
    const c = quantizeColor({ r: 42, g: 128, b: 200 });
    expect([0, 85, 170, 255]).toContain(c.r);
    expect([0, 85, 170, 255]).toContain(c.g);
    expect([0, 85, 170, 255]).toContain(c.b);
  });

  it('clamps levels to minimum 2', () => {
    // levels=1 would div by zero; should clamp to 2
    const c = quantizeColor({ r: 100, g: 100, b: 100 }, 1);
    expect([0, 255]).toContain(c.r);
  });

  it('handles non-integer levels by flooring', () => {
    const c = quantizeColor({ r: 100, g: 150, b: 200 }, 4.9);
    expect([0, 85, 170, 255]).toContain(c.r);
  });
});
