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
