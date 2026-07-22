// ─────────────────────────────────────────────
//  ansimax/ascii — Public API barrel
//
//  v1.4.10 — Refactored from a single 1575-line file into focused modules:
//    - types.ts    ← public types (Glyph, FontMap, all Options, FigletFont)
//    - fonts.ts    ← BLOCK/SMALL fonts, LRU cache, renderFont, font registry
//    - render.ts   ← big/small/figlet + banner pipeline (stages)
//    - shapes.ts   ← box/divider/logo/measure
//    - image.ts    ← fromImage + luminance/sobel/dither/resize helpers
//    - figlet.ts   ← parseFiglet + figletText (.flf support)
//    - stream.ts   ← streaming async-iterator render
//    - table.ts    ← auto-layout tables (v1.4.8)
//    - index.ts    ← this file: re-exports + `ascii` namespace
//
//  External imports remain 100% backward-compatible.
// ─────────────────────────────────────────────

// ── Public types ──
export type {
  Glyph, FontMap, FontName,
  BoxStyle, BoxOptions, BannerOptions, DividerOptions, LogoOptions,
  RegisterFontOptions, Dimensions, StreamOptions,
  FromImageOptions, FigletFont, FigletOptions,
} from './types.js';

// ── Fonts / cache / registry ──
export {
  clearRenderCache, getRenderCacheSize,
  registerFont, listFonts, hasFont,
} from './fonts.js';

// ── Render API + banner pipeline ──
export {
  big, small, figlet,
  stageRender, stageAlign, stageColorize, banner,
} from './render.js';

// ── Shapes ──
export { box, divider, logo, measure } from './shapes.js';

// ── Image → ASCII ──
export { fromImage, ASCII_RAMPS } from './image.js';
export type { AsciiRamp } from './image.js';

// ── Figlet ──
export { parseFiglet, figletText } from './figlet.js';

// ── Stream ──
export { stream } from './stream.js';

// ── Tables (v1.4.8) ──
export { table } from './table.js';
export type { TableOptions, TableAlign, TableBorderStyle } from './table.js';

// ─────────────────────────────────────────────
//  Namespace (used by the main ansimax barrel + default export)
// ─────────────────────────────────────────────

import { registerFont as _registerFont, listFonts as _listFonts, hasFont as _hasFont, clearRenderCache as _clearRenderCache, getRenderCacheSize as _getRenderCacheSize } from './fonts.js';
import { big as _big, small as _small, figlet as _figlet, stageRender as _stageRender, stageAlign as _stageAlign, stageColorize as _stageColorize, banner as _banner } from './render.js';
import { box as _box, divider as _divider, logo as _logo, measure as _measure } from './shapes.js';
import { fromImage as _fromImage } from './image.js';
import { parseFiglet as _parseFiglet, figletText as _figletText } from './figlet.js';
import { stream as _stream } from './stream.js';
import { table as _table } from './table.js';
import { boxStyleNames } from './shapes.js';

export const ascii = {
  big: _big,
  small: _small,
  figlet: _figlet,
  banner: _banner,
  box: _box,
  divider: _divider,
  logo: _logo,
  stream: _stream,
  measure: _measure,
  // v1.2.5 — Phase 3 closure
  fromImage: _fromImage,
  figletText: _figletText,
  parseFiglet: _parseFiglet,
  // Pipeline stages — exposed for custom compositions
  stageRender: _stageRender,
  stageAlign: _stageAlign,
  stageColorize: _stageColorize,
  // Font registry
  registerFont: _registerFont,
  listFonts: _listFonts,
  hasFont: _hasFont,
  // Cache control
  clearRenderCache: _clearRenderCache,
  getRenderCacheSize: _getRenderCacheSize,
  // v1.4.8 — auto-layout tables
  table: _table,
  boxStyles: boxStyleNames,
};

export default ascii;
