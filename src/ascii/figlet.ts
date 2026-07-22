// ─────────────────────────────────────────────
//  ansimax/ascii — Figlet (.flf) parser + renderer
//
//  v1.4.10 — Split out from index.ts. Parses FIGfont .flf files and
//  renders text using their glyphs (kerning, hardblank, trim).
// ─────────────────────────────────────────────

import type { FigletFont, FigletOptions } from './types.js';

export const parseFiglet = (flfContent: string): FigletFont => {
  if (typeof flfContent !== 'string' || flfContent.length === 0) {
    const err = new TypeError('parseFiglet: input must be a non-empty string');
    (err as Error & { code?: string }).code = 'ANSIMAX_INVALID_FIGLET_INPUT';
    throw err;
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
    // v1.2.7: include a snippet of what we saw to help debugging
    const snippet = header.length > 60 ? header.slice(0, 60) + '…' : header;
    const err = new TypeError(
      `parseFiglet: invalid FIGfont header. Expected "flf2a$..." prefix, got: "${snippet}"`,
    );
    (err as Error & { code?: string }).code = 'ANSIMAX_INVALID_FIGLET_HEADER';
    throw err;
  }
  const hardblank   = m[1] as string;
  const height      = parseInt(m[2] as string, 10);
  const commentLines = parseInt(m[6] as string, 10);

  if (!Number.isFinite(height) || height <= 0) {
    const err = new TypeError(`parseFiglet: invalid height ${m[2]} (must be positive integer)`);
    (err as Error & { code?: string }).code = 'ANSIMAX_INVALID_FIGLET_HEIGHT';
    throw err;
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
export const figletText = (
  text: string,
  font: FigletFont,
  opts: FigletOptions = {},
): string => {
  if (typeof text !== 'string') return '';
  // v1.2.7: empty text → empty output (was producing height-1 empty rows)
  if (text.length === 0) return '';
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
    /* istanbul ignore next — `?? 32` unreachable: for-of yields valid chars, codePointAt(0) is defined */
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
      /* istanbul ignore next — `?? ''` unreachable: well-formed glyphs have font.height rows */
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
