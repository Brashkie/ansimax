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
//  v1.3.1 — Additional layout helpers
// ─────────────────────────────────────────────

export interface CenterOptions {
  /** Total width to center within. Required. */
  width: number;
  /**
   * Vertical alignment if `height` is also specified.
   * Default `'start'`.
   */
  align?: Alignment;
  /**
   * Total height to fit the block into. Optional — if omitted, only
   * horizontal centering is applied.
   */
  height?: number;
}

/**
 * Center a multi-line block horizontally (and optionally vertically)
 * within a given width/height. Each line is padded with spaces on both
 * sides; ANSI escapes are preserved.
 *
 * @example horizontal centering only
 * ```js
 * import { panels } from 'ansimax';
 *
 * console.log(panels.center('Hello!', { width: 30 }));
 * //                "            Hello!            "
 * ```
 *
 * @example multi-line centered in a fixed area
 * ```js
 * console.log(panels.center('Line 1\nLine 2\nLine 3', {
 *   width: 30,
 *   height: 7,
 *   align: 'center',
 * }));
 * ```
 *
 * @example combined with box for a centered card
 * ```js
 * import { ascii, panels } from 'ansimax';
 *
 * console.log(panels.center(ascii.box('Hello'), { width: 80 }));
 * // Box appears centered in a 80-wide terminal
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
    if (space === 0) return line.slice(0, width); // Already too wide — just emit as-is
    const left = Math.floor(space / 2);
    const right = space - left;
    return ' '.repeat(left) + line + ' '.repeat(right);
  });

  // Vertical centering — only if height is provided
  if (opts.height != null) {
    const targetH = Math.max(1, Math.floor(opts.height));
    return _alignVertical(hCentered, targetH, width, opts.align ?? 'center').join('\n');
  }

  // Silence unused-var lint when only h-centering
  void maxWidth;
  return hCentered.join('\n');
};

export interface FrameOptions {
  /**
   * Padding (in spaces) between the block content and the inner edge of
   * the frame. Default `0`.
   */
  padding?: number;
  /**
   * Padding above + below the block. If unset, falls back to `padding`.
   */
  paddingY?: number;
  /**
   * Padding left + right of the block. If unset, falls back to `padding`.
   */
  paddingX?: number;
  /**
   * Top decoration character — e.g. `'─'`, `'═'`, `'━'`, `'·'`.
   * Default `'─'`.
   */
  topChar?: string;
  /**
   * Bottom decoration character. Default same as `topChar`.
   */
  bottomChar?: string;
  /**
   * Optional title shown in the top edge.
   */
  title?: string;
  /**
   * Title alignment: `'left'` | `'center'` (default) | `'right'`.
   * Only applies when `title` is set.
   *
   * @since 1.3.3
   */
  titleAlign?: 'left' | 'center' | 'right';
}

/**
 * Add decorative top/bottom rule lines around a block (lighter than `ascii.box`
 * which draws four sides). Useful for visual separation without full borders.
 *
 * @example simple top/bottom rules
 * ```js
 * console.log(panels.frame('Hello world!'));
 * // ─────────────
 * // Hello world!
 * // ─────────────
 * ```
 *
 * @example with title and padding
 * ```js
 * console.log(panels.frame('Body content\nMore content', {
 *   title: 'Header',
 *   padding: 1,
 * }));
 * // ───── Header ─────
 * //
 * //  Body content
 * //  More content
 * //
 * // ──────────────────
 * ```
 *
 * @example custom decorations
 * ```js
 * console.log(panels.frame('Important!', {
 *   topChar: '═',
 *   bottomChar: '═',
 *   padding: 2,
 * }));
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
    titleAlign = 'center',   // v1.3.3
  } = opts;

  const safePadY = Math.max(0, Math.floor(paddingY ?? padding));
  const safePadX = Math.max(0, Math.floor(paddingX ?? padding));
  const safeTop = (typeof topChar === 'string' && topChar.length > 0) ? topChar.charAt(0) : '─';
  const safeBot = (typeof bottomChar === 'string' && bottomChar.length > 0)
    ? bottomChar.charAt(0)
    : safeTop;

  const { lines, maxWidth } = _splitBlock(block);
  // Calculate inner width — must accommodate content + padding, AND title if present.
  // When title is wider than content, the frame expands to fit the title;
  // content lines get extra right-padding to align.
  const contentInnerW = maxWidth + 2 * safePadX;
  let innerW = contentInnerW;
  let titleStr = '';
  let titleW = 0;
  if (typeof title === 'string' && title.length > 0) {
    titleStr = ` ${title} `;
    titleW = visibleLen(titleStr);
    // Reserve at least 2 chars of decoration on each side of the title
    const titleNeededW = titleW + 2;
    if (titleNeededW > innerW) {
      innerW = titleNeededW;
    }
  }

  // Build top line — with optional aligned title (v1.3.3)
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
      // center (default)
      before = Math.floor((innerW - titleW) / 2);
      after = innerW - titleW - before;
    }
    topLine = safeTop.repeat(before) + titleStr + safeTop.repeat(after);
  } else {
    topLine = safeTop.repeat(innerW);
  }
  const bottomLine = safeBot.repeat(innerW);

  // Horizontal padding for each content line.
  // Pad each line to innerW so they align with the (possibly wider) frame.
  const padX = ' '.repeat(safePadX);
  const padded = lines.map((line) => {
    const w = visibleLen(line);
    // Right-pad so content reaches innerW (which may exceed maxWidth + 2*padX)
    const tail = ' '.repeat(Math.max(0, innerW - safePadX - w - safePadX));
    return padX + line + tail + padX;
  });

  // Vertical padding (blank lines above/below)
  const blank = ' '.repeat(innerW);
  const out: string[] = [];
  out.push(topLine);
  for (let i = 0; i < safePadY; i++) out.push(blank);
  out.push(...padded);
  for (let i = 0; i < safePadY; i++) out.push(blank);
  out.push(bottomLine);

  return out.join('\n');
};

// ─────────────────────────────────────────────
//  v1.3.3 — grid: N-column auto-flow layout
// ─────────────────────────────────────────────

export interface GridOptions {
  /** Number of columns. Required. */
  columns: number;
  /** Horizontal gap between cells. Default `1`. */
  gapX?: number;
  /** Vertical gap between rows. Default `0`. */
  gapY?: number;
  /** Horizontal alignment of content within each cell. Default `'start'`. */
  alignX?: Alignment;
  /** Vertical alignment of content within each cell. Default `'start'`. */
  alignY?: Alignment;
  /**
   * Fix each cell to this width (in visible characters). If omitted, cells
   * use the max width of the widest block in their column.
   */
  cellWidth?: number | null;
  /**
   * **v1.4.1+** Fix each row to this height (in lines). When the block has
   * fewer lines, it is padded (using `alignY`). When it has more lines, it
   * is truncated. If omitted (default), rows take the natural height of
   * their tallest block.
   *
   * @since 1.4.1
   */
  cellHeight?: number | null;
  /**
   * **v1.4.1+** Per-block column span. `colSpan[i]` is the number of
   * columns block `i` occupies. Defaults to `1` for every block when
   * omitted or shorter than `blocks`.
   *
   * The auto-flow algorithm wraps to the next row when the current row's
   * remaining capacity is less than the next block's span. Spans that
   * exceed `columns` are clamped to `columns`.
   *
   * @example
   * ```js
   * // Header spans full width, then 2 cells in a row
   * panels.grid([header, left, right], {
   *   columns: 2,
   *   colSpan: [2, 1, 1],
   * });
   * ```
   *
   * @since 1.4.1
   */
  colSpan?: number[];
  /**
   * **v1.4.3+** Per-block row span. `rowSpan[i]` is the number of rows
   * block `i` occupies. Combined with `colSpan`, this enables full CSS
   * Grid-style layouts using the mark-and-pack algorithm:
   *
   *   1. A 2D occupancy matrix tracks claimed cells
   *   2. For each block, find the first free `(row, col)` where its
   *      `colSpan × rowSpan` rectangle fits
   *   3. Mark those cells occupied
   *   4. After all blocks are placed, emit rows top-to-bottom
   *
   * Forces `flow: 'row'` (column flow + rowSpan needs deferred logic).
   * Spans that don't fit anywhere are placed in their own row.
   *
   * @example
   * ```js
   * // Sidebar spans 2 rows, content area is 2×2
   * panels.grid([sidebar, top, footer, top2, footer2], {
   *   columns: 3,
   *   colSpan: [1, 2, 2, 1, 1],
   *   rowSpan: [2, 1, 1, 1, 1],
   * });
   * ```
   *
   * @since 1.4.3
   */
  rowSpan?: number[];
  /**
   * **v1.4.1+** Auto-flow direction. `'row'` (default) fills cells
   * left-to-right then wraps to the next row — matches CSS Grid's
   * `grid-auto-flow: row`. `'column'` fills top-to-bottom then wraps to
   * the next column. Not applicable when `colSpan` or `rowSpan` contain
   * values > 1 (forces 'row' mode).
   *
   * @since 1.4.1
   */
  flow?: 'row' | 'column';
}

/**
 * Arrange blocks in a grid of N columns, flowing left-to-right then
 * top-to-bottom. Each row is auto-sized to its tallest block, and each
 * column is auto-sized to its widest block (unless `cellWidth` is fixed).
 *
 * Internally uses `vsplit` for rows + `hsplit` for the column stack, so
 * all alignment + ANSI rules behave consistently.
 *
 * @param blocks - Pre-rendered string blocks. Flows in reading order.
 * @param opts   - Grid configuration. `columns` is required.
 *
 * @example 2×2 grid of stats cards
 * ```js
 * import { panels, ascii } from 'ansimax';
 *
 * const cards = [
 *   ascii.box('FILES\n42',   { borderStyle: 'rounded', padding: 1 }),
 *   ascii.box('LINES\n1247', { borderStyle: 'rounded', padding: 1 }),
 *   ascii.box('TESTS\n38',   { borderStyle: 'rounded', padding: 1 }),
 *   ascii.box('COV\n98%',    { borderStyle: 'rounded', padding: 1 }),
 * ];
 *
 * console.log(panels.grid(cards, { columns: 2, gapX: 2, gapY: 1 }));
 * ```
 *
 * @example 3-column gallery with auto-flow
 * ```js
 * // 7 items in 3 columns → 3 rows: [3, 3, 1]
 * const items = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];
 * console.log(panels.grid(items, { columns: 3, gapX: 4 }));
 * ```
 *
 * @example uniform cell width for visual consistency
 * ```js
 * console.log(panels.grid(blocks, {
 *   columns: 4,
 *   cellWidth: 15,
 *   alignX: 'center',
 * }));
 * ```
 */
export const grid = (blocks: string[], opts: GridOptions): string => {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  if (!opts || typeof opts !== 'object') return '';

  const columns = Math.max(1, Math.floor(opts.columns ?? 1));
  const gapX    = Math.max(0, Math.floor(opts.gapX ?? 1));
  const gapY    = Math.max(0, Math.floor(opts.gapY ?? 0));
  const alignX: Alignment = opts.alignX ?? 'start';
  const alignY: Alignment = opts.alignY ?? 'start';
  const cellW   = opts.cellWidth != null ? Math.max(0, Math.floor(opts.cellWidth)) : null;
  const cellH   = opts.cellHeight != null ? Math.max(1, Math.floor(opts.cellHeight)) : null;
  const flow    = opts.flow === 'column' ? 'column' : 'row';

  // ── v1.4.1: Resolve colSpan per block (defaults to 1, clamped to columns) ──
  const spans: number[] = blocks.map((_, i) => {
    const raw = opts.colSpan?.[i];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return 1;
    return Math.min(columns, Math.floor(raw));
  });

  // ── v1.4.3: Resolve rowSpan per block (defaults to 1) ──
  const rowSpans: number[] = blocks.map((_, i) => {
    const raw = opts.rowSpan?.[i];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  });

  // Detect spans > 1 — forces 'row' flow because column flow + spans
  // requires multi-axis packing (deferred to a later release).
  const hasColSpans = spans.some((s) => s > 1);
  const hasRowSpans = rowSpans.some((s) => s > 1);
  const hasSpans = hasColSpans || hasRowSpans;

  // ── Chunk blocks into rows ──
  type Cell = { block: string; span: number; rowSpan: number; col: number; row: number };
  const cellRows: Cell[][] = [];

  if (hasRowSpans) {
    // ── v1.4.3: Mark-and-pack algorithm for rowSpan + colSpan ──
    //
    // We maintain a 2D occupancy matrix `grid[row][col] = boolean`. For each
    // block in order, we scan row-by-row, column-by-column, and place the
    // block at the first cell where its `colSpan × rowSpan` rectangle fits
    // (i.e., all cells inside the rectangle are still free).
    //
    // This matches CSS Grid's `grid-auto-flow: row` (no dense packing).
    // Blocks that don't fit at all in the current row are pushed to a new
    // row at the bottom of the grid.
    const occupancy: boolean[][] = [];
    const placedCells: Cell[] = [];

    const isFree = (r: number, c: number, cSpan: number, rSpan: number): boolean => {
      // Ensure grid is tall enough; if rows don't exist yet, they're free
      for (let dr = 0; dr < rSpan; dr++) {
        const rowOcc = occupancy[r + dr];
        if (!rowOcc) continue;   // row not allocated yet → free
        for (let dc = 0; dc < cSpan; dc++) {
          if (rowOcc[c + dc] === true) return false;
        }
      }
      return true;
    };

    const markOccupied = (r: number, c: number, cSpan: number, rSpan: number): void => {
      for (let dr = 0; dr < rSpan; dr++) {
        const targetRow = r + dr;
        while (occupancy.length <= targetRow) {
          occupancy.push(Array(columns).fill(false) as boolean[]);
        }
        const rowOcc = occupancy[targetRow] as boolean[];
        for (let dc = 0; dc < cSpan; dc++) {
          rowOcc[c + dc] = true;
        }
      }
    };

    for (let i = 0; i < blocks.length; i++) {
      const cSpan = spans[i] as number;
      const rSpan = rowSpans[i] as number;
      // Effective col span clamped to grid width
      const effCSpan = Math.min(columns, cSpan);

      // Scan for first free position
      let placed = false;
      // Allow scanning a few extra rows beyond current to find space
      const maxScanRow = occupancy.length + rSpan;
      outer:
      for (let r = 0; r <= maxScanRow; r++) {
        for (let c = 0; c <= columns - effCSpan; c++) {
          if (isFree(r, c, effCSpan, rSpan)) {
            markOccupied(r, c, effCSpan, rSpan);
            placedCells.push({
              block: blocks[i] as string,
              span: effCSpan,
              rowSpan: rSpan,
              col: c,
              row: r,
            });
            placed = true;
            break outer;
          }
        }
      }
      /* istanbul ignore next — pathological case: only possible if rSpan/cSpan exceeds bounds */
      if (!placed) {
        // Fallback: append to a brand new row (shouldn't happen given the scan)
        const newRow = occupancy.length;
        markOccupied(newRow, 0, effCSpan, rSpan);
        placedCells.push({
          block: blocks[i] as string,
          span: effCSpan,
          rowSpan: rSpan,
          col: 0,
          row: newRow,
        });
      }
    }

    // Now group placedCells by row. A cell with rowSpan > 1 belongs to its
    // starting row only — we'll handle multi-row blocks during rendering.
    const maxRow = occupancy.length;
    for (let r = 0; r < maxRow; r++) cellRows.push([]);
    for (const cell of placedCells) {
      (cellRows[cell.row] as Cell[]).push(cell);
    }
  } else if (flow === 'column' && !hasSpans) {
    // Column-major: distribute blocks down the columns.
    const rowCount = Math.ceil(blocks.length / columns);
    for (let r = 0; r < rowCount; r++) cellRows.push([]);
    for (let i = 0; i < blocks.length; i++) {
      const c = Math.floor(i / rowCount);
      const r = i % rowCount;
      (cellRows[r] as Cell[]).push({
        block: blocks[i] as string, span: 1, rowSpan: 1, col: c, row: r,
      });
    }
  } else {
    // Row-major (default + forced when colSpan present without rowSpan)
    let row: Cell[] = [];
    let colInRow = 0;
    let rowIdx = 0;
    for (let i = 0; i < blocks.length; i++) {
      const span = spans[i] as number;
      // Wrap if this block won't fit in the remaining row capacity
      if (colInRow + span > columns && row.length > 0) {
        cellRows.push(row);
        row = [];
        colInRow = 0;
        rowIdx++;
      }
      row.push({
        block: blocks[i] as string, span, rowSpan: 1, col: colInRow, row: rowIdx,
      });
      colInRow += span;
    }
    if (row.length > 0) cellRows.push(row);
  }

  // ── Compute uniform column widths ──
  // Each column's width is the max width of all blocks that start in
  // that column AND have span=1. Spanning blocks don't constrain a single
  // column's width — they get sum(widths[c..c+span]) + gaps.
  let widths: number[];
  if (cellW != null) {
    widths = Array(columns).fill(cellW) as number[];
  } else {
    widths = Array(columns).fill(0) as number[];
    for (const r of cellRows) {
      for (const cell of r) {
        if (cell.span === 1) {
          const { maxWidth } = _splitBlock(cell.block);
          if (maxWidth > (widths[cell.col] as number)) {
            widths[cell.col] = maxWidth;
          }
        }
      }
    }
    // Defensive: if a column has no span=1 entry, give it the widest spanning
    // block proportionally so the row doesn't collapse to 0 width.
    for (let c = 0; c < columns; c++) {
      if ((widths[c] as number) === 0) {
        for (const r of cellRows) {
          for (const cell of r) {
            if (cell.col <= c && cell.col + cell.span > c) {
              const { maxWidth } = _splitBlock(cell.block);
              // Distribute evenly across the spanned columns
              const each = Math.ceil(maxWidth / cell.span);
              if (each > (widths[c] as number)) widths[c] = each;
            }
          }
        }
      }
    }
  }

  // ── Render each row ──
  const renderedRows = cellRows.map((row) => {
    // Build a per-column array, expanding spanning cells across their columns.
    // For a span-N cell starting at column C, columns C..C+N-1 hold its
    // content (only the first column has the real block; others are empty).
    // But for vsplit to give correct widths, we use a custom row assembly
    // that allows merged cells.

    // We reuse vsplit by giving it merged-width entries: each entry's
    // width = sum(widths[col..col+span]) + (span-1) * gapX.
    //
    // Note: the cells in `row` are guaranteed to be in column order and
    // contiguous by the auto-flow algorithm above (both 'row' and 'column'
    // modes assign col sequentially without gaps). So we iterate directly
    // — no need to sort or fill missing columns.
    const mergedBlocks: string[] = [];
    const mergedWidths: number[] = [];

    let nextCol = 0;
    for (const cell of row) {
      // Merged width of this cell
      let w = 0;
      for (let k = 0; k < cell.span; k++) {
        w += widths[cell.col + k] as number;
      }
      // Plus internal gaps between the columns it spans
      w += Math.max(0, cell.span - 1) * gapX;

      // Optionally truncate or pad the block height
      let blockToRender = cell.block;
      if (cellH != null) {
        blockToRender = _fitHeight(cell.block, cellH);
      }

      mergedBlocks.push(blockToRender);
      mergedWidths.push(w);
      nextCol += cell.span;
    }
    // Pad the right side with empty cells if the row doesn't reach `columns`
    while (nextCol < columns) {
      mergedBlocks.push('');
      mergedWidths.push(widths[nextCol] as number);
      nextCol++;
    }

    return vsplit(mergedBlocks, {
      gap: gapX,
      align: alignY,
      widths: mergedWidths,
    });
  });

  // Stack rows with hsplit (vertical gap)
  return hsplit(renderedRows, { gap: gapY, align: alignX });
};

/**
 * Truncate or pad a block (multi-line string) to exactly `targetH` lines.
 * Padding adds blank lines at the bottom. Truncation cuts extra lines.
 * Internal helper for `cellHeight`.
 */
const _fitHeight = (block: string, targetH: number): string => {
  const lines = block.split('\n');
  if (lines.length === targetH) return block;
  if (lines.length > targetH) return lines.slice(0, targetH).join('\n');
  // Pad with empty lines
  const pad = Array<string>(targetH - lines.length).fill('');
  return [...lines, ...pad].join('\n');
};

// ─────────────────────────────────────────────
//  Namespace
// ─────────────────────────────────────────────

export const panels = {
  vsplit,
  hsplit,
  // v1.3.1
  center,
  frame,
  // v1.3.3
  grid,
};

export default panels;
