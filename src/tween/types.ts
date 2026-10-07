// ─────────────────────────────────────────────
//  ansimax/tween — Public types
//
//  v1.5.0 — Phase 6 closure: a value-interpolation engine (tween any
//  numeric shape), spring physics, and a small composition DSL.
// ─────────────────────────────────────────────

import type { EasingLibraryName, EasingFunction } from '../utils/easing.js';

/**
 * Any value the tween engine can interpolate:
 * - a number
 * - a flat array of numbers (e.g. an RGB triple, a 2D point)
 * - a flat record of numbers (e.g. `{ x, y, opacity }`)
 *
 * Nested structures are not interpolated (only the top level).
 */
export type Tweenable = number | number[] | Record<string, number>;

/**
 * Called on every animation frame with the current interpolated value and
 * progress in `[0, 1]`. This is where you render the frame.
 */
export type TweenOnUpdate<T extends Tweenable> = (value: T, progress: number) => void;

export interface TweenOptions<T extends Tweenable> {
  from: T;
  to: T;
  /** Total duration in milliseconds. Default `300`. */
  duration?: number;
  /** Easing curve — a name from the easing library or a custom function. */
  easing?: EasingLibraryName | string | EasingFunction;
  /** Called every frame with the current value + progress. */
  onUpdate: TweenOnUpdate<T>;
  /** Delay before the first frame, in ms. Default `0`. */
  delay?: number;
  /** Cancel the tween mid-flight; resolves immediately when aborted. */
  signal?: AbortSignal;
  /**
   * Accessibility: when true, jump straight to `to` in a single update
   * with no intermediate frames.
   */
  reducedMotion?: boolean;
  /** Approximate frames per second. Default `60`. */
  fps?: number;
  /**
   * **v1.5.1** — Number of times to repeat after the first run. `0` (default)
   * plays once; `2` plays three times total; `Infinity` loops forever (until
   * aborted). Negative values are treated as `0`.
   *
   * @since 1.5.1
   */
  repeat?: number;
  /**
   * **v1.5.1** — When true, alternate direction each repeat (`from→to`, then
   * `to→from`, …), the classic "yoyo" effect. Has no effect when `repeat` is 0.
   *
   * @since 1.5.1
   */
  yoyo?: boolean;
  /**
   * **v1.5.1** — Called once before the first frame (after any `delay`).
   *
   * @since 1.5.1
   */
  onStart?: () => void;
  /**
   * **v1.5.1** — Called once after the tween fully completes (all repeats
   * done). Not called if the tween is aborted.
   *
   * @since 1.5.1
   */
  onComplete?: () => void;
}

/**
 * Spring configuration, react-spring style. Higher `stiffness` snaps
 * faster; higher `damping` settles with less oscillation; higher `mass`
 * makes the system feel heavier and slower.
 */
export interface SpringConfig {
  stiffness?: number; // default 170
  damping?: number;   // default 26
  mass?: number;      // default 1
  /** Movement below this (per settle check) counts as "at rest". */
  restThreshold?: number; // default 0.001
}

export interface SpringOptions {
  from: number;
  to: number;
  onUpdate: (value: number, velocity: number) => void;
  config?: SpringConfig;
  /** Initial velocity (units/second). Default `0`. */
  velocity?: number;
  signal?: AbortSignal;
  reducedMotion?: boolean;
  fps?: number;
  /** Safety cap so a mis-tuned spring can't run forever. Default `5000`. */
  maxDuration?: number;
  /**
   * **v1.5.1** — Called once before the first frame.
   * @since 1.5.1
   */
  onStart?: () => void;
  /**
   * **v1.5.1** — Called once after the spring settles. Not called if aborted.
   * @since 1.5.1
   */
  onComplete?: () => void;
}

/** A composable animation step: any function returning a promise. */
export type AnimationStep = (signal?: AbortSignal) => Promise<void>;

/**
 * Options for {@link keyframes} — a tween that eases through a *series* of
 * waypoints with a Catmull-Rom C¹ spline, so velocity stays continuous at
 * every keyframe instead of kinking the way back-to-back linear tweens do.
 *
 * @since 1.7.3
 */
export interface KeyframesOptions<T extends Tweenable> {
  /**
   * Two or more waypoints of the same shape. The animation passes *through*
   * each one in order; the curve between them is shaped by its neighbours.
   */
  frames: T[];
  /** Total duration across all frames, in milliseconds. Default `300`. */
  duration?: number;
  /** Easing applied to the global progress before sampling the spline. */
  easing?: EasingLibraryName | string | EasingFunction;
  /** Called every frame with the current value + global progress in `[0,1]`. */
  onUpdate: TweenOnUpdate<T>;
  /** Delay before the first frame, in ms. Default `0`. */
  delay?: number;
  /** Cancel mid-flight; resolves immediately when aborted. */
  signal?: AbortSignal;
  /** Accessibility: jump straight to the last frame with no interpolation. */
  reducedMotion?: boolean;
  /** Approximate frames per second. Default `60`. */
  fps?: number;
  /** Times to repeat after the first run. `Infinity` loops. Default `0`. */
  repeat?: number;
  /** Alternate direction each repeat (reverse the frame order). Default `false`. */
  yoyo?: boolean;
  /** Called once before the first frame (after any `delay`). */
  onStart?: () => void;
  /** Called once after all runs complete. Not called if aborted. */
  onComplete?: () => void;
}
