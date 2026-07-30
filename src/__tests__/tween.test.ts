import {
  tween, spring, interpolate, sequence, parallel, delay,
  tweenStep, springStep, tweenEngine,
} from '../tween/index.js';

describe('interpolate (v1.5.0)', () => {
  it('interpolates numbers', () => {
    expect(interpolate(0, 100, 0.5)).toBe(50);
    expect(interpolate(0, 100, 0)).toBe(0);
    expect(interpolate(0, 100, 1)).toBe(100);
  });

  it('clamps t to [0,1]', () => {
    expect(interpolate(0, 100, 1.5)).toBe(100);
    expect(interpolate(0, 100, -0.5)).toBe(0);
  });

  it('interpolates numeric arrays element-wise', () => {
    expect(interpolate([0, 0], [80, 24], 0.5)).toEqual([40, 12]);
    expect(interpolate([255, 0, 0], [0, 0, 255], 0.5)).toEqual([127.5, 0, 127.5]);
  });

  it('interpolates flat numeric records', () => {
    expect(interpolate({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 });
  });

  it('keeps a from-key that is missing in to unchanged', () => {
    expect(interpolate({ x: 0, opacity: 1 }, { x: 10 }, 0.5)).toEqual({ x: 5, opacity: 1 });
  });

  it('handles arrays of different lengths (uses the shorter)', () => {
    expect(interpolate([0, 0, 0], [10, 10], 0.5)).toEqual([5, 5]);
  });

  it('snaps at the midpoint for mismatched shapes', () => {
    expect(interpolate(5, [1, 2] as never, 0.3)).toBe(5);
    expect(interpolate(5, [1, 2] as never, 0.7)).toEqual([1, 2]);
  });
});

describe('tween (v1.5.0)', () => {
  it('calls onUpdate and ends exactly at `to` with progress 1', async () => {
    const values: number[] = [];
    let lastProgress = -1;
    await tween({
      from: 0, to: 100, duration: 60, fps: 60,
      onUpdate: (v, p) => { values.push(v); lastProgress = p; },
    });
    expect(values.length).toBeGreaterThan(1);
    expect(values[values.length - 1]).toBe(100);
    expect(lastProgress).toBe(1);
  });

  it('starts at `from` on the first frame', async () => {
    const values: number[] = [];
    await tween({ from: 10, to: 20, duration: 40, onUpdate: (v) => values.push(v) });
    expect(values[0]).toBe(10);
  });

  it('reducedMotion jumps straight to `to` in one update', async () => {
    const values: number[] = [];
    await tween({
      from: 0, to: 100, duration: 1000, reducedMotion: true,
      onUpdate: (v) => values.push(v),
    });
    expect(values).toEqual([100]);
  });

  it('duration <= 0 also jumps to the end', async () => {
    const values: number[] = [];
    await tween({ from: 0, to: 50, duration: 0, onUpdate: (v) => values.push(v) });
    expect(values).toEqual([50]);
  });

  it('resolves immediately if the signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const values: number[] = [];
    await tween({
      from: 0, to: 100, duration: 500, signal: ctrl.signal,
      onUpdate: (v) => values.push(v),
    });
    expect(values).toEqual([]);
  });

  it('stops early when aborted mid-flight', async () => {
    const ctrl = new AbortController();
    let count = 0;
    const p = tween({
      from: 0, to: 100, duration: 1000, signal: ctrl.signal,
      onUpdate: () => { count++; },
    });
    setTimeout(() => ctrl.abort(), 30);
    await p;
    const countAtAbort = count;
    await new Promise<void>((r) => setTimeout(() => r(), 60));
    // No further updates after abort
    expect(count).toBe(countAtAbort);
  });

  it('interpolates array values over time', async () => {
    let last: number[] = [];
    await tween({
      from: [0, 0], to: [10, 20], duration: 40,
      onUpdate: (v) => { last = v; },
    });
    expect(last).toEqual([10, 20]);
  });

  it('does nothing when onUpdate is not a function', async () => {
    await expect(
      tween({ from: 0, to: 1, onUpdate: undefined as never }),
    ).resolves.toBeUndefined();
  });

  it('respects a custom easing name', async () => {
    const values: number[] = [];
    await tween({
      from: 0, to: 100, duration: 60, easing: 'easeOutCubic',
      onUpdate: (v) => values.push(v),
    });
    // easeOutCubic is ahead of linear at the midpoint; final is still 100
    expect(values[values.length - 1]).toBe(100);
  });

  it('waits for `delay` before the first frame', async () => {
    const start = Date.now();
    const values: number[] = [];
    await tween({
      from: 0, to: 10, duration: 40, delay: 40,
      onUpdate: (v) => values.push(v),
    });
    // The whole thing took at least the delay
    expect(Date.now() - start).toBeGreaterThanOrEqual(30);
    expect(values[values.length - 1]).toBe(10);
  });

  it('aborting during the delay skips the tween entirely', async () => {
    const ctrl = new AbortController();
    const values: number[] = [];
    const p = tween({
      from: 0, to: 10, duration: 40, delay: 60, signal: ctrl.signal,
      onUpdate: (v) => values.push(v),
    });
    setTimeout(() => ctrl.abort(), 20); // abort while still in the delay
    await p;
    expect(values).toEqual([]);
  });
});

describe('spring (v1.5.0)', () => {
  it('settles at the target', async () => {
    let last = NaN;
    await spring({
      from: 0, to: 100,
      config: { stiffness: 300, damping: 30 },
      onUpdate: (v) => { last = v; },
    });
    expect(last).toBe(100);
  });

  it('works with the default config (no config passed)', async () => {
    // Exercises the stiffness ?? 170 / damping ?? 26 defaults.
    let last = NaN;
    await spring({ from: 0, to: 100, onUpdate: (v) => { last = v; } });
    expect(last).toBe(100);
  });

  it('stops early when aborted mid-flight', async () => {
    const ctrl = new AbortController();
    let count = 0;
    // A slow spring so it is still running when we abort.
    const p = spring({
      from: 0, to: 100, config: { stiffness: 40, damping: 6 },
      signal: ctrl.signal,
      onUpdate: () => { count++; },
    });
    setTimeout(() => ctrl.abort(), 30);
    await p;
    const atAbort = count;
    await new Promise<void>((r) => setTimeout(() => r(), 60));
    expect(count).toBe(atAbort); // no updates after abort
  });

  it('reports velocity, ending at 0 when settled', async () => {
    let lastVel = NaN;
    await spring({
      from: 0, to: 50, config: { stiffness: 300, damping: 30 },
      onUpdate: (_v, vel) => { lastVel = vel; },
    });
    expect(lastVel).toBe(0);
  });

  it('reducedMotion jumps straight to the target', async () => {
    const values: number[] = [];
    await spring({ from: 0, to: 100, reducedMotion: true, onUpdate: (v) => values.push(v) });
    expect(values).toEqual([100]);
  });

  it('resolves immediately if already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const values: number[] = [];
    await spring({ from: 0, to: 100, signal: ctrl.signal, onUpdate: (v) => values.push(v) });
    expect(values).toEqual([]);
  });

  it('force-settles at maxDuration for a mis-tuned spring', async () => {
    let last = NaN;
    // Very low damping + tight threshold would oscillate a long time;
    // maxDuration caps it.
    await spring({
      from: 0, to: 100,
      config: { stiffness: 200, damping: 0.5, restThreshold: 1e-9 },
      maxDuration: 120,
      onUpdate: (v) => { last = v; },
    });
    expect(last).toBe(100); // forced settle
  });

  it('does nothing when onUpdate is not a function', async () => {
    await expect(
      spring({ from: 0, to: 1, onUpdate: undefined as never }),
    ).resolves.toBeUndefined();
  });
});

describe('composition DSL (v1.5.0)', () => {
  it('sequence runs steps in order', async () => {
    const order: string[] = [];
    await sequence([
      async () => { order.push('a'); },
      async () => { order.push('b'); },
      async () => { order.push('c'); },
    ]);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('sequence stops early when aborted between steps', async () => {
    const ctrl = new AbortController();
    const order: string[] = [];
    await sequence([
      async () => { order.push('a'); ctrl.abort(); },
      async () => { order.push('b'); },
    ], ctrl.signal);
    expect(order).toEqual(['a']);
  });

  it('delay waits without throwing', async () => {
    const start = Date.now();
    await delay(30)();
    expect(Date.now() - start).toBeGreaterThanOrEqual(20);
  });

  it('delay returns immediately when its signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const start = Date.now();
    await delay(1000)(ctrl.signal);
    // Did not wait the full second
    expect(Date.now() - start).toBeLessThan(100);
  });

  it('parallel returns immediately when its signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const done: string[] = [];
    await parallel([async () => { done.push('ran'); }], ctrl.signal);
    // The pre-abort guard means no step ran
    expect(done).toEqual([]);
  });

  it('parallel tolerates a non-function entry', async () => {
    const done: string[] = [];
    await parallel([
      async () => { done.push('real'); },
      undefined as never, // exercises the Promise.resolve() fallback
    ]);
    expect(done).toEqual(['real']);
  });

  it('parallel runs steps concurrently and waits for all', async () => {
    const done: string[] = [];
    await parallel([
      async () => { await new Promise<void>((r) => setTimeout(() => r(), 20)); done.push('slow'); },
      async () => { done.push('fast'); },
    ]);
    expect(done).toContain('slow');
    expect(done).toContain('fast');
    expect(done.length).toBe(2);
  });

  it('parallel with an empty array resolves', async () => {
    await expect(parallel([])).resolves.toBeUndefined();
  });

  it('sequence ignores a non-array input', async () => {
    await expect(sequence(undefined as never)).resolves.toBeUndefined();
  });

  it('tweenStep composes inside a sequence', async () => {
    const values: number[] = [];
    await sequence([
      tweenStep({ from: 0, to: 10, duration: 30, onUpdate: (v) => values.push(v) }),
      delay(10),
      tweenStep({ from: 10, to: 0, duration: 30, onUpdate: (v) => values.push(v) }),
    ]);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(0);
    // Went up to 10 in the middle
    expect(Math.max(...values)).toBe(10);
  });

  it('springStep composes inside parallel', async () => {
    let a = NaN; let b = NaN;
    await parallel([
      springStep({ from: 0, to: 100, config: { stiffness: 300, damping: 30 }, onUpdate: (v) => { a = v; } }),
      springStep({ from: 0, to: 50, config: { stiffness: 300, damping: 30 }, onUpdate: (v) => { b = v; } }),
    ]);
    expect(a).toBe(100);
    expect(b).toBe(50);
  });
});

describe('tween namespace + barrel (v1.5.0)', () => {
  it('exposes the API on the tweenEngine namespace', () => {
    expect(typeof tweenEngine.tween).toBe('function');
    expect(typeof tweenEngine.spring).toBe('function');
    expect(typeof tweenEngine.interpolate).toBe('function');
    expect(typeof tweenEngine.sequence).toBe('function');
    expect(typeof tweenEngine.parallel).toBe('function');
    expect(typeof tweenEngine.delay).toBe('function');
    expect(typeof tweenEngine.tweenStep).toBe('function');
    expect(typeof tweenEngine.springStep).toBe('function');
  });

  it('is re-exported from the main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.tween).toBe('function');
    expect(typeof main.spring).toBe('function');
    expect(typeof main.interpolate).toBe('function');
    expect(typeof main.sequence).toBe('function');
    expect(typeof main.parallel).toBe('function');
    expect(typeof main.delay).toBe('function');
    expect(typeof main.tweenStep).toBe('function');
    expect(typeof main.springStep).toBe('function');
    expect(main.tween).toBe(main.tweenEngine.tween);
    expect(typeof main.tween).toBe('function');
    // default export namespace
    expect(typeof main.default.tween.tween).toBe('function');
  });
});
