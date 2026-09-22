import { sparkline, bar, histogram, lineChart } from '../charts/index.js';

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

describe('lineChart (v1.7.1)', () => {
  const BRAILLE_LO = 0x2800;
  const BRAILLE_HI = 0x28ff;
  const isBrailleOrSpace = (s: string): boolean =>
    [...s].every((ch) => {
      const cp = ch.codePointAt(0)!;
      return ch === '\n' || (cp >= BRAILLE_LO && cp <= BRAILLE_HI);
    });

  it('returns a grid of the requested cell dimensions', () => {
    const out = lineChart([0, 1, 2, 3], { width: 10, height: 4 });
    const lines = out.split('\n');
    expect(lines).toHaveLength(4);
    for (const l of lines) expect([...l]).toHaveLength(10);
  });

  it('emits only Braille glyphs (U+2800..U+28FF)', () => {
    const out = lineChart([0, 3, 1, 4, 2], { width: 8, height: 3 });
    expect(isBrailleOrSpace(out)).toBe(true);
  });

  it('accepts a plain number[] (single series)', () => {
    expect(typeof lineChart([1, 2, 3])).toBe('string');
  });

  it('accepts a LineChartSeries[] (multi series)', () => {
    const out = lineChart(
      [{ data: [0, 2, 4] }, { data: [4, 2, 0] }],
      { width: 8, height: 4 },
    );
    expect(out.split('\n')).toHaveLength(4);
  });

  it('draws a flat series along the vertical center', () => {
    const out = lineChart([5, 5, 5, 5], { width: 6, height: 4 });
    const lines = out.split('\n');
    // Center rows carry glyphs; the extreme rows stay blank.
    const nonBlank = lines
      .map((l, i) => ({ i, lit: [...l].some((c) => c !== '⠀') }))
      .filter((r) => r.lit)
      .map((r) => r.i);
    expect(nonBlank.length).toBeGreaterThan(0);
    expect(nonBlank).not.toContain(0);
    expect(nonBlank).not.toContain(lines.length - 1);
  });

  it('places larger values higher (inverted y)', () => {
    // Ramp up: the last (largest) column should light a higher row than the
    // first (smallest) column.
    const out = lineChart([0, 10], { width: 4, height: 4, min: 0, max: 10 });
    const lines = out.split('\n');
    const width = [...(lines[0] ?? '')].length;
    const firstLitRow = (colChars: string[]): number =>
      colChars.findIndex((c) => c !== '⠀');
    const leftCol = lines.map((l) => [...l][0] ?? '⠀');
    const rightCol = lines.map((l) => [...l][width - 1] ?? '⠀');
    expect(firstLitRow(rightCol)).toBeLessThan(firstLitRow(leftCol));
  });

  it('breaks the line on a non-finite point (gap)', () => {
    const solid = lineChart([0, 1, 2, 3, 4], { width: 10, height: 4 });
    const gapped = lineChart([0, 1, NaN, 3, 4], { width: 10, height: 4 });
    expect(gapped).not.toBe(solid);
  });

  it('returns empty string for an empty series', () => {
    expect(lineChart([])).toBe('');
  });

  it('returns empty string when no finite data exists', () => {
    expect(lineChart([NaN, Infinity, -Infinity])).toBe('');
  });

  it('handles a single data point without throwing', () => {
    const out = lineChart([7], { width: 4, height: 2 });
    expect(isBrailleOrSpace(out)).toBe(true);
  });

  it('clamps out-of-range values to the given min/max', () => {
    const out = lineChart([-100, 0, 100], { width: 6, height: 4, min: 0, max: 10 });
    expect(isBrailleOrSpace(out)).toBe(true);
  });

  it('passes each lit cell a coverage in (0, 1] to colorFn', () => {
    const seen: number[] = [];
    lineChart([0, 5, 0, 5, 0], {
      width: 6, height: 3,
      colorFn: (cell, coverage) => { seen.push(coverage); return cell; },
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const k of seen) {
      expect(k).toBeGreaterThan(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });

  it('does not invoke colorFn for blank cells', () => {
    let blankCalls = 0;
    lineChart([0, 0], {
      width: 6, height: 4,
      colorFn: (cell, coverage) => {
        if (coverage === 0) blankCalls++;
        return cell;
      },
    });
    expect(blankCalls).toBe(0);
  });

  it('ignores a malformed series entry (non-array data)', () => {
    // @ts-expect-error — exercising defensive runtime guard
    const out = lineChart([{ data: null }, { data: [0, 1, 2] }], { width: 6, height: 3 });
    expect(typeof out).toBe('string');
  });

  it('defaults to a 40×8 grid when no size is given', () => {
    const lines = lineChart([0, 1, 2, 3, 4, 5]).split('\n');
    expect(lines).toHaveLength(8);
    expect([...(lines[0] ?? '')]).toHaveLength(40);
  });
});
