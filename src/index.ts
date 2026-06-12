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
export { panels, vsplit, hsplit } from './panels/index.js';
export type { Alignment, VsplitOptions, HsplitOptions } from './panels/index.js';

export { json, pretty as jsonPretty } from './json/index.js';
export type { PrettyOptions as JsonPrettyOptions } from './json/index.js';

export {
  configure, getConfig, getSpeedMultiplier, resetConfig,
  onConfigChange, onConfigKeyChange, getConfigValue,
  pauseListeners, resumeListeners, withConfig,
  DEFAULTS as CONFIG_DEFAULTS,
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
} from './utils/helpers.js';export type {
  RGB, ResizeListener, OnResizeOptions, FrameHandle,
  LineDiff, DiffType, DebounceOptions, MemoizeOptions,
} from './utils/helpers.js';

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

const ansimax = { color, animate, ascii, loader, frames, components, trees, themes, images, configure };
export default ansimax;
