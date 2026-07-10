// ─────────────────────────────────────────────
//  ansimax/panels — Public types
//
//  v1.4.5 — Split out from index.ts.
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

export interface CenterOptions {
  /** Target width in visible columns. Required. */
  width: number;
  /** Optional target height in lines; enables vertical centering when set. */
  height?: number;
  /** Vertical alignment when `height` is set. Default `'center'`. */
  align?: Alignment;
}

export interface FrameOptions {
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  topChar?: string;
  bottomChar?: string;
  /** Optional title shown in the top edge. */
  title?: string;
  /**
   * Title alignment: `'left'` | `'center'` (default) | `'right'`.
   * Only applies when `title` is set.
   *
   * @since 1.3.3
   */
  titleAlign?: 'left' | 'center' | 'right';
}

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
  /** Fix each cell to this width. If omitted, uses natural max-line width per column. */
  cellWidth?: number | null;
  /** Fix each row to this height. Since v1.4.1. */
  cellHeight?: number | null;
  /** Per-block column span (CSS Grid). Since v1.4.1. */
  colSpan?: number[];
  /** Per-block row span (CSS Grid mark-and-pack). Since v1.4.3. */
  rowSpan?: number[];
  /** Auto-flow direction. Since v1.4.1. */
  flow?: 'row' | 'column';
}

/**
 * A rectangular region derived from a grid area name — start row/col
 * and span in each axis. Used internally by `gridAreas` to convert
 * symbolic layouts into colSpan/rowSpan cells.
 *
 * @since 1.4.4
 */
export interface AreaRect {
  name: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

export interface GridAreasOptions {
  areas: string[][];
  gapX?: number;
  gapY?: number;
  cellWidth?: number | null;
  cellHeight?: number | null;
  alignX?: Alignment;
  alignY?: Alignment;
}

/**
 * Justify strategy for `panels.flex` — how free horizontal space is
 * distributed among/around the blocks (mirrors CSS `justify-content`).
 *
 * @since 1.4.7
 */
export type FlexJustify =
  | 'start'
  | 'end'
  | 'center'
  | 'between'   // equal gaps between items, none at the edges
  | 'around'    // half-size gaps at the edges, full between
  | 'evenly';   // equal gaps everywhere including edges

export interface FlexOptions {
  /**
   * Total target width in columns. Blocks are laid out within this width;
   * free space is distributed per `justify`. Required.
   */
  width: number;
  /**
   * How to distribute free horizontal space. Default `'start'`.
   * @since 1.4.7
   */
  justify?: FlexJustify;
  /**
   * Vertical alignment of shorter blocks within the tallest block's height.
   * Default `'start'`.
   */
  align?: Alignment;
  /**
   * Minimum gap between blocks (added on top of any justify spacing).
   * Default `0`.
   */
  gap?: number;
  /**
   * Per-block grow weights (CSS `flex-grow`). When present and the blocks
   * don't fill `width`, leftover space is distributed to blocks in
   * proportion to their weight, padding them wider. Length should match
   * the block count; missing entries default to 0 (no grow).
   * @since 1.4.7
   */
  grow?: number[];
}

// ─────────────────────────────────────────────
//  Internal shared types
// ─────────────────────────────────────────────

/**
 * A cell within a grid row. Populated by the flow algorithm and
 * consumed by the renderer.
 *
 * @internal — exposed for tests only
 */
export interface GridCell {
  block: string;
  span: number;
  rowSpan: number;
  col: number;
  row: number;
}
