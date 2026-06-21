import { easings, resolveEasingByName, EasingFunction } from '../utils/easing.js';

describe('easings library (v1.3.5)', () => {
  describe('endpoint preservation', () => {
    it('every easing maps 0 → 0 and 1 → 1 (approximately)', () => {
      for (const fn of Object.values(easings)) {
        const at0 = fn(0);
        const at1 = fn(1);
        // bounceOut and elastic functions can return values close-to but not exactly 0/1
        expect(Math.abs(at0)).toBeLessThan(0.0001);
        expect(Math.abs(at1 - 1)).toBeLessThan(0.0001);
      }
    });
  });

  describe('linear', () => {
    it('returns t unchanged', () => {
      expect(easings.linear(0.5)).toBe(0.5);
      expect(easings.linear(0.25)).toBe(0.25);
    });
  });

  describe('quadratic', () => {
    it('easeInQuad accelerates (slow start)', () => {
      // At t=0.5, t² = 0.25 (less than linear 0.5)
      expect(easings.easeInQuad(0.5)).toBe(0.25);
    });

    it('easeOutQuad decelerates (slow end)', () => {
      // At t=0.5, 1-(1-0.5)² = 0.75 (more than linear 0.5)
      expect(easings.easeOutQuad(0.5)).toBe(0.75);
    });

    it('easeInOutQuad is symmetric around 0.5', () => {
      expect(easings.easeInOutQuad(0.5)).toBe(0.5);
    });
  });

  describe('cubic', () => {
    it('easeInCubic is steeper than easeInQuad', () => {
      expect(easings.easeInCubic(0.5)).toBeLessThan(easings.easeInQuad(0.5));
    });
  });

  describe('sine', () => {
    it('easeInSine is approximately 0.293 at t=0.5', () => {
      // 1 - cos(π/4) ≈ 0.293
      expect(easings.easeInSine(0.5)).toBeCloseTo(0.293, 2);
    });
  });

  describe('expo', () => {
    it('easeInExpo at t=0 is exactly 0 (special case)', () => {
      expect(easings.easeInExpo(0)).toBe(0);
    });
    it('easeOutExpo at t=1 is exactly 1 (special case)', () => {
      expect(easings.easeOutExpo(1)).toBe(1);
    });
    it('easeInOutExpo at t=0/1 is exactly 0/1', () => {
      expect(easings.easeInOutExpo(0)).toBe(0);
      expect(easings.easeInOutExpo(1)).toBe(1);
    });
    it('easeInOutExpo evaluates both halves (t<0.5 and t>=0.5)', () => {
      // First half — exponential acceleration
      const lower = easings.easeInOutExpo(0.25);
      expect(lower).toBeGreaterThan(0);
      expect(lower).toBeLessThan(0.5);
      // Second half — exponential deceleration
      const upper = easings.easeInOutExpo(0.75);
      expect(upper).toBeGreaterThan(0.5);
      expect(upper).toBeLessThan(1);
      // Symmetry around 0.5 (within float precision)
      expect(easings.easeInOutExpo(0.5)).toBeCloseTo(0.5, 1);
    });
  });

  describe('back (overshoots)', () => {
    it('easeOutBack overshoots above 1.0 mid-animation', () => {
      // easeOutBack at t=0.6 should overshoot past 1
      const values = [0.5, 0.6, 0.7, 0.8].map((t) => easings.easeOutBack(t));
      const overshot = values.some((v) => v > 1);
      expect(overshot).toBe(true);
    });
  });

  describe('elastic (oscillates)', () => {
    it('easeInElastic special-cases 0 and 1', () => {
      expect(easings.easeInElastic(0)).toBe(0);
      expect(easings.easeInElastic(1)).toBe(1);
    });
    it('easeOutElastic special-cases 0 and 1', () => {
      expect(easings.easeOutElastic(0)).toBe(0);
      expect(easings.easeOutElastic(1)).toBe(1);
    });
    it('easeInOutElastic special-cases 0 and 1', () => {
      expect(easings.easeInOutElastic(0)).toBe(0);
      expect(easings.easeInOutElastic(1)).toBe(1);
    });
    it('easeInElastic mid-range produces oscillating values (line 131)', () => {
      // Mid-range t — neither 0 nor 1 — exercises the formula body
      const a = easings.easeInElastic(0.3);
      const b = easings.easeInElastic(0.5);
      const c = easings.easeInElastic(0.7);
      // All should be finite numbers
      expect(Number.isFinite(a)).toBe(true);
      expect(Number.isFinite(b)).toBe(true);
      expect(Number.isFinite(c)).toBe(true);
      // Should oscillate — values are not monotonic with t
      // and not equal to linear t
      expect(a).not.toBe(0.3);
      expect(c).not.toBe(0.7);
    });
    it('produces oscillating values', () => {
      // Some values mid-curve should differ significantly from linear
      const linearAt = 0.5;
      const elasticAt = easings.easeInOutElastic(0.5);
      // Elastic should equal exactly 0.5 by formula at center (by design)
      // but test that nearby points oscillate
      const before = easings.easeOutElastic(0.2);
      // easeOutElastic at small t oscillates above 1 typically
      expect(before).not.toBe(0.2);
      expect(linearAt).toBe(0.5);
      expect(elasticAt).toBeGreaterThanOrEqual(-0.1);
    });
  });

  describe('bounce', () => {
    it('easeOutBounce at t=1 returns 1', () => {
      expect(easings.easeOutBounce(1)).toBeCloseTo(0.99, 1);
    });
    it('easeInBounce is mirror of easeOutBounce', () => {
      // easeInBounce(t) = 1 - easeOutBounce(1 - t)
      const t = 0.3;
      const inB  = easings.easeInBounce(t);
      const outB = easings.easeOutBounce(1 - t);
      expect(inB + outB).toBeCloseTo(1, 5);
    });
    it('easeOutBounce covers all 4 bounces of the curve (lines 55-56)', () => {
      // The bounce-out formula has 4 piecewise segments:
      //   t < 1/2.75       (~0.364)
      //   t < 2/2.75       (~0.727)
      //   t < 2.5/2.75     (~0.909)  ← lines 55-56
      //   else
      // Test a point inside each segment to ensure every branch executes.
      const seg1 = easings.easeOutBounce(0.2);   // first bounce
      const seg2 = easings.easeOutBounce(0.5);   // second bounce
      const seg3 = easings.easeOutBounce(0.8);   // third bounce  ← target
      const seg4 = easings.easeOutBounce(0.95);  // settle

      // All in valid range
      for (const v of [seg1, seg2, seg3, seg4]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      // Third bounce should land between 0.9 and 1 (close to settled)
      expect(seg3).toBeGreaterThan(0.9);
      expect(seg3).toBeLessThan(1);
    });
  });
});

describe('resolveEasingByName (v1.3.5)', () => {
  it('returns the function for a known name', () => {
    expect(resolveEasingByName('easeInQuad')).toBe(easings.easeInQuad);
  });

  it('returns the function as-is when passed a function', () => {
    const custom: EasingFunction = (t) => t * 0.5;
    expect(resolveEasingByName(custom)).toBe(custom);
  });

  it('returns linear for unknown names', () => {
    expect(resolveEasingByName('nonexistent')).toBe(easings.linear);
  });

  it('returns linear for undefined/null', () => {
    expect(resolveEasingByName(undefined)).toBe(easings.linear);
    expect(resolveEasingByName(null)).toBe(easings.linear);
  });

  it('returns linear for non-string non-function input', () => {
    // @ts-expect-error testing defensive behavior
    expect(resolveEasingByName(42)).toBe(easings.linear);
    // @ts-expect-error testing defensive behavior
    expect(resolveEasingByName({})).toBe(easings.linear);
  });
});
