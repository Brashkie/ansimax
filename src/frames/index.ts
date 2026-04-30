// ─────────────────────────────────────────────
//  FRAMES  –  frame-by-frame animation engine
// ─────────────────────────────────────────────

import { cursor, screen, write, writeln, sleep } from '../utils/ansi.js';

type FrameCallback = (frame: string, index: number) => string;

export interface PlayOptions {
  interval?:      number;
  repeat?:        number;
  clearOnFinish?: boolean;
  onFrame?:       FrameCallback | null;
  signal?:        AbortSignal;
}

export interface LiveOptions {
  fps?:       number;
  autoStart?: boolean;
}

export interface LiveController {
  start:  () => void;
  stop:   () => void;
  update: (frame: string) => void;
}

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────
const lineCount = (frame: string): number => frame.split('\n').length;

const clearLines = (n: number): void => {
  for (let i = 0; i < n; i++) {
    write('\r' + screen.clearLine() + cursor.up(1));
  }
};

// ─────────────────────────────────────────────
//  play — frame sequence player
// ─────────────────────────────────────────────
const play = async (frames: string[], opts: PlayOptions = {}): Promise<void> => {
  const {
    interval = 100,
    repeat   = 1,
    clearOnFinish = false,
    onFrame  = null,
    signal,
  } = opts;

  if (!frames || frames.length === 0) return;

  // Clamp repeat — negative values are treated as 0 (no play)
  const safeRepeat = Math.max(0, repeat);
  const infinite   = repeat === 0;

  let lastLines = 0;
  let iteration = 0;

  const renderFrame = (frame: string, idx: number): void => {
    if (lastLines > 0) clearLines(lastLines);
    const rendered = onFrame ? onFrame(frame, idx) : frame;
    write(rendered);
    // Track lines for next clear — account for implicit newline
    lastLines = lineCount(rendered) + (rendered.endsWith('\n') ? 0 : 1);
    if (!rendered.endsWith('\n')) writeln();
  };

  write(cursor.hide());
  try {
    while (infinite || iteration < safeRepeat) {
      for (let i = 0; i < frames.length; i++) {
        if (signal?.aborted) return;
        renderFrame(frames[i] as string, i);
        await sleep(interval);
      }
      iteration++;
      if (!infinite && iteration >= safeRepeat) break;
    }
    if (clearOnFinish && lastLines > 0) clearLines(lastLines);
  } finally {
    // cursor.show always runs — even if onFrame throws or signal aborts
    write(cursor.show());
  }
};

// ─────────────────────────────────────────────
//  generate — create frames from a function
// ─────────────────────────────────────────────
const generate = (count: number, fn: (i: number, total: number) => string): string[] =>
  Array.from({ length: Math.max(0, count) }, (_, i) => fn(i, count));

// ─────────────────────────────────────────────
//  live — real-time frame renderer
// ─────────────────────────────────────────────
const live = (opts: LiveOptions = {}): LiveController => {
  const { fps = 12, autoStart = true } = opts;

  // Guard against fps:0 which would cause division by zero
  const safeFps = Math.max(1, fps);
  const interval = Math.floor(1000 / safeFps);

  let currentFrame = '';
  let lastLines    = 0;
  let running      = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const render = (): void => {
    if (lastLines > 0) clearLines(lastLines);
    write(currentFrame);
    lastLines = lineCount(currentFrame) + (currentFrame.endsWith('\n') ? 0 : 1);
    if (!currentFrame.endsWith('\n')) writeln();
  };

  const start = (): void => {
    if (running) return; // idempotent
    running = true;
    write(cursor.hide());
    timer = setInterval(render, interval);
  };

  const stop = (): void => {
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null; // prevent potential double-clear
    }
    write(cursor.show());
  };

  const update = (newFrame: string): void => {
    currentFrame = newFrame;
    // Render immediately so update() feels instant, not deferred to next tick
    if (running) render();
  };

  if (autoStart) start();
  return { start, stop, update };
};

// ─────────────────────────────────────────────
//  morph — interpolate between two text frames
//  Unique feature: morphs character-by-character
//  using a scramble charset for transition effect
// ─────────────────────────────────────────────
const morph = (
  frameA: string,
  frameB: string,
  steps = 8,
  charset = '░▒▓█▓▒░',
): string[] => {
  const n = Math.max(2, steps);
  const len = Math.max(frameA.length, frameB.length);
  const a = frameA.padEnd(len);
  const b = frameB.padEnd(len);

  // a and b are always exactly `len` chars (padEnd guarantees it)
  // so indexing is always safe — no ?? fallbacks needed
  return generate(n, (i) => {
    const t = i / (n - 1); // 0 → 1
    return [...Array(len)].map((_, ci) => {
      const ca = a[ci] as string;
      const cb = b[ci] as string;
      if (t === 0) return ca;
      if (t === 1) return cb;
      // Mid-transition: scramble chars that differ
      if (ca !== cb) {
        if (!charset.length) return '░';
        const idx = Math.floor(t * charset.length) % charset.length;
        return charset[idx] as string;
      }
      return ca;
    }).join('');
  });
};

// ─────────────────────────────────────────────
//  presets
// ─────────────────────────────────────────────
const presets = {
  loadingBar: (opts: { width?: number; char?: string; empty?: string; label?: string } = {}): string[] => {
    const { width = 20, char = '█', empty = '░', label = 'Loading' } = opts;
    return generate(width + 1, (i) => {
      const filled = char.repeat(i);
      const rest   = empty.repeat(width - i);
      const pct    = Math.round((i / width) * 100);
      return `${label} [${filled}${rest}] ${pct}%`;
    });
  },

  ball: (opts: { width?: number; char?: string } = {}): string[] => {
    const { width = 20, char = '●' } = opts;
    const forward  = generate(width, (i) => ' '.repeat(i) + char);
    const backward = generate(width, (i) => ' '.repeat(width - i - 1) + char);
    // Slice off duplicated endpoints for smooth loop (no micro-pause at extremes)
    return [...forward, ...backward.slice(1, -1).reverse()];
  },

  breathe: (text: string, opts: { steps?: number } = {}): string[] => {
    const { steps = 8 } = opts;
    const shades = ['░', '▒', '▓', '█'];
    return generate(steps * 2, (i) => {
      const t     = i < steps ? i / steps : 1 - (i - steps) / steps;
      const shade = shades[Math.min(shades.length - 1, Math.floor(t * shades.length))] as string;
      return text.split('').map((ch) => (ch === ' ' ? ' ' : shade)).join('');
    });
  },

  typeDelete: (text: string, opts: { cursor?: string } = {}): string[] => {
    const { cursor: cur = '▌' } = opts;
    const typed   = generate(text.length + 1, (i) => text.slice(0, i) + cur);
    const deleted = generate(text.length + 1, (i) => text.slice(0, text.length - i) + cur);
    return [...typed, ...deleted];
  },
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export const frames = { play, generate, live, morph, presets };
export default frames;