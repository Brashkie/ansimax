// ─────────────────────────────────────────────
//  ansimax/panels — Flexbox-style horizontal layout
//
//  v1.4.7 — Distribute blocks across a fixed width with CSS
//  justify-content semantics + optional flex-grow weights.
//
//  Builds on the `distribute()` helper from utils/math (v1.4.6): free
//  space is split into integer gaps that always sum exactly to the
//  available space — no rounding drift, no off-by-one at the right edge.
// ─────────────────────────────────────────────

import { distribute } from '../utils/math.js';
import type { FlexOptions, FlexJustify, Alignment } from './types.js';
import { _splitBlock, _alignVertical, _padLinesRight } from './helpers.js';

/**
 * Compute the leading pad + inter-item gaps for a given justify strategy.
 * Returns `{ lead, gaps }` where `lead` is the left padding and `gaps[i]`
 * is the space AFTER block i (the last entry is the trailing pad).
 *
 * `free` is the total free space (width − sum(blockWidths) − baseGaps).
 * All returned values are non-negative integers summing to `free`.
 */
const _justifySpacing = (
  justify: FlexJustify,
  free: number,
  count: number,
): { lead: number; gaps: number[] } => {
  // gaps has `count` entries: gaps[0..count-2] are BETWEEN items,
  // gaps[count-1] is the trailing pad. `lead` is the leading pad.
  const gaps = Array<number>(count).fill(0);
  if (free <= 0 || count === 0) return { lead: 0, gaps };

  switch (justify) {
    case 'end':
      return { lead: free, gaps };

    case 'center': {
      const left = Math.floor(free / 2);
      gaps[count - 1] = free - left;
      return { lead: left, gaps };
    }

    case 'between': {
      // Equal gaps between items only. With 1 item, all trailing.
      if (count === 1) {
        gaps[0] = free;
        return { lead: 0, gaps };
      }
      const slots = distribute(free, count - 1);
      for (let i = 0; i < count - 1; i++) gaps[i] = slots[i] as number;
      return { lead: 0, gaps };
    }

    case 'around': {
      // Each item has equal space around it → edges get half a unit.
      // Model: 2*count half-gaps. Edges get 1 half, betweens get 2.
      const halves = distribute(free, count * 2);
      let idx = 0;
      const lead = halves[idx++] as number;
      for (let i = 0; i < count; i++) {
        const right = halves[idx++] as number;
        if (i < count - 1) {
          const nextLeft = halves[idx++] as number;
          gaps[i] = right + nextLeft;
        } else {
          gaps[i] = right;
        }
      }
      return { lead, gaps };
    }

    case 'evenly': {
      // Equal gaps everywhere including both edges → count+1 slots.
      const slots = distribute(free, count + 1);
      const lead = slots[0] as number;
      for (let i = 0; i < count; i++) gaps[i] = slots[i + 1] as number;
      return { lead, gaps };
    }

    case 'start':
    default:
      gaps[count - 1] = free; // all free space trails to the right
      return { lead: 0, gaps };
  }
};

/**
 * Apply flex-grow: distribute leftover width to blocks in proportion to
 * their grow weights, padding each grown block on the right. Returns the
 * new per-block widths.
 */
const _applyGrow = (
  widths: number[],
  grow: number[],
  leftover: number,
): number[] => {
  const totalGrow = grow.reduce((a, b) => a + Math.max(0, b), 0);
  if (totalGrow <= 0 || leftover <= 0) return widths;

  // Distribute leftover proportionally. We scale each weight into an
  // integer share via distribute over a weighted expansion.
  // Simpler + exact: hand out one column at a time to the block with the
  // highest fractional entitlement (largest-remainder method).
  const entitlements = grow.map((g) => (Math.max(0, g) / totalGrow) * leftover);
  const floors = entitlements.map((e) => Math.floor(e));
  const used = floors.reduce((a, b) => a + b, 0);
  let remaining = leftover - used;

  // Largest-remainder: sort indices by fractional part descending
  const order = entitlements
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac);

  const add = Array<number>(widths.length).fill(0);
  for (let k = 0; k < widths.length; k++) add[k] = floors[k] as number;
  let oi = 0;
  while (remaining > 0 && order.length > 0) {
    const idx = (order[oi % order.length] as { i: number }).i;
    add[idx] = (add[idx] as number) + 1;
    remaining--;
    oi++;
  }

  return widths.map((w, i) => w + (add[i] as number));
};

/**
 * Lay out blocks horizontally within a fixed width, distributing free
 * space per `justify` and optionally growing blocks via `grow` weights.
 *
 * @example
 * ```js
 * import { panels, ascii } from 'ansimax';
 *
 * const a = ascii.box('A');
 * const b = ascii.box('B');
 * const c = ascii.box('C');
 *
 * // Spread three boxes across 60 cols with equal gaps between them
 * console.log(panels.flex([a, b, c], { width: 60, justify: 'between' }));
 * ```
 *
 * @since 1.4.7
 */
export const flex = (blocks: string[], opts: FlexOptions): string => {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  if (!opts || typeof opts !== 'object') return '';

  const width = Math.max(0, Math.floor(opts.width ?? 0));
  const justify: FlexJustify = opts.justify ?? 'start';
  const align: Alignment = opts.align ?? 'start';
  const baseGap = Math.max(0, Math.floor(opts.gap ?? 0));

  // Measure each block
  const splits = blocks.map((b) => _splitBlock(b));
  let widths = splits.map((s) => s.maxWidth);
  const targetLines = splits.reduce((m, s) => Math.max(m, s.lines.length), 0);

  const count = blocks.length;
  const totalBase = baseGap * Math.max(0, count - 1);

  // Optional flex-grow: expand blocks to consume leftover before justify
  if (opts.grow && opts.grow.length > 0) {
    const usedByBlocks = widths.reduce((a, b) => a + b, 0);
    const leftover = width - usedByBlocks - totalBase;
    if (leftover > 0) {
      widths = _applyGrow(widths, opts.grow, leftover);
    }
  }

  const sumWidths = widths.reduce((a, b) => a + b, 0);
  const free = Math.max(0, width - sumWidths - totalBase);
  const { lead, gaps } = _justifySpacing(justify, free, count);

  // Normalize each block: pad to its (possibly grown) width + vertical align
  const normalized = splits.map((s, i) => {
    const w = widths[i] as number;
    const padded = _padLinesRight(s.lines, w);
    return _alignVertical(padded, targetLines, w, align);
  });

  // Assemble each output line
  const result: string[] = [];
  for (let row = 0; row < targetLines; row++) {
    let line = ' '.repeat(lead);
    for (let i = 0; i < count; i++) {
      line += (normalized[i] as string[])[row] ?? '';
      // base gap + justify gap after this block
      const after = baseGap + (gaps[i] as number);
      if (after > 0) line += ' '.repeat(after);
    }
    result.push(line);
  }
  return result.join('\n');
};
