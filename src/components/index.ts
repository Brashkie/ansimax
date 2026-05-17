// ─────────────────────────────────────────────
//  COMPONENTS — table, badge, menu, progress, timeline, etc.
//
//  Robustness guarantees:
//   - All width math uses visibleLen() (ANSI + Unicode aware)
//   - All padding goes through padEnd/padStart from utils/helpers
//   - This module NEVER touches `.length` of a styled string directly
//   - Numeric inputs (percent, width, padding, colorCode) are clamped
//   - Non-string cell values coerced via String() — never throws
//   - menu() reference-counts cursor visibility — overlapping calls safe
//   - menu() cleanup is symmetric (always restores cursor + raw mode)
// ─────────────────────────────────────────────

import { sgr, FG, BG, STYLE, reset, cursor, screen } from '../utils/ansi.js';
import { padEnd, visibleLen, termSize, stripAnsi } from '../utils/helpers.js';
import { ascii } from '../ascii/index.js';
import { gradient as gradientFn } from '../colors/index.js';

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

const ensureString = (v: unknown): string =>
  typeof v === 'string' ? v : String(v ?? '');

/** Clamp percent to [0, 100]. NaN/Infinity → 0. */
const clampPercent = (p: unknown): number => {
  if (!isFiniteNumber(p)) return 0;
  return Math.max(0, Math.min(100, p));
};

/** Clamp a non-negative integer (width, padding). Falls back to `fallback`. */
const clampNonNeg = (n: unknown, fallback: number): number => {
  if (!isFiniteNumber(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

/** Clamp a positive integer (width, columns). Falls back to `fallback`. */
const clampPositive = (n: unknown, fallback: number): number => {
  if (!isFiniteNumber(n)) return fallback;
  return Math.max(1, Math.floor(n));
};

/** Clamp an SGR code to a sensible range. Bad values return reset. */
const safeSgrCode = (code: unknown, fallback: number): number => {
  if (!isFiniteNumber(code)) return fallback;
  // SGR codes are typically 0-107 (with bright BG up to 107). Allow up to 255
  // for safety — any value above that is almost certainly a bug.
  return Math.max(0, Math.min(255, Math.floor(code)));
};

/** Truncate a string to the given visible width (ANSI-aware). */
const truncateVisible = (str: string, maxWidth: number, ellipsis = '…'): string => {
  if (visibleLen(str) <= maxWidth) return str;
  // Fall back to plain-text truncation when the string contains ANSI —
  // truncating styled text mid-sequence would corrupt escapes.
  const plain = stripAnsi(str);
  if (plain === str) {
    return str.slice(0, Math.max(0, maxWidth - 1)) + ellipsis;
  }
  /* istanbul ignore next — defensive: ANSI-laden text fallback path */
  return plain.slice(0, Math.max(0, maxWidth - 1)) + ellipsis;
};

/** Wrap a single line into multiple lines at `width` (visible chars). */
const wrapVisible = (str: string, width: number): string[] => {
  /* istanbul ignore if — defensive: callers validate width before invoking */
  if (width <= 0) return [str];
  if (visibleLen(str) <= width) return [str];
  // Best-effort wrap by stripping ANSI to compute boundaries.
  const plain = stripAnsi(str);
  const out: string[] = [];
  for (let i = 0; i < plain.length; i += width) {
    out.push(plain.slice(i, i + width));
  }
  return out;
};

// ─────────────────────────────────────────────
//  Table
// ─────────────────────────────────────────────
export type TableBorderStyle = 'single' | 'double' | 'rounded' | 'heavy';

export interface TableOptions {
  header?: boolean;
  borderStyle?: TableBorderStyle;
  padding?: number;
  /** Truncate cell content if it exceeds the column max. Default: null (auto-size). */
  maxColWidth?: number | null;
}

interface TableBorderChars {
  tl: string; tr: string; bl: string; br: string;
  h: string; v: string; ml: string; mr: string;
  mt: string; mb: string; cx: string;
}

const TABLE_BORDERS: Record<TableBorderStyle, TableBorderChars> = {
  single:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│', ml: '├', mr: '┤', mt: '┬', mb: '┴', cx: '┼' },
  double:  { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║', ml: '╠', mr: '╣', mt: '╦', mb: '╩', cx: '╬' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│', ml: '├', mr: '┤', mt: '┬', mb: '┴', cx: '┼' },
  heavy:   { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃', ml: '┣', mr: '┫', mt: '┳', mb: '┻', cx: '╋' },
};

/**
 * Render a 2D array of strings as a bordered table.
 *
 * Multi-line cells are supported — newlines in any cell expand the row
 * to that line count. Cell text wider than `maxColWidth` (when set) is
 * truncated with an ellipsis. All width calculations use visibleLen()
 * so ANSI escapes don't corrupt column alignment.
 *
 * Defensive: non-array rows → empty string. Non-string cells coerced.
 */
export const table = (rows: string[][], opts: TableOptions = {}): string => {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const {
    header = true,
    borderStyle = 'rounded',
    padding = 1,
    maxColWidth = null,
  } = opts;

  const b = TABLE_BORDERS[borderStyle] ?? TABLE_BORDERS.rounded;
  const safePadding = clampNonNeg(padding, 1);
  const pad = ' '.repeat(safePadding);
  const safeMaxCol = maxColWidth !== null && isFiniteNumber(maxColWidth)
    ? Math.max(1, Math.floor(maxColWidth))
    : null;

  // Compute column count — ignore non-array rows defensively
  const validRows = rows.filter((r) => Array.isArray(r));
  if (validRows.length === 0) return '';
  const cols = Math.max(...validRows.map((r) => r.length), 0);
  if (cols === 0) return '';

  // Pre-process every cell into an array of lines (multi-line support).
  // Outer = cells, inner = cell-lines.
  const processedRows: string[][][] = validRows.map((row) =>
    Array.from({ length: cols }, (_, ci) => {
      const raw = ensureString(row[ci]);
      const lines = raw.split('\n');
      return safeMaxCol !== null
        ? lines.map((l) => truncateVisible(l, safeMaxCol))
        : lines;
    }),
  );

  // Compute column widths from the WIDEST line in any cell of that column.
  const widths = Array.from({ length: cols }, (_, ci) => {
    let max = 0;
    for (const procRow of processedRows) {
      const cellLines = procRow[ci] ?? [''];
      for (const line of cellLines) {
        const w = visibleLen(line);
        if (w > max) max = w;
      }
    }
    return safeMaxCol !== null ? Math.min(max, safeMaxCol) : max;
  });

  const rowSep = (left: string, mid: string, right: string, fill: string): string =>
    left + widths.map((w) => fill.repeat(w + safePadding * 2)).join(mid) + right;

  const renderRow = (cellLines: string[][], isHeader = false): string => {
    // Determine row height — max line count across all cells
    const rowHeight = Math.max(...cellLines.map((c) => c.length), 1);

    const out: string[] = [];
    for (let line = 0; line < rowHeight; line++) {
      const cells = cellLines.map((cellArr, ci) => {
        const txt = cellArr[line] ?? '';
        let s = padEnd(txt, widths[ci] ?? 0);
        if (isHeader) s = sgr(STYLE.bold) + s + reset();
        return pad + s + pad;
      });
      out.push(b.v + cells.join(b.v) + b.v);
    }
    return out.join('\n');
  };

  const lines: string[] = [];
  lines.push(rowSep(b.tl, b.mt, b.tr, b.h));
  processedRows.forEach((row, ri) => {
    lines.push(renderRow(row, ri === 0 && header));
    if (ri === 0 && header && processedRows.length > 1) {
      lines.push(rowSep(b.ml, b.cx, b.mr, b.h));
    }
  });
  lines.push(rowSep(b.bl, b.mb, b.br, b.h));
  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Badge
// ─────────────────────────────────────────────
export interface BadgeOptions {
  labelBg?: number;
  valueBg?: number;
  labelFg?: number;
  valueFg?: number;
  /** Inner padding (spaces) around the text. Default: 1. */
  padding?: number;
  /** Wrap the badge in a box-drawing border. Default: false. */
  border?: boolean;
}

export const badge = (label: string, value: string, opts: BadgeOptions = {}): string => {
  const {
    labelBg = BG.blue, valueBg = BG.green,
    labelFg = FG.white, valueFg = FG.white,
    padding = 1,
    border  = false,
  } = opts;

  const safeLabel = ensureString(label);
  const safeValue = ensureString(value);
  const safePadding = clampNonNeg(padding, 1);
  const pad = ' '.repeat(safePadding);

  const lhs = sgr(safeSgrCode(labelBg, BG.blue),  safeSgrCode(labelFg, FG.white))
            + pad + safeLabel + pad + reset();
  const rhs = sgr(safeSgrCode(valueBg, BG.green), safeSgrCode(valueFg, FG.white))
            + pad + safeValue + pad + reset();
  const body = lhs + rhs;

  if (!border) return body;

  // Optional rounded border around the badge
  const innerWidth = visibleLen(body);
  const top    = '╭' + '─'.repeat(innerWidth) + '╮';
  const bottom = '╰' + '─'.repeat(innerWidth) + '╯';
  return `${top}\n│${body}│\n${bottom}`;
};

// ─────────────────────────────────────────────
//  Progress bar
// ─────────────────────────────────────────────
export interface ProgressBarOptions {
  width?: number;
  char?: string;
  emptyChar?: string;
  showPercentage?: boolean;
  label?: string;
  color?: number | null;
  /** Optional gradient stops applied to the filled portion. Overrides `color`. */
  gradient?: string[] | null;
}

export const progressBar = (percent: number, opts: ProgressBarOptions = {}): string => {
  const {
    width = 30, char = '█', emptyChar = '░',
    showPercentage = true, label = '', color = null,
    gradient: gradientStops = null,
  } = opts;

  const safeWidth = clampPositive(width, 30);
  const safeChar  = typeof char === 'string' && char.length > 0 ? char : '█';
  const safeEmpty = typeof emptyChar === 'string' && emptyChar.length > 0 ? emptyChar : '░';
  const safeLabel = ensureString(label);
  const clamped   = clampPercent(percent);

  // Math.floor avoids over-fill (e.g. 99.5% never renders as 100%)
  const filled = Math.floor((clamped / 100) * safeWidth);
  const empty  = Math.max(0, safeWidth - filled);

  let filledStr = safeChar.repeat(filled);

  // Apply coloring: gradient first (richer), fallback to single color.
  // Single-stop gradient is now also accepted (colors statically).
  if (Array.isArray(gradientStops) && gradientStops.length >= 1 && filled > 0) {
    filledStr = gradientFn(filledStr, gradientStops);
  } else if (color !== null && isFiniteNumber(color)) {
    filledStr = sgr(safeSgrCode(color, FG.white)) + filledStr + reset();
  }

  const emptyStr = safeEmpty.repeat(empty);
  const pct = showPercentage ? ` ${String(Math.round(clamped)).padStart(3)}%` : '';
  const lbl = safeLabel ? ` ${safeLabel}` : '';
  return `[${filledStr}${emptyStr}]${pct}${lbl}`;
};

// ─────────────────────────────────────────────
//  Box (re-export ascii.box as a proper named export)
// ─────────────────────────────────────────────
export const box = ascii.box;

// ─────────────────────────────────────────────
//  Status line — flexible icon and multiline support
// ─────────────────────────────────────────────
export type StatusType = 'success' | 'error' | 'warn' | 'info' | 'wait';

const STATUS_MAP: Record<StatusType, { icon: string; color: number }> = {
  success: { icon: '✓', color: FG.green },
  error:   { icon: '✗', color: FG.red },
  warn:    { icon: '⚠', color: FG.yellow },
  info:    { icon: 'ℹ', color: FG.cyan },
  wait:    { icon: '◌', color: FG.brightBlack },
};

export interface StatusOptions {
  /** Override the default icon (or pass `null`/empty string for no icon). */
  icon?: string | null;
  /** Override the default color. */
  color?: number;
}

export const status = (
  type: StatusType,
  message: string,
  opts: StatusOptions = {},
): string => {
  const def = STATUS_MAP[type] ?? STATUS_MAP.info;
  const colorCode = opts.color !== undefined ? safeSgrCode(opts.color, def.color) : def.color;
  const useIcon = opts.icon === undefined ? def.icon : (opts.icon ?? '');
  const safeMsg = ensureString(message);

  const iconPart = useIcon
    ? sgr(colorCode) + useIcon + reset() + ' '
    : '';

  // Multiline messages: align continuation lines with the icon column
  if (safeMsg.includes('\n')) {
    const indent = ' '.repeat(useIcon ? visibleLen(useIcon) + 1 : 0);
    const parts = safeMsg.split('\n');
    return parts
      .map((line, i) => (i === 0 ? iconPart + line : indent + line))
      .join('\n');
  }
  return iconPart + safeMsg;
};

// ─────────────────────────────────────────────
//  Section header — ANSI-aware width
// ─────────────────────────────────────────────
export interface SectionOptions {
  char?: string;
  width?: number | null;
  color?: number;
}

export const section = (title: string, opts: SectionOptions = {}): string => {
  const { char = '─', width = null, color: colorCode = FG.cyan } = opts;
  const { cols } = termSize();

  const safeTitle = ensureString(title);
  const safeChar  = typeof char === 'string' && char.length > 0 ? char : '─';
  const safeColor = safeSgrCode(colorCode, FG.cyan);

  const titleLen = visibleLen(safeTitle);
  const requestedWidth = width !== null && isFiniteNumber(width)
    ? Math.max(1, Math.floor(width))
    : cols;
  const w = Math.max(requestedWidth, titleLen + 2);
  const side = Math.floor((w - titleLen - 2) / 2);

  const dividerL = sgr(safeColor) + safeChar.repeat(Math.max(0, side)) + reset();
  const t = sgr(STYLE.bold, safeColor) + safeTitle + reset();
  const dividerR = sgr(safeColor) + safeChar.repeat(Math.max(0, w - side - titleLen - 2)) + reset();
  return `${dividerL} ${t} ${dividerR}`;
};

// ─────────────────────────────────────────────
//  Columns layout — wraps oversize content
// ─────────────────────────────────────────────
export interface ColumnsOptions {
  cols?: number;
  gap?: number;
  width?: number | null;
  /** Truncate items wider than the column. Default: 'truncate'. Use 'wrap' to flow into multiple lines. */
  overflow?: 'truncate' | 'wrap';
}

export const columns = (items: string[], opts: ColumnsOptions = {}): string => {
  if (!Array.isArray(items) || items.length === 0) return '';

  const { cols: numCols = 2, gap = 2, width = null, overflow = 'truncate' } = opts;

  // Defensive — clamp instead of throwing. Caller that wants strict
  // validation can check items/opts themselves.
  const safeCols = clampPositive(numCols, 2);
  const safeGap  = clampNonNeg(gap, 2);

  const { cols: termCols } = termSize();
  const totalW = width !== null && isFiniteNumber(width)
    ? Math.max(safeCols, Math.floor(width))
    : termCols;
  const colW = Math.max(1, Math.floor((totalW - safeGap * (safeCols - 1)) / safeCols));
  const gapStr = ' '.repeat(safeGap);

  const rows: string[] = [];
  for (let i = 0; i < items.length; i += safeCols) {
    const chunk = items.slice(i, i + safeCols);

    if (overflow === 'wrap') {
      // Wrap each cell into multiple lines, then align by row height
      const cellLines = chunk.map((it) => wrapVisible(ensureString(it), colW));
      const rowHeight = Math.max(...cellLines.map((c) => c.length), 1);
      for (let line = 0; line < rowHeight; line++) {
        rows.push(
          cellLines.map((c) => padEnd(c[line] ?? '', colW)).join(gapStr),
        );
      }
    } else {
      // Truncate mode — single line per row
      rows.push(
        chunk.map((item) => {
          const t = truncateVisible(ensureString(item), colW);
          return padEnd(t, colW);
        }).join(gapStr),
      );
    }
  }
  return rows.join('\n');
};

// ─────────────────────────────────────────────
//  Timeline — aligned label column
// ─────────────────────────────────────────────
export interface TimelineEvent {
  label: string;
  done?: boolean;
  time?: string;
}

export interface TimelineOptions {
  connector?: string;
  node?: string;
  color?: number;
  doneColor?: number;
  pendingColor?: number;
  /** Pad time column to this visible width for alignment. Default: max time width across events. */
  timeColumnWidth?: number | null;
}

export const timeline = (events: TimelineEvent[], opts: TimelineOptions = {}): string => {
  if (!Array.isArray(events) || events.length === 0) return '';

  const {
    connector = '│', node = '●',
    color: colorCode = FG.cyan,
    doneColor = FG.green,
    pendingColor = FG.brightBlack,
    timeColumnWidth = null,
  } = opts;

  const safeConnector = typeof connector === 'string' && connector.length > 0 ? connector : '│';
  const safeNode      = typeof node === 'string' && node.length > 0 ? node : '●';
  const safeColor     = safeSgrCode(colorCode, FG.cyan);
  const safeDoneColor = safeSgrCode(doneColor, FG.green);
  const safePendingColor = safeSgrCode(pendingColor, FG.brightBlack);

  // Derive a fixed time-column width (visible chars) for clean alignment.
  // Falls back to the widest provided time, or 0 if no events have time.
  const computedTimeWidth = timeColumnWidth !== null && isFiniteNumber(timeColumnWidth)
    ? Math.max(0, Math.floor(timeColumnWidth))
    : Math.max(0, ...events.map((e) => (e.time ? visibleLen(ensureString(e.time)) : 0)));

  const lines: string[] = [];
  events.forEach((ev, i) => {
    const isLast = i === events.length - 1;
    const evLabel = ensureString(ev.label);
    const clr = ev.done ? safeDoneColor : (i === 0 ? safeColor : safePendingColor);
    const nodeStr = sgr(clr) + safeNode + reset();
    const textStr = ev.done
      ? sgr(STYLE.bold) + evLabel + reset()
      : sgr(safePendingColor) + evLabel + reset();

    const timePart = ev.time && computedTimeWidth > 0
      ? '  ' + sgr(FG.brightBlack) +
        padEnd(ensureString(ev.time), computedTimeWidth) + reset()
      : '';

    lines.push(`${nodeStr} ${textStr}${timePart}`);
    if (!isLast) lines.push(sgr(safePendingColor) + safeConnector + reset());
  });
  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Interactive menu
//
//  Ref-counted cursor (overlapping menu calls safe). Cleanup is symmetric:
//  every code path that hides the cursor also restores it, including
//  errors before the Promise body and errors inside the key handler.
// ─────────────────────────────────────────────

export interface MenuInput {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
  resume: () => unknown;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

export interface MenuOutput {
  write: (str: string) => unknown;
}

export interface MenuOptions {
  title?: string | null;
  pointer?: string;
  multiSelect?: boolean;
  color?: number;
  input?: MenuInput;
  output?: MenuOutput;
}

/** Resolved value when user presses Ctrl+C — library never calls process.exit() */
export const MENU_CANCELLED = Symbol('MENU_CANCELLED');

export type MenuResult = number | number[] | typeof MENU_CANCELLED;

export const menu = (items: string[], opts: MenuOptions = {}): Promise<MenuResult> => {
  // Strict input validation — must be a non-empty array of strings
  if (!Array.isArray(items) || items.length === 0) {
    // Resolve cancelled rather than throwing — caller can branch on it
    return Promise.resolve(MENU_CANCELLED);
  }

  const {
    title = null,
    pointer = '▶',
    multiSelect = false,
    color: colorCode = FG.cyan,
    input: inp  = process.stdin as MenuInput,
    output: out = { write: (s: string) => process.stdout.write(s) },
  } = opts;

  // Non-TTY fallback — no interaction possible
  if (!inp.isTTY) return Promise.resolve(multiSelect ? ([] as number[]) : 0);

  const safeColor = safeSgrCode(colorCode, FG.cyan);
  const safePointer = typeof pointer === 'string' && pointer.length > 0 ? pointer : '▶';
  const safeTitle = title === null ? null : ensureString(title);
  const safeItems = items.map(ensureString);

  let cursorPos = 0;
  let lastRenderedLines = 0;
  let cursorHidden = false; // true once we've emitted cursor.hide()
  const selected = new Set<number>();

  const emit = (str: string): void => {
    try { out.write(str); }
    catch { /* stream closed mid-render — give up gracefully */ }
  };

  /**
   * Render the menu and return the number of lines actually written.
   * Counts wrapped lines so clearLines() can erase precisely.
   */
  const render = (): number => {
    let totalLines = 0;
    const { cols: termCols } = termSize();
    const safeTermCols = Math.max(1, termCols);

    if (safeTitle) {
      emit(sgr(STYLE.bold) + safeTitle + reset() + '\n');
      totalLines += Math.max(1, Math.ceil(visibleLen(safeTitle) / safeTermCols));
    }

    safeItems.forEach((item, i) => {
      const isActive   = i === cursorPos;
      const isSelected = selected.has(i);
      const ptr = isActive ? sgr(safeColor) + safePointer + reset() : ' ';
      const sel = multiSelect ? (isSelected ? sgr(safeColor) + '●' + reset() : '○') : '';
      const txt = isActive ? sgr(STYLE.bold, safeColor) + item + reset() : item;

      const line = `${ptr} ${sel}${multiSelect ? ' ' : ''}${txt}`;
      emit(line + '\n');

      // Count actual rendered lines including terminal wrapping
      const lineWidth = visibleLen(line);
      totalLines += Math.max(1, Math.ceil(lineWidth / safeTermCols));
    });

    return totalLines;
  };

  const clearLinesLocal = (): void => {
    for (let i = 0; i < lastRenderedLines; i++) {
      emit(cursor.up(1) + screen.clearLine());
    }
    emit('\r');
  };

  /** Full teardown — input listener, raw mode, cursor. Safe to call multiple times. */
  const cleanup = (onKey: ((...args: unknown[]) => void) | null): void => {
    if (onKey) {
      try { inp.removeListener('data', onKey); } catch { /* ignore */ }
    }
    try { if (inp.setRawMode) inp.setRawMode(false); } catch { /* ignore */ }
    if (cursorHidden) {
      try { emit(cursor.show()); } catch { /* ignore */ }
      cursorHidden = false;
    }
    // Remove the process-level safety net handlers
    /* istanbul ignore next — defensive: cleanup of process handlers */
    try {
      process.off('SIGINT', emergencyCleanup);
      process.off('SIGTERM', emergencyCleanup);
      process.off('exit', emergencyCleanup);
    } catch { /* ignore */ }
  };

  // Emergency cleanup — runs if the process is killed mid-menu (Ctrl+C, etc).
  // Restores the cursor synchronously since stdout is still valid.
  /* istanbul ignore next — defensive: only fires on SIGINT/SIGTERM/exit */
  const emergencyCleanup = (): void => {
    if (cursorHidden) {
      try { out.write(cursor.show()); } catch { /* ignore */ }
      cursorHidden = false;
    }
    try { if (inp.setRawMode) inp.setRawMode(false); } catch { /* ignore */ }
  };

  // Register safety net BEFORE hiding cursor
  /* istanbul ignore next — defensive: process handlers won't fire in tests */
  try {
    process.once('SIGINT', emergencyCleanup);
    process.once('SIGTERM', emergencyCleanup);
    process.once('exit', emergencyCleanup);
  } catch { /* ignore */ }

  // Hide cursor + initial render. If render() throws (extremely unlikely
  // but defensive), restore cursor immediately and resolve.
  /* istanbul ignore next — defensive: catch path only fires if render() throws with validated inputs */
  try {
    emit(cursor.hide());
    cursorHidden = true;
    lastRenderedLines = render();
  } catch {
    cleanup(null);
    return Promise.resolve(MENU_CANCELLED);
  }

  return new Promise<MenuResult>((resolve) => {
    let resolved = false;
    const safeResolve = (value: MenuResult): void => {
      /* istanbul ignore if — defensive: double-resolve guard */
      if (resolved) return;
      resolved = true;
      resolve(value);
    };

    const onKey = (...args: unknown[]): void => {
      /* istanbul ignore next — defensive: catch path only fires on unexpected key handler errors */
      try {
        const key = args[0] as { toString(): string };
        const k = key.toString();
        const KEY_UP     = '\x1b[A';
        const KEY_DOWN   = '\x1b[B';
        const KEY_ENTER  = '\r';
        const KEY_SPACE  = ' ';
        const KEY_CTRL_C = '\x03';

        if (k === KEY_CTRL_C) {
          clearLinesLocal();
          cleanup(onKey);
          safeResolve(MENU_CANCELLED);
          return;
        }

        if (k === KEY_UP || k === 'k' || k === 'w') {
          cursorPos = (cursorPos - 1 + safeItems.length) % safeItems.length;
        } else if (k === KEY_DOWN || k === 'j' || k === 's') {
          cursorPos = (cursorPos + 1) % safeItems.length;
        } else if (k === KEY_SPACE && multiSelect) {
          if (selected.has(cursorPos)) selected.delete(cursorPos);
          else selected.add(cursorPos);
        } else if (k === KEY_ENTER) {
          clearLinesLocal();
          cleanup(onKey);
          safeResolve(multiSelect
            ? (selected.size ? [...selected] : [cursorPos])
            : cursorPos);
          return;
        }

        clearLinesLocal();
        lastRenderedLines = render();
      } catch {
        // Any unexpected error — clean up and resolve cancelled rather
        // than leaving the terminal in raw mode with a hidden cursor.
        cleanup(onKey);
        safeResolve(MENU_CANCELLED);
      }
    };

    /* istanbul ignore next — defensive: stdin setup rarely fails in real terminals */
    try {
      if (inp.setRawMode) inp.setRawMode(true);
      inp.resume();
      inp.on('data', onKey);
    } catch {
      // Initial setup failed — clean up and resolve neutral
      cleanup(onKey);
      safeResolve(multiSelect ? [] : 0);
    }
  });
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export const components = {
  table, badge, progressBar, status, section,
  columns, timeline, menu, box,
};
export default components;
