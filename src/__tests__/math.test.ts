// ─────────────────────────────────────────────
//  ansimax/utils/math — Pure math toolkit tests
//  v1.4.6
// ─────────────────────────────────────────────

import {
  lerp, inverseLerp, remap, clamp, clamp01,
  smoothstep, smootherstep, roundTo, mod, wrap,
  gcd, lcm, sum, mean, distribute,
} from '../utils/math.js';

describe('lerp / inverseLerp / remap (v1.4.6)', () => {
  it('lerp interpolates', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('lerp extrapolates beyond [0,1]', () => {
    expect(lerp(0, 10, 1.5)).toBe(15);
    expect(lerp(0, 10, -0.5)).toBe(-5);
  });

  it('inverseLerp is the inverse of lerp', () => {
    expect(inverseLerp(0, 10, 5)).toBe(0.5);
    expect(inverseLerp(2, 4, 3)).toBe(0.5);
  });

  it('inverseLerp returns 0 for degenerate range', () => {
    expect(inverseLerp(5, 5, 5)).toBe(0);
    expect(inverseLerp(5, 5, 100)).toBe(0);
  });

  it('remap combines both', () => {
    expect(remap(5, 0, 10, 0, 100)).toBe(50);
    expect(remap(0, -1, 1, 0, 255)).toBe(127.5);
  });
});

describe('clamp / clamp01 (v1.4.6)', () => {
  it('clamps to range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('swaps inverted bounds', () => {
    expect(clamp(5, 10, 0)).toBe(5);
    expect(clamp(15, 10, 0)).toBe(10);
  });

  it('clamp01 clamps to unit interval', () => {
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('smoothstep / smootherstep (v1.4.6)', () => {
  it('smoothstep endpoints', () => {
    expect(smoothstep(0, 1, 0)).toBe(0);
    expect(smoothstep(0, 1, 1)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });

  it('smoothstep clamps outside edges', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('smoothstep known value', () => {
    expect(smoothstep(0, 1, 0.25)).toBeCloseTo(0.15625, 5);
  });

  it('smootherstep endpoints + midpoint', () => {
    expect(smootherstep(0, 1, 0)).toBe(0);
    expect(smootherstep(0, 1, 1)).toBe(1);
    expect(smootherstep(0, 1, 0.5)).toBe(0.5);
  });
});

describe('roundTo (v1.4.6)', () => {
  it('rounds to decimals', () => {
    expect(roundTo(3.14159, 2)).toBe(3.14);
    expect(roundTo(3.14159, 4)).toBe(3.1416);
    expect(roundTo(3.14159, 0)).toBe(3);
  });

  it('handles negative decimals as 0', () => {
    expect(roundTo(3.7, -1)).toBe(4);
  });
});

describe('mod / wrap (v1.4.6)', () => {
  it('mod always returns divisor sign', () => {
    expect(mod(-1, 4)).toBe(3);
    expect(mod(5, 4)).toBe(1);
    expect(mod(7, 3)).toBe(1);
    expect(mod(-7, 3)).toBe(2);
  });

  it('wrap into half-open range', () => {
    expect(wrap(370, 0, 360)).toBe(10);
    expect(wrap(-10, 0, 360)).toBe(350);
    expect(wrap(180, 0, 360)).toBe(180);
  });

  it('wrap returns min for non-positive range', () => {
    expect(wrap(5, 10, 10)).toBe(10);
    expect(wrap(5, 10, 5)).toBe(10);
  });
});

describe('gcd / lcm (v1.4.6)', () => {
  it('gcd computes', () => {
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(17, 5)).toBe(1);
    expect(gcd(100, 75)).toBe(25);
  });

  it('gcd ignores sign', () => {
    expect(gcd(-12, 8)).toBe(4);
    expect(gcd(12, -8)).toBe(4);
  });

  it('gcd(0,0) is 0', () => {
    expect(gcd(0, 0)).toBe(0);
  });

  it('lcm computes', () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
  });

  it('lcm with 0 is 0', () => {
    expect(lcm(4, 0)).toBe(0);
  });
});

describe('sum / mean (v1.4.6)', () => {
  it('sum adds values', () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
    expect(sum([])).toBe(0);
  });

  it('mean averages', () => {
    expect(mean([2, 4, 6])).toBe(4);
    expect(mean([])).toBe(0);
  });
});

describe('distribute (v1.4.6)', () => {
  it('distributes evenly with remainder to front', () => {
    expect(distribute(10, 3)).toEqual([4, 3, 3]);
    expect(distribute(9, 3)).toEqual([3, 3, 3]);
    expect(distribute(7, 4)).toEqual([2, 2, 2, 1]);
  });

  it('empty for zero parts', () => {
    expect(distribute(10, 0)).toEqual([]);
  });

  it('sum invariant: result always sums to total', () => {
    for (let total = 0; total < 50; total++) {
      for (let parts = 1; parts < 8; parts++) {
        const d = distribute(total, parts);
        expect(sum(d)).toBe(total);
        expect(d.length).toBe(parts);
      }
    }
  });
});

// ─────────────────────────────────────────────
//  Barrel re-exports
// ─────────────────────────────────────────────

describe('v1.4.6 — math barrel re-exports', () => {
  it('math functions exported from main barrel (with range aliases)', async () => {
    const main = await import('../index.js');
    expect(typeof main.lerp).toBe('function');
    expect(typeof main.inverseLerp).toBe('function');
    expect(typeof main.remap).toBe('function');
    expect(typeof main.clampRange).toBe('function');
    expect(typeof main.clamp01).toBe('function');
    expect(typeof main.smoothstep).toBe('function');
    expect(typeof main.smootherstep).toBe('function');
    expect(typeof main.roundTo).toBe('function');
    expect(typeof main.mod).toBe('function');
    expect(typeof main.wrapRange).toBe('function');
    expect(typeof main.gcd).toBe('function');
    expect(typeof main.lcm).toBe('function');
    expect(typeof main.sum).toBe('function');
    expect(typeof main.mean).toBe('function');
    expect(typeof main.distribute).toBe('function');
  });

  it('clampRange alias matches clamp behavior', async () => {
    const main = await import('../index.js');
    expect(main.clampRange(15, 0, 10)).toBe(10);
    expect(main.wrapRange(370, 0, 360)).toBe(10);
  });
});
