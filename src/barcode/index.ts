/**
 * ansimax/barcode — linear (1-D) symbols, Phase 12.
 *
 * Code 128 (ISO/IEC 15417) and EAN-13 (ISO/IEC 15420), encoded to a module
 * bitmap and rendered with block characters. Zero dependencies, like the rest
 * of the library: the pattern tables and the check-digit arithmetic are all
 * that a 1-D symbol needs — there is no error correction to build on, unlike
 * the QR encoder in `src/qr`.
 *
 * A linear symbol is a row of equal-width modules. `encodeCode128` and
 * `encodeEAN13` return that row as one bit per module, so a caller can render
 * it any way they like; `renderBarcode` is the terminal rendering.
 *
 * Polarity follows `renderQR`: a scanner needs dark bars on a light field, so
 * the renderer draws the *light* modules and lets a dark terminal background
 * supply the bars. Pass `invert: true` on a light background.
 *
 * @module
 * @since 1.10.0
 */

// ─────────────────────────────────────────────
//  Code 128 symbol table
// ─────────────────────────────────────────────

/**
 * The 107 Code 128 symbols, as element widths: bar, space, bar, space, bar,
 * space. Every symbol is 11 modules wide (the stop pattern, value 106, is the
 * exception at 13 modules over seven elements).
 *
 * This table is arbitrary — nothing derives it, it is simply what the standard
 * assigns — so it was written out and then diffed module-by-module against an
 * external encoder. Do not "tidy" an entry by hand.
 */
const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_A = 103;
const START_B = 104;
const START_C = 105;
const STOP = 106;
const CODE_A = 101; // from B or C
const CODE_B = 100; // from A or C
const CODE_C = 99; // from A or B

/** `FNC1`, for GS1-128 application identifiers. */
export const FNC1 = 'ñ';
/** `FNC2`, "message append". */
export const FNC2 = 'ò';
/** `FNC3`, "initialize". */
export const FNC3 = 'ó';
/** `FNC4`, the Latin-1 extension marker. */
export const FNC4 = 'ô';

const FNC_VALUES: Record<string, { a: number; b: number }> = {
  [FNC1]: { a: 102, b: 102 },
  [FNC2]: { a: 97, b: 97 },
  [FNC3]: { a: 96, b: 96 },
  [FNC4]: { a: 101, b: 100 },
};

// ─────────────────────────────────────────────
//  EAN-13 symbol table
// ─────────────────────────────────────────────

// L: odd parity, left half. G is L reversed bit-for-bit; R is L complemented.
// Those two relations are real, so only one table is written out and the other
// two are derived — three hand-written tables would be three chances to be
// wrong about the same ten digits.
const EAN_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
] as const;

const reverseBits = (s: string): string => [...s].reverse().join('');
const complementBits = (s: string): string => [...s].map((c) => (c === '0' ? '1' : '0')).join('');

const EAN_G = EAN_L.map((p) => reverseBits(complementBits(p)));
const EAN_R = EAN_L.map(complementBits);

/**
 * Which of the six left-hand digits use the L set and which use G, selected by
 * the first digit. This is what makes a 13-digit code fit in 12 digit slots:
 * the first digit is carried entirely by the parity pattern, not by bars.
 */
const EAN_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL',
] as const;

const EAN_GUARD = '101';
const EAN_CENTRE = '01010';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

/** The linear symbologies this module encodes. */
export type BarcodeFormat = 'code128' | 'ean13';

/** An encoded linear symbol: one bit per module, plus what it holds. */
export interface Barcode {
  /** One entry per module: `1` is a bar (dark), `0` a space (light). */
  modules: Uint8Array;
  /** Module count — `modules.length`, for convenience. */
  width: number;
  /** Which symbology produced it. */
  format: BarcodeFormat;
  /**
   * The text actually encoded. For EAN-13 this is always 13 digits, so a
   * 12-digit input comes back with the check digit appended.
   */
  text: string;
  /**
   * The raw symbol values, before they became modules: Code 128 start, data,
   * checksum and stop. Empty for EAN-13, which has no symbol alphabet.
   */
  values: readonly number[];
}

/** Options for {@link encodeCode128}. */
export interface Code128Options {
  /**
   * Which code set to start in. `'auto'` (the default) picks per the standard
   * heuristic: C for four or more leading digits, A when a control character
   * comes before any lowercase, otherwise B.
   */
  codeSet?: 'auto' | 'A' | 'B' | 'C';
}

/** Options for {@link encodeBarcode}. */
export interface EncodeBarcodeOptions extends Code128Options {
  /** Which symbology to use. Default `'code128'`. */
  format?: BarcodeFormat;
}

/** Options for {@link renderBarcode}. */
export interface RenderBarcodeOptions {
  /** Rows of output. Default `8`. */
  height?: number;
  /** Character cells per module. Default `1`. */
  moduleWidth?: number;
  /**
   * Light modules to either side. Default `10`, the minimum both standards
   * require — a scanner needs them to find the symbol's edges.
   */
  quiet?: number;
  /**
   * Swap bars and spaces. The default draws light modules, which is correct
   * on a dark terminal background; pass `true` on a light one.
   */
  invert?: boolean;
  /** Print the encoded text under the bars. Default `true`. */
  text?: boolean;
  /** Colour hook for the drawn cells. */
  colorFn?: (cell: string) => string;
}

// ─────────────────────────────────────────────
//  Code 128
// ─────────────────────────────────────────────

const isDigit = (ch: string | undefined): boolean => ch !== undefined && ch >= '0' && ch <= '9';

/** How many digits run from `i`. */
const digitRun = (text: string, i: number): number => {
  let n = 0;
  while (isDigit(text[i + n])) n++;
  return n;
};

/**
 * Where in set A a character sits. Set A covers ASCII 0..95 but in two
 * stretches: the printables 32..95 map to 0..63, and the control characters
 * 0..31 map to 64..95 — so it is not one offset.
 */
const valueInA = (code: number): number => (code >= 32 ? code - 32 : code + 64);

/** Set B is the simple one: ASCII 32..127 maps straight to 0..95. */
const valueInB = (code: number): number => code - 32;

const canEncodeIn = (code: number, set: 'A' | 'B'): boolean =>
  set === 'A' ? code <= 95 : code >= 32 && code <= 127;

/**
 * Encode text as Code 128.
 *
 * Switches code sets as it goes: runs of digits go into set C, which packs two
 * digits per symbol, and the rest into A or B. The checksum is the start value
 * plus each data value times its position, modulo 103.
 *
 * `FNC1`–`FNC4` are available as the exported constants, so a GS1-128 string
 * is `FNC1 + '01' + gtin`.
 *
 * @example
 * ```js
 * import { encodeCode128, renderBarcode } from 'ansimax';
 *
 * const code = encodeCode128('ANSIMAX-1.10');
 * code.width;    // → module count
 * console.log(renderBarcode(code));
 * ```
 *
 * @throws {TypeError} `ANSIMAX_BARCODE_INPUT` — not a non-empty string.
 * @throws {RangeError} `ANSIMAX_BARCODE_CHAR` — a character no code set holds.
 * @since 1.10.0
 */
export const encodeCode128 = (text: string, opts: Code128Options = {}): Barcode => {
  if (typeof text !== 'string' || text.length === 0) {
    throw new TypeError('ANSIMAX_BARCODE_INPUT: encodeCode128 needs a non-empty string');
  }

  // Start set. Four leading digits are worth set C; otherwise the rule is
  // whether a control character turns up before any lowercase letter, because
  // only A holds controls and only B holds lowercase.
  let set: 'A' | 'B' | 'C';
  if (opts.codeSet && opts.codeSet !== 'auto') {
    set = opts.codeSet;
  } else if (digitRun(text, 0) >= 4 || (text.length === 2 && digitRun(text, 0) === 2)) {
    // Four leading digits pay for the switch. Two digits and nothing else is
    // the standard's own special case: set C holds them in one symbol, where
    // A or B would need two, so starting in C saves a symbol outright.
    set = 'C';
  } else {
    set = 'B';
    for (const ch of text) {
      const code = ch.charCodeAt(0);
      if (code < 32) { set = 'A'; break; }
      if (code >= 96 && code <= 127) break; // lowercase first → B
    }
  }

  const values: number[] = [set === 'A' ? START_A : set === 'B' ? START_B : START_C];

  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    const fnc = FNC_VALUES[ch];
    if (fnc) {
      // FNC1 exists in all three sets; the others only in A and B, so leave C.
      if (set === 'C' && ch !== FNC1) {
        values.push(CODE_B);
        set = 'B';
      }
      values.push(set === 'A' ? fnc.a : fnc.b);
      i++;
      continue;
    }

    if (set === 'C') {
      if (isDigit(ch) && isDigit(text[i + 1])) {
        values.push(Number.parseInt(text.slice(i, i + 2), 10));
        i += 2;
        continue;
      }
      // An odd digit or a non-digit: leave C for whichever set holds it.
      const code = ch.charCodeAt(0);
      const next: 'A' | 'B' = canEncodeIn(code, 'B') ? 'B' : 'A';
      values.push(next === 'A' ? CODE_A : CODE_B);
      set = next;
      continue;
    }

    // In A or B. A long digit run is cheaper in C: six in the middle, or four
    // that run to the end, beat the switch symbol they cost.
    const run = digitRun(text, i);
    if (run >= 6 || (run >= 4 && i + run === text.length)) {
      if (run % 2 === 1) {
        // Encode the odd one here so C starts on an even boundary.
        values.push(set === 'A' ? valueInA(ch.charCodeAt(0)) : valueInB(ch.charCodeAt(0)));
        i++;
      }
      values.push(CODE_C);
      set = 'C';
      continue;
    }

    const code = ch.charCodeAt(0);
    if (!canEncodeIn(code, set)) {
      const other: 'A' | 'B' = set === 'A' ? 'B' : 'A';
      if (!canEncodeIn(code, other)) {
        throw new RangeError(
          `ANSIMAX_BARCODE_CHAR: ${JSON.stringify(ch)} (U+${code.toString(16).toUpperCase().padStart(4, '0')}) is outside Code 128`,
        );
      }
      // A single stray character is cheaper to Shift than to switch for.
      const nextCh = text[i + 1];
      const stayAfter = nextCh === undefined || canEncodeIn(nextCh.charCodeAt(0), set);
      if (stayAfter) {
        values.push(98); // SHIFT: next symbol only, then back
        values.push(other === 'A' ? valueInA(code) : valueInB(code));
      } else {
        values.push(other === 'A' ? CODE_A : CODE_B);
        set = other;
        values.push(other === 'A' ? valueInA(code) : valueInB(code));
      }
      i++;
      continue;
    }

    values.push(set === 'A' ? valueInA(code) : valueInB(code));
    i++;
  }

  // Checksum: start + Σ position × value, mod 103. The start symbol is
  // position 0 and weighs 1, which is why it is added outside the loop.
  let sum = values[0] as number;
  for (let k = 1; k < values.length; k++) sum += k * (values[k] as number);
  values.push(sum % 103, STOP);

  return { ...toModules(values), format: 'code128', text, values };
};

/** Turn Code 128 symbol values into modules, bar first. */
const toModules = (values: readonly number[]): { modules: Uint8Array; width: number } => {
  let total = 0;
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v] as string;
    for (const d of pattern) total += d.charCodeAt(0) - 48;
  }
  const modules = new Uint8Array(total);
  let at = 0;
  for (const v of values) {
    const pattern = CODE128_PATTERNS[v] as string;
    for (let e = 0; e < pattern.length; e++) {
      const run = pattern.charCodeAt(e) - 48;
      // Elements alternate bar, space, bar, … starting with a bar.
      const bit = e % 2 === 0 ? 1 : 0;
      for (let k = 0; k < run; k++) modules[at++] = bit;
    }
  }
  return { modules, width: total };
};

// ─────────────────────────────────────────────
//  EAN-13
// ─────────────────────────────────────────────

/**
 * The EAN-13 check digit for the first twelve digits.
 *
 * Weights alternate 1, 3 from the left; the check digit is what brings the
 * weighted sum up to a multiple of ten.
 *
 * @example
 * ```js
 * import { ean13CheckDigit } from 'ansimax';
 *
 * ean13CheckDigit('978020137962'); // → 4
 * ```
 *
 * @throws {TypeError} `ANSIMAX_BARCODE_INPUT` — not exactly 12 digits.
 * @since 1.10.0
 */
export const ean13CheckDigit = (digits: string): number => {
  if (typeof digits !== 'string' || !/^\d{12}$/.test(digits)) {
    throw new TypeError('ANSIMAX_BARCODE_INPUT: ean13CheckDigit needs exactly 12 digits');
  }
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += (digits.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
};

/**
 * Encode 12 or 13 digits as EAN-13.
 *
 * With 12 digits the check digit is computed and appended; with 13 the last
 * one is verified. The symbol is always 95 modules: guard, six left digits,
 * centre, six right digits, guard.
 *
 * @example
 * ```js
 * import { encodeEAN13, renderBarcode } from 'ansimax';
 *
 * const code = encodeEAN13('978020137962');
 * code.text;   // → '9780201379624'  (check digit appended)
 * code.width;  // → 95
 * console.log(renderBarcode(code));
 * ```
 *
 * @throws {TypeError} `ANSIMAX_BARCODE_INPUT` — not 12 or 13 digits.
 * @throws {RangeError} `ANSIMAX_BARCODE_CHECKSUM` — the 13th digit is wrong.
 * @since 1.10.0
 */
export const encodeEAN13 = (digits: string): Barcode => {
  if (typeof digits !== 'string' || !/^\d{12,13}$/.test(digits)) {
    throw new TypeError('ANSIMAX_BARCODE_INPUT: encodeEAN13 needs 12 or 13 digits');
  }
  const body = digits.slice(0, 12);
  const check = ean13CheckDigit(body);
  if (digits.length === 13 && digits.charCodeAt(12) - 48 !== check) {
    throw new RangeError(
      `ANSIMAX_BARCODE_CHECKSUM: ${digits} ends in ${digits[12]}, the check digit for ${body} is ${check}`,
    );
  }
  const text = body + String(check);

  const parity = EAN_PARITY[text.charCodeAt(0) - 48] as string;
  let bits = EAN_GUARD;
  for (let i = 1; i <= 6; i++) {
    const d = text.charCodeAt(i) - 48;
    bits += parity[i - 1] === 'L' ? (EAN_L[d] as string) : (EAN_G[d] as string);
  }
  bits += EAN_CENTRE;
  for (let i = 7; i <= 12; i++) {
    bits += EAN_R[text.charCodeAt(i) - 48] as string;
  }
  bits += EAN_GUARD;

  const modules = new Uint8Array(bits.length);
  for (let i = 0; i < bits.length; i++) modules[i] = bits.charCodeAt(i) - 48;
  return { modules, width: modules.length, format: 'ean13', text, values: [] };
};

// ─────────────────────────────────────────────
//  Dispatch + rendering
// ─────────────────────────────────────────────

/**
 * Encode by format name — `encodeCode128` or `encodeEAN13` behind one call.
 *
 * @example
 * ```js
 * import { encodeBarcode } from 'ansimax';
 *
 * encodeBarcode('4006381333931', { format: 'ean13' }).width; // → 95
 * ```
 *
 * @throws {RangeError} `ANSIMAX_BARCODE_FORMAT` — unknown format.
 * @since 1.10.0
 */
export const encodeBarcode = (text: string, opts: EncodeBarcodeOptions = {}): Barcode => {
  const format = opts.format ?? 'code128';
  if (format === 'ean13') return encodeEAN13(text);
  if (format === 'code128') return encodeCode128(text, opts);
  throw new RangeError(`ANSIMAX_BARCODE_FORMAT: ${String(format)} is not 'code128' or 'ean13'`);
};

/**
 * Render a linear symbol with block characters.
 *
 * Bars are solid for the full height, so unlike a QR symbol there is nothing
 * to gain from half-blocks — a barcode is one row of information stretched
 * vertically. What does matter is polarity and the quiet zone: the renderer
 * draws the *light* modules by default, so a dark terminal background supplies
 * the bars and a scanner sees the right contrast. Pass `invert: true` on a
 * light background.
 *
 * @example
 * ```js
 * import { renderBarcode } from 'ansimax';
 *
 * console.log(renderBarcode('ANSIMAX', { height: 6 }));
 * console.log(renderBarcode('4006381333931', { format: 'ean13', invert: true }));
 * ```
 *
 * @since 1.10.0
 */
export const renderBarcode = (
  input: string | Barcode,
  opts: RenderBarcodeOptions & EncodeBarcodeOptions = {},
): string => {
  const code = typeof input === 'string' ? encodeBarcode(input, opts) : input;
  const height = toCount(opts.height, 8);
  const moduleWidth = toCount(opts.moduleWidth, 1);
  const quiet = opts.quiet === undefined ? 10 : Math.max(0, Math.trunc(opts.quiet) || 0);
  const invert = opts.invert === true;
  const paint = opts.colorFn ?? ((cell: string) => cell);

  // A bar is drawn as a space and a space as a block, so the terminal's dark
  // background becomes the bars — unless inverted.
  const barCell = ' '.repeat(moduleWidth);
  const spaceCell = '█'.repeat(moduleWidth);
  const cellFor = (bit: number): string => ((bit === 1) !== invert ? barCell : spaceCell);

  let row = cellFor(0).repeat(quiet);
  for (let i = 0; i < code.modules.length; i++) row += cellFor(code.modules[i] as number);
  row += cellFor(0).repeat(quiet);

  const rows: string[] = new Array(height).fill(paint(row));

  if (opts.text !== false && code.text.length > 0) {
    const label = code.format === 'ean13' ? spacedEAN(code.text) : code.text;
    const pad = Math.max(0, row.length - label.length);
    rows.push(' '.repeat(pad >> 1) + label);
  }
  return rows.join('\n');
};

/** `9780201379624` → `9 780201 379624`, the way the standard prints it. */
const spacedEAN = (text: string): string =>
  `${text.slice(0, 1)} ${text.slice(1, 7)} ${text.slice(7)}`;

const toCount = (value: number | undefined, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const n = Math.trunc(value);
  return n > 0 ? n : fallback;
};

/** Namespace form, for the default export. */
export const barcode = {
  encode: encodeBarcode,
  code128: encodeCode128,
  ean13: encodeEAN13,
  render: renderBarcode,
  checkDigit: ean13CheckDigit,
};
