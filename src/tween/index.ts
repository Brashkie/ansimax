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
import { sleep } from '../utils/ansi.js';
import { resolveEasingByName } from '../utils/easing.js';
import type {
  Tweenable, TweenOptions, SpringOptions, AnimationStep,
} from './types.js';

export type {
  Tweenable, TweenOptions, TweenOnUpdate,
  SpringConfig, SpringOptions, AnimationStep,
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

// ─────────────────────────────────────────────
//  Namespace
// ─────────────────────────────────────────────

export const tweenEngine = {
  tween,
  spring,
  interpolate,
  sequence,
  parallel,
  stagger,
  delay,
  tweenStep,
  springStep,
};
