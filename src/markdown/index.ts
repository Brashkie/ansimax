// ─────────────────────────────────────────────
//  ansimax/markdown — Public API barrel
//
//  v1.4.1 — Refactored from a single 522-line file into 4 focused
//  modules:
//    - types.ts          ← public types (MarkdownTheme, Block, …)
//    - theme.ts          ← color palettes per theme (private)
//    - block-parser.ts   ← parseBlocks
//    - inline-parser.ts  ← parseInline
//    - renderer.ts       ← render
//
//  This file re-exports everything that was public before, so external
//  imports are 100% backward-compatible with v1.4.0.
// ─────────────────────────────────────────────

// Public types
export type { MarkdownTheme, MarkdownOptions, InlineOptions, Block } from './types.js';

// Parsing
export { parseBlocks } from './block-parser.js';
export { parseInline } from './inline-parser.js';

// Rendering
export { render } from './renderer.js';

// ─────────────────────────────────────────────
//  Namespace (used by the main ansimax barrel + default export)
// ─────────────────────────────────────────────

import { parseBlocks as _parseBlocks } from './block-parser.js';
import { parseInline as _parseInline } from './inline-parser.js';
import { render as _render } from './renderer.js';

/**
 * Markdown → terminal renderer. Use `markdown.render(source, opts?)` to
 * convert a markdown string to an ANSI-styled string ready for
 * `console.log` or `process.stdout.write`.
 *
 * Lower-level helpers `parseBlocks` and `parseInline` are also exposed
 * for advanced use cases (custom block handlers, partial rendering).
 *
 * @since 1.4.0
 */
export const markdown = {
  render: _render,
  parseBlocks: _parseBlocks,
  parseInline: _parseInline,
};

export default markdown;
