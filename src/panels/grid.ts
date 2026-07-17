// ─────────────────────────────────────────────
//  ansimax/panels — CSS Grid layout
//
//  v1.4.5 — Split out from index.ts and decomposed into 3 pure phases:
//
//    Phase 1 (resolveSpans):    normalize + clamp colSpan/rowSpan per block
//    Phase 2 (packCells):       assign each block to a (row, col) via
//                               row-major flow, column-major flow, or
//                               mark-and-pack (when rowSpan present)
//    Phase 3 (renderCells):     compute column widths, then merge each
//                               row via vsplit and stack via hsplit
//
//  Each phase is a pure function — testable in isolation and easy to
//  reason about. This replaces the previous 250-line monolith.
// ─────────────────────────────────────────────

import type { GridOptions, GridCell, Alignment } from './types.js';
import { _splitBlock, _fitHeight, _padLinesAligned } from './helpers.js';
import { vsplit, hsplit } from './split.js';

// ─────────────────────────────────────────────
//  Phase 1: Resolve spans
// ─────────────────────────────────────────────

interface ResolvedOptions {
  columns: number;
  gapX: number;
  gapY: number;
  alignX: Alignment;
  alignY: Alignment;
  cellW: number | null;
  cellH: number | null;
  flow: 'row' | 'column';
  spans: number[];
  rowSpans: number[];
  hasColSpans: boolean;
  hasRowSpans: boolean;
  hasSpans: boolean;
  cellAlign: Alignment[];
}

/**
 * Normalize + validate all `GridOptions` fields. Clamps spans, resolves
 * defaults, and pre-computes flags used by later phases.
 *
 * Pure function — no side effects.
 */
const _resolveOptions = (blocks: string[], opts: GridOptions): ResolvedOptions => {
  const columns = Math.max(1, Math.floor(opts.columns ?? 1));
  const gapX    = Math.max(0, Math.floor(opts.gapX ?? 1));
  const gapY    = Math.max(0, Math.floor(opts.gapY ?? 0));
  const alignX  = opts.alignX ?? 'start';
  const alignY  = opts.alignY ?? 'start';
  const cellW   = opts.cellWidth != null ? Math.max(0, Math.floor(opts.cellWidth)) : null;
  const cellH   = opts.cellHeight != null ? Math.max(1, Math.floor(opts.cellHeight)) : null;
  const flow    = opts.flow === 'column' ? 'column' : 'row';

  // Per-block colSpan — clamped to [1, columns]
  const spans: number[] = blocks.map((_, i) => {
    const raw = opts.colSpan?.[i];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return 1;
    return Math.min(columns, Math.floor(raw));
  });

  // Per-block rowSpan — clamped to [1, ∞)
  const rowSpans: number[] = blocks.map((_, i) => {
    const raw = opts.rowSpan?.[i];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) return 1;
    return Math.floor(raw);
  });

  const hasColSpans = spans.some((s) => s > 1);
  const hasRowSpans = rowSpans.some((s) => s > 1);
  const hasSpans = hasColSpans || hasRowSpans;

  // v1.4.8 — per-block horizontal alignment (falls back to alignX per entry)
  const cellAlign: Alignment[] = Array.isArray(opts.cellAlign) ? opts.cellAlign : [];

  return {
    columns, gapX, gapY, alignX, alignY, cellW, cellH, flow,
    spans, rowSpans, hasColSpans, hasRowSpans, hasSpans, cellAlign,
  };
};

// ─────────────────────────────────────────────
//  Phase 2: Pack cells into rows
// ─────────────────────────────────────────────

/**
 * Mark-and-pack algorithm (CSS Grid `grid-auto-flow: row`).
 *
 * Maintains a 2D occupancy matrix and places each block at the first
 * cell where its `colSpan × rowSpan` rectangle fits, scanning row-by-row
 * then column-by-column.
 *
 * Time complexity: O(blocks × maxRows × columns).
 * Used when any `rowSpan > 1`.
 */
const _packMarkAndFill = (blocks: string[], r: ResolvedOptions): GridCell[][] => {
  const occupancy: boolean[][] = [];
  const placed: GridCell[] = [];

  const isFree = (row: number, col: number, cSpan: number, rSpan: number): boolean => {
    for (let dr = 0; dr < rSpan; dr++) {
      const rowOcc = occupancy[row + dr];
      if (!rowOcc) continue;
      for (let dc = 0; dc < cSpan; dc++) {
        if (rowOcc[col + dc] === true) return false;
      }
    }
    return true;
  };

  const markOccupied = (row: number, col: number, cSpan: number, rSpan: number): void => {
    for (let dr = 0; dr < rSpan; dr++) {
      const targetRow = row + dr;
      while (occupancy.length <= targetRow) {
        occupancy.push(Array(r.columns).fill(false) as boolean[]);
      }
      const rowOcc = occupancy[targetRow] as boolean[];
      for (let dc = 0; dc < cSpan; dc++) {
        rowOcc[col + dc] = true;
      }
    }
  };

  for (let i = 0; i < blocks.length; i++) {
    const cSpan = r.spans[i] as number;
    const rSpan = r.rowSpans[i] as number;
    const effCSpan = Math.min(r.columns, cSpan);

    let placedOk = false;
    const maxScanRow = occupancy.length + rSpan;
    outer:
    for (let row = 0; row <= maxScanRow; row++) {
      for (let col = 0; col <= r.columns - effCSpan; col++) {
        if (isFree(row, col, effCSpan, rSpan)) {
          markOccupied(row, col, effCSpan, rSpan);
          placed.push({ block: blocks[i] as string, span: effCSpan, rowSpan: rSpan, col, row, index: i });
          placedOk = true;
          break outer;
        }
      }
    }
    /* istanbul ignore next — pathological case: only possible if spans exceed bounds */
    if (!placedOk) {
      const newRow = occupancy.length;
      markOccupied(newRow, 0, effCSpan, rSpan);
      placed.push({ block: blocks[i] as string, span: effCSpan, rowSpan: rSpan, col: 0, row: newRow, index: i });
    }
  }

  // Group by row
  const maxRow = occupancy.length;
  const rows: GridCell[][] = [];
  for (let i = 0; i < maxRow; i++) rows.push([]);
  for (const cell of placed) {
    (rows[cell.row] as GridCell[]).push(cell);
  }
  return rows;
};

/**
 * Column-major flow: distribute blocks down columns first, then wrap
 * to the next column. Requires no spans (spans force row flow).
 */
const _packColumnFlow = (blocks: string[], r: ResolvedOptions): GridCell[][] => {
  const rowCount = Math.ceil(blocks.length / r.columns);
  const rows: GridCell[][] = [];
  for (let i = 0; i < rowCount; i++) rows.push([]);
  for (let i = 0; i < blocks.length; i++) {
    const col = Math.floor(i / rowCount);
    const row = i % rowCount;
    (rows[row] as GridCell[]).push({
      block: blocks[i] as string, span: 1, rowSpan: 1, col, row, index: i,
    });
  }
  return rows;
};

/**
 * Row-major flow: fill left-to-right, wrap to next row when the current
 * row can't fit the next block's span.
 */
const _packRowFlow = (blocks: string[], r: ResolvedOptions): GridCell[][] => {
  const rows: GridCell[][] = [];
  let row: GridCell[] = [];
  let colInRow = 0;
  let rowIdx = 0;
  for (let i = 0; i < blocks.length; i++) {
    const span = r.spans[i] as number;
    if (colInRow + span > r.columns && row.length > 0) {
      rows.push(row);
      row = [];
      colInRow = 0;
      rowIdx++;
    }
    row.push({ block: blocks[i] as string, span, rowSpan: 1, col: colInRow, row: rowIdx, index: i });
    colInRow += span;
  }
  if (row.length > 0) rows.push(row);
  return rows;
};

/**
 * Phase 2 entry: dispatch to the right packing algorithm based on
 * the resolved options.
 *
 * Precedence:
 *   1. If any rowSpan > 1 → mark-and-pack (CSS Grid full algorithm)
 *   2. If flow='column' and no spans → column-major
 *   3. Otherwise → row-major (with or without colSpans)
 */
export const _packCells = (blocks: string[], r: ResolvedOptions): GridCell[][] => {
  if (r.hasRowSpans) return _packMarkAndFill(blocks, r);
  if (r.flow === 'column' && !r.hasSpans) return _packColumnFlow(blocks, r);
  return _packRowFlow(blocks, r);
};

// ─────────────────────────────────────────────
//  Phase 3: Compute widths + render
// ─────────────────────────────────────────────

/**
 * Compute uniform column widths. If `cellW` is set, all columns get that
 * width. Otherwise, each column's width is the max of blocks starting
 * there with span=1. Spanning blocks contribute proportionally to their
 * spanned columns as a fallback.
 */
const _computeWidths = (cellRows: GridCell[][], r: ResolvedOptions): number[] => {
  if (r.cellW != null) {
    return Array(r.columns).fill(r.cellW) as number[];
  }

  const widths = Array(r.columns).fill(0) as number[];
  for (const row of cellRows) {
    for (const cell of row) {
      if (cell.span === 1) {
        const { maxWidth } = _splitBlock(cell.block);
        if (maxWidth > (widths[cell.col] as number)) {
          widths[cell.col] = maxWidth;
        }
      }
    }
  }

  // Defensive: columns with no span=1 entries get proportional width
  // from the widest spanning block that touches them.
  for (let c = 0; c < r.columns; c++) {
    if ((widths[c] as number) === 0) {
      for (const row of cellRows) {
        for (const cell of row) {
          if (cell.col <= c && cell.col + cell.span > c) {
            const { maxWidth } = _splitBlock(cell.block);
            const each = Math.ceil(maxWidth / cell.span);
            if (each > (widths[c] as number)) widths[c] = each;
          }
        }
      }
    }
  }

  return widths;
};

/** Render a single row of cells to a string block using vsplit. */
const _renderRow = (row: GridCell[], widths: number[], r: ResolvedOptions): string => {
  const mergedBlocks: string[] = [];
  const mergedWidths: number[] = [];

  let nextCol = 0;
  for (const cell of row) {
    // Merged width: sum of column widths + internal gaps
    let w = 0;
    for (let k = 0; k < cell.span; k++) {
      w += widths[cell.col + k] as number;
    }
    w += Math.max(0, cell.span - 1) * r.gapX;

    let blockToRender = cell.block;
    if (r.cellH != null) {
      blockToRender = _fitHeight(cell.block, r.cellH);
    }

    // v1.4.8 — per-cell horizontal alignment. When cellAlign[index] is set,
    // pre-pad the block's lines to the cell width using that alignment so
    // vsplit (which only does vertical align + right-pad) preserves it.
    const perCellAlign = r.cellAlign[cell.index];
    if (perCellAlign && perCellAlign !== 'start') {
      const { lines } = _splitBlock(blockToRender);
      blockToRender = _padLinesAligned(lines, w, perCellAlign).join('\n');
    }

    mergedBlocks.push(blockToRender);
    mergedWidths.push(w);
    nextCol += cell.span;
  }

  // Pad the right side with empty cells if the row doesn't fill `columns`
  while (nextCol < r.columns) {
    mergedBlocks.push('');
    mergedWidths.push(widths[nextCol] as number);
    nextCol++;
  }

  return vsplit(mergedBlocks, { gap: r.gapX, align: r.alignY, widths: mergedWidths });
};

// ─────────────────────────────────────────────
//  Public entry
// ─────────────────────────────────────────────

/**
 * Arrange blocks in a CSS Grid-inspired layout. Supports column and row
 * spans, uniform cell dimensions, and two auto-flow directions.
 *
 * See `GridOptions` for the full feature matrix.
 */
export const grid = (blocks: string[], opts: GridOptions): string => {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  if (!opts || typeof opts !== 'object') return '';

  // Phase 1: resolve + validate options
  const resolved = _resolveOptions(blocks, opts);

  // Phase 2: pack blocks into rows
  const cellRows = _packCells(blocks, resolved);

  // Phase 3: compute column widths + render each row
  const widths = _computeWidths(cellRows, resolved);
  const renderedRows = cellRows.map((row) => _renderRow(row, widths, resolved));

  // Stack rows via hsplit with vertical gap
  return hsplit(renderedRows, { gap: resolved.gapY, align: resolved.alignX });
};
