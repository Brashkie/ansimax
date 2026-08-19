// ─────────────────────────────────────────────
//  utils/capabilities — terminal capability detection
//
//  v1.6.4 — Phase 8. Synchronous, env-var-based detection of which inline
//  image protocol the terminal supports. This mirrors what mature tools
//  (term-img, supports-color) do: we read environment variables rather
//  than querying the terminal, because a query writes to stdout and reads
//  stdin with a timeout — which corrupts pipes, hangs in CI, and races
//  with the app's own I/O. Env detection is instant, side-effect-free, and
//  safe in every environment.
// ─────────────────────────────────────────────

/**
 * The inline-image protocols ansimax knows how to detect.
 * - `'kitty'`  — Kitty graphics protocol (also used by some Kitty-compatible terms)
 * - `'iterm'`  — iTerm2 inline images (OSC 1337)
 * - `'sixel'`  — DEC SIXEL bitmap graphics
 * - `'none'`   — no inline image support detected
 */
export type ImageProtocol = 'kitty' | 'iterm' | 'sixel' | 'none';

/** Read an env var from the current process, tolerating a missing `env`. */
const readEnv = (key: string): string | undefined => {
  /* istanbul ignore next — process.env is always present in Node */
  return process?.env?.[key];
};

/**
 * Detect the Kitty graphics protocol. Kitty sets `KITTY_WINDOW_ID`, and its
 * `TERM` is typically `xterm-kitty`. Ghostty and WezTerm also implement the
 * protocol and advertise via `TERM`/`TERM_PROGRAM`.
 *
 * @since 1.6.4
 */
export const supportsKittyGraphics = (): boolean => {
  if (readEnv('KITTY_WINDOW_ID') !== undefined) return true;
  const term = (readEnv('TERM') ?? '').toLowerCase();
  if (term.includes('kitty')) return true;
  const termProgram = (readEnv('TERM_PROGRAM') ?? '').toLowerCase();
  return termProgram === 'ghostty' || termProgram === 'wezterm';
};

/**
 * Detect iTerm2 inline images (OSC 1337). iTerm sets
 * `TERM_PROGRAM=iTerm.app`; WezTerm also supports the iTerm protocol.
 *
 * @since 1.6.4
 */
export const supportsITermImages = (): boolean => {
  const termProgram = (readEnv('TERM_PROGRAM') ?? '').toLowerCase();
  if (termProgram === 'iterm.app' || termProgram === 'wezterm') return true;
  // iTerm also exposes its version; presence is a strong signal.
  return readEnv('ITERM_SESSION_ID') !== undefined;
};

/**
 * Detect SIXEL support. There's no single env var, so we match terminals
 * known to enable SIXEL by default via `TERM` (e.g. `mlterm`, `foot`,
 * `contour`, `xterm` built with SIXEL, `yaft`) or `TERM_PROGRAM`.
 *
 * @since 1.6.4
 */
export const supportsSixel = (): boolean => {
  const term = (readEnv('TERM') ?? '').toLowerCase();
  const sixelTerms = ['mlterm', 'foot', 'contour', 'yaft', 'sixel'];
  if (sixelTerms.some((t) => term.includes(t))) return true;
  const termProgram = (readEnv('TERM_PROGRAM') ?? '').toLowerCase();
  return termProgram === 'mintty' || termProgram === 'contour';
};

/**
 * Detect the best available inline-image protocol, in preference order:
 * Kitty → iTerm → SIXEL → none. Kitty and iTerm are richer (true-color,
 * positioning) and preferred when present; SIXEL is the broad fallback.
 *
 * Synchronous and side-effect-free — safe in pipes, CI, and non-TTY.
 *
 * @example
 * ```js
 * import { detectImageProtocol } from 'ansimax';
 *
 * switch (detectImageProtocol()) {
 *   case 'kitty': /* use Kitty graphics *\/ break;
 *   case 'iterm': /* use OSC 1337 *\/ break;
 *   case 'sixel': /* use SIXEL *\/ break;
 *   default:      /* fall back to ASCII art *\/ break;
 * }
 * ```
 *
 * @since 1.6.4
 */
export const detectImageProtocol = (): ImageProtocol => {
  if (supportsKittyGraphics()) return 'kitty';
  if (supportsITermImages()) return 'iterm';
  if (supportsSixel()) return 'sixel';
  return 'none';
};

/** True when any inline-image protocol is detected. @since 1.6.4 */
export const supportsInlineImages = (): boolean =>
  detectImageProtocol() !== 'none';
