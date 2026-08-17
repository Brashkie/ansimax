// ─────────────────────────────────────────────
//  ANIMATIONS  –  barrel
//
//  Robustness guarantees (unchanged across the v1.6.3 refactor):
//   - AbortSignal-aware (cancellable mid-run, signal propagates to nested steps)
//   - reducedMotion-aware (renders instantly, skips effects)
//   - Stream-safe (no-ops when stdout is missing or non-TTY)
//   - Backpressure-aware (uses writeAsync internally for long loops)
//   - Frame-throttled (consistent FPS based on FRAME_MS)
//   - Hooks-enabled (onFrame/onDone/onAbort callbacks, errors swallowed)
//   - Cursor-safe (reference-counted hide/show, survives parallel runs and crashes)
//   - Resize-aware (re-reads terminal width per frame in slide)
//   - Crash-safe (registers exit/SIGINT/SIGTERM handlers to restore cursor)
//
//  v1.6.3 — the former ~1100-line monolith was split into focused modules:
//    - internal.ts     private helpers (guards, cursor, crash, math, hooks)
//    - types.ts        public option interfaces
//    - effects.ts      the effect implementations
//    - composition.ts  sequence / parallel / chain / delay
//  This barrel re-exports the same public API — nothing external changed.
// ─────────────────────────────────────────────

// Public predicates + cursor reset (unchanged public API)
export { canAnimate, resetCursorRefCount } from './internal.js';
export type { AnimationHooks } from './internal.js';

// Option types
export type {
  TypewriterOptions, FadeOptions, SlideOptions, PulseOptions,
  WaveOptions, GlitchOptions, RevealOptions, ShakeOptions, CountUpOptions,
  ParallelStep, ParallelOptions,
} from './types.js';

// Effects
import {
  typewriter, fadeIn, fadeOut, slide, pulse, wave, glitch, reveal,
  shake, countUp,
} from './effects.js';
// Composition
import { sequence, parallel, chain, delay } from './composition.js';

export const animate = {
  typewriter,
  fadeIn,
  fadeOut,
  slide,
  pulse,
  wave,
  glitch,
  reveal,
  sequence,
  chain,
  parallel,
  delay,
  // v1.3.4
  shake,
  countUp,
};

export default animate;
