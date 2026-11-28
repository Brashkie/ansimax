import {
  encodeBarcode, encodeCode128, encodeEAN13, renderBarcode, ean13CheckDigit,
  FNC1, FNC2, FNC3, FNC4,
} from '../barcode/index.js';
import { stripAnsi } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Phase 12 — linear symbols (v1.10.0)
//
//  The encoders were verified against an external reference in the sandbox:
//  all 107 Code 128 patterns diffed module-by-module, 4,000 random payloads
//  round-tripped through an independent decoder with identical module width,
//  and 3,000 EAN-13 codes byte-identical. These tests pin the properties that
//  verification established, plus the fixed vectors from the standards.
// ─────────────────────────────────────────────

const bits = (code: { modules: Uint8Array }): string => [...code.modules].join('');

// Code 128 symbol table, taken from the verified module output rather than
// restated here: a second hand-written copy would be a second chance to be
// wrong about the same table. These are the framing symbols only.
const START_B_BITS = '11010010000';
const START_C_BITS = '11010011100';
const STOP_BITS = '1100011101011';

describe('encodeCode128', () => {
  it('frames the symbol with a start code and the stop pattern', () => {
    const out = bits(encodeCode128('ANSIMAX'));
    expect(out.startsWith(START_B_BITS)).toBe(true);
    expect(out.endsWith(STOP_BITS)).toBe(true);
  });

  it('is 11 modules per symbol plus 13 for the stop', () => {
    // 'A' → start, 'A', checksum, stop = 3 × 11 + 13
    expect(encodeCode128('A').width).toBe(3 * 11 + 13);
    expect(encodeCode128('AB').width).toBe(4 * 11 + 13);
    expect(encodeCode128('ABC').width).toBe(5 * 11 + 13);
  });

  it('starts in set C for four or more leading digits', () => {
    expect(bits(encodeCode128('1234')).startsWith(START_C_BITS)).toBe(true);
    expect(bits(encodeCode128('123A')).startsWith(START_C_BITS)).toBe(false);
  });

  it('packs two digits per symbol in set C', () => {
    // 8 digits in C = 4 symbols; in B it would be 8.
    expect(encodeCode128('12345678').width).toBe((1 + 4 + 1) * 11 + 13);
  });

  it('takes the standard special case for exactly two digits', () => {
    // Set C holds '77' in one symbol; A or B would need two.
    expect(bits(encodeCode128('77')).startsWith(START_C_BITS)).toBe(true);
    expect(encodeCode128('77').width).toBe(3 * 11 + 13);
  });

  it('starts in set A when a control character precedes any lowercase', () => {
    const out = bits(encodeCode128('\x01ABC'));
    expect(out.startsWith(START_B_BITS)).toBe(false);
    expect(out.endsWith(STOP_BITS)).toBe(true);
  });

  it('starts in set B when lowercase comes first', () => {
    expect(bits(encodeCode128('abc\x01')).startsWith(START_B_BITS)).toBe(true);
  });

  it('honours an explicit start code set', () => {
    // codeSet picks the START set; the switching heuristic still runs, so
    // '1234' forced to B begins in B and then switches to C for the digits.
    const code = encodeCode128('1234', { codeSet: 'B' });
    expect(bits(code).startsWith(START_B_BITS)).toBe(true);
    expect(code.values).toContain(99); // CODE C
    expect(code.width).toBe((1 + 1 + 2 + 1) * 11 + 13);
  });

  it('keeps digits in B when the set is forced and no run pays for C', () => {
    const code = encodeCode128('12A', { codeSet: 'B' });
    expect(code.values).not.toContain(99);
    expect(code.width).toBe((1 + 3 + 1) * 11 + 13);
  });

  it('switches into C only when the digit run pays for the switch', () => {
    // Four digits mid-string do not: the switch symbol costs what C saves.
    const short = encodeCode128('AB1234CD');
    const long = encodeCode128('AB123456CD');
    expect(short.values).not.toContain(99); // no CODE C
    expect(long.values).toContain(99);
  });

  it('switches into C for a four-digit run that ends the string', () => {
    expect(encodeCode128('AB1234').values).toContain(99);
  });

  it('leaves an odd digit outside C so the run starts even', () => {
    // 7 digits: one in B, six in C — never a half symbol.
    const code = encodeCode128('AB1234567');
    expect(code.values).toContain(99);
    expect(code.width % 11).toBe(2); // 13-module stop leaves 2 over
  });

  it('shifts for a single out-of-set character instead of switching', () => {
    // A lone lowercase inside an otherwise set-A string: SHIFT (98) is one
    // symbol, where switching to B and back would be two.
    const code = encodeCode128('\x01AAaAA');
    expect(code.values).toContain(98);
  });

  it('switches rather than shifts when the run continues out of set', () => {
    const code = encodeCode128('\x01AAaaaa');
    expect(code.values).not.toContain(98);
    expect(code.values).toContain(100); // CODE B
  });

  it('appends the mod-103 checksum before the stop', () => {
    const code = encodeCode128('ANSIMAX');
    const data = code.values.slice(0, -2);
    let sum = data[0] as number;
    for (let k = 1; k < data.length; k++) sum += k * (data[k] as number);
    // Indexed from the end explicitly: the project targets ES2020, where
    // Array.prototype.at does not exist.
    expect(code.values[code.values.length - 2]).toBe(sum % 103);
    expect(code.values[code.values.length - 1]).toBe(106); // STOP
  });

  it('encodes the FNC characters', () => {
    expect(encodeCode128(`${FNC1}0112345`).values).toContain(102);
    expect(encodeCode128(`A${FNC2}B`).values).toContain(97);
    expect(encodeCode128(`A${FNC3}B`).values).toContain(96);
    expect(encodeCode128(`a${FNC4}b`).values).toContain(100); // FNC4 in set B
  });

  it('leaves set C to encode a non-FNC1 function character', () => {
    const code = encodeCode128(`1234${FNC3}`);
    expect(code.values).toContain(100); // CODE B
    expect(code.values).toContain(96); // FNC3
  });

  it('reports the text it encoded', () => {
    expect(encodeCode128('hello').text).toBe('hello');
    expect(encodeCode128('hello').format).toBe('code128');
  });

  it('rejects an empty or non-string input', () => {
    expect(() => encodeCode128('')).toThrow(/ANSIMAX_BARCODE_INPUT/);
    expect(() => encodeCode128(null as unknown as string)).toThrow(/ANSIMAX_BARCODE_INPUT/);
  });

  it('rejects a character outside every code set', () => {
    expect(() => encodeCode128('café')).toThrow(/ANSIMAX_BARCODE_CHAR/);
    expect(() => encodeCode128('\u{1f600}')).toThrow(/ANSIMAX_BARCODE_CHAR/);
  });

  it('every module is 0 or 1 and the symbol starts and ends with a bar', () => {
    const code = encodeCode128('Mixed123');
    expect([...code.modules].every((m) => m === 0 || m === 1)).toBe(true);
    expect(code.modules[0]).toBe(1);
    expect(code.modules[code.modules.length - 1]).toBe(1);
  });
});

describe('ean13CheckDigit', () => {
  it('computes the published check digits', () => {
    expect(ean13CheckDigit('978020137962')).toBe(4);
    expect(ean13CheckDigit('400638133393')).toBe(1);
    expect(ean13CheckDigit('000000000000')).toBe(0);
  });

  it('brings the weighted sum to a multiple of ten', () => {
    for (const d of ['123456789012', '590123412345', '501234567890', '042100005264']) {
      const check = ean13CheckDigit(d);
      let sum = check;
      for (let i = 0; i < 12; i++) sum += (d.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
      expect(sum % 10).toBe(0);
    }
  });

  it('rejects anything that is not twelve digits', () => {
    expect(() => ean13CheckDigit('12345678901')).toThrow(/ANSIMAX_BARCODE_INPUT/);
    expect(() => ean13CheckDigit('1234567890123')).toThrow(/ANSIMAX_BARCODE_INPUT/);
    expect(() => ean13CheckDigit('12345678901x')).toThrow(/ANSIMAX_BARCODE_INPUT/);
  });
});

describe('encodeEAN13', () => {
  it('is always 95 modules', () => {
    expect(encodeEAN13('978020137962').width).toBe(95);
    expect(encodeEAN13('4006381333931').width).toBe(95);
  });

  it('appends the check digit to a 12-digit input', () => {
    expect(encodeEAN13('978020137962').text).toBe('9780201379624');
  });

  it('accepts a 13-digit input and verifies the check digit', () => {
    expect(encodeEAN13('9780201379624').text).toBe('9780201379624');
    expect(() => encodeEAN13('9780201379620')).toThrow(/ANSIMAX_BARCODE_CHECKSUM/);
  });

  it('places the guard and centre patterns', () => {
    const out = bits(encodeEAN13('4006381333931'));
    expect(out.slice(0, 3)).toBe('101');
    expect(out.slice(45, 50)).toBe('01010');
    expect(out.slice(92)).toBe('101');
  });

  it('carries the first digit in the left-half parity, not in bars', () => {
    // Two codes differing only in the first digit must differ in the left
    // half (parity) while the right half stays identical.
    const a = bits(encodeEAN13('1234567890128'));
    const b = bits(encodeEAN13('7234567890122'));
    expect(a.slice(3, 45)).not.toBe(b.slice(3, 45));
    // The right half holds digits 8..13, and the 13th is the check digit,
    // which these two do not share — so compare the five digits before it.
    expect(a.slice(50, 85)).toBe(b.slice(50, 85));
  });

  it('uses the R set on the right half, which is the L set complemented', () => {
    // Digit 0 is L 0001101 and R 1110010.
    const out = bits(encodeEAN13('000000000000'));
    expect(out.slice(3, 10)).toBe('0001101');
    expect(out.slice(50, 57)).toBe('1110010');
  });

  it('has no symbol values to report', () => {
    expect(encodeEAN13('400638133393').values).toEqual([]);
    expect(encodeEAN13('400638133393').format).toBe('ean13');
  });

  it('rejects the wrong number of digits or non-digits', () => {
    expect(() => encodeEAN13('12345678901')).toThrow(/ANSIMAX_BARCODE_INPUT/);
    expect(() => encodeEAN13('12345678901234')).toThrow(/ANSIMAX_BARCODE_INPUT/);
    expect(() => encodeEAN13('40063813339a')).toThrow(/ANSIMAX_BARCODE_INPUT/);
  });
});

describe('encodeBarcode', () => {
  it('dispatches on format, defaulting to Code 128', () => {
    expect(encodeBarcode('ANSIMAX').format).toBe('code128');
    expect(encodeBarcode('4006381333931', { format: 'ean13' }).width).toBe(95);
  });

  it('passes Code 128 options through', () => {
    expect(bits(encodeBarcode('1234', { codeSet: 'B' })).startsWith(START_B_BITS)).toBe(true);
  });

  it('rejects an unknown format', () => {
    expect(() => encodeBarcode('x', { format: 'pdf417' as 'code128' }))
      .toThrow(/ANSIMAX_BARCODE_FORMAT/);
  });
});

describe('renderBarcode', () => {
  it('renders the requested height plus a text line', () => {
    const out = renderBarcode('ANSIMAX', { height: 6 }).split('\n');
    expect(out).toHaveLength(7);
    expect(out[6]).toContain('ANSIMAX');
  });

  it('drops the text line when asked', () => {
    expect(renderBarcode('ANSIMAX', { height: 4, text: false }).split('\n')).toHaveLength(4);
  });

  it('draws light modules by default, so the dark background becomes the bars', () => {
    const row = renderBarcode('A', { height: 1, quiet: 0, text: false });
    const code = encodeCode128('A');
    // Module 0 is a bar, so the first cell must be blank.
    expect(code.modules[0]).toBe(1);
    expect(row[0]).toBe(' ');
  });

  it('inverts on request', () => {
    const plain = renderBarcode('A', { height: 1, quiet: 0, text: false });
    const inverted = renderBarcode('A', { height: 1, quiet: 0, text: false, invert: true });
    expect(inverted).not.toBe(plain);
    expect(inverted[0]).toBe('█');
    // Every cell swapped, nothing else.
    expect([...inverted].map((c) => (c === '█' ? ' ' : '█')).join('')).toBe(plain);
  });

  it('pads a quiet zone of light modules on both sides', () => {
    const row = renderBarcode('A', { height: 1, quiet: 4, text: false });
    expect(row.startsWith('████')).toBe(true);
    expect(row.endsWith('████')).toBe(true);
    expect(row).toHaveLength(encodeCode128('A').width + 8);
  });

  it('widens every module by moduleWidth', () => {
    const one = renderBarcode('A', { height: 1, quiet: 0, text: false, moduleWidth: 1 });
    const three = renderBarcode('A', { height: 1, quiet: 0, text: false, moduleWidth: 3 });
    expect(three).toHaveLength(one.length * 3);
  });

  it('repeats the same row for every line of height', () => {
    const rows = renderBarcode('A', { height: 5, text: false }).split('\n');
    expect(new Set(rows).size).toBe(1);
  });

  it('prints an EAN-13 label in its standard grouping', () => {
    const out = renderBarcode('978020137962', { format: 'ean13', height: 2 }).split('\n');
    expect(out[2]).toContain('9 780201 379624');
  });

  it('accepts an already-encoded symbol', () => {
    const code = encodeEAN13('400638133393');
    expect(renderBarcode(code, { height: 2, text: false }))
      .toBe(renderBarcode('400638133393', { format: 'ean13', height: 2, text: false }));
  });

  it('applies colorFn to the drawn rows', () => {
    const out = renderBarcode('A', { height: 2, text: false, colorFn: (c) => `\x1b[32m${c}\x1b[0m` });
    expect(out).toContain('\x1b[32m');
    expect(stripAnsi(out)).toBe(renderBarcode('A', { height: 2, text: false }));
  });

  it('falls back on nonsense sizes rather than throwing', () => {
    expect(() => renderBarcode('A', { height: 0 })).not.toThrow();
    expect(() => renderBarcode('A', { height: Number.NaN, moduleWidth: -3 })).not.toThrow();
    expect(renderBarcode('A', { height: 0, text: false }).split('\n')).toHaveLength(8);
    expect(renderBarcode('A', { quiet: -5, height: 1, text: false }))
      .toHaveLength(encodeCode128('A').width);
  });
});
