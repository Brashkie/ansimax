// ─────────────────────────────────────────────
//  ansimax/loaders/meters — Phase 7 additions
//
//  v1.6.0 — three progress-ecosystem tools:
//    - createETA()        rolling-average time-remaining estimator
//    - createThroughput() bytes/sec or ops/sec with auto-scaling units
//    - createLiveRegion() flicker-free multi-line region (redraw only
//                          the lines that changed)
//
//  All are pure/testable: they compute strings and expose small control
//  surfaces; they do not own timers. The caller drives them.
// ─────────────────────────────────────────────

import { write } from '../utils/ansi.js';

// ─────────────────────────────────────────────
//  Unit formatting
// ─────────────────────────────────────────────

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;
const SI_UNITS = ['', 'K', 'M', 'B', 'T'] as const;

/**
 * Format a byte count with an auto-scaled binary unit (1024-based).
 * `1536` → `"1.5 KB"`, `0` → `"0 B"`.
 *
 * @since 1.6.0
 */
export const formatBytes = (bytes: number, decimals = 1): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), BYTE_UNITS.length - 1);
  const value = bytes / Math.pow(k, i);
  // Whole bytes never show decimals.
  const d = i === 0 ? 0 : decimals;
  return `${value.toFixed(d)} ${BYTE_UNITS[i]}`;
};

/**
 * Format a plain count with an auto-scaled SI-style suffix (1000-based).
 * `1500` → `"1.5K"`, `2_000_000` → `"2.0M"`.
 *
 * @since 1.6.0
 */
export const formatCount = (n: number, decimals = 1): string => {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const k = 1000;
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), SI_UNITS.length - 1);
  if (i === 0) return String(Math.round(n));
  return `${(n / Math.pow(k, i)).toFixed(decimals)}${SI_UNITS[i]}`;
};

/**
 * Format a duration in milliseconds as a compact human string.
 * `1500` → `"1.5s"`, `65000` → `"1m 5s"`, `3_600_000` → `"1h 0m"`.
 *
 * @since 1.6.0
 */
export const formatDuration = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const s = ms / 1000;
  if (s < 1) return `${Math.round(ms)}ms`;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s % 60);
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

// ─────────────────────────────────────────────
//  ETA estimator — rolling average of recent rate
// ─────────────────────────────────────────────

export interface ETAOptions {
  /** Total work units to complete (e.g. total bytes, total items). */
  total: number;
  /**
   * How many recent samples to average over. Larger = smoother but slower
   * to react to speed changes. Default `10`.
   */
  window?: number;
}

export interface ETA {
  /** Record progress: `current` is the absolute completed amount so far. */
  update(current: number): void;
  /** Estimated milliseconds remaining, or `Infinity` if not yet estimable. */
  remainingMs(): number;
  /** Human-readable remaining time (`formatDuration`), or `"—"`. */
  eta(): string;
  /** Current smoothed rate in units/second. */
  rate(): number;
  /** Fraction complete in `[0,1]`. */
  progress(): number;
  /** Reset all samples (e.g. to reuse the estimator). */
  reset(): void;
}

/**
 * A rolling-average ETA estimator. Feed it the absolute completed amount
 * over time; it estimates the remaining time from the average rate across
 * the last `window` samples (robust to short spikes).
 *
 * @example
 * ```js
 * import { createETA } from 'ansimax';
 *
 * const eta = createETA({ total: 1000 });
 * // ...on each tick:
 * eta.update(downloadedSoFar);
 * process.stdout.write(`\rETA: ${eta.eta()} (${(eta.progress() * 100).toFixed(0)}%)`);
 * ```
 *
 * @since 1.6.0
 */
export const createETA = (opts: ETAOptions): ETA => {
  const total = Math.max(0, opts.total);
  const window = Math.max(2, Math.floor(opts.window ?? 10));
  // Ring buffer of { t: ms timestamp, value: absolute completed }.
  let samples: Array<{ t: number; value: number }> = [];
  let current = 0;

  const rate = (): number => {
    if (samples.length < 2) return 0;
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    const dt = (last.t - first.t) / 1000; // seconds
    const dv = last.value - first.value;
    if (dt <= 0 || dv <= 0) return 0;
    return dv / dt;
  };

  return {
    update(value: number): void {
      current = value;
      samples.push({ t: Date.now(), value });
      if (samples.length > window) samples = samples.slice(-window);
    },
    remainingMs(): number {
      const r = rate();
      if (r <= 0) return Infinity;
      const remaining = Math.max(0, total - current);
      return (remaining / r) * 1000;
    },
    eta(): string {
      const ms = this.remainingMs();
      return Number.isFinite(ms) ? formatDuration(ms) : '—';
    },
    rate,
    progress(): number {
      if (total <= 0) return 0;
      return Math.max(0, Math.min(1, current / total));
    },
    reset(): void {
      samples = [];
      current = 0;
    },
  };
};

// ─────────────────────────────────────────────
//  Throughput meter — rate with auto-scaling units
// ─────────────────────────────────────────────

export interface ThroughputOptions {
  /** `'bytes'` → B/s, KB/s… · `'ops'` → plain SI /s. Default `'bytes'`. */
  unit?: 'bytes' | 'ops';
  /** Samples to average over. Default `10`. */
  window?: number;
  /** Label for `'ops'` mode, e.g. `'req'` → `"1.2K req/s"`. Default `'ops'`. */
  opsLabel?: string;
}

export interface Throughput {
  /** Record the absolute cumulative amount processed so far. */
  update(cumulative: number): void;
  /** Current rate in units/second (raw number). */
  rate(): number;
  /** Formatted rate, e.g. `"1.5 MB/s"` or `"2.0K req/s"`. */
  format(): string;
  reset(): void;
}

/**
 * A throughput meter that reports a smoothed rate with auto-scaled units.
 * Feed it the cumulative amount processed; read `format()` for a display
 * string like `"1.5 MB/s"`.
 *
 * @example
 * ```js
 * import { createThroughput } from 'ansimax';
 *
 * const tp = createThroughput({ unit: 'bytes' });
 * // on each chunk:
 * tp.update(totalBytesReceived);
 * process.stdout.write(`\r${tp.format()}`);
 * ```
 *
 * @since 1.6.0
 */
export const createThroughput = (opts: ThroughputOptions = {}): Throughput => {
  const unit = opts.unit ?? 'bytes';
  const opsLabel = opts.opsLabel ?? 'ops';
  const window = Math.max(2, Math.floor(opts.window ?? 10));
  let samples: Array<{ t: number; value: number }> = [];

  const rate = (): number => {
    if (samples.length < 2) return 0;
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    const dt = (last.t - first.t) / 1000;
    const dv = last.value - first.value;
    if (dt <= 0 || dv < 0) return 0;
    return dv / dt;
  };

  return {
    update(cumulative: number): void {
      samples.push({ t: Date.now(), value: cumulative });
      if (samples.length > window) samples = samples.slice(-window);
    },
    rate,
    format(): string {
      const r = rate();
      if (unit === 'bytes') return `${formatBytes(r)}/s`;
      return `${formatCount(r)} ${opsLabel}/s`;
    },
    reset(): void { samples = []; },
  };
};

// ─────────────────────────────────────────────
//  Live region — flicker-free multi-line redraw
// ─────────────────────────────────────────────

export interface LiveRegion {
  /**
   * Set the full list of lines. Only the lines that actually changed since
   * the last render are rewritten, avoiding a full-region flicker.
   */
  render(lines: string[]): void;
  /** Clear the region (erase all rendered lines). */
  clear(): void;
  /** Stop managing the region, leaving the last frame in place. */
  done(): void;
}

export interface LiveRegionOptions {
  /** Sink for output. Default writes to stdout. */
  out?: (s: string) => void;
}

/**
 * A flicker-free live region for multi-line progress output. Instead of
 * clearing and rewriting every line each frame, it diffs against the last
 * frame and only redraws the lines whose text changed — moving the cursor
 * up to each changed line, rewriting it, and returning to the bottom.
 *
 * @example
 * ```js
 * import { createLiveRegion } from 'ansimax';
 *
 * const region = createLiveRegion();
 * region.render(['task A: 10%', 'task B: 0%']);
 * // later — only the changed line is rewritten:
 * region.render(['task A: 100%', 'task B: 0%']);
 * region.done();
 * ```
 *
 * @since 1.6.0
 */
export const createLiveRegion = (opts: LiveRegionOptions = {}): LiveRegion => {
  const out = opts.out ?? ((s: string) => write(s));
  let prev: string[] = [];

  const moveUp = (n: number) => (n > 0 ? `\x1b[${n}A` : '');
  const moveDown = (n: number) => (n > 0 ? `\x1b[${n}B` : '');
  const clearLine = '\x1b[2K';
  const toCol0 = '\r';

  return {
    render(lines: string[]): void {
      const next = lines.slice();

      // First frame (or grew): print everything from the current cursor.
      if (prev.length === 0) {
        out(next.join('\n'));
        prev = next;
        return;
      }

      const maxLen = Math.max(prev.length, next.length);
      // We are positioned just after the last previously-printed line.
      // Cursor is on the line *after* the block (we ended with the last
      // line's text, no trailing newline), so line index `prev.length-1`
      // is where the cursor currently sits.
      const bottom = prev.length - 1;

      let buf = '';
      for (let i = 0; i < maxLen; i++) {
        const oldLine = prev[i];
        const newLine = next[i] ?? '';
        if (oldLine === newLine) continue; // unchanged → skip (no flicker)

        // Move from the bottom line up to line i, rewrite it, move back.
        const up = bottom - i;
        buf += moveUp(up) + toCol0 + clearLine + newLine + moveDown(up) + toCol0;
      }

      // If the new frame has more lines than before, append the extras.
      if (next.length > prev.length) {
        for (let i = prev.length; i < next.length; i++) {
          buf += '\n' + next[i];
        }
      }

      if (buf) out(buf);
      prev = next;
    },
    clear(): void {
      if (prev.length === 0) return;
      const bottom = prev.length - 1;
      let buf = moveUp(bottom) + toCol0;
      for (let i = 0; i < prev.length; i++) {
        buf += clearLine;
        if (i < prev.length - 1) buf += moveDown(1);
      }
      buf += moveUp(prev.length - 1) + toCol0;
      out(buf);
      prev = [];
    },
    done(): void {
      out('\n');
      prev = [];
    },
  };
};
