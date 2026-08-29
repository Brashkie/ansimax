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
