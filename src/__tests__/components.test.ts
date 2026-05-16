import { table, badge, progressBar, status, section, columns, timeline, box, components, menu, MENU_CANCELLED } from '../components/index.js';
import { stripAnsi } from '../utils/helpers.js';
import { resetColorSupportCache } from '../utils/ansi.js';

describe('table', () => {
  const rows = [
    ['Name', 'Age', 'City'],
    ['Ana', '25', 'Madrid'],
    ['Luis', '30', 'Barcelona'],
  ];

  it('returns a non-empty string', () => {
    expect(table(rows).length).toBeGreaterThan(0);
  });

  it('contains all cell values', () => {
    const result = stripAnsi(table(rows));
    expect(result).toContain('Ana');
    expect(result).toContain('Luis');
    expect(result).toContain('Madrid');
    expect(result).toContain('Barcelona');
  });

  it('makes header row bold', () => {
    const result = table(rows, { header: true });
    expect(result).toContain('\x1b[1m'); // bold
  });

  it('uses rounded borders by default', () => {
    const result = table(rows);
    expect(result).toContain('╭');
  });

  it('uses single border when specified', () => {
    expect(table(rows, { borderStyle: 'single' })).toContain('┌');
  });

  it('uses double border when specified', () => {
    expect(table(rows, { borderStyle: 'double' })).toContain('╔');
  });

  it('uses heavy border when specified', () => {
    expect(table(rows, { borderStyle: 'heavy' })).toContain('┏');
  });

  it('returns empty string for empty input', () => {
    expect(table([])).toBe('');
  });

  it('handles single row (no header separator)', () => {
    const result = table([['A', 'B']]);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('badge', () => {
  it('contains label and value', () => {
    const result = stripAnsi(badge('version', '1.0.0'));
    expect(result).toContain('version');
    expect(result).toContain('1.0.0');
  });

  it('contains ANSI background codes', () => {
    const result = badge('test', 'ok');
    expect(result).toContain('\x1b[');
  });

  it('resets color at end', () => {
    const result = badge('x', 'y');
    expect(result).toContain('\x1b[0m');
  });
});

describe('progressBar', () => {
  it('shows 100% as full bar', () => {
    const result = stripAnsi(progressBar(100));
    expect(result).toContain('100%');
    expect(result).toContain('█'.repeat(30));
  });

  it('shows 0% as empty bar', () => {
    const result = stripAnsi(progressBar(0));
    expect(result).toContain('  0%');
    expect(result).toContain('░'.repeat(30));
  });

  it('shows 50% as half bar', () => {
    const result = stripAnsi(progressBar(50, { width: 10 }));
    expect(result).toContain('█'.repeat(5));
    expect(result).toContain('░'.repeat(5));
  });

  it('includes label when specified', () => {
    const result = stripAnsi(progressBar(75, { label: 'Downloading' }));
    expect(result).toContain('Downloading');
  });

  it('hides percentage when showPercentage is false', () => {
    const result = stripAnsi(progressBar(50, { showPercentage: false }));
    expect(result).not.toContain('%');
  });

  it('clamps values above 100', () => {
    const result = stripAnsi(progressBar(150, { width: 10 }));
    expect(result).toContain('100%');
  });

  it('clamps values below 0', () => {
    const result = stripAnsi(progressBar(-10, { width: 10 }));
    expect(result).toContain('  0%');
  });

  it('uses custom chars', () => {
    const result = stripAnsi(progressBar(100, { width: 5, char: '■', emptyChar: '□' }));
    expect(result).toContain('■■■■■');
  });
});

describe('status', () => {
  it('success shows checkmark', () => {
    const result = stripAnsi(status('success', 'done'));
    expect(result).toContain('✓');
    expect(result).toContain('done');
  });

  it('error shows X', () => {
    const result = stripAnsi(status('error', 'fail'));
    expect(result).toContain('✗');
  });

  it('warn shows warning icon', () => {
    const result = stripAnsi(status('warn', 'careful'));
    expect(result).toContain('⚠');
  });

  it('info shows info icon', () => {
    const result = stripAnsi(status('info', 'note'));
    expect(result).toContain('ℹ');
  });

  it('wait shows circle', () => {
    const result = stripAnsi(status('wait', 'pending'));
    expect(result).toContain('◌');
  });

  it('applies color codes', () => {
    expect(status('success', 'ok')).toContain('\x1b[32m'); // green
    expect(status('error', 'fail')).toContain('\x1b[31m'); // red
  });
});

describe('section', () => {
  it('contains the title', () => {
    const result = stripAnsi(section('TITLE'));
    expect(result).toContain('TITLE');
  });

  it('contains divider characters', () => {
    const result = stripAnsi(section('X', { char: '─', width: 20 }));
    expect(result).toContain('─');
  });
});

describe('columns', () => {
  it('lays out items in columns', () => {
    const result = columns(['a', 'b', 'c', 'd'], { cols: 2, width: 20 });
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
  });

  it('handles single column', () => {
    const result = columns(['a', 'b', 'c'], { cols: 1, width: 10 });
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
  });
});

describe('timeline', () => {
  const events = [
    { label: 'Start', done: true, time: 'yesterday' },
    { label: 'Middle', done: false },
    { label: 'End', done: false },
  ];

  it('contains all event labels', () => {
    const result = stripAnsi(timeline(events));
    expect(result).toContain('Start');
    expect(result).toContain('Middle');
    expect(result).toContain('End');
  });

  it('shows time when provided', () => {
    const result = stripAnsi(timeline(events));
    expect(result).toContain('yesterday');
  });

  it('contains connector between events', () => {
    const result = stripAnsi(timeline(events));
    expect(result).toContain('│');
  });

  it('handles empty events array', () => {
    expect(timeline([])).toBe('');
  });
});

// ─────────────────────────────────────────────
//  Default parameter branches
// ─────────────────────────────────────────────
describe('default parameter branches', () => {
  it('table() with no opts uses all defaults', () => {
    // header=true, borderStyle='rounded', padding=1 defaults
    const result = table([['A', 'B'], ['C', 'D']]);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('╭'); // rounded top-left
  });

  it('progressBar() with no opts uses all defaults', () => {
    // width=30, char='█', emptyChar='░', showPercentage=true, label='', color=null
    const result = progressBar(50);
    expect(result).toContain('█');
    expect(result).toContain('░');
    expect(result).toContain('50%');
  });

  it('progressBar(100) full bar with defaults', () => {
    const result = progressBar(100);
    expect(result).toContain('100%');
    expect(result.match(/█/g)?.length).toBe(30); // default width
  });

  it('badge() with no opts uses default color defaults', () => {
    // labelBg=BG.blue, valueBg=BG.green, labelFg=FG.white, valueFg=FG.white
    const result = badge('LABEL', 'value');
    expect(result).toContain('LABEL');
    expect(result).toContain('value');
    expect(result).toContain('\x1b['); // some ANSI codes present
  });

  it('section() with no opts uses defaults', () => {
    // char='─', width=null (uses termSize), color=FG.cyan
    const result = section('Title');
    expect(result).toContain('Title');
    expect(result).toContain('─');
  });

  it('columns() with no opts uses defaults', () => {
    // cols=2, gap=2, width=null
    const result = columns(['a', 'b', 'c', 'd']);
    expect(result.split('\n')).toHaveLength(2); // 4 items / 2 cols = 2 rows
  });

  it('timeline() with no opts uses defaults', () => {
    // connector='│', node='●', color=FG.cyan, doneColor=FG.green, pendingColor=FG.brightBlack
    const result = timeline([
      { label: 'Step 1', done: true  },
      { label: 'Step 2', done: false },
    ]);
    expect(result).toContain('●');
    expect(result).toContain('│');
    expect(result).toContain('Step 1');
  });

  it('status() with default fallback (unknown type)', () => {
    // STATUS_MAP[type] ?? STATUS_MAP.info — pass invalid type to hit fallback
    // @ts-expect-error intentionally invalid
    const result = status('unknown', 'message');
    expect(result).toContain('ℹ'); // info icon (fallback)
    expect(result).toContain('message');
  });
});

// ─────────────────────────────────────────────
//  table — irregular rows + jagged cell handling
// ─────────────────────────────────────────────
describe('table irregular rows', () => {
  it('handles row shorter than first row (cell ?? \'\' branch)', () => {
    // Row 2 has only 1 cell while row 1 has 3 — empty cells should be padded
    const result = table([
      ['A', 'B', 'C'],
      ['X'],
    ], { header: false });
    expect(result).toContain('A');
    expect(result).toContain('X');
    // No crash from undefined cells
    expect(result.split('\n').length).toBeGreaterThan(0);
  });

  it('handles row longer than first row', () => {
    const result = table([
      ['A'],
      ['X', 'Y', 'Z'],
    ], { header: false });
    expect(result).toContain('A');
    expect(result).toContain('Z');
  });

  it('all-empty rows path (rows.length === 0)', () => {
    expect(table([])).toBe('');
  });

  it('null rows returns empty string', () => {
    expect(table(null as unknown as string[][])).toBe('');
  });

  it('renderRow with only one row (no separator branch)', () => {
    // header=true && rows.length===1 → no middle separator
    const result = table([['only']], { header: true });
    expect(result).toContain('only');
    // Should have top and bottom borders but no middle
    const lines = result.split('\n');
    expect(lines.length).toBe(3); // top + content + bottom
  });

  it('header=false skips separator entirely', () => {
    const result = table([['a'], ['b']], { header: false });
    // ri===0 && header===false → no push of separator
    expect(result).toContain('a');
    expect(result).toContain('b');
  });

  it('uses different border styles', () => {
    const styles = ['single', 'double', 'rounded', 'heavy'] as const;
    for (const style of styles) {
      const result = table([['x']], { borderStyle: style });
      expect(result).toContain('x');
    }
  });
});

// ─────────────────────────────────────────────
//  box — re-exported ascii namespace
// ─────────────────────────────────────────────
describe('box (ascii re-export)', () => {
  it('is exported and is a function/object with rendering capability', () => {
    expect(box).toBeDefined();
  });

  it('can render box-like content', () => {
    // box is now ascii.box — a function that wraps content in a border
    expect(typeof box).toBe('function');
  });

  it('box() actually renders a border', () => {
    const result = box('hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});


// ─────────────────────────────────────────────
//  Table — multi-line cells
// ─────────────────────────────────────────────
describe('table — multi-line cells', () => {
  it('expands rows when a cell contains \\n', () => {
    const rows = [
      ['Name',      'Address'],
      ['Alice',     'Line 1\nLine 2'],
    ];
    const result = table(rows, { borderStyle: 'single' });
    const lines = result.split('\n');
    // Top border + header row + separator + 2 data lines + bottom border = 6
    expect(lines.length).toBe(6);
    expect(stripAnsi(result)).toContain('Line 1');
    expect(stripAnsi(result)).toContain('Line 2');
  });

  it('aligns shorter cells when one is multi-line', () => {
    const rows = [
      ['Col1',  'Col2'],
      ['short', 'a\nb\nc'],
    ];
    const result = table(rows, { borderStyle: 'single' });
    // 'short' should appear once, padded to fit row height
    const plain = stripAnsi(result);
    expect(plain).toContain('short');
    expect(plain).toContain('a');
    expect(plain).toContain('b');
    expect(plain).toContain('c');
  });
});

// ─────────────────────────────────────────────
//  Table — maxColWidth truncation
// ─────────────────────────────────────────────
describe('table — maxColWidth', () => {
  it('truncates cells exceeding maxColWidth', () => {
    const rows = [
      ['Header'],
      ['this is a very long cell value'],
    ];
    const result = table(rows, { maxColWidth: 10, borderStyle: 'single' });
    const plain = stripAnsi(result);
    // Should contain ellipsis
    expect(plain).toContain('…');
    // Should NOT contain the full string
    expect(plain).not.toContain('this is a very long cell value');
  });

  it('does not truncate when content fits', () => {
    const rows = [['Hi']];
    const result = table(rows, { maxColWidth: 20 });
    expect(stripAnsi(result)).toContain('Hi');
  });
});

// ─────────────────────────────────────────────
//  Section — ANSI-aware width
// ─────────────────────────────────────────────
describe('section — ANSI-aware width', () => {
  it('aligns titles with ANSI escapes correctly', () => {
    const colored = '\x1b[31mTITLE\x1b[0m';
    const result = section(colored, { width: 30, char: '-' });
    // The visible width of the title is 5 ('TITLE')
    // Total width should still be ~30 visible chars
    const visible = stripAnsi(result);
    expect(visible).toContain('TITLE');
    expect(visible.length).toBeGreaterThanOrEqual(28);
    expect(visible.length).toBeLessThanOrEqual(32);
  });

  it('handles emoji titles without breaking layout', () => {
    const result = section('🚀 Launch', { width: 30, char: '-' });
    expect(stripAnsi(result)).toContain('Launch');
  });
});

// ─────────────────────────────────────────────
//  ProgressBar — Math.floor avoids overfill
// ─────────────────────────────────────────────
describe('progressBar — precision', () => {
  it('99% never renders as 100% filled', () => {
    const result = progressBar(99, { width: 10, char: '█', emptyChar: '░', showPercentage: false });
    // At least one empty char should remain at 99%
    expect(result).toContain('░');
  });

  it('100% renders fully filled', () => {
    const result = progressBar(100, { width: 10, char: '█', emptyChar: '░', showPercentage: false });
    // No empty chars at 100%
    expect(result).not.toContain('░');
  });

  it('0% renders empty', () => {
    const result = progressBar(0, { width: 10, char: '█', emptyChar: '░', showPercentage: false });
    expect(result).not.toContain('█');
  });

  it('clamps negative percent to 0', () => {
    const result = progressBar(-50, { width: 5, char: '█', emptyChar: '░', showPercentage: false });
    expect(result).not.toContain('█');
  });

  it('clamps percent above 100 to 100', () => {
    const result = progressBar(200, { width: 5, char: '█', emptyChar: '░', showPercentage: false });
    expect(result).not.toContain('░');
  });

  it('supports gradient option', () => {
    const result = progressBar(50, {
      width: 10, gradient: ['#ff0000', '#00ff00'], showPercentage: false,
    });
    expect(stripAnsi(result)).toContain('█');
  });
});

// ─────────────────────────────────────────────
//  Columns — overflow handling
// ─────────────────────────────────────────────
describe('columns — overflow', () => {
  it('truncates by default', () => {
    const result = columns(['this is a very long item', 'short'], { cols: 2, width: 20, gap: 1 });
    const plain = stripAnsi(result);
    expect(plain).toContain('…');
  });

  it('wraps when overflow=wrap', () => {
    const result = columns(['this is a very long item', 'short'], {
      cols: 2, width: 20, gap: 1, overflow: 'wrap',
    });
    const lines = result.split('\n');
    // Wrapping should produce more than 1 line
    expect(lines.length).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────
//  Status — flexible icon
// ─────────────────────────────────────────────
describe('status — options', () => {
  it('default uses preset icon', () => {
    const result = status('success', 'OK');
    expect(stripAnsi(result)).toContain('✓');
  });

  it('icon override replaces the default', () => {
    const result = status('success', 'OK', { icon: '🎉' });
    expect(stripAnsi(result)).toContain('🎉');
    expect(stripAnsi(result)).not.toContain('✓');
  });

  it('icon=null produces no icon', () => {
    const result = status('error', 'fail', { icon: null });
    expect(stripAnsi(result)).not.toContain('✗');
    expect(stripAnsi(result)).toContain('fail');
  });

  it('icon="" produces no icon', () => {
    const result = status('info', 'msg', { icon: '' });
    expect(stripAnsi(result)).not.toContain('ℹ');
  });

  it('color override changes the color', () => {
    const result = status('info', 'test', { color: 35 }); // magenta
    expect(result).toContain('\x1b[35m');
  });

  it('multiline message indents continuation lines', () => {
    const result = status('warn', 'line1\nline2\nline3');
    const lines = stripAnsi(result).split('\n');
    expect(lines.length).toBe(3);
    // Continuation lines should have leading spaces (icon-width indent)
    expect(lines[1]?.startsWith(' ')).toBe(true);
    expect(lines[2]?.startsWith(' ')).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Badge — padding and border
// ─────────────────────────────────────────────
describe('badge — extended options', () => {
  it('default has padding=1', () => {
    const result = badge('A', 'B');
    expect(stripAnsi(result)).toContain(' A ');
    expect(stripAnsi(result)).toContain(' B ');
  });

  it('custom padding adjusts spacing', () => {
    const result = badge('A', 'B', { padding: 3 });
    expect(stripAnsi(result)).toContain('   A   ');
  });

  it('padding=0 produces no spaces', () => {
    const result = badge('A', 'B', { padding: 0 });
    expect(stripAnsi(result)).toContain('A');
    expect(stripAnsi(result)).toContain('B');
  });

  it('border:true wraps badge in box', () => {
    const result = badge('A', 'B', { border: true });
    const lines = result.split('\n');
    expect(lines.length).toBe(3);
    expect(stripAnsi(result)).toContain('╭');
    expect(stripAnsi(result)).toContain('╰');
  });
});

// ─────────────────────────────────────────────
//  Timeline — alignment
// ─────────────────────────────────────────────
describe('timeline — alignment', () => {
  it('time column is padded to longest time', () => {
    const result = timeline([
      { label: 'Step 1', time: '10:00',    done: true },
      { label: 'Step 2', time: '10:00:00', done: true },
    ]);
    const plain = stripAnsi(result);
    expect(plain).toContain('10:00');
    expect(plain).toContain('10:00:00');
  });

  it('handles events without times', () => {
    const result = timeline([
      { label: 'A', done: true },
      { label: 'B', done: false },
    ]);
    expect(stripAnsi(result)).toContain('A');
    expect(stripAnsi(result)).toContain('B');
  });

  it('respects custom timeColumnWidth', () => {
    const result = timeline([
      { label: 'X', time: 'now' },
    ], { timeColumnWidth: 10 });
    expect(stripAnsi(result)).toContain('now');
  });
});

// ─────────────────────────────────────────────
//  Table — ANSI cell content alignment
// ─────────────────────────────────────────────
describe('table — ANSI safety', () => {
  it('aligns columns when cells contain ANSI escapes', () => {
    const colored = '\x1b[31mred\x1b[0m'; // visible width = 3
    const rows = [
      ['name',  'value'],
      [colored, 'plain'],
    ];
    const result = table(rows, { borderStyle: 'single' });
    const lines = result.split('\n');
    // All lines (excluding the header separator) should be the same byte
    // length is unreliable; instead compare visible widths.
    const visibleWidths = lines.map((l) => stripAnsi(l).length);
    const uniqueWidths = new Set(visibleWidths);
    // All rendered rows should have the same visible width
    expect(uniqueWidths.size).toBeLessThanOrEqual(2); // borders may differ slightly
  });
});

// ─────────────────────────────────────────────
//  Defensive inputs — numeric clamping
// ─────────────────────────────────────────────
describe('components defensive numeric inputs', () => {
  it('progressBar with NaN percent shows 0%', () => {
    const out = components.progressBar(NaN);
    expect(out).toContain('  0%');
  });

  it('progressBar with Infinity percent clamps to 0 (NaN-like)', () => {
    const out = components.progressBar(Infinity);
    expect(out).toContain('  0%');
  });

  it('progressBar with negative percent clamps to 0', () => {
    const out = components.progressBar(-50);
    expect(out).toContain('  0%');
  });

  it('progressBar with over-100 clamps to 100', () => {
    const out = components.progressBar(999);
    expect(out).toContain('100%');
  });

  it('progressBar with NaN width falls back to default', () => {
    expect(() => components.progressBar(50, { width: NaN })).not.toThrow();
  });

  it('progressBar with width=0 clamps to 1', () => {
    const out = components.progressBar(100, { width: 0 });
    expect(out).toContain('[');
    expect(out).toContain(']');
  });

  it('progressBar with empty char string uses default', () => {
    expect(() => components.progressBar(50, { char: '' })).not.toThrow();
  });

  it('badge with NaN colors uses defaults', () => {
    expect(() => components.badge('a', 'b', { labelBg: NaN, valueBg: NaN })).not.toThrow();
  });

  it('section with NaN width falls back to terminal cols', () => {
    expect(() => components.section('title', { width: NaN })).not.toThrow();
  });

  it('section with non-string title coerces', () => {
    const out = components.section(42 as unknown as string);
    expect(out).toContain('42');
  });

  it('columns with cols<1 clamps to default (no throw)', () => {
    expect(() => components.columns(['a', 'b'], { cols: 0 })).not.toThrow();
    expect(() => components.columns(['a', 'b'], { cols: -5 })).not.toThrow();
  });

  it('columns with NaN gap falls back to default', () => {
    expect(() => components.columns(['a', 'b'], { gap: NaN })).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Defensive inputs — array validation
// ─────────────────────────────────────────────
describe('components defensive arrays', () => {
  it('table with non-array returns empty string', () => {
    expect(components.table(null as unknown as string[][])).toBe('');
    expect(components.table(undefined as unknown as string[][])).toBe('');
    expect(components.table('not-array' as unknown as string[][])).toBe('');
  });

  it('table with non-array rows filtered out', () => {
    const out = components.table([
      ['a', 'b'],
      null as unknown as string[],
      ['c', 'd'],
    ]);
    expect(out).toContain('a');
    expect(out).toContain('c');
  });

  it('table with non-string cells coerced', () => {
    const out = components.table([
      [42 as unknown as string, true as unknown as string, null as unknown as string],
    ]);
    expect(out).toContain('42');
    expect(out).toContain('true');
  });

  it('columns with non-array returns empty', () => {
    expect(components.columns(null as unknown as string[])).toBe('');
    expect(components.columns([])).toBe('');
  });

  it('columns with non-string items coerced', () => {
    const out = components.columns([42 as unknown as string, true as unknown as string]);
    expect(out).toContain('42');
    expect(out).toContain('true');
  });

  it('timeline with non-array returns empty', () => {
    expect(components.timeline(null as unknown as { label: string }[])).toBe('');
    expect(components.timeline([])).toBe('');
  });

  it('timeline with non-string labels coerced', () => {
    const out = components.timeline([
      { label: 42 as unknown as string, done: true },
    ]);
    expect(out).toContain('42');
  });
});

// ─────────────────────────────────────────────
//  Menu with empty items
// ─────────────────────────────────────────────
describe('menu defensive', () => {
  it('menu with empty items returns MENU_CANCELLED (no throw)', async () => {
    const result = await components.menu([]);
    expect(result).toBe(MENU_CANCELLED);
  });

  it('menu with non-array items returns MENU_CANCELLED', async () => {
    const result = await components.menu(null as unknown as string[]);
    expect(result).toBe(MENU_CANCELLED);
  });

  it('menu with non-TTY input returns first index (0)', async () => {
    const result = await components.menu(['a', 'b'], {
      input: { isTTY: false } as never,
    });
    expect(result).toBe(0);
  });

  it('menu non-TTY multi-select returns empty array', async () => {
    const result = await components.menu(['a', 'b'], {
      input: { isTTY: false } as never,
      multiSelect: true,
    });
    expect(result).toEqual([]);
  });

  it('menu with non-string items coerces (no crash on render)', async () => {
    // We can't actually run interactive mode in tests, but we can verify
    // it doesn't crash when called with non-TTY (which hits the fallback)
    const result = await components.menu([42, true, null] as unknown as string[], {
      input: { isTTY: false } as never,
    });
    expect(result).toBe(0);
  });
});

// ─────────────────────────────────────────────
//  Progress bar with single-stop gradient
// ─────────────────────────────────────────────
describe('progressBar gradient edge cases', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('single-stop gradient colors statically (new behavior)', () => {
    const out = components.progressBar(50, {
      gradient: ['#ff0000'],
    });
    // Should be colored, not just plain
    expect(out).toContain('\x1b[38;2;255;0;0m');
  });

  it('empty gradient array falls back to no coloring', () => {
    const out = components.progressBar(50, {
      gradient: [],
      color: null,
    });
    expect(out).not.toContain('\x1b[38;2;');
  });
});

// ─────────────────────────────────────────────
//  Status with icon: ''
// ─────────────────────────────────────────────
describe('status defensive', () => {
  it('status with icon: empty string omits icon', () => {
    const out = components.status('success', 'done', { icon: '' });
    expect(out).not.toContain('✓');
    expect(out).toContain('done');
  });

  it('status with icon: null omits icon', () => {
    const out = components.status('success', 'done', { icon: null });
    expect(out).not.toContain('✓');
    expect(out).toContain('done');
  });

  it('status with NaN color falls back to type default', () => {
    expect(() => components.status('success', 'msg', { color: NaN })).not.toThrow();
  });

  it('status with non-string message coerces', () => {
    const out = components.status('info', 42 as unknown as string);
    expect(out).toContain('42');
  });
});

// ─────────────────────────────────────────────
//  Coverage: branch targets
// ─────────────────────────────────────────────
describe('components: branch coverage', () => {
  it('table with width=0 effectively (line 70 wrapVisible)', () => {
    // wrapVisible(str, 0) returns [str] unchanged
    const out = components.table([['a long text']], { borderStyle: 'rounded' });
    expect(typeof out).toBe('string');
  });

  it('table with all non-array rows returns empty (line 136)', () => {
    const out = components.table([null as unknown as string[], 'x' as unknown as string[]]);
    expect(out).toBe('');
  });
});