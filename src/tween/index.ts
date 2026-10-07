// ─────────────────────────────────────────────
//  ansimax/tween — Value interpolation, spring physics, composition DSL
//
//  v1.5.0 — Phase 6 closure. Three related tools:
//    - tween()     interpolate any numeric shape over time with easing
//    - spring()    react-spring-style physics animation
//    - sequence() / delay() / parallel()  composition DSL
//
//  All are AbortSignal-aware and honor reducedMotion (instant settle).
// ─────────────────────────────────────────────

import { clamp, lerp } from '../utils/helpers.js';
import { catmullRom } from '../utils/math.js';
import { sleep } from '../utils/ansi.js';
import { resolveEasingByName } from '../utils/easing.js';
import type {
  Tweenable, TweenOptions, SpringOptions, AnimationStep, KeyframesOptions,
} from './types.js';

export type {
  Tweenable, TweenOptions, TweenOnUpdate,
  SpringConfig, SpringOptions, AnimationStep, KeyframesOptions,
} from './types.js';

// ─────────────────────────────────────────────
//  Shape-aware interpolation
// ─────────────────────────────────────────────

/**
 * Interpolate between two values of the same shape. Numbers, flat numeric
 * arrays, and flat numeric records are supported. Mismatched shapes fall
 * back to returning `to` at t≥0.5 (a safe step) rather than throwing.
 *
 * @since 1.5.0
 */
export const interpolate = <T extends Tweenable>(from: T, to: T, t: number): T => {
  const ct = clamp(t, 0, 1);

  if (typeof from === 'number' && typeof to === 'number') {
    return lerp(from, to, ct) as T;
  }

  if (Array.isArray(from) && Array.isArray(to)) {
    const len = Math.min(from.length, to.length);
    const out: number[] = new Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = lerp(from[i] as number, to[i] as number, ct);
    }
    return out as T;
  }

  if (
    from !== null && to !== null
    && typeof from === 'object' && typeof to === 'object'
    && !Array.isArray(from) && !Array.isArray(to)
  ) {
    const a = from as Record<string, number>;
    const b = to as Record<string, number>;
    const out: Record<string, number> = {};
    // Interpolate keys present in `from`; pull the matching `to` value,
    // defaulting to the `from` value when a key is missing in `to`.
    for (const k of Object.keys(a)) {
      const av = a[k] as number;
      const bv = typeof b[k] === 'number' ? (b[k] as number) : av;
      out[k] = lerp(av, bv, ct);
    }
    return out as T;
  }

  // Shape mismatch — no meaningful interpolation, snap at the midpoint.
  return ct < 0.5 ? from : to;
};

// Catmull-Rom through a list of scalar waypoints. `t ∈ [0,1]` spans the whole
// series; the curve passes exactly through each value at `t = k/(n-1)` and
// stays C¹ (continuous velocity) across the joints. Endpoints are duplicated
// so the first/last segments have tangents.
const _splineScalar = (values: number[], t: number): number => {
  // Always called with ≥ 2 samples: `interpolateSpline` handles the 0- and
  // 1-frame cases before delegating, and every delegate passes one value per
  // frame (frames.length ≥ 2 by then).
  const n = values.length;
  if (n === 2) return lerp(values[0] as number, values[1] as number, clamp(t, 0, 1));
  const ct = clamp(t, 0, 1);
  const seg = ct * (n - 1);
  let i = Math.floor(seg);
  if (i >= n - 1) i = n - 2;          // clamp the last sample onto its segment
  const localT = seg - i;
  const p1 = values[i] as number;
  const p2 = values[i + 1] as number;
  const p0 = (values[i - 1] ?? p1) as number;
  const p3 = (values[i + 2] ?? p2) as number;
  return catmullRom(p0, p1, p2, p3, localT);
};

/**
 * Interpolate through a *series* of waypoints with a Catmull-Rom C¹ spline,
 * the multi-point analogue of {@link interpolate}. `t ∈ [0,1]` spans the whole
 * series: the result equals `frames[k]` exactly at `t = k/(frames.length-1)`
 * and the velocity stays continuous across every waypoint (no kinks).
 *
 * Shape-aware like `interpolate`: numbers, flat numeric arrays, and flat
 * numeric records are splined component-by-component. A single frame is
 * constant; two frames fall back to a straight line.
 *
 * @example
 * ```js
 * import { interpolateSpline } from 'ansimax';
 *
 * interpolateSpline([0, 100, 0], 0.5);   // 100 — passes through the peak
 * interpolateSpline([[0, 0], [50, 80], [100, 0]], 0.5); // [50, 80]
 * ```
 *
 * @since 1.7.3
 */
export const interpolateSpline = <T extends Tweenable>(frames: T[], t: number): T => {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('interpolateSpline requires at least one frame');
  }
  if (frames.length === 1) return frames[0] as T;
  const first = frames[0] as T;

  if (typeof first === 'number') {
    return _splineScalar(frames as number[], t) as T;
  }

  if (Array.isArray(first)) {
    const arrays = frames as unknown as number[][];
    const len = Math.min(...arrays.map((a) => a.length));
    const out: number[] = new Array(len);
    for (let c = 0; c < len; c++) {
      out[c] = _splineScalar(arrays.map((a) => a[c] as number), t);
    }
    return out as T;
  }

  if (first !== null && typeof first === 'object') {
    const records = frames as unknown as Record<string, number>[];
    const out: Record<string, number> = {};
    for (const k of Object.keys(records[0] as Record<string, number>)) {
      out[k] = _splineScalar(
        records.map((r) => (typeof r[k] === 'number' ? (r[k] as number) : 0)),
        t,
      );
    }
    return out as T;
  }

  // Unsupported shape — snap to the nearest waypoint.
  const idx = Math.round(clamp(t, 0, 1) * (frames.length - 1));
  return frames[idx] as T;
};

// ─────────────────────────────────────────────
//  Tween engine
// ─────────────────────────────────────────────

/**
 * Interpolate `from → to` over `duration`, calling `onUpdate` each frame
 * with the current value and progress. Resolves when the tween completes
 * or the signal aborts.
 *
 * @example
 * ```js
 * import { tween } from 'ansimax';
 *
 * // Animate a progress percentage
 * await tween({
 *   from: 0, to: 100, duration: 1000, easing: 'easeOutCubic',
 *   onUpdate: (v) => process.stdout.write(`\r${v.toFixed(0)}%`),
 * });
 *
 * // Animate a point
 * await tween({
 *   from: [0, 0], to: [80, 24], duration: 500,
 *   onUpdate: ([x, y]) => moveCursor(x, y),
 * });
 * ```
 *
 * @since 1.5.0
 */
export const tween = async <T extends Tweenable>(opts: TweenOptions<T>): Promise<void> => {
  const {
    from, to, duration = 300, easing, onUpdate,
    delay = 0, signal, reducedMotion = false, fps = 60,
    repeat = 0, yoyo = false, onStart, onComplete,
  } = opts;

  if (typeof onUpdate !== 'function') return;
  if (signal?.aborted) return;

  const totalRuns = 1 + Math.max(0, Number.isFinite(repeat) ? repeat : Infinity);

  // reducedMotion / non-positive duration → jump straight to the end.
  // Repeats collapse to a single settle (there is nothing to animate).
  if (reducedMotion || duration <= 0) {
    onStart?.();
    onUpdate(to, 1);
    onComplete?.();
    return;
  }

  if (delay > 0) {
    await sleep(delay, { signal });
    if (signal?.aborted) return;
  }

  onStart?.();

  const easingFn = resolveEasingByName(easing);
  const frameMs = Math.max(1, Math.round(1000 / clamp(fps, 1, 240)));

  // Run one pass from `a → b`. Returns false if aborted mid-pass.
  const runPass = async (a: T, b: T): Promise<boolean> => {
    const start = Date.now();
    // Emit the initial frame immediately so t=0 is visible.
    onUpdate(interpolate(a, b, easingFn(0)), 0);
    for (;;) {
      if (signal?.aborted) return false;
      const elapsed = Date.now() - start;
      const progress = clamp(elapsed / duration, 0, 1);
      onUpdate(interpolate(a, b, easingFn(progress)), progress);
      if (progress >= 1) return true;
      await sleep(frameMs, { signal });
    }
  };

  for (let run = 0; run < totalRuns; run++) {
    // yoyo: odd passes go backwards (b → a). Without yoyo every pass is a → b.
    const reversed = yoyo && run % 2 === 1;
    const a = reversed ? to : from;
    const b = reversed ? from : to;
    const ok = await runPass(a, b);
    if (!ok) return; // aborted — do NOT call onComplete
  }

  onComplete?.();
};

/**
 * Animate through a series of waypoints with a Catmull-Rom C¹ spline — the
 * multi-frame sibling of {@link tween}. Where chaining linear tweens kinks the
 * velocity at every junction, `keyframes` glides through each waypoint with a
 * continuous tangent, so motion (and color, and layout) feels organic.
 *
 * Shares `tween`'s contract: AbortSignal-aware, honors `reducedMotion`,
 * drift-corrected timing, `repeat`/`yoyo`, and the `onStart`/`onComplete`
 * lifecycle. With fewer than two frames there is nothing to animate.
 *
 * @example
 * ```js
 * import { keyframes } from 'ansimax';
 *
 * // Bounce a bar up to 100 and settle back, smoothly through the peak
 * await keyframes({
 *   frames: [0, 100, 60, 80],
 *   duration: 1200,
 *   onUpdate: (v) => drawBar(v),
 * });
 * ```
 *
 * @since 1.7.3
 */
export const keyframes = async <T extends Tweenable>(opts: KeyframesOptions<T>): Promise<void> => {
  const {
    frames, duration = 300, easing, onUpdate,
    delay = 0, signal, reducedMotion = false, fps = 60,
    repeat = 0, yoyo = false, onStart, onComplete,
  } = opts;

  if (typeof onUpdate !== 'function') return;
  if (!Array.isArray(frames) || frames.length === 0) return;
  if (signal?.aborted) return;

  const last = frames[frames.length - 1] as T;

  // A single frame, reducedMotion, or non-positive duration → settle at the
  // final waypoint in one update.
  if (frames.length === 1 || reducedMotion || duration <= 0) {
    onStart?.();
    onUpdate(last, 1);
    onComplete?.();
    return;
  }

  if (delay > 0) {
    await sleep(delay, { signal });
    if (signal?.aborted) return;
  }

  onStart?.();

  const easingFn = resolveEasingByName(easing);
  const frameMs = Math.max(1, Math.round(1000 / clamp(fps, 1, 240)));

  const runPass = async (seq: T[]): Promise<boolean> => {
    const start = Date.now();
    onUpdate(interpolateSpline(seq, easingFn(0)), 0);
    for (;;) {
      if (signal?.aborted) return false;
      const elapsed = Date.now() - start;
      const progress = clamp(elapsed / duration, 0, 1);
      onUpdate(interpolateSpline(seq, easingFn(progress)), progress);
      if (progress >= 1) return true;
      await sleep(frameMs, { signal });
    }
  };

  const totalRuns = 1 + Math.max(0, Number.isFinite(repeat) ? repeat : Infinity);
  const reversedFrames = [...frames].reverse();
  for (let run = 0; run < totalRuns; run++) {
    const seq = yoyo && run % 2 === 1 ? reversedFrames : frames;
    const ok = await runPass(seq);
    if (!ok) return;
  }

  onComplete?.();
};

// ─────────────────────────────────────────────
//  Spring physics
// ─────────────────────────────────────────────

/**
 * Animate `from → to` using a damped harmonic oscillator (react-spring
 * style). `onUpdate` receives the current position and velocity each
 * frame. Resolves when the spring comes to rest or the signal aborts.
 *
 * The integration uses a fixed small timestep for stability regardless of
 * the frame rate.
 *
 * @example
 * ```js
 * import { spring } from 'ansimax';
 *
 * await spring({
 *   from: 0, to: 100,
 *   config: { stiffness: 210, damping: 20 },
 *   onUpdate: (v) => drawBar(v),
 * });
 * ```
 *
 * @since 1.5.0
 */
export const spring = async (opts: SpringOptions): Promise<void> => {
  const {
    from, to, onUpdate, config = {}, velocity = 0,
    signal, reducedMotion = false, fps = 60, maxDuration = 5000,
    onStart, onComplete,
  } = opts;

  if (typeof onUpdate !== 'function') return;
  if (signal?.aborted) return;

  if (reducedMotion) {
    onStart?.();
    onUpdate(to, 0);
    onComplete?.();
    return;
  }

  const stiffness = config.stiffness ?? 170;
  const damping = config.damping ?? 26;
  const mass = Math.max(0.0001, config.mass ?? 1);
  const restThreshold = config.restThreshold ?? 0.001;

  let position = from;
  let vel = velocity;

  const frameMs = Math.max(1, Math.round(1000 / clamp(fps, 1, 240)));
  // Fixed physics timestep (seconds) — decoupled from frame rate for a
  // stable simulation. We advance the sim by however many steps fit each
  // real frame.
  const dt = 1 / 240;
  const start = Date.now();

  onStart?.();
  onUpdate(position, vel);

  for (;;) {
    if (signal?.aborted) return; // aborted → no onComplete

    // Advance the simulation by one frame's worth of fixed steps.
    for (let acc = 0; acc < frameMs / 1000; acc += dt) {
      // Hooke's law + damping: F = -k·x - c·v, a = F / m
      const springForce = -stiffness * (position - to);
      const dampingForce = -damping * vel;
      const accel = (springForce + dampingForce) / mass;
      vel += accel * dt;
      position += vel * dt;
    }

    const settled = Math.abs(position - to) < restThreshold && Math.abs(vel) < restThreshold;
    if (settled) {
      onUpdate(to, 0); // snap exactly to target
      onComplete?.();
      return;
    }

    onUpdate(position, vel);

    if (Date.now() - start > maxDuration) {
      onUpdate(to, 0); // safety: force-settle a mis-tuned spring
      onComplete?.();
      return;
    }

    await sleep(frameMs, { signal });
  }
};

// ─────────────────────────────────────────────
//  Composition DSL
// ─────────────────────────────────────────────

/**
 * A step that simply waits `ms` milliseconds. Cancellable via the signal
 * threaded in by `sequence()`.
 *
 * @since 1.5.0
 */
export const delay = (ms: number): AnimationStep =>
  async (signal?: AbortSignal): Promise<void> => {
    if (signal?.aborted) return;
    await sleep(Math.max(0, ms), { signal });
  };

/**
 * Run animation steps one after another, threading the same abort signal
 * into each. Stops early if the signal aborts between steps.
 *
 * @example
 * ```js
 * import { sequence, delay, tween } from 'ansimax';
 *
 * await sequence([
 *   (s) => tween({ from: 0, to: 100, duration: 300, onUpdate: draw, signal: s }),
 *   delay(200),
 *   (s) => tween({ from: 100, to: 0, duration: 300, onUpdate: draw, signal: s }),
 * ]);
 * ```
 *
 * @since 1.5.0
 */
export const sequence = async (
  steps: AnimationStep[],
  signal?: AbortSignal,
): Promise<void> => {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    if (signal?.aborted) return;
    if (typeof step === 'function') await step(signal);
  }
};

/**
 * Run animation steps concurrently and resolve when all settle (or the
 * signal aborts). A rejection in one step rejects the whole batch, mirroring
 * `Promise.all`.
 *
 * @since 1.5.0
 */
export const parallel = async (
  steps: AnimationStep[],
  signal?: AbortSignal,
): Promise<void> => {
  if (!Array.isArray(steps) || steps.length === 0) return;
  if (signal?.aborted) return;
  await Promise.all(
    steps.map((step) => (typeof step === 'function' ? step(signal) : Promise.resolve())),
  );
};

/**
 * **v1.5.1** — Run steps concurrently but offset each one's start by
 * `gapMs × index`, the classic "stagger" used to animate a list of items
 * so they cascade in rather than all moving at once. Resolves when the last
 * (most-delayed) step finishes, or the signal aborts.
 *
 * ```js
 * // Fade in 5 rows, each 80ms after the previous
 * await stagger(rows.map((row) => (s) =>
 *   tween({ from: 0, to: 1, duration: 200, onUpdate: (v) => row.setOpacity(v), signal: s })
 * ), 80);
 * ```
 *
 * @param steps  the per-item animation steps
 * @param gapMs  delay added per index (step `i` starts at `i × gapMs`)
 * @since 1.5.1
 */
export const stagger = async (
  steps: AnimationStep[],
  gapMs: number,
  signal?: AbortSignal,
): Promise<void> => {
  if (!Array.isArray(steps) || steps.length === 0) return;
  if (signal?.aborted) return;
  const gap = Math.max(0, gapMs);
  await Promise.all(
    steps.map(async (step, i) => {
      if (typeof step !== 'function') return;
      if (gap > 0 && i > 0) {
        await sleep(gap * i, { signal });
      }
      if (signal?.aborted) return;
      await step(signal);
    }),
  );
};

/**
 * Wrap a tween as a composable `AnimationStep` for use in `sequence()` /
 * `parallel()`. The step's own signal (from the composer) overrides any
 * signal in `opts`.
 *
 * @since 1.5.0
 */
export const tweenStep = <T extends Tweenable>(
  opts: Omit<TweenOptions<T>, 'signal'>,
): AnimationStep =>
  (signal?: AbortSignal) => tween({ ...opts, signal } as TweenOptions<T>);

/**
 * Wrap a spring as a composable `AnimationStep`.
 * @since 1.5.0
 */
export const springStep = (
  opts: Omit<SpringOptions, 'signal'>,
): AnimationStep =>
  (signal?: AbortSignal) => spring({ ...opts, signal });

/**
 * Wrap a {@link keyframes} animation as a composable `AnimationStep` for use
 * in `sequence()` / `parallel()`.
 *
 * @since 1.7.3
 */
export const keyframeStep = <T extends Tweenable>(
  opts: Omit<KeyframesOptions<T>, 'signal'>,
): AnimationStep =>
  (signal?: AbortSignal) => keyframes({ ...opts, signal } as KeyframesOptions<T>);

// ─────────────────────────────────────────────
//  Namespace
// ─────────────────────────────────────────────

export const tweenEngine = {
  tween,
  spring,
  keyframes,
  interpolate,
  interpolateSpline,
  sequence,
  parallel,
  stagger,
  delay,
  tweenStep,
  springStep,
  keyframeStep,
};
