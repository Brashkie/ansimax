// ─────────────────────────────────────────────
//  ansimax/utils — Pure math helpers
//
//  v1.4.6 — A small, dependency-free numeric toolkit used across the
//  rendering engine (gradients, easing, layout distribution, dithering).
//
//  Every function here is:
//   • Pure (no side effects, no globals)
//   • Total (defined for all finite inputs; documented edge behavior)
//   • Deterministic
//
//  These consolidate one-off arithmetic that was previously inlined in
//  colors/, animations/, and images/. Centralizing them makes the math
//  testable in isolation and reusable by future modules.
//
//  Note: `lerp` already lives in utils/helpers (since v1.3.x). We re-use
//  it here rather than redefining, keeping a single source of truth.
// ─────────────────────────────────────────────

import { lerp } from './helpers.js';

// Re-export for convenience so `math.ts` is a complete numeric surface.
export { lerp };

/**
 * Inverse of `lerp` — given a value, find the `t` that produced it.
 * Returns 0 when `a === b` (degenerate range) to avoid division by zero.
 *
 * @example
 * ```ts
 * inverseLerp(0, 10, 5)   // → 0.5
 * inverseLerp(5, 5, 5)    // → 0 (degenerate)
 * ```
 */
export const inverseLerp = (a: number, b: number, value: number): number =>
  a === b ? 0 : (value - a) / (b - a);

/**
 * Re-map a value from one range to another. Combines `inverseLerp` +
 * `lerp`. Does not clamp.
 *
 * @example
 * ```ts
 * remap(5, 0, 10, 0, 100)   // → 50
 * remap(0, -1, 1, 0, 255)   // → 127.5
 * ```
 */
export const remap = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => lerp(outMin, outMax, inverseLerp(inMin, inMax, value));

/**
 * Clamp `value` to the inclusive range `[min, max]`.
 * If `min > max`, the bounds are swapped so the result is still sane.
 *
 * @example
 * ```ts
 * clamp(15, 0, 10)   // → 10
 * clamp(-3, 0, 10)   // → 0
 * ```
 */
export const clamp = (value: number, min: number, max: number): number => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.min(hi, Math.max(lo, value));
};

/**
 * Clamp to the unit interval `[0, 1]`. Shorthand for `clamp(v, 0, 1)`.
 */
export const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Smoothstep interpolation — Hermite easing between two edges.
 * Returns 0 below `edge0`, 1 above `edge1`, and a smooth S-curve
 * (3t² − 2t³) in between. Classic in shaders and gradients.
 *
 * @example
 * ```ts
 * smoothstep(0, 1, 0.5)    // → 0.5
 * smoothstep(0, 1, 0.25)   // → 0.15625
 * ```
 */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01(inverseLerp(edge0, edge1, x));
  return t * t * (3 - 2 * t);
};

/**
 * Smootherstep — Ken Perlin's improved variant with zero 1st AND 2nd
 * derivatives at the edges (6t⁵ − 15t⁴ + 10t³). Even smoother than
 * `smoothstep` for animation.
 *
 * @example
 * ```ts
 * smootherstep(0, 1, 0.5)   // → 0.5
 * ```
 */
export const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp01(inverseLerp(edge0, edge1, x));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/**
 * Round to a fixed number of decimal places. Avoids float noise.
 *
 * @example
 * ```ts
 * roundTo(3.14159, 2)   // → 3.14
 * roundTo(1.005, 2)     // → 1.01
 * ```
 */
export const roundTo = (value: number, decimals: number): number => {
  const p = Math.pow(10, Math.max(0, Math.floor(decimals)));
  return Math.round(value * p) / p;
};

/**
 * True modulo that always returns a result with the sign of the divisor.
 * Unlike JS `%`, `mod(-1, 4)` is `3`, not `-1`. Essential for cyclic
 * indexing (color wheels, animation loops).
 *
 * @example
 * ```ts
 * mod(-1, 4)   // → 3
 * mod(5, 4)    // → 1
 * mod(7, 3)    // → 1
 * ```
 */
export const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * Wrap a value into the half-open range `[min, max)`. Useful for angles
 * (`wrap(angle, 0, 360)`) and hue rotation.
 *
 * @example
 * ```ts
 * wrap(370, 0, 360)   // → 10
 * wrap(-10, 0, 360)   // → 350
 * ```
 */
export const wrap = (value: number, min: number, max: number): number => {
  const range = max - min;
  if (range <= 0) return min;
  return min + mod(value - min, range);
};

/**
 * Greatest common divisor (Euclid's algorithm). Operates on the absolute
 * values, so sign is ignored. `gcd(0, 0)` is `0`.
 *
 * @example
 * ```ts
 * gcd(12, 8)   // → 4
 * gcd(17, 5)   // → 1
 * ```
 */
export const gcd = (a: number, b: number): number => {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    [x, y] = [y, x % y];
  }
  return x;
};

/**
 * Least common multiple. `lcm(a, 0)` is `0`.
 *
 * @example
 * ```ts
 * lcm(4, 6)   // → 12
 * lcm(3, 5)   // → 15
 * ```
 */
export const lcm = (a: number, b: number): number => {
  const g = gcd(a, b);
  return g === 0 ? 0 : Math.abs(Math.trunc(a) * Math.trunc(b)) / g;
};

/**
 * Sum of an array of numbers. Empty array → 0.
 */
export const sum = (values: number[]): number => {
  let total = 0;
  for (const v of values) total += v;
  return total;
};

/**
 * Arithmetic mean. Empty array → 0 (avoids NaN).
 */
export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : sum(values) / values.length;

/**
 * Distribute an integer `total` across `parts` buckets as evenly as
 * possible, giving the remainder to the earliest buckets. The result
 * always sums exactly to `total` — no rounding drift. Used for layout
 * column/gap distribution.
 *
 * @example
 * ```ts
 * distribute(10, 3)   // → [4, 3, 3]
 * distribute(9, 3)    // → [3, 3, 3]
 * distribute(7, 4)    // → [2, 2, 2, 1]
 * ```
 */
export const distribute = (total: number, parts: number): number[] => {
  const n = Math.max(0, Math.floor(parts));
  if (n === 0) return [];
  const t = Math.floor(total);
  const base = Math.floor(t / n);
  const remainder = t - base * n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(base + (i < remainder ? 1 : 0));
  }
  return out;
};

// ─────────────────────────────────────────────
//  v1.6.2 — Statistics + advanced interpolation
// ─────────────────────────────────────────────

/**
 * The median of a list of numbers. Returns `NaN` for an empty list. Does not
 * mutate the input (works on a sorted copy). For an even count, returns the
 * average of the two middle values.
 *
 * @since 1.6.2
 */
export const median = (values: number[]): number => {
  if (!Array.isArray(values) || values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
    : (sorted[mid] as number);
};

/**
 * Population variance (mean of squared deviations). Returns `NaN` for an
 * empty list. Pass `sample = true` for the sample variance (divides by
 * `n - 1`, Bessel's correction).
 *
 * @since 1.6.2
 */
export const variance = (values: number[], sample = false): number => {
  if (!Array.isArray(values) || values.length === 0) return NaN;
  const n = values.length;
  if (sample && n < 2) return NaN;
  const m = mean(values);
  const ss = values.reduce((acc, v) => acc + (v - m) * (v - m), 0);
  return ss / (sample ? n - 1 : n);
};

/**
 * Standard deviation — the square root of the variance. Pass `sample = true`
 * for the sample standard deviation.
 *
 * @since 1.6.2
 */
export const stddev = (values: number[], sample = false): number =>
  Math.sqrt(variance(values, sample));

/**
 * Linearly-interpolated percentile (0–100) of a numeric list, matching the
 * common "linear interpolation between closest ranks" method. `p = 50` is
 * the median. Returns `NaN` for an empty list; clamps `p` to `[0, 100]`.
 *
 * @since 1.6.2
 */
export const percentile = (values: number[], p: number): number => {
  if (!Array.isArray(values) || values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0] as number;
  const pc = Math.max(0, Math.min(100, p));
  const rank = (pc / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const frac = rank - lo;
  return (sorted[lo] as number) + ((sorted[hi] as number) - (sorted[lo] as number)) * frac;
};

/**
 * Snap a value to the nearest multiple of `step` (grid quantization).
 * `quantize(7, 5)` → `5`, `quantize(8, 5)` → `10`. A `step <= 0` returns the
 * value unchanged.
 *
 * @since 1.6.2
 */
export const quantize = (value: number, step: number): number => {
  if (!Number.isFinite(step) || step <= 0) return value;
  return Math.round(value / step) * step;
};

/**
 * Catmull–Rom spline interpolation through four control points. Returns the
 * point on the smooth curve between `p1` and `p2` at parameter `t ∈ [0,1]`.
 * Unlike a Bézier, the curve passes *through* `p1` and `p2`, using `p0` and
 * `p3` only to shape the tangents — ideal for smooth motion through a series
 * of waypoints.
 *
 * @since 1.6.2
 */
export const catmullRom = (
  p0: number, p1: number, p2: number, p3: number, t: number,
): number => {
  const t2 = t * t;
  const t3 = t2 * t;
  // Standard Catmull–Rom basis (tension = 0.5).
  return 0.5 * (
    2 * p1
    + (-p0 + p2) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
};

/**
 * Evaluate an unnormalized Gaussian (bell curve) at `x`, centered at `mean`
 * with standard deviation `sigma`. Peaks at `1.0` when `x === mean`. Useful
 * for smooth falloff, feathering, and weighting. A `sigma <= 0` returns `1`
 * at the center and `0` elsewhere.
 *
 * @since 1.6.2
 */
export const gaussian = (x: number, center = 0, sigma = 1): number => {
  if (!Number.isFinite(sigma) || sigma <= 0) return x === center ? 1 : 0;
  const d = x - center;
  return Math.exp(-(d * d) / (2 * sigma * sigma));
};
