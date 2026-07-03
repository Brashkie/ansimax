// ─────────────────────────────────────────────
//  ansimax/markdown — Block-level tokenizer
//
//  v1.4.1 — Split out from index.ts.
//
//  Strategy: scan line-by-line. Track multi-line state for code blocks,
//  lists, tables. Emit blocks in document order.
//
//  Constraints:
//   - All regexes anchored (^...$) — no backtracking
//   - Single-pass — never reread a line we've already consumed
//   - Empty / non-string input returns []
// ─────────────────────────────────────────────

import type { Block, ListItem } from './types.js';

// ─────────────────────────────────────────────
//  Regex patterns
// ─────────────────────────────────────────────

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
// v1.4.4 — Setext heading underlines
const SETEXT_H1_RE = /^[ \t]*={2,}[ \t]*$/;
const SETEXT_H2_RE = /^[ \t]*-{2,}[ \t]*$/;
const ORDERED_LIST_RE = /^(\s*)(\d+)[.)]\s+(.+)$/;
const UNORDERED_LIST_RE = /^(\s*)[-*+]\s+(.+)$/;
const HR_RE = /^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/;
const CODEBLOCK_OPEN_RE = /^```[ \t]*(\S*)[ \t]*$/;
const CODEBLOCK_CLOSE_RE = /^```\s*$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const TABLE_SEPARATOR_RE = /^\|?[ \t]*:?-{2,}:?[ \t]*(\|[ \t]*:?-{2,}:?[ \t]*)+\|?[ \t]*$/;
const TABLE_ROW_RE = /^\|.*\|[ \t]*$/;

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────

/* istanbul ignore next — defensive newline normalization */
const _normalize = (text: string): string =>
  typeof text === 'string'
    ? text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : '';

/** Split a `| col1 | col2 | col3 |` row into trimmed cells. */
const _splitTableRow = (row: string): string[] => {
  // Strip leading/trailing |, then split
  const stripped = row.trim().replace(/^\|/, '').replace(/\|[ \t]*$/, '');
  return stripped.split('|').map((c) => c.trim());
};

// ─────────────────────────────────────────────
//  Public: parseBlocks
// ─────────────────────────────────────────────

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

    // ── v1.4.4: Setext headings (text underlined by === or ---) ──
    // A setext heading requires:
    //   1. Current line has text content
    //   2. Next line is only `===` (h1) or `---` (h2)
    //   3. Current line is not another block type (heading, list, code, etc.)
    // Note: `---` may look like an HR; we check setext FIRST because the
    // heading interpretation is more specific.
    if (i + 1 < lines.length && !HEADING_RE.test(line)
        && !UNORDERED_LIST_RE.test(line)
        && !ORDERED_LIST_RE.test(line)
        && !CODEBLOCK_OPEN_RE.test(line)
        && !BLOCKQUOTE_RE.test(line)
        && !TABLE_ROW_RE.test(line)) {
      const nextLine = lines[i + 1] as string;
      if (SETEXT_H1_RE.test(nextLine)) {
        out.push({ type: 'heading', level: 1, text: line.trim() });
        i += 2;
        continue;
      }
      if (SETEXT_H2_RE.test(nextLine)) {
        out.push({ type: 'heading', level: 2, text: line.trim() });
        i += 2;
        continue;
      }
    }

    // ── Horizontal rule ──
    if (HR_RE.test(line)) {
      out.push({ type: 'hr' });
      i++;
      continue;
    }

    // ── Heading (ATX: `#` prefix) ──
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

    // ── List (ordered or unordered, with nesting via indentation) ──
    // v1.4.3: indented list items become sublists. Indentation is measured
    // in leading spaces (tab → 4 spaces). Items at depth 0 are the outer
    // list; depth >= 2 spaces start a sublist.
    const ulMatch = UNORDERED_LIST_RE.exec(line);
    const olMatch = ORDERED_LIST_RE.exec(line);
    if (ulMatch || olMatch) {
      // Compute base indent of the FIRST item — everything indented more
      // than that becomes a child sublist.
      const baseIndent = _indentWidth(ulMatch?.[1] ?? olMatch?.[1] ?? '');
      const ordered = olMatch != null;
      const parsed = _parseListAt(lines, i, baseIndent, ordered);
      out.push({ type: 'list', ordered, items: parsed.items });
      i = parsed.nextIndex;
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

// ─────────────────────────────────────────────
//  v1.4.3 — Nested list helpers
// ─────────────────────────────────────────────

/**
 * Measure visual indentation width of a leading-whitespace string. Tabs
 * count as 4 spaces (CommonMark §5.2: tabs are treated as if they were
 * expanded with a tab stop of 4).
 *
 * Assumes `ws` is a leading-whitespace capture from `/^(\s*)/` — all
 * characters are tabs or spaces (no need for an `else break` branch).
 */
const _indentWidth = (ws: string): number => {
  let w = 0;
  for (const ch of ws) {
    if (ch === '\t') w += 4 - (w % 4);
    else w += 1;   // any other whitespace char (space) → 1
  }
  return w;
};

/**
 * Recursive list parser. Consumes consecutive list items at `baseIndent`
 * and treats anything indented further as a child sublist (recursive).
 *
 * Stops when:
 *   - End of input
 *   - Non-list line at the current depth
 *   - Item at LOWER indentation (belongs to outer list)
 *
 * @param lines       Full document lines
 * @param start       Index of the first item line
 * @param baseIndent  Indent width of items at this nesting level
 * @param ordered     Whether outer list is ordered (sublists detected by marker)
 *
 * @since 1.4.3
 */
const _parseListAt = (
  lines: string[],
  start: number,
  baseIndent: number,
  ordered: boolean,
): { items: ListItem[]; nextIndex: number } => {
  const items: ListItem[] = [];
  let i = start;

  while (i < lines.length) {
    const ln = lines[i] as string;
    const u = UNORDERED_LIST_RE.exec(ln);
    const o = ORDERED_LIST_RE.exec(ln);
    if (!u && !o) break;

    const indent = _indentWidth((u?.[1] ?? o?.[1] ?? '') as string);
    const isOrderedHere = o != null;

    // Lower indent → belongs to an outer list
    if (indent < baseIndent) break;

    // Same indent: must match the outer list's ordering
    if (indent === baseIndent) {
      if (ordered !== isOrderedHere) break;
      const rawText = ((o?.[3] ?? u?.[2]) as string).trim();
      items.push(_makeItem(rawText));
      i++;
      continue;
    }

    // Higher indent → child sublist of the LAST item
    // (CommonMark: a bullet indented more than its parent's content marker
    // is a child of the previous item).
    /* istanbul ignore if — unreachable from parseBlocks: the main loop
       always invokes _parseListAt with baseIndent = first item's indent,
       so the first item always matches `indent === baseIndent`. Kept as
       defensive code for direct callers that may seed mid-list. */
    if (items.length === 0) {
      // Defensive: orphan indented item with no parent — treat as same-level
      const rawText = ((o?.[3] ?? u?.[2]) as string).trim();
      items.push(_makeItem(rawText));
      i++;
      continue;
    }

    const sub = _parseListAt(lines, i, indent, isOrderedHere);
    const parent = items[items.length - 1] as ListItem;
    parent.children = { ordered: isOrderedHere, items: sub.items };
    i = sub.nextIndex;
  }

  return { items, nextIndex: i };
};

// ─────────────────────────────────────────────
//  v1.4.4 — Task list detection (GFM)
// ─────────────────────────────────────────────

/** Matches a task list prefix: `[ ]`, `[x]`, or `[X]` followed by space. */
const TASK_RE = /^\[([ xX])\]\s+(.*)$/;

/**
 * Convert raw list item text into a `ListItem`. Detects GFM task-list
 * prefix (`[ ]` or `[x]`) and strips it from the visible text, setting
 * `checked` accordingly.
 *
 * @example
 * ```ts
 * _makeItem('[ ] buy milk')      // → { text: 'buy milk', checked: false }
 * _makeItem('[x] shipped')       // → { text: 'shipped', checked: true }
 * _makeItem('regular item')      // → { text: 'regular item' }
 * ```
 *
 * @since 1.4.4
 */
const _makeItem = (rawText: string): ListItem => {
  const m = TASK_RE.exec(rawText);
  if (m) {
    const state = m[1] as string;
    return {
      text: (m[2] as string).trim(),
      checked: state === 'x' || state === 'X',
    };
  }
  return { text: rawText };
};
