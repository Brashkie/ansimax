// ─────────────────────────────────────────────
//  ansimax/ecc — Reed-Solomon error correction over GF(2^8) (Phase 12)
//
//  v1.7.5 — Phase 12. The arithmetic backbone shared by QR codes, PDF417,
//  Aztec and Data Matrix: Reed-Solomon coding over the Galois field GF(2^8).
//
//  Bytes are treated as elements of GF(256) built with the primitive
//  polynomial x⁸ + x⁴ + x³ + x² + 1 (0x11D) — the field QR and Data Matrix
//  use. Multiplication is table-driven (exp/log of the generator α = 2), so a
//  product is two table lookups and an add. The RS generator polynomial is
//  g(x) = ∏_{i=0}^{k-1} (x − α^i); the ECC codewords are the remainder of the
//  message polynomial (shifted up by k) divided by g(x), computed with
//  synthetic division. Zero dependencies, pure functions.
//
//  This is the math layer only — a full QR matrix (finder/timing/alignment
//  patterns, masking, format info) builds on top of it later.
// ─────────────────────────────────────────────

/** The primitive polynomial for GF(2^8) used by QR / Data Matrix (0x11D). */
const PRIM = 0x11d;

// Exponential and logarithm tables for GF(256) with generator α = 2.
// exp[i] = α^i (i in 0..254, period 255); log[x] = i such that α^i = x.
const EXP = new Uint8Array(512); // doubled so a+b (<510) needs no modulo
const LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIM; // reduce modulo the primitive polynomial
  }
  // Mirror the table into the upper half so exponents up to 509 wrap for free.
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] as number;
})();

/**
 * Multiply two bytes as elements of GF(2^8). `0` annihilates; otherwise the
 * product is `α^((log a + log b) mod 255)`.
 *
 * @since 1.7.5
 */
export const gfMul = (a: number, b: number): number => {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a & 0xff] as number) + (LOG[b & 0xff] as number)] as number;
};

/**
 * Raise a byte to an integer power in GF(2^8). `gfPow(0, 0)` is `1` by
 * convention; `gfPow(0, n>0)` is `0`.
 *
 * @since 1.7.5
 */
export const gfPow = (x: number, power: number): number => {
  if (x === 0) return power === 0 ? 1 : 0;
  // log(x^p) = p·log(x) mod 255; normalize p into [0,255).
  let e = ((LOG[x & 0xff] as number) * power) % 255;
  if (e < 0) e += 255;
  return EXP[e] as number;
};

/**
 * Build the Reed-Solomon generator polynomial of the given `degree`:
 * `g(x) = ∏_{i=0}^{degree-1} (x − α^i)`, returned as coefficients in
 * descending order (leading coefficient `1` first). `degree` is the number of
 * ECC codewords. A degree of `0` yields the constant polynomial `[1]`.
 *
 * @since 1.7.5
 */
export const rsGeneratorPoly = (degree: number): number[] => {
  let g = [1];
  for (let i = 0; i < degree; i++) {
    // Multiply g(x) by (x − α^i) = (x + α^i) in GF(2).
    const factorRoot = EXP[i] as number;
    const next = new Array<number>(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      const coeff = g[j] as number;
      next[j] = (next[j] as number) ^ coeff;                         // x · coeff term
      next[j + 1] = (next[j + 1] as number) ^ gfMul(coeff, factorRoot); // α^i · coeff term
    }
    g = next;
  }
  return g;
};

/**
 * Compute the Reed-Solomon ECC codewords for `data`. Returns exactly
 * `eccLength` bytes — the remainder of `data·x^eccLength` divided by the
 * generator polynomial of that degree, i.e. what a QR encoder appends after
 * the data codewords.
 *
 * `data` values are treated as bytes (masked to 0..255). `eccLength ≤ 0`
 * returns `[]`.
 *
 * @example
 * ```js
 * import { reedSolomonEncode } from 'ansimax';
 *
 * // Canonical QR example (16 data bytes → 10 ECC bytes)
 * const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80,
 *               0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
 * reedSolomonEncode(data, 10);
 * // → [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55]
 * ```
 *
 * @since 1.7.5
 */
export const reedSolomonEncode = (data: number[], eccLength: number): number[] => {
  if (!Number.isFinite(eccLength) || eccLength <= 0) return [];
  const gen = rsGeneratorPoly(eccLength);
  // Working buffer: data followed by eccLength zero slots for the remainder.
  const res = new Array<number>(data.length + eccLength).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = (data[i] as number) & 0xff;

  // Synthetic division: for each data position, eliminate its leading term by
  // XOR-ing a scaled copy of the generator into the following coefficients.
  for (let i = 0; i < data.length; i++) {
    const coeff = res[i] as number;
    if (coeff === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      res[i + j] = (res[i + j] as number) ^ gfMul(gen[j] as number, coeff);
    }
  }
  // The last eccLength entries hold the remainder — the ECC codewords.
  return res.slice(data.length);
};
