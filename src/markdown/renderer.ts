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
import type { MarkdownOptions, InlineOptions, ListItem } from './types.js';
import { THEMES, type ThemePalette } from './theme.js';
import { parseBlocks } from './block-parser.js';
import { parseInline } from './inline-parser.js';

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
    inlineCodeBackground = true,
  } = opts;

  const safeWidth = isFiniteNumber(width) && width > 4 ? Math.floor(width) : 80;
  const t = THEMES[theme] ?? THEMES.dark;
  const h1Colors = headingGradient && headingGradient.length >= 2 ? headingGradient : t.h1;

  const blocks = parseBlocks(source);
  const inlineOpts: InlineOptions = { theme, inlineCodeBackground };

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
  t: ThemePalette,
  depth: number,
): string => {
  const indent = _LIST_INDENT.repeat(depth + 1);

  const lines: string[] = [];
  for (let idx = 0; idx < block.items.length; idx++) {
    const item = block.items[idx] as ListItem;
    // BULLETS has length 4 → `depth % 4` ∈ [0,3] → tuple index always valid.
    const bulletIdx = (depth % 4) as 0 | 1 | 2 | 3;
    const marker = block.ordered ? `${idx + 1}.` : BULLETS[bulletIdx];
    const rendered = parseInline(item.text, inlineOpts);
    lines.push(`${indent}${color.hex(t.h3)(marker)} ${rendered}`);

    // Recurse into children if present
    if (item.children && item.children.items.length > 0) {
      lines.push(_renderList(item.children, inlineOpts, t, depth + 1));
    }
  }
  return lines.join('\n');
};
