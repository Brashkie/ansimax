// ─────────────────────────────────────────────
//  ansimax/charts — Phase 10 (inline mini-charts)
//
//  v1.6.6 — the first slice of the charting phase: compact, single-line
//  visuals built from Unicode block characters. No stdout ownership; every
//  function returns a string you place wherever you like (status bars,
//  table cells, log lines).
//    - sparkline()  a series → one line of ▁▂▃▄▅▆▇█
//    - bar()        a 0..1 value → a horizontal filled bar
//    - histogram()  a series → stacked horizontal bars with labels
// ─────────────────────────────────────────────

// Eight levels of vertical block, from 1/8 to 8/8. Index 0 is the lowest
// visible bar; a dedicated space is used for "no data" so gaps read clearly.
const SPARK_TICKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const;

export interface SparklineOptions {
  /**
   * Lower bound of the value range. Values are normalized against
   * `[min, max]`. Defaults to the series minimum.
   */
  min?: number;
  /**
   * Upper bound of the value range. Defaults to the series maximum.
   */
  max?: number;
  /**
   * Optional per-tick colorizer: receives the tick character and the
   * normalized value in `[0,1]`, returns a styled string. Keeps the module
   * dependency-free — pass `color`/`gradient` from ansimax if you want color.
   */
  colorFn?: (tick: string, t: number) => string;
}

/**
 * Render a numeric series as a one-line sparkline of block characters.
 * Non-finite entries render as a space (a visible gap). An empty series
 * returns `''`; a flat series renders at the lowest tick.
 *
 * @example
 * ```js
 * import { sparkline } from 'ansimax';
 *
 * sparkline([1, 5, 2, 8, 3, 7, 9, 4]);   // '▁▄▂▇▂▆█▃'
 * sparkline(cpuHistory, { min: 0, max: 100 });
 * ```
 *
 * @since 1.6.6
 */
export const sparkline = (values: number[], opts: SparklineOptions = {}): string => {
  if (!Array.isArray(values) || values.length === 0) return '';

  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return ' '.repeat(values.length);

  const lo = opts.min ?? Math.min(...finite);
  const hi = opts.max ?? Math.max(...finite);
  const span = hi - lo;

  const out: string[] = [];
  for (const v of values) {
    if (!Number.isFinite(v)) { out.push(' '); continue; }
    // Normalize to [0,1]; a zero span (flat series) maps everything to 0.
    const t = span <= 0 ? 0 : Math.max(0, Math.min(1, (v - lo) / span));
    const idx = Math.round(t * (SPARK_TICKS.length - 1));
    const tick = SPARK_TICKS[idx] as string;
    out.push(opts.colorFn ? opts.colorFn(tick, t) : tick);
  }
  return out.join('');
};

// Horizontal bar uses eighth-cell partial blocks for sub-character precision.
const BAR_PARTIALS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const;
const BAR_FULL = '█';

export interface BarOptions {
  /** Total width of the bar in characters. Default `20`. */
  width?: number;
  /** Character (or string) for the empty remainder. Default `' '`. */
  emptyChar?: string;
  /**
   * Colorize the filled portion: receives the composed fill string and the
   * fraction in `[0,1]`. Returns a styled string.
   */
  colorFn?: (fill: string, fraction: number) => string;
}

/**
 * Render a `0..1` fraction as a horizontal bar with eighth-cell precision.
 * Values are clamped to `[0,1]`; non-finite input renders as empty.
 *
 * @example
 * ```js
 * import { bar } from 'ansimax';
 *
 * bar(0.5);                    // '██████████          '
 * bar(0.66, { width: 12 });    // partial-block precision at the tip
 * ```
 *
 * @since 1.6.6
 */
export const bar = (fraction: number, opts: BarOptions = {}): string => {
  const width = Math.max(1, Math.floor(opts.width ?? 20));
  const emptyChar = opts.emptyChar ?? ' ';
  const f = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0;

  // Total eighths of a cell to fill across the whole bar.
  const totalEighths = Math.round(f * width * 8);
  const fullCells = Math.floor(totalEighths / 8);
  const remainder = totalEighths % 8;

  let fill = BAR_FULL.repeat(Math.min(fullCells, width));
  if (fullCells < width && remainder > 0) {
    fill += BAR_PARTIALS[remainder];
  }
  const styledFill = opts.colorFn ? opts.colorFn(fill, f) : fill;

  // Pad the remainder to the full width (measured on the unstyled fill).
  const usedCells = fullCells + (fullCells < width && remainder > 0 ? 1 : 0);
  const pad = emptyChar.repeat(Math.max(0, width - usedCells));
  return styledFill + pad;
};

export interface HistogramRow {
  /** Row label, shown left-aligned before the bar. */
  label: string;
  /** Row value; bars are scaled to the max value across all rows. */
  value: number;
}

export interface HistogramOptions {
  /** Bar area width in characters. Default `30`. */
  width?: number;
  /** Show the numeric value after each bar. Default `true`. */
  showValue?: boolean;
  /** Colorize each bar's fill (see `BarOptions.colorFn`). */
  colorFn?: (fill: string, fraction: number) => string;
}

/**
 * Render labelled rows as a horizontal histogram — one `bar()` per row,
 * all scaled to the largest value, with aligned labels and optional value
 * readouts. Returns a multi-line string.
 *
 * @example
 * ```js
 * import { histogram } from 'ansimax';
 *
 * histogram([
 *   { label: 'GET',  value: 1240 },
 *   { label: 'POST', value: 430 },
 *   { label: 'PUT',  value: 90 },
 * ]);
 * ```
 *
 * @since 1.6.6
 */
export const histogram = (rows: HistogramRow[], opts: HistogramOptions = {}): string => {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const width = Math.max(1, Math.floor(opts.width ?? 30));
  const showValue = opts.showValue !== false;

  const values = rows.map((r) => (Number.isFinite(r.value) ? r.value : 0));
  const max = Math.max(0, ...values);
  const labelWidth = Math.max(...rows.map((r) => r.label.length));

  const lines = rows.map((row, i) => {
    const v = values[i] as number;
    const fraction = max <= 0 ? 0 : v / max;
    const label = row.label.padEnd(labelWidth);
    const barStr = bar(fraction, { width, colorFn: opts.colorFn });
    const valueStr = showValue ? ` ${v}` : '';
    return `${label} │${barStr}│${valueStr}`;
  });
  return lines.join('\n');
};


// ─────────────────────────────────────────────
//  Braille line chart (Phase 10, v1.7.1)
//
//  Plots a continuous series (or several) on a Braille canvas. Each terminal
//  cell is a 2×4 grid of sub-pixels (U+2800), so a `width×height` chart draws
//  at (width*2)×(height*4) resolution — 8× denser than one-char-per-sample.
//
//  The sub-pixel → Braille-bit map is the piece naive implementations get
//  wrong: the BOTTOM row is dots 7/8 (bits 6/7), not a linear 0..7. Dot
//  layout inside a cell:  1 4 / 2 5 / 3 6 / 7 8  (bit = dot-1).
//
//  Points are joined with a Bresenham segment so any data density yields a
//  connected line. Pure string builder — no stdout, no deps.
// ─────────────────────────────────────────────

const BRAILLE_BASE = 0x2800;

/** Braille bit index for sub-pixel (dx∈{0,1}, dy∈{0,1,2,3}). Bottom row = 6/7. */
const brailleBit = (dx: number, dy: number): number => {
  if (dx === 0) return dy < 3 ? dy : 6;
  return dy < 3 ? dy + 3 : 7;
};

/** A named/colored data series for {@link lineChart}. @since 1.7.1 */
export interface LineChartSeries {
  /** The y-values, sampled left→right across the chart width. */
  data: number[];
}

export interface LineChartOptions {
  /** Chart width in characters. Default `40` (→ 80 sub-columns). */
  width?: number;
  /** Chart height in characters. Default `8` (→ 32 sub-rows). */
  height?: number;
  /** Lower y-bound. Defaults to the data minimum. */
  min?: number;
  /** Upper y-bound. Defaults to the data maximum. */
  max?: number;
  /**
   * Per-cell colorizer: receives the composed Braille glyph and the cell's
   * coverage (lit sub-pixels / 8, in `[0,1]`). Returns a styled string. This
   * is the honest Braille analogue of Wu anti-aliasing — you can't half-light
   * a dot, so intensity is projected onto the cell's color instead.
   */
  colorFn?: (cell: string, coverage: number) => string;
}

const _bresenham = (
  x0: number, y0: number, x1: number, y1: number,
  plot: (x: number, y: number) => void,
): void => {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0;
  let cy = y0;
  for (;;) {
    plot(cx, cy);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
};

/**
 * Render a numeric series (or several) as a Braille line chart — a multi-line
 * string where each cell packs a 2×4 sub-pixel block, giving smooth,
 * connected lines at 8× the resolution of a sparkline.
 *
 * Pass a plain `number[]` for one line, or `LineChartSeries[]` for several
 * overlaid on the same axes. Non-finite points break the line (a gap). A flat
 * series is drawn along the vertical center. Returns `''` for no finite data.
 *
 * @example
 * ```js
 * import { lineChart } from 'ansimax';
 *
 * const wave = Array.from({ length: 60 }, (_, i) => Math.sin(i / 6));
 * console.log(lineChart(wave, { width: 40, height: 8 }));
 * ```
 *
 * @since 1.7.1
 */
export const lineChart = (
  input: number[] | LineChartSeries[],
  opts: LineChartOptions = {},
): string => {
  if (!Array.isArray(input) || input.length === 0) return '';
  // Normalize to a series list.
  const seriesList: LineChartSeries[] =
    typeof (input as number[])[0] === 'number'
      ? [{ data: input as number[] }]
      : (input as LineChartSeries[]);

  const cols = Math.max(1, Math.floor(opts.width ?? 40));
  const rows = Math.max(1, Math.floor(opts.height ?? 8));
  const W = cols * 2;
  const H = rows * 4;

  // Collect finite values to derive bounds.
  const finite: number[] = [];
  for (const s of seriesList) {
    if (!Array.isArray(s.data)) continue;
    for (const v of s.data) if (Number.isFinite(v)) finite.push(v);
  }
  if (finite.length === 0) return '';

  const lo = Number.isFinite(opts.min as number) ? (opts.min as number) : Math.min(...finite);
  const hi = Number.isFinite(opts.max as number) ? (opts.max as number) : Math.max(...finite);
  const span = hi - lo;

  // Sub-pixel grid (row-major booleans as 0/1).
  const grid = new Uint8Array(W * H);
  const plot = (x: number, y: number): void => {
    if (x >= 0 && x < W && y >= 0 && y < H) grid[y * W + x] = 1;
  };
  const toY = (v: number): number => {
    // Invert so larger values sit higher; flat series maps to the center.
    const t = span <= 0 ? 0.5 : Math.max(0, Math.min(1, (v - lo) / span));
    return Math.round((1 - t) * (H - 1));
  };

  for (const s of seriesList) {
    const data = Array.isArray(s.data) ? s.data : [];
    const n = data.length;
    let prev: { x: number; y: number } | null = null;
    for (let i = 0; i < n; i++) {
      const v = data[i] as number;
      if (!Number.isFinite(v)) { prev = null; continue; }
      const x = n === 1 ? 0 : Math.round((i / (n - 1)) * (W - 1));
      const y = toY(v);
      if (prev) _bresenham(prev.x, prev.y, x, y, plot);
      else plot(x, y);
      prev = { x, y };
    }
  }

  // Pack the sub-pixel grid into Braille cells.
  const out: string[] = [];
  for (let cy = 0; cy < rows; cy++) {
    let line = '';
    for (let cx = 0; cx < cols; cx++) {
      let bits = 0;
      let count = 0;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (grid[(cy * 4 + dy) * W + (cx * 2 + dx)]) {
            bits |= 1 << brailleBit(dx, dy);
            count++;
          }
        }
      }
      const ch = String.fromCodePoint(BRAILLE_BASE + bits);
      line += (opts.colorFn && bits) ? opts.colorFn(ch, count / 8) : ch;
    }
    out.push(line);
  }
  return out.join('\n');
};
