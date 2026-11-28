import {
  barChart, areaChart, heatmap, pieChart, scatterPlot,
  boxPlot, boxStats, candlestick, createStreamChart, composePlots,
} from '../charts/plots.js';
import { stripAnsi } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Phase 10 — chart types (v1.10.0)
//
//  All pure functions from data to string, so these assert on the geometry
//  the data implies: row counts, column widths, where the ink lands, and that
//  degenerate input degrades instead of throwing.
// ─────────────────────────────────────────────

const lines = (s: string): string[] => s.split('\n');
const widthOf = (s: string): number => Math.max(...lines(s).map((l) => stripAnsi(l).length));

describe('barChart', () => {
  it('renders one column per value at the requested height', () => {
    const out = barChart([1, 2, 3, 4], { height: 5, gap: 0 });
    expect(lines(out)).toHaveLength(5);
    expect(widthOf(out)).toBe(4);
  });

  it('grows taller bars for larger values', () => {
    const out = lines(barChart([1, 8], { height: 8, gap: 0 }));
    // Top row: only the larger value has ink.
    expect(out[0]![1]).not.toBe(' ');
    expect(out[0]![0]).toBe(' ');
    // Bottom row: both do.
    expect(out[7]![0]).not.toBe(' ');
    expect(out[7]![1]).not.toBe(' ');
  });

  it('uses the eighth-block ramp for sub-cell precision', () => {
    // A value at 1/16 of the scale is half of one row → a low eighth-block.
    const out = barChart([1, 16], { height: 1, gap: 0, min: 0, max: 16 });
    expect(/[▁▂▃▄▅▆▇]/.test(out)).toBe(true);
  });

  it('places grouped series side by side', () => {
    const out = barChart([
      { name: 'a', values: [1, 2] },
      { name: 'b', values: [3, 4] },
    ], { height: 4, gap: 1 });
    // 2 groups x 2 series + 1 gap = 5 columns.
    const body = lines(out).slice(0, 4);
    expect(Math.max(...body.map((l) => l.length))).toBe(5);
    expect(out).toContain('a');
    expect(out).toContain('b');
  });

  it('sums stacked series to the same total height', () => {
    const out = lines(barChart([
      { name: 'x', values: [5, 2] },
      { name: 'y', values: [5, 8] },
    ], { mode: 'stacked', height: 10, gap: 0 }));
    // Both groups total 10, so every row has ink in both columns.
    for (const row of out.slice(0, 10)) {
      expect(row[0]).not.toBe(' ');
      expect(row[1]).not.toBe(' ');
    }
  });

  it('shades stacked series so they are distinguishable without colour', () => {
    const out = barChart([
      { name: 'a', values: [5] },
      { name: 'b', values: [5] },
    ], { mode: 'stacked', height: 8, gap: 0 });
    const chars = new Set(stripAnsi(out).replace(/[\n ab█]/g, ''));
    expect(chars.size).toBeGreaterThan(0); // a second shade is present
    expect(out).toMatch(/[▓▒░]/);
  });

  it('uses solid blocks when a colorFn is supplied', () => {
    const out = barChart([
      { values: [5] }, { values: [5] },
    ], { mode: 'stacked', height: 8, colorFn: (t) => t });
    expect(stripAnsi(out)).not.toMatch(/[▓▒░]/);
  });

  it('renders horizontally when asked', () => {
    const out = barChart([5, 10], { orientation: 'horizontal', barWidth: 10, max: 10 });
    const rows = lines(out);
    expect(rows).toHaveLength(2);
    expect(stripAnsi(rows[1]!).length).toBeGreaterThan(stripAnsi(rows[0]!).length);
  });

  it('prints labels under their group, centred', () => {
    const out = barChart([1, 2], { height: 3, barWidth: 4, gap: 1, labels: ['t1', 't2'] });
    expect(lines(out).pop()).toBe(' t1   t2 '); // 4-wide group, 1 gap, 4-wide group
  });

  it('truncates a label that is wider than its group', () => {
    const out = barChart([1, 2], { height: 2, barWidth: 2, gap: 0, labels: ['alpha', 'beta'] });
    expect(lines(out).pop()).toBe('albe');
  });

  it('prints a legend for named series', () => {
    const out = barChart([
      { name: 'cpu', values: [1, 2] },
      { name: 'mem', values: [2, 1] },
    ], { height: 3 });
    expect(out).toContain('cpu');
    expect(out).toContain('mem');
  });

  it('ends a stacked bar exactly at the group total', () => {
    // Rounding each segment on its own lets the errors add up, so the bar
    // overshoots or falls short. Three equal series over 30 cells must be
    // exactly 10 + 10 + 10.
    const out = stripAnsi(barChart([
      { values: [10] }, { values: [10] }, { values: [10] },
    ], { mode: 'stacked', orientation: 'horizontal', barWidth: 30 }));
    expect(out).toHaveLength(30);
    expect(out).toBe(`${'█'.repeat(10)}${'▓'.repeat(10)}${'▒'.repeat(10)}`);
  });

  it('fills a stacked column to the full height when the group is the maximum', () => {
    const out = lines(barChart([
      { values: [42, 38, 55] }, { values: [3, 9, 2] },
    ], { mode: 'stacked', height: 20, gap: 0 }));
    // The tallest group (55 + 2) must reach the top row and every row below.
    for (const row of out) expect(stripAnsi(row)[2]).not.toBe(' ');
    // A segment worth more than half a row shows up once there is resolution.
    expect(out.join('\n')).toMatch(/▓/);
  });

  it('degrades instead of throwing on empty or non-finite data', () => {
    expect(barChart([])).toBe('');
    expect(barChart([{ values: [] }])).toBe('');
    expect(() => barChart([Number.NaN, 1, Number.POSITIVE_INFINITY])).not.toThrow();
    expect(() => barChart([1, 2], { height: 0 })).not.toThrow();
    expect(() => barChart([1, 2], { height: Number.NaN })).not.toThrow();
  });

  it('handles every value being identical', () => {
    expect(() => barChart([5, 5, 5], { height: 4 })).not.toThrow();
  });
});

describe('areaChart', () => {
  it('fills to the requested width and height', () => {
    const out = areaChart([1, 2, 3], { width: 20, height: 6 });
    expect(lines(out)).toHaveLength(6);
    expect(widthOf(out)).toBe(20);
  });

  it('fills below the curve, not above it', () => {
    const out = lines(areaChart([0, 10], { width: 2, height: 10, min: 0, max: 10 }));
    expect(out[0]![1]).not.toBe(' '); // the peak reaches the top
    expect(out[0]![0]).toBe(' ');     // the trough does not
    expect(out[9]![1]).not.toBe(' '); // and is filled all the way down
  });

  it('passes the row fraction to colorFn so a gradient is possible', () => {
    const seen: number[] = [];
    areaChart([1, 10], { width: 2, height: 4, colorFn: (t, f) => { seen.push(f); return t; } });
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
    expect(Math.min(...seen)).toBeGreaterThan(0);
    expect(new Set(seen).size).toBeGreaterThan(1); // varies by row
  });

  it('draws a constant series at mid height instead of an empty canvas', () => {
    const out = lines(areaChart([5, 5, 5], { width: 3, height: 4 }));
    expect(stripAnsi(out[3]!)).toBe('███'); // filled below
    expect(stripAnsi(out[0]!).trim()).toBe(''); // but not to the top
    expect(stripAnsi(out.join('')).replace(/[^█▁-▇]/g, '').length).toBeGreaterThan(0);
  });

  it('keeps a pinned bound as the edge for a constant series', () => {
    // min: 0 means the floor is the caller's, so a flat series fills the chart.
    const out = lines(areaChart([5, 5], { width: 2, height: 4, min: 0 }));
    expect(stripAnsi(out[0]!)).toBe('██');
    // max pinned instead: the band widens downwards, so the series sits on top.
    const capped = lines(areaChart([5, 5], { width: 2, height: 4, max: 5 }));
    expect(stripAnsi(capped[0]!)).toBe('██');
  });

  it('resamples when the width differs from the sample count', () => {
    expect(widthOf(areaChart([1, 2, 3, 4, 5, 6, 7, 8], { width: 4, height: 3 }))).toBe(4);
    expect(widthOf(areaChart([1, 9], { width: 30, height: 3 }))).toBe(30);
  });

  it('accepts a custom fill character', () => {
    const out = areaChart([10, 10], { width: 2, height: 2, fill: '#', min: 0, max: 10 });
    expect(out).toContain('#');
  });

  it('degrades on empty or odd input', () => {
    expect(areaChart([])).toBe('');
    expect(() => areaChart([Number.NaN])).not.toThrow();
    expect(() => areaChart([1], { width: 1, height: 1 })).not.toThrow();
  });
});

describe('heatmap', () => {
  it('renders one row per input row at cellWidth per value', () => {
    const out = heatmap([[0, 1], [2, 3]], { cellWidth: 3 });
    expect(lines(out)).toHaveLength(2);
    expect(widthOf(out)).toBe(6);
  });

  it('maps the lowest value to the coldest ramp step and the highest to the hottest', () => {
    const out = lines(heatmap([[0, 10]], { cellWidth: 1, ramp: ['.', 'o', 'O'] }));
    expect(out[0]).toBe('.O');
  });

  it('keeps the coldest step visible, so a blank cell means no data', () => {
    const out = lines(heatmap([[0, 9], [Number.NaN, 5]], { cellWidth: 1 }));
    expect(out[0]![0]).not.toBe(' '); // the minimum is drawn
    expect(out[1]![0]).toBe(' ');     // the hole is not
  });

  it('prints row labels aligned', () => {
    const out = lines(heatmap([[1], [2]], { rowLabels: ['a', 'long'], cellWidth: 1 }));
    expect(out[0]!.startsWith('a    ')).toBe(true);
    expect(out[1]!.startsWith('long ')).toBe(true);
  });

  it('tolerates ragged rows and non-finite cells', () => {
    const out = heatmap([[1, 2, 3], [1], [Number.NaN, 2]], { cellWidth: 1 });
    expect(lines(out)).toHaveLength(3);
    expect(() => heatmap([[Number.NaN]])).not.toThrow();
  });

  it('returns empty for no data', () => {
    expect(heatmap([])).toBe('');
  });

  it('reports the cell fraction to colorFn', () => {
    const seen: number[] = [];
    heatmap([[0, 5, 10]], { cellWidth: 1, colorFn: (t, f) => { seen.push(f); return t; } });
    expect(seen).toEqual([0, 0.5, 1]);
  });
});

describe('pieChart', () => {
  it('draws a round body plus a legend with percentages', () => {
    const out = pieChart([{ label: 'a', value: 3 }, { label: 'b', value: 1 }], { radius: 9 });
    expect(out).toContain('75.0%');
    expect(out).toContain('25.0%');
    expect(out).toContain('a');
  });

  it('omits the legend when asked', () => {
    const out = pieChart([{ value: 1 }], { radius: 7, legend: false });
    expect(out).not.toContain('%');
    expect(lines(out)).toHaveLength(7);
  });

  it('cuts out the middle for a donut', () => {
    const solid = pieChart([{ value: 1 }], { radius: 11, legend: false });
    const donut = pieChart([{ value: 1 }], { radius: 11, donut: true, legend: false });
    const ink = (s: string) => stripAnsi(s).replace(/[\n ]/g, '').length;
    expect(ink(donut)).toBeLessThan(ink(solid));
    // The centre row's middle cell is hollow.
    const mid = lines(donut)[5] as string;
    expect(mid[Math.floor(mid.length / 2)]).toBe(' ');
  });

  it('is wider than tall, correcting the cell aspect', () => {
    const out = pieChart([{ value: 1 }], { radius: 11, legend: false, cellAspect: 0.5 });
    expect(widthOf(out)).toBeGreaterThan(lines(out).length);
  });

  it('gives each wedge a distinct character', () => {
    const out = pieChart(
      [{ value: 1 }, { value: 1 }, { value: 1 }],
      { radius: 11, legend: false },
    );
    const chars = new Set(stripAnsi(out).replace(/[\n ]/g, ''));
    expect(chars.size).toBeGreaterThanOrEqual(3);
  });

  it('ignores zero, negative and non-finite slices', () => {
    const out = pieChart([{ value: 1 }, { value: 0 }, { value: -5 }, { value: Number.NaN }]);
    expect(out).toContain('100.0%');
    expect(pieChart([])).toBe('');
    expect(pieChart([{ value: 0 }])).toBe('');
  });
});

describe('scatterPlot', () => {
  it('renders at the requested size', () => {
    const out = scatterPlot([{ x: 0, y: 0 }, { x: 1, y: 1 }], { width: 20, height: 6 });
    expect(lines(out)).toHaveLength(6);
  });

  it('accepts tuples as well as objects', () => {
    const a = scatterPlot([{ x: 0, y: 0 }, { x: 1, y: 1 }], { width: 10, height: 4 });
    const b = scatterPlot([[0, 0], [1, 1]], { width: 10, height: 4 });
    expect(b).toBe(a);
  });

  it('puts low y at the bottom and high y at the top', () => {
    const out = lines(scatterPlot([[0, 0], [1, 10]], { width: 10, height: 4 }));
    expect(stripAnsi(out[0]!).trim()).not.toBe('');           // high value up top
    expect(stripAnsi(out[3]!).trim()).not.toBe('');           // low value at the bottom
  });

  it('uses Braille, packing several points per cell', () => {
    const points = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i % 5 }));
    const out = scatterPlot(points, { width: 6, height: 3 });
    expect(/[⠁-⣿]/.test(out)).toBe(true);
  });

  it('switches to plain marks when a marker is given', () => {
    const out = scatterPlot([[0, 0], [1, 1]], { width: 8, height: 3, marker: '*' });
    expect(out).toContain('*');
    expect(/[⠁-⣿]/.test(out)).toBe(false);
  });

  it('reports dot coverage to colorFn', () => {
    const seen: number[] = [];
    scatterPlot([[0, 0], [0.1, 0.1]], { width: 4, height: 2, colorFn: (t, f) => { seen.push(f); return t; } });
    expect(seen.every((f) => f > 0 && f <= 1)).toBe(true);
  });

  it('renders a blank canvas for no usable points', () => {
    const out = scatterPlot([], { width: 5, height: 2 });
    expect(lines(out)).toHaveLength(2);
    expect(stripAnsi(out).trim()).toBe('');
    expect(() => scatterPlot([[Number.NaN, 1]])).not.toThrow();
  });
});

describe('boxStats / boxPlot', () => {
  it('computes the five-number summary', () => {
    expect(boxStats([1, 2, 3, 4, 5])).toEqual({ min: 1, q1: 2, median: 3, q3: 4, max: 5 });
  });

  it('interpolates quantiles between samples', () => {
    const s = boxStats([1, 2, 3, 4]);
    expect(s.median).toBe(2.5);
    expect(s.q1).toBe(1.75);
    expect(s.q3).toBe(3.25);
  });

  it('handles one sample and no samples', () => {
    expect(boxStats([7])).toEqual({ min: 7, q1: 7, median: 7, q3: 7, max: 7 });
    expect(boxStats([])).toEqual({ min: 0, q1: 0, median: 0, q3: 0, max: 0 });
    expect(boxStats([Number.NaN, 3])).toEqual({ min: 3, q1: 3, median: 3, q3: 3, max: 3 });
  });

  it('draws whiskers, box and median in order', () => {
    const out = stripAnsi(boxPlot([0, 25, 50, 75, 100], { width: 40 }));
    expect(out).toHaveLength(40);
    expect(out[0]).toBe('├');
    expect(out[39]).toBe('┤');
    expect(out).toContain('╪');
    expect(out.indexOf('[')).toBeLessThan(out.indexOf('╪'));
    expect(out.indexOf('╪')).toBeLessThan(out.indexOf(']'));
  });

  it('accepts precomputed stats', () => {
    const fromStats = boxPlot({ min: 0, q1: 1, median: 2, q3: 3, max: 4 }, { width: 20 });
    const fromData = boxPlot([0, 1, 2, 3, 4], { width: 20 });
    expect(stripAnsi(fromStats)).toBe(stripAnsi(fromData));
  });

  it('prefixes a label', () => {
    expect(boxPlot([1, 2, 3], { label: 'lat', width: 10 }).startsWith('lat ')).toBe(true);
  });

  it('survives a degenerate sample', () => {
    expect(() => boxPlot([5, 5, 5], { width: 10 })).not.toThrow();
    expect(() => boxPlot([], { width: 10 })).not.toThrow();
  });
});

describe('candlestick', () => {
  it('renders one column per candle at the requested height', () => {
    const out = candlestick([
      { open: 1, high: 2, low: 0, close: 2 },
      { open: 2, high: 3, low: 1, close: 1 },
    ], { height: 6 });
    expect(lines(out)).toHaveLength(6);
    expect(widthOf(out)).toBe(2);
  });

  it('draws the body between open and close, and a wick to the extremes', () => {
    const out = lines(candlestick([{ open: 4, high: 10, low: 0, close: 6 }], { height: 11 }));
    const column = out.map((l) => stripAnsi(l)[0]);
    expect(column[0]).toBe('│');  // the high
    expect(column[10]).toBe('│'); // the low
    expect(column[5]).toBe('█');  // inside the body
  });

  it('marks a doji where open equals close', () => {
    const out = candlestick([{ open: 5, high: 8, low: 2, close: 5 }], { height: 7 });
    expect(out).toContain('─');
  });

  it('distinguishes rising from falling through the colour hooks', () => {
    const marks: string[] = [];
    candlestick([
      { open: 1, high: 2, low: 1, close: 2 },
      { open: 2, high: 2, low: 1, close: 1 },
    ], { height: 4, upFn: (t) => { marks.push('up'); return t; }, downFn: (t) => { marks.push('down'); return t; } });
    expect(marks).toContain('up');
    expect(marks).toContain('down');
  });

  it('skips incomplete candles and empty input', () => {
    expect(candlestick([])).toBe('');
    expect(candlestick([{ open: Number.NaN, high: 1, low: 0, close: 1 }])).toBe('');
    expect(() => candlestick([{ open: 1, high: 1, low: 1, close: 1 }])).not.toThrow();
  });
});

describe('createStreamChart', () => {
  it('keeps a rolling window and drops the oldest samples', () => {
    const chart = createStreamChart({ width: 5, height: 4 });
    for (let i = 1; i <= 12; i++) chart.push(i);
    expect(chart.length).toBe(5);
    expect(chart.values()).toEqual([8, 9, 10, 11, 12]);
  });

  it('renders at the configured height', () => {
    const chart = createStreamChart({ width: 10, height: 5 });
    chart.pushAll([1, 5, 3, 8, 2]);
    expect(lines(chart.render())).toHaveLength(5);
  });

  it('chains and clears', () => {
    const chart = createStreamChart({ width: 4 });
    expect(chart.push(1).push(2).pushAll([3, 4]).length).toBe(4);
    expect(chart.clear().length).toBe(0);
    expect(chart.values()).toEqual([]);
  });

  it('ignores non-finite samples', () => {
    const chart = createStreamChart({ width: 4 });
    chart.pushAll([1, Number.NaN, 2, Number.POSITIVE_INFINITY]);
    expect(chart.values()).toEqual([1, 2]);
  });

  it('renders in bar style when asked', () => {
    const chart = createStreamChart({ width: 6, height: 4, style: 'bars' });
    chart.pushAll([1, 4, 2, 6]);
    expect(lines(chart.render())).toHaveLength(4);
  });

  it('auto-scales to the window, and honours a pinned scale', () => {
    const auto = createStreamChart({ width: 3, height: 4 });
    auto.pushAll([100, 101, 102]);
    expect(stripAnsi(auto.render()).trim()).not.toBe(''); // uses the height despite a tiny span

    const pinned = createStreamChart({ width: 3, height: 4, min: 0, max: 1000 });
    pinned.pushAll([1, 2, 3]);
    expect(lines(pinned.render())[0]!.trim()).toBe(''); // tiny values stay low
  });

  it('renders something harmless when empty', () => {
    expect(() => createStreamChart({ height: 3 }).render()).not.toThrow();
  });
});

describe('composePlots', () => {
  it('places panels side by side', () => {
    const out = composePlots([
      { content: 'aa\naa' },
      { content: 'bb\nbb' },
    ], { gap: 1 });
    expect(lines(out)[0]).toBe('aa bb');
  });

  it('wraps to rows at the column count', () => {
    const out = composePlots([
      { content: 'a' }, { content: 'b' }, { content: 'c' },
    ], { columns: 2, gap: 1, rowGap: 0 });
    expect(lines(out)).toEqual(['a b', 'c']);
  });

  it('prints titles above each panel', () => {
    const out = composePlots([{ title: 'left', content: 'x' }], {});
    expect(lines(out)[0]).toBe('left');
    expect(lines(out)[1]).toBe('x');
  });

  it('pads uneven panels so columns stay aligned', () => {
    const out = composePlots([
      { content: 'short\nshort' },
      { content: 'much longer line\nb' },
    ], { gap: 2 });
    const rows = lines(out);
    // The second panel starts at the same column on both rows.
    expect(rows[0]!.indexOf('much')).toBe(rows[1]!.indexOf('b'));
  });

  it('measures width ignoring ANSI escapes, so coloured panels align', () => {
    const coloured = '\x1b[31mred\x1b[0m\n\x1b[31mred\x1b[0m';
    const out = composePlots([{ content: coloured }, { content: 'xy\nxy' }], { gap: 1 });
    const rows = lines(out).map((l) => stripAnsi(l));
    expect(rows[0]).toBe('red xy');
  });

  it('pads panels of differing heights', () => {
    const out = composePlots([{ content: 'a\nb\nc' }, { content: 'z' }], { gap: 1 });
    expect(lines(out)).toHaveLength(3);
    expect(lines(out)[0]).toBe('a z');
  });

  it('returns empty for no panels', () => {
    expect(composePlots([])).toBe('');
  });
});

// ─────────────────────────────────────────────
//  v1.10.0 — a series larger than a spread can carry
// ─────────────────────────────────────────────

describe('large series (v1.10.0 regression)', () => {
  // Every chart derives its scale from the data extent. Taking that extent
  // with `Math.min(...values)` throws RangeError once the series passes a few
  // hundred thousand samples, so these sizes are the assertion.
  const huge = (() => {
    const out = new Array(400_000);
    for (let i = 0; i < out.length; i++) out[i] = Math.sin(i / 1000) * 50;
    return out;
  })();

  it('areaChart resamples a 400k-sample series', () => {
    expect(lines(areaChart(huge, { width: 20, height: 3 }))).toHaveLength(3);
  });

  it('barChart scales a 400k-sample series', () => {
    expect(lines(barChart(huge.slice(0, 400_000), { height: 3, barWidth: 1 }))).toHaveLength(3);
  });

  it('heatmap handles a grid of a million cells', () => {
    const grid = Array.from({ length: 1000 }, (_, r) =>
      Array.from({ length: 1000 }, (_, c) => (r + c) % 50));
    expect(lines(heatmap(grid, { cellWidth: 1 }))).toHaveLength(1000);
  });

  it('scatterPlot plots a 400k-point cloud', () => {
    const cloud: [number, number][] = new Array(400_000);
    for (let i = 0; i < cloud.length; i++) cloud[i] = [i % 997, (i * 7) % 601];
    expect(lines(scatterPlot(cloud, { width: 20, height: 3 }))).toHaveLength(3);
  });

  it('boxStats summarizes a 400k-sample series', () => {
    const s = boxStats(huge);
    expect(s.min).toBeLessThan(s.max);
    expect(s.median).toBeGreaterThanOrEqual(s.q1);
  });

  it('candlestick handles 100k candles', () => {
    const candles = Array.from({ length: 100_000 }, (_, i) => ({
      open: i % 10, high: (i % 10) + 2, low: Math.max(0, (i % 10) - 1), close: (i % 10) + 1,
    }));
    expect(lines(candlestick(candles, { height: 4 }))).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────
//  The paths a well-formed call never reaches: contradictory bounds, points
//  outside a pinned window, and a grid that wraps.
// ─────────────────────────────────────────────

describe('chart bounds — the awkward cases', () => {
  it('swaps min and max when the caller passes them the wrong way round', () => {
    const swapped = barChart([1, 2, 3], { min: 10, max: 0, height: 4, gap: 0 });
    const correct = barChart([1, 2, 3], { min: 0, max: 10, height: 4, gap: 0 });
    expect(stripAnsi(swapped)).toBe(stripAnsi(correct));
  });

  it('widens a flat series away from whichever bound was pinned', () => {
    // A pinned bound stays the edge the caller asked for, so a series sitting
    // exactly on `min` really is at the floor — empty is the honest drawing.
    const floor = lines(areaChart([5, 5, 5], { min: 5, height: 4, width: 3 }));
    expect(floor).toHaveLength(4);
    expect(stripAnsi(floor.join('')).trim()).toBe('');

    // Pinned at `max`, the same series is at the ceiling and fills the canvas.
    const ceiling = lines(areaChart([5, 5, 5], { max: 5, height: 4, width: 3 }));
    expect(stripAnsi(ceiling[0] as string).trim().length).toBeGreaterThan(0);
    expect(stripAnsi(ceiling[3] as string).trim().length).toBeGreaterThan(0);
  });

  it('centres a flat series when neither bound is pinned', () => {
    // This is the case that used to render blank: widening upward only put
    // every sample on the floor, which looks exactly like no data at all.
    const mid = lines(areaChart([5, 5, 5], { height: 4, width: 3 }));
    expect(stripAnsi(mid[0] as string).trim()).toBe('');
    expect(stripAnsi(mid[3] as string).trim().length).toBeGreaterThan(0);
  });
});

describe('scatterPlot — points outside a pinned window', () => {
  it('drops a point left of xMin instead of clamping it to the edge', () => {
    const narrow = scatterPlot([[0, 5], [5, 5], [10, 5]], {
      width: 8, height: 4, xMin: 4, xMax: 6, yMin: 0, yMax: 10,
    });
    const wide = scatterPlot([[5, 5]], {
      width: 8, height: 4, xMin: 4, xMax: 6, yMin: 0, yMax: 10,
    });
    // Only the point inside the window is drawn, so the two agree.
    expect(stripAnsi(narrow)).toBe(stripAnsi(wide));
  });

  it('drops a point below yMin', () => {
    const out = scatterPlot([[5, -100], [5, 5]], {
      width: 8, height: 4, xMin: 0, xMax: 10, yMin: 0, yMax: 10,
    });
    const inside = scatterPlot([[5, 5]], {
      width: 8, height: 4, xMin: 0, xMax: 10, yMin: 0, yMax: 10,
    });
    expect(stripAnsi(out)).toBe(stripAnsi(inside));
  });

  it('still draws a point sitting exactly on a bound', () => {
    // Dropping out-of-range points must not cost the corners: the window is
    // inclusive at both ends.
    const corners = stripAnsi(scatterPlot([[0, 0], [10, 10]], {
      width: 4, height: 2, xMin: 0, xMax: 10, yMin: 0, yMax: 10,
    })).split('\n');
    expect((corners[0] as string).trimEnd().length).toBe(4);   // top right
    expect((corners[1] as string)[0]).not.toBe(' ');           // bottom left
  });

  it('drops an out-of-window point in marker mode too', () => {
    const out = scatterPlot([[99, 5], [5, 5]], {
      width: 6, height: 3, xMin: 0, xMax: 10, yMin: 0, yMax: 10, marker: '*',
    });
    expect(stripAnsi(out).split('').filter((c) => c === '*')).toHaveLength(1);
  });
});

describe('pieChart — the float gap at the last boundary', () => {
  it('fills the circle for slice counts whose fractions do not sum to 1', () => {
    // Six equal slices accumulate to 0.9999999999999999, which used to leave
    // a sliver of the circle past the last boundary.
    for (const n of [3, 6, 7, 9, 11]) {
      const slices = Array.from({ length: n }, (_, i) => ({ value: 1, label: `s${i}` }));
      const drawn = stripAnsi(pieChart(slices, { radius: 9, legend: false }));
      expect(drawn.length).toBeGreaterThan(0);
      // No cell inside the circle is left blank where a wedge should be: the
      // row through the centre is solid from edge to edge.
      const rows = drawn.split('\n');
      const middle = rows[Math.floor(rows.length / 2)] as string;
      expect(middle.trim()).not.toMatch(/\S\s\S/);
    }
  });
});

describe('composePlots — grids that wrap', () => {
  it('puts rowGap blank lines between rows but not after the last', () => {
    const grid = composePlots(
      [{ content: 'a' }, { content: 'b' }, { content: 'c' }],
      { columns: 2, rowGap: 2, gap: 2 },
    );
    expect(grid).toBe('a  b\n\n\nc');
    expect(grid.endsWith('\n')).toBe(false);
  });

  it('leaves no gap when every block fits on one row', () => {
    expect(composePlots([{ content: 'a' }, { content: 'b' }], { columns: 2, rowGap: 2 }))
      .toBe('a  b');  // the default gap is 2
  });
});
