// ─────────────────────────────────────────────
//  ansimax/panels — Wrapping block flow
//
//  v1.4.8 — Flow a sequence of blocks left-to-right, wrapping to a new
//  row whenever the next block would overflow `maxWidth` (like inline-block
//  elements or a flex-wrap container).
//
//  Greedy bin-packing: each block is placed on the current row if it fits
//  (accounting for the inter-block gap); otherwise a new row is started.
//  This is the classic first-fit line-breaking algorithm — O(n) and
//  produces the same row breaks a browser would for `flex-wrap: wrap`.
//
//  Each completed row is joined with `vsplit` (side-by-side) and the rows
//  are stacked with `hsplit` (vertical), so alignment + ANSI handling are
//  inherited from those primitives rather than re-implemented.
// ─────────────────────────────────────────────

import type { Alignment } from './types.js';
import { _splitBlock } from './helpers.js';
import { vsplit, hsplit } from './split.js';

export interface WrapOptions {
  /** Maximum row width in columns before wrapping. Required. */
  maxWidth: number;
  /** Horizontal gap between blocks in a row. Default `1`. */
  gapX?: number;
  /** Vertical gap between rows. Default `0`. */
  gapY?: number;
  /**
   * Vertical alignment of shorter blocks within a row (passed to vsplit).
   * Default `'start'`.
   */
  align?: Alignment;
  /**
   * Horizontal alignment of shorter rows within the final block width
   * (passed to hsplit). Default `'start'`.
   */
  rowAlign?: Alignment;
}

/**
 * Group blocks into rows using greedy first-fit, respecting `maxWidth`
 * and the inter-block gap. Returns an array of rows (each an array of
 * block strings). A block wider than `maxWidth` on its own still gets its
 * own row (it can't be split).
 */
export const _packRows = (
  blocks: string[],
  widths: number[],
  maxWidth: number,
  gapX: number,
): string[][] => {
  const rows: string[][] = [];
  let current: string[] = [];
  let used = 0;

  for (let i = 0; i < blocks.length; i++) {
    const w = widths[i] as number;
    const gap = current.length > 0 ? gapX : 0;
    if (current.length > 0 && used + gap + w > maxWidth) {
      // Doesn't fit — flush the current row and start a new one.
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(blocks[i] as string);
    used += (current.length > 1 ? gapX : 0) + w;
  }
  if (current.length > 0) rows.push(current);
  return rows;
};

/**
 * Flow blocks into multiple rows, wrapping when they exceed `maxWidth`.
 *
 * @example
 * ```js
 * import { panels, ascii } from 'ansimax';
 *
 * const cards = ['A', 'B', 'C', 'D', 'E'].map((c) =>
 *   ascii.box(c, { borderStyle: 'rounded', padding: 1 }));
 *
 * // Fit as many cards per row as 40 columns allow, then wrap.
 * console.log(panels.wrap(cards, { maxWidth: 40, gapX: 2, gapY: 1 }));
 * ```
 *
 * @since 1.4.8
 */
export const wrap = (blocks: string[], opts: WrapOptions): string => {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  if (!opts || typeof opts !== 'object') return '';

  const maxWidth = Math.max(1, Math.floor(opts.maxWidth ?? 1));
  const gapX = Math.max(0, Math.floor(opts.gapX ?? 1));
  const gapY = Math.max(0, Math.floor(opts.gapY ?? 0));
  const align: Alignment = opts.align ?? 'start';
  const rowAlign: Alignment = opts.rowAlign ?? 'start';

  // Measure each block once.
  const widths = blocks.map((b) => _splitBlock(b).maxWidth);

  // Greedy pack into rows.
  const rows = _packRows(blocks, widths, maxWidth, gapX);

  // Render each row side-by-side, then stack.
  const rendered = rows.map((row) => vsplit(row, { gap: gapX, align }));
  return hsplit(rendered, { gap: gapY, align: rowAlign });
};
