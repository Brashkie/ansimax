// ─────────────────────────────────────────────
//  ansimax/buffer — Virtual screen buffer + minimal-ANSI frame diff (Phase 9)
//
//  v1.8.0 — Phase 9 closure. The `diff` module (v1.7.7) answers "which runs of
//  a row changed" under an ANSI byte-cost model. This is the layer that
//  consumes it: compose a frame off-screen in a grid of cells, then emit only
//  the escape sequences needed to turn the previously shown frame into the new
//  one — a cursor move to each changed run, then the run's text, and nothing
//  for the rows and columns that didn't change.
//
//  That is how flicker-free TUIs stay cheap: a full redraw of an 80×24 screen
//  is ~1,920 cells every frame; a damage-tracked redraw emits only the handful
//  of cells that actually moved. `renderFrame` is pure (returns the string),
//  so it is testable without a TTY and the caller owns stdout. Zero deps
//  beyond the sibling `diff` module.
// ─────────────────────────────────────────────

import { diffRow } from '../diff/index.js';
import type { DiffRowOptions } from '../diff/index.js';

/** Move the cursor to 1-based (row, col). Rows/cols are 0-based in the API. */
const cursorTo = (row: number, col: number): string => `\x1b[${row + 1};${col + 1}H`;

/** Options for {@link renderFrame}. @since 1.8.0 */
export interface RenderFrameOptions extends DiffRowOptions {
  /**
   * 0-based screen row the frame's first line occupies (where the cursor is
   * positioned for edits). Default `0`.
   */
  originRow?: number;
  /** 0-based screen column of each row's first cell. Default `0`. */
  originCol?: number;
}

/**
 * Emit the minimal ANSI needed to turn the `prev` frame into `next`, both given
 * as arrays of row strings. Only changed runs (per {@link diffRow}) are
 * rewritten, each preceded by one cursor move; unchanged rows cost nothing.
 *
 * Rows present in `next` but not `prev` (the frame grew) are treated as fully
 * new. Rows that vanished (the frame shrank) are left to the caller to clear —
 * `renderFrame` never emits blind erases. Returns `''` when nothing changed.
 *
 * @example
 * ```js
 * import { renderFrame } from 'ansimax';
 *
 * const prev = ['health: 100', 'mana:    50'];
 * const next = ['health:  90', 'mana:    50'];
 * process.stdout.write(renderFrame(prev, next));
 * // only the "100"→" 90" run on row 0 is rewritten
 * ```
 *
 * @since 1.8.0
 */
export const renderFrame = (
  prev: string[],
  next: string[],
  opts: RenderFrameOptions = {},
): string => {
  const originRow = Number.isFinite(opts.originRow) ? (opts.originRow as number) : 0;
  const originCol = Number.isFinite(opts.originCol) ? (opts.originCol as number) : 0;
  const diffOpts: DiffRowOptions = { moveCost: opts.moveCost };

  let out = '';
  for (let r = 0; r < next.length; r++) {
    const before = prev[r] ?? '';
    const after = next[r] as string;
    if (before === after) continue;
    for (const edit of diffRow(before, after, diffOpts)) {
      out += cursorTo(originRow + r, originCol + edit.col) + edit.text;
    }
  }
  return out;
};

/**
 * The byte length `renderFrame` would emit for this transition — handy for
 * asserting a damage-tracked redraw really is cheaper than a full one.
 *
 * @since 1.8.0
 */
export const renderFrameCost = (
  prev: string[],
  next: string[],
  opts: RenderFrameOptions = {},
): number => renderFrame(prev, next, opts).length;

/** A mutable off-screen cell grid you compose into, then diff. @since 1.8.0 */
export interface ScreenBuffer {
  readonly width: number;
  readonly height: number;
  /** Set a single cell. Out-of-bounds coordinates are ignored. */
  set(x: number, y: number, ch: string): void;
  /** Write a string starting at (x, y), left to right, clipped to the width. */
  text(x: number, y: number, str: string): void;
  /** Reset every cell to `fill` (default the buffer's fill character). */
  clear(fill?: string): void;
  /** The row `y` as a string (empty string out of bounds). */
  row(y: number): string;
  /** All rows as an array of strings. */
  rows(): string[];
  /** The whole frame as one `\n`-joined string. */
  toString(): string;
}

/**
 * Create a `width × height` off-screen buffer of single-character cells,
 * initialized to `fill`. Compose into it with {@link ScreenBuffer.set} /
 * {@link ScreenBuffer.text}, read it back with `rows()`, and feed successive
 * snapshots to {@link renderFrame} for flicker-free updates.
 *
 * Cells are one code point each; writing a wider glyph still occupies one cell
 * (width accounting is the caller's concern, as elsewhere in ansimax).
 *
 * @since 1.8.0
 */
export const createScreenBuffer = (
  width: number,
  height: number,
  fill = ' ',
): ScreenBuffer => {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const fillCh = [...fill][0] ?? ' ';
  // Grid of code points, row-major.
  let grid: string[][] = [];
  const reset = (ch: string): void => {
    grid = Array.from({ length: h }, () => new Array<string>(w).fill(ch));
  };
  reset(fillCh);

  return {
    width: w,
    height: h,
    set(x, y, ch) {
      if (y < 0 || y >= h || x < 0 || x >= w) return;
      (grid[y] as string[])[x] = [...ch][0] ?? fillCh;
    },
    text(x, y, str) {
      if (y < 0 || y >= h) return;
      const chars = [...str];
      const rowArr = grid[y] as string[];
      for (let i = 0; i < chars.length; i++) {
        const cx = x + i;
        if (cx < 0 || cx >= w) continue;
        rowArr[cx] = chars[i] as string;
      }
    },
    clear(ch) {
      reset(ch !== undefined ? ([...ch][0] ?? fillCh) : fillCh);
    },
    row(y) {
      if (y < 0 || y >= h) return '';
      return (grid[y] as string[]).join('');
    },
    rows() {
      return grid.map((r) => r.join(''));
    },
    toString() {
      return grid.map((r) => r.join('')).join('\n');
    },
  };
};

// ─────────────────────────────────────────────
//  Z-index layer compositing — Phase 9 (v1.8.1)
//
//  Overlapping panels with priority: given several layers, each a block of
//  text placed at (x, y) with a z-index, flatten them into one frame. Higher z
//  paints on top; a transparent cell (by default a space) lets lower layers
//  show through, so a small opaque popup can float over a full-screen
//  background without erasing it. Stable: equal z keeps input order (painter's
//  algorithm). Pure — returns the composed rows.
// ─────────────────────────────────────────────

/** One layer to composite. @since 1.8.1 */
export interface Layer {
  /** The layer's text block, one string per row (ANSI not width-accounted). */
  content: string[];
  /** 0-based column of the block's left edge. Default `0`. */
  x?: number;
  /** 0-based row of the block's top edge. Default `0`. */
  y?: number;
  /** Paint priority — higher sits on top. Ties keep array order. Default `0`. */
  z?: number;
}

/** Options for {@link compositeLayers}. @since 1.8.1 */
export interface CompositeOptions {
  /**
   * The cell treated as transparent — lower layers show through it. Default
   * `' '` (space). Set `''` to make every cell opaque (a layer then fully
   * occludes whatever is beneath its footprint).
   */
  transparent?: string;
  /** Background fill for cells no layer covers. Default `' '`. */
  fill?: string;
}

/**
 * Flatten `layers` into a `width × height` frame by painting them bottom-to-top
 * in z order (ties keep array order). Each layer's cells are placed at its
 * `(x, y)`; a transparent cell (default a space) lets the layer below show
 * through, so popups and panels overlap without erasing each other. Cells
 * outside the frame are clipped. Returns the composed rows.
 *
 * @example
 * ```js
 * import { compositeLayers } from 'ansimax';
 *
 * const bg   = { content: ['..........', '..........', '..........'], z: 0 };
 * const card = { content: ['+--+', '|hi|', '+--+'], x: 3, y: 0, z: 1 };
 * compositeLayers([bg, card], 10, 3);
 * // ['...+--+...', '...|hi|...', '...+--+...']
 * ```
 *
 * @since 1.8.1
 */
export const compositeLayers = (
  layers: Layer[],
  width: number,
  height: number,
  opts: CompositeOptions = {},
): string[] => {
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  const transparent = opts.transparent !== undefined ? [...opts.transparent][0] : ' ';
  const fillCh = opts.fill !== undefined ? ([...opts.fill][0] ?? ' ') : ' ';
  if (w === 0 || h === 0) return [];

  const grid: string[][] = Array.from({ length: h }, () => new Array<string>(w).fill(fillCh));

  // Stable sort by z ascending: lower layers first, so higher z overwrites.
  const ordered = layers
    .map((layer, i) => ({ layer, i }))
    .sort((a, b) => (a.layer.z ?? 0) - (b.layer.z ?? 0) || a.i - b.i);

  for (const { layer } of ordered) {
    const ox = Math.floor(layer.x ?? 0);
    const oy = Math.floor(layer.y ?? 0);
    const rows = Array.isArray(layer.content) ? layer.content : [];
    for (let r = 0; r < rows.length; r++) {
      const ry = oy + r;
      if (ry < 0 || ry >= h) continue;
      const cells = [...(rows[r] as string)];
      const target = grid[ry] as string[];
      for (let c = 0; c < cells.length; c++) {
        const cx = ox + c;
        if (cx < 0 || cx >= w) continue;
        const ch = cells[c] as string;
        if (ch === transparent) continue; // see-through — keep what's below
        target[cx] = ch;
      }
    }
  }

  return grid.map((row) => row.join(''));
};
