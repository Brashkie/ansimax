/**
 * Tests for src/panels/index.ts
 */

import { vsplit, hsplit, panels } from '../panels/index.js';
import { stripAnsi } from '../utils/helpers.js';

describe('panels.vsplit (v1.3.0)', () => {
  it('returns empty string for empty input', () => {
    expect(vsplit([])).toBe('');
    expect(vsplit(null as unknown as string[])).toBe('');
  });

  it('joins two single-line blocks side by side', () => {
    const result = vsplit(['Hello', 'World'], { gap: 1 });
    expect(result).toBe('Hello World');
  });

  it('respects gap option', () => {
    const r1 = vsplit(['A', 'B'], { gap: 0 });
    const r3 = vsplit(['A', 'B'], { gap: 3 });
    expect(r1).toBe('AB');
    expect(r3).toBe('A   B');
  });

  it('handles multi-line blocks of equal height', () => {
    const left = 'a1\na2\na3';
    const right = 'b1\nb2\nb3';
    const result = vsplit([left, right], { gap: 1 });
    expect(result).toBe('a1 b1\na2 b2\na3 b3');
  });

  it('pads shorter block (start alignment, default)', () => {
    const tall = 'a\nb\nc';
    const short = 'X';
    const result = vsplit([tall, short], { gap: 1 });
    // X stays on top, padded below with spaces
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('a X');
    expect(lines[1]?.startsWith('b ')).toBe(true);
    expect(lines[2]?.startsWith('c ')).toBe(true);
  });

  it('pads shorter block with center alignment', () => {
    const tall = 'a\nb\nc';
    const short = 'X';
    const result = vsplit([tall, short], { gap: 1, align: 'center' });
    const lines = result.split('\n');
    // X should be in the middle row
    expect(lines[1]).toBe('b X');
  });

  it('pads shorter block with end alignment', () => {
    const tall = 'a\nb\nc';
    const short = 'X';
    const result = vsplit([tall, short], { gap: 1, align: 'end' });
    const lines = result.split('\n');
    // X should be on the bottom row
    expect(lines[2]).toBe('c X');
  });

  it('handles three or more blocks', () => {
    const result = vsplit(['A', 'B', 'C'], { gap: 1 });
    expect(result).toBe('A B C');
  });

  it('respects fixed widths option', () => {
    const result = vsplit(['x', 'y'], { gap: 0, widths: [5, 5] });
    expect(result).toBe('x    y    ');
  });

  it('uses natural max width per block when widths option not set', () => {
    // First block is 5 chars wide ("Hello"), second is 5 chars ("World")
    const result = vsplit(['Hello', 'World'], { gap: 2 });
    expect(result).toBe('Hello  World');
  });

  it('preserves ANSI escapes in content', () => {
    const colored = '\x1b[31mred\x1b[0m';
    const plain = 'plain';
    const result = vsplit([colored, plain], { gap: 1 });
    expect(result).toContain('\x1b[31m');
    // After stripAnsi, visual structure should be intact
    expect(stripAnsi(result)).toBe('red plain');
  });

  it('coerces negative gap to 0', () => {
    const r = vsplit(['A', 'B'], { gap: -5 });
    expect(r).toBe('AB');
  });
});

describe('panels.hsplit (v1.3.0)', () => {
  it('returns empty string for empty input', () => {
    expect(hsplit([])).toBe('');
  });

  it('stacks two single-line blocks', () => {
    const result = hsplit(['line1', 'line2']);
    expect(result).toBe('line1\nline2');
  });

  it('stacks multi-line blocks', () => {
    const a = 'a1\na2';
    const b = 'b1\nb2';
    const result = hsplit([a, b]);
    expect(result).toBe('a1\na2\nb1\nb2');
  });

  it('adds vertical gap between blocks', () => {
    const result = hsplit(['top', 'bot'], { gap: 1 });
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('top');
    expect(lines[2]).toBe('bot');
  });

  it('pads narrower blocks with start alignment (default)', () => {
    const result = hsplit(['short', 'longer line']);
    const lines = result.split('\n');
    // 'short' should be padded with trailing spaces to match width of 'longer line'
    expect(lines[0]?.length).toBe('longer line'.length);
  });

  it('pads narrower blocks with center alignment', () => {
    const result = hsplit(['hi', 'longer'], { align: 'center' });
    const lines = result.split('\n');
    // 'hi' (2 chars) centered in 6-char width → "  hi  "
    expect(lines[0]).toBe('  hi  ');
  });

  it('pads narrower blocks with end alignment (right-align)', () => {
    const result = hsplit(['hi', 'longer'], { align: 'end' });
    const lines = result.split('\n');
    expect(lines[0]).toBe('    hi');
  });

  it('coerces negative gap to 0', () => {
    const r1 = hsplit(['a', 'b'], { gap: 0 });
    const rNeg = hsplit(['a', 'b'], { gap: -5 });
    expect(rNeg).toBe(r1);
  });
});

describe('panels: nesting (v1.3.0)', () => {
  it('vsplit can contain hsplit blocks', () => {
    const inner = hsplit(['a', 'b']);  // 'a\nb'
    const result = vsplit([inner, 'X'], { gap: 1 });
    // a | X
    // b |
    const lines = result.split('\n');
    expect(lines[0]).toBe('a X');
    expect(lines[1]?.startsWith('b ')).toBe(true);
  });

  it('hsplit can contain vsplit blocks', () => {
    const inner = vsplit(['a', 'b'], { gap: 1 });  // 'a b'
    const result = hsplit(['top', inner, 'bot']);
    const lines = result.split('\n');
    expect(lines[0]?.startsWith('top')).toBe(true);
    expect(lines[1]).toBe('a b');
    expect(lines[2]?.startsWith('bot')).toBe(true);
  });
});

describe('panels namespace export (v1.3.0)', () => {
  it('panels.vsplit and panels.hsplit are accessible', () => {
    expect(typeof panels.vsplit).toBe('function');
    expect(typeof panels.hsplit).toBe('function');
  });

  it('panels is exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.panels).toBe('object');
    expect(typeof main.vsplit).toBe('function');
    expect(typeof main.hsplit).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  v1.3.1 — panels.center + panels.frame
// ─────────────────────────────────────────────
import { center, frame } from '../panels/index.js';

describe('panels.center (v1.3.1)', () => {
  it('horizontally centers a single line', () => {
    const result = center('Hi', { width: 10 });
    // 8 spaces split (4 left, 4 right) around "Hi"
    expect(result).toBe('    Hi    ');
  });

  it('handles odd-space centering (extra space to right)', () => {
    const result = center('Hi', { width: 11 });
    // 9 spaces split (4 left, 5 right)
    expect(result).toBe('    Hi     ');
  });

  it('returns block unchanged when content already fills width', () => {
    const result = center('exact', { width: 5 });
    expect(result).toBe('exact');
  });

  it('truncates content wider than width', () => {
    const result = center('too long', { width: 4 });
    // Falls back to first 4 chars
    expect(result).toBe('too ');
  });

  it('handles multi-line block (each line centered)', () => {
    const result = center('a\nbb', { width: 6 });
    const lines = result.split('\n');
    // "a" centered in 6 → "  a   " (3 spaces left, 2 right after a — actually "  a   ")
    // Math.floor(5/2)=2, 5-2=3 → "  a   "
    expect(lines[0]).toBe('  a   ');
    // "bb" centered in 6 → "  bb  " (Math.floor(4/2)=2)
    expect(lines[1]).toBe('  bb  ');
  });

  it('with height — vertical centering inserts blank lines', () => {
    const result = center('X', { width: 5, height: 5, align: 'center' });
    const lines = result.split('\n');
    expect(lines.length).toBe(5);
    // X should be in the middle row (index 2)
    expect(lines[2]?.includes('X')).toBe(true);
  });

  it('with height + align:start — content at top', () => {
    const result = center('X', { width: 5, height: 5, align: 'start' });
    const lines = result.split('\n');
    expect(lines[0]?.includes('X')).toBe(true);
  });

  it('with height + align:end — content at bottom', () => {
    const result = center('X', { width: 5, height: 5, align: 'end' });
    const lines = result.split('\n');
    expect(lines[4]?.includes('X')).toBe(true);
  });

  it('width = 0 returns block unchanged', () => {
    expect(center('hello', { width: 0 })).toBe('hello');
  });

  it('missing opts returns block unchanged', () => {
    // @ts-expect-error testing defensive behavior
    expect(center('hello', null)).toBe('hello');
  });
});

describe('panels.frame (v1.3.1)', () => {
  it('adds simple top/bottom rule lines', () => {
    const result = frame('Hello');
    const lines = result.split('\n');
    expect(lines.length).toBe(3); // top, content, bottom
    expect(lines[0]).toBe('─────');
    expect(lines[1]).toBe('Hello');
    expect(lines[2]).toBe('─────');
  });

  it('respects padding option (adds blank lines + horizontal padding)', () => {
    const result = frame('Hi', { padding: 1 });
    const lines = result.split('\n');
    // top, blank, " Hi ", blank, bottom
    expect(lines.length).toBe(5);
    expect(lines[2]).toBe(' Hi ');
  });

  it('separates paddingX and paddingY', () => {
    const result = frame('Hi', { paddingX: 2, paddingY: 0 });
    const lines = result.split('\n');
    expect(lines.length).toBe(3); // no Y padding → no blank lines
    expect(lines[1]).toBe('  Hi  '); // 2 spaces left + Hi + 2 right
  });

  it('adds title centered in top edge', () => {
    const result = frame('Body', { title: 'Header' });
    const lines = result.split('\n');
    // First line includes "Header"
    expect(lines[0]?.includes(' Header ')).toBe(true);
  });

  it('uses custom topChar and bottomChar', () => {
    const result = frame('X', { topChar: '═', bottomChar: '═' });
    const lines = result.split('\n');
    expect(lines[0]).toBe('═');
    expect(lines[2]).toBe('═');
  });

  it('bottomChar falls back to topChar when unset', () => {
    const result = frame('X', { topChar: '━' });
    const lines = result.split('\n');
    expect(lines[0]).toBe('━');
    expect(lines[2]).toBe('━'); // same char
  });

  it('handles multi-line block', () => {
    const result = frame('Line 1\nLine 2\nLine 3', { padding: 0 });
    const lines = result.split('\n');
    // top, line1, line2, line3, bottom
    expect(lines.length).toBe(5);
  });

  it('negative padding is clamped to 0', () => {
    const r1 = frame('Hi');
    const r2 = frame('Hi', { padding: -5 });
    expect(r2).toBe(r1);
  });

  it('namespaced access works', () => {
    expect(typeof panels.center).toBe('function');
    expect(typeof panels.frame).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  Coverage gap from v1.3.1 (line 66 — empty/invalid block)
// ─────────────────────────────────────────────

describe('panels: empty/invalid block input (coverage v1.3.1)', () => {
  it('frame handles empty string block', () => {
    // _splitBlock with '' returns { lines: [''], maxWidth: 0 }
    const result = frame('');
    expect(typeof result).toBe('string');
    // Should still produce top + content + bottom rules
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
  });

  it('center handles empty string block', () => {
    const result = center('', { width: 10 });
    // Empty content padded to width 10 → 10 spaces
    expect(result).toBe(' '.repeat(10));
  });

  it('frame handles non-string block defensively', () => {
    // @ts-expect-error testing defensive behavior with invalid type
    expect(() => frame(null)).not.toThrow();
    // @ts-expect-error testing defensive behavior with invalid type
    expect(() => frame(undefined)).not.toThrow();
  });

  it('center handles non-string block defensively', () => {
    // @ts-expect-error testing defensive behavior
    expect(() => center(null, { width: 10 })).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  v1.3.3 — panels.grid + frame titleAlign
// ─────────────────────────────────────────────
import { grid } from '../panels/index.js';

describe('panels.grid (v1.3.3)', () => {
  it('returns empty string for empty input', () => {
    expect(grid([], { columns: 2 })).toBe('');
  });

  it('arranges 4 blocks in a 2-column grid', () => {
    const blocks = ['A', 'B', 'C', 'D'];
    const result = grid(blocks, { columns: 2, gapX: 1, gapY: 0 });
    const lines = result.split('\n');
    expect(lines.length).toBe(2);  // 2 rows of 2
    expect(lines[0]).toBe('A B');
    expect(lines[1]).toBe('C D');
  });

  it('handles partial last row (auto-flow)', () => {
    // 7 items in 3 columns → 3 rows: [3, 3, 1]
    const blocks = ['1', '2', '3', '4', '5', '6', '7'];
    const result = grid(blocks, { columns: 3, gapX: 1, gapY: 0 });
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('1 2 3');
    expect(lines[1]).toBe('4 5 6');
    // Last row has only "7" padded to width
    expect(lines[2]?.startsWith('7')).toBe(true);
  });

  it('uniformly aligns column widths across rows', () => {
    // Row 1: 'short' + 'longer block'
    // Row 2: 'longer' + 'X'
    // Column 0 should match widest ('longer' = 6 chars)
    // Column 1 should match widest ('longer block' = 12 chars)
    const blocks = ['short', 'longer block', 'longer', 'X'];
    const result = grid(blocks, { columns: 2, gapX: 1, gapY: 0 });
    const lines = result.split('\n');
    expect(lines[0]?.length).toBe(lines[1]?.length);
  });

  it('respects fixed cellWidth option', () => {
    const blocks = ['a', 'b', 'c', 'd'];
    const result = grid(blocks, { columns: 2, gapX: 0, cellWidth: 5 });
    const lines = result.split('\n');
    // Each cell is 5 chars wide, no gap → total 10 chars
    expect(lines[0]?.length).toBe(10);
  });

  it('respects vertical gap (gapY)', () => {
    const blocks = ['A', 'B', 'C', 'D'];
    const result = grid(blocks, { columns: 2, gapX: 1, gapY: 1 });
    const lines = result.split('\n');
    // 2 rows + 1 blank line between = 3 lines
    expect(lines.length).toBe(3);
    expect(lines[1]?.trim()).toBe(''); // blank gap line
  });

  it('clamps columns to minimum 1', () => {
    const blocks = ['A', 'B'];
    const result = grid(blocks, { columns: 0 });   // illegal → clamped to 1
    const lines = result.split('\n');
    expect(lines.length).toBe(2);  // each block on its own row
  });

  it('panels.grid is accessible via namespace', () => {
    expect(typeof panels.grid).toBe('function');
  });

  it('handles missing opts defensively', () => {
    // @ts-expect-error testing defensive behavior
    expect(grid(['A', 'B'], null)).toBe('');
  });
});

describe('panels.frame: titleAlign (v1.3.3)', () => {
  it('titleAlign: center (default) puts title in middle', () => {
    const result = frame('Body content here', { title: 'T' });
    const lines = result.split('\n');
    const topLine = lines[0] ?? '';
    // " T " in middle of 17-char inner width
    // ─── T ─────────── = 4 left, " T " title (3), 11 right (total 18)
    const tIdx = topLine.indexOf(' T ');
    expect(tIdx).toBeGreaterThan(2);  // not at very left
    expect(tIdx).toBeLessThan(topLine.length - 5);  // not at very right
  });

  it('titleAlign: left puts title near the left edge', () => {
    const result = frame('Body content here', { title: 'T', titleAlign: 'left' });
    const lines = result.split('\n');
    const topLine = lines[0] ?? '';
    // Should be near position 1 (after 1 char of fill)
    expect(topLine.indexOf(' T ')).toBe(1);
  });

  it('titleAlign: right puts title near the right edge', () => {
    const result = frame('Body content here', { title: 'T', titleAlign: 'right' });
    const lines = result.split('\n');
    const topLine = lines[0] ?? '';
    // " T " (3 chars) should end at position topLine.length - 1
    const tEnd = topLine.indexOf(' T ') + 3;
    expect(tEnd).toBe(topLine.length - 1);
  });
});
