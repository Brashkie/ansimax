// ─────────────────────────────────────────────
//  ansimax/markdown — Inline markup parser
//
//  v1.4.1 — Split out from index.ts.
//
//  Recursively replaces inline markup with ANSI-styled spans. Order
//  matters — code spans first (so backticks inside other markup don't
//  trigger), then links, then emphasis.
//
//  Precedence (highest → lowest):
//     1. Inline code   `…`         ← protects contents from further parsing
//     2. Links         [label](url)
//     3. Strikethrough ~~text~~
//     4. Bold          **text** / __text__
//     5. Italic        *text* / _text_
// ─────────────────────────────────────────────

import { color } from '../colors/index.js';
import { hyperlink } from '../utils/ansi.js';
import type { InlineOptions } from './types.js';
import { THEMES } from './theme.js';

/**
 * Apply inline markdown markup (bold/italic/code/links/etc.) to a string.
 *
 * @since 1.4.0
 */
export const parseInline = (
  text: string,
  opts: InlineOptions = { theme: 'dark', inlineCodeBackground: true },
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
