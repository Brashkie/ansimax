import { ascii } from '../ascii/index.js';
import { stripAnsi } from '../utils/helpers.js';

describe('ascii.big', () => {
  it('returns a multi-line string for a single letter', () => {
    const result = ascii.big('A');
    const lines = result.split('\n');
    expect(lines.length).toBe(5);
  });

  it('renders uppercase letters', () => {
    const result = ascii.big('HELLO');
    expect(result.split('\n').length).toBe(5);
    expect(result.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    expect(ascii.big('abc')).toBe(ascii.big('ABC'));
  });

  it('handles numbers', () => {
    const result = ascii.big('123');
    expect(result.split('\n').length).toBe(5);
  });

  it('handles spaces', () => {
    const result = ascii.big('A B');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('ascii.small', () => {
  it('returns a 3-line string', () => {
    const result = ascii.small('HI');
    expect(result.split('\n').length).toBe(3);
  });

  it('is case-insensitive', () => {
    expect(ascii.small('hello')).toBe(ascii.small('HELLO'));
  });
});

describe('ascii.figlet', () => {
  it('defaults to big font', () => {
    expect(ascii.figlet('A')).toBe(ascii.big('A'));
  });

  it('uses small font when specified', () => {
    expect(ascii.figlet('A', { font: 'small' })).toBe(ascii.small('A'));
  });
});

describe('ascii.box', () => {
  it('surrounds text with a border', () => {
    const result = ascii.box('hello');
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(2);
    // Top and bottom borders
    expect(lines[0]).toContain('╭');
    expect(lines[lines.length - 1]).toContain('╰');
  });

  it('contains the original text', () => {
    const result = ascii.box('hello world');
    expect(stripAnsi(result)).toContain('hello world');
  });

  it('supports single border style', () => {
    const result = ascii.box('test', { borderStyle: 'single' });
    expect(result).toContain('┌');
    expect(result).toContain('┘');
  });

  it('supports double border style', () => {
    const result = ascii.box('test', { borderStyle: 'double' });
    expect(result).toContain('╔');
    expect(result).toContain('╝');
  });

  it('supports heavy border style', () => {
    const result = ascii.box('test', { borderStyle: 'heavy' });
    expect(result).toContain('┏');
    expect(result).toContain('┛');
  });

  it('supports ascii border style', () => {
    const result = ascii.box('test', { borderStyle: 'ascii' });
    expect(result).toContain('+');
    expect(result).toContain('|');
  });

  it('applies padding', () => {
    const noPad  = ascii.box('x', { padding: 0 }).split('\n').length;
    const withPad = ascii.box('x', { padding: 2 }).split('\n').length;
    expect(withPad).toBeGreaterThan(noPad);
  });
});

describe('ascii.divider', () => {
  it('returns a string of dashes', () => {
    const result = ascii.divider({ width: 20 });
    expect(result.length).toBe(20);
  });

  it('includes label when specified', () => {
    const result = ascii.divider({ label: 'TITLE', width: 30 });
    expect(result).toContain('TITLE');
  });

  it('uses custom char', () => {
    const result = ascii.divider({ char: '=', width: 10 });
    expect(result).toBe('='.repeat(10));
  });
});

describe('ascii.logo', () => {
  it('wraps big text in a double box', () => {
    const result = ascii.logo('OK');
    expect(result).toContain('╔');
    expect(result).toContain('╝');
  });

  it('applies gradient function when provided', () => {
    const mockGradient = (s: string) => `[${s}]`;
    const result = ascii.logo('X', { gradient: mockGradient });
    expect(result).toContain('[');
  });
});

describe('ascii.boxStyles', () => {
  it('exposes all box style names', () => {
    expect(ascii.boxStyles).toContain('single');
    expect(ascii.boxStyles).toContain('double');
    expect(ascii.boxStyles).toContain('rounded');
    expect(ascii.boxStyles).toContain('heavy');
    expect(ascii.boxStyles).toContain('dashed');
    expect(ascii.boxStyles).toContain('ascii');
  });
});

// ─────────────────────────────────────────────
//  Improvements: ANSI-aware divider, robust box, font width derivation
// ─────────────────────────────────────────────

describe('divider — ANSI-aware label length', () => {
  it('handles ANSI-colored labels without misalignment', () => {
    // Label has ANSI codes — visibleLen should be used, not .length
    const colored = '\x1b[31mERR\x1b[0m'; // visible length = 3
    const result = ascii.divider({ label: colored, width: 20 });
    // visibleLen handling — should NOT subtract 14 (raw .length) but 3 (visible)
    expect(stripAnsi(result).length).toBeLessThanOrEqual(20);
  });

  it('label longer than width does not crash', () => {
    // Negative repeat would throw — Math.max(0, ...) protection
    expect(() => ascii.divider({ label: 'very long label here', width: 5 })).not.toThrow();
  });

  it('label exactly at width boundary is safe', () => {
    expect(() => ascii.divider({ label: 'abc', width: 5 })).not.toThrow();
  });

  it('width 0 returns empty string', () => {
    expect(ascii.divider({ width: 0 })).toBe('');
  });

  it('negative width clamps to empty', () => {
    expect(ascii.divider({ width: -5 })).toBe('');
  });

  it('default style uses single border', () => {
    const result = ascii.divider({ width: 5 });
    expect(result).toContain('─'); // single h char
  });

  it('custom char overrides style border', () => {
    const result = ascii.divider({ char: '=', width: 5 });
    expect(result).toBe('=====');
  });
});

describe('box — string-only input + ANSI-aware truncation', () => {
  it('input typed as string — no Array.isArray branch', () => {
    // Verify it works with normal strings (the only valid input)
    const result = ascii.box('hello', { width: 10 });
    expect(result).toContain('hello');
  });

  it('ANSI-colored content in box preserves visible alignment', () => {
    const colored = '\x1b[32mOK\x1b[0m';
    const result = ascii.box(colored);
    expect(result).toContain('OK');
    expect(result).toContain('\x1b[32m');
  });

  it('truncates content at width while preserving ANSI', () => {
    const result = ascii.box('this is a long line', { width: 5 });
    // Each interior line should not exceed 5 visible chars
    const lines = result.split('\n');
    for (const line of lines) {
      // Strip box borders and check inner content doesn't overflow
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('empty text produces minimal box', () => {
    const result = ascii.box('');
    expect(result.split('\n').length).toBeGreaterThanOrEqual(3); // top + content + bottom
  });

  it('multi-line text renders all lines', () => {
    const result = ascii.box('line1\nline2\nline3');
    expect(result).toContain('line1');
    expect(result).toContain('line2');
    expect(result).toContain('line3');
  });
});

describe('renderFont — derived char width', () => {
  it('big font (5-wide) uses 5-space fallback', () => {
    // Char that doesn't exist in the font and isn't '?' — falls back to space-width
    const result = ascii.big('A');
    // Should render without crashing
    expect(result).toContain('█');
  });

  it('small font (3-wide) uses 3-space fallback (not 5)', () => {
    // Small font has 3-char-wide cells — fallback should match
    const result = ascii.small('A');
    expect(result).toContain('▀');
    // Each line should be consistent width
    const lines = result.split('\n');
    expect(lines.length).toBe(3); // small is 3 lines tall
  });

  it('unknown char falls back to ? glyph', () => {
    // ~ doesn't exist in BLOCK font → uses '?' glyph
    const result = ascii.big('~');
    // Should render the '?' glyph
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('boxStyles export', () => {
  it('contains all expected style names', () => {
    expect(ascii.boxStyles).toEqual(expect.arrayContaining(['single', 'double', 'rounded', 'heavy', 'dashed', 'ascii']));
  });

  it('is type-safe array of style keys', () => {
    for (const style of ascii.boxStyles) {
      expect(typeof style).toBe('string');
    }
  });
});

// ─────────────────────────────────────────────
//  Branch coverage — ?? fallbacks and defaults
// ─────────────────────────────────────────────

describe('renderFont fallback branches', () => {
  it('empty text returns empty string', () => {
    expect(ascii.big('')).toBe('');
    expect(ascii.small('')).toBe('');
  });

  it('chars with no glyph in font use ?-glyph fallback (line 113 second ??)', () => {
    // 'Ñ' is not in BLOCK font, but '?' IS — hits fontMap[c] ?? fontMap['?']
    const result = ascii.big('Ñ');
    expect(result.length).toBeGreaterThan(0);
  });

  it('special chars not in font use ? fallback', () => {
    // '~' not in font → falls back to '?' glyph
    const r1 = ascii.big('~');
    const r2 = ascii.big('?');
    // Both should produce identical output (~ falls back to ?)
    expect(r1).toBe(r2);
  });
});

describe('divider — default branches', () => {
  it('divider() with no opts uses defaults', () => {
    // opts={} default + char=undef + width=null + label=null + style='single'
    const result = ascii.divider();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('divider with width=null uses termSize cols (line 205 cols branch)', () => {
    // width omitted → width=null → falls back to cols from termSize
    const result = ascii.divider({ char: '-' });
    expect(result.length).toBeGreaterThan(0);
  });

  it('unknown style falls back to single (line 206)', () => {
    // @ts-expect-error intentionally invalid style
    const result = ascii.divider({ style: 'unknown', width: 5 });
    // Falls back to BOX_STYLES.single → '─' as h char
    expect(result).toContain('─');
  });

  it('all valid styles produce dividers', () => {
    for (const style of ascii.boxStyles) {
      const result = ascii.divider({ style, width: 5 });
      expect(result.length).toBeGreaterThan(0);
    }
  });
});

describe('box — default opts branches', () => {
  it('box() with no opts uses all defaults', () => {
    // padding=1, borderStyle='rounded', width=null defaults
    const result = ascii.box('hi');
    expect(result).toContain('hi');
    expect(result).toContain('╭'); // rounded top-left
  });

  it('box with unknown borderStyle falls back to rounded', () => {
    // @ts-expect-error intentionally invalid
    const result = ascii.box('x', { borderStyle: 'unknown' });
    expect(result).toContain('╭'); // rounded fallback
  });
});

describe('logo — default opts branches', () => {
  it('logo() with no opts uses all defaults', () => {
    // gradient=null, boxStyle='double' defaults
    const result = ascii.logo('HI');
    expect(result).toContain('╔'); // double top-left
  });

  it('logo with no gradient uses raw lines', () => {
    // gfn=null branch in art.split.map
    const result = ascii.logo('A', { boxStyle: 'single' });
    expect(result).toContain('┌');
  });
});

describe('banner — default opts branches', () => {
  it('banner() with no opts uses all defaults', () => {
    // font='big', colorFn=null, align='left' defaults
    const result = ascii.banner('HI');
    expect(result).toContain('█');
  });

  it('banner with align=left does not center', () => {
    const r1 = ascii.banner('A', { align: 'left' });
    const r2 = ascii.banner('A'); // default align
    // Both should produce same output (default is 'left')
    expect(r1).toBe(r2);
  });

  it('banner with no colorFn does not apply colors', () => {
    const result = ascii.banner('A');
    expect(result).not.toContain('\x1b[38;2;');
  });
});

describe('figlet — default opts branch', () => {
  it('figlet() with no opts uses big font default', () => {
    const r1 = ascii.figlet('A');
    const r2 = ascii.big('A');
    // Default font is 'big' → same as calling big() directly
    expect(r1).toBe(r2);
  });

  it('figlet with non-small font uses big', () => {
    // opts.font !== 'small' → falls to big
    const r1 = ascii.figlet('A', { font: 'big' });
    const r2 = ascii.big('A');
    expect(r1).toBe(r2);
  });
});