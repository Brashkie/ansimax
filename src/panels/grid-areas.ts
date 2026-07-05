// ─────────────────────────────────────────────
//  ansimax/panels — CSS Grid template areas
//
//  v1.4.5 — Split out from index.ts.
//
//  Convert a symbolic name matrix into a set of rectangles and delegate
//  to `grid()`. Validation guarantees every non-'.' name forms a
//  contiguous rectangle.
// ─────────────────────────────────────────────

import type { GridAreasOptions, AreaRect } from './types.js';
import { grid } from './grid.js';

/**
 * Validate that every non-'.' name in the areas matrix forms a
 * contiguous rectangle. Throws with a helpful message on the first
 * violation.
 *
 * Complexity: O(rows × cols × names) — fine for typical grids.
 *
 * @since 1.4.4
 */
export const _validateAreas = (areas: string[][]): AreaRect[] => {
  if (!Array.isArray(areas) || areas.length === 0) {
    throw new Error('areas: expected a non-empty 2D array');
  }
  const rows = areas.length;
  const cols = (areas[0] as string[]).length;
  if (cols === 0) throw new Error('areas: rows must have at least one column');

  // Check uniform row lengths
  for (let r = 0; r < rows; r++) {
    if ((areas[r] as string[]).length !== cols) {
      throw new Error(`areas: row ${r} has ${(areas[r] as string[]).length} cols, expected ${cols}`);
    }
  }

  // Collect all unique names and their bounding boxes
  interface Box { minR: number; maxR: number; minC: number; maxC: number; count: number; }
  const boxes = new Map<string, Box>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const name = (areas[r] as string[])[c] as string;
      if (name === '.' || name === '') continue;
      const box = boxes.get(name);
      if (!box) {
        boxes.set(name, { minR: r, maxR: r, minC: c, maxC: c, count: 1 });
      } else {
        box.minR = Math.min(box.minR, r);
        box.maxR = Math.max(box.maxR, r);
        box.minC = Math.min(box.minC, c);
        box.maxC = Math.max(box.maxC, c);
        box.count++;
      }
    }
  }

  // Verify each name's bounding box is fully filled (no non-contiguous cells)
  const rects: AreaRect[] = [];
  for (const [name, box] of boxes) {
    const expectedCount = (box.maxR - box.minR + 1) * (box.maxC - box.minC + 1);
    if (box.count !== expectedCount) {
      throw new Error(
        `areas: "${name}" is not a rectangle — cells at ` +
        `[${box.minR},${box.minC}]..[${box.maxR},${box.maxC}] ` +
        `have ${box.count} occurrences, expected ${expectedCount}`,
      );
    }
    // Defense in depth: verify every cell in the bounding box has this name.
    // Mathematically redundant given the count check, but explicit.
    /* istanbul ignore next — unreachable when count check passes */
    for (let r = box.minR; r <= box.maxR; r++) {
      for (let c = box.minC; c <= box.maxC; c++) {
        const cellName = (areas[r] as string[])[c];
        if (cellName !== name) {
          throw new Error(
            `areas: "${name}" overlaps or is interrupted by "${cellName}" at [${r},${c}]`,
          );
        }
      }
    }
    rects.push({
      name,
      row: box.minR,
      col: box.minC,
      rowSpan: box.maxR - box.minR + 1,
      colSpan: box.maxC - box.minC + 1,
    });
  }

  return rects;
};

/**
 * Render a set of named blocks according to a CSS Grid-style area layout.
 *
 * @example
 * ```js
 * panels.gridAreas(
 *   { header: '...', main: '...', sidebar: '...', footer: '...' },
 *   {
 *     areas: [
 *       ['header',  'header', 'header'],
 *       ['sidebar', 'main',   'main'  ],
 *       ['footer',  'footer', 'footer'],
 *     ],
 *   }
 * );
 * ```
 *
 * @since 1.4.4
 */
export const gridAreas = (
  blocksByName: Record<string, string>,
  opts: GridAreasOptions,
): string => {
  if (!opts || !Array.isArray(opts.areas)) return '';

  const rects = _validateAreas(opts.areas);
  const columns = (opts.areas[0] as string[]).length;

  const sorted = [...rects].sort((a, b) => (a.row - b.row) || (a.col - b.col));
  const blocks: string[] = [];
  const colSpan: number[] = [];
  const rowSpan: number[] = [];
  for (const rect of sorted) {
    const content = blocksByName[rect.name];
    /* istanbul ignore next — missing name is defensive, replaced with '' */
    blocks.push(typeof content === 'string' ? content : '');
    colSpan.push(rect.colSpan);
    rowSpan.push(rect.rowSpan);
  }

  return grid(blocks, {
    columns,
    colSpan,
    rowSpan,
    gapX: opts.gapX ?? 1,
    gapY: opts.gapY ?? 0,
    cellWidth: opts.cellWidth ?? null,
    cellHeight: opts.cellHeight ?? null,
    alignX: opts.alignX ?? 'start',
    alignY: opts.alignY ?? 'start',
  });
};
