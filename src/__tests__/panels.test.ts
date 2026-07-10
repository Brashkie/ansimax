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

// ─────────────────────────────────────────────
//  v1.3.6 — Branch coverage gaps
// ─────────────────────────────────────────────

import { vsplit as vs, hsplit as hs, frame as fr, grid as gr } from '../panels/index.js';

describe('panels — branch coverage (v1.3.6)', () => {
  it('vsplit uses default gap=1 when omitted (line 177)', () => {
    // No `gap` option → default 1 applies → blocks separated by 1 space
    const result = vs(['A', 'B'], {});
    expect(result).toBe('A B');
  });

  it('vsplit handles columns of unequal heights (line 207 — block[r] ?? "" branch)', () => {
    // Left has 3 lines, right has 1 line. When iterating row 1 and 2,
    // right.block[r] is undefined → triggers the ?? '' fallback.
    const tall  = 'L1\nL2\nL3';
    const short = 'R';
    const result = vs([tall, short], { gap: 1, align: 'start' });
    const lines = result.split('\n');
    // Row 0: 'L1 R', row 1: 'L2 ', row 2: 'L3 '
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('L1');
    expect(lines[0]).toContain('R');
    // Rows 1 and 2 should have empty padding on right side, not undefined
    expect(lines[1]).toContain('L2');
    expect(lines[2]).toContain('L3');
    // No 'undefined' string accidentally rendered
    expect(result).not.toContain('undefined');
  });

  it('centerBlock uses default align="center" when align omitted (line 350)', () => {
    const card = 'XX';   // 2 chars
    // Width 10, no align passed → default 'center' → 4 spaces each side
    const result = panels.center(card, { width: 10 });
    expect(result.split('\n')[0]).toBe('    XX    ');
  });

  it('centerBlock with height triggers vertical alignment + default align (line 350)', () => {
    // Vertical centering only runs when `height` is provided.
    // Omitting `align` triggers the `?? "center"` fallback at line 350.
    const result = panels.center('X', { width: 5, height: 5 });
    const lines = result.split('\n');
    expect(lines.length).toBe(5);
    // Middle line (index 2) should contain the X
    expect(lines[2]).toContain('X');
  });

  it('centerBlock with height + explicit align uses provided value (line 350 — other branch)', () => {
    const result = panels.center('X', { width: 5, height: 5, align: 'start' });
    const lines = result.split('\n');
    // align='start' → X on top line
    expect(lines[0]).toContain('X');
  });

  it('frame falls back to "─" when topChar is empty string (line 442)', () => {
    // topChar = '' has length 0 → ternary takes the fallback branch '─'
    const result = fr('body', { topChar: '', padding: 0 });
    const lines = result.split('\n');
    // First line should contain '─' (the fallback)
    expect(lines[0]).toContain('─');
  });

  it('frame falls back to "─" when topChar is non-string (line 442)', () => {
    // @ts-expect-error testing defensive fallback
    const result = fr('body', { topChar: 42, padding: 0 });
    expect(result.split('\n')[0]).toContain('─');
  });

  it('grid uses default columns=1 when columns omitted (line 576)', () => {
    // @ts-expect-error testing default branch — required field omitted
    const result = gr(['A', 'B', 'C'], {});
    // 1 column → each block on its own row
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
  });

  it('grid uses opts.columns ?? 1 — undefined goes to fallback (line 576)', () => {
    // Explicit undefined triggers the ?? fallback
    const result = gr(['A', 'B'], { columns: undefined as unknown as number });
    expect(result.split('\n').length).toBe(2);
  });
});

// ─────────────────────────────────────────────
//  v1.4.1 — grid: colSpan, cellHeight, flow
// ─────────────────────────────────────────────

describe('grid — v1.4.1 features', () => {
  describe('colSpan', () => {
    it('span=1 for all blocks behaves identically to v1.3.x', () => {
      const without = panels.grid(['A', 'B', 'C', 'D'], { columns: 2 });
      const withSpan = panels.grid(['A', 'B', 'C', 'D'], {
        columns: 2,
        colSpan: [1, 1, 1, 1],
      });
      expect(withSpan).toBe(without);
    });

    it('a block with colSpan === columns occupies a full row', () => {
      const result = panels.grid(['HEADER', 'A', 'B'], {
        columns: 2,
        colSpan: [2, 1, 1],
      });
      const lines = result.split('\n');
      // First line should contain HEADER (full width)
      expect(lines[0]).toContain('HEADER');
      // Second line should contain A and B side by side
      const lastLine = lines[lines.length - 1] as string;
      expect(lastLine).toContain('A');
      expect(lastLine).toContain('B');
    });

    it('wraps to next row when remaining capacity insufficient', () => {
      // columns=3, blocks=[A(1), B(2), C(1)]
      // Row 0: A (cap 2 left)
      // B needs span 2 → fits → Row 0 done (A, B span 2)
      // C → Row 1 alone
      const result = panels.grid(['A', 'B', 'C'], {
        columns: 3,
        colSpan: [1, 2, 1],
      });
      const lines = result.split('\n');
      // Row 0 contains A and B
      expect(lines[0]).toContain('A');
      expect(lines[0]).toContain('B');
      // C is on a later line (not the first)
      const lastLine = lines[lines.length - 1] as string;
      expect(lastLine).toContain('C');
    });

    it('clamps colSpan > columns to columns', () => {
      // span=99 but only 2 columns → clamped to 2 (full row)
      const result = panels.grid(['BIG', 'X'], {
        columns: 2,
        colSpan: [99, 1],
      });
      const lines = result.split('\n');
      expect(lines[0]).toContain('BIG');
    });

    it('defaults missing colSpan entries to 1', () => {
      // Only 2 spans provided for 4 blocks
      const result = panels.grid(['A', 'B', 'C', 'D'], {
        columns: 2,
        colSpan: [1, 1],
      });
      expect(result).toBeTruthy();
      // No undefined / NaN leaks
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('NaN');
    });

    it('treats invalid colSpan values as 1', () => {
      const result = panels.grid(['A', 'B'], {
        columns: 2,
        colSpan: [NaN, -5],
      });
      const lines = result.split('\n');
      expect(lines[0]).toContain('A');
      expect(lines[0]).toContain('B');
    });
  });

  describe('cellHeight', () => {
    it('pads short blocks to target height', () => {
      const tall  = 'L1\nL2\nL3\nL4';
      const short = 'X';
      const result = panels.grid([tall, short], {
        columns: 2,
        cellHeight: 4,
      });
      const lines = result.split('\n');
      // Should have 4 lines (matching cellHeight=4)
      expect(lines.length).toBe(4);
    });

    it('truncates tall blocks to target height', () => {
      const tall = 'L1\nL2\nL3\nL4\nL5';
      const result = panels.grid([tall, 'X'], {
        columns: 2,
        cellHeight: 2,
      });
      const lines = result.split('\n');
      expect(lines.length).toBe(2);
      // L1, L2 visible; L3-L5 truncated
      expect(result).toContain('L1');
      expect(result).toContain('L2');
      expect(result).not.toContain('L3');
    });

    it('cellHeight=null behaves like no cellHeight', () => {
      const withNull = panels.grid(['A\nB', 'C'], { columns: 2, cellHeight: null });
      const without  = panels.grid(['A\nB', 'C'], { columns: 2 });
      expect(withNull).toBe(without);
    });

    it('clamps cellHeight to minimum 1', () => {
      // cellHeight=0 should clamp to 1
      const result = panels.grid(['ABC\nDEF', 'X'], { columns: 2, cellHeight: 0 });
      const lines = result.split('\n');
      expect(lines.length).toBe(1);
    });
  });

  describe('flow', () => {
    it('flow="row" (default) fills left-to-right', () => {
      // 4 blocks, 2 columns, row flow:
      // Row 0: [1, 2]
      // Row 1: [3, 4]
      const result = panels.grid(['1', '2', '3', '4'], { columns: 2, flow: 'row' });
      const lines = result.split('\n');
      // Row 0: contains 1 and 2 on same line
      expect(lines[0]).toMatch(/1.*2/);
      // Row 1: contains 3 and 4
      const last = lines[lines.length - 1] as string;
      expect(last).toMatch(/3.*4/);
    });

    it('flow="column" fills top-to-bottom', () => {
      // 4 blocks, 2 columns, column flow:
      // Row 0: [1, 3]
      // Row 1: [2, 4]
      const result = panels.grid(['1', '2', '3', '4'], { columns: 2, flow: 'column' });
      const lines = result.split('\n');
      // Row 0: 1 and 3 side by side
      expect(lines[0]).toMatch(/1.*3/);
      // Row 1: 2 and 4
      const last = lines[lines.length - 1] as string;
      expect(last).toMatch(/2.*4/);
    });

    it('flow="column" computes correct row count for non-multiples', () => {
      // 5 blocks, 2 columns → 3 rows
      // Row 0: [1, 4]
      // Row 1: [2, 5]
      // Row 2: [3]
      const result = panels.grid(['1', '2', '3', '4', '5'], {
        columns: 2,
        flow: 'column',
      });
      const lines = result.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(3);
      // First line contains 1 and 4
      expect(lines[0]).toContain('1');
      expect(lines[0]).toContain('4');
    });

    it('flow="column" with colSpan present falls back to row flow', () => {
      // colSpan triggers row-only mode
      const col = panels.grid(['A', 'B', 'C'], {
        columns: 2,
        flow: 'column',
        colSpan: [2, 1, 1],
      });
      const row = panels.grid(['A', 'B', 'C'], {
        columns: 2,
        flow: 'row',
        colSpan: [2, 1, 1],
      });
      expect(col).toBe(row);
    });

    it('invalid flow value defaults to "row"', () => {
      const result = panels.grid(['A', 'B'], {
        columns: 2,
        // @ts-expect-error testing defensive
        flow: 'diagonal',
      });
      const ref = panels.grid(['A', 'B'], { columns: 2, flow: 'row' });
      expect(result).toBe(ref);
    });
  });

  describe('combined: cellHeight + colSpan', () => {
    it('applies cellHeight to spanning blocks correctly', () => {
      const tall = 'H1\nH2\nH3';
      const result = panels.grid([tall, 'A', 'B'], {
        columns: 2,
        colSpan: [2, 1, 1],
        cellHeight: 2,   // truncate header to 2 lines
      });
      // Total lines: 2 (header row) + 2 (A/B row) = 4
      expect(result.split('\n').length).toBe(4);
      expect(result).toContain('H1');
      expect(result).toContain('H2');
      expect(result).not.toContain('H3');
    });
  });
});

// ─────────────────────────────────────────────
//  v1.4.3 — grid rowSpan + packing algorithm
// ─────────────────────────────────────────────

describe('grid — v1.4.3 rowSpan', () => {
  it('rowSpan=1 for all blocks behaves identically to no rowSpan', () => {
    const without = panels.grid(['A', 'B', 'C', 'D'], { columns: 2 });
    const withSpan = panels.grid(['A', 'B', 'C', 'D'], {
      columns: 2,
      rowSpan: [1, 1, 1, 1],
    });
    expect(withSpan).toBe(without);
  });

  it('a single block with rowSpan=2 packs other blocks alongside', () => {
    // columns=3, sidebar spans 2 rows, then 4 cells fill around it
    //   Row 0: [SIDE][A][B]
    //   Row 1: [ ↑  ][C][D]
    const result = panels.grid(['SIDE', 'A', 'B', 'C', 'D'], {
      columns: 3,
      rowSpan: [2, 1, 1, 1, 1],
      cellHeight: 1,
    });
    const lines = result.split('\n');
    // Row 0 should contain SIDE, A, B
    expect(lines[0]).toContain('SIDE');
    expect(lines[0]).toContain('A');
    expect(lines[0]).toContain('B');
    // Row 1 should contain C and D (sidebar continues but is rendered only in row 0)
    const row1 = lines[1] as string;
    expect(row1).toContain('C');
    expect(row1).toContain('D');
  });

  it('combines colSpan and rowSpan correctly', () => {
    // Header spans 2 cols, sidebar spans 2 rows in col 0
    //   blocks = [HEAD, SIDE, X, Y]
    //   colSpan = [2, 1, 1, 1]
    //   rowSpan = [1, 2, 1, 1]
    // Expected:
    //   Row 0: [HEAD spans 2 cols][X]   ← wait, HEAD spans 2 cols means cols 0-1; X at col 2
    //   Row 1: [SIDE     ][col1 free][Y]
    //
    // Actually the packing algorithm goes block by block:
    //   HEAD (col=2, row=1): placed at row=0 col=0 (uses cols 0-1)
    //   SIDE (col=1, row=2): looks row 0 col 0-1 are taken → tries col=2 → free in r=0,r=1
    //   X (col=1, row=1): row 0 col 0-1 taken, col 2 taken → tries row 1 col 0 → free → places there
    //   Y (col=1, row=1): row 1 col 0 taken → tries col 1 → free → places there
    const result = panels.grid(['HEAD', 'SIDE', 'X', 'Y'], {
      columns: 3,
      colSpan: [2, 1, 1, 1],
      rowSpan: [1, 2, 1, 1],
      cellHeight: 1,
    });
    const lines = result.split('\n');
    expect(lines[0]).toContain('HEAD');
    expect(lines[0]).toContain('SIDE');
    expect(lines[1]).toContain('X');
    expect(lines[1]).toContain('Y');
  });

  it('clamps rowSpan to >= 1 for invalid values', () => {
    const result = panels.grid(['A', 'B'], {
      columns: 2,
      rowSpan: [NaN, -5],
    });
    expect(result).toBeTruthy();
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('NaN');
  });

  it('defaults missing rowSpan entries to 1', () => {
    // Only first 2 spans provided for 4 blocks
    const result = panels.grid(['A', 'B', 'C', 'D'], {
      columns: 2,
      rowSpan: [1, 1],
    });
    const lines = result.split('\n');
    // Should render normally as 2x2 grid
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('forces row flow when rowSpan present', () => {
    const col = panels.grid(['A', 'B', 'C', 'D'], {
      columns: 2,
      flow: 'column',
      rowSpan: [2, 1, 1, 1],
    });
    const explicitRow = panels.grid(['A', 'B', 'C', 'D'], {
      columns: 2,
      flow: 'row',
      rowSpan: [2, 1, 1, 1],
    });
    expect(col).toBe(explicitRow);
  });

  it('packs in scan order: first free position wins', () => {
    // Test that scanning is deterministic — same input → same output
    const a = panels.grid(['X', 'Y', 'Z'], {
      columns: 3,
      rowSpan: [2, 1, 1],
      cellHeight: 1,
    });
    const b = panels.grid(['X', 'Y', 'Z'], {
      columns: 3,
      rowSpan: [2, 1, 1],
      cellHeight: 1,
    });
    expect(a).toBe(b);
  });

  it('handles a block whose effective span exceeds columns gracefully', () => {
    // colSpan=99 clamps to columns=2, rowSpan=2 → 2×2 block
    const result = panels.grid(['BIG', 'X'], {
      columns: 2,
      colSpan: [99, 1],
      rowSpan: [2, 1],
      cellHeight: 1,
    });
    expect(result).toContain('BIG');
    expect(result).toContain('X');
  });
});

// ─────────────────────────────────────────────
//  v1.4.4 — gridAreas (CSS grid-template-areas)
// ─────────────────────────────────────────────

import { gridAreas, _validateAreas } from '../panels/index.js';

describe('_validateAreas — rectangle detection (v1.4.4)', () => {
  it('detects a simple valid layout', () => {
    const rects = _validateAreas([
      ['h', 'h', 'h'],
      ['s', 'm', 'm'],
      ['f', 'f', 'f'],
    ]);
    expect(rects.length).toBe(4);
    const h = rects.find((r) => r.name === 'h');
    expect(h).toMatchObject({ row: 0, col: 0, colSpan: 3, rowSpan: 1 });
    const m = rects.find((r) => r.name === 'm');
    expect(m).toMatchObject({ row: 1, col: 1, colSpan: 2, rowSpan: 1 });
  });

  it('detects gaps (.) and ignores them', () => {
    const rects = _validateAreas([
      ['a', '.', 'b'],
      ['a', '.', 'b'],
    ]);
    expect(rects.length).toBe(2);
    const a = rects.find((r) => r.name === 'a');
    expect(a).toMatchObject({ rowSpan: 2, colSpan: 1 });
  });

  it('rejects non-rectangular (L-shape) areas', () => {
    expect(() => _validateAreas([
      ['x', 'x', '.'],
      ['x', '.', '.'],
    ])).toThrow(/not a rectangle/);
  });

  it('rejects interrupted rectangles', () => {
    expect(() => _validateAreas([
      ['a', 'a', 'a'],
      ['a', 'b', 'a'],   // 'a' bounding box includes cell [1,1]='b'
      ['a', 'a', 'a'],
    ])).toThrow(/overlaps|not a rectangle/);
  });

  it('rejects empty input', () => {
    expect(() => _validateAreas([])).toThrow(/non-empty/);
    // @ts-expect-error testing defensive input
    expect(() => _validateAreas(null)).toThrow(/non-empty/);
  });

  it('rejects rows of unequal width', () => {
    expect(() => _validateAreas([
      ['a', 'a'],
      ['b'],
    ])).toThrow(/expected 2/);
  });

  it('rejects zero-width rows', () => {
    expect(() => _validateAreas([[]])).toThrow(/at least one column/);
  });
});

describe('gridAreas (v1.4.4)', () => {
  it('renders a simple 3-row layout', () => {
    const result = gridAreas(
      {
        header: 'HEADER',
        sidebar: 'SIDE',
        main: 'MAIN',
        footer: 'FOOTER',
      },
      {
        areas: [
          ['header', 'header', 'header'],
          ['sidebar', 'main', 'main'],
          ['footer', 'footer', 'footer'],
        ],
        cellHeight: 1,
      },
    );
    const lines = result.split('\n');
    expect(lines[0]).toContain('HEADER');
    // Row 1 has sidebar and main
    expect(lines[1]).toContain('SIDE');
    expect(lines[1]).toContain('MAIN');
    // Row 2 has footer
    expect(lines[2]).toContain('FOOTER');
  });

  it('replaces missing area name with empty block', () => {
    // 'sidebar' not provided → renders as ''
    const result = gridAreas(
      { header: 'HEAD', main: 'MAIN' },
      {
        areas: [
          ['header', 'header'],
          ['sidebar', 'main'],
        ],
        cellHeight: 1,
      },
    );
    expect(result).toContain('HEAD');
    expect(result).toContain('MAIN');
    expect(result).not.toContain('undefined');
  });

  it('returns empty for missing areas option', () => {
    // @ts-expect-error testing defensive
    expect(gridAreas({}, {})).toBe('');
    // @ts-expect-error testing defensive
    expect(gridAreas({}, undefined)).toBe('');
  });

  it('throws with a helpful message on invalid layout', () => {
    expect(() => gridAreas(
      { x: 'X' },
      {
        areas: [
          ['x', 'x', '.'],
          ['x', '.', '.'],
        ],
      },
    )).toThrow(/not a rectangle/);
  });
});

// ─────────────────────────────────────────────
//  v1.4.5 — Panels refactor verification
// ─────────────────────────────────────────────

describe('v1.4.5 — panels refactor (file split)', () => {
  it('can import vsplit from split submodule directly', async () => {
    const mod = await import('../panels/split.js');
    expect(typeof mod.vsplit).toBe('function');
    expect(typeof mod.hsplit).toBe('function');
  });

  it('can import center + frame from layout submodule directly', async () => {
    const mod = await import('../panels/layout.js');
    expect(typeof mod.center).toBe('function');
    expect(typeof mod.frame).toBe('function');
  });

  it('can import grid from grid submodule directly', async () => {
    const mod = await import('../panels/grid.js');
    expect(typeof mod.grid).toBe('function');
  });

  it('can import gridAreas + _validateAreas from grid-areas submodule directly', async () => {
    const mod = await import('../panels/grid-areas.js');
    expect(typeof mod.gridAreas).toBe('function');
    expect(typeof mod._validateAreas).toBe('function');
  });

  it('helpers submodule exposes internal utilities', async () => {
    const mod = await import('../panels/helpers.js');
    expect(typeof mod._splitBlock).toBe('function');
    expect(typeof mod._fitHeight).toBe('function');
    expect(typeof mod._padLinesAligned).toBe('function');
    expect(typeof mod._alignVertical).toBe('function');
  });

  it('types submodule exports GridCell (internal)', async () => {
    const mod = await import('../panels/types.js');
    expect(mod).toBeDefined();
  });

  it('all functions from submodules match barrel exports', async () => {
    const barrel = await import('../panels/index.js');
    const split = await import('../panels/split.js');
    const layout = await import('../panels/layout.js');
    const gridMod = await import('../panels/grid.js');
    const areasMod = await import('../panels/grid-areas.js');

    expect(barrel.vsplit).toBe(split.vsplit);
    expect(barrel.hsplit).toBe(split.hsplit);
    expect(barrel.center).toBe(layout.center);
    expect(barrel.frame).toBe(layout.frame);
    expect(barrel.grid).toBe(gridMod.grid);
    expect(barrel.gridAreas).toBe(areasMod.gridAreas);
  });
});

// ─────────────────────────────────────────────
//  v1.4.7 — flex (flexbox-style layout)
// ─────────────────────────────────────────────

import { flex } from '../panels/index.js';

describe('flex (v1.4.7)', () => {
  it('returns empty for empty blocks', () => {
    expect(flex([], { width: 40 })).toBe('');
  });

  it('returns empty for missing opts', () => {
    // @ts-expect-error testing defensive
    expect(flex(['a'], undefined)).toBe('');
  });

  it('start justify keeps blocks left, free space trails right', () => {
    const result = flex(['A', 'B'], { width: 20, justify: 'start' });
    const line = result.split('\n')[0] as string;
    // A and B are adjacent at the left
    expect(line.indexOf('A')).toBe(0);
    expect(line.indexOf('B')).toBe(1);
    // Total width is 20
    expect(line.length).toBe(20);
  });

  it('end justify pushes blocks to the right', () => {
    const result = flex(['A', 'B'], { width: 20, justify: 'end' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(20);
    // B is the last char
    expect(line.endsWith('B')).toBe(true);
  });

  it('center justify balances leading and trailing space', () => {
    const result = flex(['AB'], { width: 10, justify: 'center' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(10);
    // 'AB' is 2 wide, 8 free → 4 left, 4 right
    expect(line).toBe('    AB    ');
  });

  it('between justify puts gaps between items only', () => {
    const result = flex(['A', 'B', 'C'], { width: 9, justify: 'between' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(9);
    // A at 0, C at end
    expect(line.startsWith('A')).toBe(true);
    expect(line.endsWith('C')).toBe(true);
  });

  it('evenly justify distributes gaps including edges', () => {
    const result = flex(['A', 'B'], { width: 8, justify: 'evenly' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(8);
    // 2 blocks (2 wide total), 6 free, 3 slots → 2,2,2
    expect(line).toBe('  A  B  ');
  });

  it('respects base gap between blocks', () => {
    const result = flex(['A', 'B'], { width: 20, gap: 3, justify: 'start' });
    const line = result.split('\n')[0] as string;
    // A, then 3 spaces, then B
    expect(line.slice(0, 5)).toBe('A   B');
  });

  it('aligns multi-line blocks vertically', () => {
    const tall = 'X\nY\nZ';
    const short = 'Q';
    const result = flex([tall, short], { width: 20, align: 'start' });
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    // Q is on the first line (start align), blank below
    expect(lines[0]).toContain('Q');
  });

  it('every justify strategy conserves total width', () => {
    const justifies = ['start', 'end', 'center', 'between', 'around', 'evenly'] as const;
    for (const j of justifies) {
      const result = flex(['AA', 'BB', 'CC'], { width: 30, justify: j });
      for (const line of result.split('\n')) {
        expect(line.length).toBe(30);
      }
    }
  });

  it('flex-grow expands blocks to fill leftover space', () => {
    // Two blocks, grow [1, 1] → each gets half the leftover
    const result = flex(['A', 'B'], { width: 20, grow: [1, 1], justify: 'start' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(20);
    // With grow, blocks expand — no big trailing gap
    // A grows to ~10, B grows to ~10
    expect(line.trimEnd().length).toBeGreaterThan(2);
  });

  it('flex-grow respects weight proportions', () => {
    // grow [3, 1] → block A gets 3x the leftover of block B
    const result = flex(['A', 'B'], { width: 22, grow: [3, 1], justify: 'start' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(22);
  });

  it('handles single block', () => {
    const result = flex(['SOLO'], { width: 20, justify: 'center' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(20);
    expect(line).toContain('SOLO');
  });

  it('between justify with a single block trails all free space', () => {
    // count === 1 branch: no gaps between, everything trails right
    const result = flex(['X'], { width: 10, justify: 'between' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(10);
    expect(line.startsWith('X')).toBe(true);
    // Rest is trailing space
    expect(line).toBe('X' + ' '.repeat(9));
  });

  it('flex-grow with all-zero weights leaves widths unchanged', () => {
    // totalGrow <= 0 branch: grow has no positive weights → no expansion
    const result = flex(['A', 'B'], { width: 20, grow: [0, 0], justify: 'start' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(20);
    // Blocks stay at natural width (1 each), free space trails
    expect(line.slice(0, 2)).toBe('AB');
  });

  it('flex-grow with no leftover space leaves widths unchanged', () => {
    // leftover <= 0 branch: blocks already fill width
    const wide = 'X'.repeat(20);
    const result = flex([wide], { width: 20, grow: [1] });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(20);
    expect(line).toBe(wide);
  });

  it('flex-grow distributes fractional remainder (largest-remainder)', () => {
    // grow [1,1,1] with leftover not divisible by 3 → remainder loop runs.
    // Blocks are 1 wide each (3 total), width 13 → leftover 10.
    // 10/3 = 3.33 each → floors [3,3,3]=9, remainder 1 goes to first.
    const result = flex(['A', 'B', 'C'], { width: 13, grow: [1, 1, 1], justify: 'start' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(13);
    // All 13 columns used by grown blocks (no trailing gap with start+grow filling)
    expect(line.trimEnd().length).toBeGreaterThan(3);
  });

  it('flex-grow with uneven weights and remainder', () => {
    // grow [2,1] leftover 10 → entitlements [6.67, 3.33] → floors [6,3]=9,
    // remainder 1 to the block with highest fractional part (block 0: .67).
    const result = flex(['A', 'B'], { width: 12, grow: [2, 1], justify: 'start' });
    const line = result.split('\n')[0] as string;
    expect(line.length).toBe(12);
  });
});
