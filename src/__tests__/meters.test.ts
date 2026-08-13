import {
  createETA, createThroughput, createLiveRegion,
  formatBytes, formatCount, formatDuration,
} from '../loaders/meters.js';

// Small helper: advance real time a little between samples.
const wait = (ms: number) => new Promise<void>((r) => setTimeout(() => r(), ms));

describe('formatBytes (v1.6.0)', () => {
  it('formats zero and negatives as "0 B"', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-5)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('shows whole bytes with no decimals', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('auto-scales to KB / MB / GB', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(5.5 * 1024 ** 3)).toBe('5.5 GB');
  });

  it('honors a custom decimal count', () => {
    expect(formatBytes(1536, 2)).toBe('1.50 KB');
  });
});

describe('formatCount (v1.6.0)', () => {
  it('formats zero/negatives as "0"', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(-1)).toBe('0');
  });

  it('leaves sub-thousand counts as integers', () => {
    expect(formatCount(999)).toBe('999');
    expect(formatCount(12)).toBe('12');
  });

  it('auto-scales with SI suffixes', () => {
    expect(formatCount(1500)).toBe('1.5K');
    expect(formatCount(2_000_000)).toBe('2.0M');
    expect(formatCount(3_000_000_000)).toBe('3.0B');
  });
});

describe('formatDuration (v1.6.0)', () => {
  it('formats sub-second as ms', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds with one decimal', () => {
    expect(formatDuration(1500)).toBe('1.5s');
  });

  it('formats minutes and hours', () => {
    expect(formatDuration(65_000)).toBe('1m 5s');
    expect(formatDuration(3_660_000)).toBe('1h 1m');
  });

  it('returns "—" for invalid input', () => {
    expect(formatDuration(-1)).toBe('—');
    expect(formatDuration(Infinity)).toBe('—');
  });
});

describe('createETA (v1.6.0)', () => {
  it('reports Infinity remaining before it has two samples', () => {
    const eta = createETA({ total: 100 });
    eta.update(10);
    expect(eta.remainingMs()).toBe(Infinity);
    expect(eta.eta()).toBe('—');
  });

  it('computes a positive rate and finite ETA after progress over time', async () => {
    const eta = createETA({ total: 100 });
    eta.update(0);
    await wait(40);
    eta.update(50);
    expect(eta.rate()).toBeGreaterThan(0);
    expect(Number.isFinite(eta.remainingMs())).toBe(true);
    expect(eta.progress()).toBeCloseTo(0.5, 5);
  });

  it('remaining reaches 0 at completion', async () => {
    const eta = createETA({ total: 100 });
    eta.update(0);
    await wait(20);
    eta.update(100);
    expect(eta.remainingMs()).toBe(0);
    expect(eta.progress()).toBe(1);
  });

  it('clamps progress to [0,1] even past total', () => {
    const eta = createETA({ total: 100 });
    eta.update(150);
    expect(eta.progress()).toBe(1);
  });

  it('reset clears samples', async () => {
    const eta = createETA({ total: 100 });
    eta.update(0);
    await wait(10);
    eta.update(50);
    eta.reset();
    expect(eta.rate()).toBe(0);
    expect(eta.progress()).toBe(0);
  });

  it('a zero total yields 0 progress (no divide-by-zero)', () => {
    const eta = createETA({ total: 0 });
    eta.update(0);
    expect(eta.progress()).toBe(0);
  });

  it('rate is 0 when progress does not increase (dv <= 0)', async () => {
    const eta = createETA({ total: 100 });
    eta.update(50);
    await wait(20);
    eta.update(50); // same value → dv = 0 → rate 0
    expect(eta.rate()).toBe(0);
  });

  it('trims to the sample window (only recent samples count)', async () => {
    const eta = createETA({ total: 1000, window: 3 });
    // Push more than `window` samples; the ring buffer keeps the last 3.
    for (let i = 1; i <= 6; i++) {
      eta.update(i * 100);
      await wait(5);
    }
    // Still estimable and progressing — the trim path ran without breaking.
    expect(eta.progress()).toBeCloseTo(0.6, 5);
    expect(eta.rate()).toBeGreaterThan(0);
  });
});

describe('createThroughput (v1.6.0)', () => {
  it('reports a bytes/s rate after two timed samples', async () => {
    const tp = createThroughput({ unit: 'bytes' });
    tp.update(0);
    await wait(40);
    tp.update(4096);
    expect(tp.rate()).toBeGreaterThan(0);
    expect(tp.format()).toMatch(/\/s$/);
  });

  it('formats ops mode with a custom label', async () => {
    const tp = createThroughput({ unit: 'ops', opsLabel: 'req' });
    tp.update(0);
    await wait(40);
    tp.update(1000);
    expect(tp.format()).toMatch(/req\/s$/);
  });

  it('rate is 0 before two samples', () => {
    const tp = createThroughput();
    tp.update(100);
    expect(tp.rate()).toBe(0);
    expect(tp.format()).toBe('0 B/s');
  });

  it('reset clears samples', async () => {
    const tp = createThroughput();
    tp.update(0);
    await wait(10);
    tp.update(1024);
    tp.reset();
    expect(tp.rate()).toBe(0);
  });

  it('rate is 0 when the cumulative value decreases (dv < 0)', async () => {
    const tp = createThroughput();
    tp.update(1000);
    await wait(20);
    tp.update(500); // went backwards → dv < 0 → rate 0
    expect(tp.rate()).toBe(0);
  });

  it('trims to the sample window', async () => {
    const tp = createThroughput({ window: 3 });
    for (let i = 1; i <= 6; i++) {
      tp.update(i * 1000);
      await wait(5);
    }
    // The trim path ran; still produces a positive rate from recent samples.
    expect(tp.rate()).toBeGreaterThan(0);
  });
});

describe('createLiveRegion (v1.6.0)', () => {
  it('prints the whole block on the first frame', () => {
    const out: string[] = [];
    const region = createLiveRegion({ out: (s) => out.push(s) });
    region.render(['A: 0%', 'B: 0%']);
    expect(out.join('')).toBe('A: 0%\nB: 0%');
  });

  it('only rewrites the line that changed', () => {
    const out: string[] = [];
    const region = createLiveRegion({ out: (s) => out.push(s) });
    region.render(['A: 0%', 'B: 0%']);
    out.length = 0; // clear captured
    region.render(['A: 100%', 'B: 0%']); // only A changed
    const frame = out.join('');
    expect(frame).toContain('A: 100%');
    expect(frame).not.toContain('B: 0%'); // B untouched
  });

  it('emits nothing when nothing changed', () => {
    const out: string[] = [];
    const region = createLiveRegion({ out: (s) => out.push(s) });
    region.render(['A: 1', 'B: 2']);
    out.length = 0;
    region.render(['A: 1', 'B: 2']); // identical
    expect(out.join('')).toBe('');
  });

  it('appends new lines when the frame grows', () => {
    const out: string[] = [];
    const region = createLiveRegion({ out: (s) => out.push(s) });
    region.render(['A']);
    out.length = 0;
    region.render(['A', 'B']); // grew by one line
    expect(out.join('')).toContain('B');
  });

  it('done() emits a trailing newline and resets', () => {
    const out: string[] = [];
    const region = createLiveRegion({ out: (s) => out.push(s) });
    region.render(['X']);
    out.length = 0;
    region.done();
    expect(out.join('')).toBe('\n');
    // After done, next render behaves like a first frame again
    region.render(['Y', 'Z']);
    expect(out.join('')).toContain('Y\nZ');
  });

  it('clear() erases without leaving content markers', () => {
    const out: string[] = [];
    const region = createLiveRegion({ out: (s) => out.push(s) });
    region.render(['A', 'B']);
    out.length = 0;
    region.clear();
    // Should have emitted some escape sequence, and reset internal state
    expect(out.length).toBeGreaterThan(0);
    out.length = 0;
    region.render(['fresh']);
    expect(out.join('')).toBe('fresh');
  });

  it('clear() on an empty region does nothing', () => {
    const out: string[] = [];
    const region = createLiveRegion({ out: (s) => out.push(s) });
    region.clear(); // never rendered → early return, no output
    expect(out).toEqual([]);
  });

  it('defaults to writing to stdout when no `out` is given', () => {
    // Exercise the default `out` (process.stdout) branch without asserting
    // on real terminal output — just confirm it runs and doesn't throw.
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: (s: string) => boolean }).write = (s: string) => {
      writes.push(String(s)); return true;
    };
    try {
      const region = createLiveRegion(); // no `out` → default sink
      region.render(['line-1']);
      region.render(['line-2']); // triggers a diff redraw through default out
      region.done();
    } finally {
      process.stdout.write = orig;
    }
    expect(writes.join('')).toContain('line-1');
  });
});
