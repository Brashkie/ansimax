// ─────────────────────────────────────────────
//  LOADERS  –  spinners, progress, tasks, countdown
// ─────────────────────────────────────────────

import { cursor, screen, write, writeln, sleep, fgRgb, reset, sgr, FG } from '../utils/ansi.js';
import { hexToRgb } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  TTY guard — silent degradation in CI/pipes
// ─────────────────────────────────────────────
const isTTY = (): boolean => Boolean(process.stdout.isTTY);

// ─────────────────────────────────────────────
//  Safe hex parser — fail-soft, never throws
// ─────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const safeColor = (hex?: string | null): { r: number; g: number; b: number } | null => {
  if (!hex || !HEX_RE.test(hex.trim())) return null;
  return hexToRgb(hex);
};

// ─────────────────────────────────────────────
//  Spinner types
// ─────────────────────────────────────────────
export type SpinnerType =
  | 'dots' | 'dots2' | 'line' | 'arrow' | 'bounce'
  | 'star' | 'pong' | 'aesthetic' | 'blocks' | 'moon' | 'clock';

export const SPINNERS: Record<SpinnerType, string[]> = {
  dots:      ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'],
  dots2:     ['⣾','⣽','⣻','⢿','⡿','⣟','⣯','⣷'],
  line:      ['-','\\','|','/'],
  arrow:     ['←','↖','↑','↗','→','↘','↓','↙'],
  bounce:    ['⠁','⠂','⠄','⠂'],
  star:      ['✶','✸','✹','✺','✹','✷'],
  moon:      ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘'],
  clock:     ['🕛','🕐','🕑','🕒','🕓','🕔','🕕','🕖','🕗','🕘','🕙','🕚'],
  pong:      ['▐⠂       ▌','▐⠈       ▌','▐ ⠂      ▌','▐ ⠠      ▌',
              '▐  ⡀     ▌','▐  ⠠     ▌','▐   ⠂    ▌','▐   ⠈    ▌',
              '▐    ⠂   ▌','▐    ⠠   ▌','▐     ⡀  ▌','▐     ⠠  ▌',
              '▐      ⠂ ▌','▐      ⠈ ▌','▐       ⠂▌','▐       ⠠▌',
              '▐       ⡀▌','▐      ⠠ ▌','▐      ⠂ ▌','▐     ⠈  ▌'],
  aesthetic: ['▰▱▱▱▱▱▱','▰▰▱▱▱▱▱','▰▰▰▱▱▱▱','▰▰▰▰▱▱▱','▰▰▰▰▰▱▱','▰▰▰▰▰▰▱','▰▰▰▰▰▰▰'],
  blocks:    ['█▒▒▒▒▒▒','██▒▒▒▒▒','███▒▒▒▒','████▒▒▒','█████▒▒','██████▒','███████'],
};

// ─────────────────────────────────────────────
//  Option interfaces
// ─────────────────────────────────────────────
export interface SpinOptions {
  type?:          SpinnerType;
  interval?:      number;
  color?:         string | null;
  prefix?:        string;
  suffix?:        string;
  persist?:       boolean;
  signal?:        AbortSignal;
  reducedMotion?: boolean;
}

export interface ProgressOptions {
  width?:          number;
  char?:           string;
  emptyChar?:      string;
  showPercentage?: boolean;
  color?:          string | null;
  label?:          string;
}

export interface Task {
  text: string;
  fn:   () => Promise<unknown>;
}

export interface TaskResult {
  success: boolean;
  result?: unknown;
  error?:  Error;
}

export interface TaskOptions {
  type?:      SpinnerType;
  spinColor?: string;
  parallel?:  boolean;
}

// ─────────────────────────────────────────────
//  SPIN
// ─────────────────────────────────────────────
const spin = (
  text = 'Loading...',
  opts: SpinOptions = {},
): ((message?: string, success?: boolean) => void) => {
  const {
    type = 'dots', interval = 80, color: colorStr = null,
    prefix = '', suffix = '', persist = false,
    signal, reducedMotion = false,
  } = opts;

  // Non-TTY or reduced motion — degraded stop function that still handles message
  if (!isTTY() || reducedMotion) {
    write(text + '\n');
    return (message?: string, success = true): void => {
      if (!message) return;
      const icon = success ? '✓' : '✗';
      const clr  = success
        ? `${sgr(FG.green)}${icon}${reset()}`
        : `${sgr(FG.red)}${icon}${reset()}`;
      writeln(`${clr} ${message}`);
    };
  }

  const frames = SPINNERS[type] ?? SPINNERS.dots;
  const rgb    = safeColor(colorStr);
  let i        = 0;
  let stopped  = false;

  // Declare timer before stop() so the reference is available in closure
  let timer: ReturnType<typeof setInterval>;

  write(cursor.hide());

  const stop = (message?: string, success = true): void => {
    if (stopped) return; // idempotent — safe to call multiple times
    stopped = true;
    clearInterval(timer);
    // Remove abort listener to prevent memory leak
    if (abortHandler) signal?.removeEventListener('abort', abortHandler);
    write(cursor.show() + screen.clearLine() + '\r');
    if (message) {
      const icon = success ? '✓' : '✗';
      const clr  = success
        ? `${sgr(FG.green)}${icon}${reset()}`
        : `${sgr(FG.red)}${icon}${reset()}`;
      writeln(`${clr} ${message}`);
    } else if (persist) {
      writeln(`  ${text}`);
    }
  };

  // Named handler so it can be removed — prevents listener accumulation
  const abortHandler = signal ? () => stop('Cancelled', false) : null;
  if (abortHandler) signal?.addEventListener('abort', abortHandler, { once: true });

  timer = setInterval(() => {
    if (stopped) return;
    if (signal?.aborted) { stop(); return; }
    const frame = frames[i % frames.length] as string;
    const colored = rgb
      ? fgRgb(rgb.r, rgb.g, rgb.b) + frame + reset()
      : frame;
    write(cursor.save() + screen.clearLine() + `\r${prefix}${colored} ${text}${suffix}` + cursor.restore());
    i++;
  }, interval);

  return stop;
};

// ─────────────────────────────────────────────
//  DOTS
// ─────────────────────────────────────────────
const dots = (
  text = 'Processing',
  opts: { interval?: number; max?: number; signal?: AbortSignal } = {},
): (() => void) => {
  const { interval = 400, max = 3, signal } = opts;

  if (!isTTY()) {
    write(text + '\n');
    return () => {};
  }

  let i       = 0;
  let stopped = false;

  write(cursor.hide());

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    write(cursor.show() + screen.clearLine() + '\r');
  };

  if (signal) signal.addEventListener('abort', stop, { once: true });

  const timer = setInterval(() => {
    if (stopped) return;
    const d = '.'.repeat((i % max) + 1).padEnd(max);
    write(cursor.save() + screen.clearLine() + `\r${text}${d}` + cursor.restore());
    i++;
  }, interval);

  return stop;
};

// ─────────────────────────────────────────────
//  PROGRESS BAR (instant, returns void)
// ─────────────────────────────────────────────
const progress = (percent: number, label = '', opts: ProgressOptions = {}): void => {
  const {
    width = 30, char = '█', emptyChar = '░',
    showPercentage = true, color: colorStr = null,
  } = opts;
  const safeWidth = Math.max(1, width);  // prevent negative width
  const clamped = Math.min(100, Math.max(0, percent));
  const filled  = Math.round((clamped / 100) * safeWidth);
  const empty   = safeWidth - filled;
  const rgb     = safeColor(colorStr);
  let filledStr = char.repeat(filled);
  const emptyStr = emptyChar.repeat(empty);
  if (rgb) filledStr = fgRgb(rgb.r, rgb.g, rgb.b) + filledStr + reset();
  const pct = showPercentage ? ` ${String(Math.round(clamped)).padStart(3)}%` : '';
  const lbl = label ? ` ${label}` : '';
  write(screen.clearLine() + `\r[${filledStr}${emptyStr}]${pct}${lbl}`); // safeWidth applied
};

// ─────────────────────────────────────────────
//  ANIMATED PROGRESS
// ─────────────────────────────────────────────
const progressAnimate = async (
  steps: number,
  label = '',
  opts: ProgressOptions & { delay?: number; signal?: AbortSignal } = {},
): Promise<void> => {
  const { delay = 100, signal, ...barOpts } = opts;
  const safeSteps = Math.max(1, steps);

  write(cursor.hide());
  try {
    for (let i = 0; i <= safeSteps; i++) {
      if (signal?.aborted) break;
      progress((i / safeSteps) * 100, label, barOpts);
      await sleep(delay);
    }
    writeln();
  } finally {
    write(cursor.show());
  }
};

// ─────────────────────────────────────────────
//  MULTI-TASK RUNNER
// ─────────────────────────────────────────────
const tasks = async (
  taskList: Task[],
  opts: TaskOptions = {},
): Promise<TaskResult[]> => {
  const { type = 'dots', spinColor = '#00ff88', parallel = false } = opts;

  if (!taskList.length) return [];

  const runTask = async ({ text, fn }: Task): Promise<TaskResult> => {
    // parallel mode disables spinner animation to prevent stdout corruption
    const stop = spin(text, { type, color: spinColor, reducedMotion: parallel });
    try {
      const result = await fn();
      stop(text, true);
      return { success: true, result };
    } catch (err) {
      stop(`${text} — ${(err as Error).message}`, false);
      return { success: false, error: err as Error };
    }
  };

  if (parallel) {
    // Run all tasks concurrently
    return Promise.all(taskList.map(runTask));
  }

  // Sequential (default)
  const results: TaskResult[] = [];
  for (const task of taskList) {
    results.push(await runTask(task));
  }
  return results;
};

// ─────────────────────────────────────────────
//  CUSTOM FRAMES
// ─────────────────────────────────────────────
const custom = (
  frames: string[],
  text = '',
  opts: { interval?: number; signal?: AbortSignal } = {},
): (() => void) => {
  const { interval = 100, signal } = opts;

  if (!frames.length) throw new Error('custom: frames cannot be empty');

  if (!isTTY()) {
    write(text + '\n');
    return () => {};
  }

  let i       = 0;
  let stopped = false;

  write(cursor.hide());

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    write(cursor.show() + screen.clearLine() + '\r');
  };

  if (signal) signal.addEventListener('abort', stop, { once: true });

  const timer = setInterval(() => {
    if (stopped) return;
    write(cursor.save() + screen.clearLine() + `\r${frames[i % frames.length]} ${text}` + cursor.restore());
    i++;
  }, interval);

  return stop;
};

// ─────────────────────────────────────────────
//  COUNTDOWN
// ─────────────────────────────────────────────
const countdown = async (
  seconds: number,
  opts: { label?: string; color?: string; signal?: AbortSignal } = {},
): Promise<void> => {
  const { label = 'Starting in', color: colorStr = '#ffd700', signal } = opts;
  const rgb = safeColor(colorStr) ?? { r: 255, g: 215, b: 0 };

  write(cursor.hide());
  try {
    for (let s = seconds; s >= 0; s--) {
      if (signal?.aborted) break;
      write(screen.clearLine() + `\r${label} ${fgRgb(rgb.r, rgb.g, rgb.b)}${s}${reset()}s`);
      if (s > 0) await sleep(1000);
    }
    write(screen.clearLine() + '\r');
  } finally {
    write(cursor.show());
  }
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export const loader = {
  spin,
  dots,
  progress,
  progressAnimate,
  tasks,
  custom,
  countdown,
  spinners: SPINNERS,
};

export default loader;