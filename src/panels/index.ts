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

  // Chunk blocks into rows of N columns
  const rows: string[][] = [];
  for (let i = 0; i < blocks.length; i += columns) {
    rows.push(blocks.slice(i, i + columns));
  }

  // For uniform columns: each column width is the max across all rows in that column.
  // Compute widths once so all rows align visually.
  let widths: number[] | null = null;
  if (cellW != null) {
    widths = Array(columns).fill(cellW) as number[];
  } else {
    widths = Array(columns).fill(0) as number[];
    for (const row of rows) {
      for (let c = 0; c < row.length; c++) {
        const { maxWidth } = _splitBlock(row[c] as string);
        if (maxWidth > (widths[c] as number)) {
          widths[c] = maxWidth;
        }
      }
    }
  }

  // Render each row via vsplit (passing fixed widths for visual alignment)
  const renderedRows = rows.map((row) => {
    // Pad shorter rows with empty blocks so vsplit gives uniform widths
    const padded: string[] = [];
    for (let c = 0; c < columns; c++) {
      padded.push(row[c] ?? '');
    }
    return vsplit(padded, {
      gap: gapX,
      align: alignY,
      widths,
    });
  });

  // Stack rows with hsplit (vertical gap)
  return hsplit(renderedRows, { gap: gapY, align: alignX });
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
