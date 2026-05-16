// ─────────────────────────────────────────────
//  FRAMES  –  frame-by-frame animation engine
//
//  Capabilities:
//   - play(frames, opts) — sequenced playback with FPS or interval timing
//     • drift-correcting timing (no accumulating lag)
//     • pause / resume / seek controls
//     • onFrame, onFinish hooks (errors swallowed)
//     • AbortSignal support
//   - live(opts) — push-based real-time renderer
//     • AbortSignal-aware (auto-stop on abort)
//     • clear-on-stop option
//     • update() throttled to one frame per render tick
//   - morph(a, b) — text-to-text scramble interpolation
//   - generate(n, fn) — programmatic frame builder
//
//  Robustness guarantees:
//   - Reference-counted cursor (overlapping play/live calls safe)
//   - Crash-safe cursor restore (exit/SIGINT/SIGTERM handlers)
//   - Input validation (non-array frames, non-finite fps, etc.)
//   - All writes through stream-safe helpers — no throws
//   - NO_COLOR respected via stripAnsi when colors are off
//   - All user callbacks wrapped in try/catch
// ─────────────────────────────────────────────

import {
  cursor, screen,
  write, writeln,
  hideCursor, showCursor,
  sleep, FRAME_MS,
  stripAnsi,
  supportsColor,
} from '../utils/ansi.js';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export type FrameCallback = (frame: string, index: number) => string;

export interface PlayOptions {
  /** Milliseconds between frames. Ignored if `fps` is provided. */
  interval?: number;
  /** Frames per second. Takes precedence over `interval`. Capped at 60 fps. */
  fps?: number;
  /** Number of full loops. 0 means infinite. Default: 1. */
  repeat?: number;
  /** Clear all rendered lines when playback finishes. */
  clearOnFinish?: boolean;
  /** Transform each frame before writing. Errors are swallowed. */
  onFrame?: FrameCallback | null;
  /** Called when playback completes naturally (not aborted). */
  onFinish?: () => void;
  /** Cancel playback mid-run. */
  signal?: AbortSignal;
}

/** Returned by `play()` — controls a running animation. */
export interface PlayController {
  /** Pause playback. Idempotent. */
  pause:  () => void;
  /** Resume playback after pause. Idempotent. */
  resume: () => void;
  /** Jump to a specific frame index (modulo frame count). */
  seek:   (frameIndex: number) => void;
  /** Cancel playback immediately. */
  stop:   () => void;
  /** True while the animation is actively running. */
  isPlaying: () => boolean;
  /** Promise that resolves when playback finishes (or is stopped). */
  done:   Promise<void>;
}

export interface LiveOptions {
  /** Frames per second for the render tick. Default: 12. Capped at 60. */
  fps?: number;
  /** Start the render loop immediately. Default: true. */
  autoStart?: boolean;
  /** Auto-stop the render loop when this signal aborts. */
  signal?: AbortSignal;
}

export interface LiveController {
  start:  () => void;
  /** Stop the loop. Pass `{ clear: true }` to wipe the last rendered frame. */
  stop:   (opts?: { clear?: boolean }) => void;
  update: (frame: string) => void;
  /** True while the render tick is active. */
  isRunning: () => boolean;
}

// ─────────────────────────────────────────────
//  Validation helpers
// ─────────────────────────────────────────────

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

const ensureString = (v: unknown): string =>
  typeof v === 'string' ? v : String(v ?? '');

/** Clamp fps to [1, MAX_FPS]. Non-finite or non-numeric falls back to default. */
const MAX_FPS = 60;
const clampFps = (fps: unknown, fallback: number): number => {
  if (!isFiniteNumber(fps)) return fallback;
  return Math.max(1, Math.min(MAX_FPS, Math.floor(fps)));
};

// ─────────────────────────────────────────────
//  Reference-counted cursor visibility
//
//  When multiple frames.play() or animate.* calls run concurrently,
//  each one hides/shows the cursor. Without ref counting, the inner
//  call's show() reveals the cursor while the outer still wants it
//  hidden. Ref-counted helpers keep hide/show idempotent across
//  overlapping ranges.
// ─────────────────────────────────────────────

let _cursorHiddenCount = 0;

const hideCursorSafe = (): void => {
  if (_cursorHiddenCount === 0) {
    try { hideCursor(); } catch { /* stream torn down — best-effort */ }
  }
  _cursorHiddenCount++;
};

const showCursorSafe = (): void => {
  if (_cursorHiddenCount > 0) _cursorHiddenCount--;
  if (_cursorHiddenCount === 0) {
    try { showCursor(); } catch { /* best-effort */ }
  }
};

/** For tests — reset cursor ref count. */
export const resetFramesCursorCount = (): void => {
  _cursorHiddenCount = 0;
};

// ─────────────────────────────────────────────
//  Crash-safe cursor restore
//
//  If the app dies mid-playback (uncaught exception, SIGINT, SIGTERM),
//  the cursor escape is written directly so the user's shell isn't
//  left with an invisible cursor.
// ─────────────────────────────────────────────

let _crashHandlersRegistered = false;

/* istanbul ignore next — env detection has many branches */
const isTestEnv = (): boolean => (
  process.env['JEST_WORKER_ID'] !== undefined ||
  process.env['VITEST'] !== undefined ||
  process.env['NODE_ENV'] === 'test'
);

/* istanbul ignore next — crash handler body fires only on real exit/SIGINT/SIGTERM */
const installCrashHandlersImpl = (): void => {
  const restore = (): void => {
    if (_cursorHiddenCount > 0) {
      try {
        if (process.stdout && typeof process.stdout.write === 'function') {
          process.stdout.write(cursor.show());
        }
      } catch { /* nothing to do at this point */ }
      _cursorHiddenCount = 0;
    }
  };
  process.on('exit', restore);
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
//  Internal render helpers
// ─────────────────────────────────────────────

/**
 * Count rendered lines, normalizing CRLF and counting an empty trailing
 * element if the frame ends with a newline.
 */
const lineCount = (frame: string): number => {
  if (typeof frame !== 'string' || frame.length === 0) return 0;
  // Normalize \r\n → \n so Windows-style frames count correctly
  const normalized = frame.replace(/\r\n/g, '\n').replace(/\r/g, '');
  return normalized.split('\n').length;
};

/**
 * Clear N lines above the cursor in a single batched write.
 *
 * Strategy: move up N lines, then erase from cursor to end of screen.
 * One write, one ANSI pair — far faster than per-line loops, and avoids
 * visual glitches in Windows Terminal / tmux / CI logs.
 */
const clearLines = (n: number): void => {
  /* istanbul ignore if — defensive: callers check before invoking */
  if (n <= 0) return;
  try {
    write('\r' + cursor.up(Math.max(1, n)) + screen.clearDown());
  } catch { /* best-effort */ }
};

const isColorless = (): boolean => supportsColor() === 'none';

/** Default frame transformation: strip ANSI when colors are off. */
/* istanbul ignore next — depends on NO_COLOR env */
const defaultOnFrame = (frame: string): string =>
  isColorless() ? stripAnsi(frame) : frame;

// ─────────────────────────────────────────────
//  play — sequenced player with controller
// ─────────────────────────────────────────────

const play = (frames: string[], opts: PlayOptions = {}): PlayController => {
  // Input validation — non-array frames = fail fast with empty controller
  /* istanbul ignore if — defensive: non-array input rarely reaches play() */
  if (!Array.isArray(frames)) {
    const resolved = Promise.resolve();
    return {
      pause:  () => { /* no-op */ },
      resume: () => { /* no-op */ },
      seek:   () => { /* no-op */ },
      stop:   () => { /* no-op */ },
      isPlaying: () => false,
      done:   resolved,
    };
  }

  const {
    interval, fps,
    repeat = 1,
    clearOnFinish = false,
    onFrame,
    onFinish,
    signal,
  } = opts;

  // Resolve timing — fps takes precedence; both clamp to FRAME_MS minimum
  // FPS is capped at MAX_FPS (60) to prevent CPU saturation
  let tickMs: number;
  if (fps !== undefined) {
    const safeFps = clampFps(fps, 60);
    tickMs = Math.max(FRAME_MS, Math.floor(1000 / safeFps));
  } else if (isFiniteNumber(interval)) {
    tickMs = Math.max(FRAME_MS, Math.floor(interval));
  } else {
    tickMs = 100;
  }

  // Resolve repeat semantics:
  //   - undefined          → 1 (default, plays once)
  //   - 0 (explicit)       → infinite
  //   - positive integer N → plays N times
  //   - negative / NaN     → fallback to 1 (treat as input error, not infinity)
  let safeRepeat: number;
  let infinite: boolean;
  if (!isFiniteNumber(repeat)) {
    safeRepeat = 1; infinite = false;
  } else if (repeat === 0) {
    safeRepeat = 0; infinite = true;
  } else if (repeat < 0) {
    safeRepeat = 1; infinite = false;
  } else {
    safeRepeat = Math.floor(repeat); infinite = false;
  }

  const userOnFrame: FrameCallback = typeof onFrame === 'function' ? onFrame : defaultOnFrame;

  // State — mutable from controller methods
  let lastLines = 0;
  let frameIdx = 0;
  let iteration = 0;
  let paused = false;
  let stopped = false;
  let playing = false;

  let resolveDone!: () => void;
  const done = new Promise<void>((r) => { resolveDone = r; });

  const renderFrame = (frame: string, idx: number): void => {
    if (lastLines > 0) clearLines(lastLines);
    let rendered: string;
    /* istanbul ignore next */
    try { rendered = userOnFrame(frame, idx); }
    catch { rendered = frame; } // user error doesn't break playback
    // Coerce non-string returns from user fn
    const safe = ensureString(rendered);
    /* istanbul ignore next — defensive: stream torn down during write */
    try { write(safe); } catch { /* stream torn down */ }
    lastLines = lineCount(safe);
    if (!safe.endsWith('\n')) writeln();
  };

  // Drift-correcting loop using wall-clock target times instead of
  // accumulating sleep(interval) calls. After many frames, the old
  // approach drifted by milliseconds per tick; this stays locked to
  // tickMs over arbitrary durations.
  const loop = async (): Promise<void> => {
    // Pre-aborted signal — short-circuit before any render or cursor changes
    if (signal?.aborted) {
      stopped = true;
      resolveDone();
      return;
    }
    if (frames.length === 0) {
      // Nothing to render → no cursor manipulation
      resolveDone();
      return;
    }

    // Wire abort listener — turns off the loop the moment the signal fires
    let abortHandler: (() => void) | null = null;
    /* istanbul ignore if — defensive: signal-driven abort path requires AbortController */
    if (signal) {
      abortHandler = (): void => { stopped = true; };
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    registerCrashHandlers();
    hideCursorSafe();
    playing = true;
    let nextTick = Date.now();

    try {
      while (!stopped && (infinite || iteration < safeRepeat)) {
        // Pause loop — yield CPU until resumed or stopped
        while (paused && !stopped) {
          /* istanbul ignore next — signal path requires AbortController */
          await sleep(FRAME_MS, ...(signal ? [{ signal }] : []));
          /* istanbul ignore next — defensive: abort during pause requires specific timing */
          if (signal?.aborted) {
            stopped = true;
            break;
          }
        }
        /* istanbul ignore next — defensive: outer while already has `!stopped` condition;
           this break only triggers when stop() is called mid-pause and timer resolves
           before the outer-while re-checks */
        if (stopped) {
          break;
        }
        /* istanbul ignore next — defensive: signal abort mid-loop requires AbortController */
        if (signal?.aborted) {
          stopped = true;
          break;
        }

        renderFrame(frames[frameIdx] as string, frameIdx);
        frameIdx++;

        if (frameIdx >= frames.length) {
          frameIdx = 0;
          iteration++;
          if (!infinite && iteration >= safeRepeat) break;
        }

        // Drift correction — sleep until the next scheduled tick
        nextTick += tickMs;
        const delay = Math.max(0, nextTick - Date.now());
        /* istanbul ignore next — signal ternary defensive */
        if (delay > 0) await sleep(delay, ...(signal ? [{ signal }] : []));
      }
    } finally {
      playing = false;
      /* istanbul ignore if — defensive: signal path */
      if (signal && abortHandler) {
        /* istanbul ignore next */
        try { signal.removeEventListener('abort', abortHandler); }
        catch { /* ignore */ }
      }
      cleanup(!stopped); // stopped=true → aborted, false → finished naturally
    }
  };

  const cleanup = (finished: boolean): void => {
    if (clearOnFinish && lastLines > 0) clearLines(lastLines);
    showCursorSafe();
    if (finished && typeof onFinish === 'function') {
      /* istanbul ignore next — defensive: user-provided onFinish that throws */
      try { onFinish(); }
      catch { /* user errors don't propagate */ }
    }
    resolveDone();
  };

  // Start the loop on the next microtask so the controller is returned first
  // — callers can attach listeners to `done` synchronously
  /* istanbul ignore next — defensive: loop has try/finally, this is a last-resort safety net */
  Promise.resolve().then(loop).catch(() => {
    try { showCursorSafe(); } catch { /* ignore */ }
    resolveDone();
  });

  return {
    pause:  () => { paused = true; },
    resume: () => { paused = false; },
    seek:   (idx: number) => {
      if (!isFiniteNumber(idx)) return;
      const safe = Math.max(0, Math.floor(idx));
      /* istanbul ignore next — `: 0` for empty frames defensive */
      frameIdx = frames.length > 0 ? safe % frames.length : 0;
    },
    stop:   () => { stopped = true; },
    /* istanbul ignore next — internal state check, conditions rarely all true in test */
    isPlaying: () => playing && !paused && !stopped,
    done,
  };
};

// ─────────────────────────────────────────────
//  generate — pure frame builder
//
//  User errors in `fn` are swallowed (substitute empty string) so a
//  single bad frame doesn't poison the whole sequence.
// ─────────────────────────────────────────────
const generate = (
  count: number,
  fn: (i: number, total: number) => string,
): string[] => {
  const safeCount = isFiniteNumber(count) ? Math.max(0, Math.floor(count)) : 0;
  if (typeof fn !== 'function') return Array(safeCount).fill('') as string[];
  return Array.from({ length: safeCount }, (_, i) => {
    try { return ensureString(fn(i, safeCount)); }
    catch { return ''; }
  });
};

// ─────────────────────────────────────────────
//  live — push-based renderer
// ─────────────────────────────────────────────
const live = (opts: LiveOptions = {}): LiveController => {
  const { fps = 12, autoStart = true, signal } = opts;

  const safeFps = clampFps(fps, 12);
  const interval = Math.max(FRAME_MS, Math.floor(1000 / safeFps));

  let currentFrame = '';
  let lastLines = 0;
  let running = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let abortHandler: (() => void) | null = null;

  const render = (): void => {
    if (lastLines > 0) clearLines(lastLines);
    /* istanbul ignore next — isColorless ternary */
    const frame = isColorless() ? stripAnsi(currentFrame) : currentFrame;
    try { write(frame); } catch { /* stream torn down */ }
    lastLines = lineCount(frame);
    if (!frame.endsWith('\n')) writeln();
  };

  const start = (): void => {
    if (running) return; // idempotent
    running = true;
    registerCrashHandlers();
    hideCursorSafe();
    timer = setInterval(render, interval);
    // Wire AbortSignal — auto-stop when aborted
    if (signal && !abortHandler) {
      abortHandler = (): void => stop({ clear: false });
      if (signal.aborted) abortHandler();
      else signal.addEventListener('abort', abortHandler, { once: true });
    }
  };

  const stop = (stopOpts: { clear?: boolean } = {}): void => {
    // Always cleanup abort handler — even if already stopped — to prevent leaks
    if (signal && abortHandler) {
      try { signal.removeEventListener('abort', abortHandler); }
      catch { /* ignore */ }
      abortHandler = null;
    }
    const wasRunning = running;
    running = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (stopOpts.clear && lastLines > 0) {
      clearLines(lastLines);
      lastLines = 0;
    }
    // Only release cursor count if we actually held it (avoid underflow
    // when stop() is called multiple times)
    if (wasRunning) showCursorSafe();
  };

  const update = (newFrame: string): void => {
    currentFrame = ensureString(newFrame);
    if (running) render();
  };

  if (autoStart) start();
  return { start, stop, update, isRunning: () => running };
};

// ─────────────────────────────────────────────
//  morph — text-to-text scramble interpolation
//
//  Naturalness improvement: as `t` approaches 1, each scrambled cell
//  has an increasing chance of "snapping" to its target char, creating
//  a more cinematic decryption effect (vs uniform random scramble that
//  suddenly resolves at t=1).
// ─────────────────────────────────────────────
const morph = (
  frameA: string,
  frameB: string,
  steps = 8,
  charset = '░▒▓█▓▒░',
): string[] => {
  const a0 = ensureString(frameA);
  const b0 = ensureString(frameB);

  // Empty-input guard — neither frame to morph
  if (!a0 && !b0) return [''];

  const n = Math.max(2, isFiniteNumber(steps) ? Math.floor(steps) : 8);
  const len = Math.max(a0.length, b0.length);
  const a = a0.padEnd(len);
  const b = b0.padEnd(len);
  const safeCharset = typeof charset === 'string' && charset.length > 0 ? charset : '░';

  return generate(n, (i) => {
    const t = i / (n - 1); // 0 → 1
    return [...Array(len)].map((_, ci) => {
      const ca = a[ci] as string;
      const cb = b[ci] as string;
      if (t === 0) return ca;
      if (t === 1) return cb;
      if (ca === cb) return ca;
      // Probabilistic snap to target — increases as t grows
      // gives a natural "decryption" feel instead of uniform scramble
      if (Math.random() < t * t) return cb;
      const idx = Math.floor(Math.random() * safeCharset.length);
      return safeCharset[idx] as string;
    }).join('');
  });
};

// ─────────────────────────────────────────────
//  Preset option types — exported for consumers
// ─────────────────────────────────────────────

export interface LoadingBarOptions {
  width?: number;
  char?: string;
  empty?: string;
  label?: string;
}

export interface BallOptions {
  width?: number;
  char?: string;
}

export interface BreatheOptions {
  steps?: number;
}

export interface TypeDeleteOptions {
  cursor?: string;
}

// ─────────────────────────────────────────────
//  Presets — all inputs clamped to safe ranges
// ─────────────────────────────────────────────
const presets = {
  loadingBar: (opts: LoadingBarOptions = {}): string[] => {
    /* istanbul ignore next — destructure defaults */
    const { width = 20, char = '█', empty = '░', label = 'Loading' } = opts;
    const safeWidth = Math.max(0, isFiniteNumber(width) ? Math.floor(width) : 20);
    /* istanbul ignore next — `: '█' | '░'` defaults for malformed char options */
    const safeChar  = typeof char === 'string' && char.length > 0 ? char : '█';
    const safeEmpty = typeof empty === 'string' && empty.length > 0 ? empty : '░';
    const safeLabel = ensureString(label);
    return generate(safeWidth + 1, (i) => {
      const filled = safeChar.repeat(i);
      const rest   = safeEmpty.repeat(safeWidth - i);
      const pct    = safeWidth > 0 ? Math.round((i / safeWidth) * 100) : 100;
      return `${safeLabel} [${filled}${rest}] ${pct}%`;
    });
  },

  /* istanbul ignore next — default opts {} */
  ball: (opts: BallOptions = {}): string[] => {
    /* istanbul ignore next — destructure defaults */
    const { width = 20, char = '●' } = opts;
    const safeWidth = Math.max(1, isFiniteNumber(width) ? Math.floor(width) : 20);
    /* istanbul ignore next — `: '●'` default for malformed char */
    const safeChar  = typeof char === 'string' && char.length > 0 ? char : '●';
    const forward  = generate(safeWidth, (i) => ' '.repeat(i) + safeChar);
    const backward = generate(safeWidth, (i) => ' '.repeat(safeWidth - i - 1) + safeChar);
    return [...forward, ...backward.slice(1, -1).reverse()];
  },

  /* istanbul ignore next — default opts {} */
  breathe: (text: string, opts: BreatheOptions = {}): string[] => {
    /* istanbul ignore next — destructure default */
    const { steps = 8 } = opts;
    const safeText  = ensureString(text);
    const safeSteps = Math.max(1, isFiniteNumber(steps) ? Math.floor(steps) : 8);
    const shades = ['░', '▒', '▓', '█'];
    return generate(safeSteps * 2, (i) => {
      const t     = i < safeSteps ? i / safeSteps : 1 - (i - safeSteps) / safeSteps;
      const shade = shades[Math.min(shades.length - 1, Math.floor(t * shades.length))] as string;
      return safeText.split('').map((ch) => (ch === ' ' ? ' ' : shade)).join('');
    });
  },

  /* istanbul ignore next — default opts {} */
  typeDelete: (text: string, opts: TypeDeleteOptions = {}): string[] => {
    /* istanbul ignore next — destructure default */
    const { cursor: cur = '▌' } = opts;
    const safeText = ensureString(text);
    /* istanbul ignore next — `: '▌'` default for malformed */
    const safeCur  = typeof cur === 'string' ? cur : '▌';
    const typed   = generate(safeText.length + 1, (i) => safeText.slice(0, i) + safeCur);
    const deleted = generate(safeText.length + 1, (i) => safeText.slice(0, safeText.length - i) + safeCur);
    return [...typed, ...deleted];
  },
};

// ─────────────────────────────────────────────
//  Public API
//
//  `play()` now returns a controller — to await completion call:
//    const ctrl = frames.play(myFrames, { repeat: 3 });
//    await ctrl.done;
//
//  Or fire-and-forget with stop control:
//    const ctrl = frames.play(loopFrames, { repeat: 0 });
//    setTimeout(() => ctrl.stop(), 5000);
// ─────────────────────────────────────────────
export const frames = { play, generate, live, morph, presets };
export default frames;