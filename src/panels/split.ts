// ─────────────────────────────────────────────
//  ansimax/panels — vsplit + hsplit
//
//  v1.4.5 — Split out from index.ts.
//
//  Two-way composition primitives:
//   • vsplit: place blocks side-by-side (columns)
//   • hsplit: stack blocks top-to-bottom (rows)
// ─────────────────────────────────────────────

import type { VsplitOptions, HsplitOptions } from './types.js';
import {
  _splitBlock,
  _padLinesRight,
  _padLinesAligned,
  _alignVertical,
} from './helpers.js';

/**
 * Place blocks side-by-side (columns).
 *
 * @example
 * ```js
 * import { panels, ascii } from 'ansimax';
 *
 * console.log(panels.vsplit([
 *   ascii.box('Left', { borderStyle: 'rounded' }),
 *   ascii.box('Right', { borderStyle: 'double' }),
 * ], { gap: 2 }));
 * ```
 */
export const vsplit = (blocks: string[], opts: VsplitOptions = {}): string => {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  const { gap = 1, align = 'start', widths = null } = opts;
  const safeGap = Math.max(0, Math.floor(gap));

  // 1. Split each block + measure
  const splits = blocks.map((b) => _splitBlock(b));

  // 2. Determine each column's target width
  const colWidths = splits.map((s, i) => {
    if (widths && Array.isArray(widths) && widths[i] != null) {
      return Math.max(0, Math.floor(widths[i] as number));
    }
    return s.maxWidth;
  });

  // 3. Determine target line count (max across blocks)
  const targetLines = splits.reduce((m, s) => Math.max(m, s.lines.length), 0);

  // 4. Normalize each block: pad lines to its column width, align vertically
  const normalized = splits.map((s, i) => {
    const w = colWidths[i] as number;
    // First pad horizontally so each line is exactly w wide
    const padded = _padLinesRight(s.lines, w);
    // Then ensure block has exactly targetLines rows
    return _alignVertical(padded, targetLines, w, align);
  });

  // 5. Join columns row-by-row
  const gapStr = ' '.repeat(safeGap);
  const result: string[] = [];
  for (let r = 0; r < targetLines; r++) {
    const row = normalized.map((block) => block[r] ?? '').join(gapStr);
    result.push(row);
  }
  return result.join('\n');
};

/**
 * Stack blocks vertically (top / bottom / bottom ...).
 *
 * @example
 * ```js
 * import { panels, ascii } from 'ansimax';
 *
 * console.log(panels.hsplit([
 *   '── Header ──',
 *   ascii.box('Body content', { borderStyle: 'rounded' }),
 *   '── Footer ──',
 * ]));
 * ```
 */
export const hsplit = (blocks: string[], opts: HsplitOptions = {}): string => {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  const { gap = 0, align = 'start' } = opts;
  const safeGap = Math.max(0, Math.floor(gap));

  // 1. Split each block
  const splits = blocks.map((b) => _splitBlock(b));

  // 2. Find the max width across all blocks
  const maxWidth = splits.reduce((m, s) => Math.max(m, s.maxWidth), 0);

  // 3. Align each block's lines to maxWidth
  const aligned = splits.map((s) => _padLinesAligned(s.lines, maxWidth, align));

  // 4. Join blocks with vertical gap
  const gapLines = safeGap > 0 ? Array<string>(safeGap).fill(' '.repeat(maxWidth)) : [];
  const parts: string[] = [];
  for (let i = 0; i < aligned.length; i++) {
    parts.push(...(aligned[i] as string[]));
    if (i < aligned.length - 1 && gapLines.length > 0) {
      parts.push(...gapLines);
    }
  }
  return parts.join('\n');
};
