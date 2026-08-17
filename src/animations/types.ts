// ─────────────────────────────────────────────
//  animations/types — public option interfaces
//
//  v1.6.3 — extracted from the former monolithic animations/index.ts.
//  All option shapes for the animation effects live here, keyed off the
//  shared AnimationHooks (onFrame/onDone/onAbort) from ./internal.
// ─────────────────────────────────────────────

import type { RGB } from '../utils/helpers.js';
import type { ColorFn } from '../colors/index.js';
import type { AnimationHooks } from './internal.js';

export interface TypewriterOptions extends AnimationHooks {
  speed?: number;
  newline?: boolean;
  colorFn?: ColorFn | null;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface FadeOptions extends AnimationHooks {
  duration?: number;
  steps?: number;
  newline?: boolean;
  color?: string | RGB;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface SlideOptions extends AnimationHooks {
  direction?: 'left' | 'right';
  duration?: number;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface PulseOptions extends AnimationHooks {
  times?: number;
  interval?: number;
  color1?: string | RGB;
  color2?: string | RGB;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface WaveOptions extends AnimationHooks {
  duration?: number;
  steps?: number;
  colors?: string[];
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface GlitchOptions extends AnimationHooks {
  duration?: number;
  intensity?: number;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface RevealOptions extends AnimationHooks {
  duration?: number;
  charset?: string;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
  /**
   * Number of "scramble" frames before the text resolves. Default scales
   * with text length (longer text → more frames for visible reveal).
   */
  steps?: number;
}

export interface ShakeOptions extends AnimationHooks {
  /** Number of shake cycles. Default `5`. */
  times?: number;
  /** Pixels of horizontal displacement per frame. Default `2`. */
  intensity?: number;
  /** Milliseconds between frames. Default `50`. */
  interval?: number;
  /** Emit newline at end. Default `true`. */
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface CountUpOptions extends AnimationHooks {
  /** Total animation duration in ms. Default `1500`. */
  duration?: number;
  /** Frame count — more = smoother but slower. Default `60`. */
  steps?: number;
  /** Decimal places to show. Default `0`. */
  decimals?: number;
  /**
   * Format the displayed value. Default: `(n) => n.toString()`.
   * Use this to add prefixes/suffixes, commas, etc.
   */
  format?: (value: number) => string;
  /**
   * Easing function — input/output both in [0, 1]. Default linear.
   * Try `(t) => t * t` for accelerate, `(t) => 1 - (1-t)**2` for decelerate.
   */
  easing?: (t: number) => number;
  /** Emit newline at end. Default `true`. */
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

/**
 * A parallel step receives the parent signal. Steps that ignore it
 * (zero-arg thunks) still work via the optional parameter.
 */
export type ParallelStep = (opts?: { signal?: AbortSignal }) => Promise<void>;

export interface ParallelOptions {
  signal?: AbortSignal;
  /**
   * Maximum time (ms) to wait for all steps to settle. After timeout,
   * remaining steps are abandoned and parallel() resolves. Useful for
   * preventing animations from blocking indefinitely on stuck steps.
   */
  timeout?: number;
}
