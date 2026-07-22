// ─────────────────────────────────────────────
//  ansimax/ascii — Auto-layout tables
//
//  v1.4.8 — Render 2D data as a box-drawing table with automatic column
//  sizing. Handles ANSI-colored cells (widths measured via visibleLen),
//  per-column alignment, optional header separator, and 6 border styles.
//
//  Column-sizing algorithm:
//   1. Natural width per column = max visibleLen across all cells in it.
//   2. If a `maxWidth` budget is given and the natural table overflows,
//      shrink the widest columns first (water-filling) until it fits,
//      truncating cell text with an ellipsis.
//
//  The water-filling step is the interesting bit: rather than scaling all
//  columns proportionally (which over-shrinks already-narrow columns), we
//  repeatedly trim the single widest column by one until the total fits.
//  This preserves readability of short columns (ids, flags) while only
//  the genuinely wide columns (descriptions) absorb the loss.
// ─────────────────────────────────────────────

import { visibleLen, truncateAnsi, padEnd, wordWrap } from '../utils/helpers.js';

export type TableBorderStyle =
  | 'single' | 'double' | 'rounded' | 'heavy' | 'ascii' | 'none';

/** Full box-drawing set for tables (includes T-junctions + crosses). */
interface TableChars {
  tl: string; tr: string; bl: string; br: string;   // corners
  h: string; v: string;                             // edges
  tDown: string; tUp: string; tLeft: string; tRight: string; // T-junctions
  cross: string;                                    // ┼
}

const TABLE_STYLES: Record<Exclude<TableBorderStyle, 'none'>, TableChars> = {
  single: {
    tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│',
    tDown: '┬', tUp: '┴', tLeft: '┤', tRight: '├', cross: '┼',
  },
  double: {
    tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║',
    tDown: '╦', tUp: '╩', tLeft: '╣', tRight: '╠', cross: '╬',
  },
  rounded: {
    tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│',
    tDown: '┬', tUp: '┴', tLeft: '┤', tRight: '├', cross: '┼',
  },
  heavy: {
    tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃',
    tDown: '┳', tUp: '┻', tLeft: '┫', tRight: '┣', cross: '╋',
  },
  ascii: {
    tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|',
    tDown: '+', tUp: '+', tLeft: '+', tRight: '+', cross: '+',
  },
};

export type TableAlign = 'left' | 'center' | 'right';

export interface TableOptions {
  /** Border style. Default `'single'`. `'none'` draws no borders (space-separated). */
  borderStyle?: TableBorderStyle;
  /** Treat the first row as a header (draws a separator below it). Default `true`. */
  header?: boolean;
  /** Per-column alignment. `align[c]` applies to column c. Default `'left'`. */
  align?: TableAlign[];
  /** Horizontal padding (spaces) inside each cell, both sides. Default `1`. */
  padding?: number;
  /**
   * Optional total width budget. When the natural table is wider, columns
   * are shrunk (widest-first) and cell text truncated with `…` to fit.
   */
  maxWidth?: number | null;
  /**
   * **v1.4.9** — When `true`, cells wider than their column are word-wrapped
   * to multiple lines instead of being truncated with `…`. Rows grow taller
   * to fit their tallest cell. Combines with `maxWidth` (columns are sized
   * first, then long cells wrap within the resulting widths).
   *
   * @since 1.4.9
   */
  wrap?: boolean;
  /**
   * **v1.4.10** — Minimum width (visible chars, excluding padding) for every
   * column. The water-filling shrink will not reduce any column below this,
   * so narrow-but-important columns stay legible even under a tight
   * `maxWidth`. Default `1`.
   *
   * @since 1.4.10
   */
  minColWidth?: number;
}

const _alignCell = (text: string, width: number, align: TableAlign): string => {
  const w = visibleLen(text);
  const space = Math.max(0, width - w);
  if (space === 0) return text;
  if (align === 'right')  return ' '.repeat(space) + text;
  if (align === 'center') {
    const left = Math.floor(space / 2);
    return ' '.repeat(left) + text + ' '.repeat(space - left);
  }
  return padEnd(text, width, ' '); // left (default)
};

/**
 * Compute per-column content widths (excluding padding). Applies the
 * water-filling shrink when a `budget` is provided and the natural table
 * overflows.
 *
 * @param rows      normalized 2D cell matrix (already stringified)
 * @param cols      column count
 * @param padding   per-side padding
 * @param border    whether borders consume width (1 col per separator)
 * @param budget    optional total-width cap
 * @param minCol    minimum per-column content width (never shrink below)
 */
const _computeColumnWidths = (
  rows: string[][],
  cols: number,
  padding: number,
  border: boolean,
  budget: number | null,
  minCol: number,
): number[] => {
  // 1. Natural widths
  const widths = Array<number>(cols).fill(0);
  for (const row of rows) {
    for (let c = 0; c < cols; c++) {
      const cell = row[c] ?? '';
      const w = visibleLen(cell);
      if (w > (widths[c] as number)) widths[c] = w;
    }
  }

  if (budget == null || budget <= 0) return widths;

  // 2. Compute chrome (padding + borders) that is NOT shrinkable
  const cellPad = padding * 2;
  // Borders: cols+1 verticals when bordered, else (cols-1) single spaces
  const chrome = border ? (cols + 1) + cols * cellPad : Math.max(0, cols - 1) + cols * cellPad;
  // Floor the content budget at cols * minCol so no column drops below minCol.
  const contentBudget = Math.max(cols * minCol, budget - chrome);

  // 3. Water-filling shrink: trim the widest column by 1 until we fit.
  let total = widths.reduce((a, b) => a + b, 0);
  let guard = 0;
  const maxIters = total * cols + 1; // generous upper bound
  while (total > contentBudget && guard < maxIters) {
    // Find the widest column (ties → lowest index for determinism)
    let widest = 0;
    for (let c = 1; c < cols; c++) {
      if ((widths[c] as number) > (widths[widest] as number)) widest = c;
    }
    // Never shrink below the minimum column width. Like the previous
    // guard, this is unreachable in practice: contentBudget is floored at
    // cols*minCol, so once every column reaches minCol the total equals
    // contentBudget and the loop condition is already false. Kept as a
    // safety net for future changes to the budget formula.
    /* istanbul ignore next — unreachable: contentBudget >= cols*minCol by construction */
    if ((widths[widest] as number) <= minCol) break;
    widths[widest] = (widths[widest] as number) - 1;
    total--;
    guard++;
  }

  return widths;
};

/**
 * Render a 2D array of data as a box-drawing table with automatic column
 * sizing. Cells may contain ANSI color codes — widths are measured by
 * visible length so alignment stays correct.
 *
 * @example
 * ```js
 * import { ascii } from 'ansimax';
 *
 * console.log(ascii.table([
 *   ['Name', 'Role', 'Commits'],
 *   ['Ada', 'Author', '1200'],
 *   ['Linus', 'Maintainer', '45000'],
 * ], { align: ['left', 'left', 'right'] }));
 * ```
 *
 * @since 1.4.8
 */
export const table = (data: unknown[][], opts: TableOptions = {}): string => {
  if (!Array.isArray(data) || data.length === 0) return '';

  const borderStyle: TableBorderStyle = opts.borderStyle ?? 'single';
  const hasHeader = opts.header !== false;
  const padding = Math.max(0, Math.floor(opts.padding ?? 1));
  const aligns = Array.isArray(opts.align) ? opts.align : [];
  const budget = opts.maxWidth != null ? Math.max(0, Math.floor(opts.maxWidth)) : null;
  const bordered = borderStyle !== 'none';
  const minCol = Math.max(1, Math.floor(opts.minColWidth ?? 1));

  // Normalize rows → string matrix; determine column count from widest row.
  const rows: string[][] = data.map((row) =>
    (Array.isArray(row) ? row : [row]).map((cell) =>
      cell == null ? '' : String(cell)),
  );
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (cols === 0) return '';

  const widths = _computeColumnWidths(rows, cols, padding, bordered, budget, minCol);

  const pad = ' '.repeat(padding);
  const alignOf = (c: number): TableAlign => aligns[c] ?? 'left';
  const doWrap = opts.wrap === true;

  // Render a single data row. Returns one or more visual lines (multiple
  // when wrap is enabled and a cell overflows its column width).
  const renderRow = (row: string[]): string => {
    const S = bordered
      ? TABLE_STYLES[borderStyle as Exclude<TableBorderStyle, 'none'>]
      : null;

    // Compute the wrapped/aligned lines for each cell.
    const cellLines: string[][] = [];
    let rowHeight = 1;
    for (let c = 0; c < cols; c++) {
      const w = widths[c] as number;
      const raw = row[c] ?? '';
      let lines: string[];
      if (doWrap && visibleLen(raw) > w) {
        // Word-wrap to the column width → multiple lines.
        lines = wordWrap(raw, w);
        /* istanbul ignore next — wrapAnsi returns [] only for empty input, already handled above */
        if (lines.length === 0) lines = [''];
      } else if (!doWrap && visibleLen(raw) > w) {
        // Truncate with ellipsis (v1.4.8 behavior).
        lines = [truncateAnsi(raw, w, '…')];
      } else {
        lines = [raw];
      }
      cellLines.push(lines);
      if (lines.length > rowHeight) rowHeight = lines.length;
    }

    // Assemble each visual line of the row, padding shorter cells with blanks.
    const visualLines: string[] = [];
    for (let ln = 0; ln < rowHeight; ln++) {
      const cells: string[] = [];
      for (let c = 0; c < cols; c++) {
        const w = widths[c] as number;
        const cellLine = (cellLines[c] as string[])[ln] ?? '';
        cells.push(pad + _alignCell(cellLine, w, alignOf(c)) + pad);
      }
      visualLines.push(S ? S.v + cells.join(S.v) + S.v : cells.join(' '));
    }
    return visualLines.join('\n');
  };

  // Render a horizontal rule (top / mid / bottom) with proper junctions
  const rule = (kind: 'top' | 'mid' | 'bottom'): string => {
    const S = TABLE_STYLES[borderStyle as Exclude<TableBorderStyle, 'none'>];
    const segs = widths.map((w) => S.h.repeat(w + padding * 2));
    const left  = kind === 'top' ? S.tl : kind === 'bottom' ? S.bl : S.tRight;
    const mid   = kind === 'top' ? S.tDown : kind === 'bottom' ? S.tUp : S.cross;
    const right = kind === 'top' ? S.tr : kind === 'bottom' ? S.br : S.tLeft;
    return left + segs.join(mid) + right;
  };

  const out: string[] = [];
  if (bordered) out.push(rule('top'));

  for (let i = 0; i < rows.length; i++) {
    out.push(renderRow(rows[i] as string[]));
    // Header separator after the first row
    if (bordered && hasHeader && i === 0 && rows.length > 1) {
      out.push(rule('mid'));
    }
  }

  if (bordered) out.push(rule('bottom'));
  return out.join('\n');
};
