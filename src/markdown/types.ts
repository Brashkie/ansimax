// ─────────────────────────────────────────────
//  ansimax/markdown — Public types
//
//  v1.4.1 — Split out from index.ts to keep concerns separated.
//  Types live here so block-parser, inline-parser, and renderer can
//  reference them without cyclic imports.
// ─────────────────────────────────────────────

/** Visual theme for rendered output. */
export type MarkdownTheme = 'dark' | 'light';

export interface MarkdownOptions {
  /**
   * Maximum width in columns. Long lines wrap. Default: terminal width
   * or 80 if unavailable.
   */
  width?: number;
  /**
   * Color theme. `'dark'` (default) uses bright colors for dark backgrounds.
   * `'light'` uses dimmer/contrast colors for light backgrounds.
   */
  theme?: MarkdownTheme;
  /**
   * Override the gradient used for top-level (`# H1`) headings. Receives
   * a list of hex colors. Default uses the dracula palette.
   */
  headingGradient?: string[];
  /**
   * Render code blocks inside an ASCII box. Default `true`. If `false`,
   * code blocks render as indented dim text.
   */
  boxCodeBlocks?: boolean;
  /**
   * Inline code background tint. Default `true`. If `false`, inline code
   * shows only as dim text (cleaner in some terminals).
   */
  inlineCodeBackground?: boolean;
}

/**
 * Internal options shape passed to `parseInline`. Exposed for advanced
 * use cases that bypass `render` (custom block handlers, etc.).
 *
 * @since 1.4.0
 */
export interface InlineOptions {
  theme: MarkdownTheme;
  inlineCodeBackground: boolean;
}

/**
 * Block-level token after parsing the markdown into structural pieces.
 * Tokens contain raw inline text — inline parsing happens at render time.
 *
 * **v1.4.3**: `list.items` is now `ListItem[]` (recursive). Each item
 * carries its own text plus an optional `children` sublist. Older code
 * that treated `items` as `string[]` should access `item.text` per entry.
 *
 * @since 1.4.0
 */
export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'codeblock'; lang: string; code: string }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'blockquote'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'blank' };

/**
 * A single list entry. May contain a nested sublist via `children` (a
 * full `list` Block). Nesting depth is bounded only by indentation.
 *
 * **v1.4.4**: adds optional `checked` for GFM-style task list items.
 * When set, the item was written as `- [ ]` (false) or `- [x]` (true).
 * Regular list items leave it `undefined`.
 *
 * @since 1.4.3
 */
export interface ListItem {
  text: string;
  children?: { ordered: boolean; items: ListItem[] };
  /** @since 1.4.4 — GFM task list state; `undefined` for non-task items. */
  checked?: boolean;
}
