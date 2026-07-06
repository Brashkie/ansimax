// ─────────────────────────────────────────────
//  ANSIMAX  v1.1.2
//  The ultimate CLI rendering library for Node.js
//
//  Re-exports the public API of every module:
//    - Named exports for individual functions/classes/types
//    - Default export `ansimax` aggregating module namespaces
//
//  All types are re-exported with their canonical names. Some legacy
//  aliases (e.g. `stripAnsiColors`, `stripAnsiCodes`) point to the same
//  underlying `stripAnsi` function and are kept for backwards-compat;
//  prefer `stripAnsi` (imported from `'ansimax'`) in new code.
// ─────────────────────────────────────────────

// ── Core modules ──
export {
  color, gradient, rainbow, presets as colorPresets, presetNames,
  // v1.2.4 — also expose as `presets` (canonical, matches the docs)
  presets,
  compose, chain, colorLevel,
  setNoColor, isNoColor, resetNoColor,
  registerPreset, listPresets, clearColorCache,
  stripAnsi as stripAnsiColors,
  // v1.2.0 — Phase 2 completion
  animateGradient,
  // v1.2.3 — gradient factory
  createGradient,
  // v1.2.4 — gradient utilities
  reverseGradient,
} from './colors/index.js';
export type {
  ColorFn, PresetName, ColorChain, GradientOptions,
  // v1.2.0 — Phase 2 completion
  EasingName, EasingFn, AnimateGradientOptions, AnimateGradientController,
  // v1.2.4 — gradient utilities
  ReusableGradient,
} from './colors/index.js';

export { animate, canAnimate, resetCursorRefCount } from './animations/index.js';
export type {
  TypewriterOptions, FadeOptions, SlideOptions,
  PulseOptions, WaveOptions, GlitchOptions, RevealOptions,
  ParallelStep, ParallelOptions, AnimationHooks,
} from './animations/index.js';

export {
  ascii, registerFont, listFonts, hasFont, clearRenderCache, getRenderCacheSize,
  // v1.2.5 — Phase 3 closure
  fromImage, figletText, parseFiglet, ASCII_RAMPS,
} from './ascii/index.js';
export type {
  BoxStyle, BoxOptions, BannerOptions, DividerOptions, LogoOptions,
  Glyph, FontMap, FontName, RegisterFontOptions, StreamOptions, Dimensions,
  // v1.2.5 — Phase 3 closure
  AsciiRamp, FromImageOptions, FigletFont, FigletOptions,
} from './ascii/index.js';

export { loader, resetLoaderCursorCount } from './loaders/index.js';
export type {
  SpinnerType, SpinOptions, ProgressOptions, ProgressAnimateOptions,
  Task, TaskResult, TasksOptions,
  DotsOptions, CustomOptions, CountdownOptions,
  MultiLoader, MultiLoaderItem,
  StopFn,
} from './loaders/index.js';
export { SPINNERS } from './loaders/index.js';

export { frames, resetFramesCursorCount } from './frames/index.js';
export type {
  PlayOptions, PlayController, LiveOptions, LiveController, FrameCallback,
  LoadingBarOptions, BallOptions, BreatheOptions, TypeDeleteOptions,
} from './frames/index.js';

export { components, box, MENU_CANCELLED } from './components/index.js';
export type {
  TableOptions, TableBorderStyle,
  BadgeOptions, ProgressBarOptions,
  StatusType, StatusOptions,
  SectionOptions, ColumnsOptions,
  TimelineEvent, TimelineOptions,
  MenuOptions, MenuResult, MenuInput, MenuOutput,
} from './components/index.js';

export {
  trees, tree, renderTree, renderTreeStream, measureTree, walkTree,
  findInTree, countNodes, mapTree, filterTree,
} from './trees/index.js';
export type {
  TreeStyle, TreeData, TreeNode, RenderOptions as TreeRenderOptions,
  TreeDimensions, WalkVisitor,
} from './trees/index.js';

export { themes, createTheme, clearThemeColorCache } from './themes/index.js';
export type { Theme, ThemeInstance, ThemeStyleName, ThemeChangeListener, BannerOpts as ThemeBannerOpts } from './themes/index.js';

export { images, createCanvas, renderPixelArt, gradientRect, SPRITES, clearAnsiCache, flipHorizontal, flipVertical, rotate90 } from './images/index.js';
export type { Canvas, CanvasRenderOptions, RenderOptions, GradientRectOptions, RGBA, Pixel, PixelGrid } from './images/index.js';

// v1.3.0 — Phase 4 progress: Panels (split layouts) + JSON pretty-print
// v1.3.1 — panels.center + panels.frame, json sortKeys + inline arrays
// v1.3.3 — panels.grid + ascii.box title/titleAlign + ascii.divider align
// v1.4.4 — panels.gridAreas + AreaRect
export { panels, vsplit, hsplit, center as centerBlock, frame, grid, gridAreas } from './panels/index.js';
export type { Alignment, VsplitOptions, HsplitOptions, CenterOptions, FrameOptions, GridOptions, GridAreasOptions, AreaRect } from './panels/index.js';

export { json, pretty as jsonPretty } from './json/index.js';
export type { PrettyOptions as JsonPrettyOptions } from './json/index.js';

// v1.4.0 — Phase 4 closure: Markdown rendering
export { markdown, render as renderMarkdown, parseBlocks as parseMarkdownBlocks, parseInline as parseMarkdownInline } from './markdown/index.js';
export type { MarkdownOptions, MarkdownTheme, ListItem } from './markdown/index.js';
// v1.4.5 — syntax highlighting
export { highlight as highlightCode, tokenize as tokenizeCode, isHighlightSupported } from './markdown/index.js';
export type { TokenKind, Token } from './markdown/index.js';

export {
  configure, getConfig, getSpeedMultiplier, resetConfig,
  onConfigChange, onConfigKeyChange, getConfigValue,
  pauseListeners, resumeListeners, withConfig,
  DEFAULTS as CONFIG_DEFAULTS,
  // v1.3.4 — DX shortcuts
  setConfigValue, subscribeConfig,
} from './configure.js';
export type {
  AnsimaxConfig, ColorMode, AnimationSpeed, ConfigChangeListener,
  ConfigKey, ConfigKeyListener, ConfigureOptions,
} from './configure.js';

// ── Utils (public) ──
export {
  sleep, sleepFrame, FRAME_MS,
  write, writeAsync, writeln, writeErr, writelnErr,
  cursor, screen, hideCursor, showCursor,
  getTerminalWidth, getTerminalHeight,
  DEFAULT_TERM_COLS, DEFAULT_TERM_ROWS,
  supportsColor, supportsColorLevel, resetColorSupportCache,
  stripAnsi as stripAnsiCodes,
  fgRgb, bgRgb, fg256, bg256, sgr, reset,
  ESC, CSI, OSC, ST, BEL, FG, BG, STYLE,
  createOutputBuffer,
  // OSC primitives
  setTitle, link, bell,
  // v1.3.4
  hyperlink, clearLine,
} from './utils/ansi.js';
export type {
  ColorSupport, ColorLevel, AnsiCode, EraseMode, SleepOptions,
  OutputBuffer, WriteAsyncOptions,
} from './utils/ansi.js';
export {
  termSize, hexToRgb, rgbToHex, stripAnsi, visibleLen, clamp, lerpColor,
  isHexColor, truncateAnsi, repeatVisible, padEnd, padStart, padBoth, center, wordWrap, lerp, rgbTo256,
  // Unicode-aware width
  charWidth, graphemes,
  // ANSI-safe slicing + wrapping
  sliceAnsi, wrapAnsi,
  // Multi-stop gradient
  gradientColor,
  // Resize listener
  onResize,
  // Frame-rate helpers
  debounce, throttle,
  requestTerminalFrame, cancelTerminalFrame, nextTick,
  // Memoization
  memoize,
  // Frame diffing
  diffLines,
  // New utilities
  once, escapeRegex, safeJson,
  // v1.3.4
  gradientStops, escapeForRegex, measureBlock,
  // v1.3.5 — color science + numeric helpers
  isFiniteNumber, safeInt, clampByte,
  rgbToHsl, hslToRgb, rgbToOklab, oklabToRgb,
  mixColors, quantizeColor,
  // v1.3.7 — consolidated clamp helpers
  clampPercent, clampInt,
  // v1.4.2 — further consolidation
  ensureString, clampNonNeg, clampPositiveInt,
} from './utils/helpers.js';
// v1.4.6 — pure math toolkit (lerp already exported above from helpers)
export {
  inverseLerp, remap, clamp as clampRange, clamp01,
  smoothstep, smootherstep, roundTo, mod, wrap as wrapRange,
  gcd, lcm, sum, mean, distribute,
} from './utils/math.js';
export type {
  RGB, ResizeListener, OnResizeOptions, FrameHandle,
  LineDiff, DiffType, DebounceOptions, MemoizeOptions,
  // v1.3.5
  HSL, Oklab, ColorSpace,
} from './utils/helpers.js';

// v1.3.5 — Easing curves (Robert Penner library)
export { easings, resolveEasingByName } from './utils/easing.js';
export type { EasingFunction, EasingLibraryName } from './utils/easing.js';

// ── Default export: full API object ──
import { color }      from './colors/index.js';
import { animate }    from './animations/index.js';
import { ascii }      from './ascii/index.js';
import { loader }     from './loaders/index.js';
import { frames }     from './frames/index.js';
import { components } from './components/index.js';
import { trees }      from './trees/index.js';
import { themes }     from './themes/index.js';
import { images }     from './images/index.js';
import { configure }  from './configure.js';
import { panels as panelsNs }       from './panels/index.js';
import { json as jsonNs }           from './json/index.js';
import { markdown as markdownNs }   from './markdown/index.js';

const ansimax = {
  color, animate, ascii, loader, frames, components, trees, themes, images, configure,
  // v1.3.0+
  panels: panelsNs,
  json: jsonNs,
  // v1.4.0
  markdown: markdownNs,
};
export default ansimax;
