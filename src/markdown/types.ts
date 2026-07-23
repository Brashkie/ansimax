// ─────────────────────────────────────────────
//  ansimax/markdown — Public types
//
//  v1.4.1 — Split out from index.ts to keep concerns separated.
//  Types live here so block-parser, inline-parser, and renderer can
//  reference them without cyclic imports.
// ─────────────────────────────────────────────

/**
 * Visual theme for rendered output.
 *
 * `'dark'` and `'light'` are built in. Any other string refers to a theme
 * registered at runtime via `registerMarkdownTheme()` — unknown names fall
 * back to `'dark'` rather than throwing.
 *
 * The `(string & {})` member keeps editor autocomplete for the built-ins
 * while still accepting arbitrary registered names.
 *
 * @since 1.4.11 — widened from `'dark' | 'light'`
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type MarkdownTheme = 'dark' | 'light' | (string & {});

/**
 * A complete markdown color palette. Every key is a hex color except `h1`,
 * which is a gradient (2+ stops).
 *
 * @since 1.4.11
 */
export interface MarkdownPalette {
  /** Heading 1 — rendered as a gradient across these stops (2+ required). */
  h1: string[];
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
  /** Inline `code` text color. */
  code: string;
  /** Fenced code-block frame color. */
  codeBlockBorder: string;
  link: string;
  blockquote: string;
  hr: string;
  tableHeader: string;
}

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
   * **v1.4.11** — How to handle raw HTML blocks (CommonMark §4.6):
   *
   * - `'strip'` (default) — remove the tags, keep the inner text
   * - `'raw'`   — print the HTML verbatim, dimmed
   * - `'hide'`  — drop the block entirely
   *
   * A terminal cannot render HTML, so stripping is the most useful
   * default: a `<div>note</div>` still shows its text.
   *
   * @since 1.4.11
   */
  htmlMode?: 'strip' | 'raw' | 'hide';
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
  /**
   * **v1.4.7** — Reference-link definitions collected at block level.
   * Maps a normalized (lowercased, trimmed) reference label to its URL
   * (and optional title). Used to resolve `[text][ref]` and `[ref]`
   * shortcut links. When omitted, reference links render as literal text.
   *
   * @since 1.4.7
   */
  linkRefs?: Map<string, LinkRef>;
  /**
   * **v1.4.11** — Footnote definitions plus the shared numbering state.
   * The inline parser mutates `order` as it encounters `[^label]`
   * references, so the renderer can emit a numbered footnote section.
   * When omitted, `[^label]` renders as literal text.
   *
   * @since 1.4.11
   */
  footnotes?: FootnoteState;
}

/**
 * A resolved reference-link definition (`[ref]: url "title"`).
 *
 * @since 1.4.7
 */
export interface LinkRef {
  url: string;
  title?: string;
}

/**
 * Shared mutable state for footnote numbering within a single `render()`
 * call.
 *
 * `defs` maps a normalized label to its definition text. `order` records
 * labels in the sequence they were **first referenced** — this is what
 * determines the printed number (GFM numbers footnotes by first use, not
 * by definition order), so a document defining `[^z]` before `[^a]` but
 * referencing `[^a]` first still prints `a` as `[1]`.
 *
 * @since 1.4.11
 */
export interface FootnoteState {
  defs: Map<string, string>;
  order: string[];
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
  /**
   * Raw HTML block (CommonMark §4.6). Terminal output has no HTML
   * renderer, so the content is passed through, stripped, or hidden
   * according to `MarkdownOptions.htmlMode`.
   *
   * @since 1.4.11
   */
  | { type: 'html'; content: string }
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
