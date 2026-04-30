// ─────────────────────────────────────────────
//  ANIMATIONS  –  typewriter, fade, slide, pulse, wave, glitch, reveal
// ─────────────────────────────────────────────

import { cursor, screen, write, writeln, sleep, fgRgb, reset } from '../utils/ansi.js';
import { hexToRgb, lerpColor, RGB } from '../utils/helpers.js';
import { ColorFn } from '../colors/index.js';

// ── Non-TTY / pipe guard ─────────────────────
// When stdout is not a TTY (CI, pipes, redirection) skip animation and
// write the text directly. This prevents garbled ANSI in logs.
const isTTY = (): boolean => Boolean(process.stdout.isTTY);

// ── Shared helpers ───────────────────────────
const resolveRgb = (c: string | RGB): RGB =>
  typeof c === 'string' ? hexToRgb(c) : c;

const safeSteps = (n: number): number => Math.max(1, n);

// ─────────────────────────────────────────────
//  Option interfaces
// ─────────────────────────────────────────────

export interface TypewriterOptions {
  speed?: number;
  newline?: boolean;
  colorFn?: ColorFn | null;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface FadeOptions {
  duration?: number;
  steps?: number;
  newline?: boolean;
  color?: string | RGB;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface SlideOptions {
  direction?: 'left' | 'right';
  duration?: number;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface PulseOptions {
  times?: number;
  interval?: number;
  color1?: string | RGB;
  color2?: string | RGB;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface WaveOptions {
  duration?: number;
  steps?: number;
  colors?: string[];
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface GlitchOptions {
  duration?: number;
  intensity?: number;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface RevealOptions {
  duration?: number;
  charset?: string;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

// ─────────────────────────────────────────────
//  TYPEWRITER
// ─────────────────────────────────────────────
const typewriter = async (text: string, opts: TypewriterOptions = {}): Promise<void> => {
  const { speed = 50, newline = true, colorFn = null, signal, reducedMotion = false } = opts;

  if (!isTTY() || reducedMotion) {
    write(colorFn ? [...text].map(colorFn).join('') : text);
    if (newline) writeln();
    return;
  }

  write(cursor.hide());
  try {
    for (const ch of text) {
      if (signal?.aborted) break;
      write(colorFn ? colorFn(ch) : ch);
      if (ch !== ' ') await sleep(speed);
    }
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

// ─────────────────────────────────────────────
//  FADE IN
// ─────────────────────────────────────────────
const fadeIn = async (text: string, opts: FadeOptions = {}): Promise<void> => {
  const {
    duration = 800, steps = 16, newline = true,
    color: baseColor = { r: 255, g: 255, b: 255 },
    signal, reducedMotion = false,
  } = opts;

  if (!isTTY() || reducedMotion) {
    write(text);
    if (newline) writeln();
    return;
  }

  const base = resolveRgb(baseColor);
  const n = safeSteps(steps);

  write(cursor.hide());
  try {
    for (let i = 0; i <= n; i++) {
      if (signal?.aborted) break;
      const t = i / n;
      write(
        cursor.save() +
        fgRgb(Math.round(base.r * t), Math.round(base.g * t), Math.round(base.b * t)) +
        text + reset() + cursor.restore()
      );
      await sleep(duration / n);
    }
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

// ─────────────────────────────────────────────
//  FADE OUT
// ─────────────────────────────────────────────
const fadeOut = async (text: string, opts: FadeOptions = {}): Promise<void> => {
  const {
    duration = 800, steps = 16, newline = true,
    color: baseColor = { r: 255, g: 255, b: 255 },
    signal, reducedMotion = false,
  } = opts;

  if (!isTTY() || reducedMotion) {
    if (newline) writeln();
    return;
  }

  const base = resolveRgb(baseColor);
  const n = safeSteps(steps);

  write(cursor.hide());
  try {
    for (let i = n; i >= 0; i--) {
      if (signal?.aborted) break;
      const t = i / n;
      write(
        cursor.save() +
        fgRgb(Math.round(base.r * t), Math.round(base.g * t), Math.round(base.b * t)) +
        text + reset() + cursor.restore()
      );
      await sleep(duration / n);
    }
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

// ─────────────────────────────────────────────
//  SLIDE
// ─────────────────────────────────────────────
const slide = async (text: string, opts: SlideOptions = {}): Promise<void> => {
  const { direction = 'left', duration = 400, newline = true, signal, reducedMotion = false } = opts;

  if (!isTTY() || reducedMotion) {
    write(text);
    if (newline) writeln();
    return;
  }

  const len = text.length;
  const steps = Math.min(Math.max(1, len), 40);
  const delay = duration / steps;

  write(cursor.hide());
  try {
    for (let i = 1; i <= steps; i++) {
      if (signal?.aborted) break;
      const shown = Math.floor((i / steps) * len);
      // 'right': text slides in from the right — leading spaces close in
      const line = direction === 'right'
        ? ' '.repeat(len - shown) + text.slice(0, shown)
        : text.slice(0, shown);
      write(cursor.save() + screen.clearRight() + line + cursor.restore());
      await sleep(delay);
    }
    write(cursor.save() + screen.clearRight() + text + cursor.restore());
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

// ─────────────────────────────────────────────
//  PULSE
// ─────────────────────────────────────────────
const pulse = async (text: string, opts: PulseOptions = {}): Promise<void> => {
  const {
    times = 3, interval = 300,
    color1 = { r: 255, g: 255, b: 255 },
    color2 = { r: 100, g: 100, b: 100 },
    newline = true, signal, reducedMotion = false,
  } = opts;

  if (!isTTY() || reducedMotion) {
    write(text);
    if (newline) writeln();
    return;
  }

  const c1 = resolveRgb(color1);
  const c2 = resolveRgb(color2);

  write(cursor.hide());
  try {
    for (let t = 0; t < times; t++) {
      if (signal?.aborted) break;
      write(cursor.save() + fgRgb(c1.r, c1.g, c1.b) + text + reset() + cursor.restore());
      await sleep(interval);
      if (signal?.aborted) break;
      write(cursor.save() + fgRgb(c2.r, c2.g, c2.b) + text + reset() + cursor.restore());
      await sleep(interval);
    }
    // Leave at bright color — includes cursor.restore (fixes missing restore bug)
    write(cursor.save() + fgRgb(c1.r, c1.g, c1.b) + text + reset() + cursor.restore());
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

// ─────────────────────────────────────────────
//  WAVE
// ─────────────────────────────────────────────
const wave = async (text: string, opts: WaveOptions = {}): Promise<void> => {
  const {
    duration = 2000, steps = 30,
    colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'],
    newline = true, signal, reducedMotion = false,
  } = opts;

  if (!isTTY() || reducedMotion) {
    write(text);
    if (newline) writeln();
    return;
  }

  // Guard: empty text — nothing to wave
  if (!text.length) {
    if (newline) writeln();
    return;
  }

  const palette = colors.map(hexToRgb);
  const n = safeSteps(steps);
  const delay = duration / n;
  const chars = [...text];
  const len = chars.length;

  write(cursor.hide());
  try {
    for (let frame = 0; frame < n; frame++) {
      if (signal?.aborted) break;
      const offset = frame / n;
      const colored = chars.map((ch, i) => {
        if (ch === ' ') return ch;
        const t = ((i / len) + offset) % 1;
        const scaled = t * (palette.length - 1);
        const lo = Math.floor(scaled);
        const hi = Math.min(lo + 1, palette.length - 1);
        const { r, g, b } = lerpColor(palette[lo] as RGB, palette[hi] as RGB, scaled - lo);
        return fgRgb(r, g, b) + ch + reset();
      }).join('');
      write(cursor.save() + screen.clearRight() + colored + cursor.restore());
      await sleep(delay);
    }
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

// ─────────────────────────────────────────────
//  GLITCH
// ─────────────────────────────────────────────
const glitch = async (text: string, opts: GlitchOptions = {}): Promise<void> => {
  const { duration = 800, intensity = 3, newline = true, signal, reducedMotion = false } = opts;

  if (!isTTY() || reducedMotion) {
    write(text);
    if (newline) writeln();
    return;
  }

  const glitchChars = '!@#$%^&*[]{}|<>/\\~`\xb1\xa7';
  const end = Date.now() + duration;

  write(cursor.hide());
  try {
    while (Date.now() < end) {
      if (signal?.aborted) break;
      const out = [...text].map((ch) => {
        if (ch === ' ') return ch;
        return Math.random() < intensity / 10
          ? glitchChars[Math.floor(Math.random() * glitchChars.length)]
          : ch;
      }).join('');
      write(cursor.save() + screen.clearRight() + out + cursor.restore());
      await sleep(40);
    }
    write(cursor.save() + screen.clearRight() + text + cursor.restore());
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

// ─────────────────────────────────────────────
//  REVEAL
// ─────────────────────────────────────────────
const reveal = async (text: string, opts: RevealOptions = {}): Promise<void> => {
  const {
    duration = 1000,
    charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    newline = true, signal, reducedMotion = false,
  } = opts;

  if (!isTTY() || reducedMotion) {
    write(text);
    if (newline) writeln();
    return;
  }

  const len = text.length;
  const n = safeSteps(20);
  const delay = duration / n;
  const solved = new Array(len).fill(false) as boolean[];

  write(cursor.hide());
  try {
    for (let step = 0; step < n; step++) {
      if (signal?.aborted) break;
      const toSolve = Math.floor((step / n) * len);
      for (let i = 0; i < toSolve; i++) solved[i] = true;
      const line = [...text].map((ch, i) => {
        if (ch === ' ') return ' ';
        if (solved[i]) return ch;
        return charset[Math.floor(Math.random() * charset.length)];
      }).join('');
      write(cursor.save() + screen.clearRight() + line + cursor.restore());
      await sleep(delay);
    }
    write(cursor.save() + screen.clearRight() + text + cursor.restore());
  } finally {
    write(cursor.show());
    if (newline) writeln();
  }
};

export const animate = {
  typewriter,
  fadeIn,
  fadeOut,
  slide,
  pulse,
  wave,
  glitch,
  reveal,
};

export default animate;