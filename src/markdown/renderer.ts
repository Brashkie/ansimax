// ─────────────────────────────────────────────
//  ansimax/markdown — Block → terminal renderer
//
//  v1.4.1 — Split out from index.ts.
//
//  Consumes block tokens from `block-parser.ts` and inline-parses each
//  block's text via `inline-parser.ts`. Dispatches each block type to
//  the appropriate ansimax primitive:
//
//    heading  → gradient (h1) / color.hex (h2-h6) + bold/underline
//    paragraph → parseInline only
//    codeblock → ascii.box OR indented dim
//    list     → indented bullets with parseInline on each item
//    blockquote → │ prefix + dim + parseInline
//    table    → components.table with styled headers/cells
//    hr       → ascii.divider tinted with theme.hr
// ─────────────────────────────────────────────

import { color, gradient } from '../colors/index.js';
import { ascii } from '../ascii/index.js';
import { components } from '../components/index.js';
import { isFiniteNumber } from '../utils/helpers.js';
import type { MarkdownOptions, InlineOptions, ListItem, FootnoteState } from './types.js';
import { resolveTheme } from './theme.js';
import type { MarkdownPalette } from './types.js';
import { parseBlocks, collectLinkRefs, collectFootnotes } from './block-parser.js';
import { parseInline } from './inline-parser.js';
import { highlight, isHighlightSupported } from './syntax.js';

/** Try to get terminal width; fall back to 80. */
/* istanbul ignore next — process.stdout.columns is environment-dependent
   and never deterministic in test runners */
const _detectWidth = (): number => {
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
    htmlMode = 'strip',
    inlineCodeBackground = true,
  } = opts;

  const safeWidth = isFiniteNumber(width) && width > 4 ? Math.floor(width) : 80;
  // v1.4.11 — resolveTheme also honors runtime-registered themes
  const t = resolveTheme(theme);
  const h1Colors = headingGradient && headingGradient.length >= 2 ? headingGradient : t.h1;

  // v1.4.11 — collect footnote definitions FIRST. Both footnote and
  // link-reference definitions end in `]:`, so stripping footnotes up front
  // keeps the two passes independent.
  const { defs: footnoteDefs, cleaned: withoutFootnotes } = collectFootnotes(source);

  // v1.4.7 — collect reference-link definitions and strip them from the
  // source before block parsing, so `[ref]: url` lines don't render.
  const { refs, cleaned } = collectLinkRefs(withoutFootnotes);

  // Shared numbering state — the inline parser appends to `order` as it
  // meets each `[^label]`, which is what fixes the printed numbers.
  const footnotes: FootnoteState = { defs: footnoteDefs, order: [] };

  const blocks = parseBlocks(cleaned);
  const inlineOpts: InlineOptions = {
    theme, inlineCodeBackground, linkRefs: refs, footnotes,
  };

  const out: string[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case 'blank':
        out.push('');
        break;

      case 'hr':
        out.push(color.hex(t.hr)(ascii.divider({ width: safeWidth, char: '─' })));
        break;

      // v1.4.11 — Raw HTML block. A terminal has no HTML engine, so the
      // block is stripped (default), printed verbatim, or dropped.
      case 'html': {
        if (htmlMode === 'hide') break;
        if (htmlMode === 'raw') {
          out.push(color.dim(block.content));
          break;
        }
        // 'strip' — drop tags and comments, keep the readable text.
        const stripped = block.content
          .replace(/<!--[\s\S]*?-->/g, '')   // comments first (may span lines)
          .replace(/<[^>]*>/g, '')            // then tags
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
          .join('\n');
        if (stripped.length > 0) out.push(parseInline(stripped, inlineOpts));
        break;
      }

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
        // v1.4.5: apply syntax highlighting if language is supported.
        // Highlighting happens BEFORE ascii.box wraps it, so ANSI escapes
        // for tokens live inside the box border.
        const rawCode = block.code.length > 0 ? block.code : ' ';
        const codeText = block.lang && isHighlightSupported(block.lang)
          ? highlight(rawCode, block.lang, theme)
          : rawCode;

        if (boxCodeBlocks) {
          const labeled = block.lang ? ` ${block.lang} ` : null;
          const box = ascii.box(codeText, {
            borderStyle: 'rounded',
            padding: 1,
            title: labeled,
          });
          out.push(color.hex(t.codeBlockBorder)(box));
        } else {
          // Indented variant — no border tinting, but keep highlight colors
          const indented = codeText.split('\n').map((l) => '    ' + l).join('\n');
          // Only dim when NOT highlighted (dim would wash out our token colors)
          out.push(block.lang && isHighlightSupported(block.lang)
            ? indented
            : color.dim(indented));
        }
        break;
      }

      case 'list': {
        // v1.4.3: recursive renderer with depth-based indentation.
        out.push(_renderList(block, inlineOpts, t, 0));
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

  // v1.4.11 — Footnote section. `footnotes.order` was populated by the
  // inline parser in first-reference order, so indices here match the
  // markers printed in the body. Only referenced footnotes are listed;
  // a definition nobody cites is silently dropped (GFM does the same).
  //
  // Note the loop re-reads `order.length` each pass on purpose: rendering a
  // footnote can cite another one, which appends to `order` and gets picked
  // up in a later iteration. This terminates because a label is appended
  // only the first time it is seen, so `order.length <= defs.size`; a cycle
  // (`[^a]: see [^b]` / `[^b]: see [^a]`) resolves both and stops.
  if (footnotes.order.length > 0) {
    while (out.length > 0 && out[out.length - 1] === '') out.pop();
    out.push('');
    out.push(color.hex(t.hr)('─'.repeat(Math.min(safeWidth, 40))));
    for (let i = 0; i < footnotes.order.length; i++) {
      const label = footnotes.order[i] as string;
      const text = footnotes.defs.get(label) ?? '';
      const marker = color.hex(t.link)(`[${i + 1}]`);
      out.push(`${marker} ${parseInline(text, inlineOpts)}`);
    }
  }

  // Collapse trailing blanks, preserve internal structure
  while (out.length > 0 && out[out.length - 1] === '') out.pop();

  return out.join('\n');
};

// ─────────────────────────────────────────────
//  v1.4.3 — Recursive nested list renderer
// ─────────────────────────────────────────────

/** Indent unit per nesting depth (2 spaces). */
const _LIST_INDENT = '  ';

/** Bullet rotation per depth: cycles through 4 distinct shapes. */
const BULLETS: readonly [string, string, string, string] = ['•', '◦', '▪', '▫'];

/**
 * Recursively render a list and its sublists with depth-aware indentation
 * and marker rotation. Outer level uses solid markers; deeper levels
 * cycle through alternating characters so visual grouping is clear.
 *
 * @since 1.4.3
 */
const _renderList = (
  block: { ordered: boolean; items: ListItem[] },
  inlineOpts: InlineOptions,
  t: MarkdownPalette,
  depth: number,
): string => {
  const indent = _LIST_INDENT.repeat(depth + 1);

  const lines: string[] = [];
  for (let idx = 0; idx < block.items.length; idx++) {
    const item = block.items[idx] as ListItem;
    // BULLETS has length 4 → `depth % 4` ∈ [0,3] → tuple index always valid.
    const bulletIdx = (depth % 4) as 0 | 1 | 2 | 3;

    // v1.4.4: Task-list items get a checkbox instead of a bullet.
    // Rendered with a bright color for [x] to signal completion.
    let marker: string;
    if (item.checked === true) {
      marker = color.hex(t.h4)('[✓]');   // green-ish "done"
    } else if (item.checked === false) {
      marker = color.hex(t.blockquote)('[ ]');   // dim "pending"
    } else if (block.ordered) {
      marker = `${idx + 1}.`;
    } else {
      marker = BULLETS[bulletIdx];
    }

    const rendered = parseInline(item.text, inlineOpts);
    // Non-task items get the theme color on the marker; task items
    // already have their color baked in from above.
    const styledMarker = item.checked === undefined
      ? color.hex(t.h3)(marker)
      : marker;
    lines.push(`${indent}${styledMarker} ${rendered}`);

    // Recurse into children if present
    if (item.children && item.children.items.length > 0) {
      lines.push(_renderList(item.children, inlineOpts, t, depth + 1));
    }
  }
  return lines.join('\n');
};
