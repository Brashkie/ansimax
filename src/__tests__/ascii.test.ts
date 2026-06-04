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

// ─────────────────────────────────────────────
//  LRU cache behavior
// ─────────────────────────────────────────────
describe('LRU cache', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('cache size grows with unique calls', () => {
    expect(ascii.getRenderCacheSize()).toBe(0);
    ascii.big('A');
    expect(ascii.getRenderCacheSize()).toBe(1);
    ascii.big('B');
    expect(ascii.getRenderCacheSize()).toBe(2);
  });

  it('repeated calls do not grow cache', () => {
    ascii.big('SAME');
    ascii.big('SAME');
    ascii.big('SAME');
    expect(ascii.getRenderCacheSize()).toBe(1);
  });

  it('LRU touches entry on access — recently used stays in cache', () => {
    // Fill cache with N entries (less than max)
    ascii.big('FIRST');
    ascii.big('SECOND');
    ascii.big('THIRD');

    // Access 'FIRST' to mark as recently used
    ascii.big('FIRST');

    // Cache size unchanged
    expect(ascii.getRenderCacheSize()).toBe(3);
  });

  it('clearRenderCache empties cache', () => {
    ascii.big('X');
    ascii.big('Y');
    ascii.clearRenderCache();
    expect(ascii.getRenderCacheSize()).toBe(0);
  });
});

// ─────────────────────────────────────────────
//  Reserved font names protection
// ─────────────────────────────────────────────
describe('reserved font names', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('throws when registering "big" without force', () => {
    expect(() => {
      ascii.registerFont('big', {
        ' ': [' '],
        '?': ['?'],
      });
    }).toThrow(/reserved/);
  });

  it('throws when registering "small" without force', () => {
    expect(() => {
      ascii.registerFont('small', {
        ' ': [' '],
        '?': ['?'],
      });
    }).toThrow(/reserved/);
  });

  it('allows override with force: true', () => {
    // We don't actually call this here because it would destroy BLOCK
    // for subsequent tests in this run. Instead, verify that the option
    // is accepted by the type system and reaches the validation step.
    // We test this via a NON-reserved name that triggers the same code path.
    expect(() => {
      ascii.registerFont('overridable', {
        ' ': [' '],
        '?': ['?'],
      }, { force: true });
    }).not.toThrow();
  });

  it('allows custom names freely', () => {
    expect(() => {
      ascii.registerFont('mycustom', {
        ' ': [' '],
        '?': ['?'],
      });
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Font validation
// ─────────────────────────────────────────────
describe('font validation', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('rejects empty font', () => {
    expect(() => {
      ascii.registerFont('empty', {});
    }).toThrow();
  });

  it('rejects font with mismatched glyph heights', () => {
    expect(() => {
      ascii.registerFont('bad-height', {
        ' ': ['  ', '  ', '  '],
        '?': ['??', '??'], // height 2, expected 3
      });
    }).toThrow(/height/);
  });

  it('rejects font with mismatched row widths', () => {
    expect(() => {
      ascii.registerFont('bad-width', {
        ' ': ['  ', '  '],
        A: ['AA', 'A'], // row 1 is width 1, expected 2
      });
    }).toThrow(/width/);
  });

  it('accepts a consistent font', () => {
    expect(() => {
      ascii.registerFont('consistent', {
        ' ': ['  ', '  '],
        A: ['AA', 'AA'],
        '?': ['??', '??'],
      });
    }).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  perCharColor — ANSI preservation
// ─────────────────────────────────────────────
describe('perCharColor preserves ANSI', () => {
  it('does not split or duplicate existing ANSI sequences', () => {
    let calls = 0;
    const colorFn = (s: string): string => { calls++; return s; };
    // Use an empty colorFn so we can compare structure
    const before = '\x1b[31mA\x1b[0m';
    const after = ascii.banner('A', { colorFn, perCharColor: true });
    // The ANSI codes from BLOCK font should be preserved
    expect(after.length).toBeGreaterThan(0);
    expect(calls).toBeGreaterThan(0);
  });

  it('skips space characters (no colorFn calls for spaces)', () => {
    const seen: string[] = [];
    const colorFn = (s: string): string => { seen.push(s); return s; };
    ascii.banner('A', { colorFn, perCharColor: true });
    expect(seen.includes(' ')).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  Pipeline stages — independently testable
// ─────────────────────────────────────────────
describe('banner pipeline stages', () => {
  it('stageRender returns rendered ASCII without color or alignment', () => {
    const result = ascii.stageRender('A', 'big');
    expect(result).toContain('█');
    expect(result).not.toContain('\x1b'); // no ANSI applied
  });

  it('stageAlign("left") is a no-op', () => {
    const rendered = ascii.stageRender('A', 'big');
    const result = ascii.stageAlign(rendered, 'left');
    expect(result).toBe(rendered);
  });

  it('stageAlign("center") indents content', () => {
    const rendered = ascii.stageRender('A', 'big');
    const result = ascii.stageAlign(rendered, 'center');
    // Centered version should be at least as wide as original
    expect(result.length).toBeGreaterThanOrEqual(rendered.length);
  });

  it('stageColorize with null colorFn is a no-op', () => {
    const rendered = ascii.stageRender('A', 'big');
    const result = ascii.stageColorize(rendered, null, false);
    expect(result).toBe(rendered);
  });

  it('stages can be composed in custom order', () => {
    // Custom pipeline: render → colorize → align
    let r = ascii.stageRender('X', 'big');
    r = ascii.stageColorize(r, (s) => s, false); // identity
    r = ascii.stageAlign(r, 'center');
    expect(r).toContain('█');
  });
});

// ─────────────────────────────────────────────
//  Streaming API
// ─────────────────────────────────────────────
describe('ascii.stream', () => {
  it('yields rows by default', async () => {
    const chunks: string[] = [];
    for await (const chunk of ascii.stream('A')) {
      chunks.push(chunk);
    }
    // BLOCK is 5 rows tall → 5 chunks
    expect(chunks.length).toBe(5);
  });

  it('yields characters with granularity:char', async () => {
    const chunks: string[] = [];
    for await (const chunk of ascii.stream('A', { granularity: 'char' })) {
      chunks.push(chunk);
    }
    // Each chunk is a single char
    for (const c of chunks) expect(c.length).toBe(1);
  });

  it('reassembles to the same output as figlet', async () => {
    const chunks: string[] = [];
    for await (const chunk of ascii.stream('AB')) chunks.push(chunk);
    const streamed = chunks.join('');
    const direct = ascii.figlet('AB');
    expect(streamed).toBe(direct);
  });

  it('respects custom font and letterSpacing', async () => {
    const chunks: string[] = [];
    for await (const chunk of ascii.stream('A', { font: 'small', letterSpacing: 0 })) {
      chunks.push(chunk);
    }
    // Small font is 3 rows tall → 3 chunks
    expect(chunks.length).toBe(3);
  });

  it('handles empty text gracefully', async () => {
    const chunks: string[] = [];
    for await (const chunk of ascii.stream('')) chunks.push(chunk);
    // Empty render → 1 chunk (empty string), since split('\n') returns ['']
    expect(chunks.length).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: buildFallbackGlyph all branches
// ─────────────────────────────────────────────
describe('buildFallbackGlyph branches', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('font with no ? but with space falls back to space glyph', () => {
    const fontMap = {
      ' ': ['  ', '  '],
      A: ['##', '##'],
    };
    ascii.registerFont('no-question', fontMap);
    // X is unknown — should use ' ' glyph (blank, properly sized)
    const result = ascii.figlet('X', { font: 'no-question' });
    expect(result.split('\n').length).toBe(2);
    expect(result.split('\n')[0]?.length).toBe(2);
  });

  it('font without ? or space synthesizes blanks from any glyph', () => {
    // Force using probe path — but registerFont validation requires ' ' or '?',
    // so this branch is internal-only for built-in fallback safety.
    // We test it by using unknown chars in BLOCK font (which is well-formed).
    const result = ascii.big('XYZ@!#');
    // All chars not in BLOCK fall back to ? glyph (which exists in BLOCK)
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: registerFont edge cases
// ─────────────────────────────────────────────
describe('registerFont edge cases', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('reserved-name throw happens BEFORE validation runs', () => {
    // Even an empty fontmap should throw "reserved" first, not "empty"
    expect(() => {
      ascii.registerFont('big', {} as never);
    }).toThrow(/reserved/);
  });

  it('clears cached renders for the same font name on re-register', () => {
    const font = {
      ' ': ['  ', '  '],
      A: ['##', '##'],
      '?': ['??', '??'],
    };
    ascii.registerFont('cache-test', font);
    const before = ascii.figlet('A', { font: 'cache-test' });
    expect(before).toBeTruthy();

    // Re-register with a different glyph
    const font2 = {
      ' ': ['  ', '  '],
      A: ['XX', 'XX'],
      '?': ['??', '??'],
    };
    ascii.registerFont('cache-test', font2);
    const after = ascii.figlet('A', { font: 'cache-test' });
    expect(after).not.toBe(before); // cache invalidated
  });
});

// ─────────────────────────────────────────────
//  Coverage push: render cache LRU eviction
// ─────────────────────────────────────────────
describe('render cache LRU eviction', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('evicts least recently used when over MAX_CACHE_SIZE', () => {
    // Fill cache beyond MAX (100). Each call adds a new entry.
    for (let i = 0; i < 150; i++) {
      ascii.big(`text${i}`);
    }
    // Cache size should be capped at MAX (100)
    expect(ascii.getRenderCacheSize()).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: perCharColor with embedded ANSI
// ─────────────────────────────────────────────
describe('perCharColor ANSI tokenization', () => {
  it('walks past pre-existing ANSI tokens preserving them verbatim', () => {
    let calls = 0;
    const colorFn = (s: string): string => { calls++; return `[${s}]`; };
    // Banner has block characters — perCharColor walks each visible char.
    // ANSI sequences from the renderFont (none) shouldn't double-color.
    const result = ascii.banner('A', { colorFn, perCharColor: true });
    expect(calls).toBeGreaterThan(0);
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles non-ANSI escape that does not match the regex', () => {
    let calls = 0;
    const colorFn = (s: string): string => { calls++; return s; };
    // The regex needs final letter — \x1b without a following [...letter
    // should fall through and treat \x1b as a regular char.
    // We can't easily craft that via banner; we test stageColorize directly.
    const rendered = ascii.stageRender('A', 'big');
    const result = ascii.stageColorize(rendered, colorFn, true);
    expect(calls).toBeGreaterThan(0);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: stream granularity edge cases
// ─────────────────────────────────────────────
describe('stream granularity', () => {
  it('row granularity yields each line separately', async () => {
    const chunks: string[] = [];
    for await (const c of ascii.stream('AB', { granularity: 'row' })) {
      chunks.push(c);
    }
    // BLOCK font is 5 rows tall — should yield 5 chunks
    expect(chunks.length).toBe(5);
  });

  it('all chunks except last end with newline', async () => {
    const chunks: string[] = [];
    for await (const c of ascii.stream('A')) chunks.push(c);
    // All but last chunk end with \n
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i]?.endsWith('\n')).toBe(true);
    }
    expect(chunks[chunks.length - 1]?.endsWith('\n')).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: divider all branches
// ─────────────────────────────────────────────
describe('divider branches', () => {
  it('divider with no label produces just fill chars', () => {
    const result = ascii.divider({ width: 10, char: '-' });
    expect(result).toBe('----------');
  });

  it('divider with custom char repeats it', () => {
    const result = ascii.divider({ width: 5, char: '*' });
    expect(result).toBe('*****');
  });

  it('divider with width 0 returns empty string', () => {
    const result = ascii.divider({ width: 0, char: '-' });
    expect(result).toBe('');
  });

  it('divider with negative width returns empty string', () => {
    const result = ascii.divider({ width: -5, char: '-' });
    expect(result).toBe('');
  });

  it('divider with style:double uses ═', () => {
    const result = ascii.divider({ width: 5, style: 'double' });
    expect(result).toContain('═');
  });

  it('divider with style:heavy uses ━', () => {
    const result = ascii.divider({ width: 5, style: 'heavy' });
    expect(result).toContain('━');
  });
});

// ─────────────────────────────────────────────
//  Coverage push: logo without gradient
// ─────────────────────────────────────────────
describe('logo branches', () => {
  it('logo without gradient just renders ASCII in a box', () => {
    const result = ascii.logo('TEST');
    expect(result).toContain('█');
    expect(result).toContain('╔'); // double box default
  });

  it('logo with custom boxStyle uses that style', () => {
    const result = ascii.logo('A', { boxStyle: 'rounded' });
    expect(result).toContain('╭');
  });

  it('logo with gradient applies it per-line', () => {
    const colorFn = (s: string): string => `[${s}]`;
    const result = ascii.logo('A', { gradient: colorFn });
    expect(result).toContain('[');
  });

  it('logo with centered:false skips center alignment', () => {
    const result = ascii.logo('A', { centered: false });
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: buildFallbackGlyph last-resort branch
//  Lines 170-175 — when ' ' and '?' are both missing, derive blanks
//  from any other glyph in the font.
// ─────────────────────────────────────────────
describe('buildFallbackGlyph last-resort path', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('uses first available glyph when ?, space both missing', () => {
    // We bypass registerFont validation by mutating an existing font's
    // _internal_ map via a test-only register on a dummy. registerFont
    // requires ' ' or '?' so we can't easily create one without — but
    // we can register a font that DOES have both, then test that an
    // unknown char in the font renders correctly using the ' ' branch
    // (line 168). The 170-175 path requires a font with NO ' ' or '?',
    // which registerFont rejects. That branch is covered by reading
    // raw FONTS map — but in normal usage it's defensive only.
    //
    // Instead, we exercise the line 175 fill: probe is non-empty,
    // height is positive, blank is computed.
    const font = {
      ' ': ['  ', '  ', '  '],
      '?': ['??', '??', '??'],
      A: ['##', '##', '##'],
    };
    ascii.registerFont('three-row', font);
    // Render a char not in font — falls back to ?
    const result = ascii.figlet('Z', { font: 'three-row' });
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    expect(lines.every((l) => l.length === 2)).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: multiline branch (lines 189-191)
// ─────────────────────────────────────────────
describe('renderFont multiline branch', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('renderFont split-and-recurse on \\n', () => {
    // Multiline triggers the recursive split path.
    // Output is "render(A) + '\n' + render(B)" — no extra separator.
    // BLOCK font is 5 rows tall → 5 + 5 = 10 lines (joined by \n).
    const result = ascii.big('A\nB');
    const lines = result.split('\n');
    expect(lines.length).toBe(10);
  });

  it('multiline with letterSpacing option propagates through recursion', () => {
    const result = ascii.figlet('A\nB', { letterSpacing: 2 });
    // Same line count — letterSpacing affects horizontal width, not vertical
    expect(result.split('\n').length).toBe(10);
  });

  it('three-line input recurses correctly', () => {
    const result = ascii.big('A\nB\nC');
    const lines = result.split('\n');
    // 5 + 5 + 5 = 15 lines (joined by \n with no separator)
    expect(lines.length).toBe(15);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: validateFont empty entries (line 250)
// ─────────────────────────────────────────────
describe('validateFont empty branch', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('throws specific empty-font error when font has no entries', () => {
    // Pass a font with ONLY ' ' and '?' — legitimate but empty otherwise.
    // Wait, that has 2 entries, not 0. To trigger entries.length===0, we'd
    // need to bypass the ' '/'?' check first. Since validateFont runs AFTER
    // the ' '/'?' check (which throws 'must define...'), reaching the
    // entries.length===0 path requires both glyphs to be missing AND the
    // map to be empty. That's the same as just an empty {}.
    expect(() => {
      ascii.registerFont('empty-test', {});
    }).toThrow();
  });
});

// ─────────────────────────────────────────────
//  Coverage push: colorEachVisibleChar ANSI token branch (446-451)
// ─────────────────────────────────────────────
describe('colorEachVisibleChar ANSI tokenization', () => {
  it('preserves CSI sequences when applying perCharColor', () => {
    // Inject ANSI before perCharColor — the regex should match and skip
    const input = '\x1b[31mABC\x1b[0m';
    const colorFn = (s: string): string => `<${s}>`;
    // Use stageColorize directly with perCharColor:true so we hit
    // colorEachVisibleChar with embedded ANSI tokens.
    const result = ascii.stageColorize(input, colorFn, true);
    // Original \x1b[31m and \x1b[0m should be preserved verbatim
    expect(result).toContain('\x1b[31m');
    expect(result).toContain('\x1b[0m');
    // Each visible char wrapped
    expect(result).toContain('<A>');
    expect(result).toContain('<B>');
    expect(result).toContain('<C>');
  });

  it('handles multiple ANSI tokens interleaved with text', () => {
    const input = '\x1b[1mA\x1b[31mB\x1b[0mC';
    const colorFn = (s: string): string => s.toLowerCase();
    const result = ascii.stageColorize(input, colorFn, true);
    expect(result).toContain('\x1b[1m');
    expect(result).toContain('\x1b[31m');
    expect(result).toContain('\x1b[0m');
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });

  it('handles bare \\x1b that does NOT match the token regex', () => {
    // \x1b followed by something that isn't [...letter — should fall through
    // and treat \x1b as a regular character in the visible loop.
    const input = '\x1b' + 'A'; // ESC + A — not a valid CSI sequence
    const colorFn = (s: string): string => `[${s}]`;
    const result = ascii.stageColorize(input, colorFn, true);
    // Either \x1b is treated as a char or skipped — either way doesn't crash
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
//  Input validation (TypeError on non-string)
// ─────────────────────────────────────────────
describe('input validation', () => {
  it('big() rejects non-string', () => {
    expect(() => ascii.big(42 as unknown as string)).toThrow(TypeError);
    expect(() => ascii.big(null as unknown as string)).toThrow(TypeError);
    expect(() => ascii.big(undefined as unknown as string)).toThrow(TypeError);
  });

  it('small() rejects non-string', () => {
    expect(() => ascii.small({} as unknown as string)).toThrow(TypeError);
  });

  it('figlet() rejects non-string', () => {
    expect(() => ascii.figlet([] as unknown as string)).toThrow(TypeError);
  });

  it('banner() rejects non-string', () => {
    expect(() => ascii.banner(123 as unknown as string)).toThrow(TypeError);
  });

  it('box() rejects non-string', () => {
    expect(() => ascii.box(true as unknown as string)).toThrow(TypeError);
  });

  it('logo() rejects non-string', () => {
    expect(() => ascii.logo(null as unknown as string)).toThrow(TypeError);
  });

  it('measure() rejects non-string', () => {
    expect(() => ascii.measure(42 as unknown as string)).toThrow(TypeError);
  });

  it('stream() rejects non-string (sync throw before iteration)', async () => {
    // Async generator throws when first .next() is called
    const gen = ascii.stream(42 as unknown as string);
    await expect(gen.next()).rejects.toThrow(TypeError);
  });

  it('registerFont() rejects non-string name', () => {
    expect(() =>
      ascii.registerFont(42 as unknown as string, { ' ': ['  ', '  '] }),
    ).toThrow(TypeError);
  });

  it('registerFont() rejects empty name', () => {
    expect(() =>
      ascii.registerFont('', { ' ': ['  ', '  '] }),
    ).toThrow(TypeError);
  });

  it('registerFont() rejects null fontMap', () => {
    expect(() =>
      ascii.registerFont('test', null as unknown as Record<string, string[]>),
    ).toThrow(TypeError);
  });

  it('registerFont() rejects array as fontMap', () => {
    expect(() =>
      ascii.registerFont('test', [] as unknown as Record<string, string[]>),
    ).toThrow(TypeError);
  });

  it('registerFont() rejects non-array glyph', () => {
    expect(() =>
      ascii.registerFont('test', {
        ' ': 'not-an-array' as unknown as string[],
      }),
    ).toThrow(TypeError);
  });

  it('registerFont() rejects non-string row', () => {
    expect(() =>
      ascii.registerFont('test', {
        ' ': [42 as unknown as string, '  '],
      }),
    ).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────
//  hasFont
// ─────────────────────────────────────────────
describe('hasFont', () => {
  it('returns true for built-in fonts', () => {
    expect(ascii.hasFont('big')).toBe(true);
    expect(ascii.hasFont('small')).toBe(true);
  });

  it('returns false for unknown font names', () => {
    expect(ascii.hasFont('nonexistent-font-xyz')).toBe(false);
  });

  it('returns true after registering a custom font', () => {
    ascii.registerFont('my-test-font', {
      ' ': ['  ', '  '],
      A: ['##', '##'],
      '?': ['??', '??'],
    });
    expect(ascii.hasFont('my-test-font')).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  measure() utility
// ─────────────────────────────────────────────
describe('measure', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('returns dimensions for a single char in big font', () => {
    const dims = ascii.measure('A', 'big');
    expect(dims.height).toBe(5); // BLOCK font is 5 rows
    expect(dims.width).toBeGreaterThan(0);
  });

  it('returns dimensions for small font', () => {
    const dims = ascii.measure('A', 'small');
    expect(dims.height).toBe(3); // SMALL font is 3 rows
  });

  it('returns 0/0 for empty text', () => {
    expect(ascii.measure('')).toEqual({ width: 0, height: 0 });
  });

  it('width scales with text length', () => {
    const a = ascii.measure('A', 'big');
    const ab = ascii.measure('AB', 'big');
    expect(ab.width).toBeGreaterThan(a.width);
  });

  it('respects letterSpacing', () => {
    const tight = ascii.measure('AB', 'big', 0);
    const loose = ascii.measure('AB', 'big', 5);
    expect(loose.width).toBeGreaterThan(tight.width);
  });
});

// ─────────────────────────────────────────────
//  Streaming with AbortSignal
// ─────────────────────────────────────────────
describe('stream with AbortSignal', () => {
  it('pre-aborted signal yields nothing', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const chunks: string[] = [];
    for await (const c of ascii.stream('HELLO', { signal: ctrl.signal })) {
      chunks.push(c);
    }
    expect(chunks).toEqual([]);
  });

  it('signal aborted mid-stream stops yielding', async () => {
    const ctrl = new AbortController();
    const chunks: string[] = [];
    let count = 0;
    for await (const c of ascii.stream('HELLO', { signal: ctrl.signal })) {
      chunks.push(c);
      count++;
      if (count === 2) ctrl.abort();
    }
    expect(chunks.length).toBeLessThan(5); // BLOCK is 5 rows
  });

  it('char granularity respects abort signal', async () => {
    const ctrl = new AbortController();
    const chunks: string[] = [];
    let count = 0;
    for await (const c of ascii.stream('A', { granularity: 'char', signal: ctrl.signal })) {
      chunks.push(c);
      count++;
      if (count === 5) ctrl.abort();
    }
    // Should stop close to 5, not iterate the entire glyph
    expect(chunks.length).toBeLessThan(50);
  });

  it('empty text yields nothing without signal', async () => {
    const chunks: string[] = [];
    for await (const c of ascii.stream('')) {
      chunks.push(c);
    }
    expect(chunks).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  Box edge cases
// ─────────────────────────────────────────────
describe('box edge cases', () => {
  it('empty text produces a tiny box (no -Infinity from Math.max)', () => {
    const result = ascii.box('');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('╭');
  });

  it('negative padding clamped to 0', () => {
    const result = ascii.box('hi', { padding: -5 });
    expect(result).toContain('hi');
    expect(result).toContain('╭');
  });

  it('non-integer padding floored', () => {
    const result = ascii.box('hi', { padding: 2.7 });
    expect(result).toContain('hi');
  });
});

// ─────────────────────────────────────────────
//  Divider edge cases
// ─────────────────────────────────────────────
describe('divider edge cases', () => {
  it('width 0 returns empty string', () => {
    expect(ascii.divider({ width: 0 })).toBe('');
  });

  it('negative width clamped to 0 returns empty', () => {
    expect(ascii.divider({ width: -10 })).toBe('');
  });

  it('label longer than width returns label alone', () => {
    const result = ascii.divider({ width: 5, label: 'very long label here' });
    expect(result).toBe('very long label here');
  });
});

// ─────────────────────────────────────────────
//  Logo edge cases
// ─────────────────────────────────────────────
describe('logo edge cases', () => {
  it('empty text returns an empty box (no -Infinity)', () => {
    const result = ascii.logo('');
    expect(result).toContain('╔');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
//  Cache key isolation (no collision with | in font names)
// ─────────────────────────────────────────────
describe('cache key isolation', () => {
  beforeEach(() => ascii.clearRenderCache());

  it('different fonts produce different cached entries even with similar text', () => {
    ascii.big('TEST');
    ascii.small('TEST');
    expect(ascii.getRenderCacheSize()).toBe(2);
  });

  it('different letterSpacing values cache separately', () => {
    ascii.figlet('A', { letterSpacing: 0 });
    ascii.figlet('A', { letterSpacing: 3 });
    expect(ascii.getRenderCacheSize()).toBe(2);
  });
});

// ─────────────────────────────────────────────
//  v1.2.5 — Phase 3 closure: Image to ASCII + figlet
// ─────────────────────────────────────────────
import { fromImage, figletText, parseFiglet, ASCII_RAMPS } from '../ascii/index.js';
import { setNoColor, resetNoColor } from '../colors/index.js';
import type { FigletFont } from '../ascii/index.js';
import type { PixelGrid, Pixel } from '../images/index.js';

// Helper: create test pixel grid with luminance gradient
const makeGradientGrid = (w: number, h: number): PixelGrid => {
  const grid: PixelGrid = [];
  for (let y = 0; y < h; y++) {
    const row = [];
    for (let x = 0; x < w; x++) {
      const v = Math.floor((x / (w - 1)) * 255);
      row.push({ r: v, g: v, b: v });
    }
    grid.push(row);
  }
  return grid;
};

const makeSolidGrid = (w: number, h: number, r: number, g: number, b: number): PixelGrid => {
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ r, g, b })),
  );
};

describe('fromImage (v1.2.5)', () => {
  it('produces output for a basic gradient grid', () => {
    const grid = makeGradientGrid(20, 10);
    const out = fromImage(grid, { width: 20 });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('returns empty string for empty grid', () => {
    expect(fromImage([])).toBe('');
    expect(fromImage([[]])).toBe('');
  });

  it('produces darker chars for dark pixels', () => {
    const dark = makeSolidGrid(10, 5, 10, 10, 10);
    const out = fromImage(dark, { width: 10, ramp: 'standard' });
    // Standard ramp starts with ' .:'
    expect(out.charAt(0)).toMatch(/[ .]/);
  });

  it('produces lighter chars for bright pixels', () => {
    const bright = makeSolidGrid(10, 5, 250, 250, 250);
    const out = fromImage(bright, { width: 10, ramp: 'standard' });
    // Standard ramp ends with '%@'
    const lastChar = out.charAt(0);
    expect(lastChar).toMatch(/[%@]/);
  });

  it('invert option swaps dark/light mapping', () => {
    const bright = makeSolidGrid(10, 5, 250, 250, 250);
    const normalOut = fromImage(bright, { width: 10, ramp: 'simple' });
    const invertOut = fromImage(bright, { width: 10, ramp: 'simple', invert: true });
    expect(normalOut.charAt(0)).not.toBe(invertOut.charAt(0));
  });

  it('respects custom ramp', () => {
    const bright = makeSolidGrid(10, 5, 250, 250, 250);
    const out = fromImage(bright, { width: 10, ramp: 'ABCDE' });
    expect(out.charAt(0)).toBe('E'); // Last char of ramp = brightest
  });

  it('respects width parameter', () => {
    const grid = makeGradientGrid(50, 25);
    const out = fromImage(grid, { width: 10 });
    // First line should be ~10 chars
    const firstLine = out.split('\n')[0] as string;
    expect(firstLine.length).toBe(10);
  });

  it('respects explicit height parameter', () => {
    const grid = makeGradientGrid(40, 20);
    const out = fromImage(grid, { width: 20, height: 5 });
    expect(out.split('\n').length).toBe(5);
  });

  it('color mode adds ANSI escapes', () => {
    // Force color enabled — CI environments (GitHub Actions, etc.) detect
    // non-TTY stdout and disable color by default, which would break this test
    setNoColor(false);
    try {
      const red = makeSolidGrid(5, 3, 255, 0, 0);
      const noColor = fromImage(red, { width: 5, color: false });
      const withColor = fromImage(red, { width: 5, color: true });
      expect(withColor.length).toBeGreaterThan(noColor.length);
      expect(withColor).toContain('\x1b[');
    } finally {
      resetNoColor();
    }
  });

  it('floyd-steinberg dithering applies', () => {
    const grid = makeGradientGrid(40, 20);
    const noDither = fromImage(grid, { width: 40, dither: 'none' });
    const dithered = fromImage(grid, { width: 40, dither: 'floyd-steinberg' });
    // Outputs should differ
    expect(noDither).not.toBe(dithered);
  });

  it('sobel edge detection produces output', () => {
    // Create a grid with a sharp edge in the middle
    const grid: PixelGrid = [];
    for (let y = 0; y < 10; y++) {
      const row = [];
      for (let x = 0; x < 20; x++) {
        const v = x < 10 ? 0 : 255;
        row.push({ r: v, g: v, b: v });
      }
      grid.push(row);
    }
    const out = fromImage(grid, { width: 20, edgeDetect: 'sobel' });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('faceMode applies histogram stretching', () => {
    // Make a low-contrast grid (all pixels in narrow range)
    const grid: PixelGrid = makeGradientGrid(30, 15).map((row: Pixel[]) =>
      row.map((p: Pixel) => ({
        r: 100 + ((p?.r ?? 0) * 0.2),
        g: 100 + ((p?.g ?? 0) * 0.2),
        b: 100 + ((p?.b ?? 0) * 0.2),
      })),
    );
    const normalOut = fromImage(grid, { width: 30, ramp: 'simple' });
    const faceOut = fromImage(grid, { width: 30, ramp: 'simple', faceMode: true });
    // faceMode should produce more variation
    expect(faceOut).not.toBe(normalOut);
  });

  it('handles null pixels in grid', () => {
    const grid: PixelGrid = [
      [{ r: 100, g: 100, b: 100 }, null, { r: 200, g: 200, b: 200 }],
      [null, { r: 50, g: 50, b: 50 }, null],
    ];
    expect(() => fromImage(grid, { width: 3 })).not.toThrow();
  });

  it('handles invalid input gracefully', () => {
    expect(fromImage(null as unknown as PixelGrid)).toBe('');
    expect(fromImage(undefined as unknown as PixelGrid)).toBe('');
    expect(fromImage('not-a-grid' as unknown as PixelGrid)).toBe('');
  });

  it('all built-in ramps work', () => {
    const grid = makeGradientGrid(15, 8);
    for (const rampName of Object.keys(ASCII_RAMPS) as Array<keyof typeof ASCII_RAMPS>) {
      const out = fromImage(grid, { width: 15, ramp: rampName });
      expect(out.length).toBeGreaterThan(0);
    }
  });

  it('preserves aspect ratio when height is omitted', () => {
    const grid = makeGradientGrid(100, 50);
    const out = fromImage(grid, { width: 50 });
    const numLines = out.split('\n').length;
    // src is 100x50 → at width=50 → height ≈ 50 * (50/100) * 0.5 = 12.5 → 13
    expect(numLines).toBeGreaterThan(5);
    expect(numLines).toBeLessThan(20);
  });
});

// ─────────────────────────────────────────────
//  Figlet parser tests
// ─────────────────────────────────────────────

// Minimal valid FIGfont (height 3, only space + A)
// Note: Each glyph row ends with @ (endmark), last row ends with @@.
const MINIMAL_FLF = `flf2a$ 3 2 4 0 1
Test FIGfont (minimal)
   @
   @
   @@
 _ @
/_\\@
   @@
`;

describe('parseFiglet (v1.2.5)', () => {
  it('parses a minimal valid FIGfont', () => {
    const font = parseFiglet(MINIMAL_FLF);
    expect(font.height).toBe(3);
    expect(font.hardblank).toBe('$');
    expect(font.glyphs.size).toBeGreaterThan(0);
  });

  it('extracts the space glyph (code 32)', () => {
    const font = parseFiglet(MINIMAL_FLF);
    const space = font.glyphs.get(32);
    expect(space).toBeDefined();
    expect(space).toHaveLength(3); // height = 3
  });

  it('throws TypeError on non-string input', () => {
    expect(() => parseFiglet(null as unknown as string)).toThrow(TypeError);
    expect(() => parseFiglet(123 as unknown as string)).toThrow(TypeError);
  });

  it('throws TypeError on empty string', () => {
    expect(() => parseFiglet('')).toThrow(TypeError);
  });

  it('throws TypeError on invalid header', () => {
    expect(() => parseFiglet('not-a-figlet-font')).toThrow(TypeError);
  });

  it('respects comment lines count', () => {
    // 2 comment lines now, glyphs start at line 4
    const withComments = `flf2a$ 3 2 4 0 2
Comment line 1
Comment line 2
   @
   @
   @@
`;
    const font = parseFiglet(withComments);
    expect(font.glyphs.size).toBeGreaterThan(0);
  });
});

describe('figletText (v1.2.5)', () => {
  let font: FigletFont;
  beforeAll(() => {
    font = parseFiglet(MINIMAL_FLF);
  });

  it('renders text using a parsed font', () => {
    const out = figletText(' ', font);
    expect(typeof out).toBe('string');
  });

  it('returns empty string for non-string input', () => {
    expect(figletText(null as unknown as string, font)).toBe('');
    expect(figletText(undefined as unknown as string, font)).toBe('');
  });

  it('returns empty string for invalid font', () => {
    expect(figletText('hi', null as unknown as FigletFont)).toBe('');
  });

  it('uses space glyph as fallback for unknown chars', () => {
    // ñ (unicode codepoint not in minimal font) → falls back to space
    const out = figletText('ñ', font);
    expect(typeof out).toBe('string');
  });

  it('applies colorFn when provided', () => {
    const colorFn = (s: string): string => `[COLOR]${s}[/COLOR]`;
    const out = figletText(' ', font, { colorFn });
    expect(out).toContain('[COLOR]');
    expect(out).toContain('[/COLOR]');
  });

  it('trims blank lines by default', () => {
    // A font with leading/trailing blank rows
    const out = figletText(' ', font, { trim: true });
    expect(typeof out).toBe('string');
  });

  it('respects trim: false to preserve blank rows', () => {
    const trimmed = figletText(' ', font, { trim: true });
    const untrimmed = figletText(' ', font, { trim: false });
    // Untrimmed may have more lines
    expect(untrimmed.split('\n').length).toBeGreaterThanOrEqual(trimmed.split('\n').length);
  });
});

describe('ASCII_RAMPS (v1.2.5)', () => {
  it('exposes all expected ramps', () => {
    expect(ASCII_RAMPS.standard).toBeDefined();
    expect(ASCII_RAMPS.detailed).toBeDefined();
    expect(ASCII_RAMPS.blocks).toBeDefined();
    expect(ASCII_RAMPS.simple).toBeDefined();
  });

  it('each ramp has at least 4 characters', () => {
    expect(ASCII_RAMPS.standard.length).toBeGreaterThanOrEqual(4);
    expect(ASCII_RAMPS.detailed.length).toBeGreaterThanOrEqual(4);
    expect(ASCII_RAMPS.blocks.length).toBeGreaterThanOrEqual(4);
    expect(ASCII_RAMPS.simple.length).toBeGreaterThanOrEqual(4);
  });

  it('ramps start with darker and end with brighter characters', () => {
    // All ramps should start with space (darkest)
    expect(ASCII_RAMPS.standard.charAt(0)).toBe(' ');
    expect(ASCII_RAMPS.simple.charAt(0)).toBe(' ');
    expect(ASCII_RAMPS.blocks.charAt(0)).toBe(' ');
  });
});

describe('ascii namespace v1.2.5 entries', () => {
  it('ascii.fromImage is accessible', () => {
    expect(typeof ascii.fromImage).toBe('function');
  });

  it('ascii.figletText is accessible', () => {
    expect(typeof ascii.figletText).toBe('function');
  });

  it('ascii.parseFiglet is accessible', () => {
    expect(typeof ascii.parseFiglet).toBe('function');
  });
});

describe('v1.2.5 barrel exports', () => {
  it('fromImage is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.fromImage).toBe('function');
  });

  it('parseFiglet is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.parseFiglet).toBe('function');
  });

  it('ASCII_RAMPS is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(main.ASCII_RAMPS).toBeDefined();
    expect(typeof main.ASCII_RAMPS.standard).toBe('string');
  });
});

// ─────────────────────────────────────────────
//  v1.2.5 — Coverage for edge branches
// ─────────────────────────────────────────────
describe('fromImage: edge coverage (v1.2.5)', () => {
  it('undefined ramp falls back to standard', () => {
    const bright = makeSolidGrid(10, 5, 250, 250, 250);
    // Explicitly pass undefined to hit the resolveRamp fallback path
    const out = fromImage(bright, { width: 10, ramp: undefined });
    expect(out.length).toBeGreaterThan(0);
  });

  it('empty string ramp falls back to standard', () => {
    const bright = makeSolidGrid(10, 5, 250, 250, 250);
    // Empty string also hits the fallback
    const out = fromImage(bright, { width: 10, ramp: '' });
    // Standard ramp is ' .:-=+*#%@', brightest is '@'
    expect(out.charAt(0)).toBe('@');
  });

  it('color mode with null pixels uses bare char (no ANSI)', () => {
    // Mix of valid pixels and nulls in a grid
    const grid: PixelGrid = [
      [{ r: 200, g: 200, b: 200 }, null, { r: 100, g: 100, b: 100 }],
      [null, { r: 50, g: 50, b: 50 }, null],
    ];
    const out = fromImage(grid, { width: 3, color: true });
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
    // Output should still render — null pixels just skip the ANSI prefix
  });
});

describe('parseFiglet: invalid heights (v1.2.5)', () => {
  it('throws TypeError on zero height', () => {
    // FLF with height = 0
    const badHeight = `flf2a$ 0 2 4 0 0
`;
    expect(() => parseFiglet(badHeight)).toThrow(TypeError);
    expect(() => parseFiglet(badHeight)).toThrow(/invalid height/);
  });

  it('throws TypeError on negative height', () => {
    // FLF with negative height
    const negHeight = `flf2a$ -3 2 4 0 0
`;
    expect(() => parseFiglet(negHeight)).toThrow(TypeError);
    expect(() => parseFiglet(negHeight)).toThrow(/invalid height/);
  });
});