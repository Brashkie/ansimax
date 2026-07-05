// ─────────────────────────────────────────────
//  ansimax/panels — Internal helpers
//
//  v1.4.5 — Split out from index.ts.
//
//  Pure helper functions shared by split/, layout/, grid/.
//  All are ANSI-aware (use `visibleLen` for width measurement) and
//  operate on already-rendered string blocks.
// ─────────────────────────────────────────────

import { visibleLen, padEnd } from '../utils/helpers.js';
import type { Alignment } from './types.js';

/**
 * Split a multi-line block into lines, preserving ANSI escapes per line.
 * Returns the lines + the max visible width of any line.
 */
export const _splitBlock = (block: string): { lines: string[]; maxWidth: number } => {
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
export const _padLinesRight = (lines: string[], targetWidth: number): string[] => {
  return lines.map((line) => padEnd(line, targetWidth, ' '));
};

/**
 * Pad each line of a block to a fixed width with alignment.
 */
export const _padLinesAligned = (
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
export const _alignVertical = (
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

/**
 * Truncate or pad a block (multi-line string) to exactly `targetH` lines.
 * Padding adds blank lines at the bottom. Truncation cuts extra lines.
 *
 * @since 1.4.1
 */
export const _fitHeight = (block: string, targetH: number): string => {
  const lines = block.split('\n');
  if (lines.length === targetH) return block;
  if (lines.length > targetH) return lines.slice(0, targetH).join('\n');
  // Pad with empty lines
  const pad = Array<string>(targetH - lines.length).fill('');
  return [...lines, ...pad].join('\n');
};
