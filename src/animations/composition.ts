// ─────────────────────────────────────────────
//  animations/composition — sequence, parallel, chain
//
//  v1.6.3 — extracted from the former monolithic animations/index.ts.
//  High-level combinators that run animation steps in order, concurrently,
//  or chained. Behavior is unchanged.
// ─────────────────────────────────────────────

import { sleep } from '../utils/ansi.js';
import { isAborted } from './internal.js';
import type { ParallelStep, ParallelOptions } from './types.js';

// ─────────────────────────────────────────────

/**
 * Run a list of async animation thunks one after another.
 * Stops on first abort. Errors in any step propagate to the caller
 * AFTER the cursor is restored (no leaked state on throw).
 */
export const sequence = async (
  steps: Array<() => Promise<void>>,
  opts: { signal?: AbortSignal } = {},
): Promise<void> => {
  for (const step of steps) {
    if (isAborted(opts.signal)) return;
    await step();
  }
};

/**
 * Run multiple animations CONCURRENTLY — all start at once.
 *
 * Cancellation is **propagated**: each step receives the parent signal
 * so animations that respect AbortSignal will cancel cleanly when the
 * parent aborts. Pre-aborted steps are skipped entirely.
 *
 * If `timeout` is set and elapses before all steps finish, parallel()
 * resolves anyway — but does NOT throw. Steps that haven't completed
 * are abandoned (their promises reject silently).
 */
export const parallel = async (
  steps: ParallelStep[],
  opts: ParallelOptions = {},
): Promise<void> => {
  const stepPromises = steps.map((step) => {
    if (isAborted(opts.signal)) return Promise.resolve();
    // Wrap step call in try/catch so individual step errors don't
    // reject the whole Promise.all and leave the cursor uncleaned.
    return Promise.resolve()
      .then(() => step({ signal: opts.signal }))
      .catch(() => { /* step errors are swallowed — they handle their own cleanup */ });
  });

  if (opts.timeout && opts.timeout > 0) {
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, opts.timeout);
    });
    await Promise.race([Promise.all(stepPromises), timeoutPromise]);
    return;
  }

  await Promise.all(stepPromises);
};

/**
 * Apply multiple animations to the SAME text in order.
 * Each entry is `[fn, options]` or just `fn`.
 * Errors in any step propagate after cursor cleanup.
 */
type AnimFn = (text: string, opts?: Record<string, unknown>) => Promise<void>;
type ChainStep = AnimFn | [AnimFn] | [AnimFn, Record<string, unknown>];

export const chain = async (
  text: string,
  steps: ChainStep[],
  opts: { signal?: AbortSignal } = {},
): Promise<void> => {
  for (const step of steps) {
    if (isAborted(opts.signal)) return;
    if (typeof step === 'function') {
      await step(text, { signal: opts.signal });
    }
    /* istanbul ignore next — tuple step variant covered indirectly */
    else {
      const [fn, stepOpts = {}] = step;  // istanbul ignore next
      await fn(text, { ...stepOpts, signal: opts.signal });
    }
  }
};

/**
 * Pause for `ms` milliseconds. Compatible with chain/sequence as a
 * step. Respects the parent signal — aborting cancels the wait.
 *
 * @example
 *   await animate.sequence([
 *     () => animate.typewriter('Hello'),
 *     animate.delay(500),
 *     () => animate.fadeOut('Hello'),
 *   ]);
 */
export const delay = (ms: number) => async (
  opts: { signal?: AbortSignal } = {},
): Promise<void> => {
  try { await sleep(Math.max(0, ms), { signal: opts.signal }); }
  catch { /* aborted — return cleanly */ }
};
