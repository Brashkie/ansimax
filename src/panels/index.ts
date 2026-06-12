/**
 * ansimax — panels module
 * ─────────────────────────────────────────────
 *
 * Split layouts for composing terminal UIs: hsplit (top/bottom) and
 * vsplit (left/right). Both operate on already-rendered string blocks
 * (typically from `ascii.box`, `components.table`, etc.) and handle:
 *
 *   • ANSI-aware width measurement
 *   • Variable height (each block keeps its own line count)
 *   • Alignment within columns
 *   • Configurable gap between blocks
 *   • Nesting (panels can contain panels)
 *
 * Philosophy: panels do composition, not styling. Style your blocks
 * first (with `ascii.box`, `components.timeline`, etc.), then compose
 * them with `panels.hsplit` / `panels.vsplit`.
 */

import { visibleLen, padEnd } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type Alignment = 'start' | 'center' | 'end';

export interface VsplitOptions {
  /** Horizontal gap (in space characters) between columns. Default `1`. */
  gap?: number;
  /**
   * Vertical alignment of shorter blocks within the joined column row.
   * `'start'` (default) keeps blocks top-aligned; shorter blocks have
   * padding below. `'center'` centers each block. `'end'` aligns to bottom.
   */
  align?: Alignment;
  /**
   * Pad each block with spaces to a fixed width. Useful for grids where
   * each cell should be the same size regardless of content.
   * If omitted, each column uses its natural max-line width.
   */
  widths?: number[] | null;
}

export interface HsplitOptions {
  /** Vertical gap (in blank lines) between rows. Default `0`. */
  gap?: number;
  /**
   * Horizontal alignment of narrower blocks within the joined width.
   * `'start'` (default) keeps blocks left-aligned. `'center'` and `'end'`
   * pad with spaces on the appropriate side.
   */
  align?: Alignment;
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

/**
 * Split a multi-line block into lines, preserving ANSI escapes per line.
 * Returns the lines + the max visible width of any line.
 */
const _splitBlock = (block: string): { lines: string[]; maxWidth: number } => {
  if (typeof block !== 'string' || block.length === 0) {
    return { lines: [''], maxWidth: 0 };
  }
  const lines = block.split('\n');
  let maxWidth = 0;
  for (const line of lines) {
    const w = visibleLen(line);
    if (w > maxWidth) maxWidth = w;
  }
  return { lines, maxWidth };
};

/**
 * Pad each line of a block to a fixed width on the right.
 * ANSI escapes are preserved; padding is added as raw spaces.
 */
const _padLinesRight = (lines: string[], targetWidth: number): string[] => {
  return lines.map((line) => padEnd(line, targetWidth, ' '));
};

/**
 * Pad each line of a block to a fixed width with alignment.
 */
const _padLinesAligned = (
  lines: string[],
  targetWidth: number,
  align: Alignment,
): string[] => {
  return lines.map((line) => {
    const w = visibleLen(line);
    const space = Math.max(0, targetWidth - w);
    if (space === 0) return line;
    if (align === 'end')    return ' '.repeat(space) + line;
    if (align === 'center') {
      const left  = Math.floor(space / 2);
      const right = space - left;
      return ' '.repeat(left) + line + ' '.repeat(right);
    }
    return line + ' '.repeat(space); // 'start' (default)
  });
};

/**
 * Vertically align a block of lines to a fixed line count by padding
 * with empty lines above/below according to the alignment.
 */
const _alignVertical = (
  lines: string[],
  targetLines: number,
  width: number,
  align: Alignment,
): string[] => {
  const current = lines.length;
  if (current >= targetLines) return lines.slice(0, targetLines);
  const diff = targetLines - current;
  const empty = ' '.repeat(width);

  if (align === 'end') {
    return [...Array(diff).fill(empty), ...lines];
  }
  if (align === 'center') {
    const above = Math.floor(diff / 2);
    const below = diff - above;
    return [...Array(above).fill(empty), ...lines, ...Array(below).fill(empty)];
  }
  // 'start' (default)
  return [...lines, ...Array(diff).fill(empty)];
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

/**
 * Split blocks side-by-side (left / right / right ...).
 *
 * Each block is split into lines, then joined column-by-column with a
 * configurable gap. Shorter blocks are padded to match the tallest one.
 *
 * @param blocks - Pre-rendered string blocks (multi-line OK).
 * @param opts   - Layout options.
 *
 * @example basic two-column layout
 * ```js
 * import { panels, ascii } from 'ansimax';
 *
 * console.log(panels.vsplit([
 *   ascii.box('Left side',  { borderStyle: 'rounded' }),
 *   ascii.box('Right side', { borderStyle: 'rounded' }),
 * ], { gap: 2 }));
 * ```
 *
 * @example three columns with centered vertical alignment
 * ```js
 * console.log(panels.vsplit([
 *   'Short',
 *   'A\nMedium\nblock',
 *   'A\nlonger\nblock\nwith\nfive lines',
 * ], { align: 'center', gap: 4 }));
 * ```
 *
 * @example fixed column widths (grid-like)
 * ```js
 * console.log(panels.vsplit([col1, col2, col3], {
 *   widths: [20, 30, 20],
 *   gap: 2,
 * }));
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
 * Each block is concatenated with `\n` between them. With `gap > 0`,
 * additional blank lines are inserted between blocks.
 *
 * @param blocks - Pre-rendered string blocks (multi-line OK).
 * @param opts   - Layout options.
 *
 * @example basic stacking
 * ```js
 * import { panels, ascii } from 'ansimax';
 *
 * console.log(panels.hsplit([
 *   '── Header ──',
 *   ascii.box('Body content', { borderStyle: 'rounded' }),
 *   '── Footer ──',
 * ]));
 * ```
 *
 * @example with vertical gap + centered alignment
 * ```js
 * console.log(panels.hsplit([
 *   'Top',
 *   ascii.box('Middle'),
 *   'Bottom',
 * ], { gap: 1, align: 'center' }));
 * ```
 *
 * @example nested (an hsplit inside a vsplit)
 * ```js
 * const sidebar = ascii.box('Sidebar', { width: 20 });
 * const main    = ascii.box('Main content area', { width: 40 });
 *
 * console.log(panels.hsplit([
 *   '── Application ──',
 *   panels.vsplit([sidebar, main], { gap: 2 }),
 *   '── End ──',
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

  // 3. Align each block's lines to maxWidth (or leave as-is for 'start' with no padding)
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

// ─────────────────────────────────────────────
//  Namespace
// ─────────────────────────────────────────────

export const panels = {
  vsplit,
  hsplit,
};

export default panels;
