// ─────────────────────────────────────────────
//  ansimax/markdown — Syntax highlighter tests
//  v1.4.5
// ─────────────────────────────────────────────

import { highlight, tokenize, isHighlightSupported } from '../markdown/syntax.js';
import { stripAnsi } from '../utils/helpers.js';
import { setNoColor, resetNoColor, clearColorCache } from '../colors/index.js';
import { resetColorSupportCache } from '../utils/ansi.js';

describe('isHighlightSupported (v1.4.5)', () => {
  it('returns true for known languages', () => {
    expect(isHighlightSupported('js')).toBe(true);
    expect(isHighlightSupported('javascript')).toBe(true);
    expect(isHighlightSupported('ts')).toBe(true);
    expect(isHighlightSupported('typescript')).toBe(true);
    expect(isHighlightSupported('json')).toBe(true);
    expect(isHighlightSupported('bash')).toBe(true);
    expect(isHighlightSupported('sh')).toBe(true);
  });

  it('accepts uppercase language names', () => {
    expect(isHighlightSupported('JS')).toBe(true);
    expect(isHighlightSupported('TypeScript')).toBe(true);
  });

  it('returns false for unknown languages', () => {
    expect(isHighlightSupported('rust')).toBe(false);
    expect(isHighlightSupported('python')).toBe(false);
    expect(isHighlightSupported('')).toBe(false);
  });

  it('handles non-string input defensively', () => {
    // @ts-expect-error testing runtime robustness
    expect(isHighlightSupported(null)).toBe(false);
    // @ts-expect-error testing runtime robustness
    expect(isHighlightSupported(42)).toBe(false);
  });
});

describe('tokenize — JavaScript (v1.4.5)', () => {
  it('recognizes keywords', () => {
    const tokens = tokenize('const x = 42;', 'js');
    expect(tokens[0]).toEqual({ kind: 'keyword', text: 'const' });
  });

  it('recognizes strings with double quotes', () => {
    const tokens = tokenize('"hello"', 'js');
    expect(tokens[0]).toEqual({ kind: 'string', text: '"hello"' });
  });

  it('recognizes strings with single quotes', () => {
    const tokens = tokenize("'world'", 'js');
    expect(tokens[0]).toEqual({ kind: 'string', text: "'world'" });
  });

  it('recognizes template literals', () => {
    const tokens = tokenize('`template`', 'js');
    expect(tokens[0]).toEqual({ kind: 'string', text: '`template`' });
  });

  it('recognizes line comments', () => {
    const tokens = tokenize('// comment', 'js');
    expect(tokens[0]).toEqual({ kind: 'comment', text: '// comment' });
  });

  it('recognizes block comments', () => {
    const tokens = tokenize('/* multi\nline */', 'js');
    expect(tokens[0]?.kind).toBe('comment');
  });

  it('recognizes numbers (int, float, exponent)', () => {
    expect(tokenize('42', 'js')[0]).toEqual({ kind: 'number', text: '42' });
    expect(tokenize('3.14', 'js')[0]).toEqual({ kind: 'number', text: '3.14' });
    expect(tokenize('1e5', 'js')[0]).toEqual({ kind: 'number', text: '1e5' });
  });

  it('recognizes booleans + null', () => {
    expect(tokenize('true', 'js')[0]?.kind).toBe('boolean');
    expect(tokenize('false', 'js')[0]?.kind).toBe('boolean');
    expect(tokenize('null', 'js')[0]?.kind).toBe('null');
    expect(tokenize('undefined', 'js')[0]?.kind).toBe('null');
  });

  it('detects object property (identifier followed by colon)', () => {
    const tokens = tokenize('{ name: "x" }', 'js');
    const name = tokens.find((t) => t.text === 'name');
    expect(name?.kind).toBe('property');
  });

  it('treats non-keyword identifiers as plain', () => {
    const tokens = tokenize('foo', 'js');
    expect(tokens[0]?.kind).toBe('plain');
  });

  it('round-trips: concatenating token texts equals input', () => {
    const src = 'const x = { a: 1, b: "s" };\n// end';
    const tokens = tokenize(src, 'js');
    const restored = tokens.map((t) => t.text).join('');
    expect(restored).toBe(src);
  });
});

describe('tokenize — TypeScript (v1.4.5)', () => {
  it('recognizes TS-only keywords', () => {
    const tokens = tokenize('interface Foo { }', 'ts');
    expect(tokens[0]?.kind).toBe('keyword');
    expect(tokens[0]?.text).toBe('interface');
  });

  it('recognizes primitive type names as keywords', () => {
    const tokens = tokenize('type X = string', 'ts');
    const str = tokens.find((t) => t.text === 'string');
    expect(str?.kind).toBe('keyword');
  });

  it('accepts aliases (typescript, tsx)', () => {
    expect(tokenize('interface X', 'typescript')[0]?.kind).toBe('keyword');
    expect(tokenize('interface X', 'tsx')[0]?.kind).toBe('keyword');
  });
});

describe('tokenize — JSON (v1.4.5)', () => {
  it('recognizes strings', () => {
    const tokens = tokenize('"key"', 'json');
    expect(tokens[0]).toEqual({ kind: 'string', text: '"key"' });
  });

  it('recognizes numbers, booleans, null', () => {
    expect(tokenize('42', 'json')[0]?.kind).toBe('number');
    expect(tokenize('true', 'json')[0]?.kind).toBe('boolean');
    expect(tokenize('null', 'json')[0]?.kind).toBe('null');
  });

  it('does NOT treat identifiers as keywords (JSON has no keywords)', () => {
    // In pure JSON grammar there's no keyword rule at all
    const tokens = tokenize('foo', 'json');
    // Identifier chars fall through as plain individual chars
    expect(tokens.every((t) => t.kind === 'plain')).toBe(true);
  });
});

describe('tokenize — Bash (v1.4.5)', () => {
  it('recognizes comments starting with #', () => {
    const tokens = tokenize('# comment', 'bash');
    expect(tokens[0]).toEqual({ kind: 'comment', text: '# comment' });
  });

  it('recognizes variables ($VAR, ${VAR})', () => {
    expect(tokenize('$HOME', 'bash')[0]?.kind).toBe('property');
    expect(tokenize('${PATH}', 'bash')[0]?.kind).toBe('property');
  });

  it('recognizes keywords (if, then, else, ...)', () => {
    const tokens = tokenize('if true; then echo hi; fi', 'bash');
    expect(tokens[0]?.kind).toBe('keyword');   // 'if'
  });

  it('aliases sh, shell, zsh work', () => {
    expect(tokenize('# c', 'sh')[0]?.kind).toBe('comment');
    expect(tokenize('# c', 'shell')[0]?.kind).toBe('comment');
    expect(tokenize('# c', 'zsh')[0]?.kind).toBe('comment');
  });
});

describe('tokenize — fallback (v1.4.5)', () => {
  it('unsupported language returns single plain token', () => {
    const tokens = tokenize('let x = 1', 'rust');
    expect(tokens.length).toBe(1);
    expect(tokens[0]).toEqual({ kind: 'plain', text: 'let x = 1' });
  });
});

describe('highlight (v1.4.5)', () => {
  beforeEach(() => {
    setNoColor(false);
    // Force color support for hex output
    process.env.FORCE_COLOR = '3';
    resetColorSupportCache();
    clearColorCache();
  });
  afterEach(() => {
    resetNoColor();
    delete process.env.FORCE_COLOR;
    resetColorSupportCache();
    clearColorCache();
  });

  it('returns code unchanged for unsupported language', () => {
    const code = 'let mut x = 1;';
    expect(highlight(code, 'rust')).toBe(code);
  });

  it('wraps tokens with ANSI escapes for supported language', () => {
    const result = highlight('const x = 42;', 'js');
    // Should contain ANSI escape codes
    expect(result).toMatch(/\x1b\[/);
    // Stripped result equals original
    expect(stripAnsi(result)).toBe('const x = 42;');
  });

  it('applies dim + color to comments', () => {
    const result = highlight('// hello', 'js');
    // Dim is code 2
    expect(result).toContain('\x1b[2m');
    expect(stripAnsi(result)).toBe('// hello');
  });

  it('applies bold to keywords', () => {
    const result = highlight('const x', 'js');
    // Bold is code 1
    expect(result).toContain('\x1b[1m');
  });

  it('accepts light theme', () => {
    const dark = highlight('const x = 1', 'js', 'dark');
    const light = highlight('const x = 1', 'js', 'light');
    // Both produce ANSI but with different hex codes
    expect(stripAnsi(dark)).toBe('const x = 1');
    expect(stripAnsi(light)).toBe('const x = 1');
    expect(dark).not.toBe(light);
  });

  it('preserves newlines and whitespace exactly', () => {
    const src = 'const x = 1;\nconst y = 2;';
    const result = highlight(src, 'js');
    expect(stripAnsi(result)).toBe(src);
  });

  it('handles empty code', () => {
    expect(highlight('', 'js')).toBe('');
  });

  it('handles code with only whitespace', () => {
    const result = highlight('   \n   ', 'js');
    expect(stripAnsi(result)).toBe('   \n   ');
  });
});

// ─────────────────────────────────────────────
//  Barrel re-exports
// ─────────────────────────────────────────────

describe('v1.4.5 — barrel re-exports', () => {
  it('highlight/tokenize/isHighlightSupported exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.highlightCode).toBe('function');
    expect(typeof main.tokenizeCode).toBe('function');
    expect(typeof main.isHighlightSupported).toBe('function');
  });

  it('accessible on markdown namespace', async () => {
    const { markdown } = await import('../index.js');
    expect(typeof markdown.highlight).toBe('function');
    expect(typeof markdown.tokenize).toBe('function');
    expect(typeof markdown.isHighlightSupported).toBe('function');
  });
});
