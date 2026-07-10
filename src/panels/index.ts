// ─────────────────────────────────────────────
//  ansimax/panels — Public API barrel
//
//  v1.4.5 — Refactored from a single 1116-line file into 6 focused
//  modules:
//    - types.ts        ← public types (Alignment, all Options, Cell, AreaRect)
//    - helpers.ts      ← internal string manipulation helpers
//    - split.ts        ← vsplit + hsplit
//    - layout.ts       ← center + frame
//    - grid.ts         ← grid (decomposed into 3 phases: resolve, pack, render)
//    - grid-areas.ts   ← gridAreas + _validateAreas
//    - index.ts        ← this file: re-exports + `panels` namespace
//
//  External imports are 100% backward-compatible with v1.4.4.
// ─────────────────────────────────────────────

// Public types
export type {
  Alignment,
  VsplitOptions,
  HsplitOptions,
  CenterOptions,
  FrameOptions,
  GridOptions,
  GridAreasOptions,
  AreaRect,
  FlexOptions,
  FlexJustify,
} from './types.js';

// Split
export { vsplit, hsplit } from './split.js';

// Layout
export { center, frame } from './layout.js';

// Flex (v1.4.7)
export { flex } from './flex.js';

// Grid + areas
export { grid } from './grid.js';
export { gridAreas, _validateAreas } from './grid-areas.js';

// ─────────────────────────────────────────────
//  Namespace (used by the main ansimax barrel + default export)
// ─────────────────────────────────────────────

import { vsplit as _vsplit, hsplit as _hsplit } from './split.js';
import { center as _center, frame as _frame } from './layout.js';
import { flex as _flex } from './flex.js';
import { grid as _grid } from './grid.js';
import { gridAreas as _gridAreas } from './grid-areas.js';

export const panels = {
  vsplit: _vsplit,
  hsplit: _hsplit,
  // v1.3.1
  center: _center,
  frame: _frame,
  // v1.3.3
  grid: _grid,
  // v1.4.4
  gridAreas: _gridAreas,
  // v1.4.7
  flex: _flex,
};

export default panels;
