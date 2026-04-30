// ─────────────────────────────────────────────
//  ANSIMAX  v1.0.0
//  La librería definitiva para CLIs impresionantes
// ─────────────────────────────────────────────

// ── Core modules ──
export { color, gradient, rainbow, presets as colorPresets, compose, setNoColor, isNoColor, resetNoColor } from './colors/index.js';
export type { ColorFn } from './colors/index.js';

export { animate } from './animations/index.js';
export type {
  TypewriterOptions, FadeOptions, SlideOptions,
  PulseOptions, WaveOptions, GlitchOptions, RevealOptions,
} from './animations/index.js';

export { ascii } from './ascii/index.js';
export type { BoxStyle, BoxOptions, BannerOptions, DividerOptions, LogoOptions } from './ascii/index.js';

export { loader } from './loaders/index.js';
export type { SpinnerType, SpinOptions, ProgressOptions, Task, TaskResult } from './loaders/index.js';
export { SPINNERS } from './loaders/index.js';

export { frames } from './frames/index.js';
export type { PlayOptions, LiveController } from './frames/index.js';

export { components } from './components/index.js';
export type {
  TableOptions, BadgeOptions, ProgressBarOptions,
  StatusType, SectionOptions, ColumnsOptions,
  TimelineEvent, TimelineOptions,
  MenuOptions, MenuResult, MenuInput, MenuOutput,
} from './components/index.js';

export { themes } from './themes/index.js';
export type { Theme } from './themes/index.js';

export { images, createCanvas, renderPixelArt, gradientRect, SPRITES } from './images/index.js';
export type { Canvas } from './images/index.js';

export { configure, getConfig, getSpeedMultiplier } from './configure.js';
export type { AnsimaxConfig, ColorMode, AnimationSpeed } from './configure.js';

// ── Utils (public) ──
export { sleep, write, writeln, cursor, screen, supportsColor, fgRgb, bgRgb, sgr, reset } from './utils/ansi.js';
export {
  termSize, hexToRgb, rgbToHex, stripAnsi, visibleLen, clamp, lerpColor,
  isHexColor, truncateAnsi, repeatVisible, padEnd, padStart, center, wordWrap, lerp, rgbTo256,
} from './utils/helpers.js';
export type { RGB } from './utils/helpers.js';

// ── Default export: full API object ──
import { color }      from './colors/index.js';
import { animate }    from './animations/index.js';
import { ascii }      from './ascii/index.js';
import { loader }     from './loaders/index.js';
import { frames }     from './frames/index.js';
import { components } from './components/index.js';
import { themes }     from './themes/index.js';
import { images }     from './images/index.js';
import { configure }  from './configure.js';

const ansimax = { color, animate, ascii, loader, frames, components, themes, images, configure };
export default ansimax;