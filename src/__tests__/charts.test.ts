import { sparkline, bar, histogram } from '../charts/index.js';

describe('sparkline (v1.6.6)', () => {
  it('renders one block char per value', () => {
    const s = sparkline([1, 5, 2, 8, 3, 7, 9, 4]);
    expect([...s]).toHaveLength(8);
  });

  it('maps the extremes to the lowest and highest ticks', () => {
    expect(sparkline([0, 8], { min: 0, max: 8 })).toBe('▁█');
  });

  it('renders a flat series at the lowest tick', () => {
    expect(sparkline([5, 5, 5])).toBe('▁▁▁');
  });

  it('renders non-finite entries as gaps (spaces)', () => {
    const s = sparkline([1, NaN, 9]);
    expect(s[1]).toBe(' ');
    expect(s).toHaveLength(3);
  });

  it('returns empty string for an empty series', () => {
    expect(sparkline([])).toBe('');
  });

  it('returns all spaces when nothing is finite', () => {
    expect(sparkline([NaN, Infinity])).toBe('  ');
  });

  it('honors explicit min/max bounds', () => {
    // With max far above the data, values sit near the bottom.
    const s = sparkline([1, 2], { min: 0, max: 100 });
    expect(s).toBe('▁▁');
  });

  it('applies a colorFn when provided', () => {
    const s = sparkline([1, 2], { colorFn: (tick) => `<${tick}>` });
    expect(s).toContain('<');
  });
});

describe('bar (v1.6.6)', () => {
  it('renders an empty bar at 0', () => {
    expect(bar(0, { width: 10 })).toBe(' '.repeat(10));
  });

  it('renders a full bar at 1', () => {
    expect(bar(1, { width: 10 })).toBe('█'.repeat(10));
  });

  it('fills half at 0.5', () => {
    const b = bar(0.5, { width: 10 });
    expect(b.startsWith('█████')).toBe(true);
    expect([...b]).toHaveLength(10);
  });

  it('uses partial blocks for sub-cell precision', () => {
    const b = bar(0.66, { width: 10 });
    // 0.66 * 10 = 6.6 cells → 6 full + a partial block
    expect(b).toMatch(/█{6}[▏▎▍▌▋▊▉]/);
  });

  it('clamps out-of-range fractions', () => {
    expect(bar(1.5, { width: 5 })).toBe('█'.repeat(5));
    expect(bar(-0.5, { width: 5 })).toBe(' '.repeat(5));
  });

  it('non-finite fraction renders empty', () => {
    expect(bar(NaN, { width: 5 })).toBe(' '.repeat(5));
  });

  it('honors a custom emptyChar', () => {
    expect(bar(0, { width: 3, emptyChar: '·' })).toBe('···');
  });
});

describe('histogram (v1.6.6)', () => {
  it('renders one line per row', () => {
    const out = histogram([
      { label: 'A', value: 10 },
      { label: 'B', value: 5 },
    ], { width: 10 });
    expect(out.split('\n')).toHaveLength(2);
  });

  it('scales bars to the max value', () => {
    const out = histogram([
      { label: 'A', value: 100 },
      { label: 'B', value: 50 },
    ], { width: 10, showValue: false });
    const [rowA, rowB] = out.split('\n');
    // A is the max → its bar is full; B is half.
    expect(rowA).toContain('█'.repeat(10));
    expect(rowB).not.toContain('█'.repeat(10));
  });

  it('aligns labels to a common width', () => {
    const out = histogram([
      { label: 'GET', value: 1 },
      { label: 'X', value: 1 },
    ], { width: 4 });
    const lines = out.split('\n');
    // Both label columns end at the same offset (before the ' │')
    expect(lines[0]!.indexOf('│')).toBe(lines[1]!.indexOf('│'));
  });

  it('shows values by default and hides them when asked', () => {
    const withVal = histogram([{ label: 'A', value: 42 }], { width: 5 });
    const without = histogram([{ label: 'A', value: 42 }], { width: 5, showValue: false });
    expect(withVal).toContain('42');
    expect(without).not.toContain('42');
  });

  it('returns empty string for no rows', () => {
    expect(histogram([])).toBe('');
  });

  it('handles an all-zero series without dividing by zero', () => {
    const out = histogram([
      { label: 'A', value: 0 },
      { label: 'B', value: 0 },
    ], { width: 6, showValue: false });
    expect(out.split('\n')).toHaveLength(2);
  });
});
