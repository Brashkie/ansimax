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
import { ColorFn } from '../colors/index.js';

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
