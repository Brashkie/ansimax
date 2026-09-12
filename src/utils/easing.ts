// ─────────────────────────────────────────────
//  v1.3.5 — Easing functions (mathematical curves)
//
//  Comprehensive set of easing curves mapping t ∈ [0, 1] → eased ∈ [0, 1].
//  Includes the Robert Penner classics (quad/cubic/quart/quint/sine/expo/
//  circ/back/elastic/bounce) in their in / out / inOut variants.
//
//  All functions are pure and deterministic. They expect `t` in [0, 1];
//  callers that may pass out-of-range values should clamp first.
//
//  Reference: https://easings.net/
// ─────────────────────────────────────────────

export type EasingFunction = (t: number) => number;

/**
 * Union of all built-in easing names in the comprehensive Robert Penner
 * library. Provides autocompletion and prevents typos when looking up
 * functions in `easings`.
 *
 * **Note**: This is the v1.3.5 extended library. The original `EasingName`
 * from the gradient module is a smaller union (5 values) and is
 * preserved for backward compatibility.
 *
 * @since 1.3.5
 */
export type EasingLibraryName =
  | 'linear'
  | 'easeInQuad'    | 'easeOutQuad'    | 'easeInOutQuad'
  | 'easeInCubic'   | 'easeOutCubic'   | 'easeInOutCubic'
  | 'easeInQuart'   | 'easeOutQuart'   | 'easeInOutQuart'
  | 'easeInQuint'   | 'easeOutQuint'   | 'easeInOutQuint'
  | 'easeInSine'    | 'easeOutSine'    | 'easeInOutSine'
  | 'easeInExpo'    | 'easeOutExpo'    | 'easeInOutExpo'
  | 'easeInCirc'    | 'easeOutCirc'    | 'easeInOutCirc'
  | 'easeInBack'    | 'easeOutBack'    | 'easeInOutBack'
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic'
  | 'easeInBounce'  | 'easeOutBounce'  | 'easeInOutBounce';

const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;
const c5 = (2 * Math.PI) / 4.5;

const _bounceOut: EasingFunction = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const x = t - 1.5 / d1;
    return n1 * x * x + 0.75;
  }
  if (t < 2.5 / d1) {
    const x = t - 2.25 / d1;
    return n1 * x * x + 0.9375;
  }
  const x = t - 2.625 / d1;
  return n1 * x * x + 0.984375;
};

/**
 * A library of named easing functions. Each maps `t ∈ [0, 1]` to an
 * eased value, typically also in `[0, 1]` (back/elastic briefly
 * overshoot by design).
 *
 * Typed as `Record<EasingLibraryName, EasingFunction>` so all 31 keys are
 * known to TypeScript — autocompletion + no `possibly undefined` errors
 * when accessing standard names.
 *
 * @since 1.3.5
 */
export const easings: Record<EasingLibraryName, EasingFunction> = {
  // ── Linear ──
  linear: (t) => t,

  // ── Quadratic (t²) ──
  easeInQuad:    (t) => t * t,
  easeOutQuad:   (t) => 1 - (1 - t) * (1 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),

  // ── Cubic (t³) ──
  easeInCubic:    (t) => t * t * t,
  easeOutCubic:   (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  // ── Quartic (t⁴) ──
  easeInQuart:    (t) => t * t * t * t,
  easeOutQuart:   (t) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),

  // ── Quintic (t⁵) ──
  easeInQuint:    (t) => t * t * t * t * t,
  easeOutQuint:   (t) => 1 - Math.pow(1 - t, 5),
  easeInOutQuint: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),

  // ── Sinusoidal ──
  easeInSine:    (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine:   (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  // ── Exponential ──
  easeInExpo:    (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  easeOutExpo:   (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // ── Circular ──
  easeInCirc:    (t) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
  easeOutCirc:   (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  easeInOutCirc: (t) => (t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2),

  // ── Back (overshoots) ──
  easeInBack:    (t) => c3 * t * t * t - c1 * t * t,
  easeOutBack:   (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2),
  easeInOutBack: (t) => (t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2),

  // ── Elastic (oscillates) ──
  easeInElastic: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },
  easeOutElastic: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeInOutElastic: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return t < 0.5
      ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // ── Bounce (bouncing ball) ──
  easeInBounce:    (t) => 1 - _bounceOut(1 - t),
  easeOutBounce:   _bounceOut,
  easeInOutBounce: (t) => (t < 0.5
    ? (1 - _bounceOut(1 - 2 * t)) / 2
    : (1 + _bounceOut(2 * t - 1)) / 2),
};

/**
 * Resolve an easing reference to a function. Accepts a function (returned
 * as-is), a named string in `easings` (typed `EasingName` for autocomplete,
 * but any string is allowed at runtime with linear fallback), or
 * `undefined`/invalid input (returns `linear`).
 *
 * @since 1.3.5
 */
export const resolveEasingByName = (
  e: EasingLibraryName | string | EasingFunction | undefined | null,
): EasingFunction => {
  if (typeof e === 'function') return e;
  if (typeof e === 'string' && (easings as Record<string, EasingFunction>)[e]) {
    return (easings as Record<string, EasingFunction>)[e] as EasingFunction;
  }
  return easings.linear;
};

// ─────────────────────────────────────────────
//  v1.6.6 — stepped + preset easings (Phase 6)
// ─────────────────────────────────────────────

/** Direction for the {@link steps} easing, mirroring CSS `steps()`. */
export type StepPosition = 'start' | 'end';

/**
 * A stepped (staircase) easing, like CSS `steps(n, position)`. Instead of a
 * smooth curve, progress jumps in `n` discrete increments — useful for
 * "typewriter" / retro / mechanical motion, or snapping a value to a grid.
 *
 * - `'end'` (default): the jump happens at the *end* of each step, so `t=0`
 *   yields `0` and the final step completes at `t=1`.
 * - `'start'`: the jump happens at the *start* of each step, so progress
 *   leaps immediately and reaches `1` before `t=1`.
 *
 * @param n         number of steps (≥ 1)
 * @param position  where the jump occurs within each step. Default `'end'`.
 * @since 1.6.6
 */
export const steps = (n: number, position: StepPosition = 'end'): EasingFunction => {
  const count = Math.max(1, Math.floor(n));
  return (t: number): number => {
    const clamped = Math.max(0, Math.min(1, t));
    if (position === 'start') {
      return Math.min(1, Math.ceil(clamped * count) / count);
    }
    // 'end'
    return Math.floor(clamped * count) / count;
  };
};

/** Single hard jump at the start (`steps(1, 'start')`). @since 1.6.6 */
export const stepStart: EasingFunction = steps(1, 'start');
/** Single hard jump at the end (`steps(1, 'end')`). @since 1.6.6 */
export const stepEnd: EasingFunction = steps(1, 'end');

/**
 * Smoothstep (Hermite) easing — the classic `3t² − 2t³` S-curve used in
 * shaders. Gentler than `easeInOutCubic`, with zero first-derivative at both
 * ends. @since 1.6.6
 */
export const smoothStep: EasingFunction = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * Smootherstep (Ken Perlin's variant) — `6t⁵ − 15t⁴ + 10t³`. Even smoother
 * than {@link smoothStep}, with zero first *and* second derivatives at the
 * ends. @since 1.6.6
 */
export const smootherStep: EasingFunction = (t) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c * (c * (c * 6 - 15) + 10);
};

// ─────────────────────────────────────────────
//  v1.6.7 — cubic-bezier easing factory (Phase 6)
// ─────────────────────────────────────────────

/**
 * Build an easing function from a cubic Bézier curve, exactly like CSS
 * `cubic-bezier(x1, y1, x2, y2)`. The curve runs from `(0,0)` to `(1,1)`
 * with two control points `(x1,y1)` and `(x2,y2)`; `x` must stay in `[0,1]`
 * (a monotonic time axis) while `y` may overshoot for anticipation/overshoot
 * effects.
 *
 * For a given input `t` (time), it solves for the curve parameter whose `x`
 * equals `t` (Newton–Raphson with a bisection fallback), then returns that
 * point's `y`. Presets like `easeInOutCubic` correspond to specific control
 * points; this factory covers every curve in between.
 *
 * @example
 * ```js
 * import { cubicBezier } from 'ansimax';
 *
 * const ease = cubicBezier(0.25, 0.1, 0.25, 1);   // CSS "ease"
 * const snap = cubicBezier(0.68, -0.55, 0.27, 1.55); // overshoot both ends
 * ```
 *
 * @since 1.6.7
 */
export const cubicBezier = (
  x1: number, y1: number, x2: number, y2: number,
): EasingFunction => {
  // Clamp the x control points to [0,1] so the time axis stays monotonic.
  const cx1 = Math.max(0, Math.min(1, x1));
  const cx2 = Math.max(0, Math.min(1, x2));

  // Bézier basis (P0=0, P3=1) expressed as polynomial coefficients.
  const bezier = (a: number, b: number, u: number): number => {
    // B(u) = 3(1-u)²·u·a + 3(1-u)·u²·b + u³
    const mu = 1 - u;
    return 3 * mu * mu * u * a + 3 * mu * u * u * b + u * u * u;
  };
  const bezierPrime = (a: number, b: number, u: number): number => {
    // dB/du
    const mu = 1 - u;
    return 3 * mu * mu * a + 6 * mu * u * (b - a) + 3 * u * u * (1 - b);
  };

  // Solve bezier_x(u) = t for u, then return bezier_y(u).
  const solveU = (t: number): number => {
    let u = t; // good initial guess since x≈t for gentle curves
    // Newton–Raphson
    for (let i = 0; i < 8; i++) {
      const x = bezier(cx1, cx2, u) - t;
      if (Math.abs(x) < 1e-6) return u;
      const dx = bezierPrime(cx1, cx2, u);
      /* istanbul ignore next — the only points where x'(t)=0 on a monotonic
         Bézier are double roots (e.g. cubicBezier(1,·,0,·) → 12(t-½)²), and
         there x(t)=t too, so the |x|<1e-6 return above fires first. Newton
         never *lands* on a zero-derivative point from elsewhere (it approaches
         a double root asymptotically → loop exhaustion → bisection). Kept as a
         real divide-by-zero guard; see the cubicBezier(1,0,0,1) test. */
      if (Math.abs(dx) < 1e-6) break;
      u -= x / dx;
    }
    // Bisection fallback for robustness
    let lo = 0, hi = 1;
    u = t;
    for (let i = 0; i < 20; i++) {
      const x = bezier(cx1, cx2, u);
      if (Math.abs(x - t) < 1e-6) break;
      if (x < t) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return u;
  };

  return (t: number): number => {
    const clamped = Math.max(0, Math.min(1, t));
    if (clamped === 0) return 0;
    if (clamped === 1) return 1;
    const u = solveU(clamped);
    return bezier(y1, y2, u); // y may overshoot [0,1] for anticipation
  };
};
