// ─────────────────────────────────────────────
//  COMPONENTS  –  table, box, badge, menu, etc.
// ─────────────────────────────────────────────

import { sgr, FG, BG, STYLE, reset, cursor, screen, write, writeln } from '../utils/ansi.js';
import { padEnd, visibleLen, termSize } from '../utils/helpers.js';
import { ascii } from '../ascii/index.js';

// ── Table ────────────────────────────────────
export type TableBorderStyle = 'single' | 'double' | 'rounded' | 'heavy';

export interface TableOptions {
  header?: boolean;
  borderStyle?: TableBorderStyle;
  padding?: number;
}

interface TableBorderChars {
  tl: string; tr: string; bl: string; br: string;
  h: string; v: string; ml: string; mr: string;
  mt: string; mb: string; cx: string;
}

const TABLE_BORDERS: Record<TableBorderStyle, TableBorderChars> = {
  single:  { tl:'┌',tr:'┐',bl:'└',br:'┘',h:'─',v:'│',ml:'├',mr:'┤',mt:'┬',mb:'┴',cx:'┼' },
  double:  { tl:'╔',tr:'╗',bl:'╚',br:'╝',h:'═',v:'║',ml:'╠',mr:'╣',mt:'╦',mb:'╩',cx:'╬' },
  rounded: { tl:'╭',tr:'╮',bl:'╰',br:'╯',h:'─',v:'│',ml:'├',mr:'┤',mt:'┬',mb:'┴',cx:'┼' },
  heavy:   { tl:'┏',tr:'┓',bl:'┗',br:'┛',h:'━',v:'┃',ml:'┣',mr:'┫',mt:'┳',mb:'┻',cx:'╋' },
};

export const table = (rows: string[][], opts: TableOptions = {}): string => {
  const { header = true, borderStyle = 'rounded', padding = 1 } = opts;
  if (!rows || rows.length === 0) return '';
  const b = TABLE_BORDERS[borderStyle] ?? TABLE_BORDERS.rounded;
  const pad = ' '.repeat(padding);
  // Use max columns across ALL rows — handles irregular/jagged rows
  const cols = Math.max(...rows.map((r) => r.length), 0);
  const widths = Array.from({ length: cols }, (_, ci) =>
    Math.max(...rows.map((r) => visibleLen(String(r[ci] ?? ''))))
  );

  const rowSep = (left: string, mid: string, right: string, fill: string): string =>
    left + widths.map((w) => fill.repeat(w + padding * 2)).join(mid) + right;

  const renderRow = (row: string[], isHeader = false): string => {
    const cells = row.map((cell, ci) => {
      let s = padEnd(String(cell ?? ''), widths[ci] ?? 0);
      if (isHeader) s = sgr(STYLE.bold) + s + reset();
      return pad + s + pad;
    });
    return b.v + cells.join(b.v) + b.v;
  };

  const lines: string[] = [];
  lines.push(rowSep(b.tl, b.mt, b.tr, b.h));
  rows.forEach((row, ri) => {
    lines.push(renderRow(row, ri === 0 && header));
    if (ri === 0 && header && rows.length > 1) lines.push(rowSep(b.ml, b.cx, b.mr, b.h));
  });
  lines.push(rowSep(b.bl, b.mb, b.br, b.h));
  return lines.join('\n');
};

// ── Badge ────────────────────────────────────
export interface BadgeOptions {
  labelBg?: number;
  valueBg?: number;
  labelFg?: number;
  valueFg?: number;
}

export const badge = (label: string, value: string, opts: BadgeOptions = {}): string => {
  const { labelBg = BG.blue, valueBg = BG.green, labelFg = FG.white, valueFg = FG.white } = opts;
  return sgr(labelBg, labelFg) + ` ${label} ` + reset() + sgr(valueBg, valueFg) + ` ${value} ` + reset();
};

// ── Progress bar ─────────────────────────────
export interface ProgressBarOptions {
  width?: number;
  char?: string;
  emptyChar?: string;
  showPercentage?: boolean;
  label?: string;
  color?: number | null;
}

export const progressBar = (percent: number, opts: ProgressBarOptions = {}): string => {
  const { width = 30, char = '█', emptyChar = '░', showPercentage = true, label = '', color = null } = opts;
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  let filledStr = char.repeat(filled);
  const emptyStr = emptyChar.repeat(empty);
  if (color !== null) filledStr = sgr(color) + filledStr + reset();
  const pct = showPercentage ? ` ${String(Math.round(clamped)).padStart(3)}%` : '';
  const lbl = label ? ` ${label}` : '';
  return `[${filledStr}${emptyStr}]${pct}${lbl}`;
};

// ── Box ──────────────────────────────────────
export { ascii as box };

// ── Status line ──────────────────────────────
export type StatusType = 'success' | 'error' | 'warn' | 'info' | 'wait';

const STATUS_MAP: Record<StatusType, { icon: string; color: number }> = {
  success: { icon: '✓', color: FG.green },
  error:   { icon: '✗', color: FG.red },
  warn:    { icon: '⚠', color: FG.yellow },
  info:    { icon: 'ℹ', color: FG.cyan },
  wait:    { icon: '◌', color: FG.brightBlack },
};

export const status = (type: StatusType, message: string): string => {
  const { icon, color } = STATUS_MAP[type] ?? STATUS_MAP.info;
  return sgr(color) + icon + reset() + ' ' + message;
};

// ── Section header ───────────────────────────
export interface SectionOptions {
  char?: string;
  width?: number | null;
  color?: number;
}

export const section = (title: string, opts: SectionOptions = {}): string => {
  const { char = '─', width = null, color: colorCode = FG.cyan } = opts;
  const { cols } = termSize();
  // Ensure width is never smaller than title + 2 spaces (prevents negative repeat)
  const w = Math.max(width ?? cols, title.length + 2);
  const side = Math.floor((w - title.length - 2) / 2);
  const divider = sgr(colorCode) + char.repeat(side) + reset();
  const t = sgr(STYLE.bold, colorCode) + title + reset();
  const trail = sgr(colorCode) + char.repeat(Math.max(0, w - side - title.length - 2)) + reset();
  return divider + ' ' + t + ' ' + trail;
};

// ── Columns layout ───────────────────────────
export interface ColumnsOptions {
  cols?: number;
  gap?: number;
  width?: number | null;
}

export const columns = (items: string[], opts: ColumnsOptions = {}): string => {
  const { cols: numCols = 2, gap = 2, width = null } = opts;
  if (numCols < 1) throw new Error('columns: cols must be >= 1');
  const { cols: termCols } = termSize();
  const totalW = width ?? termCols;
  const colW = Math.floor((totalW - gap * (numCols - 1)) / numCols);
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += numCols) {
    const chunk = items.slice(i, i + numCols);
    rows.push(chunk.map((item) => padEnd(String(item), colW)).join(' '.repeat(gap)));
  }
  return rows.join('\n');
};

// ── Timeline ─────────────────────────────────
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
}

export const timeline = (events: TimelineEvent[], opts: TimelineOptions = {}): string => {
  const {
    connector = '│', node = '●',
    color: colorCode = FG.cyan,
    doneColor = FG.green,
    pendingColor = FG.brightBlack,
  } = opts;

  const lines: string[] = [];
  events.forEach((ev, i) => {
    const isLast = i === events.length - 1;
    const clr = ev.done ? doneColor : (i === 0 ? colorCode : pendingColor);
    const nodeStr = sgr(clr) + node + reset();
    const textStr = ev.done
      ? sgr(STYLE.bold) + ev.label + reset()
      : sgr(pendingColor) + ev.label + reset();
    lines.push(`${nodeStr} ${textStr}${ev.time ? sgr(FG.brightBlack) + '  ' + ev.time + reset() : ''}`);
    if (!isLast) lines.push(sgr(pendingColor) + connector + reset());
  });
  return lines.join('\n');
};

// ── Interactive menu ─────────────────────────

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
  const {
    title = null,
    pointer = '▶',
    multiSelect = false,
    color: colorCode = FG.cyan,
    input: inp  = process.stdin as MenuInput,
    output: out = { write: (s: string) => process.stdout.write(s) },
  } = opts;

  // Guard: menu requires at least one item
  if (!items.length) throw new Error('menu requires at least one item');

  // Non-TTY fallback — no interaction possible, return empty/neutral value
  if (!inp.isTTY) return Promise.resolve(multiSelect ? ([] as number[]) : 0);

  let cursorPos = 0;
  const selected = new Set<number>();

  const emit = (str: string): void => { out.write(str); };

  const render = (): void => {
    if (title) emit(sgr(STYLE.bold) + title + reset() + '\n');
    items.forEach((item, i) => {
      const isActive   = i === cursorPos;
      const isSelected = selected.has(i);
      const ptr = isActive ? sgr(colorCode) + pointer + reset() : ' ';
      const sel = multiSelect ? (isSelected ? sgr(colorCode) + '●' + reset() : '○') : '';
      const txt = isActive ? sgr(STYLE.bold, colorCode) + item + reset() : item;
      emit(`${ptr} ${sel}${multiSelect ? ' ' : ''}${txt}\n`);
    });
  };

  const clearLines = (): void => {
    const lines = items.length + (title ? 1 : 0);
    for (let i = 0; i < lines; i++) emit(cursor.up(1) + screen.clearLine());
    emit('\r');
  };

  // Centralised cleanup — called in all exit paths
  const cleanup = (onKey: (...args: unknown[]) => void): void => {
    inp.removeListener('data', onKey);
    if (inp.setRawMode) inp.setRawMode(false);
    emit(cursor.show());
  };

  emit(cursor.hide());
  render();

  return new Promise<MenuResult>((resolve) => {
    const onKey = (...args: unknown[]): void => {
      const key = args[0] as { toString(): string };
      const k = key.toString();
      const KEY_UP     = '\x1b[A'; // arrow up  | k | w
      const KEY_DOWN   = '\x1b[B'; // arrow down | j | s
      const KEY_ENTER  = '\r';
      const KEY_SPACE  = ' ';
      const KEY_CTRL_C = '\x03';

      // Ctrl+C — resolve with MENU_CANCELLED symbol (never kill the process)
      if (k === KEY_CTRL_C) {
        clearLines();
        cleanup(onKey);
        resolve(MENU_CANCELLED);
        return;
      }

      if (k === KEY_UP   || k === 'k' || k === 'w') {
        cursorPos = (cursorPos - 1 + items.length) % items.length;
      } else if (k === KEY_DOWN || k === 'j' || k === 's') {
        cursorPos = (cursorPos + 1) % items.length;
      } else if (k === KEY_SPACE && multiSelect) {
        if (selected.has(cursorPos)) selected.delete(cursorPos);
        else selected.add(cursorPos);
      } else if (k === KEY_ENTER) {
        clearLines();
        cleanup(onKey);
        // If nothing was explicitly selected, fall back to cursor position
        resolve(multiSelect
          ? (selected.size ? [...selected] : [cursorPos])
          : cursorPos);
        return;
      }

      clearLines();
      render();
    };

    if (inp.setRawMode) inp.setRawMode(true);
    inp.resume();
    inp.on('data', onKey);
  });
};

export const components = { table, badge, progressBar, status, section, columns, timeline, menu };
export default components;