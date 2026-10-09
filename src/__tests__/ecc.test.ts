import { reedSolomonEncode, rsGeneratorPoly, gfMul, gfPow } from '../ecc/index.js';

describe('GF(2^8) arithmetic (v1.7.5)', () => {
  it('gfMul: zero annihilates, one is identity', () => {
    expect(gfMul(0, 123)).toBe(0);
    expect(gfMul(123, 0)).toBe(0);
    expect(gfMul(1, 123)).toBe(123);
    expect(gfMul(123, 1)).toBe(123);
  });

  it('gfMul is commutative', () => {
    for (const [a, b] of [[2, 3], [57, 200], [255, 16], [100, 100]]) {
      expect(gfMul(a as number, b as number)).toBe(gfMul(b as number, a as number));
    }
  });

  it('gfMul reduces α·…·α (8 times) to the primitive polynomial low byte 0x1d', () => {
    // α = 2; 2^8 reduces modulo 0x11D to 0x1D.
    expect(gfPow(2, 8)).toBe(0x1d);
  });

  it('gfPow handles the zero and identity edge cases', () => {
    expect(gfPow(5, 0)).toBe(1);
    expect(gfPow(0, 0)).toBe(1);
    expect(gfPow(0, 5)).toBe(0);
    expect(gfPow(2, 1)).toBe(2);
  });

  it('gfPow matches repeated gfMul', () => {
    let acc = 1;
    for (let n = 0; n <= 10; n++) {
      expect(gfPow(3, n)).toBe(acc);
      acc = gfMul(acc, 3);
    }
  });

  it('gfPow with a negative exponent yields the multiplicative inverse', () => {
    // Negative exponents drive the `e += 255` normalization branch; the result
    // must satisfy x · x⁻¹ = 1 in GF(256).
    for (const x of [2, 7, 100, 255]) {
      const inv = gfPow(x, -1);
      expect(gfMul(x, inv)).toBe(1);
    }
    // x⁻² is the inverse of x², too.
    expect(gfMul(gfPow(5, 2), gfPow(5, -2))).toBe(1);
  });
});

describe('rsGeneratorPoly (v1.7.5)', () => {
  it('degree 0 is the constant polynomial [1]', () => {
    expect(rsGeneratorPoly(0)).toEqual([1]);
  });

  it('degree 2 is (x-α^0)(x-α^1) = [1, 3, 2]', () => {
    // (x-1)(x-2) = x^2 + 3x + 2 in GF(2) (addition is XOR).
    expect(rsGeneratorPoly(2)).toEqual([1, 3, 2]);
  });

  it('has degree+1 coefficients, leading coefficient 1', () => {
    for (const d of [1, 7, 10, 30]) {
      const g = rsGeneratorPoly(d);
      expect(g).toHaveLength(d + 1);
      expect(g[0]).toBe(1);
    }
  });
});

describe('reedSolomonEncode (v1.7.5)', () => {
  it('matches the canonical QR vector (16 data → 10 ECC)', () => {
    const data = [0x10, 0x20, 0x0c, 0x56, 0x61, 0x80,
      0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11];
    const expected = [0xa5, 0x24, 0xd4, 0xc1, 0xed, 0x36, 0xc7, 0x87, 0x2c, 0x55];
    expect(reedSolomonEncode(data, 10)).toEqual(expected);
  });

  it('returns exactly eccLength bytes, each in 0..255', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const n of [5, 10, 20]) {
      const ecc = reedSolomonEncode(data, n);
      expect(ecc).toHaveLength(n);
      expect(ecc.every((b) => b >= 0 && b <= 255)).toBe(true);
    }
  });

  it('returns [] for a non-positive eccLength', () => {
    expect(reedSolomonEncode([1, 2, 3], 0)).toEqual([]);
    expect(reedSolomonEncode([1, 2, 3], -4)).toEqual([]);
  });

  it('masks data bytes to 0..255', () => {
    // 0x110 & 0xff === 0x10, so these two inputs encode identically.
    expect(reedSolomonEncode([0x110, 0x20], 4)).toEqual(reedSolomonEncode([0x10, 0x20], 4));
  });

  it('is deterministic', () => {
    const data = [9, 8, 7, 6, 5];
    expect(reedSolomonEncode(data, 8)).toEqual(reedSolomonEncode(data, 8));
  });

  it('all-zero data yields all-zero ECC', () => {
    const ecc = reedSolomonEncode([0, 0, 0, 0], 6);
    expect(ecc).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
