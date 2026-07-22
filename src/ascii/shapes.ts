// ─────────────────────────────────────────────
//  ansimax/ascii — Box, divider, logo, measure
//
//  v1.4.10 — Split out from index.ts. Framing primitives that wrap
//  rendered text in Unicode/ASCII borders, plus the measure() helper.
// ─────────────────────────────────────────────

import { termSize, center, visibleLen, truncateAnsi, padEnd } from '../utils/helpers.js';
import { ensureString } from './fonts.js';
import { big, stageRender } from './render.js';
import type { BoxStyle, BoxOptions, DividerOptions, LogoOptions, Dimensions, FontName } from './types.js';

// ── Box-drawing character sets ──
interface BoxChars { tl: string; tr: string; bl: string; br: string; h: string; v: string }

const BOX_STYLES: Record<BoxStyle, BoxChars> = {
  single:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double:  { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  heavy:   { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  dashed:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '╌', v: '╎' },
  ascii:   { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
};

export const boxStyleNames = Object.keys(BOX_STYLES) as Array<keyof typeof BOX_STYLES>;

// ─────────────────────────────────────────────
//  Box / divider / logo
// ─────────────────────────────────────────────

/**
 * Wrap text in a Unicode box border. ANSI escapes inside the text are
 * preserved (the border is drawn around colored content correctly).
 *
 * @param text - Text to wrap. Multi-line text (containing `\n`) is supported.
 * @param opts - Optional configuration.
 *
 * @example basic single border
 * ```js
 * console.log(ascii.box('Hello!'));
 * ```
 *
 * @example multi-line with rounded border + padding
 * ```js
 * console.log(ascii.box('Title\n\nBody text here.', {
 *   padding: 2,
 *   borderStyle: 'rounded',
 * }));
 * ```
 *
 * @example fixed width (text gets truncated/wrapped to fit)
 * ```js
 * console.log(ascii.box('Very long line of text that will be cut off', {
 *   width: 30,
 *   borderStyle: 'double',
 * }));
 * ```
 *
 * @example with colored content (border stays uncolored)
 * ```js
 * import { gradient } from 'ansimax';
 *
 * const colored = gradient('Rainbow text', ['#ff0000', '#0000ff']);
 * console.log(ascii.box(colored, { borderStyle: 'heavy' }));
 * ```
 *
 * Available `borderStyle` values: `'single'`, `'double'`, `'rounded'` (default),
 * `'heavy'`, `'dashed'`, `'ascii'`.
 */
export const box = (text: string, opts: BoxOptions = {}): string => {
  const safe = ensureString(text, 'box(text)');
  const {
    padding = 1,
    borderStyle = 'rounded',
    width = null,
    title = null,            // v1.3.3
    titleAlign = 'center',   // v1.3.3
  } = opts;
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
  const contentW = inner.length > 0
    ? Math.max(0, ...inner.map((l) => visibleLen(l)))
    : 0;

  // v1.3.3 — title may force the box wider if it doesn't fit
  let w = contentW;
  let titleStr = '';
  let titleW = 0;
  if (typeof title === 'string' && title.length > 0) {
    titleStr = ` ${title} `;
    titleW = visibleLen(titleStr);
    // Reserve 2 chars of border decoration on each side of the title
    const titleNeeded = titleW + 2;
    const innerNeeded = w + safePadding * 2;
    if (titleNeeded > innerNeeded) {
      // Expand inner content width so title fits with 2 chars of decoration
      w = titleNeeded - safePadding * 2;
    }
  }

  const innerW = w + safePadding * 2;
  const pad = ' '.repeat(safePadding);

  // Build top line — with optional aligned title
  let top: string;
  if (titleStr.length > 0 && titleW < innerW) {
    let before: number;
    let after: number;
    if (titleAlign === 'left') {
      // Tiny padding on the left so title doesn't touch the corner
      before = 1;
      after = innerW - titleW - before;
    } else if (titleAlign === 'right') {
      after = 1;
      before = innerW - titleW - after;
    } else {
      // center (default)
      before = Math.floor((innerW - titleW) / 2);
      after = innerW - titleW - before;
    }
    top = b.tl + b.h.repeat(before) + titleStr + b.h.repeat(after) + b.tr;
  } else {
    top = b.tl + b.h.repeat(innerW) + b.tr;
  }

  const bottom = b.bl + b.h.repeat(innerW) + b.br;
  const emptyRow = b.v + ' '.repeat(innerW) + b.v;
  const rows = inner.map((l) => b.v + pad + padEnd(l, w) + pad + b.v);
  const vPad = Array(safePadding).fill(emptyRow) as string[];

  return [top, ...vPad, ...rows, ...vPad, bottom].join('\n');
};

export const divider = (opts: DividerOptions = {}): string => {
  const { char, width = null, label = null, style = 'single', align = 'center' } = opts;
  const { cols } = termSize();
  const w = Math.max(0, width ?? cols);
  const b = BOX_STYLES[style] ?? BOX_STYLES.single;
  const fill = char ?? b.h;

  if (w === 0) return '';

  if (label) {
    const labelLen = visibleLen(label);
    // Label too wide for the divider — show label alone (no fill)
    if (labelLen >= w - 2) return label;
    // v1.3.3 — alignment for label
    let side: number;
    let trailLen: number;
    if (align === 'left') {
      side = 1;
      trailLen = Math.max(0, w - labelLen - side - 2);
    } else if (align === 'right') {
      trailLen = 1;
      side = Math.max(0, w - labelLen - trailLen - 2);
    } else {
      // center (default)
      side = Math.max(0, Math.floor((w - labelLen - 2) / 2));
      trailLen = Math.max(0, w - side - labelLen - 2);
    }
    return fill.repeat(side) + ' ' + label + ' ' + fill.repeat(trailLen);
  }
  return fill.repeat(w);
};

export const logo = (text: string, opts: LogoOptions = {}): string => {
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

export const measure = (
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
