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
