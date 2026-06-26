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

import type { Block } from './types.js';

// ─────────────────────────────────────────────
//  Regex patterns
// ─────────────────────────────────────────────

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
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
