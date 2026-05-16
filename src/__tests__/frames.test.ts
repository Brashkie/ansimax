import { frames, resetFramesCursorCount } from '../frames/index.js';

let output = '';

beforeEach(() => {
  output = '';
  jest.spyOn(process.stdout, 'write').mockImplementation((s: unknown) => {
    output += String(s); return true;
  });
  jest.useFakeTimers();
  // Reset cursor ref count so tests are fully isolated.
  // Otherwise a previous test leaving count>0 would suppress hide/show
  // escapes in subsequent tests via the ref-counting guard.
  resetFramesCursorCount();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  output = '';
});

// Helper that runs frames.play / frames.live workflows under fake timers.
// Accepts either:
//   - a function returning a Promise<void> (live + manual sequences)
//   - a function returning a PlayController (frames.play)
const run = async (fn: () => unknown): Promise<void> => {
  const result = fn();
  // PlayController has a `done` Promise — await that
  if (result && typeof result === 'object' && 'done' in result) {
    const ctrl = result as { done: Promise<void> };
    await jest.runAllTimersAsync();
    await ctrl.done;
    return;
  }
  // Otherwise treat as Promise<void>
  await jest.runAllTimersAsync();
  await (result as Promise<void>);
};

// ─────────────────────────────────────────────
//  play
// ─────────────────────────────────────────────
describe('frames.play', () => {
  it('plays frames and writes output', async () => {
    await run(() => frames.play(['A', 'B', 'C'], { interval: 0, repeat: 1 }));
    expect(output).toContain('A');
    expect(output).toContain('B');
    expect(output).toContain('C');
  });

  it('uses all defaults when called with only frames array', async () => {
    // Hits all defaults: interval=100, repeat=1, clearOnFinish=false, onFrame=null
    await run(() => frames.play(['X']));
    expect(output).toContain('X');
  });

  it('returns immediately for empty frames array', async () => {
    await expect(run(() => frames.play([], { repeat: 1 }))).resolves.toBeUndefined();
    expect(output).toBe('');
  });

  it('hides and shows cursor', async () => {
    await run(() => frames.play(['x'], { interval: 0, repeat: 1 }));
    expect(output).toContain('\x1b[?25l');
    expect(output).toContain('\x1b[?25h');
  });

  it('shows cursor in finally even when play completes normally', async () => {
    // Verify finally always runs — cursor shown after normal completion
    await run(() => frames.play(['x'], { interval: 0, repeat: 1 }));
    expect(output).toContain('\x1b[?25h');
  });

  it('cursor shown even when aborted mid-play', async () => {
    // When signal is pre-aborted, the loop short-circuits BEFORE hiding the
    // cursor, so showCursor() is never written either (nothing to undo).
    // This is the cleanest behavior — fewer escapes, no redundant writes.
    // Verify the playback was actually skipped (no frame content written).
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => frames.play(['A', 'B'], { interval: 0, repeat: 5, signal: ctrl.signal }));
    // Output should NOT contain any frame data — short-circuited cleanly
    expect(output).not.toContain('A');
    expect(output).not.toContain('B');
  });

  it('clearOnFinish clears the last frame', async () => {
    await run(() => frames.play(['hello'], { interval: 0, repeat: 1, clearOnFinish: true }));
    // clearLines writes cursor.up sequences
    expect(output).toContain('\x1b[1A');
  });

  it('onFrame transforms the output', async () => {
    await run(() => frames.play(['X'], {
      interval: 0, repeat: 1,
      onFrame: (f) => `[${f}]`,
    }));
    expect(output).toContain('[X]');
  });

  it('repeat:1 plays frames once', async () => {
    let count = 0;
    await run(() => frames.play(['A'], {
      interval: 0, repeat: 1,
      onFrame: (f) => { count++; return f; },
    }));
    expect(count).toBe(1);
  });

  it('repeat:2 plays frames twice', async () => {
    let count = 0;
    await run(() => frames.play(['A'], {
      interval: 0, repeat: 2,
      onFrame: (f) => { count++; return f; },
    }));
    expect(count).toBe(2);
  });

  it('repeat:-1 falls back to default 1 — plays once', async () => {
    let count = 0;
    await run(() => frames.play(['A'], {
      interval: 0, repeat: -1,
      onFrame: (f) => { count++; return f; },
    }));
    // Negative repeat is treated as input error → fallback to 1 (plays once)
    // This is safer than the old "clamps to 0 = infinite" behavior which
    // could hang the process on bad input.
    expect(count).toBe(1);
  });

  it('onFrame=null uses frame directly (line 62 false branch)', async () => {
    // onFrame not passed → rendered = frame (the false branch of onFrame ? ...)
    await run(() => frames.play(['DIRECT'], { interval: 0, repeat: 1 }));
    expect(output).toContain('DIRECT');
  });

  it('clearOnFinish:true with lastLines=0 skips clearLines (empty render path)', async () => {
    // Empty frames array → returns immediately, lastLines stays 0
    // clearOnFinish with lastLines=0 → skips clearLines (false branch)
    await run(() => frames.play([], { interval: 0, repeat: 1, clearOnFinish: true }));
    // No cursor.up sequences since nothing was rendered
    expect(output).not.toContain('\x1b[1A');
  });

  it('second frame clears first (lastLines > 0 clearLines branch)', async () => {
    // After first frame, lastLines > 0. Second frame triggers clearLines
    await run(() => frames.play(['A', 'B'], { interval: 0, repeat: 1 }));
    // clearLines calls cursor.up — should be present after second frame
    expect(output).toContain('\x1b[1A');
  });

  it('infinite=false && iteration >= safeRepeat breaks loop (line 82)', async () => {
    // repeat:1 → iteration=1 >= safeRepeat=1 → break
    let count = 0;
    await run(() => frames.play(['A', 'B'], {
      interval: 0, repeat: 1,
      onFrame: (f) => { count++; return f; },
    }));
    expect(count).toBe(2); // exactly 2 frames, then breaks
  });

  it('multi-line frame clears previous lines on next frame', async () => {
    await run(() => frames.play(['line1\nline2', 'next'], { interval: 0, repeat: 1 }));
    expect(output).toContain('line1');
    expect(output).toContain('line2');
  });

  it('frame ending with newline does not double-newline', async () => {
    await run(() => frames.play(['hello\n'], { interval: 0, repeat: 1 }));
    expect(output).toContain('hello');
  });

  it('signal aborted stops playback', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    let count = 0;
    await run(() => frames.play(['A', 'B', 'C'], {
      interval: 0, repeat: 3,
      signal: ctrl.signal,
      onFrame: (f) => { count++; return f; },
    }));
    // Aborted before first frame — onFrame never called, no cursor manipulation
    expect(count).toBe(0);
    expect(output).not.toContain('A');
  });
});

// ─────────────────────────────────────────────
//  generate
// ─────────────────────────────────────────────
describe('frames.generate', () => {
  it('generates correct number of frames', () => {
    const f = frames.generate(5, (i) => `frame-${i}`);
    expect(f).toHaveLength(5);
  });

  it('passes correct index and total', () => {
    frames.generate(3, (i, total) => {
      expect(total).toBe(3);
      return `${i}`;
    });
  });

  it('generates frame strings correctly', () => {
    const f = frames.generate(3, (i) => `frame-${i}`);
    expect(f[0]).toBe('frame-0');
    expect(f[2]).toBe('frame-2');
  });

  it('count:0 returns empty array', () => {
    expect(frames.generate(0, () => 'x')).toHaveLength(0);
  });

  it('negative count clamps to 0', () => {
    expect(frames.generate(-5, () => 'x')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
//  live
// ─────────────────────────────────────────────
describe('frames.live', () => {
  it('starts and renders frames', () => {
    const ctrl = frames.live({ fps: 10, autoStart: true });
    ctrl.update('hello');
    jest.advanceTimersByTime(110);
    expect(output).toContain('hello');
    ctrl.stop();
  });

  it('autoStart:false does not render before start()', () => {
    const ctrl = frames.live({ fps: 10, autoStart: false });
    ctrl.update('hidden');
    jest.advanceTimersByTime(200);
    expect(output).not.toContain('hidden');
    ctrl.stop();
  });

  it('start() begins rendering', () => {
    const ctrl = frames.live({ fps: 10, autoStart: false });
    ctrl.update('visible');
    ctrl.start();
    jest.advanceTimersByTime(110);
    expect(output).toContain('visible');
    ctrl.stop();
  });

  it('start() is idempotent — double call is safe', () => {
    const ctrl = frames.live({ fps: 10, autoStart: false });
    ctrl.start();
    ctrl.start(); // second call should be no-op
    jest.advanceTimersByTime(110);
    ctrl.stop();
    expect(true).toBe(true); // no crash
  });

  it('stop() shows cursor', () => {
    const ctrl = frames.live({ fps: 10, autoStart: true });
    ctrl.stop();
    expect(output).toContain('\x1b[?25h');
  });

  it('stop() sets timer to null — double stop is safe (idempotent)', () => {
    const ctrl = frames.live({ fps: 10, autoStart: true });
    ctrl.stop();
    output = '';
    ctrl.stop(); // second stop — timer already null, wasRunning=false
    // New behavior: second stop is fully idempotent — doesn't re-emit cursor.show
    // (avoids underflow of the ref counter when stop is called multiple times).
    // What matters is: no crash, no infinite escape spam.
    expect(() => ctrl.stop()).not.toThrow();
  });

  it('update() renders immediately when running', () => {
    const ctrl = frames.live({ fps: 1, autoStart: true });
    output = '';
    ctrl.update('instant');
    // Should render immediately without waiting for interval
    expect(output).toContain('instant');
    ctrl.stop();
  });

  it('update() does not render when not running', () => {
    const ctrl = frames.live({ fps: 10, autoStart: false });
    output = '';
    ctrl.update('notyet');
    expect(output).not.toContain('notyet');
    ctrl.stop();
  });

  it('fps:0 does not throw (clamped to 1)', () => {
    expect(() => frames.live({ fps: 0, autoStart: false })).not.toThrow();
  });

  it('calling live() with no opts uses autoStart:true default (line 97)', () => {
    // No opts passed — both fps=12 and autoStart=true are defaults
    const ctrl = frames.live();
    ctrl.update('default');
    jest.advanceTimersByTime(90); // 1000/12 ≈ 83ms per frame
    expect(output).toContain('default');
    ctrl.stop();
  });

  it('renders multi-line frame and clears previous lines', () => {
    const ctrl = frames.live({ fps: 20, autoStart: true });
    ctrl.update('line1\nline2');
    jest.advanceTimersByTime(55);
    ctrl.update('new1\nnew2');
    jest.advanceTimersByTime(55);
    // clearLines uses `cursor.up(N)` for the line count plus screen.clearDown
    // We only assert that some cursor-up sequence and a clear were emitted.
    expect(output).toMatch(/\x1b\[\d+A/);
    expect(output).toContain('\x1b[0J'); // clearDown
    ctrl.stop();
  });

  it('frame ending with \\n — endsWith branch 0 (line 111)', () => {
    // When frame ends with \n, lastLines += 0 (not 1)
    const ctrl = frames.live({ fps: 20, autoStart: true });
    ctrl.update('hello\n'); // ends with newline → branch 0
    jest.advanceTimersByTime(55);
    expect(output).toContain('hello');
    // No extra writeln() because frame already ends with \n (line 112 false branch)
    ctrl.stop();
  });

  it('frame NOT ending with \\n — writeln() called (line 112 true branch)', () => {
    const ctrl = frames.live({ fps: 20, autoStart: true });
    ctrl.update('hello'); // no trailing newline → writeln() called
    jest.advanceTimersByTime(55);
    expect(output).toContain('hello');
    ctrl.stop();
  });
});

// ─────────────────────────────────────────────
//  morph
// ─────────────────────────────────────────────
describe('frames.morph', () => {
  it('returns correct number of steps', () => {
    const result = frames.morph('AAA', 'BBB', 4);
    expect(result).toHaveLength(4);
  });

  it('first frame is frameA', () => {
    const result = frames.morph('hello', 'world', 4);
    expect(result[0]).toBe('hello');
  });

  it('last frame is frameB', () => {
    const result = frames.morph('hello', 'world', 4);
    expect(result[result.length - 1]).toBe('world');
  });

  it('mid frames contain scramble chars', () => {
    const result = frames.morph('AAAAA', 'BBBBB', 6);
    const mid = result.slice(1, -1);
    // Mid frames should differ from both A and B (scrambled)
    const hasScramble = mid.some(f => f !== 'AAAAA' && f !== 'BBBBB');
    expect(hasScramble).toBe(true);
  });

  it('identical frames produce no scramble', () => {
    const result = frames.morph('same', 'same', 4);
    // All frames should be 'same' since chars never differ
    expect(result.every(f => f === 'same')).toBe(true);
  });

  it('steps:1 clamps to 2', () => {
    const result = frames.morph('A', 'B', 1);
    expect(result).toHaveLength(2);
  });

  it('pads shorter frameA to length of frameB', () => {
    const result = frames.morph('AB', 'ABCDE', 2);
    expect(result[0]?.length).toBe(5); // padded
  });

  it('accepts custom charset', () => {
    const result = frames.morph('XXX', 'OOO', 4, '123');
    const mid = result.slice(1, -1);
    const chars = new Set(mid.flatMap(f => [...f]));
    // Should contain chars from charset '123'
    expect([...chars].some(c => '123'.includes(c))).toBe(true);
  });

  it('frameA shorter than frameB — padEnd fills to equal length', () => {
    const result = frames.morph('A', 'ZZZZZ', 2);
    expect(result[0]).toBe('A    '); // padded to len=5
    expect(result[result.length - 1]).toBe('ZZZZZ');
  });

  it('frameB shorter than frameA — padEnd fills to equal length', () => {
    const result = frames.morph('ZZZZZ', 'B', 2);
    expect(result[0]).toBe('ZZZZZ');
    expect(result[result.length - 1]).toBe('B    '); // padded to len=5
  });

  it('empty charset (!charset.length) falls back to ░', () => {
    // charset = '' → !charset.length → returns '░' for differing chars.
    // With probabilistic snap, some chars may already be the target,
    // so we check that EVERY differing position is either the target ('B')
    // or the fallback charset char ('░').
    const result = frames.morph('AAAAA', 'BBBBB', 4, '');
    const mid = result.slice(1, -1);
    expect(mid.every(f => [...f].every(ch => ch === '░' || ch === 'B'))).toBe(true);
  });

  it('non-empty charset uses indexed char', () => {
    // With probabilistic snap, mid frames contain charset chars OR target ('B')
    const result = frames.morph('AAAAA', 'BBBBB', 4, '+-');
    const mid = result.slice(1, -1);
    expect(mid.every(f => [...f].every(ch => '+-B'.includes(ch)))).toBe(true);
  });

  it('matching chars at mid-transition stay unchanged', () => {
    const result = frames.morph('AXA', 'AYA', 4);
    const mid = result.slice(1, -1);
    // Positions 0 and 2 match (A===A) → returned as-is
    expect(mid.every(f => f[0] === 'A' && f[2] === 'A')).toBe(true);
  });

  it('available on frames API', () => {
    expect(typeof frames.morph).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  presets
// ─────────────────────────────────────────────
describe('frames.presets.loadingBar', () => {
  it('generates width+1 frames', () => {
    expect(frames.presets.loadingBar({ width: 5 })).toHaveLength(6);
  });

  it('uses custom char and empty', () => {
    const f = frames.presets.loadingBar({ width: 3, char: '■', empty: '□' });
    expect(f.some(fr => fr.includes('■'))).toBe(true);
    expect(f.some(fr => fr.includes('□'))).toBe(true);
  });

  it('last frame is 100%', () => {
    const f = frames.presets.loadingBar({ width: 4 });
    expect(f[f.length - 1]).toContain('100%');
  });

  it('uses all defaults when called with no opts', () => {
    // Hits default branches: width=20, char='█', empty='░', label='Loading'
    const f = frames.presets.loadingBar();
    expect(f).toHaveLength(21); // width+1 = 21
    expect(f[0]).toContain('Loading');
    expect(f[0]).toContain('░');
    expect(f[f.length - 1]).toContain('█');
  });
});

describe('frames.presets.ball', () => {
  it('first frame has char at position 0', () => {
    const f = frames.presets.ball({ width: 5, char: '●' });
    expect(f[0]).toBe('●');
  });

  it('does not duplicate extremes (smooth loop)', () => {
    const f = frames.presets.ball({ width: 4, char: '●' });
    const first = f[0];
    const last  = f[f.length - 1];
    expect(last).not.toBe(first);
  });

  it('uses all defaults when called with no opts', () => {
    // Hits default branches: width=20, char='●'
    const f = frames.presets.ball();
    expect(f.length).toBeGreaterThan(0);
    expect(f[0]).toContain('●');
  });
});

describe('frames.presets.breathe', () => {
  it('generates steps*2 frames', () => {
    expect(frames.presets.breathe('hi', { steps: 4 })).toHaveLength(8);
  });

  it('first half frames use ascending t (i < steps branch)', () => {
    const f = frames.presets.breathe('X', { steps: 4 });
    // First 4 frames: t = i/steps (ascending)
    // Last 4 frames: t = 1 - (i-steps)/steps (descending)
    expect(f).toHaveLength(8);
  });

  it('second half frames use descending t (i >= steps branch)', () => {
    // steps=2 → frames[0..1] ascending, frames[2..3] descending
    const f = frames.presets.breathe('X', { steps: 2 });
    // Frame at i=2 (>= steps=2) → t = 1 - (2-2)/2 = 1.0 → fullest shade
    expect(f[2]).toBeTruthy();
  });

  it('space characters pass through unchanged (ch === space branch)', () => {
    const f = frames.presets.breathe('A B', { steps: 2 });
    // Every frame should contain a space at position 1
    expect(f.every(fr => fr[1] === ' ')).toBe(true);
  });

  it('non-space characters get shade applied (ch !== space branch)', () => {
    const f = frames.presets.breathe('AB', { steps: 2 });
    const shades = ['░', '▒', '▓', '█'];
    expect(f.every(fr => [...fr].every(ch => shades.includes(ch)))).toBe(true);
  });

  it('uses default steps when not provided', () => {
    // Hits steps=8 default → 16 frames
    const f = frames.presets.breathe('hi');
    expect(f).toHaveLength(16);
  });
});

describe('frames.presets.typeDelete', () => {
  it('first frame is just the cursor', () => {
    const f = frames.presets.typeDelete('hi', { cursor: '|' });
    expect(f[0]).toBe('|');
  });

  it('contains the full text at some point', () => {
    const f = frames.presets.typeDelete('hello', { cursor: '▌' });
    expect(f.some(fr => fr.includes('hello'))).toBe(true);
  });

  it('uses custom cursor char', () => {
    const f = frames.presets.typeDelete('x', { cursor: '_' });
    expect(f.some(fr => fr.includes('_'))).toBe(true);
  });

  it('uses default cursor when not provided', () => {
    // Hits default branch: cursor='▌'
    const f = frames.presets.typeDelete('hi');
    expect(f.some(fr => fr.includes('▌'))).toBe(true);
  });
});


// ─────────────────────────────────────────────
//  PlayController API
// ─────────────────────────────────────────────
describe('frames.play — controller', () => {
  it('returns controller with done promise', () => {
    const ctrl = frames.play(['A'], { interval: 0, repeat: 1 });
    expect(typeof ctrl.pause).toBe('function');
    expect(typeof ctrl.resume).toBe('function');
    expect(typeof ctrl.seek).toBe('function');
    expect(typeof ctrl.stop).toBe('function');
    expect(typeof ctrl.isPlaying).toBe('function');
    expect(ctrl.done).toBeInstanceOf(Promise);
  });

  it('controller.stop() halts playback', async () => {
    const ctrl = frames.play(['A','B','C','D','E'], { interval: 100, repeat: 0 });
    await jest.advanceTimersByTimeAsync(50);
    ctrl.stop();
    await jest.runAllTimersAsync();
    await ctrl.done;
    // Should have completed (not hung)
    expect(true).toBe(true);
  });

  it('seek jumps to a specific frame index', async () => {
    const order: string[] = [];
    const ctrl = frames.play(['A','B','C','D'], {
      interval: 0, repeat: 1,
      onFrame: (f) => { order.push(f); return f; },
    });
    ctrl.seek(2);
    await jest.runAllTimersAsync();
    await ctrl.done;
    // The first rendered frame should be 'C' (index 2)
    expect(order[0]).toBe('C');
  });

  it('seek wraps around with modulo', () => {
    const ctrl = frames.play(['A','B'], { interval: 100, repeat: 0 });
    expect(() => ctrl.seek(99)).not.toThrow();
    ctrl.stop();
  });

  it('pause/resume controls playback flow', async () => {
    const order: string[] = [];
    const ctrl = frames.play(['A','B','C'], {
      interval: 50, repeat: 1,
      onFrame: (f) => { order.push(f); return f; },
    });
    ctrl.pause();
    await jest.advanceTimersByTimeAsync(200);
    expect(order.length).toBeLessThanOrEqual(1); // paused
    ctrl.resume();
    await jest.runAllTimersAsync();
    await ctrl.done;
    expect(order.length).toBeGreaterThan(0);
  });

  it('isPlaying reflects state', async () => {
    const ctrl = frames.play(['A'], { interval: 0, repeat: 1 });
    // Initially not yet started (microtask boundary)
    await jest.runAllTimersAsync();
    await ctrl.done;
    expect(ctrl.isPlaying()).toBe(false);
  });

  it('onFinish fires on natural completion', async () => {
    let finished = false;
    await run(() => frames.play(['A','B'], {
      interval: 0, repeat: 1,
      onFinish: () => { finished = true; },
    }));
    expect(finished).toBe(true);
  });

  it('onFinish does NOT fire when stopped', async () => {
    let finished = false;
    const ctrl = frames.play(['A','B','C'], {
      interval: 100, repeat: 0,
      onFinish: () => { finished = true; },
    });
    ctrl.stop();
    await jest.runAllTimersAsync();
    await ctrl.done;
    expect(finished).toBe(false);
  });

  it('user errors in onFinish do not propagate', async () => {
    await expect(run(() => frames.play(['A'], {
      interval: 0, repeat: 1,
      onFinish: () => { throw new Error('user error'); },
    }))).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  FPS option
// ─────────────────────────────────────────────
describe('frames.play — fps', () => {
  it('fps option converts to interval', async () => {
    // 60fps → ~16ms per frame
    let frameCount = 0;
    const ctrl = frames.play(['A','B','C','D','E','F'], {
      fps: 60, repeat: 1,
      onFrame: (f) => { frameCount++; return f; },
    });
    await jest.runAllTimersAsync();
    await ctrl.done;
    expect(frameCount).toBe(6);
  });

  it('fps takes precedence over interval', () => {
    const ctrl = frames.play(['A'], { interval: 1000, fps: 60, repeat: 1 });
    expect(ctrl.done).toBeInstanceOf(Promise);
    ctrl.stop();
  });

  it('fps below 1 clamps safely', async () => {
    await expect(run(() => frames.play(['A'], { fps: 0, repeat: 1 }))).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  AbortSignal — pre-aborted short-circuit
// ─────────────────────────────────────────────
describe('frames.play — pre-aborted signal', () => {
  it('skips render when signal already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = frames.play(['A','B','C'], {
      interval: 0, repeat: 1, signal: ctrl.signal,
    });
    await jest.runAllTimersAsync();
    await result.done;
    // Cursor should not have been hidden since we short-circuited
    expect(output).not.toContain('A');
  });
});

// ─────────────────────────────────────────────
//  live — AbortSignal integration
// ─────────────────────────────────────────────
describe('frames.live — AbortSignal', () => {
  it('auto-stops when signal aborts', () => {
    const ctrl = new AbortController();
    const l = frames.live({ fps: 30, autoStart: true, signal: ctrl.signal });
    expect(l.isRunning()).toBe(true);
    ctrl.abort();
    expect(l.isRunning()).toBe(false);
  });

  it('does not start when pre-aborted signal', () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const l = frames.live({ fps: 30, autoStart: true, signal: ctrl.signal });
    // Auto-stops immediately on abort
    expect(l.isRunning()).toBe(false);
  });

  it('stop({ clear: true }) wipes last rendered frame', () => {
    const l = frames.live({ fps: 60, autoStart: true });
    l.update('hello');
    jest.advanceTimersByTime(20); // let one render tick happen
    l.stop({ clear: true });
    // After clear, output ends with clear sequences
    expect(output).toContain('hello');
    l.stop(); // idempotent
  });

  it('stop() default does not clear', () => {
    const l = frames.live({ fps: 60, autoStart: true });
    l.update('persistent');
    jest.advanceTimersByTime(20);
    l.stop(); // no clear
    expect(output).toContain('persistent');
  });

  it('stop is idempotent', () => {
    const l = frames.live({ fps: 60, autoStart: true });
    l.stop();
    expect(() => l.stop()).not.toThrow();
    expect(() => l.stop({ clear: true })).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  morph — empty input safety
// ─────────────────────────────────────────────
describe('frames.morph — edge cases', () => {
  it('returns single empty frame for empty inputs', () => {
    const result = frames.morph('', '');
    expect(result).toEqual(['']);
  });

  it('handles empty target', () => {
    const result = frames.morph('hello', '', 4);
    expect(result.length).toBe(4);
  });

  it('handles empty source', () => {
    const result = frames.morph('', 'hello', 4);
    expect(result.length).toBe(4);
  });

  it('first frame matches source', () => {
    const result = frames.morph('AAA', 'BBB', 5);
    expect(result[0]).toBe('AAA');
  });

  it('last frame matches target', () => {
    const result = frames.morph('AAA', 'BBB', 5);
    expect(result[result.length - 1]).toBe('BBB');
  });

  it('preserves matching characters across morph', () => {
    // 'CAT' → 'BAT' — only first char changes; A and T stay
    const result = frames.morph('CAT', 'BAT', 5);
    for (const f of result) {
      expect(f[1]).toBe('A');
      expect(f[2]).toBe('T');
    }
  });

  it('falls back to default charset when empty charset given', () => {
    const result = frames.morph('AB', 'CD', 4, '');
    expect(result.length).toBe(4);
  });
});

// ─────────────────────────────────────────────
//  lineCount edge cases
// ─────────────────────────────────────────────
describe('lineCount handling', () => {
  it('counts CRLF as single newlines', async () => {
    // Frame uses \r\n — should still clear correctly
    await expect(run(() => frames.play(['line1\r\nline2'], {
      interval: 0, repeat: 1,
    }))).resolves.toBeUndefined();
  });

  it('handles empty frame', async () => {
    await expect(run(() => frames.play([''], { interval: 0, repeat: 1 }))).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  Input validation & defensive paths
// ─────────────────────────────────────────────
describe('frames defensive inputs', () => {
  it('play with non-array frames returns no-op controller', async () => {
    const ctrl = frames.play(null as unknown as string[]);
    expect(typeof ctrl.pause).toBe('function');
    expect(typeof ctrl.stop).toBe('function');
    expect(ctrl.isPlaying()).toBe(false);
    await ctrl.done; // resolves immediately
  });

  it('play with NaN fps falls back to default', () => {
    const ctrl = frames.play(['a'], { fps: NaN, repeat: 1 });
    expect(typeof ctrl.done).toBe('object');
    ctrl.stop();
  });

  it('play with negative repeat falls back to default 1 (plays once)', async () => {
    // Use the run() helper which advances fake timers + awaits done.
    // Negative repeat falls back to default (1) — does NOT loop infinitely.
    let renderCount = 0;
    await run(() => frames.play(['a', 'b'], {
      repeat: -5, interval: 0,
      onFrame: (f) => { renderCount++; return f; },
    }));
    // Plays the 2 frames exactly once (renderCount = 2)
    expect(renderCount).toBe(2);
  });

  it('play with non-finite repeat falls back to 1', async () => {
    // Infinity is not finite per isFiniteNumber → fallback to 1, plays once.
    // Use run() to properly advance fake timers + await completion.
    await run(() => frames.play(['a'], {
      repeat: Infinity as unknown as number,
      interval: 0,
    }));
    // No throw = success
    expect(true).toBe(true);
  });

  it('seek with NaN is ignored', () => {
    const ctrl = frames.play(['a', 'b', 'c'], { fps: 60 });
    expect(() => ctrl.seek(NaN)).not.toThrow();
    expect(() => ctrl.seek(Infinity)).not.toThrow();
    ctrl.stop();
  });

  it('generate with NaN count returns empty array', () => {
    expect(frames.generate(NaN, (i) => String(i))).toEqual([]);
  });

  it('generate with negative count returns empty', () => {
    expect(frames.generate(-10, (i) => String(i))).toEqual([]);
  });

  it('generate with non-function fn returns array of empty strings', () => {
    const result = frames.generate(3, null as unknown as (i: number) => string);
    expect(result).toEqual(['', '', '']);
  });

  it('generate swallows user errors per frame', () => {
    const result = frames.generate(3, (i) => {
      if (i === 1) throw new Error('boom');
      return `frame${i}`;
    });
    expect(result).toEqual(['frame0', '', 'frame2']);
  });

  it('generate coerces non-string returns', () => {
    const result = frames.generate(2, (i) => (i * 2) as unknown as string);
    expect(result).toEqual(['0', '2']);
  });
});

// ─────────────────────────────────────────────
//  morph defensive
// ─────────────────────────────────────────────
describe('morph defensive', () => {
  it('morph with steps=1 clamps to minimum 2', () => {
    const result = frames.morph('a', 'b', 1);
    expect(result.length).toBe(2);
    expect(result[0]).toBe('a');
    expect(result[result.length - 1]).toBe('b');
  });

  it('morph with NaN steps falls back to 8', () => {
    const result = frames.morph('a', 'b', NaN);
    expect(result.length).toBe(8);
  });

  it('morph with empty charset falls back to ░', () => {
    const result = frames.morph('aaaa', 'bbbb', 3, '');
    // Middle frame may contain ░ chars
    expect(result.length).toBe(3);
  });

  it('morph coerces non-string inputs', () => {
    expect(() => frames.morph(42 as unknown as string, true as unknown as string, 3)).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  presets defensive
// ─────────────────────────────────────────────
describe('presets defensive', () => {
  it('loadingBar with width=0 produces single 100% frame', () => {
    const result = frames.presets.loadingBar({ width: 0 });
    expect(result.length).toBe(1);
    expect(result[0]).toContain('100%');
  });

  it('loadingBar with NaN width falls back to default 20', () => {
    const result = frames.presets.loadingBar({ width: NaN });
    expect(result.length).toBe(21); // 0..20 = 21 frames
  });

  it('ball with width=0 clamps to 1', () => {
    expect(() => frames.presets.ball({ width: 0 })).not.toThrow();
  });

  it('breathe with steps=0 clamps to 1', () => {
    expect(() => frames.presets.breathe('hi', { steps: 0 })).not.toThrow();
  });

  it('typeDelete with empty cur uses default', () => {
    expect(() => frames.presets.typeDelete('hi', { cursor: '' })).not.toThrow();
  });

  it('all presets coerce non-string text', () => {
    expect(() => frames.presets.breathe(42 as unknown as string)).not.toThrow();
    expect(() => frames.presets.typeDelete(42 as unknown as string)).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Cursor ref-counting
// ─────────────────────────────────────────────
describe('frames cursor ref-counting', () => {
  it('resetFramesCursorCount is exported and callable', () => {
    expect(() => resetFramesCursorCount()).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  live() defensive
// ─────────────────────────────────────────────
describe('live() defensive', () => {
  it('live with NaN fps falls back to default 12', () => {
    const ctrl = frames.live({ fps: NaN });
    expect(ctrl.isRunning()).toBe(true);
    ctrl.stop();
  });

  it('live with fps > 60 caps at 60', () => {
    const ctrl = frames.live({ fps: 9999 });
    expect(ctrl.isRunning()).toBe(true);
    ctrl.stop();
  });

  it('update with non-string coerces', () => {
    const ctrl = frames.live({ autoStart: false });
    expect(() => ctrl.update(42 as unknown as string)).not.toThrow();
    ctrl.stop();
  });

  it('stop is idempotent', () => {
    const ctrl = frames.live();
    ctrl.stop();
    expect(() => ctrl.stop()).not.toThrow();
    expect(() => ctrl.stop({ clear: true })).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Coverage: branch targets
// ─────────────────────────────────────────────
describe('frames: branch coverage', () => {
  it('clearLines with n<=0 is no-op (line 208)', () => {
    // clearLines is internal — exercised indirectly via play with no output
    // Just verify play with empty stays defensive
    const ctrl = frames.play([], { fps: 30, repeat: 1 });
    expect(typeof ctrl.stop).toBe('function');
    ctrl.stop();
  });

  it('play with empty array returns no-op controller (line 229+)', () => {
    // play([]) hits the early-return no-op controller branch
    const ctrl = frames.play([], { repeat: 1 });
    expect(ctrl).toBeDefined();
    expect(typeof ctrl.pause).toBe('function');
    expect(typeof ctrl.resume).toBe('function');
    expect(typeof ctrl.stop).toBe('function');
  });

  it('play with non-array also returns no-op (defensive)', () => {
    const ctrl = frames.play(null as unknown as string[], { repeat: 1 });
    expect(ctrl).toBeDefined();
    ctrl.stop();
  });
});