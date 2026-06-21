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
