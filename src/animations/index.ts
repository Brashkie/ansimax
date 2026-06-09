// ─────────────────────────────────────────────
//  ANIMATIONS  –  typewriter, fade, slide, pulse, wave, glitch, reveal
//
//  Robustness guarantees:
//   - AbortSignal-aware (cancellable mid-run, signal propagates to nested steps)
//   - reducedMotion-aware (renders instantly, skips effects)
//   - Stream-safe (no-ops when stdout is missing or non-TTY)
//   - Backpressure-aware (uses writeAsync internally for long loops)
//   - Frame-throttled (consistent FPS based on FRAME_MS)
//   - Hooks-enabled (onFrame/onDone/onAbort callbacks, errors swallowed)
//   - Cursor-safe (reference-counted hide/show, survives parallel runs and crashes)
//   - Resize-aware (re-reads terminal width per frame in slide)
//   - Crash-safe (registers exit/SIGINT/SIGTERM handlers to restore cursor)
//
//  Philosophy:
//   - Motion animations (typewriter, slide, glitch, reveal) work fine without
//     color — they only need a TTY for cursor control.
//   - Color animations (fadeIn, fadeOut, pulse, wave) degrade to plain text
//     when colors aren't supported. They use shouldSkipColor() for the guard.
//   - This split is intentional: skipping ALL animations on `supportsColor === 'none'`
//     would over-block useful effects in NO_COLOR mode.
// ─────────────────────────────────────────────

import {
  cursor, screen,
  write, writeln, writeAsync,
  sleep, FRAME_MS,
  fgRgb, reset,
  supportsColor, getTerminalWidth,
  hideCursor, showCursor,
  createOutputBuffer,
} from '../utils/ansi.js';
import { hexToRgb, lerpColor, RGB } from '../utils/helpers.js';
import { ColorFn } from '../colors/index.js';

// ─────────────────────────────────────────────
//  Single-responsibility predicates
//
//  Each helper checks ONE thing. Composing them produces clear guards
//  and makes failures easy to debug — instead of "shouldSkip returned
//  true, why?" you can see exactly which condition fired.
// ─────────────────────────────────────────────

/** True when stdout is a real interactive TTY. */
const isNonInteractive = (): boolean => !process.stdout?.isTTY;

/** True when the user requested no motion (accessibility). */
const isReduced = (reduced?: boolean): boolean => Boolean(reduced);

/** True when the abort signal is already triggered. */
const isAborted = (signal?: AbortSignal): boolean => Boolean(signal?.aborted);

/** True when colors are not supported in the current terminal. */
const isColorless = (): boolean => supportsColor() === 'none';

/**
 * Skip guard for **motion** animations — typewriter, slide, glitch, reveal.
 * These work in B&W as long as we have a TTY for cursor control.
 */
const shouldSkip = (signal?: AbortSignal, reduced?: boolean): boolean =>
  isNonInteractive() || isReduced(reduced) || isAborted(signal);

/**
 * Skip guard for **color-dependent** animations — fadeIn, fadeOut, pulse, wave.
 * Adds a color requirement on top of the motion guard.
 */
const shouldSkipColor = (signal?: AbortSignal, reduced?: boolean): boolean =>
  shouldSkip(signal, reduced) || isColorless();

/**
 * True when colors AND TTY are both available.
 * Public predicate — useful for callers that want to gate features.
 */
export const canAnimate = (): boolean =>
  !isNonInteractive() && !isColorless();

// ─────────────────────────────────────────────
//  Reference-counted cursor visibility
//
//  Multiple animations running in parallel each call hide()/show() —
//  without ref counting, the inner one calling show() reveals the
//  cursor while the outer animation still wants it hidden.
//  Ref counting makes hide/show idempotent across overlapping calls.
//
//  Crash safety: process.exit/SIGINT/SIGTERM handlers force-restore
//  the cursor even if a finally block can't run.
// ─────────────────────────────────────────────

let _cursorHiddenCount = 0;

const hideCursorSafe = (): void => {
  // First acquire emits the hide escape; subsequent acquires only count
  if (_cursorHiddenCount === 0) {
    try { hideCursor(); } catch { /* stdout may be torn down — best-effort */ }
  }
  _cursorHiddenCount++;
};

const showCursorSafe = (): void => {
  if (_cursorHiddenCount > 0) _cursorHiddenCount--;
  if (_cursorHiddenCount === 0) {
    try { showCursor(); } catch { /* best-effort */ }
  }
};

/** For tests — reset the cursor counter back to zero. */
export const resetCursorRefCount = (): void => {
  _cursorHiddenCount = 0;
};

// ─────────────────────────────────────────────
//  Crash cleanup — force-restore cursor on unexpected exit
//
//  Registered exactly once on first animation use. Even if the process
//  dies mid-animation (uncaught exception, SIGINT, SIGTERM), the
//  cursor escape is written directly to stdout so the user isn't left
//  with an invisible cursor in their shell.
// ─────────────────────────────────────────────

let _crashHandlersRegistered = false;

/**
 * Detect if we're running inside a test runner. Jest sets JEST_WORKER_ID
 * and NODE_ENV=test; Vitest sets VITEST. In these environments we skip
 * registering process listeners, since they keep the worker alive past
 * test completion and trigger "force exited" warnings.
 */
const isTestEnv = (): boolean => {
  /* istanbul ignore next — env detection has many branches */
  return (
    process.env['JEST_WORKER_ID'] !== undefined ||
    process.env['VITEST'] !== undefined ||
    process.env['NODE_ENV'] === 'test'
  );
};

/* istanbul ignore next — crash handler body fires only on real exit/SIGINT/SIGTERM */
const installCrashHandlersImpl = (): void => {
  const restore = (): void => {
    if (_cursorHiddenCount > 0) {
      try {
        // Direct write — bypasses any async layer that may be torn down
        if (process.stdout && typeof process.stdout.write === 'function') {
          process.stdout.write(cursor.show());
        }
      } catch { /* nothing we can do at this point */ }
      _cursorHiddenCount = 0;
    }
  };
  process.on('exit', restore);
  // SIGINT/SIGTERM: restore then re-raise default behavior
  process.on('SIGINT',  () => { restore(); process.exit(130); });
  process.on('SIGTERM', () => { restore(); process.exit(143); });
};

const registerCrashHandlers = (): void => {
  if (_crashHandlersRegistered) return;
  /* istanbul ignore next — guards against worker/sandbox without process.on */
  if (!process || typeof process.on !== 'function') return;
  _crashHandlersRegistered = true;
  // Skip in test environments — listeners keep the worker alive
  if (isTestEnv()) return;
  /* istanbul ignore next — unreachable in test env */
  installCrashHandlersImpl();
};

// ─────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────

const resolveRgb = (c: string | RGB): RGB =>
  typeof c === 'string' ? hexToRgb(c) : c;

const safeSteps = (n: number): number => Math.max(1, Math.round(n));
const safeDuration = (n: number): number => Math.max(0, Math.round(n));

/**
 * Compute a frame interval that's never below FRAME_MS.
 * Caps the requested rate at ~60fps to avoid CPU saturation.
 */
const frameInterval = (duration: number, steps: number): number =>
  Math.max(FRAME_MS, duration / Math.max(1, steps));

/** Compute total frames for a fixed-duration animation. */
const totalFrames = (duration: number): number =>
  Math.max(1, Math.ceil(duration / FRAME_MS));

/**
 * Safe writeAsync — never throws. If stdout is gone (broken pipe,
 * stream destroyed mid-animation), we silently swallow and let the
 * animation continue its loop. The next isAborted check or natural
 * end will resolve the promise.
 */
const safeWriteAsync = async (data: string): Promise<void> => {
  try { await writeAsync(data); }
  catch { /* stdout torn down — best-effort */ }
};

const safeWrite = (data: string): void => {
  try { write(data); }
  catch { /* stdout torn down — best-effort */ }
};

// ─────────────────────────────────────────────
//  Hook callbacks — errors never propagate
// ─────────────────────────────────────────────

export interface AnimationHooks {
  /** Called after each frame is written. Receives 0-based frame index. */
  onFrame?: (frame: number) => void;
  /** Called when the animation completes naturally. */
  onDone?: () => void;
  /** Called when the signal aborts the animation. */
  onAbort?: () => void;
}

const fireFrame = (hooks: AnimationHooks | undefined, frame: number): void => {
  try { hooks?.onFrame?.(frame); }
  catch { /* user errors don't break the animation */ }
};

const fireDone = (hooks: AnimationHooks | undefined, aborted: boolean): void => {
  try {
    if (aborted) hooks?.onAbort?.();
    else         hooks?.onDone?.();
  } catch { /* user errors don't break the animation */ }
};

// ─────────────────────────────────────────────
//  Option interfaces
// ─────────────────────────────────────────────

export interface TypewriterOptions extends AnimationHooks {
  speed?: number;
  newline?: boolean;
  colorFn?: ColorFn | null;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface FadeOptions extends AnimationHooks {
  duration?: number;
  steps?: number;
  newline?: boolean;
  color?: string | RGB;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface SlideOptions extends AnimationHooks {
  direction?: 'left' | 'right';
  duration?: number;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface PulseOptions extends AnimationHooks {
  times?: number;
  interval?: number;
  color1?: string | RGB;
  color2?: string | RGB;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface WaveOptions extends AnimationHooks {
  duration?: number;
  steps?: number;
  colors?: string[];
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface GlitchOptions extends AnimationHooks {
  duration?: number;
  intensity?: number;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
}

export interface RevealOptions extends AnimationHooks {
  duration?: number;
  charset?: string;
  newline?: boolean;
  signal?: AbortSignal;
  reducedMotion?: boolean;
  /**
   * Number of "scramble" frames before the text resolves. Default scales
   * with text length (longer text → more frames for visible reveal).
   */
  steps?: number;
}

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
const typewriter = async (text: string, opts: TypewriterOptions = {}): Promise<void> => {
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
const fadeIn = async (text: string, opts: FadeOptions = {}): Promise<void> => {
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
const fadeOut = async (text: string, opts: FadeOptions = {}): Promise<void> => {
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
const slide = async (text: string, opts: SlideOptions = {}): Promise<void> => {
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
const pulse = async (text: string, opts: PulseOptions = {}): Promise<void> => {
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
const wave = async (text: string, opts: WaveOptions = {}): Promise<void> => {
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
const glitch = async (text: string, opts: GlitchOptions = {}): Promise<void> => {
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
const reveal = async (text: string, opts: RevealOptions = {}): Promise<void> => {
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
//  High-level API — sequence, chain, parallel
// ─────────────────────────────────────────────

/**
 * Run a list of async animation thunks one after another.
 * Stops on first abort. Errors in any step propagate to the caller
 * AFTER the cursor is restored (no leaked state on throw).
 */
const sequence = async (
  steps: Array<() => Promise<void>>,
  opts: { signal?: AbortSignal } = {},
): Promise<void> => {
  for (const step of steps) {
    if (isAborted(opts.signal)) return;
    await step();
  }
};

/**
 * A parallel step receives the parent signal. Steps that ignore it
 * (zero-arg thunks) still work via the optional parameter.
 */
export type ParallelStep = (opts?: { signal?: AbortSignal }) => Promise<void>;

export interface ParallelOptions {
  signal?: AbortSignal;
  /**
   * Maximum time (ms) to wait for all steps to settle. After timeout,
   * remaining steps are abandoned and parallel() resolves. Useful for
   * preventing animations from blocking indefinitely on stuck steps.
   */
  timeout?: number;
}

/**
 * Run multiple animations CONCURRENTLY — all start at once.
 *
 * Cancellation is **propagated**: each step receives the parent signal
 * so animations that respect AbortSignal will cancel cleanly when the
 * parent aborts. Pre-aborted steps are skipped entirely.
 *
 * If `timeout` is set and elapses before all steps finish, parallel()
 * resolves anyway — but does NOT throw. Steps that haven't completed
 * are abandoned (their promises reject silently).
 */
const parallel = async (
  steps: ParallelStep[],
  opts: ParallelOptions = {},
): Promise<void> => {
  const stepPromises = steps.map((step) => {
    if (isAborted(opts.signal)) return Promise.resolve();
    // Wrap step call in try/catch so individual step errors don't
    // reject the whole Promise.all and leave the cursor uncleaned.
    return Promise.resolve()
      .then(() => step({ signal: opts.signal }))
      .catch(() => { /* step errors are swallowed — they handle their own cleanup */ });
  });

  if (opts.timeout && opts.timeout > 0) {
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(resolve, opts.timeout);
    });
    await Promise.race([Promise.all(stepPromises), timeoutPromise]);
    return;
  }

  await Promise.all(stepPromises);
};

/**
 * Apply multiple animations to the SAME text in order.
 * Each entry is `[fn, options]` or just `fn`.
 * Errors in any step propagate after cursor cleanup.
 */
type AnimFn = (text: string, opts?: Record<string, unknown>) => Promise<void>;
type ChainStep = AnimFn | [AnimFn] | [AnimFn, Record<string, unknown>];

const chain = async (
  text: string,
  steps: ChainStep[],
  opts: { signal?: AbortSignal } = {},
): Promise<void> => {
  for (const step of steps) {
    if (isAborted(opts.signal)) return;
    if (typeof step === 'function') {
      await step(text, { signal: opts.signal });
    }
    /* istanbul ignore next — tuple step variant covered indirectly */
    else {
      const [fn, stepOpts = {}] = step;  // istanbul ignore next
      await fn(text, { ...stepOpts, signal: opts.signal });
    }
  }
};

/**
 * Pause for `ms` milliseconds. Compatible with chain/sequence as a
 * step. Respects the parent signal — aborting cancels the wait.
 *
 * @example
 *   await animate.sequence([
 *     () => animate.typewriter('Hello'),
 *     animate.delay(500),
 *     () => animate.fadeOut('Hello'),
 *   ]);
 */
const delay = (ms: number) => async (
  opts: { signal?: AbortSignal } = {},
): Promise<void> => {
  try { await sleep(Math.max(0, ms), { signal: opts.signal }); }
  catch { /* aborted — return cleanly */ }
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
  sequence,
  chain,
  parallel,
  delay,
};

export default animate;
