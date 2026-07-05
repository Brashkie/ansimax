// ─────────────────────────────────────────────
//  ansimax/panels — center + frame
//
//  v1.4.5 — Split out from index.ts.
//
//  Single-block layout primitives:
//   • center: horizontal (and optional vertical) centering
//   • frame:  add top/bottom rules with optional title
// ─────────────────────────────────────────────

import { visibleLen } from '../utils/helpers.js';
import type { CenterOptions, FrameOptions } from './types.js';
import { _splitBlock, _alignVertical } from './helpers.js';

/**
 * Center a multi-line block horizontally (and optionally vertically)
 * within a given width/height.
 *
 * @example
 * ```js
 * import { panels } from 'ansimax';
 *
 * console.log(panels.center('Hello!', { width: 30 }));
 * ```
 */
export const center = (block: string, opts: CenterOptions): string => {
  if (!opts || typeof opts !== 'object') return block;
  const width = Math.max(0, Math.floor(opts.width ?? 0));
  if (width === 0) return block;

  const { lines, maxWidth } = _splitBlock(block);

  // Horizontal centering — pad each line to `width` with equal sides
  const hCentered = lines.map((line) => {
    const w = visibleLen(line);
    const space = Math.max(0, width - w);
    if (space === 0) return line.slice(0, width);
    const left = Math.floor(space / 2);
    const right = space - left;
    return ' '.repeat(left) + line + ' '.repeat(right);
  });

  if (opts.height != null) {
    const targetH = Math.max(1, Math.floor(opts.height));
    return _alignVertical(hCentered, targetH, width, opts.align ?? 'center').join('\n');
  }

  void maxWidth;
  return hCentered.join('\n');
};

/**
 * Add decorative top/bottom rule lines around a block.
 *
 * @example
 * ```js
 * console.log(panels.frame('Hello world!'));
 * ```
 */
export const frame = (block: string, opts: FrameOptions = {}): string => {
  const {
    padding = 0,
    paddingY,
    paddingX,
    topChar = '─',
    bottomChar,
    title,
    titleAlign = 'center',
  } = opts;

  const safePadY = Math.max(0, Math.floor(paddingY ?? padding));
  const safePadX = Math.max(0, Math.floor(paddingX ?? padding));
  const safeTop = (typeof topChar === 'string' && topChar.length > 0) ? topChar.charAt(0) : '─';
  const safeBot = (typeof bottomChar === 'string' && bottomChar.length > 0)
    ? bottomChar.charAt(0)
    : safeTop;

  const { lines, maxWidth } = _splitBlock(block);
  const contentInnerW = maxWidth + 2 * safePadX;
  let innerW = contentInnerW;
  let titleStr = '';
  let titleW = 0;
  if (typeof title === 'string' && title.length > 0) {
    titleStr = ` ${title} `;
    titleW = visibleLen(titleStr);
    const titleNeededW = titleW + 2;
    if (titleNeededW > innerW) {
      innerW = titleNeededW;
    }
  }

  let topLine: string;
  if (titleStr.length > 0 && titleW < innerW) {
    let before: number;
    let after: number;
    if (titleAlign === 'left') {
      before = 1;
      after = innerW - titleW - before;
    } else if (titleAlign === 'right') {
      after = 1;
      before = innerW - titleW - after;
    } else {
      before = Math.floor((innerW - titleW) / 2);
      after = innerW - titleW - before;
    }
    topLine = safeTop.repeat(before) + titleStr + safeTop.repeat(after);
  } else {
    topLine = safeTop.repeat(innerW);
  }
  const bottomLine = safeBot.repeat(innerW);

  const padX = ' '.repeat(safePadX);
  const padded = lines.map((line) => {
    const w = visibleLen(line);
    const tail = ' '.repeat(Math.max(0, innerW - safePadX - w - safePadX));
    return padX + line + tail + padX;
  });

  const blank = ' '.repeat(innerW);
  const out: string[] = [];
  out.push(topLine);
  for (let i = 0; i < safePadY; i++) out.push(blank);
  out.push(...padded);
  for (let i = 0; i < safePadY; i++) out.push(blank);
  out.push(bottomLine);

  return out.join('\n');
};
