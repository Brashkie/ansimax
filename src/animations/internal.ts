// ─────────────────────────────────────────────
//  animations/internal — shared helpers
//
//  v1.6.3 — extracted from the former monolithic animations/index.ts so
//  each concern lives in its own file. This module holds the private
//  predicates, cursor ref-counting, crash handlers, math helpers, safe
//  writes, and hook plumbing that the effect modules share. Public API is
//  unchanged — the barrel re-exports canAnimate/resetCursorRefCount.
// ─────────────────────────────────────────────

import {
  cursor,
  write, writeAsync,
  FRAME_MS,
  supportsColor,
  hideCursor, showCursor,
} from '../utils/ansi.js';
import { hexToRgb, RGB } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Single-responsibility predicates
//
//  Each helper checks ONE thing. Composing them produces clear guards
//  and makes failures easy to debug — instead of "shouldSkip returned
//  true, why?" you can see exactly which condition fired.
// ─────────────────────────────────────────────

/** True when stdout is a real interactive TTY. */
export const isNonInteractive = (): boolean => !process.stdout?.isTTY;

/** True when the user requested no motion (accessibility). */
export const isReduced = (reduced?: boolean): boolean => Boolean(reduced);

/** True when the abort signal is already triggered. */
export const isAborted = (signal?: AbortSignal): boolean => Boolean(signal?.aborted);

/** True when colors are not supported in the current terminal. */
export const isColorless = (): boolean => supportsColor() === 'none';

/**
 * Skip guard for **motion** animations — typewriter, slide, glitch, reveal.
 * These work in B&W as long as we have a TTY for cursor control.
 */
export const shouldSkip = (signal?: AbortSignal, reduced?: boolean): boolean =>
  isNonInteractive() || isReduced(reduced) || isAborted(signal);

/**
 * Skip guard for **color-dependent** animations — fadeIn, fadeOut, pulse, wave.
 * Adds a color requirement on top of the motion guard.
 */
export const shouldSkipColor = (signal?: AbortSignal, reduced?: boolean): boolean =>
  shouldSkip(signal, reduced) || isColorless();

/**
 * True when colors AND TTY are both available.
 * Public predicate — useful for callers that want to gate features.
 */
export const canAnimate = (): boolean =>
  !isNonInteractive() && !isColorless();

// ─────────────────────────────────────────────
//  Reference-counted cursor visibility
//
//  Multiple animations running in parallel each call hide()/show() —
//  without ref counting, the inner one calling show() reveals the
//  cursor while the outer animation still wants it hidden.
//  Ref counting makes hide/show idempotent across overlapping calls.
//
//  Crash safety: process.exit/SIGINT/SIGTERM handlers force-restore
//  the cursor even if a finally block can't run.
// ─────────────────────────────────────────────

let _cursorHiddenCount = 0;

export const hideCursorSafe = (): void => {
  // First acquire emits the hide escape; subsequent acquires only count
  if (_cursorHiddenCount === 0) {
    try { hideCursor(); } catch { /* stdout may be torn down — best-effort */ }
  }
  _cursorHiddenCount++;
};

export const showCursorSafe = (): void => {
  if (_cursorHiddenCount > 0) _cursorHiddenCount--;
  if (_cursorHiddenCount === 0) {
    try { showCursor(); } catch { /* best-effort */ }
  }
};

/** For tests — reset the cursor counter back to zero. */
export const resetCursorRefCount = (): void => {
  _cursorHiddenCount = 0;
};

// ─────────────────────────────────────────────
//  Crash cleanup — force-restore cursor on unexpected exit
//
//  Registered exactly once on first animation use. Even if the process
//  dies mid-animation (uncaught exception, SIGINT, SIGTERM), the
//  cursor escape is written directly to stdout so the user isn't left
//  with an invisible cursor in their shell.
// ─────────────────────────────────────────────

let _crashHandlersRegistered = false;

/**
 * Detect if we're running inside a test runner. Jest sets JEST_WORKER_ID
 * and NODE_ENV=test; Vitest sets VITEST. In these environments we skip
 * registering process listeners, since they keep the worker alive past
 * test completion and trigger "force exited" warnings.
 */
const isTestEnv = (): boolean => {
  /* istanbul ignore next — env detection has many branches */
  return (
    process.env['JEST_WORKER_ID'] !== undefined ||
    process.env['VITEST'] !== undefined ||
    process.env['NODE_ENV'] === 'test'
  );
};

/* istanbul ignore next — crash handler body fires only on real exit/SIGINT/SIGTERM */
const installCrashHandlersImpl = (): void => {
  const restore = (): void => {
    if (_cursorHiddenCount > 0) {
      try {
        // Direct write — bypasses any async layer that may be torn down
        if (process.stdout && typeof process.stdout.write === 'function') {
          process.stdout.write(cursor.show());
        }
      } catch { /* nothing we can do at this point */ }
      _cursorHiddenCount = 0;
    }
  };
  process.on('exit', restore);
  // SIGINT/SIGTERM: restore then re-raise default behavior
  process.on('SIGINT',  () => { restore(); process.exit(130); });
  process.on('SIGTERM', () => { restore(); process.exit(143); });
};

export const registerCrashHandlers = (): void => {
  if (_crashHandlersRegistered) return;
  /* istanbul ignore next — guards against worker/sandbox without process.on */
  if (!process || typeof process.on !== 'function') return;
  _crashHandlersRegistered = true;
  // Skip in test environments — listeners keep the worker alive
  if (isTestEnv()) return;
  /* istanbul ignore next — unreachable in test env */
  installCrashHandlersImpl();
};

// ─────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────

export const resolveRgb = (c: string | RGB): RGB =>
  typeof c === 'string' ? hexToRgb(c) : c;

export const safeSteps = (n: number): number => Math.max(1, Math.round(n));
export const safeDuration = (n: number): number => Math.max(0, Math.round(n));

/**
 * Compute a frame interval that's never below FRAME_MS.
 * Caps the requested rate at ~60fps to avoid CPU saturation.
 */
export const frameInterval = (duration: number, steps: number): number =>
  Math.max(FRAME_MS, duration / Math.max(1, steps));

/** Compute total frames for a fixed-duration animation. */
export const totalFrames = (duration: number): number =>
  Math.max(1, Math.ceil(duration / FRAME_MS));

/**
 * Safe writeAsync — never throws. If stdout is gone (broken pipe,
 * stream destroyed mid-animation), we silently swallow and let the
 * animation continue its loop. The next isAborted check or natural
 * end will resolve the promise.
 */
export const safeWriteAsync = async (data: string): Promise<void> => {
  try { await writeAsync(data); }
  catch { /* stdout torn down — best-effort */ }
};

export const safeWrite = (data: string): void => {
  try { write(data); }
  catch { /* stdout torn down — best-effort */ }
};

// ─────────────────────────────────────────────
//  Hook callbacks — errors never propagate
// ─────────────────────────────────────────────

export interface AnimationHooks {
  /** Called after each frame is written. Receives 0-based frame index. */
  onFrame?: (frame: number) => void;
  /** Called when the animation completes naturally. */
  onDone?: () => void;
  /** Called when the signal aborts the animation. */
  onAbort?: () => void;
}

export const fireFrame = (hooks: AnimationHooks | undefined, frame: number): void => {
  try { hooks?.onFrame?.(frame); }
  catch { /* user errors don't break the animation */ }
};

export const fireDone = (hooks: AnimationHooks | undefined, aborted: boolean): void => {
  try {
    if (aborted) hooks?.onAbort?.();
    else         hooks?.onDone?.();
  } catch { /* user errors don't break the animation */ }
};
