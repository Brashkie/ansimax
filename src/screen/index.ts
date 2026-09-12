// ─────────────────────────────────────────────
//  ansimax/screen — managed alternate screen (Phase 5)
//
//  v1.7.0 — a full-screen session, like vim/htop/less. enter() switches to
//  the terminal's alternate buffer (DECSET 1049) so the user's scrollback is
//  untouched, hides the cursor, and clears; exit() restores everything —
//  cursor, main buffer, contents — exactly as it was. Restoration is
//  guaranteed even on crash: exit/SIGINT/SIGTERM handlers run the same
//  teardown, so a full-screen app can never leave the terminal wedged.
//
//  Pure ANSI, synchronous, zero deps. The building block for TUI apps.
// ─────────────────────────────────────────────

import { CSI, write as ansiWrite } from '../utils/ansi.js';

// DECSET 1049: save cursor + switch to alternate screen buffer (and the
// inverse on reset). This is the sequence vim/less/htop use; it preserves
// the user's scrollback because the alt buffer is a separate screen.
const ENTER_ALT = `${CSI}?1049h`;
const EXIT_ALT = `${CSI}?1049l`;
const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;
const CLEAR_HOME = `${CSI}2J${CSI}H`;
const CURSOR_HOME = `${CSI}H`;

export interface ScreenOptions {
  /** Hide the cursor while the screen is active. Default `true`. */
  hideCursor?: boolean;
  /** Clear the alternate buffer on enter. Default `true`. */
  clearOnEnter?: boolean;
  /**
   * Output sink. Defaults to stdout. Injectable for testing so the escape
   * sequences can be captured instead of written to a real terminal.
   */
  out?: (s: string) => void;
  /**
   * Install process exit/signal handlers that restore the terminal if the
   * program dies while the screen is active. Default `true`. Disable in test
   * environments that dislike lingering listeners.
   */
  installSignalHandlers?: boolean;
}

export interface Screen {
  /** Enter the alternate screen (save state, switch buffer, hide cursor, clear). */
  enter(): void;
  /** Restore the terminal to exactly its pre-enter state. Idempotent. */
  exit(): void;
  /** Clear the alternate buffer and move the cursor home. */
  clear(): void;
  /** Write a string to the screen (no implicit newline). */
  write(s: string): void;
  /** Move the cursor to 1-based (row, col). */
  moveTo(row: number, col: number): void;
  /** True while the screen is active (entered and not yet exited). */
  isActive(): boolean;
  /**
   * Run `fn` inside an active screen and guarantee `exit()` afterward, even
   * if `fn` throws or rejects. Returns `fn`'s result.
   */
  run<T>(fn: (screen: Screen) => T | Promise<T>): Promise<T>;
}

/**
 * Create a managed alternate-screen session. Call `enter()` to go full-screen
 * and `exit()` to restore; or use `run(fn)` to scope a full-screen block with
 * guaranteed teardown. The user's scrollback and cursor are always restored,
 * including on crash (exit/SIGINT/SIGTERM).
 *
 * @example
 * ```js
 * import { createScreen } from 'ansimax';
 *
 * const screen = createScreen();
 * await screen.run((s) => {
 *   s.moveTo(1, 1);
 *   s.write('Full-screen app — press Ctrl-C to exit');
 *   // ...draw loop...
 * }); // terminal restored no matter how the block ends
 * ```
 *
 * @since 1.7.0
 */
export const createScreen = (opts: ScreenOptions = {}): Screen => {
  const out = opts.out ?? ((s: string) => { ansiWrite(s); });
  const doHideCursor = opts.hideCursor !== false;
  const doClear = opts.clearOnEnter !== false;
  const installHandlers = opts.installSignalHandlers !== false;

  let active = false;
  let handlersInstalled = false;

  const teardown = (): void => {
    if (!active) return;
    if (doHideCursor) out(SHOW_CURSOR);
    out(EXIT_ALT);
    active = false;
  };

  /* istanbul ignore next — signal/exit wiring only fires on real process teardown */
  const installProcessHandlers = (): void => {
    if (handlersInstalled || !installHandlers) return;
    if (!process || typeof process.on !== 'function') return;
    handlersInstalled = true;
    // Handlers no-op once the screen has exited (active === false), so we
    // don't need to remove them — teardown() is idempotent and guarded.
    process.on('exit', () => { teardown(); });
    process.on('SIGINT', () => { teardown(); process.exit(130); });
    process.on('SIGTERM', () => { teardown(); process.exit(143); });
  };

  const api: Screen = {
    enter(): void {
      if (active) return;
      active = true;
      out(ENTER_ALT);
      if (doHideCursor) out(HIDE_CURSOR);
      if (doClear) out(CLEAR_HOME);
      installProcessHandlers();
    },
    exit(): void {
      teardown();
    },
    clear(): void {
      if (active) out(CLEAR_HOME);
    },
    write(s: string): void {
      if (active) out(s);
    },
    moveTo(row: number, col: number): void {
      const r = Math.max(1, Math.floor(row));
      const c = Math.max(1, Math.floor(col));
      if (active) out(`${CSI}${r};${c}H`);
    },
    isActive(): boolean {
      return active;
    },
    async run<T>(fn: (screen: Screen) => T | Promise<T>): Promise<T> {
      api.enter();
      try {
        return await fn(api);
      } finally {
        api.exit();
      }
    },
  };

  return api;
};

/** Raw escape sequences, exposed for advanced callers. @since 1.7.0 */
export const SCREEN_SEQUENCES = {
  enterAlt: ENTER_ALT,
  exitAlt: EXIT_ALT,
  hideCursor: HIDE_CURSOR,
  showCursor: SHOW_CURSOR,
  clearHome: CLEAR_HOME,
  cursorHome: CURSOR_HOME,
} as const;
