// ─────────────────────────────────────────────
//  ansimax/ascii — Public render API + banner pipeline
//
//  v1.4.10 — Split out from index.ts. High-level text rendering: big/
//  small/figlet plus the composable banner pipeline (stageRender →
//  stageAlign → stageColorize).
// ─────────────────────────────────────────────

import { center, termSize } from '../utils/helpers.js';
import { type ColorFn } from '../colors/index.js';
import { BLOCK, SMALL, FONTS, renderFont, ensureString, type RenderOptions } from './fonts.js';
import type { BannerOptions, FontName } from './types.js';

export const big = (text: string): string => {
  const safe = ensureString(text, 'big(text)');
  return renderFont(safe, BLOCK, { _fontKey: 'big' });
};

export const small = (text: string): string => {
  const safe = ensureString(text, 'small(text)');
  return renderFont(safe, SMALL, { _fontKey: 'small' });
};

/**
 * Render text in any registered font. Defaults to 'big'.
 * Accepts custom fonts registered via registerFont().
 */
export const figlet = (
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

/** Stage 1: render text in a font. */
export const stageRender = (
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
export const stageAlign = (rendered: string, align: 'left' | 'center'): string => {
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
export const stageColorize = (
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

export const banner = (text: string, opts: BannerOptions = {}): string => {
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
