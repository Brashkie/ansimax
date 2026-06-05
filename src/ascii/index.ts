// ─────────────────────────────────────────────
//  ASCII ART  –  built-in fonts, boxes, banners, dividers, logos
//
//  Robustness guarantees:
//   - Strict input validation (non-string text rejected with TypeError)
//   - LRU render cache (bounded, font-keyed, isolated per spacing)
//   - Multi-line text supported via recursive split-render-join
//   - Custom font registration with full structural validation
//   - Streaming render (row or char granularity) with AbortSignal
//   - Pipeline stages (stageRender/stageAlign/stageColorize) for custom UIs
//   - ANSI-aware perCharColor that preserves embedded escape sequences
//   - Box/divider/logo all use Unicode-aware visibleLen for layout
// ─────────────────────────────────────────────

import { termSize, center, visibleLen, truncateAnsi, padEnd } from '../utils/helpers.js';
import { ColorFn, isNoColor } from '../colors/index.js';
import { fgRgb, bgRgb, reset } from '../utils/ansi.js';
import type { Pixel, PixelGrid } from '../images/index.js';

/** A glyph is an array of equal-length strings (one per row). */
export type Glyph = string[];

/** Maps a character to its glyph. Every font must define ' ' or '?'. */
export type FontMap = Record<string, Glyph>;

/** Built-in font name. */
export type FontName = 'big' | 'small';

// ─────────────────────────────────────────────
//  Built-in fonts
// ─────────────────────────────────────────────

// ── Block font (5 lines tall) ──
const BLOCK: FontMap = {
  ' ': ['     ', '     ', '     ', '     ', '     '],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  B: ['████ ', '█   █', '████ ', '█   █', '████ '],
  C: [' ███ ', '█    ', '█    ', '█    ', ' ███ '],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  F: ['█████', '█    ', '████ ', '█    ', '█    '],
  G: [' ████', '█    ', '█  ██', '█   █', ' ████'],
  H: ['█   █', '█   █', '█████', '█   █', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  J: ['█████', '   █ ', '   █ ', '█  █ ', ' ██  '],
  K: ['█   █', '█  █ ', '███  ', '█  █ ', '█   █'],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
  Q: [' ███ ', '█   █', '█ █ █', '█  ██', ' ████'],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  U: ['█   █', '█   █', '█   █', '█   █', ' ███ '],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  W: ['█   █', '█   █', '█ █ █', '██ ██', '█   █'],
  X: ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  '0': [' ███ ', '█  ██', '█ █ █', '██  █', ' ███ '],
  '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
  '2': [' ███ ', '█   █', '  ██ ', ' █   ', '█████'],
  '3': ['████ ', '    █', ' ███ ', '    █', '████ '],
  '4': ['█   █', '█   █', '█████', '    █', '    █'],
  '5': ['█████', '█    ', '████ ', '    █', '████ '],
  '6': [' ███ ', '█    ', '████ ', '█   █', ' ███ '],
  '7': ['█████', '   █ ', '  █  ', ' █   ', '█    '],
  '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
  '9': [' ███ ', '█   █', ' ████', '    █', ' ███ '],
  '!': ['  █  ', '  █  ', '  █  ', '     ', '  █  '],
  '?': [' ███ ', '█   █', '   █ ', '     ', '  █  '],
  '.': ['     ', '     ', '     ', '     ', '  █  '],
  '-': ['     ', '     ', '████ ', '     ', '     '],
  '+': ['     ', '  █  ', '█████', '  █  ', '     '],
  '#': [' █ █ ', '█████', ' █ █ ', '█████', ' █ █ '],
  '@': [' ███ ', '█   █', '█ ██ ', '█    ', ' ████'],
};

// ── Small font (3 lines tall) ──
const SMALL: FontMap = {
  ' ': ['   ', '   ', '   '],
  A: ['▄▀▄', '█▀█', '▀ ▀'],
  B: ['█▀▄', '█▀▄', '▀▀ '],
  C: ['▄▀▀', '█  ', '▀▀▄'],
  D: ['█▀▄', '█ █', '▀▀ '],
  E: ['█▀▀', '█▀ ', '▀▀▀'],
  F: ['█▀▀', '█▀ ', '▀  '],
  G: ['▄▀▀', '█ ▄', '▀▀▘'],
  H: ['█ █', '███', '▀ ▀'],
  I: ['▀█▀', ' █ ', '▀█▀'],
  J: [' ▄█', '  █', '▀▀ '],
  K: ['█▄▀', '█▀▄', '▀ ▀'],
  L: ['█  ', '█  ', '▀▀▀'],
  M: ['█▄█', '█ █', '▀ ▀'],
  N: ['█▄█', '█ █', '▀ ▀'],
  O: ['▄▀▄', '█ █', '▀▄▀'],
  P: ['█▀▄', '█▀ ', '▀  '],
  Q: ['▄▀▄', '█▀█', '▀▄█'],
  R: ['█▀▄', '█▀▄', '▀ ▀'],
  S: ['▄▀▀', '▄▀ ', '▀▀▘'],
  T: ['▀█▀', ' █ ', ' ▀ '],
  U: ['█ █', '█ █', '▀▀▘'],
  V: ['█ █', '█ █', ' ▀ '],
  W: ['█ █', '█▄█', '▀ ▀'],
  X: ['▀▄▀', ' █ ', '▀ ▀'],
  Y: ['█ █', ' █ ', ' ▀ '],
  Z: ['▀▀█', '▄▀ ', '▀▀▀'],
  '0': ['▄▀▄', '█ █', '▀▄▀'],
  '1': ['▄█ ', ' █ ', '▀▀▀'],
  '2': ['▀▀▄', '▄▀ ', '▀▀▀'],
  '3': ['▀▀▄', ' ▀▄', '▀▀▘'],
  '4': ['█ █', '▀▀█', '  █'],
  '5': ['▄▀▀', '▀▀▄', '▀▀ '],
  '6': ['▄▀▀', '█▀▄', '▀▀▘'],
  '7': ['▀▀█', '  █', '  █'],
  '8': ['▄▀▄', '▄▀▄', '▀▄▘'],
  '9': ['▄▀▄', '▀▀█', '▀▀▘'],
  '!': ['█', '█', '▀'],
  '?': ['▀▄', ' ▄', ' ▀'],
  '.': [' ', ' ', '▄'],
  '-': ['   ', '▀▀▀', '   '],
  '+': [' ▄ ', '▀█▀', ' ▀ '],
  '#': ['█▀█', '███', '█▄█'],
  '@': ['▄▀▄', '█ █', '▀▀▀'],
};

// ─────────────────────────────────────────────
//  Render cache — LRU keyed by font + spacing + text
//
//  Big text rendering is allocation-heavy. Cache trades a bit of
//  memory for a large speedup on repeated calls (animations, redraws).
//
//  Key uses \u0001 as separator — guaranteed to never appear in font
//  names or text, eliminating cache key collision risk that pipe (|)
//  characters in font names could cause.
// ─────────────────────────────────────────────

const _renderCache = new Map<string, string>();
const _MAX_CACHE_SIZE = 100;
const CACHE_SEP = '\u0001';

const _cacheGet = (key: string): string | undefined => {
  const value = _renderCache.get(key);
  if (value !== undefined) {
    // Touch — reinsert to mark most-recently-used
    _renderCache.delete(key);
    _renderCache.set(key, value);
  }
  return value;
};

const _cacheSet = (key: string, value: string): void => {
  /* istanbul ignore if — defensive: deletion happens only on duplicate key */
  if (_renderCache.has(key)) _renderCache.delete(key);
  _renderCache.set(key, value);
  /* istanbul ignore next — LRU eviction only triggers when cache exceeds MAX */
  while (_renderCache.size > _MAX_CACHE_SIZE) {
    const firstKey = _renderCache.keys().next().value;
    if (firstKey === undefined) break;
    _renderCache.delete(firstKey);
  }
};

/** For tests — clear the render cache. */
export const clearRenderCache = (): void => { _renderCache.clear(); };

/** For tests/debugging — current cache size. */
export const getRenderCacheSize = (): number => _renderCache.size;

// ─────────────────────────────────────────────
//  Input validation
// ─────────────────────────────────────────────

const ensureString = (value: unknown, paramName: string): string => {
  if (typeof value !== 'string') {
    throw new TypeError(
      `ascii: ${paramName} must be a string, got ${typeof value}`,
    );
  }
  return value;
};

const ensureFontMap = (value: unknown, name: string): FontMap => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(
      `ascii.registerFont: font "${name}" map must be a non-null object, got ${typeof value}`,
    );
  }
  return value as FontMap;
};

// ─────────────────────────────────────────────
//  Glyph helpers
// ─────────────────────────────────────────────

interface RenderOptions {
  /** Spaces between glyphs (default: 1). */
  letterSpacing?: number;
  /** Font name for cache key. */
  _fontKey?: string;
}

/* istanbul ignore next — defensive: built-in fonts always have ' ' glyph;
   this fallback synthesizes blanks for malformed user-registered fonts */
const synthBlankGlyph = (fontMap: FontMap): Glyph => {
  const probe = Object.values(fontMap)[0];
  if (!probe || probe.length === 0) return [' '];
  const height = probe.length;
  const width = probe[0]?.length ?? 1;
  const blank = ' '.repeat(width);
  return Array(height).fill(blank);
};

/**
 * Returns the glyph used for unknown characters.
 * Preference order: '?' glyph → ' ' glyph → blank glyph sized to the font.
 * Guarantees no row mismatch even if the font lacks '?' or ' '.
 */
const buildFallbackGlyph = (fontMap: FontMap): Glyph => {
  /* istanbul ignore if — defensive: built-in fonts always have '?' */
  if (fontMap['?']) return fontMap['?'];
  /* istanbul ignore if — defensive: built-in fonts always have ' ' */
  if (fontMap[' ']) return fontMap[' '];
  /* istanbul ignore next — synthesizes blanks for malformed fonts */
  return synthBlankGlyph(fontMap);
};

/**
 * Compute the cell width of a font. Used to size the empty padding row.
 * Falls back through the same chain as buildFallbackGlyph so we always
 * have a number even for malformed fonts.
 */
const fontCellWidth = (fontMap: FontMap): number => {
  /* istanbul ignore next — `??` fallbacks fire only for malformed fonts */
  const sample = fontMap[' '] ?? fontMap['?'] ?? Object.values(fontMap)[0];
  /* istanbul ignore next — defensive: built-in fonts have at least ' ' or '?' */
  if (!sample || !sample.length) return 1;
  /* istanbul ignore next — `?? ''` and `|| 1` fallbacks for malformed glyph */
  return (sample[0] ?? '').length || 1;
};

const renderFont = (
  text: string,
  fontMap: FontMap,
  /* istanbul ignore next — default arg only when caller omits */
  opts: RenderOptions = {},
): string => {
  if (!text.length) return '';

  /* istanbul ignore next — destructure defaults rare */
  const { letterSpacing = 1, _fontKey = 'unknown' } = opts;
  const safeSpacing = Math.max(0, Math.floor(letterSpacing));

  // Multi-line — render each line independently, join with \n
  if (text.includes('\n')) {
    return text
      .split('\n')
      .map((line) => renderFont(line, fontMap, opts))
      .join('\n');
  }

  // Cache key uses \u0001 as separator (never appears in real font names)
  const cacheKey = `${_fontKey}${CACHE_SEP}${safeSpacing}${CACHE_SEP}${text}`;
  const cached = _cacheGet(cacheKey);
  if (cached !== undefined) return cached;

  const cellWidth = fontCellWidth(fontMap);
  const empty = ' '.repeat(cellWidth);
  const fallback = buildFallbackGlyph(fontMap);

  // Toupper for case-insensitive lookup. We use the original text length
  // for grapheme-aware iteration to avoid splitting surrogate pairs.
  const upperText = text.toUpperCase();
  const glyphs: Glyph[] = [];
  for (const ch of upperText) {
    glyphs.push(fontMap[ch] ?? fallback);
  }
  /* istanbul ignore next — defensive: ensureString rejects empty before reaching this branch */
  if (glyphs.length === 0) {
    _cacheSet(cacheKey, '');
    return '';
  }

  const height = (glyphs[0] as Glyph).length;
  const separator = ' '.repeat(safeSpacing);
  const lines: string[] = [];
  for (let row = 0; row < height; row++) {
    /* istanbul ignore next — `g[row] ?? empty` row mismatch defensive */
    lines.push(glyphs.map((g) => (g[row] ?? empty)).join(separator));
  }

  const result = lines.join('\n');
  _cacheSet(cacheKey, result);
  return result;
};

// ─────────────────────────────────────────────
//  Font registry — extensible at runtime
// ─────────────────────────────────────────────

const FONTS: Record<string, FontMap> = {
  big:   BLOCK,
  small: SMALL,
};

const RESERVED_FONT_NAMES = new Set(['big', 'small']);

/**
 * Validate font internal consistency:
 *  - At least one of ' ' or '?' must be defined for fallback
 *  - All glyphs must have the same height (number of rows)
 *  - All rows in every glyph must have the same width
 */
const validateFont = (name: string, fontMap: FontMap): void => {
  if (!fontMap[' '] && !fontMap['?']) {
    throw new Error(`Font "${name}" must define a ' ' or '?' glyph for fallback.`);
  }

  const entries = Object.entries(fontMap);
  /* istanbul ignore next — defensive: validation rejects empty fontMaps at registerFont() */
  if (entries.length === 0) {
    throw new Error(`Font "${name}" is empty.`);
  }

  /* istanbul ignore next — `??` chain only fires for malformed fonts */
  const probe = (fontMap[' '] ?? fontMap['?'] ?? entries[0]?.[1]) as Glyph;
  const expectedHeight = probe.length;
  const expectedWidth = (probe[0] as string).length;

  for (const [char, glyph] of entries) {
    if (!Array.isArray(glyph)) {
      throw new TypeError(
        `Font "${name}" glyph "${char}" must be an array of strings.`,
      );
    }
    if (glyph.length !== expectedHeight) {
      throw new Error(
        `Font "${name}" glyph "${char}" has height ${glyph.length}, ` +
        `expected ${expectedHeight}. All glyphs must share the same height.`,
      );
    }
    for (let i = 0; i < glyph.length; i++) {
      const row = glyph[i];
      if (typeof row !== 'string') {
        throw new TypeError(
          `Font "${name}" glyph "${char}" row ${i} must be a string.`,
        );
      }
      if (row.length !== expectedWidth) {
        throw new Error(
          `Font "${name}" glyph "${char}" row ${i} has width ${row.length}, ` +
          `expected ${expectedWidth}. All rows in a font must share the same width.`,
        );
      }
    }
  }
};

export interface RegisterFontOptions {
  /** Allow overwriting reserved built-in fonts (big, small). Default: false. */
  force?: boolean;
}

/**
 * Register a custom font at runtime.
 * Validates that the font is internally consistent before accepting it.
 * Throws TypeError for invalid types, Error for structural issues.
 *
 * @example
 *   ascii.registerFont('mini', {
 *     ' ': ['  ', '  '],
 *     A: ['▄▀', '▀▀'],
 *     '?': ['?·', ' ·'],
 *   });
 */
export const registerFont = (
  name: string,
  fontMap: FontMap,
  opts: RegisterFontOptions = {},
): void => {
  if (typeof name !== 'string' || !name.length) {
    throw new TypeError('ascii.registerFont: name must be a non-empty string');
  }
  if (RESERVED_FONT_NAMES.has(name) && !opts.force) {
    throw new Error(
      `Font name "${name}" is reserved. Pass { force: true } to override.`,
    );
  }
  const safeMap = ensureFontMap(fontMap, name);
  validateFont(name, safeMap);
  FONTS[name] = safeMap;
  // Invalidate cached renders that used this font name
  for (const key of _renderCache.keys()) {
    if (key.startsWith(`${name}${CACHE_SEP}`)) _renderCache.delete(key);
  }
};

/** List all registered font names. */
export const listFonts = (): string[] => Object.keys(FONTS);

/** Check if a font is registered (built-in or custom). */
export const hasFont = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(FONTS, name);

// ─────────────────────────────────────────────
//  Box drawing
// ─────────────────────────────────────────────

export type BoxStyle = 'single' | 'double' | 'rounded' | 'heavy' | 'dashed' | 'ascii';

interface BoxChars { tl: string; tr: string; bl: string; br: string; h: string; v: string }

const BOX_STYLES: Record<BoxStyle, BoxChars> = {
  single:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double:  { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  heavy:   { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  dashed:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '╌', v: '╎' },
  ascii:   { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
};

export interface BoxOptions {
  padding?: number;
  borderStyle?: BoxStyle;
  /** Fix inner content width. Lines are padded/truncated to fit. */
  width?: number | null;
}

export interface BannerOptions {
  font?: FontName | string;
  colorFn?: ColorFn | null;
  /** Apply colorFn per-character instead of per-line (true gradients). */
  perCharColor?: boolean;
  align?: 'left' | 'center';
  /** Spaces between glyphs (default: 1). */
  letterSpacing?: number;
}

export interface DividerOptions {
  char?: string;
  width?: number | null;
  label?: string | null;
  style?: BoxStyle;
}

export interface LogoOptions {
  gradient?: ColorFn | null;
  boxStyle?: BoxStyle;
  /** Center the rendered ASCII inside the box (default: true). */
  centered?: boolean;
}

// ─────────────────────────────────────────────
//  Public render API
// ─────────────────────────────────────────────

const big = (text: string): string => {
  const safe = ensureString(text, 'big(text)');
  return renderFont(safe, BLOCK, { _fontKey: 'big' });
};

const small = (text: string): string => {
  const safe = ensureString(text, 'small(text)');
  return renderFont(safe, SMALL, { _fontKey: 'small' });
};

/**
 * Render text in any registered font. Defaults to 'big'.
 * Accepts custom fonts registered via registerFont().
 */
const figlet = (
  text: string,
  opts: { font?: FontName | string; letterSpacing?: number } = {},
): string => {
  const safe = ensureString(text, 'figlet(text)');
  /* istanbul ignore next — `?? 'big'` defensive */
  const fontName = opts.font ?? 'big';
  // Unknown fonts fall back to BLOCK silently — defensive default
  /* istanbul ignore next — `?? BLOCK` only for missing fonts */
  const fontMap = FONTS[fontName] ?? BLOCK;
  return renderFont(safe, fontMap, {
    /* istanbul ignore next — `: 'big'` defensive */
    _fontKey: typeof fontName === 'string' ? fontName : 'big',
    ...(opts.letterSpacing !== undefined && { letterSpacing: opts.letterSpacing }),
  });
};

// ─────────────────────────────────────────────
//  Banner pipeline — composable stages
// ─────────────────────────────────────────────

/** Stage 1: render text in a font. */
const stageRender = (
  text: string,
  font: FontName | string,
  letterSpacing?: number,
): string => {
  const safe = ensureString(text, 'stageRender(text)');
  /* istanbul ignore next — `?? BLOCK` only for missing fonts */
  const fontMap = FONTS[font] ?? BLOCK;
  /* istanbul ignore next — `: 'big'` defensive */
  const renderOpts: RenderOptions = { _fontKey: typeof font === 'string' ? font : 'big' };
  if (letterSpacing !== undefined) renderOpts.letterSpacing = letterSpacing;
  return renderFont(safe, fontMap, renderOpts);
};

/** Stage 2: align the rendered text. */
const stageAlign = (rendered: string, align: 'left' | 'center'): string => {
  if (align !== 'center') return rendered;
  const { cols } = termSize();
  return rendered.split('\n').map((l) => center(l, cols)).join('\n');
};

/**
 * Apply colorFn to each visible character of `line`, leaving ANSI escape
 * sequences untouched. Handles bare \x1b that doesn't form a CSI sequence
 * by emitting it as a literal char (rare but possible in malformed input).
 */
const colorEachVisibleChar = (line: string, colorFn: ColorFn): string => {
  const ANSI_TOKEN = /\x1b\[[0-9;?]*[a-zA-Z]/y;
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (line[i] === '\x1b') {
      ANSI_TOKEN.lastIndex = i;
      const match = ANSI_TOKEN.exec(line);
      if (match) {
        out += match[0];
        i += match[0].length;
        continue;
      }
      // Bare \x1b that didn't form a CSI sequence — emit literally and advance
      out += '\x1b';
      i++;
      continue;
    }
    const ch = line[i] as string;
    out += ch === ' ' ? ch : colorFn(ch);
    i++;
  }
  return out;
};

/** Stage 3: apply color to the text. */
const stageColorize = (
  rendered: string,
  colorFn: ColorFn | null,
  perCharColor: boolean,
): string => {
  if (!colorFn) return rendered;
  if (perCharColor) {
    return rendered
      .split('\n')
      .map((line) => colorEachVisibleChar(line, colorFn))
      .join('\n');
  }
  return rendered.split('\n').map(colorFn).join('\n');
};

const banner = (text: string, opts: BannerOptions = {}): string => {
  const safe = ensureString(text, 'banner(text)');
  const {
    font = 'big', colorFn = null, align = 'left',
    perCharColor = false, letterSpacing,
  } = opts;

  // Pipeline: render → align → colorize
  let result = stageRender(safe, font, letterSpacing);
  result = stageAlign(result, align);
  result = stageColorize(result, colorFn, perCharColor);
  return result;
};

// ─────────────────────────────────────────────
//  Box / divider / logo
// ─────────────────────────────────────────────

const box = (text: string, opts: BoxOptions = {}): string => {
  const safe = ensureString(text, 'box(text)');
  const { padding = 1, borderStyle = 'rounded', width = null } = opts;
  // Defensive: padding must be a finite number. If user passes an object,
  // string, NaN, etc., fall back to the default (1).
  const padNum = typeof padding === 'number' && Number.isFinite(padding) ? padding : 1;
  const safePadding = Math.max(0, Math.floor(padNum));
  const b = BOX_STYLES[borderStyle] ?? BOX_STYLES.rounded;

  const lines = safe.split('\n');
  // truncateAnsi respects ANSI + Unicode width
  const inner = width != null
    ? lines.map((l) => padEnd(truncateAnsi(l, width, ''), width))
    : lines;

  // Math.max with no args returns -Infinity — guard with 0
  /* istanbul ignore next — `: 0` empty-box ternary defensive */
  const w = inner.length > 0
    ? Math.max(0, ...inner.map((l) => visibleLen(l)))
    : 0;
  const pad = ' '.repeat(safePadding);

  const top = b.tl + b.h.repeat(w + safePadding * 2) + b.tr;
  const bottom = b.bl + b.h.repeat(w + safePadding * 2) + b.br;
  const emptyRow = b.v + ' '.repeat(w + safePadding * 2) + b.v;
  const rows = inner.map((l) => b.v + pad + padEnd(l, w) + pad + b.v);
  const vPad = Array(safePadding).fill(emptyRow) as string[];

  return [top, ...vPad, ...rows, ...vPad, bottom].join('\n');
};

const divider = (opts: DividerOptions = {}): string => {
  const { char, width = null, label = null, style = 'single' } = opts;
  const { cols } = termSize();
  const w = Math.max(0, width ?? cols);
  const b = BOX_STYLES[style] ?? BOX_STYLES.single;
  const fill = char ?? b.h;

  if (w === 0) return '';

  if (label) {
    const labelLen = visibleLen(label);
    // Label too wide for the divider — show label alone (no fill)
    if (labelLen >= w - 2) return label;
    const side = Math.max(0, Math.floor((w - labelLen - 2) / 2));
    const trailLen = Math.max(0, w - side - labelLen - 2);
    return fill.repeat(side) + ' ' + label + ' ' + fill.repeat(trailLen);
  }
  return fill.repeat(w);
};

const logo = (text: string, opts: LogoOptions = {}): string => {
  const safe = ensureString(text, 'logo(text)');
  const { gradient: gfn = null, boxStyle = 'double', centered = true } = opts;

  // Empty text → just an empty box (avoids -Infinity in Math.max)
  if (!safe.length) return box('', { borderStyle: boxStyle, padding: 1 });

  const art = big(safe);
  let lines = art.split('\n').map((l) => (gfn ? gfn(l) : l));

  if (centered && lines.length > 0) {
    const maxLineWidth = Math.max(0, ...lines.map((l) => visibleLen(l)));
    if (maxLineWidth > 0) {
      lines = lines.map((l) => center(l, maxLineWidth));
    }
  }

  return box(lines.join('\n'), { borderStyle: boxStyle, padding: 1 });
};

// ─────────────────────────────────────────────
//  Measure — get dimensions without paying full render cost
//
//  Useful for layout decisions before rendering, e.g.:
//    if (ascii.measure(title, 'big').width > termSize().cols) ...
// ─────────────────────────────────────────────

export interface Dimensions { width: number; height: number }

/**
 * Compute the visible dimensions a banner would occupy when rendered.
 * Uses the cache (so repeated calls are cheap), and works on any
 * registered font.
 */
const measure = (
  text: string,
  font: FontName | string = 'big',
  letterSpacing?: number,
): Dimensions => {
  const safe = ensureString(text, 'measure(text)');
  if (!safe.length) return { width: 0, height: 0 };
  const rendered = stageRender(safe, font, letterSpacing);
  const lines = rendered.split('\n');
  const width = Math.max(0, ...lines.map((l) => visibleLen(l)));
  return { width, height: lines.length };
};

// ─────────────────────────────────────────────
//  Streaming render — async iterator with AbortSignal
//
//  Yields the rendered output progressively, one row or char at a time.
//  Useful when piping into animate.typewriter() or building custom
//  reveal effects without buffering the whole banner first.
//
//  If `signal` is provided, the iterator stops yielding (returns) the
//  next time it's polled after abort.
// ─────────────────────────────────────────────

export interface StreamOptions {
  /** Font name to use. Default: 'big'. */
  font?: FontName | string;
  /** Spaces between glyphs. Default: 1. */
  letterSpacing?: number;
  /** Stream granularity: 'row' yields one line at a time, 'char' yields one char. */
  granularity?: 'row' | 'char';
  /** Abort signal — stops yielding when triggered. */
  signal?: AbortSignal;
}

/**
 * Async iterator that yields chunks of the rendered ASCII art.
 *
 * @example
 *   for await (const chunk of ascii.stream('HELLO', { signal })) {
 *     write(chunk);
 *     await sleep(50);
 *   }
 */
const stream = async function* (
  text: string,
  opts: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  const safe = ensureString(text, 'stream(text)');
  const { font = 'big', letterSpacing, granularity = 'row', signal } = opts;

  if (!safe.length) return;

  // Pre-aborted signal — yield nothing
  if (signal?.aborted) return;

  const rendered = stageRender(safe, font, letterSpacing);

  if (granularity === 'char') {
    for (const ch of rendered) {
      if (signal?.aborted) return;
      yield ch;
    }
    return;
  }

  // 'row' granularity — yield each line including its trailing newline
  // (except the last line, which has no trailing newline)
  const lines = rendered.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (signal?.aborted) return;
    const line = lines[i] as string;
    yield i === lines.length - 1 ? line : line + '\n';
  }
};

// ─────────────────────────────────────────────
//  v1.2.5 — Phase 3 closure: image-to-ASCII engine
// ─────────────────────────────────────────────

/**
 * Character ramps for luminance → glyph mapping.
 * Each ramp is ordered dark → light.
 *
 * - `standard` — balanced 10-char ramp, works for most images (default)
 * - `detailed` — 70-char ramp from Paul Bourke, max detail at small sizes
 * - `blocks` — Unicode block fills, looks like a real photo at distance
 * - `simple` — 4-char minimal ramp
 * - `binary` — pure 2-char ramp: space + filled block
 * - `dots` — Unicode braille dots (sparse aesthetic)
 * - `shades` — Unicode shading gradient with high tonal range
 * - `ascii64` — printable ASCII subset, 64 chars, good for non-Unicode terminals
 *
 * @example
 * ```js
 * import { ascii, ASCII_RAMPS } from 'ansimax';
 *
 * console.log(ASCII_RAMPS.blocks);   // ' ░▒▓█'
 * console.log(ASCII_RAMPS.shades);   // ' ⠁⠃⠇⠧⠷⡷⣷⣿█'
 *
 * // Use directly by name
 * ascii.fromImage(pixels, { ramp: 'shades' });
 *
 * // Or pass a custom ramp string
 * ascii.fromImage(pixels, { ramp: ' .oO@' });
 * ```
 */
export const ASCII_RAMPS = {
  standard: ' .:-=+*#%@',
  detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
  blocks:   ' ░▒▓█',
  simple:   ' .+#',
  // v1.2.6 — new ramps
  binary:   ' █',
  dots:     ' ⠁⠃⠇⠧⠷⡷⣷⣿',
  shades:   ' ⠁⠃⠇⠧⠷⡷⣷⣿█',
  ascii64:  ' `.\'^,_:-+=<>i!lI?/\\|()1{}[]rcvunxzjftLCJUYXZO0Qoahkbdpqwm*WMB8&%$#@',
} as const;

export type AsciiRamp = keyof typeof ASCII_RAMPS | string;

const _resolveRamp = (r: AsciiRamp | undefined): string => {
  if (typeof r === 'string' && r.length > 0) {
    if (r in ASCII_RAMPS) return ASCII_RAMPS[r as keyof typeof ASCII_RAMPS];
    return r; // custom ramp string
  }
  return ASCII_RAMPS.standard;
};

/** Compute perceived luminance (BT.709) — returns [0, 255]. */
const _luminance = (p: Pixel): number => {
  if (!p) return 0;
  // Standard ITU-R BT.709 coefficients
  return 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;
};

/**
 * Sobel edge detection — returns a same-sized grid of edge magnitudes [0, 255].
 * Used internally for `edgeDetect: 'sobel'` mode.
 */
const _sobelEdges = (pixels: PixelGrid): number[][] => {
  const h = pixels.length;
  const w = h > 0 ? (pixels[0] as Pixel[]).length : 0;
  const out: number[][] = Array.from({ length: h }, () => new Array<number>(w).fill(0));

  // Gx and Gy kernels
  // Gx: [-1 0 1; -2 0 2; -1 0 1]
  // Gy: [-1 -2 -1; 0 0 0; 1 2 1]
  for (let y = 1; y < h - 1; y++) {
    const rowPrev = pixels[y - 1] as Pixel[];
    const row     = pixels[y]     as Pixel[];
    const rowNext = pixels[y + 1] as Pixel[];
    const outRow  = out[y]        as number[];
    for (let x = 1; x < w - 1; x++) {
      const tl = _luminance(rowPrev[x - 1] as Pixel);
      const t  = _luminance(rowPrev[x]     as Pixel);
      const tr = _luminance(rowPrev[x + 1] as Pixel);
      const l  = _luminance(row[x - 1]     as Pixel);
      const r  = _luminance(row[x + 1]     as Pixel);
      const bl = _luminance(rowNext[x - 1] as Pixel);
      const b  = _luminance(rowNext[x]     as Pixel);
      const br = _luminance(rowNext[x + 1] as Pixel);

      const gx = -tl + tr - 2 * l + 2 * r - bl + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      const mag = Math.sqrt(gx * gx + gy * gy);
      outRow[x] = Math.min(255, mag);
    }
  }
  return out;
};

/**
 * Floyd-Steinberg error diffusion applied to a luminance grid.
 * Mutates a copy of the input and returns it. Produces a quantized
 * grid suitable for ramp-based ASCII rendering.
 */
const _floydSteinberg = (lum: number[][], levels: number): number[][] => {
  const h = lum.length;
  /* istanbul ignore if — defensive: callers (fromImage) validate non-empty grids upstream */
  if (h === 0) return lum;
  const w = (lum[0] as number[]).length;
  /* istanbul ignore if — defensive: callers validate non-empty rows upstream */
  if (w === 0) return lum;

  // Work on a copy so we don't mutate the caller's data
  const out = lum.map((row) => [...row]);
  const step = 255 / Math.max(1, levels - 1);

  for (let y = 0; y < h; y++) {
    const row = out[y] as number[];
    for (let x = 0; x < w; x++) {
      const oldPixel = row[x] as number;
      const quantLevel = Math.round(oldPixel / step);
      const newPixel = quantLevel * step;
      row[x] = newPixel;
      const err = oldPixel - newPixel;

      // Distribute the error to neighbors (right, bottom-left, bottom, bottom-right)
      if (x + 1 < w) {
        row[x + 1] = (row[x + 1] as number) + err * 7 / 16;
      }
      if (y + 1 < h) {
        const next = out[y + 1] as number[];
        if (x > 0)     next[x - 1] = (next[x - 1] as number) + err * 3 / 16;
                       next[x]     = (next[x]     as number) + err * 5 / 16;
        if (x + 1 < w) next[x + 1] = (next[x + 1] as number) + err * 1 / 16;
      }
    }
  }
  return out;
};

/**
 * Resize a PixelGrid using nearest-neighbor sampling. Fast and good enough
 * for ASCII output where loss of detail is expected.
 */
const _resizePixels = (
  pixels: PixelGrid,
  targetW: number,
  targetH: number,
): PixelGrid => {
  const srcH = pixels.length;
  /* istanbul ignore if — defensive: callers validate non-empty grids upstream */
  if (srcH === 0) return [];
  const srcW = (pixels[0] as Pixel[]).length;
  /* istanbul ignore if — defensive: callers validate non-empty rows upstream */
  if (srcW === 0) return [];

  const out: PixelGrid = [];
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y / targetH) * srcH));
    const srcRow = pixels[sy] as Pixel[];
    const newRow: Pixel[] = new Array(targetW);
    for (let x = 0; x < targetW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x / targetW) * srcW));
      newRow[x] = srcRow[sx] as Pixel;
    }
    out.push(newRow);
  }
  return out;
};

/**
 * Compute a luminance grid (one number per pixel, [0, 255]).
 * Null pixels become 0.
 */
const _toLuminanceGrid = (pixels: PixelGrid): number[][] => {
  return pixels.map((row) => row.map((p) => _luminance(p)));
};

/**
 * Apply a small histogram stretch for portraits to enhance contrast in
 * the midtones (where faces live). Returns a new luminance grid.
 *
 * Strategy: stretch [10%, 90%] percentiles to [0, 255]. Simple but
 * effective for portraits with limited dynamic range.
 */
const _enhanceForFace = (lum: number[][]): number[][] => {
  const flat: number[] = [];
  for (const row of lum) for (const v of row) flat.push(v);
  /* istanbul ignore if — defensive: callers validate non-empty grids upstream */
  if (flat.length === 0) return lum;
  flat.sort((a, b) => a - b);
  const lo = flat[Math.floor(flat.length * 0.10)] as number;
  const hi = flat[Math.floor(flat.length * 0.90)] as number;
  const range = Math.max(1, hi - lo);
  return lum.map((row) =>
    row.map((v) => {
      const stretched = ((v - lo) / range) * 255;
      return Math.max(0, Math.min(255, stretched));
    }),
  );
};

/**
 * Apply brightness and contrast adjustments to a luminance grid.
 *
 * - `brightness` is added to each value (scaled to 0-255 range)
 * - `contrast` stretches values around the midpoint (128)
 *
 * Both parameters are in `[-1, 1]`. Returns a new grid; never mutates input.
 *
 * @since 1.2.6
 */
const _adjustBrightnessContrast = (
  lum: number[][],
  brightness: number,
  contrast: number,
): number[][] => {
  // Clamp inputs to [-1, 1]
  const safeBrightness = Math.max(-1, Math.min(1, brightness)) * 255;
  const safeContrast = Math.max(-1, Math.min(1, contrast));
  // Standard contrast formula: out = (in - 128) * factor + 128
  // where factor = (1 + contrast) for contrast in [-1, 1]
  const contrastFactor = 1 + safeContrast;

  return lum.map((row) =>
    row.map((v) => {
      // Apply contrast (around 128 midpoint), then brightness
      const adjusted = (v - 128) * contrastFactor + 128 + safeBrightness;
      return Math.max(0, Math.min(255, adjusted));
    }),
  );
};

/**
 * Convert a pixel grid into colored or monochrome ASCII art.
 *
 * @example basic monochrome conversion
 * ```ts
 * import sharp from 'sharp';
 *
 * const { data, info } = await sharp('photo.png')
 *   .raw().toBuffer({ resolveWithObject: true });
 * const pixels: PixelGrid = bufferToPixelGrid(data, info.width, info.height);
 *
 * console.log(ascii.fromImage(pixels, { width: 80 }));
 * ```
 *
 * @example with color + dither
 * ```ts
 * console.log(ascii.fromImage(pixels, {
 *   width: 100,
 *   color: true,
 *   dither: 'floyd-steinberg',
 *   ramp: 'detailed',
 * }));
 * ```
 *
 * @example with edge detection
 * ```ts
 * console.log(ascii.fromImage(pixels, {
 *   width: 80,
 *   edgeDetect: 'sobel',
 *   ramp: 'blocks',
 * }));
 * ```
 */
export interface FromImageOptions {
  /** Output character width. Default `80`. Aspect ratio is preserved. */
  width?: number;
  /**
   * Output character height. If omitted, computed from `width` and source
   * aspect ratio (with a 0.5 vertical correction for typical terminal cells
   * which are ~2x as tall as wide).
   */
  height?: number;
  /** Character ramp (dark → light). Default `'standard'`. */
  ramp?: AsciiRamp;
  /** Invert luminance (dark areas become bright chars). */
  invert?: boolean;
  /**
   * Apply dithering for better tonal range.
   * - `'none'` (default) — direct mapping
   * - `'floyd-steinberg'` — error diffusion, better for photos
   */
  dither?: 'none' | 'floyd-steinberg';
  /**
   * Edge detection mode. Renders edges as the brightest chars.
   * - `'none'` (default)
   * - `'sobel'` — classical 3x3 Sobel operator
   */
  edgeDetect?: 'none' | 'sobel';
  /** Sobel threshold (only when `edgeDetect: 'sobel'`). Default `40`. */
  edgeThreshold?: number;
  /**
   * Render in color. When `true`, each char is colored with the average
   * color of its source pixel. Default `false` (monochrome).
   */
  color?: boolean;
  /**
   * Use face-optimized rendering. Applies histogram stretching to enhance
   * midtone detail (where faces typically live). Best for portrait input.
   */
  faceMode?: boolean;
  /**
   * Render the source pixel's color as the **background** instead of the
   * foreground. Useful when paired with `ramp: 'binary'` for a photo-like
   * effect where chars become "pixels". Default `false`.
   *
   * Implies `color: true` — does not need to be set separately.
   *
   * @since 1.2.6
   */
  bgColor?: boolean;
  /**
   * Brightness adjustment applied to luminance before quantization.
   * Range `[-1, 1]`. `0` = no change, `0.2` = lighter, `-0.2` = darker.
   * Default `0`.
   *
   * @since 1.2.6
   */
  brightness?: number;
  /**
   * Contrast adjustment applied to luminance before quantization.
   * Range `[-1, 1]`. `0` = no change, `0.5` = boosted, `-0.5` = flattened.
   * Default `0`.
   *
   * @since 1.2.6
   */
  contrast?: number;
}

export const fromImage = (
  pixels: PixelGrid,
  opts: FromImageOptions = {},
): string => {
  // Validation
  if (!Array.isArray(pixels) || pixels.length === 0) return '';
  const firstRow = pixels[0];
  if (!Array.isArray(firstRow) || firstRow.length === 0) return '';

  const {
    width = 80,
    ramp = 'standard',
    invert = false,
    dither = 'none',
    edgeDetect = 'none',
    edgeThreshold = 40,
    color = false,
    faceMode = false,
    // v1.2.6
    bgColor = false,
    brightness = 0,
    contrast = 0,
  } = opts;

  const srcH = pixels.length;
  const srcW = (pixels[0] as Pixel[]).length;
  const safeW = Math.max(1, Math.floor(width));
  // Terminal cells are ~2x tall as wide; halve the height to keep aspect ratio
  const computedH = Math.max(1, Math.round((srcH / srcW) * safeW * 0.5));
  const safeH = opts.height != null ? Math.max(1, Math.floor(opts.height)) : computedH;

  // 1. Resize to target dimensions
  const resized = _resizePixels(pixels, safeW, safeH);

  // 2. Compute luminance grid
  let lum = _toLuminanceGrid(resized);

  // 3. Brightness / contrast pre-adjustment (v1.2.6)
  if (brightness !== 0 || contrast !== 0) {
    lum = _adjustBrightnessContrast(lum, brightness, contrast);
  }

  // 4. Face-mode contrast enhancement (before quantization)
  if (faceMode) lum = _enhanceForFace(lum);

  // 5. Edge detection (overrides luminance if enabled)
  let edgeGrid: number[][] | null = null;
  if (edgeDetect === 'sobel') {
    edgeGrid = _sobelEdges(resized);
  }

  // 5. Ramp resolution
  const rampStr = _resolveRamp(ramp);
  const rampLen = rampStr.length;

  // 6. Optional dithering (only when not in edge mode — they don't combine well)
  if (dither === 'floyd-steinberg' && !edgeGrid) {
    lum = _floydSteinberg(lum, rampLen);
  }

  // 7. Render output
  const useColor = (color || bgColor) && !isNoColor();
  const lines: string[] = [];
  for (let y = 0; y < safeH; y++) {
    const lumRow  = lum[y]      as number[];
    const pxRow   = resized[y]  as Pixel[];
    const edgeRow = edgeGrid ? (edgeGrid[y] as number[]) : null;
    let line = '';
    for (let x = 0; x < safeW; x++) {
      let charIdx: number;
      if (edgeRow) {
        // Edge mode: high edge → bright char, low edge → dark char
        const edge = edgeRow[x] as number;
        const t = edge >= edgeThreshold ? Math.min(1, edge / 255) : 0;
        // Math.round for fairer distribution at range extremes (vs floor)
        charIdx = invert
          ? Math.round((1 - t) * (rampLen - 1))
          : Math.round(t * (rampLen - 1));
      } else {
        const l = (lumRow[x] as number) / 255;
        const tNorm = invert ? 1 - l : l;
        // Math.round + clamp: ensures bright pixels reach the brightest char
        charIdx = Math.min(rampLen - 1, Math.max(0, Math.round(tNorm * (rampLen - 1))));
      }
      const ch = rampStr[charIdx] as string;

      if (useColor) {
        const p = pxRow[x];
        if (p) {
          // v1.2.6: bgColor option puts color on background instead of foreground
          if (bgColor) {
            line += bgRgb(p.r, p.g, p.b) + ch;
          } else {
            line += fgRgb(p.r, p.g, p.b) + ch;
          }
        } else {
          line += ch;
        }
      } else {
        line += ch;
      }
    }
    if (useColor) line += reset();
    lines.push(line);
  }

  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  v1.2.5 — Phase 3 closure: figlet .flf parser
// ─────────────────────────────────────────────

/** A parsed FIGfont — opaque to the user; pass to `ascii.figlet()`. */
export interface FigletFont {
  /** Font hardblank character (used as a space inside glyphs). */
  hardblank: string;
  /** Glyph height in rows. */
  height: number;
  /** Map from ASCII codepoint → glyph rows. */
  glyphs: Map<number, string[]>;
}

/**
 * Parse a FIGfont (.flf) file content into a `FigletFont` object.
 * Use the returned font with `ascii.figlet(text, font)`.
 *
 * Supports standard FIGfont format (the most common one). Tagged fonts
 * and complex Unicode glyphs may not parse — use vanilla .flf files
 * from http://www.figlet.org/fontdb.cgi
 *
 * @example
 * ```ts
 * import { readFileSync } from 'node:fs';
 * import { parseFiglet, ascii } from 'ansimax';
 *
 * const fontStr = readFileSync('./standard.flf', 'utf8');
 * const font = parseFiglet(fontStr);
 *
 * console.log(ascii.figlet('Hello!', font));
 * ```
 */
export const parseFiglet = (flfContent: string): FigletFont => {
  if (typeof flfContent !== 'string' || flfContent.length === 0) {
    throw new TypeError('parseFiglet: input must be a non-empty string');
  }

  const lines = flfContent.split(/\r?\n/);
  /* istanbul ignore if — unreachable: String.prototype.split always returns at least one element, and empty-string check is earlier */
  if (lines.length === 0) {
    throw new TypeError('parseFiglet: empty content');
  }

  // Header: "flf2a$ <height> <baseline> <maxLength> <oldLayout> <commentLines> ..."
  const header = lines[0] as string;
  const m = /^flf2.\s*(\S)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d+)/.exec(header);
  if (!m) {
    throw new TypeError('parseFiglet: invalid FIGfont header (expected "flf2a$..." line)');
  }
  const hardblank   = m[1] as string;
  const height      = parseInt(m[2] as string, 10);
  const commentLines = parseInt(m[6] as string, 10);

  if (!Number.isFinite(height) || height <= 0) {
    throw new TypeError(`parseFiglet: invalid height ${m[2]}`);
  }

  // Skip header + comment lines
  let cursor = 1 + Math.max(0, commentLines);
  const glyphs = new Map<number, string[]>();

  // Glyphs for ASCII 32..126 come first, in order
  for (let code = 32; code <= 126; code++) {
    if (cursor + height > lines.length) break;
    const rows: string[] = [];
    for (let r = 0; r < height; r++) {
      const raw = lines[cursor + r] as string;
      // Strip trailing endmark chars (usually @ or @@). FIGfont endmark is
      // the last char of the line, but may be doubled on the last row.
      const endmark = raw.charAt(raw.length - 1);
      let stripped = raw;
      // Remove any number of trailing endmark chars
      while (stripped.length > 0 && stripped.charAt(stripped.length - 1) === endmark) {
        stripped = stripped.slice(0, -1);
      }
      rows.push(stripped);
    }
    glyphs.set(code, rows);
    cursor += height;
  }

  return { hardblank, height, glyphs };
};

/**
 * Render text using a parsed FIGfont (.flf).
 * Unknown characters render as a space-equivalent.
 *
 * @example
 * ```ts
 * import { readFileSync } from 'node:fs';
 * import { parseFiglet, ascii } from 'ansimax';
 *
 * const font = parseFiglet(readFileSync('./big.flf', 'utf8'));
 * console.log(ascii.figlet('NICE', font));
 * ```
 */
export interface FigletOptions {
  /** Trim leading/trailing blank rows. Default `true`. */
  trim?: boolean;
  /** Color function applied to the assembled output. */
  colorFn?: ColorFn | null;
  /**
   * Extra spacing (in characters) inserted between each glyph.
   * `0` = touching glyphs, `1` = one-space gap, etc. Default `0`.
   *
   * @since 1.2.6
   */
  kerning?: number;
  /**
   * Vertical spacing (blank lines) between rendered lines when `text`
   * contains `\n`. Default `0`.
   *
   * @since 1.2.6
   */
  lineSpacing?: number;
}

export const figletText = (
  text: string,
  font: FigletFont,
  opts: FigletOptions = {},
): string => {
  if (typeof text !== 'string') return '';
  if (!font || !font.glyphs || font.height <= 0) return '';
  const {
    trim = true,
    colorFn = null,
    // v1.2.6
    kerning = 0,
    lineSpacing = 0,
  } = opts;

  const safeKerning = Math.max(0, Math.floor(kerning));
  const safeLineSpacing = Math.max(0, Math.floor(lineSpacing));

  // v1.2.6: Split input on newlines and render each line, then join vertically.
  // Single-line text takes the fast path (no split overhead).
  if (text.includes('\n')) {
    const linesOfText = text.split('\n');
    const renderedBlocks = linesOfText.map((line) =>
      _renderFigletLine(line, font, safeKerning, trim),
    );
    const spacer = safeLineSpacing > 0 ? '\n'.repeat(safeLineSpacing + 1) : '\n';
    let multiResult = renderedBlocks.join(spacer);
    if (colorFn) multiResult = colorFn(multiResult);
    return multiResult;
  }

  // Single-line fast path
  let result = _renderFigletLine(text, font, safeKerning, trim);
  if (colorFn) result = colorFn(result);
  return result;
};

/**
 * Render a single line of text (no `\n`) with a FIGfont. Internal helper.
 */
const _renderFigletLine = (
  text: string,
  font: FigletFont,
  kerning: number,
  trim: boolean,
): string => {
  // For each character, look up its glyph (or space-equivalent)
  const glyphsForText: string[][] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 32;
    const glyph = font.glyphs.get(code);
    if (glyph) {
      glyphsForText.push(glyph);
    } else {
      // Unknown char → use space (32) or empty rows
      const fallback = font.glyphs.get(32);
      glyphsForText.push(fallback ?? new Array<string>(font.height).fill(''));
    }
  }

  // Kerning spacer: a column of pure spaces, repeated `kerning` times
  // and as tall as the font.
  const kerningSpacer = kerning > 0 ? ' '.repeat(kerning) : '';

  // Assemble row by row, replacing hardblank with real spaces
  const hardblankRe = new RegExp(_escapeRe(font.hardblank), 'g');
  const rows: string[] = [];
  for (let r = 0; r < font.height; r++) {
    let row = '';
    for (let i = 0; i < glyphsForText.length; i++) {
      const g = glyphsForText[i] as string[];
      row += (g[r] as string ?? '');
      // Add kerning spacer between glyphs (but not after the last one)
      if (i < glyphsForText.length - 1 && kerningSpacer) {
        row += kerningSpacer;
      }
    }
    row = row.replace(hardblankRe, ' ');
    rows.push(row);
  }

  // Optional trim of blank rows
  if (trim) {
    const trimmed = rows.filter((row) => row.trim().length > 0);
    return trimmed.length > 0 ? trimmed.join('\n') : rows.join('\n');
  }
  return rows.join('\n');
};

const _escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

export const ascii = {
  big,
  small,
  figlet,
  banner,
  box,
  divider,
  logo,
  stream,
  measure,
  // v1.2.5 — Phase 3 closure
  fromImage,
  figletText,
  parseFiglet,
  // Pipeline stages — exposed for custom compositions
  stageRender,
  stageAlign,
  stageColorize,
  // Font registry
  registerFont,
  listFonts,
  hasFont,
  // Cache control
  clearRenderCache,
  getRenderCacheSize,
  boxStyles: Object.keys(BOX_STYLES) as Array<keyof typeof BOX_STYLES>,
};

export default ascii;
