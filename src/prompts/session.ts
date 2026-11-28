/**
 * ansimax/prompts/session — the interactive core every prompt sits on.
 *
 * Phase 11 is eight prompts, and each one needs the same hundred and fifty
 * lines around it: a TTY check, raw mode on and reliably off again, a key
 * listener, a render that knows how many terminal lines it actually wrote so
 * it can erase exactly that many, a cursor that comes back even if the
 * process is killed mid-prompt, and Ctrl+C that resolves rather than exits.
 * Written once per prompt that would be eight chances to leave a terminal in
 * raw mode with no cursor.
 *
 * Two contracts carried over from `components.menu`, because a caller should
 * not have to learn a second set of rules:
 *
 * - **The library never calls `process.exit()`.** Ctrl+C resolves with
 *   {@link PROMPT_CANCELLED}, and the caller decides what that means.
 * - **I/O is injectable.** The defaults are `process.stdin` and
 *   `process.stdout`, but every prompt takes `input` and `output`, which is
 *   what makes them testable with a fake stream and usable over a socket.
 *
 * Key decoding goes through `src/input`: `parseKeys` already turns a stdin
 * chunk into `KeyEvent`s, including the astral-safe splitting and the xterm
 * modifier encodings. A prompt that compared raw escape strings would
 * reimplement that badly.
 *
 * @module
 * @since 1.10.0
 */

import { cursor, screen } from '../utils/ansi.js';
import { termSize, visibleLen } from '../utils/helpers.js';
import { parseKeys } from '../input/index.js';
import type { KeyEvent } from '../input/index.js';

/**
 * What a prompt resolves with when the user presses Ctrl+C.
 *
 * A distinct symbol rather than `null` or `undefined`, so a cancelled prompt
 * is never mistaken for an empty answer — the difference matters for a
 * password field or an optional note.
 */
export const PROMPT_CANCELLED = Symbol('ANSIMAX_PROMPT_CANCELLED');

/**
 * What a prompt resolves with when the user asks to go back a field.
 *
 * Only reachable when the prompt was given `back: true`, which is what the
 * form and wizard composers do — stepping back is a *form* idea, and a
 * standalone prompt has nowhere to step back to. Shift+Tab is the key, left
 * alone by every prompt here so the session can claim it.
 */
export const PROMPT_BACK = Symbol('ANSIMAX_PROMPT_BACK');

/** The stdin-shaped object a prompt reads from. */
export interface PromptInput {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
  resume?: () => unknown;
  pause?: () => unknown;
  setEncoding?: (encoding: string) => unknown;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

/** The stdout-shaped object a prompt writes to. */
export interface PromptOutput {
  write: (str: string) => unknown;
}

/** Options every prompt accepts. */
export interface PromptBaseOptions {
  /** Where to read keys from. Default `process.stdin`. */
  input?: PromptInput;
  /** Where to draw. Default `process.stdout`. */
  output?: PromptOutput;
  /**
   * Keep the rendered prompt on screen after it resolves, instead of erasing
   * it. Default `false` — a prompt that leaves its own scaffolding behind
   * makes a script's output unreadable. The caller prints its own summary.
   */
  keep?: boolean;
  /**
   * Let Shift+Tab resolve {@link PROMPT_BACK} instead of being ignored.
   * Default `false`. The form and wizard composers set it; on its own a
   * prompt has nothing to go back to.
   */
  back?: boolean;
}

/** What {@link runSession} needs to drive one prompt. */
export interface SessionSpec<T> {
  input?: PromptInput;
  output?: PromptOutput;
  keep?: boolean;
  /** Let Shift+Tab resolve {@link PROMPT_BACK}. */
  back?: boolean;
  /** Draw the current state. Returns the lines to print, without trailing newlines. */
  render: () => string[];
  /**
   * Handle one key. Return `{ done: true, value }` to resolve, or
   * `{ done: false }` to re-render and keep going. Returning `undefined` is
   * the same as `{ done: false }`, for keys the prompt ignores.
   */
  onKey: (key: KeyEvent) => { done: true; value: T } | { done: false } | undefined;
  /**
   * What to resolve with when there is no TTY to interact with — a pipe, a CI
   * job, a `child_process` without a terminal. Prompts resolve their default
   * rather than hanging forever on input that will never arrive.
   */
  nonTTY: () => T;
  /** Show the terminal cursor while the prompt runs. Default `false`. */
  showCursor?: boolean;
}

/**
 * Drive one prompt to completion.
 *
 * Owns the whole lifecycle: raw mode, the key listener, redraw-on-change, and
 * a teardown that runs exactly once however the prompt ends — resolved,
 * cancelled, or killed by a signal.
 *
 * @since 1.10.0
 */
export const runSession = <T>(
  spec: SessionSpec<T>,
): Promise<T | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const inp = spec.input ?? (process.stdin as unknown as PromptInput);
  const out = spec.output ?? { write: (s: string) => process.stdout.write(s) };

  // No terminal, no interaction. Resolving the default beats waiting for a
  // keypress that cannot come.
  if (!inp.isTTY) {
    try {
      return Promise.resolve(spec.nonTTY());
    } catch {
      return Promise.resolve(PROMPT_CANCELLED);
    }
  }

  const emit = (str: string): void => {
    try {
      out.write(str);
    } catch {
      /* stream closed mid-render — nothing useful left to do */
    }
  };

  let renderedLines = 0;
  let cursorHidden = false;

  /** Draw, counting the lines the terminal will actually use after wrapping. */
  const draw = (): void => {
    const lines = spec.render();
    const { cols } = termSize();
    const width = Math.max(1, cols);
    let count = 0;
    for (const line of lines) {
      emit(`${line}\n`);
      // A line longer than the terminal occupies several rows, and erasing
      // one row per line would leave the overflow on screen.
      count += Math.max(1, Math.ceil(visibleLen(line) / width));
    }
    renderedLines = count;
  };

  const erase = (): void => {
    for (let i = 0; i < renderedLines; i++) emit(cursor.up(1) + screen.clearLine());
    emit('\r');
    renderedLines = 0;
  };

  const redraw = (): void => {
    erase();
    draw();
  };

  /* istanbul ignore next — defensive: only fires on SIGINT/SIGTERM/exit */
  const emergency = (): void => {
    if (cursorHidden) {
      try {
        out.write(cursor.show());
      } catch {
        /* ignore */
      }
      cursorHidden = false;
    }
    try {
      inp.setRawMode?.(false);
    } catch {
      /* ignore */
    }
  };

  /* istanbul ignore next — defensive: process handlers do not fire in tests */
  const watchSignals = (): void => {
    try {
      process.once('SIGINT', emergency);
      process.once('SIGTERM', emergency);
      process.once('exit', emergency);
    } catch {
      /* ignore */
    }
  };

  /* istanbul ignore next — defensive */
  const unwatchSignals = (): void => {
    try {
      process.off('SIGINT', emergency);
      process.off('SIGTERM', emergency);
      process.off('exit', emergency);
    } catch {
      /* ignore */
    }
  };

  watchSignals();

  try {
    if (!spec.showCursor) {
      emit(cursor.hide());
      cursorHidden = true;
    }
    draw();
  } catch {
    // A render() that throws must not leave a hidden cursor behind: this is
    // the one path where the prompt never reaches its key loop.
    if (cursorHidden) emit(cursor.show());
    unwatchSignals();
    return Promise.resolve(PROMPT_CANCELLED);
  }

  return new Promise<T | typeof PROMPT_CANCELLED | typeof PROMPT_BACK>((resolve) => {
    let settled = false;
    let listener: ((...args: unknown[]) => void) | null = null;

    const teardown = (): void => {
      if (listener) {
        try {
          inp.removeListener('data', listener);
        } catch {
          /* ignore */
        }
        listener = null;
      }
      try {
        inp.setRawMode?.(false);
      } catch {
        /* ignore */
      }
      if (cursorHidden) {
        emit(cursor.show());
        cursorHidden = false;
      }
      unwatchSignals();
    };

    const settle = (value: T | typeof PROMPT_CANCELLED | typeof PROMPT_BACK): void => {
      /* istanbul ignore if — defensive: double-settle guard */
      if (settled) return;
      settled = true;
      if (spec.keep) {
        // Leave the last frame, but put the caret below it so the next write
        // does not land on top of the prompt.
        emit('');
      } else {
        erase();
      }
      teardown();
      resolve(value);
    };

    listener = (...args: unknown[]): void => {
      try {
        const chunk = String(args[0] ?? '');
        for (const key of parseKeys(chunk)) {
          /* istanbul ignore if — unreachable: every settle() below is followed
             by a return, so the loop cannot come round again once the prompt
             has resolved. The guard stands in case one of them ever loses its
             return, which would otherwise feed keys to a dead prompt. */
          if (settled) return;
          // Ctrl+C is the one key the prompt does not get a say in.
          if (key.ctrl && key.name === 'c') {
            settle(PROMPT_CANCELLED);
            return;
          }
          // Shift+Tab is the composer's back key, handled here so no prompt
          // has to know about it.
          if (spec.back && key.name === 'tab' && key.shift) {
            settle(PROMPT_BACK);
            return;
          }
          const result = spec.onKey(key);
          if (result?.done) {
            settle(result.value);
            return;
          }
          redraw();
        }
      } catch {
        settle(PROMPT_CANCELLED);
      }
    };

    try {
      inp.setRawMode?.(true);
      inp.resume?.();
      inp.setEncoding?.('utf8');
      inp.on('data', listener);
    } catch {
      // A stdin that refuses raw mode cannot drive a prompt at all, so undo
      // whatever was already set up rather than waiting for a key forever.
      teardown();
      resolve(PROMPT_CANCELLED);
    }
  });
};

/**
 * Was a prompt cancelled?
 *
 * `result === PROMPT_CANCELLED` works too; this exists so a caller can narrow
 * the type without importing the symbol.
 *
 * @example
 * ```js
 * import { textPrompt, wasCancelled } from 'ansimax';
 *
 * const name = await textPrompt({ message: 'Name' });
 * if (wasCancelled(name)) return;
 * name.toUpperCase();   // narrowed to string
 * ```
 *
 * @since 1.10.0
 */
export const wasCancelled = <T>(
  result: T | typeof PROMPT_CANCELLED,
): result is typeof PROMPT_CANCELLED => result === PROMPT_CANCELLED;

/**
 * Did the user ask to go back a field?
 *
 * Only possible when the prompt was given `back: true`.
 *
 * @since 1.10.0
 */
export const wasBack = <T>(result: T | typeof PROMPT_BACK): result is typeof PROMPT_BACK =>
  result === PROMPT_BACK;
