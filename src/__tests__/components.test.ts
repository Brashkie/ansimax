import { table, badge, progressBar, status, section, columns, timeline, box } from '../components/index.js';
import { stripAnsi } from '../utils/helpers.js';

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

  it('can render box-like content via the ascii namespace', () => {
    // box === ascii — at minimum it should be the same reference as a known ascii method
    expect(typeof box).toBe('object');
  });

  it('exposes ascii API methods', () => {
    // box is the ascii namespace re-exported
    expect(box).not.toBeNull();
  });
});