/**
 * Tests for src/json/index.ts
 */

import { pretty, json } from '../json/index.js';
import { stripAnsi } from '../utils/helpers.js';
import { setNoColor, resetNoColor } from '../colors/index.js';

describe('json.pretty: primitives (v1.3.0)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('renders null', () => {
    expect(stripAnsi(pretty(null))).toBe('null');
  });

  it('renders undefined', () => {
    expect(stripAnsi(pretty(undefined))).toBe('undefined');
  });

  it('renders booleans', () => {
    expect(stripAnsi(pretty(true))).toBe('true');
    expect(stripAnsi(pretty(false))).toBe('false');
  });

  it('renders numbers', () => {
    expect(stripAnsi(pretty(42))).toBe('42');
    expect(stripAnsi(pretty(3.14))).toBe('3.14');
    expect(stripAnsi(pretty(-10))).toBe('-10');
  });

  it('renders special numbers (NaN, Infinity)', () => {
    expect(stripAnsi(pretty(NaN))).toBe('NaN');
    expect(stripAnsi(pretty(Infinity))).toBe('Infinity');
    expect(stripAnsi(pretty(-Infinity))).toBe('-Infinity');
  });

  it('renders strings with quotes', () => {
    expect(stripAnsi(pretty('hello'))).toBe('"hello"');
  });

  it('renders bigint with n suffix', () => {
    expect(stripAnsi(pretty(BigInt(123)))).toBe('123n');
  });

  it('renders functions as [Function: name]', () => {
    function foo() { return 1; }
    expect(stripAnsi(pretty(foo))).toContain('[Function: foo]');
  });

  it('renders anonymous functions', () => {
    const fn = () => 1;
    expect(stripAnsi(pretty(fn))).toMatch(/\[Function: \w*\]/);
  });

  it('renders symbols', () => {
    const s = Symbol('test');
    expect(stripAnsi(pretty(s))).toBe('Symbol(test)');
  });
});

describe('json.pretty: arrays (v1.3.0)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('renders empty array as []', () => {
    expect(stripAnsi(pretty([]))).toBe('[]');
  });

  it('renders array of primitives', () => {
    const out = stripAnsi(pretty([1, 2, 3]));
    expect(out).toContain('[');
    expect(out).toContain(']');
    expect(out).toContain('1');
    expect(out).toContain('2');
    expect(out).toContain('3');
  });

  it('renders nested arrays', () => {
    const out = stripAnsi(pretty([[1, 2], [3, 4]]));
    expect(out).toContain('1');
    expect(out).toContain('4');
  });

  it('respects maxItems with truncation marker', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = stripAnsi(pretty(arr, { maxItems: 3 }));
    expect(out).toContain('1');
    expect(out).toContain('3');
    expect(out).toContain('(7 more)');
    expect(out).not.toContain('10');
  });
});

describe('json.pretty: objects (v1.3.0)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('renders empty object as {}', () => {
    expect(stripAnsi(pretty({}))).toBe('{}');
  });

  it('renders simple object', () => {
    const out = stripAnsi(pretty({ a: 1, b: 'two' }));
    expect(out).toContain('"a"');
    expect(out).toContain('1');
    expect(out).toContain('"b"');
    expect(out).toContain('"two"');
  });

  it('renders nested objects', () => {
    const out = stripAnsi(pretty({ outer: { inner: 'value' } }));
    expect(out).toContain('"outer"');
    expect(out).toContain('"inner"');
    expect(out).toContain('"value"');
  });

  it('respects maxDepth — deeper objects render as {...}', () => {
    const deep = { a: { b: { c: { d: 'too deep' } } } };
    const out = stripAnsi(pretty(deep, { maxDepth: 2 }));
    expect(out).not.toContain('too deep');
    expect(out).toContain('{...}');
  });

  it('respects maxDepth=0 — root renders as collapsed', () => {
    const out = stripAnsi(pretty({ a: 1 }, { maxDepth: 0 }));
    expect(out).toBe('{...}');
  });

  it('respects custom indent', () => {
    const out = stripAnsi(pretty({ a: 1 }, { indent: 4 }));
    expect(out).toMatch(/\n {4}"a"/);
  });

  it('indent: 0 produces minified-ish output', () => {
    const out = stripAnsi(pretty({ a: 1 }, { indent: 0 }));
    // Still has newlines, just no leading spaces
    expect(out).toContain('"a"');
    expect(out).not.toMatch(/  /); // no double spaces
  });
});

describe('json.pretty: edge cases (v1.3.0)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('handles circular references with [Circular] marker', () => {
    const obj: Record<string, unknown> = { name: 'foo' };
    obj.self = obj;
    const out = stripAnsi(pretty(obj));
    expect(out).toContain('[Circular]');
    expect(out).toContain('"name"');
  });

  it('handles circular arrays', () => {
    const arr: unknown[] = [1, 2];
    arr.push(arr);
    const out = stripAnsi(pretty(arr));
    expect(out).toContain('[Circular]');
  });

  it('respects maxStringLength with truncation', () => {
    const longStr = 'a'.repeat(100);
    const out = stripAnsi(pretty(longStr, { maxStringLength: 20 }));
    expect(out.length).toBeLessThan(30);
    expect(out).toContain('...');
  });

  it('colors: false strips ANSI', () => {
    const out = pretty({ a: 1 }, { colors: false });
    expect(out).not.toContain('\x1b[');
  });

  it('NO_COLOR mode produces colorless output', () => {
    setNoColor(true);
    const out = pretty({ a: 1 }, { colors: true });
    expect(out).not.toContain('\x1b[');
    setNoColor(false);
  });

  it('negative indent is clamped to 0', () => {
    const out = stripAnsi(pretty({ a: 1 }, { indent: -5 }));
    // Still produces valid output
    expect(out).toContain('"a"');
  });

  it('non-finite maxDepth is treated as Infinity', () => {
    // No throw, normal output
    expect(() => pretty({ a: { b: 1 } }, { maxDepth: NaN })).not.toThrow();
  });
});

describe('json.pretty: ANSI colors (v1.3.0)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('default colors: true produces ANSI', () => {
    const out = pretty({ a: 1 });
    expect(out).toContain('\x1b[');
  });

  it('keys colored differently than strings (different ANSI codes)', () => {
    const out = pretty({ key: 'value' });
    // Should have at least 2 different SGR codes
    const codes = out.match(/\x1b\[\d+m/g) ?? [];
    const unique = new Set(codes);
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});

describe('json namespace export (v1.3.0)', () => {
  it('json.pretty is accessible', () => {
    expect(typeof json.pretty).toBe('function');
  });

  it('json and jsonPretty exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.json).toBe('object');
    expect(typeof main.jsonPretty).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  v1.3.1 — sortKeys + inlineArrayMaxLength
// ─────────────────────────────────────────────

describe('json.pretty: sortKeys (v1.3.1)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('sortKeys: false (default) preserves insertion order', () => {
    const obj = { zebra: 1, apple: 2, mango: 3 };
    const out = stripAnsi(pretty(obj));
    const zebraPos = out.indexOf('"zebra"');
    const applePos = out.indexOf('"apple"');
    const mangoPos = out.indexOf('"mango"');
    // Original order: zebra → apple → mango
    expect(zebraPos).toBeLessThan(applePos);
    expect(applePos).toBeLessThan(mangoPos);
  });

  it('sortKeys: true sorts keys alphabetically', () => {
    const obj = { zebra: 1, apple: 2, mango: 3 };
    const out = stripAnsi(pretty(obj, { sortKeys: true }));
    const applePos = out.indexOf('"apple"');
    const mangoPos = out.indexOf('"mango"');
    const zebraPos = out.indexOf('"zebra"');
    // Sorted: apple → mango → zebra
    expect(applePos).toBeLessThan(mangoPos);
    expect(mangoPos).toBeLessThan(zebraPos);
  });

  it('sortKeys applies recursively to nested objects', () => {
    const obj = { z: 1, a: { z: 2, a: 3 } };
    const out = stripAnsi(pretty(obj, { sortKeys: true }));
    // Outer: a before z
    expect(out.indexOf('"a"')).toBeLessThan(out.indexOf('"z"'));
    // Inner: also a before z (recursive)
    const innerA = out.lastIndexOf('"a"');
    const innerZ = out.lastIndexOf('"z"');
    expect(innerA).toBeLessThan(innerZ);
  });

  it('sortKeys produces deterministic output across calls', () => {
    const obj = { c: 1, a: 2, b: 3 };
    const a = pretty(obj, { sortKeys: true });
    const b = pretty(obj, { sortKeys: true });
    expect(a).toBe(b);
  });
});

describe('json.pretty: inlineArrayMaxLength (v1.3.1)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('short array of primitives renders inline by default', () => {
    const out = stripAnsi(pretty([1, 2, 3]));
    // Single line — no newlines
    expect(out).toBe('[1, 2, 3]');
  });

  it('short array of strings renders inline', () => {
    const out = stripAnsi(pretty(['a', 'b', 'c']));
    expect(out).toBe('["a", "b", "c"]');
  });

  it('long array of primitives expands to multi-line', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const out = stripAnsi(pretty(arr));
    // Should have multiple newlines (rendered visible length > 60)
    expect(out.split('\n').length).toBeGreaterThan(5);
  });

  it('array containing objects never inlines', () => {
    const out = stripAnsi(pretty([{ x: 1 }, { y: 2 }]));
    // Even if short, must expand because contains objects
    expect(out.split('\n').length).toBeGreaterThan(1);
  });

  it('inlineArrayMaxLength: 0 disables inlining', () => {
    const out = stripAnsi(pretty([1, 2, 3], { inlineArrayMaxLength: 0 }));
    // Even tiny arrays expand
    expect(out.split('\n').length).toBeGreaterThan(1);
  });

  it('custom inlineArrayMaxLength threshold controls cutoff', () => {
    // Very short threshold forces multi-line even for tiny arrays
    const out = stripAnsi(pretty([1, 2, 3], { inlineArrayMaxLength: 5 }));
    expect(out.split('\n').length).toBeGreaterThan(1);
  });

  it('inline rendering preserves colors when enabled', () => {
    const out = pretty([1, 2, 3]);
    // Should contain ANSI escapes
    expect(out).toContain('\x1b[');
    // Should be single-line
    expect(out.split('\n').length).toBe(1);
  });

  it('empty array still renders as []', () => {
    expect(stripAnsi(pretty([]))).toBe('[]');
  });

  it('inline array with maxItems shows truncation marker', () => {
    const arr = [1, 2, 3, 4, 5];
    const out = stripAnsi(pretty(arr, { maxItems: 2 }));
    expect(out).toContain('1');
    expect(out).toContain('2');
    expect(out).toContain('(3 more)');
    expect(out).not.toContain('5');
  });
});

// ─────────────────────────────────────────────
//  Coverage gaps from v1.3.1 (line 92, 173, 223-224)
// ─────────────────────────────────────────────

describe('json.pretty: edge cases (coverage v1.3.1)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('maxStringLength <= 3 truncates without ellipsis (line 92)', () => {
    // When maxLength is 3 or less, there's no room for "..." → raw slice
    const out = stripAnsi(pretty('hello world', { maxStringLength: 3 }));
    // Should be "hel" wrapped in quotes — JSON.stringify result on truncated string
    expect(out).toBe('"hel"');
  });

  it('maxStringLength = 1 truncates to single char', () => {
    const out = stripAnsi(pretty('hello', { maxStringLength: 1 }));
    expect(out).toBe('"h"');
  });

  it('maxStringLength = 0 produces empty string content', () => {
    const out = stripAnsi(pretty('hello', { maxStringLength: 0 }));
    expect(out).toBe('""');
  });

  it('array exceeding maxDepth renders as [...] (line 173)', () => {
    // Test the array-specific branch of the depth limit check
    // (the existing test only covered the object branch)
    const data = { items: [1, 2, 3] };
    const out = stripAnsi(pretty(data, { maxDepth: 1 }));
    // 'items' is an array at depth 1 → should be collapsed
    expect(out).toContain('[...]');
    expect(out).not.toContain('1');
  });

  it('top-level array beyond maxDepth renders as [...]', () => {
    const out = stripAnsi(pretty([1, 2, 3], { maxDepth: 0 }));
    expect(out).toBe('[...]');
  });

  it('multi-line array with maxItems shows truncation marker (lines 223-224)', () => {
    // Force multi-line rendering by including non-primitives so inline path is skipped
    const arr = [
      { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
    ];
    const out = stripAnsi(pretty(arr, { maxItems: 2 }));
    // Should include first 2 objects + truncation marker
    expect(out).toContain('"id": 1');
    expect(out).toContain('"id": 2');
    expect(out).toContain('(3 more)');
    expect(out).not.toContain('"id": 5');
    // Multi-line — verify newlines exist
    expect(out.split('\n').length).toBeGreaterThan(3);
  });

  it('long array of primitives with maxItems forces multi-line + truncation', () => {
    // Big array with primitives — inline path fails (too long), falls into multi-line path
    const arr = Array.from({ length: 100 }, (_, i) => `string_value_${i}`);
    const out = stripAnsi(pretty(arr, { maxItems: 3 }));
    expect(out).toContain('string_value_0');
    expect(out).toContain('string_value_2');
    expect(out).toContain('(97 more)');
    expect(out.split('\n').length).toBeGreaterThan(2);
  });
});
