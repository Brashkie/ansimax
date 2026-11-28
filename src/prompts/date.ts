/**
 * ansimax/prompts/date — a calendar picker and a clock, Phase 11.
 *
 * Dates are the one prompt where typing is worse than pointing: a month grid
 * answers "which Thursday?" at a glance, where a text field makes the user
 * work it out. So this draws the month, moves a cursor through it with the
 * arrow keys, and never parses a date out of a string.
 *
 * All arithmetic is local-time and calendar-aware: `new Date(y, m, 0)` gives
 * the last day of the previous month, which is how leap years and 30/31-day
 * months are handled without a table of lengths.
 *
 * @module
 * @since 1.10.0
 */

import { sgr, FG, STYLE, reset } from '../utils/ansi.js';
import { runSession } from './session.js';
import type { PROMPT_CANCELLED, PROMPT_BACK, PromptBaseOptions } from './session.js';

/** Options for {@link datePrompt}. */
export interface DatePromptOptions extends PromptBaseOptions {
  /** The question. */
  message?: string;
  /** Where the cursor starts. Default today. */
  initial?: Date;
  /** Earliest selectable date, inclusive. */
  min?: Date;
  /** Latest selectable date, inclusive. */
  max?: Date;
  /**
   * First column of the grid: `0` Sunday (default), `1` Monday. The rest of
   * the week follows from it.
   */
  weekStart?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Also pick a time, with Tab moving between the date and the clock. */
  time?: boolean;
  /** Minutes per step when adjusting the clock. Default `15`. */
  minuteStep?: number;
  /** Day names for the header, starting Sunday. Seven entries. */
  dayNames?: readonly string[];
  /** Month names, starting January. Twelve entries. */
  monthNames?: readonly string[];
  /** Reject a date and say why. */
  validate?: (value: Date) => true | string | null | undefined;
}

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const GREY = 90;

/** Days in the month containing `date`. Day 0 of the next month is this one's last. */
const daysInMonth = (year: number, month: number): number =>
  new Date(year, month + 1, 0).getDate();

/** Midnight local time, so two dates compare by day rather than by instant. */
const atMidnight = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const sameDay = (a: Date, b: Date): boolean => atMidnight(a) === atMidnight(b);

/** Shift by whole months, clamping the day so 31 Jan + 1 month is 28/29 Feb. */
const addMonths = (date: Date, delta: number): Date => {
  // Land on the 1st first: `new Date(y, m, 31)` for a 30-day month rolls into
  // the next one, so the day has to be clamped after the month is known.
  const shifted = new Date(
    date.getFullYear(), date.getMonth() + delta, 1,
    date.getHours(), date.getMinutes(),
  );
  const last = daysInMonth(shifted.getFullYear(), shifted.getMonth());
  shifted.setDate(Math.min(date.getDate(), last));
  return shifted;
};

const addDays = (date: Date, delta: number): Date => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + delta);
  return next;
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** `2026-11-28`, which is the one date format nobody misreads. */
export const formatISODate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** `14:30`, 24-hour. */
export const formatTime = (date: Date): string =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/**
 * Pick a date, and optionally a time, from a calendar.
 *
 * Arrow keys move a day at a time, Up and Down a week, PageUp and PageDown a
 * month, and Shift with either a year. Dates outside `min`/`max` are drawn
 * dimmed and cannot be landed on. With `time: true`, Tab switches to a clock
 * where Left and Right move between hours and minutes.
 *
 * @example
 * ```js
 * import { datePrompt, formatISODate, wasCancelled } from 'ansimax';
 *
 * const when = await datePrompt({
 *   message: 'Release date',
 *   min: new Date(),
 *   weekStart: 1,
 * });
 * if (!wasCancelled(when)) console.log(formatISODate(when));
 * ```
 *
 * @since 1.10.0
 */
export const datePrompt = (
  opts: DatePromptOptions = {},
): Promise<Date | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const message = typeof opts.message === 'string' ? opts.message : '';
  const weekStart = ((): number => {
    const w = Math.trunc(opts.weekStart ?? 0);
    return w >= 0 && w <= 6 ? w : 0;
  })();
  const dayNames = Array.isArray(opts.dayNames) && opts.dayNames.length === 7
    ? opts.dayNames
    : DAY_NAMES;
  const monthNames = Array.isArray(opts.monthNames) && opts.monthNames.length === 12
    ? opts.monthNames
    : MONTH_NAMES;
  const withTime = opts.time === true;
  const minuteStep = Math.max(1, Math.trunc(opts.minuteStep ?? 15) || 15);

  const isDate = (d: unknown): d is Date =>
    d instanceof Date && Number.isFinite(d.getTime());
  const min = isDate(opts.min) ? opts.min : null;
  const max = isDate(opts.max) ? opts.max : null;

  let cursor = isDate(opts.initial) ? new Date(opts.initial.getTime()) : new Date();
  if (!withTime) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  }
  // A cursor outside the range would show a grid where nothing can be picked.
  if (min && atMidnight(cursor) < atMidnight(min)) cursor = new Date(min.getTime());
  if (max && atMidnight(cursor) > atMidnight(max)) cursor = new Date(max.getTime());

  /** 'date' moves the calendar cursor, 'hour'/'minute' the clock. */
  let focus: 'date' | 'hour' | 'minute' = 'date';
  let error: string | null = null;

  const inRange = (date: Date): boolean => {
    if (min && atMidnight(date) < atMidnight(min)) return false;
    if (max && atMidnight(date) > atMidnight(max)) return false;
    return true;
  };

  const move = (next: Date): void => {
    // Refuse the move rather than silently clamping: a cursor that slides to
    // a different day than the arrow asked for is disorienting.
    if (!inRange(next)) return;
    cursor = next;
    error = null;
  };

  const render = (): string[] => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const today = new Date();

    const lines: string[] = [
      `${sgr(FG.cyan, STYLE.bold)}?${reset()} ${sgr(STYLE.bold)}${message}${reset()}` +
        `  ${sgr(FG.cyan)}${formatISODate(cursor)}${withTime ? ` ${formatTime(cursor)}` : ''}${reset()}`,
      `  ${sgr(STYLE.bold)}${monthNames[month]} ${year}${reset()}`,
    ];

    // Header, rotated so the configured first day leads.
    const header: string[] = [];
    for (let i = 0; i < 7; i++) header.push(dayNames[(weekStart + i) % 7] as string);
    lines.push(`  ${sgr(GREY)}${header.map((d) => d.slice(0, 2).padStart(2)).join(' ')}${reset()}`);

    // Where the 1st falls, measured from the configured first day.
    const firstWeekday = new Date(year, month, 1).getDay();
    const lead = (firstWeekday - weekStart + 7) % 7;
    const total = daysInMonth(year, month);

    let row = `  ${'   '.repeat(lead)}`;
    for (let day = 1; day <= total; day++) {
      const date = new Date(year, month, day);
      const label = String(day).padStart(2);
      let cell: string;
      if (!inRange(date)) {
        cell = sgr(GREY) + label + reset();
      } else if (sameDay(date, cursor)) {
        cell = sgr(STYLE.inverse, FG.cyan) + label + reset();
      } else if (sameDay(date, today)) {
        cell = sgr(STYLE.underline) + label + reset();
      } else {
        cell = label;
      }
      row += cell;
      if ((lead + day) % 7 === 0) {
        lines.push(row);
        row = '  ';
      } else {
        row += ' ';
      }
    }
    if (row.trim().length > 0) lines.push(row);

    if (withTime) {
      const hh = focus === 'hour'
        ? sgr(STYLE.inverse) + pad2(cursor.getHours()) + reset()
        : pad2(cursor.getHours());
      const mm = focus === 'minute'
        ? sgr(STYLE.inverse) + pad2(cursor.getMinutes()) + reset()
        : pad2(cursor.getMinutes());
      const marker = focus === 'date' ? sgr(GREY) : '';
      lines.push(`  ${marker}${hh}:${mm}${focus === 'date' ? reset() : ''}  ${sgr(GREY)}tab${reset()}`);
    }

    if (error) lines.push(`  ${sgr(FG.red)}✗ ${error}${reset()}`);
    return lines;
  };

  const adjustClock = (delta: number): void => {
    const next = new Date(cursor.getTime());
    if (focus === 'hour') next.setHours(next.getHours() + delta);
    else next.setMinutes(next.getMinutes() + delta * minuteStep);
    // Rolling the clock past midnight changes the day, which has to stay in
    // range like any other move.
    if (inRange(next)) {
      cursor = next;
      error = null;
    }
  };

  return runSession<Date>({
    input: opts.input,
    output: opts.output,
    keep: opts.keep,
    back: opts.back,
    nonTTY: () => cursor,
    render,
    onKey: (key) => {
      if (key.name === 'return') {
        if (!inRange(cursor)) {
          error = 'that date is outside the allowed range';
          return { done: false };
        }
        let verdict: true | string | null | undefined;
        try {
          verdict = opts.validate?.(cursor);
        } catch (err) {
          verdict = err instanceof Error ? err.message : String(err);
        }
        if (typeof verdict === 'string' && verdict.length > 0) {
          error = verdict;
          return { done: false };
        }
        return { done: true, value: cursor };
      }

      if (key.name === 'tab' && withTime) {
        focus = focus === 'date' ? 'hour' : focus === 'hour' ? 'minute' : 'date';
        return { done: false };
      }

      if (focus !== 'date') {
        if (key.name === 'up') adjustClock(1);
        else if (key.name === 'down') adjustClock(-1);
        else if (key.name === 'left' || key.name === 'right') {
          focus = focus === 'hour' ? 'minute' : 'hour';
        }
        return { done: false };
      }

      switch (key.name) {
        case 'left':
          move(addDays(cursor, -1));
          break;
        case 'right':
          move(addDays(cursor, 1));
          break;
        case 'up':
          move(key.shift ? addMonths(cursor, -12) : addDays(cursor, -7));
          break;
        case 'down':
          move(key.shift ? addMonths(cursor, 12) : addDays(cursor, 7));
          break;
        case 'pageup':
          move(addMonths(cursor, key.shift ? -12 : -1));
          break;
        case 'pagedown':
          move(addMonths(cursor, key.shift ? 12 : 1));
          break;
        case 'home':
          move(new Date(cursor.getFullYear(), cursor.getMonth(), 1, cursor.getHours(), cursor.getMinutes()));
          break;
        case 'end':
          move(new Date(
            cursor.getFullYear(), cursor.getMonth(),
            daysInMonth(cursor.getFullYear(), cursor.getMonth()),
            cursor.getHours(), cursor.getMinutes(),
          ));
          break;
        case 't': {
          // Jump to today, which is what every calendar binds `t` to.
          const now = new Date();
          move(withTime ? now : new Date(now.getFullYear(), now.getMonth(), now.getDate()));
          break;
        }
        default:
          break;
      }
      return { done: false };
    },
  });
};
