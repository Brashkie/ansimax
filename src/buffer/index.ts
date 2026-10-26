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
