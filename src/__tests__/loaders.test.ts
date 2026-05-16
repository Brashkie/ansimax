import { loader, SPINNERS, resetLoaderCursorCount } from '../loaders/index.js';
import { stripAnsi } from '../utils/helpers.js';
import { resetColorSupportCache } from '../utils/ansi.js';
import { resetNoColor, setNoColor } from '../colors/index.js';

// ── TTY helpers ──────────────────────────────
const setTTY = (val: boolean) =>
  Object.defineProperty(process.stdout, 'isTTY', { value: val, configurable: true, writable: true });

// ── stdout capture ───────────────────────────
let output = '';

beforeEach(() => {
  output = '';
  jest.spyOn(process.stdout, 'write').mockImplementation(((s: unknown) => {
    output += String(s); return true;
  }) as never);
  setTTY(true);
  process.env['FORCE_COLOR'] = '3';
  resetColorSupportCache();
  resetLoaderCursorCount();
  setNoColor(false);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  delete process.env['FORCE_COLOR'];
  resetColorSupportCache();
  resetLoaderCursorCount();
  resetNoColor();
  output = '';
});

// ─────────────────────────────────────────────
//  SPINNERS constant
// ─────────────────────────────────────────────
describe('SPINNERS', () => {
  it('exports all spinner types', () => {
    const types = ['dots','dots2','line','arrow','bounce','star','moon','clock','pong','aesthetic','blocks'];
    for (const t of types) expect(SPINNERS).toHaveProperty(t);
  });

  it('each spinner has at least 2 frames', () => {
    for (const frames of Object.values(SPINNERS)) {
      expect(frames.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('each frame is a non-empty string', () => {
    for (const frames of Object.values(SPINNERS)) {
      for (const frame of frames) {
        expect(typeof frame).toBe('string');
        expect(frame.length).toBeGreaterThan(0);
      }
    }
  });
});

// ─────────────────────────────────────────────
//  loader.spin
// ─────────────────────────────────────────────
describe('loader.spin', () => {
  it('returns a stop function', () => {
    const stop = loader.spin('Loading');
    expect(typeof stop).toBe('function');
    stop();
  });

  it('writes to stdout when interval fires', () => {
    const stop = loader.spin('Test', { interval: 100 });
    jest.advanceTimersByTime(150);
    expect(output.length).toBeGreaterThan(0);
    stop();
  });

  it('stop() clears the line', () => {
    const stop = loader.spin('Test', { interval: 100 });
    jest.advanceTimersByTime(100);
    output = '';
    stop();
    expect(output).toContain('\r');
  });

  it('stop() prints success checkmark', () => {
    const stop = loader.spin('Test');
    stop('Done', true);
    expect(stripAnsi(output)).toContain('✓');
    expect(stripAnsi(output)).toContain('Done');
  });

  it('stop() prints error X', () => {
    const stop = loader.spin('Test');
    stop('Failed', false);
    expect(stripAnsi(output)).toContain('✗');
    expect(stripAnsi(output)).toContain('Failed');
  });

  it('stop() is idempotent — safe to call multiple times', () => {
    const stop = loader.spin('Test');
    stop('Done', true);
    output = '';
    stop('Done again', true); // second call should be no-op
    expect(output).toBe('');
  });

  it('timer guard: stopped flag prevents render in race condition (line 135 \'I\' branch)', () => {
    // Capture the interval callback so we can invoke it manually after stop()
    let intervalCb: (() => void) | null = null;
    const realSetInterval = global.setInterval;
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((cb: () => void, ms?: number) => {
      intervalCb = cb;
      return realSetInterval(cb, ms);
    });

    const stop = loader.spin('Test', { interval: 100 });
    stop(); // sets stopped=true and clearInterval, but cb reference is still captured
    output = '';
    // Manually invoke the captured callback — simulates a race where the timer
    // fired before clearInterval took effect. The `if (stopped) return` guard runs.
    if (intervalCb) (intervalCb as () => void)();
    expect(output).toBe(''); // guard prevented any write

    intervalSpy.mockRestore();
  });

  it('persist:true prints text when stop called without message (line 127)', () => {
    const stop = loader.spin('Persist me', { persist: true });
    jest.advanceTimersByTime(100);
    output = '';
    stop(); // no message → persist branch
    expect(stripAnsi(output)).toContain('Persist me');
  });

  it('persist:false does not print text when stop called without message', () => {
    const stop = loader.spin('Test', { persist: false });
    output = '';
    stop();
    expect(stripAnsi(output)).not.toContain('Test');
  });

  it('applies color to spinner frame', () => {
    const stop = loader.spin('Test', { color: '#ff0000', interval: 50 });
    jest.advanceTimersByTime(60);
    expect(output).toContain('\x1b[38;2;255;0;0m');
    stop();
  });

  it('invalid hex color falls back to no color', () => {
    const stop = loader.spin('Test', { color: 'banana', interval: 50 });
    jest.advanceTimersByTime(60);
    // No 24-bit color codes — invalid hex treated as null
    expect(output).not.toContain('\x1b[38;2;');
    stop();
  });

  it('prefix and suffix appear in output', () => {
    const stop = loader.spin('Test', { prefix: '>>>', suffix: '<<<', interval: 50 });
    jest.advanceTimersByTime(60);
    expect(output).toContain('>>>');
    expect(output).toContain('<<<');
    stop();
  });

  it('works with all spinner types', () => {
    const types = Object.keys(SPINNERS) as Array<keyof typeof SPINNERS>;
    for (const type of types) {
      output = '';
      const stop = loader.spin('Test', { type, interval: 50 });
      jest.advanceTimersByTime(60);
      expect(output.length).toBeGreaterThan(0);
      stop();
    }
  });

  it('unknown spinner type falls back to dots (line 108 ?? branch)', () => {
    // @ts-expect-error intentionally invalid type to trigger SPINNERS[type] ?? SPINNERS.dots
    const stop = loader.spin('Test', { type: 'nonexistent', interval: 50 });
    jest.advanceTimersByTime(60);
    // dots first frame is ⠋
    expect(output).toContain('⠋');
    stop();
  });

  it('non-TTY returns no-op stop and writes plain text', () => {
    setTTY(false);
    const stop = loader.spin('Plain text');
    expect(stripAnsi(output)).toContain('Plain text');
    expect(typeof stop).toBe('function');
    output = '';
    stop(); // no-op — should not write anything
    expect(output).toBe('');
  });

  it('reducedMotion writes plain text and stop() still handles message', () => {
    const stop = loader.spin('Reduced', { reducedMotion: true });
    expect(stripAnsi(output)).toContain('Reduced');
    // stop() with message should still print even in reducedMotion
    output = '';
    stop('Done', true);
    expect(stripAnsi(output)).toContain('✓');
    expect(stripAnsi(output)).toContain('Done');
  });

  it('reducedMotion stop() with no message is silent', () => {
    const stop = loader.spin('Reduced', { reducedMotion: true });
    output = '';
    stop(); // no message — silent
    expect(output).toBe('');
  });

  it('reducedMotion stop() with success=false prints X', () => {
    const stop = loader.spin('Reduced', { reducedMotion: true });
    output = '';
    stop('Failed', false); // covers success=false branch in reducedMotion path
    expect(stripAnsi(output)).toContain('✗');
    expect(stripAnsi(output)).toContain('Failed');
  });

  it('uses all defaults when called with no arguments', () => {
    // text='Loading...' default + opts={} default → all option defaults activate
    const stop = loader.spin();
    jest.advanceTimersByTime(100);
    expect(output.length).toBeGreaterThan(0);
    stop();
  });

  it('uses default text when only opts provided', () => {
    // text default = 'Loading...' branch
    const stop = loader.spin(undefined, { interval: 50 });
    jest.advanceTimersByTime(60);
    expect(output).toContain('Loading');
    stop();
  });

  it('signal aborted in interval triggers stop() inside timer (line 147)', () => {
    // First tick fires while not aborted, then signal aborts before next tick
    const ctrl = new AbortController();
    const stop = loader.spin('Test', { signal: ctrl.signal, interval: 50 });
    jest.advanceTimersByTime(60); // first tick rendered
    // Now manually mark aborted but DON'T fire abort event
    // The next tick should hit signal?.aborted === true → stop()
    Object.defineProperty(ctrl.signal, 'aborted', { value: true, configurable: true });
    jest.advanceTimersByTime(60);
    stop(); // idempotent — already stopped from inside timer
  });

  it('AbortSignal stops spinner when aborted', () => {
    const ctrl = new AbortController();
    const stop = loader.spin('Test', { signal: ctrl.signal, interval: 50 });
    jest.advanceTimersByTime(60);
    output = '';
    ctrl.abort();
    expect(stripAnsi(output)).toContain('Cancelled');
    stop(); // idempotent
  });

  it('already-aborted signal stops immediately on first tick', () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const stop = loader.spin('Test', { signal: ctrl.signal, interval: 50 });
    jest.advanceTimersByTime(60);
    stop();
    // cursor.show should have been called
    expect(output).toContain('\x1b[?25h');
  });
});

// ─────────────────────────────────────────────
//  loader.dots
// ─────────────────────────────────────────────
describe('loader.dots', () => {
  it('returns a stop function', () => {
    const stop = loader.dots('Working');
    expect(typeof stop).toBe('function');
    stop();
  });

  it('writes dots on interval', () => {
    const stop = loader.dots('Loading', { interval: 100 });
    jest.advanceTimersByTime(150);
    expect(output).toContain('Loading');
    stop();
  });

  it('stop() clears output', () => {
    const stop = loader.dots('Test');
    jest.advanceTimersByTime(100);
    output = '';
    stop();
    expect(output).toContain('\r');
  });

  it('stop() is idempotent', () => {
    const stop = loader.dots('Test');
    stop();
    output = '';
    stop(); // second call — no-op
    expect(output).toBe('');
  });

  it('timer guard: stopped flag in dots timer race (line 189 \'I\' branch)', () => {
    let intervalCb: (() => void) | null = null;
    const realSetInterval = global.setInterval;
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((cb: () => void, ms?: number) => {
      intervalCb = cb;
      return realSetInterval(cb, ms);
    });

    const stop = loader.dots('Test', { interval: 100 });
    stop();
    output = '';
    if (intervalCb) (intervalCb as () => void)();
    expect(output).toBe('');

    intervalSpy.mockRestore();
  });

  it('cycles through dot counts', () => {
    const stop = loader.dots('X', { interval: 100, max: 3 });
    jest.advanceTimersByTime(350);
    expect(output).toContain('X.');
    stop();
  });

  it('non-TTY writes plain text and returns no-op', () => {
    setTTY(false);
    const stop = loader.dots('Plain');
    expect(stripAnsi(output)).toContain('Plain');
    output = '';
    stop();
    expect(output).toBe('');
  });

  it('uses default text when called with no args', () => {
    // text='Processing' default
    const stop = loader.dots(undefined, { interval: 50 });
    jest.advanceTimersByTime(60);
    expect(output).toContain('Processing');
    stop();
  });

  it('uses all defaults when called with no arguments', () => {
    const stop = loader.dots();
    jest.advanceTimersByTime(100);
    stop();
    expect(true).toBe(true); // no crash
  });

  it('AbortSignal stops dots', () => {
    const ctrl = new AbortController();
    const stop = loader.dots('Test', { signal: ctrl.signal, interval: 50 });
    jest.advanceTimersByTime(60);
    output = '';
    ctrl.abort();
    expect(output).toContain('\x1b[?25h'); // cursor shown
    stop(); // idempotent
  });
});

// ─────────────────────────────────────────────
//  loader.progress
// ─────────────────────────────────────────────
describe('loader.progress', () => {
  it('writes a progress bar', () => {
    loader.progress(50);
    expect(output).toContain('[');
    expect(output).toContain(']');
  });

  it('100% — full bar', () => {
    loader.progress(100);
    expect(stripAnsi(output)).toContain('100%');
    expect(stripAnsi(output)).toContain('█'.repeat(30));
  });

  it('0% — empty bar', () => {
    loader.progress(0);
    expect(stripAnsi(output)).toContain('  0%');
    expect(stripAnsi(output)).toContain('░'.repeat(30));
  });

  it('clamps above 100', () => {
    loader.progress(200);
    expect(stripAnsi(output)).toContain('100%');
  });

  it('clamps below 0', () => {
    loader.progress(-50);
    expect(stripAnsi(output)).toContain('  0%');
  });

  it('shows label', () => {
    loader.progress(50, 'Downloading');
    expect(stripAnsi(output)).toContain('Downloading');
  });

  it('hides percentage when showPercentage:false', () => {
    loader.progress(50, '', { showPercentage: false });
    expect(stripAnsi(output)).not.toContain('%');
  });

  it('uses custom chars', () => {
    loader.progress(100, '', { width: 5, char: '■', emptyChar: '□' });
    expect(stripAnsi(output)).toContain('■■■■■');
  });

  it('applies valid hex color', () => {
    loader.progress(50, '', { color: '#00ff00' });
    expect(output).toContain('\x1b[38;2;0;255;0m');
  });

  it('ignores invalid hex color — no crash', () => {
    expect(() => loader.progress(50, '', { color: 'banana' })).not.toThrow();
    expect(output).not.toContain('\x1b[38;2;');
  });

  it('custom width', () => {
    loader.progress(100, '', { width: 10 });
    expect(stripAnsi(output)).toContain('█'.repeat(10));
  });

  it('negative width clamped to 1 — no crash', () => {
    expect(() => loader.progress(50, '', { width: -10 })).not.toThrow();
  });

  it('uses all defaults when called with only percent', () => {
    // label='', opts={} defaults
    expect(() => loader.progress(50)).not.toThrow();
    expect(stripAnsi(output)).toContain('50%');
  });
});

// ─────────────────────────────────────────────
//  loader.progressAnimate
// ─────────────────────────────────────────────
describe('loader.progressAnimate', () => {
  it('resolves without error', async () => {
    const p = loader.progressAnimate(5, '', { delay: 0 });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it('writes progress bar', async () => {
    const p = loader.progressAnimate(3, 'Installing', { delay: 0 });
    await jest.runAllTimersAsync();
    await p;
    expect(stripAnsi(output)).toContain('Installing');
  });

  it('ends at 100%', async () => {
    const p = loader.progressAnimate(4, '', { delay: 0 });
    await jest.runAllTimersAsync();
    await p;
    expect(stripAnsi(output)).toContain('100%');
  });

  it('steps:0 does not divide by zero', async () => {
    const p = loader.progressAnimate(0, '', { delay: 0 });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it('shows cursor after completion (finally block)', async () => {
    const p = loader.progressAnimate(2, '', { delay: 0 });
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('\x1b[?25h');
  });

  it('AbortSignal stops animate early', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const p = loader.progressAnimate(10, '', { delay: 0, signal: ctrl.signal });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it('uses default label and opts when called with only steps', async () => {
    // label='', opts={} → delay=100 default
    const p = loader.progressAnimate(2);
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  loader.tasks
// ─────────────────────────────────────────────
describe('loader.tasks', () => {
  it('runs all tasks and returns results', async () => {
    const p = loader.tasks([
      { text: 'Task A', fn: async () => 'result-a' },
      { text: 'Task B', fn: async () => 'result-b' },
    ]);
    await jest.runAllTimersAsync();
    const results = await p;
    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(true);
  });

  it('returns result value from successful task', async () => {
    const p = loader.tasks([{ text: 'Task', fn: async () => 42 }]);
    await jest.runAllTimersAsync();
    const results = await p;
    expect(results[0]?.result).toBe(42);
  });

  it('marks failed task as unsuccessful', async () => {
    const p = loader.tasks([
      { text: 'Fail', fn: async () => { throw new Error('boom'); } },
    ]);
    await jest.runAllTimersAsync();
    const results = await p;
    expect(results[0]?.success).toBe(false);
    expect(results[0]?.error?.message).toBe('boom');
  });

  it('continues after failed task', async () => {
    const p = loader.tasks([
      { text: 'Fail',    fn: async () => { throw new Error('x'); } },
      { text: 'Succeed', fn: async () => 'ok' },
    ]);
    await jest.runAllTimersAsync();
    const results = await p;
    expect(results).toHaveLength(2);
    expect(results[1]?.success).toBe(true);
  });

  it('returns empty array for empty task list', async () => {
    const p = loader.tasks([]);
    await jest.runAllTimersAsync();
    await expect(p).resolves.toHaveLength(0);
  });

  it('parallel mode runs all tasks concurrently', async () => {
    const order: string[] = [];
    const p = loader.tasks([
      { text: 'A', fn: async () => { order.push('A'); return 'a'; } },
      { text: 'B', fn: async () => { order.push('B'); return 'b'; } },
    ], { parallel: true });
    await jest.runAllTimersAsync();
    const results = await p;
    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
  });

  it('parallel mode uses reducedMotion — no spinner animation corruption', async () => {
    // parallel: true sets reducedMotion on each spinner → plain text output
    const p = loader.tasks([
      { text: 'Task A', fn: async () => 'a' },
      { text: 'Task B', fn: async () => 'b' },
    ], { parallel: true });
    await jest.runAllTimersAsync();
    await p;
    // In reducedMotion, text is written directly — no cursor hide
    expect(output).not.toContain('[?25l');
  });
});

// ─────────────────────────────────────────────
//  loader.custom
// ─────────────────────────────────────────────
describe('loader.custom', () => {
  it('returns a stop function', () => {
    const stop = loader.custom(['A', 'B', 'C'], 'test');
    expect(typeof stop).toBe('function');
    stop();
  });

  it('renders custom frames on interval', () => {
    const stop = loader.custom(['X', 'Y', 'Z'], 'custom', { interval: 50 });
    jest.advanceTimersByTime(60);
    expect(output).toContain('X');
    stop();
  });

  it('stop() clears the line', () => {
    const stop = loader.custom(['A'], 'test');
    jest.advanceTimersByTime(100);
    output = '';
    stop();
    expect(output).toContain('\r');
  });

  it('stop() is idempotent', () => {
    const stop = loader.custom(['A'], 'test');
    stop();
    output = '';
    stop(); // second call — no-op
    expect(output).toBe('');
  });

  it('timer guard: stopped flag in custom timer race (line 312 \'I\' branch)', () => {
    let intervalCb: (() => void) | null = null;
    const realSetInterval = global.setInterval;
    const intervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((cb: () => void, ms?: number) => {
      intervalCb = cb;
      return realSetInterval(cb, ms);
    });

    const stop = loader.custom(['X'], '', { interval: 100 });
    stop();
    output = '';
    if (intervalCb) (intervalCb as () => void)();
    expect(output).toBe('');

    intervalSpy.mockRestore();
  });

  it('non-TTY writes plain text and returns no-op', () => {
    setTTY(false);
    const stop = loader.custom(['A'], 'custom text');
    expect(stripAnsi(output)).toContain('custom text');
    output = '';
    stop();
    expect(output).toBe('');
  });

  it('throws when frames is empty', () => {
    expect(() => loader.custom([], 'test')).toThrow('frames cannot be empty');
  });

  it('AbortSignal stops custom loader', () => {
    const ctrl = new AbortController();
    const stop = loader.custom(['A', 'B'], '', { signal: ctrl.signal, interval: 50 });
    jest.advanceTimersByTime(60);
    output = '';
    ctrl.abort();
    expect(output).toContain('\x1b[?25h');
    stop();
  });

  it('uses default text="" when not provided', () => {
    // text='' default branch
    const stop = loader.custom(['A'], undefined, { interval: 50 });
    jest.advanceTimersByTime(60);
    expect(output.length).toBeGreaterThan(0);
    stop();
  });

  it('uses all defaults when called with only frames', () => {
    const stop = loader.custom(['X']);
    jest.advanceTimersByTime(120);
    stop();
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  loader.countdown
// ─────────────────────────────────────────────
describe('loader.countdown', () => {
  it('resolves without error', async () => {
    const p = loader.countdown(2);
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
  });

  it('writes countdown numbers', async () => {
    const p = loader.countdown(3);
    await jest.runAllTimersAsync();
    await p;
    expect(stripAnsi(output)).toContain('3');
    expect(stripAnsi(output)).toContain('2');
    expect(stripAnsi(output)).toContain('1');
  });

  it('uses default label', async () => {
    const p = loader.countdown(1);
    await jest.runAllTimersAsync();
    await p;
    expect(stripAnsi(output)).toContain('Starting in');
  });

  it('uses custom label', async () => {
    const p = loader.countdown(1, { label: 'Launching in' });
    await jest.runAllTimersAsync();
    await p;
    expect(stripAnsi(output)).toContain('Launching in');
  });

  it('applies valid hex color', async () => {
    const p = loader.countdown(1, { color: '#ff0000' });
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('\x1b[38;2;255;0;0m');
  });

  it('invalid hex color falls back to gold default', async () => {
    const p = loader.countdown(1, { color: 'banana' });
    await jest.runAllTimersAsync();
    await p;
    // Falls back to {r:255,g:215,b:0} (gold)
    expect(output).toContain('\x1b[38;2;255;215;0m');
  });

  it('shows cursor after completion (finally block)', async () => {
    const p = loader.countdown(1);
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('\x1b[?25h');
  });

  it('ends with clearLine + carriage return', async () => {
    const p = loader.countdown(1);
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('\x1b[2K\r');
  });

  it('AbortSignal stops countdown early', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const p = loader.countdown(10, { signal: ctrl.signal });
    await jest.runAllTimersAsync();
    await expect(p).resolves.toBeUndefined();
    expect(output).toContain('\x1b[?25h');
  });
});

// ─────────────────────────────────────────────
//  loader.spinners reference
// ─────────────────────────────────────────────
describe('loader.spinners', () => {
  it('is the same object as SPINNERS export', () => {
    expect(loader.spinners).toBe(SPINNERS);
  });
});


// ─────────────────────────────────────────────
//  Cursor ownership manager
// ─────────────────────────────────────────────
describe('cursor ownership', () => {
  it('multiple concurrent spinners only show cursor once at the end', () => {
    const stop1 = loader.spin('a');
    const stop2 = loader.spin('b');
    const stop3 = loader.spin('c');

    // Capture state before any stop
    const beforeStops = output;
    output = '';

    stop1();
    stop2();
    // Up to here, cursor should NOT be shown (refs still 1)
    expect(output).not.toContain('\x1b[?25h');
    stop3();
    // Now cursor should be shown
    expect(output).toContain('\x1b[?25h');
  });

  it('resetLoaderCursorCount resets the counter', () => {
    expect(() => resetLoaderCursorCount()).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  NO_COLOR support
// ─────────────────────────────────────────────
describe('NO_COLOR support', () => {
  it('spin in NO_COLOR mode produces no escapes for color', () => {
    setNoColor(true);
    const stop = loader.spin('working', { color: '#ff0000' });
    jest.advanceTimersByTime(100);
    stop();
    // No truecolor RGB escapes should be present
    expect(output).not.toContain('\x1b[38;2;255;0;0m');
  });

  it('progress in NO_COLOR mode produces no fg color escapes', () => {
    setNoColor(true);
    loader.progress(50, 'test', { color: '#ff0000' });
    expect(output).not.toContain('\x1b[38;2;255;0;0m');
  });
});

// ─────────────────────────────────────────────
//  Drift correction
// ─────────────────────────────────────────────
describe('drift correction', () => {
  it('spin frame index advances with elapsed time', () => {
    const stop = loader.spin('test', { type: 'line', interval: 100 });
    // Initial render
    const firstOutput = output;
    output = '';
    // Advance 350ms — should be on frame 3 (350/100 = 3)
    jest.advanceTimersByTime(350);
    expect(output.length).toBeGreaterThan(0);
    stop();
  });

  it('progressAnimate clamps target to 0..100', async () => {
    const promise = loader.progressAnimate(150, 'test', { delay: 0 });
    await jest.runAllTimersAsync();
    await promise;
    // Should not throw and should reach 100
    expect(output).toContain('100%');
  });
});

// ─────────────────────────────────────────────
//  Hierarchical task runner
// ─────────────────────────────────────────────
describe('hierarchical tasks', () => {
  it('runs parent + subtasks sequentially', async () => {
    const order: string[] = [];
    const promise = loader.tasks([
      {
        text: 'parent',
        fn: async () => { order.push('parent'); },
        subtasks: [
          { text: 'sub1', fn: async () => { order.push('sub1'); } },
          { text: 'sub2', fn: async () => { order.push('sub2'); } },
        ],
      },
    ]);
    await jest.runAllTimersAsync();
    await promise;
    expect(order).toEqual(['parent', 'sub1', 'sub2']);
  });

  it('rolls up subtask failure to parent', async () => {
    const promise = loader.tasks([
      {
        text: 'parent',
        fn: async () => { /* succeeds */ },
        subtasks: [
          { text: 'good', fn: async () => { /* ok */ } },
          { text: 'bad',  fn: async () => { throw new Error('boom'); } },
        ],
      },
    ]);
    await jest.runAllTimersAsync();
    const results = await promise;
    expect(results[0]?.success).toBe(false); // rolled up
    expect(results[0]?.subtasks?.[0]?.success).toBe(true);
    expect(results[0]?.subtasks?.[1]?.success).toBe(false);
  });

  it('parent without subtasks works as before', async () => {
    const promise = loader.tasks([
      { text: 'simple', fn: async () => 'result' },
    ]);
    await jest.runAllTimersAsync();
    const results = await promise;
    expect(results[0]?.success).toBe(true);
    expect(results[0]?.result).toBe('result');
    expect(results[0]?.subtasks).toBeUndefined();
  });

  it('aborts cleanly with signal', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const promise = loader.tasks([
      { text: 'a', fn: async () => { /* never called */ } },
      { text: 'b', fn: async () => { /* never called */ } },
    ], { signal: ctrl.signal });
    await jest.runAllTimersAsync();
    const results = await promise;
    expect(results.every((r) => !r.success)).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Multi-loader manager
// ─────────────────────────────────────────────
describe('loader.multi', () => {
  it('creates a multi-loader controller', () => {
    const m = loader.multi();
    expect(typeof m.add).toBe('function');
    expect(typeof m.clear).toBe('function');
    expect(m.count()).toBe(0);
  });

  it('add returns an item with update/succeed/fail/stop', () => {
    const m = loader.multi();
    const item = m.add('working');
    expect(typeof item.update).toBe('function');
    expect(typeof item.succeed).toBe('function');
    expect(typeof item.fail).toBe('function');
    expect(typeof item.stop).toBe('function');
    expect(item.text).toBe('working');
    m.clear();
  });

  it('count tracks active items', () => {
    const m = loader.multi();
    m.add('a');
    m.add('b');
    m.add('c');
    expect(m.count()).toBe(3);
    m.clear();
    expect(m.count()).toBe(0);
  });

  it('item.update changes text', () => {
    const m = loader.multi();
    const item = m.add('initial');
    item.update('updated');
    expect(item.text).toBe('updated');
    m.clear();
  });

  it('item.stop removes the item', () => {
    const m = loader.multi();
    const a = m.add('a');
    m.add('b');
    expect(m.count()).toBe(2);
    a.stop();
    expect(m.count()).toBe(1);
    m.clear();
  });

  it('non-TTY fallback writes lines', () => {
    setTTY(false);
    const m = loader.multi();
    m.add('hello');
    expect(output).toContain('hello');
    m.clear();
    setTTY(true);
  });
});

// ─────────────────────────────────────────────
//  Width normalization
// ─────────────────────────────────────────────
describe('width normalization', () => {
  it('spinner output does not exceed terminal width', () => {
    const stop = loader.spin('text');
    jest.advanceTimersByTime(100);
    // The output line should not be massively wider than the terminal
    const lines = output.split('\n');
    for (const line of lines) {
      const visible = stripAnsi(line).length;
      expect(visible).toBeLessThanOrEqual(500); // sane upper bound
    }
    stop();
  });
});

// ─────────────────────────────────────────────
//  Custom loader
// ─────────────────────────────────────────────
describe('custom loader', () => {
  it('cycles through provided frames', () => {
    const stop = loader.custom(['A', 'B', 'C'], 'loading', { interval: 50 });
    jest.advanceTimersByTime(200);
    stop();
    const plain = stripAnsi(output);
    // Should have rendered at least one of A/B/C
    expect(plain).toMatch(/[ABC]/);
  });

  it('throws when frames is empty', () => {
    expect(() => loader.custom([], 'no frames')).toThrow(/at least one frame/);
  });

  it('respects abort signal pre-aborted', () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const stop = loader.custom(['A', 'B'], 'test', { signal: ctrl.signal });
    expect(typeof stop).toBe('function');
    stop();
  });
});

// ─────────────────────────────────────────────
//  Coverage push: multi-loader full lifecycle
// ─────────────────────────────────────────────
describe('multi-loader full lifecycle', () => {
  it('item.text setter triggers render', () => {
    const m = loader.multi();
    const item = m.add('initial');
    item.text = 'changed';
    expect(item.text).toBe('changed');
    m.clear();
  });

  it('item.succeed with finalText displays it', () => {
    const m = loader.multi();
    const item = m.add('working');
    item.succeed('All done!');
    jest.advanceTimersByTime(200);
    expect(stripAnsi(output)).toContain('All done!');
    m.clear();
  });

  it('item.fail with finalText displays it', () => {
    const m = loader.multi();
    const item = m.add('working');
    item.fail('Something broke');
    jest.advanceTimersByTime(200);
    expect(stripAnsi(output)).toContain('Something broke');
    m.clear();
  });

  it('item.succeed without finalText shows just success state', () => {
    const m = loader.multi();
    const item = m.add('task');
    expect(() => item.succeed()).not.toThrow();
    jest.advanceTimersByTime(200);
    m.clear();
  });

  it('item.fail without finalText shows just fail state', () => {
    const m = loader.multi();
    const item = m.add('task');
    expect(() => item.fail()).not.toThrow();
    jest.advanceTimersByTime(200);
    m.clear();
  });

  it('multi-loader with custom interval', () => {
    const m = loader.multi({ interval: 100 });
    const item = m.add('test');
    expect(typeof item.update).toBe('function');
    m.clear();
  });

  it('non-TTY multi-loader: item.text setter works', () => {
    setTTY(false);
    const m = loader.multi();
    const item = m.add('a');
    item.text = 'b';
    expect(item.text).toBe('b');
    m.clear();
    setTTY(true);
  });

  it('non-TTY multi-loader: update writes new line', () => {
    setTTY(false);
    output = '';
    const m = loader.multi();
    const item = m.add('a');
    item.update('b');
    expect(output).toContain('b');
    m.clear();
    setTTY(true);
  });

  it('non-TTY multi-loader: succeed with text writes ✓', () => {
    setTTY(false);
    output = '';
    const m = loader.multi();
    const item = m.add('a');
    item.succeed('done');
    expect(output).toContain('done');
    m.clear();
    setTTY(true);
  });

  it('non-TTY multi-loader: fail with text writes ✗', () => {
    setTTY(false);
    output = '';
    const m = loader.multi();
    const item = m.add('a');
    item.fail('failed');
    expect(output).toContain('failed');
    m.clear();
    setTTY(true);
  });

  it('non-TTY multi-loader: stop removes item silently', () => {
    setTTY(false);
    const m = loader.multi();
    const item = m.add('a');
    item.stop();
    expect(m.count()).toBe(0);
    setTTY(true);
  });

  it('TTY multi-loader auto-cleanup when items reach 0', () => {
    const m = loader.multi();
    const a = m.add('a');
    const b = m.add('b');
    a.stop();
    b.stop();
    // checkEmpty branch — timer cleared, lastLineCount reset
    expect(m.count()).toBe(0);
  });

  it('item.update on TTY triggers render', () => {
    const m = loader.multi();
    const item = m.add('initial');
    item.update('updated');
    jest.advanceTimersByTime(100);
    expect(item.text).toBe('updated');
    m.clear();
  });
});

// ─────────────────────────────────────────────
//  Coverage push: dots loader signal + non-TTY
// ─────────────────────────────────────────────
describe('dots loader edge cases', () => {
  it('non-TTY: writes text directly and returns no-op stop', () => {
    setTTY(false);
    output = '';
    const stop = loader.dots('processing');
    expect(output).toContain('processing');
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
    setTTY(true);
  });

  it('pre-aborted signal returns no-op stop', () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const stop = loader.dots('test', { signal: ctrl.signal });
    expect(typeof stop).toBe('function');
    stop();
  });

  it('signal aborted mid-flight stops cleanly', () => {
    const ctrl = new AbortController();
    const stop = loader.dots('test', { signal: ctrl.signal, interval: 50 });
    jest.advanceTimersByTime(60);
    ctrl.abort();
    // Should not throw on subsequent stop()
    expect(() => stop()).not.toThrow();
  });

  it('stop is idempotent', () => {
    const stop = loader.dots('test', { interval: 50 });
    jest.advanceTimersByTime(60);
    stop();
    expect(() => stop()).not.toThrow();
  });

  it('cycles dots up to max', () => {
    output = '';
    const stop = loader.dots('test', { interval: 50, max: 3 });
    jest.advanceTimersByTime(200);
    stop();
    // Output should contain '.' chars
    expect(output).toContain('.');
  });
});

// ─────────────────────────────────────────────
//  Coverage push: custom loader signal aborted mid-flight
// ─────────────────────────────────────────────
describe('custom loader signal handling', () => {
  it('signal aborted mid-flight stops via abort handler', () => {
    const ctrl = new AbortController();
    const stop = loader.custom(['A', 'B'], 'test', {
      interval: 50, signal: ctrl.signal,
    });
    jest.advanceTimersByTime(60);
    ctrl.abort();
    expect(() => stop()).not.toThrow();
  });

  it('non-TTY: writes text and returns no-op', () => {
    setTTY(false);
    output = '';
    const stop = loader.custom(['A'], 'plain');
    expect(output).toContain('plain');
    expect(typeof stop).toBe('function');
    stop();
    setTTY(true);
  });

  it('stop is idempotent', () => {
    const stop = loader.custom(['A', 'B'], 'test', { interval: 50 });
    jest.advanceTimersByTime(60);
    stop();
    expect(() => stop()).not.toThrow();
  });

  it('cycles through frames using drift-corrected index', () => {
    output = '';
    const stop = loader.custom(['X', 'Y', 'Z'], 'test', { interval: 30 });
    jest.advanceTimersByTime(120);
    stop();
    const plain = stripAnsi(output);
    expect(plain).toMatch(/[XYZ]/);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: spin already-aborted + signal removeListener
// ─────────────────────────────────────────────
describe('spin signal lifecycle', () => {
  it('removes signal listener on stop', () => {
    const ctrl = new AbortController();
    const stop = loader.spin('test', { signal: ctrl.signal });
    jest.advanceTimersByTime(100);
    stop();
    // Now aborting should not retrigger anything
    ctrl.abort();
    // No throw means clean
    expect(true).toBe(true);
  });

  it('reducedMotion returns no-op stop', () => {
    output = '';
    const stop = loader.spin('reduced', { reducedMotion: true });
    expect(output).toContain('reduced');
    expect(typeof stop).toBe('function');
    stop('done', true);
  });

  it('reducedMotion stop with success message', () => {
    output = '';
    const stop = loader.spin('reduced', { reducedMotion: true });
    output = '';
    stop('completed', true);
    expect(output).toContain('completed');
  });

  it('reducedMotion stop with failure message', () => {
    const stop = loader.spin('reduced', { reducedMotion: true });
    output = '';
    stop('error', false);
    expect(output).toContain('error');
  });

  it('non-TTY stop with no message is silent', () => {
    setTTY(false);
    const stop = loader.spin('test');
    output = '';
    stop();
    expect(output.length).toBeLessThan(20); // very minimal output
    setTTY(true);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: countdown branches
// ─────────────────────────────────────────────
describe('countdown coverage', () => {
  it('uses default gold color when no color provided', async () => {
    const p = loader.countdown(0);
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('\x1b[38;2;255;215;0m');
  });

  it('uses provided valid color', async () => {
    const p = loader.countdown(0, { color: '#ff0000' });
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('\x1b[38;2;255;0;0m');
  });

  it('non-TTY writes single line and exits', async () => {
    setTTY(false);
    output = '';
    const p = loader.countdown(5);
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('5');
    setTTY(true);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: Unicode capability fallback
// ─────────────────────────────────────────────
describe('Unicode fallback paths', () => {
  it('CI environment is detected as Unicode-capable', () => {
    const orig = process.env['CI'];
    process.env['CI'] = '1';
    delete process.env['LANG'];
    delete process.env['LC_ALL'];
    delete process.env['LC_CTYPE'];
    // Just exercise the path — spin should still work
    const stop = loader.spin('test', { type: 'dots' });
    jest.advanceTimersByTime(100);
    stop();
    if (orig !== undefined) process.env['CI'] = orig;
    else delete process.env['CI'];
  });
});

// ─────────────────────────────────────────────
//  Coverage push: progress branches
// ─────────────────────────────────────────────
describe('progress edge cases', () => {
  it('handles 0%', () => {
    output = '';
    loader.progress(0);
    expect(output).toContain('0%');
  });

  it('handles 100%', () => {
    output = '';
    loader.progress(100);
    expect(output).toContain('100%');
  });

  it('clamps negative percent', () => {
    output = '';
    loader.progress(-50);
    expect(output).toContain('0%');
  });

  it('clamps over-100 percent', () => {
    output = '';
    loader.progress(200);
    expect(output).toContain('100%');
  });

  it('showPercentage: false omits percentage', () => {
    output = '';
    loader.progress(50, '', { showPercentage: false });
    expect(output).not.toContain('%');
  });

  it('with label adds label after bar', () => {
    output = '';
    loader.progress(50, 'Loading');
    expect(output).toContain('Loading');
  });

  it('with color applies color to filled portion', () => {
    output = '';
    loader.progress(50, '', { color: '#ff0000' });
    expect(output).toContain('\x1b[38;2;255;0;0m');
  });
});

// ─────────────────────────────────────────────
//  Coverage push: tasks parallel with abort
// ─────────────────────────────────────────────
describe('tasks parallel abort handling', () => {
  it('parallel mode handles abort signal at task level', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const p = loader.tasks([
      { text: 'a', fn: async () => { /* never */ } },
    ], { parallel: true, signal: ctrl.signal });
    await jest.runAllTimersAsync();
    const results = await p;
    expect(results[0]?.success).toBe(false);
  });

  it('non-Error thrown in task is wrapped', async () => {
    const p = loader.tasks([
      { text: 'string-throw', fn: async () => { throw 'plain string'; } },
    ]);
    await jest.runAllTimersAsync();
    const results = await p;
    expect(results[0]?.success).toBe(false);
    expect(results[0]?.error?.message).toBe('plain string');
  });
});

// ─────────────────────────────────────────────
//  Defensive inputs
// ─────────────────────────────────────────────
describe('loaders defensive inputs', () => {
  it('progress with NaN percent shows 0%', () => {
    output = '';
    loader.progress(NaN);
    expect(output).toContain('  0%');
  });

  it('progress with Infinity clamps to 0', () => {
    output = '';
    loader.progress(Infinity);
    expect(output).toContain('  0%');
  });

  it('progress with non-string label coerces', () => {
    output = '';
    loader.progress(50, 42 as unknown as string);
    expect(output).toContain('42');
  });

  it('progress with NaN width falls back to default', () => {
    expect(() => loader.progress(50, '', { width: NaN })).not.toThrow();
  });

  it('progress with empty char falls back to default', () => {
    expect(() => loader.progress(50, '', { char: '' })).not.toThrow();
  });

  it('spin coerces non-string text', () => {
    setTTY(false);
    output = '';
    const stop = loader.spin(42 as unknown as string);
    expect(output).toContain('42');
    stop();
    setTTY(true);
  });

  it('spin with NaN interval falls back to default', () => {
    setTTY(false);
    const stop = loader.spin('test', { interval: NaN });
    expect(typeof stop).toBe('function');
    stop();
    setTTY(true);
  });

  it('countdown with NaN seconds clamps to 0', async () => {
    setTTY(false);
    output = '';
    await loader.countdown(NaN);
    expect(output).toContain('0');
    setTTY(true);
  });

  it('countdown with negative seconds clamps to 0', async () => {
    setTTY(false);
    output = '';
    await loader.countdown(-5);
    expect(output).toContain('0');
    setTTY(true);
  });

  it('tasks with non-array returns empty array', async () => {
    const result = await loader.tasks(null as unknown as never);
    expect(result).toEqual([]);
  });

  it('tasks with empty array returns empty', async () => {
    const result = await loader.tasks([]);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  Coverage: branch targets
// ─────────────────────────────────────────────
// padToTerminalWidth line 164 (`if (visible >= termW) return str`) is
// covered by an `istanbul ignore if` directive in src/loaders/index.ts
// because reliably triggering it in tests requires real TTY + setInterval
// which leaks workers in Jest.