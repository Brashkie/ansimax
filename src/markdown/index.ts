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
//  v1.4.5 — Added syntax highlighting module:
//    - syntax.ts         ← highlight, tokenize, isHighlightSupported
//
//  This file re-exports everything that was public before, so external
//  imports are 100% backward-compatible with v1.4.4.
// ─────────────────────────────────────────────

// Public types
export type {
  MarkdownTheme, MarkdownOptions, InlineOptions, Block, ListItem, LinkRef,
  // v1.4.11
  MarkdownPalette, FootnoteState,
} from './types.js';
export type { TokenKind, Token } from './syntax.js';

// Parsing
export { parseBlocks, collectLinkRefs, normalizeRefLabel, collectFootnotes } from './block-parser.js';

// v1.4.11 — theme registry
export {
  registerMarkdownTheme, unregisterMarkdownTheme, listMarkdownThemes,
  hasMarkdownTheme, clearMarkdownThemes, resolveTheme,
} from './theme.js';
export { parseInline } from './inline-parser.js';

// Rendering
export { render } from './renderer.js';

// v1.4.5 — Syntax highlighting
export { highlight, tokenize, isHighlightSupported } from './syntax.js';

// ─────────────────────────────────────────────
//  Namespace (used by the main ansimax barrel + default export)
// ─────────────────────────────────────────────

import { parseBlocks as _parseBlocks } from './block-parser.js';
import { parseInline as _parseInline } from './inline-parser.js';
import { render as _render } from './renderer.js';
import { highlight as _highlight, tokenize as _tokenize, isHighlightSupported as _isSup } from './syntax.js';
import {
  resolveTheme as _resolveTheme,
  registerMarkdownTheme as _registerTheme,
  unregisterMarkdownTheme as _unregisterTheme,
  listMarkdownThemes as _listThemes,
  hasMarkdownTheme as _hasTheme,
  clearMarkdownThemes as _clearThemes,
} from './theme.js';
import { collectFootnotes as _collectFootnotes } from './block-parser.js';

/**
 * Markdown → terminal renderer. Use `markdown.render(source, opts?)` to
 * convert a markdown string to an ANSI-styled string ready for
 * `console.log` or `process.stdout.write`.
 *
 * Lower-level helpers `parseBlocks` and `parseInline` are also exposed
 * for advanced use cases (custom block handlers, partial rendering).
 *
 * v1.4.5 — Adds syntax highlighting for code blocks via `highlight`,
 * `tokenize`, and `isHighlightSupported`.
 *
 * @since 1.4.0
 */
export const markdown = {
  render: _render,
  parseBlocks: _parseBlocks,
  parseInline: _parseInline,
  // v1.4.5
  highlight: _highlight,
  tokenize: _tokenize,
  isHighlightSupported: _isSup,
  // v1.4.11 — theme registry + footnotes
  registerTheme: _registerTheme,
  unregisterTheme: _unregisterTheme,
  listThemes: _listThemes,
  hasTheme: _hasTheme,
  clearThemes: _clearThemes,
  resolveTheme: _resolveTheme,
  collectFootnotes: _collectFootnotes,
};

export default markdown;
