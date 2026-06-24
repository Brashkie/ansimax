// ─────────────────────────────────────────────
//  ansimax/markdown — Markdown → terminal renderer
//
//  v1.4.0 — Phase 4 (final): markdown rendering
//
//  Supports the most-used Markdown features for terminal display:
//
//    Headings           # H1 .. ###### H6        → colored + sized
//    Paragraphs         (any non-block text)     → flowed prose
//    Bold               **text** / __text__      → color.bold
//    Italic             *text* / _text_          → color.italic
//    Strikethrough      ~~text~~                 → color.strikethrough
//    Inline code        `code`                   → dim background tint
//    Links              [label](url)             → OSC 8 hyperlink
//    Code blocks        ```lang\n...\n```        → boxed + monospace
//    Lists              - item / * item / 1.     → tree-rendered
//    Blockquotes        > quoted                 → indented + dim
//    Tables             | a | b |\n|---|---|     → components.table
//    Horizontal rules   --- / *** / ___          → ascii.divider
//
//  Design constraints:
//   - Zero runtime dependencies (uses existing ansimax primitives)
//   - Pure functions — parser is deterministic
//   - Single-pass parsing (line-by-line, then inline)
//   - No regex backtracking — all patterns are anchored
//   - Graceful degradation — malformed markdown renders as plain text
// ─────────────────────────────────────────────

import { color, gradient } from '../colors/index.js';
import { ascii } from '../ascii/index.js';
import { components } from '../components/index.js';
import { hyperlink } from '../utils/ansi.js';
import { visibleLen, isFiniteNumber } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Types
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

/** Block-level token after parsing the markdown into structural pieces. */
type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'codeblock'; lang: string; code: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'blank' };

// ─────────────────────────────────────────────
//  Theme palette
// ─────────────────────────────────────────────

const THEMES: Record<MarkdownTheme, {
  h1: string[];                // h1 gradient
  h2: string;                  // h2 single color
  h3: string;
  h4: string;
  h5: string;
  h6: string;
  code: string;                // inline code text
  codeBlockBorder: string;     // code-block frame color
  link: string;
  blockquote: string;
  hr: string;
  tableHeader: string;
}> = {
  dark: {
    h1: ['#ff79c6', '#bd93f9', '#8be9fd'],
    h2: '#bd93f9',
    h3: '#8be9fd',
    h4: '#50fa7b',
    h5: '#f1fa8c',
    h6: '#ffb86c',
    code: '#ff79c6',
    codeBlockBorder: '#6272a4',
    link: '#8be9fd',
    blockquote: '#6272a4',
    hr: '#6272a4',
    tableHeader: '#bd93f9',
  },
  light: {
    h1: ['#d63384', '#6f42c1', '#0d6efd'],
    h2: '#6f42c1',
    h3: '#0d6efd',
    h4: '#198754',
    h5: '#664d03',
    h6: '#fd7e14',
    code: '#d63384',
    codeBlockBorder: '#adb5bd',
    link: '#0d6efd',
    blockquote: '#6c757d',
    hr: '#adb5bd',
    tableHeader: '#6f42c1',
  },
};

// ─────────────────────────────────────────────
//  Block parser
//
//  Strategy: scan line-by-line. Track multi-line state for code blocks,
//  lists, tables. Emit blocks in document order.
// ─────────────────────────────────────────────

/* istanbul ignore next — defensive newline normalization */
const _normalize = (text: string): string =>
  typeof text === 'string'
    ? text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : '';

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const ORDERED_LIST_RE = /^(\s*)(\d+)[.)]\s+(.+)$/;
const UNORDERED_LIST_RE = /^(\s*)[-*+]\s+(.+)$/;
const HR_RE = /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
const CODEBLOCK_OPEN_RE = /^```[ \t]*(\S*)[ \t]*$/;
const CODEBLOCK_CLOSE_RE = /^```\s*$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const TABLE_SEPARATOR_RE = /^\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/;
const TABLE_ROW_RE = /^\|.*\|[ \t]*$/;

/**
 * Parse markdown source into a flat sequence of block tokens.
 * Tokens contain raw inline text — inline parsing happens at render time.
 *
 * @since 1.4.0
 */
export const parseBlocks = (source: string): Block[] => {
  // v1.4.0 — defensive: empty or non-string input → no blocks at all.
  // Without this guard, ''.split('\n') yields [''] which would emit a
  // spurious 'blank' block.
  if (typeof source !== 'string' || source.length === 0) return [];

  const lines = _normalize(source).split('\n');
  const out: Block[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;

    // ── Blank line ──
    if (line.trim() === '') {
      out.push({ type: 'blank' });
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (HR_RE.test(line)) {
      out.push({ type: 'hr' });
      i++;
      continue;
    }

    // ── Heading ──
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      const level = (headingMatch[1] as string).length;
      const text = (headingMatch[2] as string).trim();
      out.push({ type: 'heading', level, text });
      i++;
      continue;
    }

    // ── Code block ──
    const codeOpen = CODEBLOCK_OPEN_RE.exec(line);
    if (codeOpen) {
      const lang = (codeOpen[1] as string).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !CODEBLOCK_CLOSE_RE.test(lines[i] as string)) {
        codeLines.push(lines[i] as string);
        i++;
      }
      // Skip the closing ``` (or EOF — both fine)
      if (i < lines.length) i++;
      out.push({ type: 'codeblock', lang, code: codeLines.join('\n') });
      continue;
    }

    // ── Blockquote (consecutive `> ` lines merge) ──
    if (BLOCKQUOTE_RE.test(line)) {
      const qLines: string[] = [];
      while (i < lines.length && BLOCKQUOTE_RE.test(lines[i] as string)) {
        const m = BLOCKQUOTE_RE.exec(lines[i] as string);
        qLines.push((m?.[1] ?? '').trim());
        i++;
      }
      out.push({ type: 'blockquote', text: qLines.join('\n') });
      continue;
    }

    // ── Table (header row + separator + rows) ──
    // Must look ahead: line[i] is a row, line[i+1] is a separator
    if (TABLE_ROW_RE.test(line) && i + 1 < lines.length
        && TABLE_SEPARATOR_RE.test(lines[i + 1] as string)) {
      const headers = _splitTableRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && TABLE_ROW_RE.test(lines[i] as string)) {
        rows.push(_splitTableRow(lines[i] as string));
        i++;
      }
      out.push({ type: 'table', headers, rows });
      continue;
    }

    // ── List (ordered or unordered, consecutive items merge) ──
    const ulMatch = UNORDERED_LIST_RE.exec(line);
    const olMatch = ORDERED_LIST_RE.exec(line);
    if (ulMatch || olMatch) {
      const ordered = olMatch != null;
      const items: string[] = [];
      while (i < lines.length) {
        const ln = lines[i] as string;
        const u = UNORDERED_LIST_RE.exec(ln);
        const o = ORDERED_LIST_RE.exec(ln);
        if (ordered && o) {
          items.push((o[3] as string).trim());
          i++;
        } else if (!ordered && u) {
          items.push((u[2] as string).trim());
          i++;
        } else {
          break;
        }
      }
      out.push({ type: 'list', ordered, items });
      continue;
    }

    // ── Paragraph (consecutive non-blank lines merge with space) ──
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const next = lines[i] as string;
      // Stop on blank, heading, list, code fence, blockquote, hr, table
      if (next.trim() === ''
          || HEADING_RE.test(next)
          || HR_RE.test(next)
          || CODEBLOCK_OPEN_RE.test(next)
          || BLOCKQUOTE_RE.test(next)
          || UNORDERED_LIST_RE.test(next)
          || ORDERED_LIST_RE.test(next)
          || TABLE_ROW_RE.test(next)) {
        break;
      }
      paraLines.push(next);
      i++;
    }
    out.push({ type: 'paragraph', text: paraLines.join(' ').trim() });
  }

  return out;
};

/** Split a `| col1 | col2 | col3 |` row into trimmed cells. */
const _splitTableRow = (row: string): string[] => {
  // Strip leading/trailing |, then split
  const stripped = row.trim().replace(/^\|/, '').replace(/\|[ \t]*$/, '');
  return stripped.split('|').map((c) => c.trim());
};

// ─────────────────────────────────────────────
//  Inline parser
//
//  Recursively replaces inline markup with ANSI-styled spans. Order
//  matters — code spans first (so backticks inside other markup don't
//  trigger), then links, then emphasis.
// ─────────────────────────────────────────────

/**
 * Apply inline markdown markup (bold/italic/code/links/etc.) to a string.
 *
 * @since 1.4.0
 */
export const parseInline = (
  text: string,
  opts: { theme: MarkdownTheme; inlineCodeBackground: boolean } = {
    theme: 'dark', inlineCodeBackground: true,
  },
): string => {
  if (typeof text !== 'string' || text.length === 0) return '';
  const t = THEMES[opts.theme];

  // Step 1: Inline code (highest priority — protects content inside)
  // Placeholders prevent further parsing of code contents.
  const codeSlots: string[] = [];
  let s = text.replace(/`([^`\n]+)`/g, (_m, code) => {
    const styled = opts.inlineCodeBackground
      ? color.dim(color.hex(t.code)('\u00A0' + code + '\u00A0'))
      : color.dim(color.hex(t.code)(code));
    codeSlots.push(styled);
    return `\x00CODE${codeSlots.length - 1}\x00`;
  });

  // Step 2: Links [label](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    return hyperlink(url, color.hex(t.link)(color.underline(label)));
  });

  // Step 3: Strikethrough ~~text~~
  s = s.replace(/~~([^~\n]+)~~/g, (_m, inner: string) => color.strikethrough(inner));

  // Step 4: Bold **text** or __text__ (must be before italic to avoid greedy matches)
  s = s.replace(/\*\*([^*\n]+)\*\*/g, (_m, inner: string) => color.bold(inner));
  s = s.replace(/__([^_\n]+)__/g, (_m, inner: string) => color.bold(inner));

  // Step 5: Italic *text* or _text_ (only single asterisk/underscore not yet consumed)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_m, pre: string, inner: string) => pre + color.italic(inner));
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, (_m, pre: string, inner: string) => pre + color.italic(inner));

  // Step 6: Restore code placeholders
  s = s.replace(/\x00CODE(\d+)\x00/g, (_m, idx: string) => codeSlots[Number(idx)] ?? '');

  return s;
};

// ─────────────────────────────────────────────
//  Renderer
// ─────────────────────────────────────────────

/** Try to get terminal width; fall back to 80. */
const _detectWidth = (): number => {
  /* istanbul ignore next — process.stdout.columns is environment-dependent */
  const w = process.stdout?.columns;
  return isFiniteNumber(w) && w > 10 ? w : 80;
};

/**
 * Render a markdown source string to a terminal-ready string with ANSI
 * styling. Handles headings, paragraphs, code blocks, lists, blockquotes,
 * tables, inline emphasis, links, and horizontal rules.
 *
 * @example
 * ```ts
 * import { markdown } from 'ansimax';
 *
 * const out = markdown.render(`
 * # Welcome
 *
 * This is **bold** with \`inline code\` and [a link](https://example.com).
 *
 * - First item
 * - Second item
 *
 * \`\`\`js
 * const x = 42;
 * \`\`\`
 * `);
 *
 * console.log(out);
 * ```
 *
 * @since 1.4.0
 */
export const render = (source: string, opts: MarkdownOptions = {}): string => {
  if (typeof source !== 'string' || source.length === 0) return '';

  const {
    width = _detectWidth(),
    theme = 'dark',
    headingGradient,
    boxCodeBlocks = true,
    inlineCodeBackground = true,
  } = opts;

  const safeWidth = isFiniteNumber(width) && width > 4 ? Math.floor(width) : 80;
  const t = THEMES[theme] ?? THEMES.dark;
  const h1Colors = headingGradient && headingGradient.length >= 2 ? headingGradient : t.h1;

  const blocks = parseBlocks(source);
  const inlineOpts = { theme, inlineCodeBackground };

  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'blank':
        out.push('');
        break;

      case 'hr':
        out.push(color.hex(t.hr)(ascii.divider({ width: safeWidth, char: '─' })));
        break;

      case 'heading': {
        const inline = parseInline(block.text, inlineOpts);
        if (block.level === 1) {
          // h1: gradient + bold
          out.push(color.bold(gradient(inline, h1Colors)));
        } else if (block.level === 2) {
          // h2: solid color + underline
          out.push(color.bold(color.underline(color.hex(t.h2)(inline))));
        } else {
          // h3-h6: solid color + bold
          const colorKey = (`h${block.level}` as 'h3' | 'h4' | 'h5' | 'h6');
          const hex = t[colorKey];
          out.push(color.bold(color.hex(hex)(inline)));
        }
        break;
      }

      case 'paragraph': {
        out.push(parseInline(block.text, inlineOpts));
        break;
      }

      case 'codeblock': {
        // We deliberately do NOT process inline markup inside code blocks.
        const codeText = block.code.length > 0 ? block.code : ' ';
        if (boxCodeBlocks) {
          const labeled = block.lang ? ` ${block.lang} ` : null;
          const box = ascii.box(codeText, {
            borderStyle: 'rounded',
            padding: 1,
            title: labeled,
          });
          out.push(color.hex(t.codeBlockBorder)(box));
        } else {
          // Indented dim variant
          const indented = codeText.split('\n').map((l) => '    ' + l).join('\n');
          out.push(color.dim(indented));
        }
        break;
      }

      case 'list': {
        const lines: string[] = [];
        for (let idx = 0; idx < block.items.length; idx++) {
          const marker = block.ordered ? `${idx + 1}.` : '•';
          const rendered = parseInline(block.items[idx] as string, inlineOpts);
          lines.push(`  ${color.hex(t.h3)(marker)} ${rendered}`);
        }
        out.push(lines.join('\n'));
        break;
      }

      case 'blockquote': {
        const rendered = parseInline(block.text, inlineOpts);
        const quoted = rendered
          .split('\n')
          .map((l) => color.hex(t.blockquote)('│ ') + color.dim(l))
          .join('\n');
        out.push(quoted);
        break;
      }

      case 'table': {
        // Reuse components.table — but apply inline markup to every cell
        const styledHeaders = block.headers.map((h) =>
          color.bold(color.hex(t.tableHeader)(parseInline(h, inlineOpts))),
        );
        const styledRows = block.rows.map((row) =>
          row.map((cell) => parseInline(cell, inlineOpts)),
        );
        out.push(components.table([styledHeaders, ...styledRows], {
          borderStyle: 'rounded',
          padding: 1,
        }));
        break;
      }
    }
  }

  // Collapse trailing blanks, preserve internal structure
  while (out.length > 0 && out[out.length - 1] === '') out.pop();

  return out.join('\n');
};

// ─────────────────────────────────────────────
//  Public namespace
// ─────────────────────────────────────────────

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
  render,
  parseBlocks,
  parseInline,
};

export default markdown;
