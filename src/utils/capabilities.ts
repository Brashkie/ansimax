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

// ─────────────────────────────────────────────
//  Font cell aspect ratio — Phase 8 (v1.7.1)
//
//  Terminal cells are taller than they are wide: a monospace glyph is
//  typically ~2× as tall as it is wide, so R = cell_width / cell_height ≈ 0.5.
//  Sub-pixel canvases (Braille line charts, pixel art, circle rasterizers)
//  must account for this or circles come out as ellipses and slopes look
//  wrong. True cell metrics require a terminal query (CSI 16 t) — which is
//  async, races stdin, and is unsupported on many terminals — so we expose R
//  as a plain, overridable value and default to the near-universal 0.5.
// ─────────────────────────────────────────────

/** Options for {@link cellAspectRatio}. @since 1.7.1 */
export interface CellAspectOptions {
  /**
   * An explicit width/height ratio to use, bypassing detection. Any finite
   * value `> 0` wins; anything else is ignored and detection proceeds.
   */
  ratio?: number;
  /**
   * Terminal cell width in pixels, if known (e.g. from a CSI 16 t reply the
   * caller performed). Paired with {@link CellAspectOptions.cellHeight} to
   * compute an exact ratio.
   */
  cellWidth?: number;
  /** Terminal cell height in pixels, if known. @see CellAspectOptions.cellWidth */
  cellHeight?: number;
}

/** The fallback cell aspect ratio when nothing better is known. @since 1.7.1 */
export const DEFAULT_CELL_ASPECT = 0.5;

/**
 * Resolve the terminal cell aspect ratio `R = cell_width / cell_height`.
 *
 * Resolution order: an explicit `ratio` → measured `cellWidth/cellHeight` →
 * the `ANSIMAX_CELL_ASPECT` env override → {@link DEFAULT_CELL_ASPECT} (0.5).
 * The result is always a finite number in `(0, 1]`-ish territory; pathological
 * inputs fall back rather than throw.
 *
 * @example
 * ```js
 * import { cellAspectRatio, aspectScale } from 'ansimax';
 *
 * const r = cellAspectRatio();          // ≈ 0.5 on most terminals
 * const { sy } = aspectScale(r);        // multiply raster-y by sy (≈ 2)
 * ```
 *
 * @since 1.7.1
 */
export const cellAspectRatio = (opts: CellAspectOptions = {}): number => {
  if (Number.isFinite(opts.ratio) && (opts.ratio as number) > 0) {
    return opts.ratio as number;
  }
  const w = opts.cellWidth;
  const h = opts.cellHeight;
  if (
    Number.isFinite(w) && Number.isFinite(h) &&
    (w as number) > 0 && (h as number) > 0
  ) {
    return (w as number) / (h as number);
  }
  const env = Number.parseFloat(readEnv('ANSIMAX_CELL_ASPECT') ?? '');
  if (Number.isFinite(env) && env > 0) return env;
  return DEFAULT_CELL_ASPECT;
};

/** A pair of axis scale factors from {@link aspectScale}. @since 1.7.1 */
export interface AspectScale {
  /** Horizontal scale factor. Always `1` — x is the reference axis. */
  sx: number;
  /** Vertical scale factor: `1 / ratio` (≈ 2), stretching y to match x. */
  sy: number;
}

/**
 * Build the axis scale matrix `S(1, 1/R)` that maps square logical units onto
 * the terminal's non-square cells. Premultiply raster y by `sy` before
 * plotting so a logical circle renders round instead of squashed.
 *
 * A non-positive or non-finite `ratio` falls back to {@link DEFAULT_CELL_ASPECT}.
 *
 * @since 1.7.1
 */
export const aspectScale = (ratio: number = cellAspectRatio()): AspectScale => {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_CELL_ASPECT;
  return { sx: 1, sy: 1 / r };
};
