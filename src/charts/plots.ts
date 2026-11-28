/**
 * Chart types beyond lines and sparklines — Phase 10.
 *
 * Everything here is a pure function from data to a string: no I/O, no
 * dependencies, no terminal queries. Vertical resolution comes from the
 * eighth-block ramp (`▁▂▃▄▅▆▇█`) and half-blocks, and point plots use the
 * Braille canvas, so the output works in any terminal that renders Unicode.
 *
 * @module
 * @since 1.10.0
 */

import { cellAspectRatio } from '../utils/capabilities.js';
import { minMax } from '../utils/math.js';

/** Paints a cell's text; receives the normalized value that produced it. */
export type ChartColorFn = (text: string, fraction: number) => string;

const EIGHTHS = ['', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;
// Stacked series need to be told apart even with no colour available, so each
// gets its own shade. A caller supplying colorFn gets solid blocks instead.
const STACK_CHARS = ['█', '▓', '▒', '░', '▚', '▞'] as const;
const BRAILLE_BASE = 0x2800;
// Braille dot bit per (col, row) inside a 2x4 cell. The bottom row is bits
// 6 and 7 — not 3 and 7, which is the detail naive implementations get wrong.
const BRAILLE_BITS = [
  [0, 3],
  [1, 4],
  [2, 5],
  [6, 7],
] as const;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
// biome-ignore lint/complexity/useMathMinMax: Math.min(Math.max(n,0),1) is not equivalent — it normalizes -0 to 0 — and this runs once per rendered cell, where two branches beat two calls.
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);
const identity: ChartColorFn = (text) => text;

// Charts measure and truncate their own labels. SGR escapes are the only ones
// that reach a chart (they are what colorFn emits), so a local regex is enough
// and keeps this module from depending on the helpers module's width machinery.
const SGR_RE = /\x1b\[[0-9;]*m/g;
/** The text with SGR colour escapes removed. */
const stripSgr = (s: string): string => s.replace(SGR_RE, '');
/** Visible width, ignoring ANSI escapes. */
const plainWidth = (s: string): number => stripSgr(s).length;

/** Normalize a size option to a positive integer with a fallback. */
const dim = (value: number | undefined, fallback: number): number => {
  if (!finite(value)) return fallback;
  const n = Math.trunc(value);
  return n > 0 ? n : fallback;
};

/** Min/max over the finite values only, with a safe span. */
const extent = (values: readonly number[], min?: number, max?: number): [number, number] => {
  // One pass, no copy, and no spread — a spread here caps the chart at a few
  // hundred thousand samples with a stack overflow. See `minMax`.
  const [dataLo, dataHi] = minMax(values);
  let lo = finite(min) ? min : dataLo;
  let hi = finite(max) ? max : dataHi;
  if (lo > hi) [lo, hi] = [hi, lo];
  // A flat series has no span to scale against. Which way we widen matters:
  // a bound the caller pinned has to stay the edge they asked for, and with
  // neither pinned the band is centred, because a constant series pushed to
  // the floor renders as an empty canvas — indistinguishable from no data.
  if (lo === hi) {
    if (finite(min)) hi = lo + 1;
    else if (finite(max)) lo = hi - 1;
    else {
      lo -= 0.5;
      hi += 0.5;
    }
  }
  return [lo, hi];
};

// ─────────────────────────────────────────────
//  Bar charts — vertical, grouped, stacked
// ─────────────────────────────────────────────

/** One named series of values. @since 1.10.0 */
export interface ChartSeries {
  /** Shown in the legend; optional for a single series. */
  name?: string;
  values: number[];
  /** Overrides the chart-level `colorFn` for this series. */
  colorFn?: ChartColorFn;
}

/** Options for {@link barChart}. @since 1.10.0 */
export interface BarChartOptions {
  /** `'vertical'` grows upward in columns, `'horizontal'` rightward in rows. Default `'vertical'`. */
  orientation?: 'vertical' | 'horizontal';
  /** `'grouped'` puts series side by side, `'stacked'` sums them. Default `'grouped'`. */
  mode?: 'grouped' | 'stacked';
  /** Rows for vertical, bar length for horizontal. Default `8`. */
  height?: number;
  /** Columns per bar (vertical) or total width (horizontal). Default `1` / `20`. */
  barWidth?: number;
  /** Space between groups, in cells. Default `1`. */
  gap?: number;
  /** Baseline value. Default `0`, or the data minimum when it is negative. */
  min?: number;
  /** Top of the scale. Default: the data maximum (or the stacked totals). */
  max?: number;
  colorFn?: ChartColorFn;
  /** Category labels, printed under the bars when they fit. */
  labels?: string[];
}

/** Column of eighth-blocks for one value, bottom-up. */
const verticalColumn = (fraction: number, height: number): string[] => {
  const filled = clamp01(fraction) * height;
  const full = Math.floor(filled);
  const remainder = Math.round((filled - full) * 8);
  const cells: string[] = [];
  for (let row = 0; row < height; row++) {
    if (row < full) cells.push('█');
    else if (row === full && remainder > 0) cells.push(EIGHTHS[remainder] as string);
    else cells.push(' ');
  }
  return cells; // index 0 is the bottom row
};

/**
 * Bar chart: vertical or horizontal, grouped or stacked.
 *
 * Vertical bars use the eighth-block ramp, so each row carries eight levels
 * of sub-cell precision rather than one.
 *
 * @example
 * ```js
 * import { barChart } from 'ansimax';
 *
 * // Single series, vertical
 * console.log(barChart([3, 7, 4, 9, 2], { height: 6 }));
 *
 * // Two series side by side
 * console.log(barChart([
 *   { name: 'cpu', values: [30, 55, 70] },
 *   { name: 'mem', values: [45, 40, 60] },
 * ], { height: 8, labels: ['t1', 't2', 't3'] }));
 *
 * // Stacked
 * console.log(barChart([
 *   { name: 'pass', values: [8, 9, 7] },
 *   { name: 'fail', values: [2, 1, 3] },
 * ], { mode: 'stacked', height: 6 }));
 * ```
 *
 * @since 1.10.0
 */
export const barChart = (
  data: readonly number[] | readonly ChartSeries[],
  opts: BarChartOptions = {},
): string => {
  const series: ChartSeries[] = Array.isArray(data) && typeof data[0] === 'number'
    ? [{ values: [...(data as readonly number[])] }]
    : [...(data as readonly ChartSeries[])].map((s) => ({ ...s, values: [...(s.values ?? [])] }));
  if (series.length === 0) return '';

  const slots = Math.max(0, ...series.map((s) => s.values.length));
  if (slots === 0) return '';

  const stacked = opts.mode === 'stacked';
  const horizontal = opts.orientation === 'horizontal';
  const height = dim(opts.height, horizontal ? 1 : 8);
  const gap = finite(opts.gap) ? Math.max(0, Math.trunc(opts.gap)) : 1;
  const colorFn = opts.colorFn ?? identity;

  // With no colour to distinguish stacked series, shade them instead.
  const shaded = stacked && !opts.colorFn && !series.some((s) => s.colorFn);
  const tinted = (index: number): string =>
    shaded ? (STACK_CHARS[index % STACK_CHARS.length] as string) : '█';

  const at = (s: ChartSeries, i: number): number => {
    const v = s.values[i];
    return finite(v) ? v : 0;
  };

  // Scale: stacked compares against group totals, grouped against each value.
  const totals = stacked
    ? Array.from({ length: slots }, (_, i) => series.reduce((sum, s) => sum + Math.max(0, at(s, i)), 0))
    : series.flatMap((s) => s.values.filter(finite));
  const [lo, hi] = extent(totals, opts.min ?? 0, opts.max);
  const span = hi - lo;

  if (horizontal) {
    const width = dim(opts.barWidth, 20);
    const lines: string[] = [];
    for (let i = 0; i < slots; i++) {
      const label = opts.labels?.[i];
      const prefix = label === undefined ? '' : `${label} `;
      if (stacked) {
        let line = '';
        // Round the cumulative boundary, not each segment: rounding segments
        // one by one lets the errors add up, so the bar overshoots or falls
        // short of the total it is supposed to represent.
        let acc = 0;
        let drawn = 0;
        series.forEach((s, si) => {
          const value = Math.max(0, at(s, i));
          acc += value;
          const edge = Math.min(width, Math.round((acc / span) * width));
          const cells = Math.max(0, edge - drawn);
          drawn = edge;
          const paint = s.colorFn ?? colorFn;
          const ch = tinted(si);
          line += paint(ch.repeat(cells), clamp01(value / hi));
        });
        lines.push(prefix + line);
      } else {
        for (const s of series) {
          const fraction = clamp01((at(s, i) - lo) / span);
          const cells = Math.round(fraction * width);
          const paint = s.colorFn ?? colorFn;
          const name = series.length > 1 && s.name ? `${s.name} ` : '';
          lines.push(prefix + name + paint('█'.repeat(cells), fraction));
        }
      }
    }
    return lines.join('\n');
  }

  // Vertical: build columns, then transpose into rows top-down.
  const barWidth = dim(opts.barWidth, 1);
  const columns: string[][] = []; // each is bottom-up
  for (let i = 0; i < slots; i++) {
    if (stacked) {
      const column: string[] = new Array(height).fill(' ');
      // Cumulative boundaries, as above: the stack then ends exactly where the
      // group total says it should, instead of drifting by the rounding of
      // every segment below it.
      let acc = 0;
      let used = 0;
      series.forEach((s, si) => {
        const value = Math.max(0, at(s, i));
        acc += value;
        const edge = Math.min(height, Math.round((acc / span) * height));
        const paint = s.colorFn ?? colorFn;
        const ch = tinted(si);
        for (let r = used; r < edge; r++) {
          column[r] = paint(ch, clamp01(value / hi));
        }
        used = Math.max(used, edge);
      });
      for (let w = 0; w < barWidth; w++) columns.push(column);
    } else {
      for (const s of series) {
        const fraction = clamp01((at(s, i) - lo) / span);
        const paint = s.colorFn ?? colorFn;
        const column = verticalColumn(fraction, height).map((c) => (c === ' ' ? ' ' : paint(c, fraction)));
        for (let w = 0; w < barWidth; w++) columns.push(column);
      }
    }
    if (i < slots - 1) for (let g = 0; g < gap; g++) columns.push(new Array(height).fill(' '));
  }

  const rows: string[] = [];
  for (let row = height - 1; row >= 0; row--) {
    rows.push(columns.map((c) => c[row] as string).join(''));
  }

  if (opts.labels && opts.labels.length > 0) {
    const perGroup = stacked ? barWidth : series.length * barWidth;
    let line = '';
    for (let i = 0; i < slots; i++) {
      const raw = opts.labels[i] ?? '';
      // Truncate on the visible text so an escape sequence is never cut in
      // half, then centre what is left over the group it belongs to.
      const label = plainWidth(raw) <= perGroup ? raw : [...stripSgr(raw)].slice(0, perGroup).join('');
      const pad = Math.max(0, perGroup - plainWidth(label));
      const left = pad >> 1;
      line += ' '.repeat(left) + label + ' '.repeat(pad - left);
      if (i < slots - 1) line += ' '.repeat(gap);
    }
    rows.push(line);
  }
  if (series.length > 1 && series.some((s) => s.name)) {
    rows.push(series.map((s, i) =>
      `${i === 0 ? '' : '  '}${tinted(i)} ${s.name ?? `s${i + 1}`}`).join(''));
  }
  return rows.join('\n');
};

// ─────────────────────────────────────────────
//  Area chart
// ─────────────────────────────────────────────

/** Options for {@link areaChart}. @since 1.10.0 */
export interface AreaChartOptions {
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  /** Receives the row's height fraction, so a gradient can be applied vertically. */
  colorFn?: ChartColorFn;
  /** Character filling the area. Default `'█'`. */
  fill?: string;
}

/**
 * Area chart — a filled line. Values are resampled to the width, and the
 * topmost cell of each column uses the eighth-block ramp for sub-cell detail.
 *
 * `colorFn` receives each row's height fraction, which is what makes a
 * vertical gradient a one-liner.
 *
 * @example
 * ```js
 * import { areaChart, color } from 'ansimax';
 *
 * console.log(areaChart([1, 4, 2, 8, 5, 9, 3], { width: 28, height: 8 }));
 *
 * // Vertical gradient: hot at the top
 * console.log(areaChart([1, 4, 2, 8, 5, 9, 3], {
 *   width: 28,
 *   height: 8,
 *   colorFn: (ch, f) => color.hex(ch, f > 0.66 ? '#ff4444' : f > 0.33 ? '#ffaa00' : '#44ff88'),
 * }));
 * ```
 *
 * @since 1.10.0
 */
export const areaChart = (values: readonly number[], opts: AreaChartOptions = {}): string => {
  const data = [...values];
  if (data.length === 0) return '';
  const width = dim(opts.width, Math.min(40, data.length));
  const height = dim(opts.height, 8);
  const colorFn = opts.colorFn ?? identity;
  const fill = [...(opts.fill ?? '█')][0] ?? '█';
  const [lo, hi] = extent(data, opts.min, opts.max);
  const span = hi - lo;

  // Resample to the chart width by nearest source sample.
  const sampled: number[] = [];
  for (let x = 0; x < width; x++) {
    const idx = width === 1 ? 0 : Math.round((x / (width - 1)) * (data.length - 1));
    const v = data[idx];
    sampled.push(finite(v) ? v : lo);
  }

  const rows: string[] = [];
  for (let row = height - 1; row >= 0; row--) {
    const rowFraction = height === 1 ? 1 : (row + 1) / height;
    let line = '';
    for (const value of sampled) {
      const filled = clamp01((value - lo) / span) * height;
      const full = Math.floor(filled);
      if (row < full) line += colorFn(fill, rowFraction);
      else if (row === full) {
        const eighth = Math.round((filled - full) * 8);
        line += eighth > 0 ? colorFn(EIGHTHS[eighth] as string, rowFraction) : ' ';
      } else line += ' ';
    }
    rows.push(line);
  }
  return rows.join('\n');
};

// ─────────────────────────────────────────────
//  Heatmap
// ─────────────────────────────────────────────

/** Options for {@link heatmap}. @since 1.10.0 */
export interface HeatmapOptions {
  min?: number;
  max?: number;
  /** Ramp from coldest to hottest. Default a five-step block ramp. */
  ramp?: readonly string[];
  /** Receives the cell's normalized value, for true-color mapping. */
  colorFn?: ChartColorFn;
  /** Cells per value, which squares up the 1:2 aspect of a character cell. Default `2`. */
  cellWidth?: number;
  /** Row labels, printed to the left. */
  rowLabels?: string[];
}

// The coldest step is NOT a space: a blank cell means "no data" in a heatmap,
// so a space here would make the minimum indistinguishable from a hole.
const DEFAULT_RAMP = ['░', '▒', '▓', '█'] as const;

/**
 * Heatmap of a 2D grid. Each value becomes `cellWidth` characters, which
 * defaults to 2 so cells read roughly square against a terminal's 1:2 glyph.
 *
 * Ragged rows are allowed; missing cells render as blanks.
 *
 * @example
 * ```js
 * import { heatmap } from 'ansimax';
 *
 * const grid = [
 *   [0, 1, 2, 3],
 *   [1, 3, 5, 2],
 *   [4, 2, 0, 1],
 * ];
 * console.log(heatmap(grid, { rowLabels: ['mon', 'tue', 'wed'] }));
 * ```
 *
 * @since 1.10.0
 */
export const heatmap = (
  grid: readonly (readonly number[])[],
  opts: HeatmapOptions = {},
): string => {
  if (!Array.isArray(grid) || grid.length === 0) return '';
  const ramp = opts.ramp && opts.ramp.length > 0 ? opts.ramp : DEFAULT_RAMP;
  const colorFn = opts.colorFn ?? identity;
  const cellWidth = dim(opts.cellWidth, 2);
  const flat = grid.flatMap((row) => (Array.isArray(row) ? row.filter(finite) : []));
  const [lo, hi] = extent(flat, opts.min, opts.max);
  const span = hi - lo;

  let labelWidth = 0;
  if (opts.rowLabels) {
    const n = Math.min(opts.rowLabels.length, grid.length);
    for (let i = 0; i < n; i++) {
      const w = plainWidth(opts.rowLabels[i] ?? '');
      if (w > labelWidth) labelWidth = w;
    }
  }

  let cols = 0;
  for (const row of grid) {
    const n = Array.isArray(row) ? row.length : 0;
    if (n > cols) cols = n;
  }

  // One cell is the same string every time it is drawn, so widen each ramp
  // step once instead of calling `repeat` per cell — a 40x20 grid goes from
  // 800 allocations to the ramp's length.
  const cells = ramp.map((ch) => ch.repeat(cellWidth));
  const blank = ' '.repeat(cellWidth);
  const top = ramp.length - 1;

  const out: string[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    const isRow = Array.isArray(row);
    let line = opts.rowLabels ? `${(opts.rowLabels[y] ?? '').padEnd(labelWidth)} ` : '';
    for (let x = 0; x < cols; x++) {
      const value = isRow ? (row as readonly number[])[x] : undefined;
      if (!finite(value)) {
        line += blank;
        continue;
      }
      const fraction = clamp01((value - lo) / span);
      const step = Math.min(top, Math.round(fraction * top));
      line += colorFn(cells[step] as string, fraction);
    }
    out.push(line);
  }
  return out.join('\n');
};

// ─────────────────────────────────────────────
//  Pie / donut
// ─────────────────────────────────────────────

/** One wedge. @since 1.10.0 */
export interface PieSlice {
  label?: string;
  value: number;
  colorFn?: ChartColorFn;
}

/** Options for {@link pieChart}. @since 1.10.0 */
export interface PieChartOptions {
  /** Diameter in rows; the width is derived from the cell aspect. Default `11`. */
  radius?: number;
  /** Cut out the middle. Default `false`. */
  donut?: boolean;
  /** Inner radius as a fraction of the outer one, when `donut`. Default `0.45`. */
  innerRatio?: number;
  /** Append a `label  value (pct%)` legend. Default `true`. */
  legend?: boolean;
  /** Characters cycled per wedge when a slice has no `colorFn`. */
  chars?: readonly string[];
  /** Cell width : height ratio. Default from {@link cellAspectRatio}. */
  cellAspect?: number;
}

const PIE_CHARS = ['█', '▓', '▒', '░', '▚', '▞', '◆', '●'] as const;

/**
 * Pie or donut chart with a percentage legend.
 *
 * Each character cell is tested by angle and radius, and horizontal distance
 * is divided by the cell aspect ratio so the result reads round rather than
 * as a squashed oval.
 *
 * @example
 * ```js
 * import { pieChart } from 'ansimax';
 *
 * console.log(pieChart([
 *   { label: 'pass', value: 72 },
 *   { label: 'fail', value: 18 },
 *   { label: 'skip', value: 10 },
 * ], { radius: 11 }));
 *
 * console.log(pieChart([{ value: 1 }, { value: 2 }], { donut: true }));
 * ```
 *
 * @since 1.10.0
 */
export const pieChart = (slices: readonly PieSlice[], opts: PieChartOptions = {}): string => {
  const valid = slices.filter((s) => s && finite(s.value) && s.value > 0);
  if (valid.length === 0) return '';

  const total = valid.reduce((sum, s) => sum + s.value, 0);
  const rows = dim(opts.radius, 11);
  const radius = rows / 2;
  const aspect = finite(opts.cellAspect) && opts.cellAspect > 0 ? opts.cellAspect : cellAspectRatio();
  const cols = Math.max(1, Math.round(rows / aspect));
  const chars = opts.chars && opts.chars.length > 0 ? opts.chars : PIE_CHARS;
  const inner = opts.donut === true
    ? radius * (finite(opts.innerRatio) ? clamp01(opts.innerRatio) : 0.45)
    : 0;

  // Cumulative angles, clockwise from 12 o'clock.
  const bounds: number[] = [];
  let acc = 0;
  for (const s of valid) {
    acc += s.value / total;
    bounds.push(acc * Math.PI * 2);
  }
  // The fractions are floats, so they do not always sum to exactly 1: six
  // equal slices accumulate to 0.9999999999999999 and leave a sliver of the
  // circle past the last boundary. Opening the last boundary means every
  // angle lands in a slice by construction, instead of needing a fallback.
  bounds[bounds.length - 1] = Number.POSITIVE_INFINITY;

  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    const dy = row + 0.5 - radius;
    let line = '';
    for (let col = 0; col < cols; col++) {
      const dx = (col + 0.5 - cols / 2) * aspect;
      const dist = Math.hypot(dx, dy);
      if (dist > radius || dist < inner) {
        line += ' ';
        continue;
      }
      // atan2 measured clockwise from straight up.
      let angle = Math.atan2(dx, -dy);
      if (angle < 0) angle += Math.PI * 2;
      // The last boundary is +Infinity, so this always finds a slice.
      const index = bounds.findIndex((b) => angle < b);
      const slice = valid[index] as PieSlice;
      const ch = chars[index % chars.length] as string;
      line += slice.colorFn ? slice.colorFn(ch, slice.value / total) : ch;
    }
    lines.push(line);
  }

  if (opts.legend !== false) {
    valid.forEach((s, i) => {
      const pct = ((s.value / total) * 100).toFixed(1);
      const ch = chars[i % chars.length] as string;
      const mark = s.colorFn ? s.colorFn(ch, s.value / total) : ch;
      lines.push(`${mark} ${s.label ?? `slice ${i + 1}`}  ${s.value} (${pct}%)`);
    });
  }
  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Scatter plot
// ─────────────────────────────────────────────

/** A point. @since 1.10.0 */
export interface ScatterPoint {
  x: number;
  y: number;
}

/** Options for {@link scatterPlot}. @since 1.10.0 */
export interface ScatterOptions {
  /** Character columns. Default `40`. */
  width?: number;
  /** Character rows. Default `12`. */
  height?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  colorFn?: ChartColorFn;
  /** Draw plain marks instead of Braille dots (each point a whole cell). */
  marker?: string;
}

/**
 * Scatter plot on a Braille canvas, so each character cell holds a 2x4 grid
 * of points — eight times the resolution of one mark per cell.
 *
 * @example
 * ```js
 * import { scatterPlot } from 'ansimax';
 *
 * const points = Array.from({ length: 200 }, (_, i) => ({
 *   x: i / 10,
 *   y: Math.sin(i / 10) * 5,
 * }));
 * console.log(scatterPlot(points, { width: 40, height: 10 }));
 *
 * // Plain marks instead of Braille
 * console.log(scatterPlot(points, { marker: '*' }));
 * ```
 *
 * @since 1.10.0
 */
export const scatterPlot = (
  points: readonly ScatterPoint[] | readonly (readonly [number, number])[],
  opts: ScatterOptions = {},
): string => {
  const pts: ScatterPoint[] = [];
  for (const p of points) {
    if (Array.isArray(p)) {
      const [x, y] = p as readonly [number, number];
      if (finite(x) && finite(y)) pts.push({ x, y });
    } else {
      const o = p as ScatterPoint;
      if (o && finite(o.x) && finite(o.y)) pts.push({ x: o.x, y: o.y });
    }
  }
  const width = dim(opts.width, 40);
  const height = dim(opts.height, 12);
  const colorFn = opts.colorFn ?? identity;
  if (pts.length === 0) return Array.from({ length: height }, () => ' '.repeat(width)).join('\n');

  const [xLo, xHi] = extent(pts.map((p) => p.x), opts.xMin, opts.xMax);
  const [yLo, yHi] = extent(pts.map((p) => p.y), opts.yMin, opts.yMax);

  if (opts.marker !== undefined) {
    const mark = [...opts.marker][0] ?? '*';
    const grid: string[][] = Array.from({ length: height }, () => new Array<string>(width).fill(' '));
    for (const p of pts) {
      // A point outside a pinned window is dropped, not clamped to the edge:
      // clamping draws a mark where there is no sample, which reads as data.
      const col = Math.round(((p.x - xLo) / (xHi - xLo)) * (width - 1));
      const row = Math.round((1 - (p.y - yLo) / (yHi - yLo)) * (height - 1));
      if (col < 0 || col > width - 1 || row < 0 || row > height - 1) continue;
      (grid[row] as string[])[col] = mark;
    }
    return grid.map((r) => r.map((c) => (c === ' ' ? ' ' : colorFn(c, 1))).join('')).join('\n');
  }

  // Braille: 2 sub-columns x 4 sub-rows per cell.
  const subW = width * 2;
  const subH = height * 4;
  const bits: number[][] = Array.from({ length: height }, () => new Array<number>(width).fill(0));
  for (const p of pts) {
    // Same rule as the marker path: out of the window means out of the chart.
    const sx = Math.round(((p.x - xLo) / (xHi - xLo)) * (subW - 1));
    const sy = Math.round((1 - (p.y - yLo) / (yHi - yLo)) * (subH - 1));
    if (sx < 0 || sx > subW - 1 || sy < 0 || sy > subH - 1) continue;
    const row = Math.floor(sy / 4);
    const col = Math.floor(sx / 2);
    const bit = (BRAILLE_BITS[sy % 4] as readonly number[])[sx % 2] as number;
    const bitRow = bits[row] as number[];
    bitRow[col] = (bitRow[col] as number) | (1 << bit);
  }
  return bits.map((row) => row.map((mask) => {
    if (mask === 0) return ' ';
    const ch = String.fromCodePoint(BRAILLE_BASE + mask);
    // Up to 8 dots per cell; coverage drives the colour.
    let lit = 0;
    for (let b = 0; b < 8; b++) if ((mask >> b) & 1) lit++;
    return colorFn(ch, lit / 8);
  }).join('')).join('\n');
};

// ─────────────────────────────────────────────
//  Box plot and candlestick
// ─────────────────────────────────────────────

/** Options for {@link boxPlot}. @since 1.10.0 */
export interface BoxPlotOptions {
  /** Total width in cells. Default `40`. */
  width?: number;
  min?: number;
  max?: number;
  colorFn?: ChartColorFn;
  /** Label printed before the box. */
  label?: string;
}

/** The five-number summary {@link boxPlot} computes. @since 1.10.0 */
export interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

/** Linear-interpolation quantile over sorted values. */
const quantile = (sorted: readonly number[], q: number): number => {
  /* istanbul ignore next — unreachable: boxStats, the only caller, returns
     the all-zero summary before it gets here. */
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] as number;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lower = sorted[base] as number;
  const upper = sorted[Math.min(sorted.length - 1, base + 1)] as number;
  return lower + (upper - lower) * rest;
};

/** The five-number summary of a sample. @since 1.10.0 */
export const boxStats = (values: readonly number[]): BoxStats => {
  const sorted = values.filter(finite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  return {
    min: sorted[0] as number,
    q1: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    q3: quantile(sorted, 0.75),
    max: sorted[sorted.length - 1] as number,
  };
};

/**
 * Box plot of a sample (or of a precomputed {@link BoxStats}), drawn as
 * whiskers, box and median: `├──[══╪══]──┤`.
 *
 * @example
 * ```js
 * import { boxPlot, boxStats } from 'ansimax';
 *
 * const latencies = [12, 15, 14, 22, 19, 13, 48, 16, 15, 17];
 * console.log(boxPlot(latencies, { label: 'p50', width: 40 }));
 *
 * boxStats(latencies);  // → { min: 12, q1: 14, median: 15.5, q3: 19.75, max: 48 }
 * ```
 *
 * @since 1.10.0
 */
export const boxPlot = (
  input: readonly number[] | BoxStats,
  opts: BoxPlotOptions = {},
): string => {
  const stats: BoxStats = Array.isArray(input) ? boxStats(input) : (input as BoxStats);
  const width = dim(opts.width, 40);
  const colorFn = opts.colorFn ?? identity;
  const [lo, hi] = extent([stats.min, stats.max], opts.min, opts.max);
  const span = hi - lo;
  const pos = (v: number): number =>
    Math.min(width - 1, Math.max(0, Math.round(((v - lo) / span) * (width - 1))));

  const cells = new Array<string>(width).fill(' ');
  const [pMin, pQ1, pMed, pQ3, pMax] = [
    pos(stats.min), pos(stats.q1), pos(stats.median), pos(stats.q3), pos(stats.max),
  ];
  for (let i = pMin; i <= pQ1; i++) cells[i] = '─';
  for (let i = pQ3; i <= pMax; i++) cells[i] = '─';
  for (let i = pQ1; i <= pQ3; i++) cells[i] = '═';
  cells[pMin] = '├';
  cells[pMax] = '┤';
  if (pQ1 !== pMin) cells[pQ1] = '[';
  if (pQ3 !== pMax) cells[pQ3] = ']';
  cells[pMed] = '╪';

  const body = colorFn(cells.join(''), 1);
  return opts.label === undefined ? body : `${opts.label} ${body}`;
};

/** One OHLC bar. @since 1.10.0 */
export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Options for {@link candlestick}. @since 1.10.0 */
export interface CandlestickOptions {
  /** Character rows. Default `12`. */
  height?: number;
  min?: number;
  max?: number;
  /** Paints a rising candle. */
  upFn?: ChartColorFn;
  /** Paints a falling candle. */
  downFn?: ChartColorFn;
}

/**
 * Candlestick (OHLC) chart, one column per candle. The body is drawn with
 * `█`, the wick with `│`, and a doji — open equal to close — with `─`.
 *
 * @example
 * ```js
 * import { candlestick, color } from 'ansimax';
 *
 * console.log(candlestick([
 *   { open: 10, high: 14, low: 9,  close: 13 },
 *   { open: 13, high: 15, low: 11, close: 11 },
 *   { open: 11, high: 12, low: 8,  close: 9  },
 * ], {
 *   height: 10,
 *   upFn: (ch) => color.hex(ch, '#44ff88'),
 *   downFn: (ch) => color.hex(ch, '#ff4444'),
 * }));
 * ```
 *
 * @since 1.10.0
 */
export const candlestick = (
  candles: readonly Candle[],
  opts: CandlestickOptions = {},
): string => {
  const valid = candles.filter(
    (c) => c && finite(c.open) && finite(c.high) && finite(c.low) && finite(c.close),
  );
  if (valid.length === 0) return '';
  const height = dim(opts.height, 12);
  const upFn = opts.upFn ?? identity;
  const downFn = opts.downFn ?? identity;

  const all = valid.flatMap((c) => [c.high, c.low]);
  const [lo, hi] = extent(all, opts.min, opts.max);
  const span = hi - lo;
  const rowOf = (v: number): number =>
    Math.min(height - 1, Math.max(0, Math.round((1 - (v - lo) / span) * (height - 1))));

  const grid: string[][] = Array.from({ length: height }, () => new Array<string>(valid.length).fill(' '));
  valid.forEach((c, x) => {
    const rising = c.close >= c.open;
    const paint = rising ? upFn : downFn;
    const topBody = rowOf(Math.max(c.open, c.close));
    const bottomBody = rowOf(Math.min(c.open, c.close));
    for (let r = rowOf(c.high); r <= rowOf(c.low); r++) (grid[r] as string[])[x] = paint('│', 0.5);
    for (let r = topBody; r <= bottomBody; r++) (grid[r] as string[])[x] = paint('█', 1);
    if (topBody === bottomBody) (grid[topBody] as string[])[x] = paint('─', 1);
  });
  return grid.map((r) => r.join('')).join('\n');
};

// ─────────────────────────────────────────────
//  Streaming chart
// ─────────────────────────────────────────────

/** Options for {@link createStreamChart}. @since 1.10.0 */
export interface StreamChartOptions {
  /** Samples kept — the rolling window, and the chart width. Default `40`. */
  width?: number;
  /** Character rows. Default `8`. */
  height?: number;
  /** Fixed scale bottom. Default: auto from the window. */
  min?: number;
  /** Fixed scale top. Default: auto from the window. */
  max?: number;
  /** `'area'` fills under the line, `'bars'` draws columns. Default `'area'`. */
  style?: 'area' | 'bars';
  colorFn?: ChartColorFn;
}

/** A live chart over a rolling window. @since 1.10.0 */
export interface StreamChart {
  /** Append one sample, dropping the oldest past the window. Chainable. */
  push(value: number): StreamChart;
  /** Append several samples. Chainable. */
  pushAll(values: readonly number[]): StreamChart;
  /** Render the current window. */
  render(): string;
  /** The samples currently held, oldest first. */
  values(): number[];
  /** Drop every sample. Chainable. */
  clear(): StreamChart;
  /** How many samples are held. */
  readonly length: number;
}

/**
 * A chart over a rolling window, for a live feed. Samples past the window
 * fall off the left, so memory stays bounded however long it runs.
 *
 * Auto-scaling tracks the window rather than all history, so the chart keeps
 * using its full height as the signal drifts; pin `min`/`max` to stop the
 * scale from moving.
 *
 * @example
 * ```js
 * import { createStreamChart } from 'ansimax';
 *
 * const chart = createStreamChart({ width: 50, height: 8 });
 *
 * setInterval(() => {
 *   chart.push(process.cpuUsage().user / 1e6);
 *   console.clear();
 *   console.log(chart.render());
 * }, 250);
 * ```
 *
 * @since 1.10.0
 */
export const createStreamChart = (opts: StreamChartOptions = {}): StreamChart => {
  const width = dim(opts.width, 40);
  const height = dim(opts.height, 8);
  const buffer: number[] = [];

  const chart: StreamChart = {
    push(value) {
      if (finite(value)) {
        buffer.push(value);
        while (buffer.length > width) buffer.shift();
      }
      return chart;
    },
    pushAll(values) {
      for (const v of values) chart.push(v);
      return chart;
    },
    render() {
      if (buffer.length === 0) return Array.from({ length: height }, () => '').join('\n');
      if (opts.style === 'bars') {
        return barChart(buffer, {
          height,
          min: opts.min,
          max: opts.max,
          gap: 0,
          colorFn: opts.colorFn,
        });
      }
      return areaChart(buffer, {
        width: buffer.length,
        height,
        min: opts.min,
        max: opts.max,
        colorFn: opts.colorFn,
      });
    },
    values() {
      return [...buffer];
    },
    clear() {
      buffer.length = 0;
      return chart;
    },
    get length() {
      return buffer.length;
    },
  };
  return chart;
};

// ─────────────────────────────────────────────
//  Plot composer
// ─────────────────────────────────────────────

/** One panel in a {@link composePlots} layout. @since 1.10.0 */
export interface PlotPanel {
  /** Any rendered chart — or any multi-line string. */
  content: string;
  /** Printed above the panel. */
  title?: string;
}

/** Options for {@link composePlots}. @since 1.10.0 */
export interface ComposePlotsOptions {
  /** Panels per row. Default: all of them on one row. */
  columns?: number;
  /** Blank columns between panels. Default `2`. */
  gap?: number;
  /** Pad every panel to the widest one, so columns line up. Default `true`. */
  align?: boolean;
  /** Blank rows between panel rows. Default `1`. */
  rowGap?: number;
}

/**
 * Compose several rendered charts into a dashboard grid.
 *
 * Panels are padded to a common width so columns align, and ANSI escapes are
 * discounted when measuring, so coloured charts line up with plain ones.
 *
 * @example
 * ```js
 * import { composePlots, barChart, areaChart, boxPlot, sparkline } from 'ansimax';
 *
 * console.log(composePlots([
 *   { title: 'requests', content: barChart([3, 7, 4, 9], { height: 6 }) },
 *   { title: 'latency',  content: areaChart([1, 4, 2, 8, 5], { width: 16, height: 6 }) },
 *   { title: 'spread',   content: boxPlot([12, 15, 14, 22, 48], { width: 16 }) },
 *   { title: 'trend',    content: sparkline([1, 3, 2, 5, 4]) },
 * ], { columns: 2 }));
 * ```
 *
 * @since 1.10.0
 */
export const composePlots = (
  panels: readonly PlotPanel[],
  opts: ComposePlotsOptions = {},
): string => {
  const list = panels.filter((p) => p && typeof p.content === 'string');
  if (list.length === 0) return '';
  const columns = dim(opts.columns, list.length);
  const gap = finite(opts.gap) ? Math.max(0, Math.trunc(opts.gap)) : 2;
  const rowGap = finite(opts.rowGap) ? Math.max(0, Math.trunc(opts.rowGap)) : 1;
  const align = opts.align !== false;

  // Each panel becomes a block of lines: title on top, then its content.
  const blocks = list.map((p) => {
    const lines = p.content.split('\n');
    return p.title === undefined ? lines : [p.title, ...lines];
  });

  const out: string[] = [];
  for (let start = 0; start < blocks.length; start += columns) {
    const row = blocks.slice(start, start + columns);
    const tallest = Math.max(...row.map((b) => b.length));
    const widths = row.map((b) => Math.max(0, ...b.map(plainWidth)));
    const target = align ? Math.max(...widths) : 0;

    for (let line = 0; line < tallest; line++) {
      const parts = row.map((block, i) => {
        const text = block[line] ?? '';
        const pad = (align ? target : (widths[i] as number)) - plainWidth(text);
        return text + ' '.repeat(Math.max(0, pad));
      });
      out.push(parts.join(' '.repeat(gap)).replace(/\s+$/, ''));
    }
    if (start + columns < blocks.length) for (let g = 0; g < rowGap; g++) out.push('');
  }
  return out.join('\n');
};
