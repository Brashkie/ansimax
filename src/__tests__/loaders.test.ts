import { loader, SPINNERS } from '../loaders/index.js';
import { stripAnsi } from '../utils/helpers.js';

// ── TTY helpers ──────────────────────────────
const setTTY = (val: boolean) =>
  Object.defineProperty(process.stdout, 'isTTY', { value: val, configurable: true, writable: true });

// ── stdout capture ───────────────────────────
let output = '';

beforeEach(() => {
  output = '';
  jest.spyOn(process.stdout, 'write').mockImplementation((s: unknown) => {
    output += String(s); return true;
  });
  setTTY(true);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
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