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

// ─────────────────────────────────────────────
//  Terminal capability database — Phase 8 (v1.8.1)
//
//  One consolidated, synchronous snapshot of what the current terminal can do.
//  It folds the individual probes above (image protocol, cell aspect ratio)
//  together with the env-var signals ansimax already uses elsewhere (NO_COLOR/
//  FORCE_COLOR, CI providers, terminal program, Windows Terminal, TTY), so a
//  caller can branch on one object instead of calling six functions. Env-only
//  and side-effect-free — no terminal queries, safe in pipes and CI.
// ─────────────────────────────────────────────

/** Rough color depth a terminal advertises through its environment. */
export type ColorDepth = 'none' | 'basic' | '256' | 'truecolor';

/** A consolidated snapshot of terminal capabilities. @since 1.8.1 */
export interface TerminalCapabilities {
  /** stdout is an interactive TTY (not a pipe/file/CI log). */
  isTTY: boolean;
  /** Running under a detected CI provider. */
  isCI: boolean;
  /** The CI provider name when known (`'github'`, `'gitlab'`, …), else `null`. */
  ciProvider: string | null;
  /** Color depth inferred from the environment. */
  colorDepth: ColorDepth;
  /** Color is forced on via `FORCE_COLOR` (and not disabled by `NO_COLOR`). */
  forceColor: boolean;
  /** Color is disabled via `NO_COLOR`. */
  noColor: boolean;
  /** The `TERM_PROGRAM` value lower-cased (`'iterm.app'`, `'vscode'`, …) or `null`. */
  program: string | null;
  /** Running inside Windows Terminal (`WT_SESSION`). */
  isWindowsTerminal: boolean;
  /** Best inline-image protocol the terminal advertises (detection only). */
  imageProtocol: ImageProtocol;
  /** Cell aspect ratio `cell_width / cell_height` (see {@link cellAspectRatio}). */
  cellAspect: number;
}

// Env var → CI provider name. Checked in order; first hit wins.
const CI_PROVIDERS: ReadonlyArray<readonly [string, string]> = [
  ['GITHUB_ACTIONS', 'github'],
  ['GITLAB_CI', 'gitlab'],
  ['CIRCLECI', 'circle'],
  ['BUILDKITE', 'buildkite'],
  ['DRONE', 'drone'],
  ['TRAVIS', 'travis'],
  ['APPVEYOR', 'appveyor'],
  ['TEAMCITY_VERSION', 'teamcity'],
];

const detectCiProvider = (): string | null => {
  for (const [key, name] of CI_PROVIDERS) {
    if (readEnv(key) !== undefined) return name;
  }
  // Generic CI flag (set by most providers) with no specific match.
  return readEnv('CI') !== undefined ? 'unknown' : null;
};

const detectColorDepth = (noColor: boolean, forceColor: boolean): ColorDepth => {
  if (noColor) return 'none';
  const term = (readEnv('TERM') ?? '').toLowerCase();
  const colorTerm = (readEnv('COLORTERM') ?? '').toLowerCase();
  const program = (readEnv('TERM_PROGRAM') ?? '').toLowerCase();
  if (colorTerm === 'truecolor' || colorTerm === '24bit') return 'truecolor';
  if (program === 'iterm.app' || program === 'vscode' || program === 'wezterm'
      || program === 'hyper' || program === 'ghostty') return 'truecolor';
  if (readEnv('WT_SESSION') !== undefined) return 'truecolor';
  if (term.includes('truecolor') || term.includes('24bit')) return 'truecolor';
  if (term.includes('256')) return '256';
  if (term === 'dumb') return forceColor ? 'basic' : 'none';
  if (term === '' && !forceColor) return 'none';
  return 'basic';
};

/**
 * Take a single consolidated snapshot of the terminal's capabilities — the
 * Phase 8 "capability database". Reads only environment variables and the
 * existing probes, so it is synchronous and safe everywhere (pipes, CI,
 * non-TTY); nothing is written to the terminal.
 *
 * @example
 * ```js
 * import { detectCapabilities } from 'ansimax';
 *
 * const caps = detectCapabilities();
 * if (caps.colorDepth === 'truecolor') useRichGradient();
 * if (!caps.isTTY) usePlainOutput();
 * ```
 *
 * @since 1.8.1
 */
export const detectCapabilities = (): TerminalCapabilities => {
  const noColor = readEnv('NO_COLOR') !== undefined;
  const forceColor = !noColor && readEnv('FORCE_COLOR') !== undefined;
  const ciProvider = detectCiProvider();
  const program = readEnv('TERM_PROGRAM');
  // stdout.isTTY is undefined when not a TTY (pipe/file/CI).
  /* istanbul ignore next — process.stdout is always present in Node */
  const isTTY = process?.stdout?.isTTY === true;

  return {
    isTTY,
    isCI: ciProvider !== null,
    ciProvider,
    colorDepth: detectColorDepth(noColor, forceColor),
    forceColor,
    noColor,
    program: program ? program.toLowerCase() : null,
    isWindowsTerminal: readEnv('WT_SESSION') !== undefined,
    imageProtocol: detectImageProtocol(),
    cellAspect: cellAspectRatio(),
  };
};
