// ─────────────────────────────────────────────
//  animations/effects — the animation implementations
//
//  v1.6.3 — extracted from the former monolithic animations/index.ts.
//  Each effect (typewriter, fade, slide, pulse, wave, glitch, reveal,
//  shake, countUp) lives here; shared helpers come from ./internal and
//  option types from ./types. Behavior is unchanged.
// ─────────────────────────────────────────────

import {
  cursor, screen,
  writeln,
  sleep, FRAME_MS,
  fgRgb, reset,
  getTerminalWidth,
  createOutputBuffer,
} from '../utils/ansi.js';
import { hexToRgb, lerpColor, RGB } from '../utils/helpers.js';
import {
  isAborted,
  shouldSkip, shouldSkipColor,
  hideCursorSafe, showCursorSafe,
  registerCrashHandlers,
  resolveRgb, safeSteps, safeDuration,
  frameInterval, totalFrames,
  safeWriteAsync, safeWrite,
  fireFrame, fireDone,
  type AnimationHooks,
} from './internal.js';
import type {
  TypewriterOptions, FadeOptions, SlideOptions, PulseOptions,
  WaveOptions, GlitchOptions, RevealOptions, ShakeOptions, CountUpOptions,
} from './types.js';

// ─────────────────────────────────────────────
//  TYPEWRITER
// ─────────────────────────────────────────────
/**
 * Print text one character at a time, like an old typewriter. Resolves
 * when the full text has been printed. Aborts cleanly via AbortSignal.
 *
 * @example basic
 * ```js
 * import { animate } from 'ansimax';
 *
 * await animate.typewriter('Hello, world!');
 * // Prints "Hello, world!" character by character at default speed
 * ```
 *
 * @example faster + colored
 * ```js
 * import { gradient } from 'ansimax';
 *
 * await animate.typewriter('Loading...', {
 *   speed: 30,     // ms per character
 *   colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9']),
 * });
 * ```
 *
 * @example abortable
 * ```js
 * const ctrl = new AbortController();
 * setTimeout(() => ctrl.abort(), 500);
 *
 * await animate.typewriter('Very long text...', { signal: ctrl.signal });
 * // Stops printing as soon as ctrl.abort() is called
 * ```
 *
 * @example respect accessibility (reduced motion)
 * ```js
 * await animate.typewriter('Hello!', { reducedMotion: true });
 * // Prints instantly — no character-by-character animation
 * ```
 */
export const typewriter = async (text: string, opts: TypewriterOptions = {}): Promise<void> => {
  const {
    speed = 50, newline = true, colorFn = null,
    signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkip(signal, reducedMotion)) {
    safeWrite(colorFn ? [...text].map(colorFn).join('') : text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  let frame = 0;
  try {
    for (const ch of text) {
      if (isAborted(signal)) { aborted = true; break; }
      await safeWriteAsync(colorFn ? colorFn(ch) : ch);
      fireFrame(hooks, frame++);
      // Spaces use 30% of the letter delay for natural rhythm
      await sleep(ch === ' ' ? speed * 0.3 : speed, { signal });
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  FADE IN
// ─────────────────────────────────────────────
/**
 * Fade text in from invisible to full color over time.
 *
 * @example basic
 * ```js
 * await animate.fadeIn('Hello world!');  // default 800ms fade
 * ```
 *
 * @example slower with custom color
 * ```js
 * await animate.fadeIn('Welcome', {
 *   duration: 2000,
 *   color: '#bd93f9',
 *   steps: 30,
 * });
 * ```
 *
 * @example abortable + reduced-motion safe
 * ```js
 * await animate.fadeIn('Loaded', {
 *   signal: AbortSignal.timeout(1000),
 *   reducedMotion: prefersReducedMotion,
 * });
 * ```
 */
export const fadeIn = async (text: string, opts: FadeOptions = {}): Promise<void> => {
  const {
    duration = 800, steps = 16, newline = true,
    color: baseColor = { r: 255, g: 255, b: 255 },
    signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkipColor(signal, reducedMotion)) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  const base = resolveRgb(baseColor);
  const n = safeSteps(steps);
  const interval = frameInterval(safeDuration(duration), n);

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  try {
    for (let i = 0; i <= n; i++) {
      if (isAborted(signal)) { aborted = true; break; }
      const t = i / n;
      const buf = createOutputBuffer()
        .push(cursor.save())
        .push(fgRgb(Math.round(base.r * t), Math.round(base.g * t), Math.round(base.b * t)))
        .push(text)
        .push(reset())
        .push(cursor.restore())
        .toString();
      await safeWriteAsync(buf);
      fireFrame(hooks, i);
      await sleep(interval, { signal });
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  FADE OUT
// ─────────────────────────────────────────────
export const fadeOut = async (text: string, opts: FadeOptions = {}): Promise<void> => {
  const {
    duration = 800, steps = 16, newline = true,
    color: baseColor = { r: 255, g: 255, b: 255 },
    signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkipColor(signal, reducedMotion)) {
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  const base = resolveRgb(baseColor);
  const n = safeSteps(steps);
  const interval = frameInterval(safeDuration(duration), n);

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  try {
    for (let i = n; i >= 0; i--) {
      if (isAborted(signal)) { aborted = true; break; }
      const t = i / n;
      const buf = createOutputBuffer()
        .push(cursor.save())
        .push(fgRgb(Math.round(base.r * t), Math.round(base.g * t), Math.round(base.b * t)))
        .push(text)
        .push(reset())
        .push(cursor.restore())
        .toString();
      await safeWriteAsync(buf);
      fireFrame(hooks, n - i);
      await sleep(interval, { signal });
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  SLIDE — re-reads terminal width per frame for resize awareness
// ─────────────────────────────────────────────
export const slide = async (text: string, opts: SlideOptions = {}): Promise<void> => {
  const {
    direction = 'left', duration = 400, newline = true,
    signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkip(signal, reducedMotion)) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  if (!text.length) {
    if (newline) writeln();
    fireDone(hooks, false);
    return;
  }

  const len = text.length;
  const steps = Math.min(Math.max(1, len), 40);
  const interval = frameInterval(safeDuration(duration), steps);

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  try {
    for (let i = 0; i <= steps; i++) {
      if (isAborted(signal)) { aborted = true; break; }
      const visible = Math.round((i / steps) * len);
      const slice = direction === 'left'
        ? text.slice(0, visible)
        : text.slice(len - visible);

      // Re-read terminal width each frame — resize-aware
      const termWidth = getTerminalWidth();
      const printable = slice.length > termWidth
        ? slice.slice(0, termWidth)
        : slice;

      const buf = createOutputBuffer()
        .push(cursor.save())
        .push(screen.clearRight())
        .push(printable)
        .push(cursor.restore())
        .toString();
      await safeWriteAsync(buf);
      fireFrame(hooks, i);
      await sleep(interval, { signal });
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  PULSE
// ─────────────────────────────────────────────
export const pulse = async (text: string, opts: PulseOptions = {}): Promise<void> => {
  const {
    times = 3, interval = 300,
    color1 = { r: 255, g: 255, b: 255 },
    color2 = { r: 100, g: 100, b: 100 },
    newline = true, signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkipColor(signal, reducedMotion)) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  const c1 = resolveRgb(color1);
  const c2 = resolveRgb(color2);
  const cycles = Math.max(1, Math.round(times));
  const halfInterval = Math.max(FRAME_MS, interval);

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  let frame = 0;
  try {
    for (let t = 0; t < cycles; t++) {
      if (isAborted(signal)) { aborted = true; break; }
      await safeWriteAsync(
        cursor.save() + fgRgb(c1.r, c1.g, c1.b) + text + reset() + cursor.restore(),
      );
      fireFrame(hooks, frame++);
      await sleep(halfInterval, { signal });
      if (isAborted(signal)) { aborted = true; break; }
      await safeWriteAsync(
        cursor.save() + fgRgb(c2.r, c2.g, c2.b) + text + reset() + cursor.restore(),
      );
      fireFrame(hooks, frame++);
      await sleep(halfInterval, { signal });
    }
    // Settle on color1 — uses safeWriteAsync now (was synchronous write)
    if (!aborted) {
      await safeWriteAsync(
        cursor.save() + fgRgb(c1.r, c1.g, c1.b) + text + reset() + cursor.restore(),
      );
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  WAVE — guards against empty text and short palettes
// ─────────────────────────────────────────────
export const wave = async (text: string, opts: WaveOptions = {}): Promise<void> => {
  const {
    duration = 2000, steps = 30,
    colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'],
    newline = true, signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkipColor(signal, reducedMotion)) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  if (!text.length) {
    if (newline) writeln();
    fireDone(hooks, false);
    return;
  }

  // Single color → render statically with that color (better UX than skip)
  if (!colors || colors.length === 0) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, false);
    return;
  }
  if (colors.length < 2) {
    const single = hexToRgb(colors[0] as string);
    safeWrite(fgRgb(single.r, single.g, single.b) + text + reset());
    if (newline) writeln();
    fireDone(hooks, false);
    return;
  }

  const palette = colors.map(hexToRgb);
  const n = safeSteps(steps);
  const interval = frameInterval(safeDuration(duration), n);

  // Cache lengths — used in inner hot loop
  const textLen = text.length;
  const paletteSize = palette.length;
  const paletteSizeMinusOne = paletteSize - 1;

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  try {
    for (let s = 0; s < n; s++) {
      if (isAborted(signal)) { aborted = true; break; }
      const buf = createOutputBuffer().push(cursor.save());
      for (let i = 0; i < textLen; i++) {
        const ch = text[i] as string;
        const phase = ((i + s) / textLen) * paletteSizeMinusOne;
        const idx = Math.floor(phase) % paletteSize;
        const next = (idx + 1) % paletteSize;
        const t = phase - Math.floor(phase);
        const a = palette[idx] as RGB;
        const b = palette[next] as RGB;
        const c = lerpColor(a, b, t);
        buf.push(fgRgb(c.r, c.g, c.b)).push(ch);
      }
      buf.push(reset()).push(cursor.restore());
      await safeWriteAsync(buf.toString());
      fireFrame(hooks, s);
      await sleep(interval, { signal });
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  GLITCH — frame-counted, deterministic timing
// ─────────────────────────────────────────────
export const glitch = async (text: string, opts: GlitchOptions = {}): Promise<void> => {
  const {
    duration = 800, intensity = 3, newline = true,
    signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkip(signal, reducedMotion)) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  const safeIntensity = Math.max(0, Math.min(10, intensity));
  const glitchChars = '!@#$%^&*[]{}|<>/\\~`\xb1\xa7';
  const frames = totalFrames(safeDuration(duration));

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  try {
    for (let f = 0; f < frames; f++) {
      if (isAborted(signal)) { aborted = true; break; }
      const out = [...text].map((ch) => {
        if (ch === ' ') return ch;
        return Math.random() < safeIntensity / 10
          ? glitchChars[Math.floor(Math.random() * glitchChars.length)]
          : ch;
      }).join('');
      await safeWriteAsync(
        cursor.save() + screen.clearRight() + out + cursor.restore(),
      );
      fireFrame(hooks, f);
      await sleep(FRAME_MS, { signal });
    }
    // Settle on the original text
    if (!aborted) {
      await safeWriteAsync(cursor.save() + screen.clearRight() + text + cursor.restore());
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  REVEAL
//
//  Steps now scales with both `duration` and text length so longer
//  text gets more visible scrambling. Custom `steps` overrides.
// ─────────────────────────────────────────────
export const reveal = async (text: string, opts: RevealOptions = {}): Promise<void> => {
  const {
    duration = 1000,
    charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    newline = true, signal, reducedMotion = false,
    steps,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (shouldSkip(signal, reducedMotion)) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  if (!text.length) {
    if (newline) writeln();
    fireDone(hooks, false);
    return;
  }

  const len = text.length;
  // Default: scale with text length so each char gets ~2 scramble frames,
  // capped between 10 and 60 frames for sanity.
  const n = safeSteps(steps ?? Math.min(60, Math.max(10, len * 2)));
  const delay = frameInterval(safeDuration(duration), n);
  const solved = new Array(len).fill(false) as boolean[];

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  try {
    for (let step = 0; step < n; step++) {
      if (isAborted(signal)) { aborted = true; break; }
      const target = Math.round((step / n) * len);
      for (let i = 0; i < target; i++) solved[i] = true;

      const out = [...text].map((ch, i) => {
        if (solved[i] || ch === ' ') return ch;
        /* istanbul ignore next — `?? ch` defensive: Math.floor(random*length) always in bounds */
        return charset[Math.floor(Math.random() * charset.length)] ?? ch;
      }).join('');

      await safeWriteAsync(
        cursor.save() + screen.clearRight() + out + cursor.restore(),
      );
      fireFrame(hooks, step);
      await sleep(delay, { signal });
    }
    if (!aborted) {
      await safeWriteAsync(cursor.save() + screen.clearRight() + text + cursor.restore());
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};


// ─────────────────────────────────────────────
//  v1.3.4 — SHAKE
//
//  Horizontal "tremble" effect — useful for error feedback or attention
//  grabbing. The text shifts left/right by a few characters per frame.
// ─────────────────────────────────────────────

export const shake = async (text: string, opts: ShakeOptions = {}): Promise<void> => {
  const {
    times = 5, intensity = 2, interval = 50,
    newline = true, signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  if (reducedMotion || isAborted(signal)) {
    safeWrite(text);
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  const safeText = typeof text === 'string' ? text : '';
  const safeTimes = Math.max(1, Math.round(times));
  const safeIntensity = Math.max(1, Math.round(intensity));
  const safeInterval = Math.max(FRAME_MS, interval);

  // Shake pattern: 0 (rest), +offset (right), 0, -offset (left)
  const pattern = [0, safeIntensity, 0, -safeIntensity];

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  let frame = 0;
  try {
    for (let cycle = 0; cycle < safeTimes; cycle++) {
      for (const offset of pattern) {
        if (isAborted(signal)) { aborted = true; break; }
        const prefix = offset > 0 ? ' '.repeat(offset) : '';
        // For negative offsets we still leave the cursor in column 0 — the
        // visible result is the text shifted right or starting at column 0.
        // True left-shift isn't possible without erasing prior content, so we
        // approximate by reducing leading space.
        await safeWriteAsync(
          cursor.save() + screen.clearLine() + '\r' + prefix + safeText + cursor.restore(),
        );
        fireFrame(hooks, frame++);
        await sleep(safeInterval, { signal });
      }
      if (aborted) break;
    }
    // Settle: clear the shake-prefix and render text at column 0
    if (!aborted) {
      await safeWriteAsync(cursor.save() + screen.clearLine() + '\r' + safeText + cursor.restore());
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};

// ─────────────────────────────────────────────
//  v1.3.4 — COUNT UP
//
//  Animate a number from `from` to `to`. Useful for stat counters,
//  loading percentages, etc. Supports optional `format` for prefixes/
//  suffixes (e.g. "$", "%", "ms").
// ─────────────────────────────────────────────

export const countUp = async (
  from: number,
  to: number,
  opts: CountUpOptions = {},
): Promise<void> => {
  const {
    duration = 1500, steps = 60, decimals = 0,
    format = (n: number) => n.toString(),
    easing = (t: number) => t,
    newline = true, signal, reducedMotion = false,
    onFrame, onDone, onAbort,
  } = opts;
  const hooks: AnimationHooks = { onFrame, onDone, onAbort };

  const safeFrom = Number.isFinite(from) ? from : 0;
  const safeTo = Number.isFinite(to) ? to : 0;
  const safeDecimals = Math.max(0, Math.min(20, Math.floor(decimals)));
  const safeFormat = typeof format === 'function' ? format : (n: number) => n.toString();
  const safeEasing = typeof easing === 'function' ? easing : (t: number) => t;

  // Reduced motion / aborted: just print final value
  if (reducedMotion || isAborted(signal)) {
    safeWrite(safeFormat(parseFloat(safeTo.toFixed(safeDecimals))));
    if (newline) writeln();
    fireDone(hooks, isAborted(signal));
    return;
  }

  const safeSteps = Math.max(1, Math.round(steps));
  const interval = Math.max(FRAME_MS, Math.round(duration / safeSteps));

  registerCrashHandlers();
  hideCursorSafe();
  let aborted = false;
  let frame = 0;
  try {
    for (let i = 0; i <= safeSteps; i++) {
      if (isAborted(signal)) { aborted = true; break; }
      const t = i / safeSteps;
      const eased = safeEasing(Math.max(0, Math.min(1, t)));
      const current = safeFrom + (safeTo - safeFrom) * eased;
      const rounded = parseFloat(current.toFixed(safeDecimals));
      let display: string;
      try { display = safeFormat(rounded); }
      catch { display = String(rounded); }
      await safeWriteAsync(
        cursor.save() + screen.clearLine() + '\r' + display + cursor.restore(),
      );
      fireFrame(hooks, frame++);
      if (i < safeSteps) await sleep(interval, { signal });
    }
    // Settle on exact final value (ensures no rounding drift)
    if (!aborted) {
      const final = parseFloat(safeTo.toFixed(safeDecimals));
      let display: string;
      try { display = safeFormat(final); }
      catch { display = String(final); }
      await safeWriteAsync(
        cursor.save() + screen.clearLine() + '\r' + display + cursor.restore(),
      );
    }
  } finally {
    showCursorSafe();
    if (newline) writeln();
    fireDone(hooks, aborted);
  }
};
