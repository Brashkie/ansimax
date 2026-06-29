// ─────────────────────────────────────────────
//  ansimax/markdown — Inline markup parser
//
//  v1.4.1 — Split out from index.ts.
//  v1.4.3 — CommonMark backslash escapes (\*, \_, \`, \\, \[, ], ~).
//
//  Recursively replaces inline markup with ANSI-styled spans. Order
//  matters — escapes first (protect literal chars), then code spans
//  (protect contents from further parsing), then links, then emphasis.
//
//  Precedence (highest → lowest):
//     0. Escapes        \*, \_, \`, \\, \[, \], \~  ← protect literal chars
//     1. Inline code   `…`                          ← protects contents
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
 * Characters that have special meaning in markdown. A leading backslash
 * escapes them — they render literally and don't trigger markup.
 *
 * Per CommonMark spec §6.1: ASCII punctuation can be escaped. We support
 * the markdown-significant subset that ansimax handles:
 *
 *     \  `  *  _  ~  [  ]
 *
 * Other punctuation (`\.`, `\?`, etc.) passes through with the backslash
 * intact — matches what most renderers do for non-markup chars.
 *
 * @since 1.4.3
 */
const ESCAPABLE_CHARS = new Set(['\\', '`', '*', '_', '~', '[', ']']);
const ESCAPE_RE = /\\([\s\S])/g;

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

  // ── Step 0: CommonMark backslash escapes (v1.4.3) ──
  // `\X` → placeholder. Restored literal at the end so X never triggers
  // markup. Non-escapable X (e.g. `\?`) passes through with backslash.
  const escapeSlots: string[] = [];
  let s = text.replace(ESCAPE_RE, (full, ch: string) => {
    if (ESCAPABLE_CHARS.has(ch)) {
      escapeSlots.push(ch);
      return `\x00ESC${escapeSlots.length - 1}\x00`;
    }
    return full;   // pass through (e.g. \. stays \.)
  });

  // ── Step 1: Inline code ──
  // Placeholders prevent further parsing of code contents.
  const codeSlots: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    // Inside code spans, restore any escape placeholders so the user
    // sees the literal character they wrote (CommonMark behavior).
    const restored = code.replace(/\x00ESC(\d+)\x00/g, (_, idx: string) =>
      /* istanbul ignore next — placeholder slot is always valid by construction */
      escapeSlots[Number(idx)] ?? '');
    const styled = opts.inlineCodeBackground
      ? color.dim(color.hex(t.code)('\u00A0' + restored + '\u00A0'))
      : color.dim(color.hex(t.code)(restored));
    codeSlots.push(styled);
    return `\x00CODE${codeSlots.length - 1}\x00`;
  });

  // ── Step 2: Links [label](url) ──
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    return hyperlink(url, color.hex(t.link)(color.underline(label)));
  });

  // ── Step 3: Strikethrough ~~text~~ ──
  s = s.replace(/~~([^~\n]+)~~/g, (_m, inner: string) => color.strikethrough(inner));

  // ── Step 4: Bold **text** or __text__ ──
  s = s.replace(/\*\*([^*\n]+)\*\*/g, (_m, inner: string) => color.bold(inner));
  s = s.replace(/__([^_\n]+)__/g, (_m, inner: string) => color.bold(inner));

  // ── Step 5: Italic *text* or _text_ ──
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, (_m, pre: string, inner: string) => pre + color.italic(inner));
  s = s.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, (_m, pre: string, inner: string) => pre + color.italic(inner));

  // ── Step 6: Restore code placeholders ──
  /* istanbul ignore next — placeholder slot is always valid by construction */
  s = s.replace(/\x00CODE(\d+)\x00/g, (_m, idx: string) => codeSlots[Number(idx)] ?? '');

  // ── Step 7: Restore escape placeholders (literal characters) ──
  /* istanbul ignore next — placeholder slot is always valid by construction */
  s = s.replace(/\x00ESC(\d+)\x00/g, (_m, idx: string) => escapeSlots[Number(idx)] ?? '');

  return s;
};
