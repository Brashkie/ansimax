// ─────────────────────────────────────────────
//  ansimax/diff — Intra-row damage diffing with an ANSI byte-cost model (Phase 9)
//
//  v1.7.7 — Phase 9. Line-level diffing (which rows changed) is cheap and
//  already handled by `diffLines`. This is the finer, column-level step: given
//  the previous and next contents of a single row, emit the *minimal set of
//  runs* a renderer must rewrite.
//
//  The subtlety is the byte-cost trade-off. Rewriting a changed run is one
//  thing; but when two changed runs are separated by a short gap of unchanged
//  cells, you can either (a) move the cursor across the gap — a CSI move costs
//  a fixed ~`moveCost` bytes — or (b) just overwrite the gap too, costing one
//  byte per cell. So gaps shorter than `moveCost` are cheaper to overwrite:
//  the two runs are merged. This is cost-based interval merging, O(N) over the
//  row width. Pure functions, zero dependencies.
//
//  It works on plain strings compared per code point, so the caller owns ANSI
//  styling and cursor emission; `diffRow` only says *what* to rewrite and
//  *where*.
// ─────────────────────────────────────────────

/** A run the renderer should rewrite: `text` starting at column `col`. @since 1.7.7 */
export interface RowEdit {
  /** Zero-based column where this run begins. */
  col: number;
  /** The new text to write at `col` (from `next`). */
  text: string;
}

/** Options for {@link diffRow}. @since 1.7.7 */
export interface DiffRowOptions {
  /**
   * Approximate byte cost of a cursor move (a CSI column/relative move is
   * ~6–10 bytes). Unchanged gaps *shorter* than this are overwritten rather
   * than jumped, merging the runs on either side. Default `7`. A `moveCost`
   * of `0` never merges (every changed run is emitted separately); a very
   * large one merges the whole row into a single run.
   */
  moveCost?: number;
}

/**
 * Column-level diff of one row: the minimal runs of `next` a renderer must
 * rewrite to turn `prev` into `next`, with short unchanged gaps merged when
 * overwriting them is cheaper than a cursor move (the ANSI byte-cost model).
 *
 * Compared per code point. Equal rows return `[]`. When `next` is longer, the
 * tail is always a trailing edit; when `next` is shorter, columns past its end
 * are left to the caller to clear (no edit is emitted for a pure deletion
 * tail) — but any overlap difference before that is captured.
 *
 * @example
 * ```js
 * import { diffRow } from 'ansimax';
 *
 * diffRow('the quick brown fox', 'the slow  brown fox');
 * // → [{ col: 4, text: 'slow ' }]   (one run; 'quick'→'slow ' region)
 *
 * diffRow('aXbbbbbbbbbbY', 'a_bbbbbbbbbb_', { moveCost: 7 });
 * // two single-char changes 10 apart → NOT merged (gap ≥ moveCost)
 * ```
 *
 * @since 1.7.7
 */
export const diffRow = (
  prev: string,
  next: string,
  opts: DiffRowOptions = {},
): RowEdit[] => {
  const moveCost = Number.isFinite(opts.moveCost) && (opts.moveCost as number) >= 0
    ? Math.floor(opts.moveCost as number)
    : 7;

  const a = [...prev];
  const b = [...next];
  const nb = b.length;
  if (nb === 0) return [];

  // Per-column changed mask over the length of `next`. A column counts as
  // changed when the code points differ, or when `prev` has no such column.
  const changed: boolean[] = new Array(nb);
  for (let i = 0; i < nb; i++) changed[i] = a[i] !== b[i];

  // Collect contiguous changed runs as [start, end) half-open intervals.
  const runs: Array<[number, number]> = [];
  let i = 0;
  while (i < nb) {
    if (!changed[i]) { i++; continue; }
    const start = i;
    while (i < nb && changed[i]) i++;
    runs.push([start, i]);
  }
  if (runs.length === 0) return [];

  // Cost-based merge: fold a run into the previous one when the unchanged gap
  // between them is shorter than a cursor move (cheaper to overwrite it).
  const merged: Array<[number, number]> = [runs[0] as [number, number]];
  for (let r = 1; r < runs.length; r++) {
    const [s, e] = runs[r] as [number, number];
    const last = merged[merged.length - 1] as [number, number];
    const gap = s - last[1];
    if (gap < moveCost) last[1] = e;   // overwrite the gap → extend
    else merged.push([s, e]);
  }

  return merged.map(([s, e]) => ({ col: s, text: b.slice(s, e).join('') }));
};

/**
 * The byte cost {@link diffRow}'s edits would incur under the same model: one
 * `moveCost` per run (to position the cursor) plus one byte per written cell.
 * Handy for benchmarking a diff strategy or choosing `moveCost`.
 *
 * @since 1.7.7
 */
export const diffRowCost = (
  prev: string,
  next: string,
  opts: DiffRowOptions = {},
): number => {
  const moveCost = Number.isFinite(opts.moveCost) && (opts.moveCost as number) >= 0
    ? Math.floor(opts.moveCost as number)
    : 7;
  const edits = diffRow(prev, next, opts);
  let cost = 0;
  for (const e of edits) cost += moveCost + [...e.text].length;
  return cost;
};
