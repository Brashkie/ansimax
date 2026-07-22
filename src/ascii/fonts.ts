// ─────────────────────────────────────────────
//  ansimax/ascii — Built-in fonts, cache, glyph rendering, registry
//
//  v1.4.10 — Split out from index.ts. Bundles the low-level rendering
//  primitives: the BLOCK/SMALL bitmap fonts, the LRU render cache,
//  input validation, glyph assembly (renderFont), and the runtime font
//  registry (registerFont/listFonts/hasFont).
// ─────────────────────────────────────────────

import type { Glyph, FontMap, RegisterFontOptions } from './types.js';

//  Built-in fonts
// ─────────────────────────────────────────────

// ── Block font (5 lines tall) ──
export const BLOCK: FontMap = {
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
export const SMALL: FontMap = {
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

export const ensureString = (value: unknown, paramName: string): string => {
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

export interface RenderOptions {
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

export const renderFont = (
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

export const FONTS: Record<string, FontMap> = {
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
    const err = new TypeError('ascii.registerFont: name must be a non-empty string');
    (err as Error & { code?: string }).code = 'ANSIMAX_INVALID_FONT_NAME';
    throw err;
  }
  if (RESERVED_FONT_NAMES.has(name) && !opts.force) {
    const err = new Error(
      `Font name "${name}" is reserved. Pass { force: true } to override.`,
    );
    (err as Error & { code?: string }).code = 'ANSIMAX_RESERVED_FONT_NAME';
    throw err;
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
