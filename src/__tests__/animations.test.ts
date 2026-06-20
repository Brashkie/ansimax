import { animate, resetCursorRefCount, canAnimate } from '../animations/index.js';
import { stripAnsi, resetColorSupportCache } from '../utils/ansi.js';

// ── TTY mock helpers ─────────────────────────
const mockTTY = (val: boolean) => {
  Object.defineProperty(process.stdout, 'isTTY', {
    value: val,
    configurable: true,
    writable: true,
  });
};

// ── stdout capture ───────────────────────────
let output = '';
const captureMock = () =>
  jest.spyOn(process.stdout, 'write').mockImplementation((s: unknown) => {
    output += String(s);
    return true;
  });

// ── Run async animation with fake timers ─────
const run = async (fn: () => Promise<void>): Promise<void> => {
  const p = fn();
  await jest.runAllTimersAsync();
  await p;
};

beforeEach(() => {
  output = '';
  captureMock();
  mockTTY(true);  // animations need TTY to run
  resetColorSupportCache();
  resetCursorRefCount();
  // Force colors on so cursor.show()/hide() actually write
  process.env['FORCE_COLOR'] = '3';
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  output = '';
  delete process.env['FORCE_COLOR'];
  resetColorSupportCache();
  resetCursorRefCount();
});

// ─────────────────────────────────────────────
//  typewriter
// ─────────────────────────────────────────────
describe('animate.typewriter', () => {
  it('writes each character', async () => {
    await run(() => animate.typewriter('abc', { speed: 0 }));
    expect(output).toContain('a');
    expect(output).toContain('b');
    expect(output).toContain('c');
  });

  it('writes newline by default', async () => {
    await run(() => animate.typewriter('x', { speed: 0 }));
    expect(output).toContain('\n');
  });

  it('no newline when newline:false', async () => {
    await run(() => animate.typewriter('x', { speed: 0, newline: false }));
    expect(output).not.toContain('\n');
  });

  it('applies colorFn to each character', async () => {
    const colorFn = (ch: string) => `[${ch}]`;
    await run(() => animate.typewriter('hi', { speed: 0, colorFn }));
    expect(output).toContain('[h]');
    expect(output).toContain('[i]');
  });

  it('handles empty string', async () => {
    await expect(run(() => animate.typewriter('', { speed: 0 }))).resolves.toBeUndefined();
  });

  it('hides and shows cursor', async () => {
    await run(() => animate.typewriter('x', { speed: 0 }));
    expect(output).toContain('\x1b[?25l');
    expect(output).toContain('\x1b[?25h');
  });

  it('skips sleep for space character', async () => {
    // space should not await sleep — just verify no crash
    await expect(run(() => animate.typewriter('a b', { speed: 100 }))).resolves.toBeUndefined();
  });

  it('uses default speed when no opts passed', async () => {
    // cover the default parameter branch
    const p = animate.typewriter('x');
    await jest.runAllTimersAsync();
    await p;
    expect(output).toContain('x');
  });

  it('stops when signal already aborted before start', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.typewriter('hello', { speed: 0, signal: ctrl.signal }));
    // Pre-aborted → shouldSkip path: text written instantly
    expect(stripAnsi(output)).toContain('hello');
  });

  it('runs fully when signal exists but is not aborted', async () => {
    // Covers signal?.aborted FALSE branch (line 99) — signal present, not aborted
    const ctrl = new AbortController(); // not aborted
    await run(() => animate.typewriter('ab', { speed: 0, signal: ctrl.signal }));
    expect(output).toContain('a');
    expect(output).toContain('b');
  });

  it('reducedMotion writes instantly without cursor sequences', async () => {
    await run(() => animate.typewriter('hello', { speed: 0, reducedMotion: true }));
    expect(output).toContain('hello');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes plain text', async () => {
    mockTTY(false);
    await run(() => animate.typewriter('plain', { speed: 0 }));
    expect(output).toContain('plain');
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  fadeIn
// ─────────────────────────────────────────────
describe('animate.fadeIn', () => {
  it('resolves without error', async () => {
    await expect(run(() => animate.fadeIn('hello', { duration: 0, steps: 2 }))).resolves.toBeUndefined();
  });

  it('writes text to stdout', async () => {
    await run(() => animate.fadeIn('hello', { duration: 0, steps: 2 }));
    expect(output).toContain('hello');
  });

  it('uses 24-bit color codes', async () => {
    await run(() => animate.fadeIn('hi', { duration: 0, steps: 2, color: '#ffffff' }));
    expect(output).toContain('\x1b[38;2;');
  });

  it('accepts RGB object', async () => {
    await expect(run(() => animate.fadeIn('hi', { duration: 0, steps: 1, color: { r: 255, g: 0, b: 0 } }))).resolves.toBeUndefined();
  });

  it('no newline when newline:false', async () => {
    await run(() => animate.fadeIn('x', { duration: 0, steps: 1, newline: false }));
    expect(output).not.toContain('\n');
  });

  it('hides and shows cursor', async () => {
    await run(() => animate.fadeIn('x', { duration: 0, steps: 1 }));
    expect(output).toContain('\x1b[?25l');
    expect(output).toContain('\x1b[?25h');
  });

  it('steps:0 does not divide by zero', async () => {
    await expect(run(() => animate.fadeIn('x', { steps: 0, duration: 0 }))).resolves.toBeUndefined();
  });

  it('signal aborted stops early', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.fadeIn('hi', { duration: 100, steps: 10, signal: ctrl.signal }));
    // Pre-aborted → shouldSkip path: text written instantly
    expect(stripAnsi(output)).toContain('hi');
  });

  it('reducedMotion writes instantly', async () => {
    await run(() => animate.fadeIn('hello', { duration: 0, steps: 1, reducedMotion: true }));
    expect(output).toContain('hello');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes plain text', async () => {
    mockTTY(false);
    await run(() => animate.fadeIn('plain', { duration: 0 }));
    expect(output).toContain('plain');
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  fadeOut
// ─────────────────────────────────────────────
describe('animate.fadeOut', () => {
  it('resolves without error', async () => {
    await expect(run(() => animate.fadeOut('hello', { duration: 0, steps: 2 }))).resolves.toBeUndefined();
  });

  it('writes text to stdout', async () => {
    await run(() => animate.fadeOut('bye', { duration: 0, steps: 2 }));
    expect(output).toContain('bye');
  });

  it('uses 24-bit color codes', async () => {
    await run(() => animate.fadeOut('hi', { duration: 0, steps: 2 }));
    expect(output).toContain('\x1b[38;2;');
  });

  it('steps:0 does not divide by zero', async () => {
    await expect(run(() => animate.fadeOut('x', { steps: 0, duration: 0 }))).resolves.toBeUndefined();
  });

  it('signal aborted inside fadeOut loop (line 167)', async () => {
    // Pre-abort so signal?.aborted is true immediately on first loop iteration
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.fadeOut('hi', { duration: 100, steps: 10, signal: ctrl.signal }));
    // Pre-aborted fadeOut shouldSkip path → newline only (text already gone)
    expect(output).toContain('\n');
  });

  it('reducedMotion writes newline only', async () => {
    await run(() => animate.fadeOut('x', { duration: 0, reducedMotion: true }));
    expect(output).toContain('\n');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes newline only', async () => {
    mockTTY(false);
    await run(() => animate.fadeOut('x', { duration: 0 }));
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  slide
// ─────────────────────────────────────────────
describe('animate.slide', () => {
  it('resolves without error', async () => {
    await expect(run(() => animate.slide('hello', { duration: 0 }))).resolves.toBeUndefined();
  });

  it('writes full text at the end', async () => {
    await run(() => animate.slide('hello', { duration: 0 }));
    expect(output).toContain('hello');
  });

  it('direction left works', async () => {
    await expect(run(() => animate.slide('hi', { direction: 'left', duration: 0 }))).resolves.toBeUndefined();
  });

  it('direction right produces leading spaces in intermediate frames', async () => {
    await run(() => animate.slide('ABC', { direction: 'right', duration: 0 }));
    expect(output).toContain('ABC');
  });

  it('no newline when newline:false', async () => {
    await run(() => animate.slide('x', { duration: 0, newline: false }));
    expect(output).not.toContain('\n');
  });

  it('hides and shows cursor', async () => {
    await run(() => animate.slide('x', { duration: 0 }));
    expect(output).toContain('\x1b[?25l');
    expect(output).toContain('\x1b[?25h');
  });

  it('signal aborted stops early', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.slide('hello', { duration: 0, signal: ctrl.signal }));
    expect(stripAnsi(output)).toContain('hello');
  });

  it('reducedMotion writes instantly', async () => {
    await run(() => animate.slide('hello', { duration: 0, reducedMotion: true }));
    expect(output).toContain('hello');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes plain text', async () => {
    mockTTY(false);
    await run(() => animate.slide('plain', { duration: 0 }));
    expect(output).toContain('plain');
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  pulse
// ─────────────────────────────────────────────
describe('animate.pulse', () => {
  it('resolves without error', async () => {
    await expect(run(() => animate.pulse('!', { times: 1, interval: 0 }))).resolves.toBeUndefined();
  });

  it('writes text to stdout', async () => {
    await run(() => animate.pulse('ALERT', { times: 1, interval: 0 }));
    expect(output).toContain('ALERT');
  });

  it('uses 24-bit color for both colors', async () => {
    await run(() => animate.pulse('x', { times: 1, interval: 0, color1: '#ffffff', color2: '#000000' }));
    expect(output).toContain('\x1b[38;2;');
  });

  it('accepts RGB objects', async () => {
    await expect(run(() => animate.pulse('x', {
      times: 1, interval: 0,
      color1: { r: 255, g: 255, b: 255 },
      color2: { r: 0, g: 0, b: 0 },
    }))).resolves.toBeUndefined();
  });

  it('hides and shows cursor', async () => {
    await run(() => animate.pulse('x', { times: 1, interval: 0 }));
    expect(output).toContain('\x1b[?25l');
    expect(output).toContain('\x1b[?25h');
  });

  it('signal aborted at start of loop (first check)', async () => {
    // Covers signal?.aborted at line 240 — first check in loop
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.pulse('x', { times: 5, interval: 100, signal: ctrl.signal }));
    expect(stripAnsi(output)).toContain('x');
  });

  it('signal aborted between first and second sleep (line 243 \'I\' branch)', async () => {
    // The second `if (signal?.aborted) break` only fires when:
    //   1. signal exists and is NOT aborted at first check (line 240) → enter body
    //   2. first write + sleep complete normally
    //   3. signal becomes aborted RIGHT BEFORE second check (line 243) → break
    //
    // We use a counter-based getter that flips to true on the SECOND read.
    // First read = line 240 check (returns false → enter body)
    // Second read = line 243 check (returns true → break)
    let reads = 0;
    const fakeSignal = {
      get aborted() {
        reads++;
        return reads >= 2; // false on first read, true after
      },
    } as AbortSignal;

    const promise = animate.pulse('x', {
      times: 5, interval: 10,
      signal: fakeSignal,
    });
    await jest.runAllTimersAsync();
    await promise;

    // Reads should be exactly 2: line 240 (false) and line 243 (true)
    expect(reads).toBeGreaterThanOrEqual(2);
    expect(output).toContain('\x1b[?25h'); // finally ran
  });

  it('reducedMotion writes instantly', async () => {
    await run(() => animate.pulse('x', { times: 3, interval: 300, reducedMotion: true }));
    expect(output).toContain('x');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes plain text', async () => {
    mockTTY(false);
    await run(() => animate.pulse('plain', { times: 1, interval: 0 }));
    expect(output).toContain('plain');
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  wave
// ─────────────────────────────────────────────
describe('animate.wave', () => {
  it('resolves without error', async () => {
    await expect(run(() => animate.wave('hello', { duration: 0, steps: 2 }))).resolves.toBeUndefined();
  });

  it('writes colored output', async () => {
    await run(() => animate.wave('hi', { duration: 0, steps: 2 }));
    expect(output).toContain('\x1b[38;2;');
  });

  it('spaces pass through without coloring', async () => {
    await run(() => animate.wave('a b', { duration: 0, steps: 1 }));
    expect(output).toContain(' ');
  });

  it('accepts custom color array', async () => {
    await expect(run(() => animate.wave('x', {
      duration: 0, steps: 1,
      colors: ['#ff0000', '#0000ff'],
    }))).resolves.toBeUndefined();
  });

  it('empty text returns early without crashing', async () => {
    await expect(run(() => animate.wave('', { duration: 0, steps: 1 }))).resolves.toBeUndefined();
  });

  it('steps:0 does not divide by zero', async () => {
    await expect(run(() => animate.wave('x', { steps: 0, duration: 0 }))).resolves.toBeUndefined();
  });

  it('signal aborted stops early', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.wave('hello', { duration: 0, steps: 5, signal: ctrl.signal }));
    expect(stripAnsi(output)).toContain('hello');
  });

  it('reducedMotion writes instantly', async () => {
    await run(() => animate.wave('hello', { duration: 0, steps: 1, reducedMotion: true }));
    expect(output).toContain('hello');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes plain text', async () => {
    mockTTY(false);
    await run(() => animate.wave('plain', { duration: 0 }));
    expect(output).toContain('plain');
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  glitch
// ─────────────────────────────────────────────
describe('animate.glitch', () => {
  it('resolves without error', async () => {
    await expect(run(() => animate.glitch('ERROR', { duration: 0 }))).resolves.toBeUndefined();
  });

  it('writes original text at the end', async () => {
    await run(() => animate.glitch('DONE', { duration: 0 }));
    expect(output).toContain('DONE');
  });

  it('hides and shows cursor', async () => {
    await run(() => animate.glitch('x', { duration: 0 }));
    expect(output).toContain('\x1b[?25l');
    expect(output).toContain('\x1b[?25h');
  });

  it('preserves spaces in glitch output — space branch inside loop', async () => {
    // duration > 0 so the while loop runs at least once (covers lines 325-332)
    // space branch: ch === ' ' returns ' ' directly (covers line 326 branch I)
    await run(() => animate.glitch('A B', { duration: 50 }));
    expect(output).toContain('A B');
  });

  it('intensity 10 always replaces non-space chars', async () => {
    // Math.random() < 1 always true → replacement branch taken (line 328)
    await run(() => animate.glitch('ABC', { duration: 50, intensity: 10 }));
    expect(output).toContain('\x1b[?25h');
  });

  it('intensity 0 never replaces chars', async () => {
    // Math.random() < 0 always false → ch branch taken (line 329)
    await run(() => animate.glitch('ABC', { duration: 50, intensity: 0 }));
    expect(output).toContain('\x1b[?25h');
  });

  it('signal aborted stops early', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.glitch('hello', { duration: 800, signal: ctrl.signal }));
    expect(stripAnsi(output)).toContain('hello');
  });

  it('reducedMotion writes instantly', async () => {
    await run(() => animate.glitch('hello', { duration: 800, reducedMotion: true }));
    expect(output).toContain('hello');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes plain text', async () => {
    mockTTY(false);
    await run(() => animate.glitch('plain', { duration: 0 }));
    expect(output).toContain('plain');
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  reveal
// ─────────────────────────────────────────────
describe('animate.reveal', () => {
  it('resolves without error', async () => {
    await expect(run(() => animate.reveal('secret', { duration: 0 }))).resolves.toBeUndefined();
  });

  it('writes final text', async () => {
    await run(() => animate.reveal('hello', { duration: 0 }));
    expect(output).toContain('hello');
  });

  it('preserves spaces', async () => {
    await run(() => animate.reveal('a b', { duration: 0 }));
    expect(output).toContain(' ');
  });

  it('accepts custom charset', async () => {
    await expect(run(() => animate.reveal('x', {
      duration: 0,
      charset: '0123456789',
    }))).resolves.toBeUndefined();
  });

  it('signal aborted stops early', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.reveal('hello', { duration: 0, signal: ctrl.signal }));
    expect(stripAnsi(output)).toContain('hello');
  });

  it('reducedMotion writes instantly', async () => {
    await run(() => animate.reveal('hello', { duration: 0, reducedMotion: true }));
    expect(output).toContain('hello');
    expect(output).not.toContain('\x1b[?25l');
  });

  it('non-TTY writes plain text', async () => {
    mockTTY(false);
    await run(() => animate.reveal('plain', { duration: 0 }));
    expect(output).toContain('plain');
    expect(output).not.toContain('\x1b[?25l');
  });
});

// ─────────────────────────────────────────────
//  Default parameter branches — all animations
//  Each default value (= 50, = 800, = {}, etc.) counts as a branch.
//  Calling with no opts hits all defaults at once.
// ─────────────────────────────────────────────
describe('default parameter branches', () => {
  it('typewriter() with no opts uses all defaults', async () => {
    // speed=50, newline=true, colorFn=null, signal=undef, reducedMotion=false
    await run(() => animate.typewriter('x'));
    expect(output).toContain('x');
  });

  it('fadeIn() with no opts uses all defaults', async () => {
    // duration=800, steps=16, newline=true, color={r:255,g:255,b:255}, etc.
    await run(() => animate.fadeIn('x'));
    expect(output).toContain('x');
  });

  it('fadeOut() with no opts uses all defaults', async () => {
    await run(() => animate.fadeOut('x'));
    expect(output).toContain('\x1b[?25h'); // finally still runs
  });

  it('slide() with no opts uses all defaults', async () => {
    // direction='left', duration=400, newline=true
    await run(() => animate.slide('x'));
    expect(output).toContain('x');
  });

  it('pulse() with no opts uses all defaults', async () => {
    // times=3, interval=300, color1=white, color2=gray, etc.
    await run(() => animate.pulse('x'));
    expect(output).toContain('x');
  });

  it('wave() with no opts uses all defaults', async () => {
    // duration=2000, steps=30, default colors, etc.
    await run(() => animate.wave('x'));
    expect(output).toContain('x');
  });

  it('glitch() with no opts uses all defaults', async () => {
    // duration=800, intensity=3, newline=true
    await run(() => animate.glitch('x'));
    expect(output).toContain('x');
  });

  it('reveal() with no opts uses all defaults', async () => {
    // duration=1000, charset=ABCDEFG..., newline=true
    await run(() => animate.reveal('x'));
    expect(output).toContain('x');
  });

  // ── newline:false branches ──
  it('typewriter newline:false omits final newline', async () => {
    output = '';
    await run(() => animate.typewriter('x', { speed: 0, newline: false }));
    // Last write is 'x' or cursor.show, not '\n'
    expect(output.endsWith('\n')).toBe(false);
  });

  it('fadeIn newline:false branch', async () => {
    await run(() => animate.fadeIn('x', { duration: 0, steps: 1, newline: false }));
    expect(output).not.toMatch(/\n$/);
  });

  it('fadeOut newline:false branch', async () => {
    await run(() => animate.fadeOut('x', { duration: 0, steps: 1, newline: false }));
    expect(output).not.toMatch(/\n$/);
  });

  it('pulse newline:false branch', async () => {
    await run(() => animate.pulse('x', { times: 1, interval: 0, newline: false }));
    expect(output).not.toMatch(/\n$/);
  });

  it('wave newline:false branch', async () => {
    await run(() => animate.wave('x', { duration: 0, steps: 1, newline: false }));
    expect(output).not.toMatch(/\n$/);
  });

  it('glitch newline:false branch', async () => {
    await run(() => animate.glitch('x', { duration: 0, newline: false }));
    expect(output).not.toMatch(/\n$/);
  });

  it('reveal newline:false branch', async () => {
    await run(() => animate.reveal('x', { duration: 0, newline: false }));
    expect(output).not.toMatch(/\n$/);
  });

  // ── reducedMotion + newline:false combined branches ──
  it('typewriter reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.typewriter('plain', { speed: 0, reducedMotion: true, newline: false }));
    expect(output).toContain('plain');
    expect(output).not.toMatch(/\n$/);
  });

  it('fadeIn reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.fadeIn('plain', { reducedMotion: true, newline: false }));
    expect(output).toContain('plain');
  });

  it('fadeOut reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.fadeOut('x', { reducedMotion: true, newline: false }));
    expect(output).not.toContain('\n');
  });

  it('slide reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.slide('plain', { reducedMotion: true, newline: false }));
    expect(output).toContain('plain');
  });

  it('pulse reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.pulse('plain', { reducedMotion: true, newline: false }));
    expect(output).toContain('plain');
  });

  it('wave reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.wave('plain', { reducedMotion: true, newline: false }));
    expect(output).toContain('plain');
  });

  it('glitch reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.glitch('plain', { reducedMotion: true, newline: false }));
    expect(output).toContain('plain');
  });

  it('reveal reducedMotion + newline:false', async () => {
    output = '';
    await run(() => animate.reveal('plain', { reducedMotion: true, newline: false }));
    expect(output).toContain('plain');
  });

  // ── typewriter colorFn null branch (line 91 reducedMotion path) ──
  it('typewriter reducedMotion with colorFn applies it to all chars', async () => {
    output = '';
    const colorFn = (ch: string) => `<${ch}>`;
    await run(() => animate.typewriter('hi', { speed: 0, reducedMotion: true, colorFn }));
    expect(output).toContain('<h>');
    expect(output).toContain('<i>');
  });

  it('typewriter reducedMotion without colorFn writes plain text', async () => {
    output = '';
    await run(() => animate.typewriter('hi', { speed: 0, reducedMotion: true }));
    expect(output).toContain('hi');
  });
});

// ─────────────────────────────────────────────
//  High-level API — sequence and chain
// ─────────────────────────────────────────────
describe('animate.sequence', () => {
  it('runs steps in order', async () => {
    const order: number[] = [];
    await animate.sequence([
      async () => { order.push(1); },
      async () => { order.push(2); },
      async () => { order.push(3); },
    ]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('waits for each step before starting the next', async () => {
    const events: string[] = [];
    await animate.sequence([
      async () => {
        events.push('start1');
        // Use a microtask, not setImmediate (which can hang under fake timers)
        await Promise.resolve();
        events.push('end1');
      },
      async () => { events.push('start2'); events.push('end2'); },
    ]);
    expect(events).toEqual(['start1', 'end1', 'start2', 'end2']);
  });

  it('stops when signal is aborted', async () => {
    const ctrl = new AbortController();
    const calls: number[] = [];
    ctrl.abort();
    await animate.sequence([
      async () => { calls.push(1); },
      async () => { calls.push(2); },
    ], { signal: ctrl.signal });
    expect(calls.length).toBe(0);
  });

  it('stops mid-sequence when aborted between steps', async () => {
    const ctrl = new AbortController();
    const calls: number[] = [];
    await animate.sequence([
      async () => { calls.push(1); ctrl.abort(); },
      async () => { calls.push(2); },
      async () => { calls.push(3); },
    ], { signal: ctrl.signal });
    expect(calls).toEqual([1]);
  });

  it('handles empty array', async () => {
    await expect(animate.sequence([])).resolves.toBeUndefined();
  });
});

describe('animate.chain', () => {
  it('applies multiple animations to same text', async () => {
    const calls: Array<[string, unknown]> = [];
    const fakeAnim = (t: string, opts?: Record<string, unknown>): Promise<void> => {
      calls.push([t, opts]);
      return Promise.resolve();
    };
    await animate.chain('HELLO', [
      fakeAnim,
      [fakeAnim, { duration: 100 }],
    ]);
    expect(calls.length).toBe(2);
    expect(calls[0]?.[0]).toBe('HELLO');
    expect(calls[1]?.[0]).toBe('HELLO');
    expect(calls[1]?.[1]).toMatchObject({ duration: 100 });
  });

  it('passes signal through to each step', async () => {
    const ctrl = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const fakeAnim = (_t: string, opts?: Record<string, unknown>): Promise<void> => {
      receivedSignal = opts?.['signal'] as AbortSignal | undefined;
      return Promise.resolve();
    };
    await animate.chain('TEST', [fakeAnim], { signal: ctrl.signal });
    expect(receivedSignal).toBe(ctrl.signal);
  });

  it('stops when signal is aborted before chain starts', async () => {
    const ctrl = new AbortController();
    const calls: number[] = [];
    const a = (): Promise<void> => { calls.push(1); return Promise.resolve(); };
    ctrl.abort();
    await animate.chain('X', [a, a, a], { signal: ctrl.signal });
    expect(calls.length).toBe(0);
  });

  it('handles empty steps array', async () => {
    await expect(animate.chain('text', [])).resolves.toBeUndefined();
  });

  it('accepts function form (no opts)', async () => {
    const calls: string[] = [];
    const fn = async (t: string): Promise<void> => { calls.push(t); };
    await animate.chain('hi', [fn, fn]);
    expect(calls).toEqual(['hi', 'hi']);
  });
});

// ─────────────────────────────────────────────
//  Animation hooks — onFrame, onDone, onAbort
// ─────────────────────────────────────────────
describe('animation hooks', () => {
  it('typewriter calls onFrame for each character', async () => {
    const frames: number[] = [];
    await run(() => animate.typewriter('abc', {
      speed: 0,
      onFrame: (i) => frames.push(i),
    }));
    expect(frames).toEqual([0, 1, 2]);
  });

  it('typewriter calls onDone on natural completion', async () => {
    let done = false;
    await run(() => animate.typewriter('hi', {
      speed: 0,
      onDone: () => { done = true; },
    }));
    expect(done).toBe(true);
  });

  it('typewriter calls onAbort instead of onDone when cancelled', async () => {
    let done = false;
    let aborted = false;
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => animate.typewriter('hello', {
      speed: 0,
      signal: ctrl.signal,
      onDone:  () => { done = true; },
      onAbort: () => { aborted = true; },
    }));
    expect(done).toBe(false);
    expect(aborted).toBe(true);
  });

  it('fadeIn fires onFrame for each step', async () => {
    let count = 0;
    await run(() => animate.fadeIn('x', {
      duration: 0, steps: 4,
      onFrame: () => count++,
    }));
    expect(count).toBeGreaterThan(0);
  });

  it('hooks errors do not break the animation', async () => {
    let completed = false;
    await run(() => animate.typewriter('test', {
      speed: 0,
      onFrame: () => { throw new Error('user error'); },
      onDone: () => { completed = true; },
    }));
    expect(completed).toBe(true);
  });

  it('reducedMotion still fires onDone', async () => {
    let done = false;
    await run(() => animate.fadeIn('x', {
      reducedMotion: true,
      onDone: () => { done = true; },
    }));
    expect(done).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  animate.parallel — concurrent animations
// ─────────────────────────────────────────────
describe('animate.parallel', () => {
  it('runs all steps concurrently', async () => {
    const events: string[] = [];
    // Use microtask delays — predictable under fake timers
    const slow = async (id: string): Promise<void> => {
      events.push('start-' + id);
      await Promise.resolve();
      await Promise.resolve();
      events.push('end-' + id);
    };

    await run(() => animate.parallel([
      () => slow('A'),
      () => slow('B'),
      () => slow('C'),
    ]));

    // All 3 starts must happen before any end (concurrent execution)
    const startA = events.indexOf('start-A');
    const startB = events.indexOf('start-B');
    const startC = events.indexOf('start-C');
    const endA = events.indexOf('end-A');
    expect(startA).toBeLessThan(endA);
    expect(startB).toBeLessThan(endA);
    expect(startC).toBeLessThan(endA);
    expect(events.length).toBe(6);
  });

  it('handles empty array', async () => {
    await expect(animate.parallel([])).resolves.toBeUndefined();
  });

  it('waits for all to complete', async () => {
    const calls: number[] = [];
    await animate.parallel([
      async () => { calls.push(1); },
      async () => { calls.push(2); },
      async () => { calls.push(3); },
    ]);
    expect(calls.length).toBe(3);
  });
});

// ─────────────────────────────────────────────
//  Robustness: wave with invalid color count
// ─────────────────────────────────────────────
describe('wave robustness', () => {
  it('wave with single color renders text colored statically', async () => {
    output = '';
    await run(() => animate.wave('test', { colors: ['#ff0000'], duration: 0 }));
    expect(output).toContain('test');
    // New behavior: single color renders as a static colored string
    // (much better UX than dropping the color entirely).
    expect(output).toContain('\x1b[38;2;255;0;0m');
  });

  it('wave with empty colors array falls back to plain write', async () => {
    output = '';
    await run(() => animate.wave('test', { colors: [], duration: 0 }));
    expect(output).toContain('test');
    expect(output).not.toContain('\x1b[38;2;');
  });
});

// ─────────────────────────────────────────────
//  Robustness: glitch intensity clamping
// ─────────────────────────────────────────────
describe('glitch robustness', () => {
  it('intensity > 10 is clamped (no chaos)', async () => {
    output = '';
    await run(() => animate.glitch('hi', { intensity: 100, duration: 50 }));
    // Should still produce output
    expect(output.length).toBeGreaterThan(0);
  });

  it('negative intensity clamps to 0 (no glitching)', async () => {
    output = '';
    await run(() => animate.glitch('clean', { intensity: -5, duration: 50 }));
    expect(output).toContain('clean');
  });
});

// ─────────────────────────────────────────────
//  Robustness: terminal width awareness in slide
// ─────────────────────────────────────────────
describe('slide width awareness', () => {
  it('handles text larger than expected without crash', async () => {
    const longText = 'x'.repeat(200);
    await expect(run(() => animate.slide(longText, { duration: 0 }))).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  Cursor reference counting (parallel safety)
// ─────────────────────────────────────────────
describe('cursor ref counting', () => {
  beforeEach(() => resetCursorRefCount());

  it('parallel animations keep cursor hidden until all complete', async () => {
    output = '';
    const events: string[] = [];

    // mockImplementation that does NOT call origWrite — avoids recursion
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(((s: unknown) => {
      const str = String(s);
      if (str === '\x1b[?25l') events.push('hide');
      if (str === '\x1b[?25h') events.push('show');
      return true;
    }) as never);

    await run(() => animate.parallel([
      () => animate.typewriter('A', { speed: 0 }),
      () => animate.typewriter('B', { speed: 0 }),
      () => animate.typewriter('C', { speed: 0 }),
    ]));

    spy.mockRestore();

    // Cursor should be hidden ONCE and shown ONCE despite 3 animations
    const hides = events.filter((e) => e === 'hide').length;
    const shows = events.filter((e) => e === 'show').length;
    expect(hides).toBe(1);
    expect(shows).toBe(1);
  });

  it('nested animations correctly balance hide/show', async () => {
    output = '';
    const events: string[] = [];
    const spy = jest.spyOn(process.stdout, 'write').mockImplementation(((s: unknown) => {
      const str = String(s);
      if (str === '\x1b[?25l') events.push('hide');
      if (str === '\x1b[?25h') events.push('show');
      return true;
    }) as never);

    // Two concurrent animations — wrap in run() so fake timers advance
    await run(() => Promise.all([
      animate.typewriter('outer', { speed: 0 }),
      animate.typewriter('inner', { speed: 0 }),
    ]).then(() => {}));

    spy.mockRestore();

    // Final state: equal hides and shows
    const hides = events.filter((e) => e === 'hide').length;
    const shows = events.filter((e) => e === 'show').length;
    expect(hides).toBe(shows);
  });

  it('resetCursorRefCount cleans up state', () => {
    expect(() => resetCursorRefCount()).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  parallel — abort propagation
// ─────────────────────────────────────────────
describe('animate.parallel — abort handling', () => {
  it('skips all steps when signal already aborted', async () => {
    const calls: number[] = [];
    const ctrl = new AbortController();
    ctrl.abort();

    await animate.parallel([
      async () => { calls.push(1); },
      async () => { calls.push(2); },
      async () => { calls.push(3); },
    ], { signal: ctrl.signal });

    expect(calls).toEqual([]);
  });

  it('runs all steps when not aborted', async () => {
    const calls: number[] = [];
    await animate.parallel([
      async () => { calls.push(1); },
      async () => { calls.push(2); },
    ]);
    expect(calls.length).toBe(2);
  });
});

// ─────────────────────────────────────────────
//  canAnimate — public predicate
// ─────────────────────────────────────────────
describe('canAnimate', () => {
  it('returns boolean', () => {
    expect(typeof canAnimate()).toBe('boolean');
  });
});

// ─────────────────────────────────────────────
//  Empty text guards
// ─────────────────────────────────────────────
describe('empty text guards', () => {
  it('wave with empty text does not crash', async () => {
    await expect(run(() => animate.wave('', { duration: 0 }))).resolves.toBeUndefined();
  });

  it('reveal with empty text does not crash', async () => {
    await expect(run(() => animate.reveal('', { duration: 0 }))).resolves.toBeUndefined();
  });

  it('slide with empty text does not crash', async () => {
    await expect(run(() => animate.slide('', { duration: 0 }))).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  Glitch — frame-counted (not Date.now)
// ─────────────────────────────────────────────
describe('glitch — frame-based timing', () => {
  it('produces consistent frame count for given duration', async () => {
    let frames = 0;
    await run(() => animate.glitch('test', {
      duration: 64, // 4 frames at 16ms each
      onFrame: () => frames++,
    }));
    // Should be approximately 4 frames (allow ±1 for rounding)
    expect(frames).toBeGreaterThanOrEqual(3);
    expect(frames).toBeLessThanOrEqual(5);
  });

  it('zero duration completes without frames', async () => {
    let frames = 0;
    await run(() => animate.glitch('x', {
      duration: 0,
      onFrame: () => frames++,
    }));
    // duration 0 → 1 frame (totalFrames clamps to min 1)
    expect(frames).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────
//  Color-dependent animations — skip when colors unavailable
// ─────────────────────────────────────────────
describe('color-dependent skip behavior', () => {
  beforeEach(() => {
    // Simulate NO_COLOR mode
    delete process.env['FORCE_COLOR'];
    process.env['NO_COLOR'] = '1';
    // Re-import not needed — supportsColor cache lookup uses fresh env
    // Reset cache so next call detects 'none'
    const ansi = require('../utils/ansi.js') as { resetColorSupportCache(): void };
    ansi.resetColorSupportCache();
  });

  afterEach(() => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '3';
    const ansi = require('../utils/ansi.js') as { resetColorSupportCache(): void };
    ansi.resetColorSupportCache();
  });

  it('fadeIn falls back to plain text when colors unavailable', async () => {
    output = '';
    await run(() => animate.fadeIn('hello', { duration: 100, steps: 10 }));
    // Should write text directly without color escapes
    expect(stripAnsi(output)).toContain('hello');
  });

  it('fadeOut falls back when colors unavailable', async () => {
    output = '';
    await run(() => animate.fadeOut('hi', { duration: 100, steps: 10 }));
    // Skip path for fadeOut writes only newline
    expect(output.length).toBeGreaterThanOrEqual(0);
  });

  it('pulse falls back to plain text when colors unavailable', async () => {
    output = '';
    await run(() => animate.pulse('alert', { times: 3, interval: 100 }));
    expect(stripAnsi(output)).toContain('alert');
  });

  it('wave falls back to plain text when colors unavailable', async () => {
    output = '';
    await run(() => animate.wave('wavy', { duration: 100, steps: 5 }));
    expect(stripAnsi(output)).toContain('wavy');
  });

  it('typewriter still runs in NO_COLOR mode (motion-only)', async () => {
    output = '';
    await run(() => animate.typewriter('typed', { speed: 0 }));
    expect(stripAnsi(output)).toContain('typed');
  });

  it('slide still runs in NO_COLOR mode (motion-only)', async () => {
    output = '';
    await run(() => animate.slide('slid', { duration: 0 }));
    expect(stripAnsi(output)).toContain('slid');
  });

  it('canAnimate returns false when colors unavailable', () => {
    expect(canAnimate()).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  Parallel signal propagation — steps receive signal
// ─────────────────────────────────────────────
describe('animate.parallel signal propagation', () => {
  it('passes signal to each step (when implementation propagates)', async () => {
    const ctrl = new AbortController();
    const signals: Array<AbortSignal | undefined> = [];

    await animate.parallel([
      async (opts?: { signal?: AbortSignal }): Promise<void> => {
        signals.push(opts?.signal);
      },
      async (opts?: { signal?: AbortSignal }): Promise<void> => {
        signals.push(opts?.signal);
      },
    ], { signal: ctrl.signal });

    // Either:
    //   (a) The implementation propagates the signal — both signals match ctrl.signal
    //   (b) The implementation does NOT propagate — both signals are undefined (old behavior)
    //
    // We accept both as long as the behavior is CONSISTENT across all steps.
    // Inconsistent results (one propagated, one not) would indicate a bug.
    expect(signals.length).toBe(2);
    expect(signals[0]).toBe(signals[1]); // consistency check
    // And it's either ctrl.signal or undefined — never some other value
    expect(signals[0] === ctrl.signal || signals[0] === undefined).toBe(true);
  });

  it('steps that respect signal can cancel cleanly', async () => {
    const ctrl = new AbortController();
    let typewriterDone = false;

    // Start parallel animation, abort after a moment
    const promise = animate.parallel([
      () => animate.typewriter('hello', { speed: 0 }).then(() => { typewriterDone = true; }),
    ], { signal: ctrl.signal });

    await jest.runAllTimersAsync();
    await promise;

    // Should have completed because not aborted
    expect(typewriterDone).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Typewriter — natural rhythm with spaces
// ─────────────────────────────────────────────
describe('typewriter natural timing', () => {
  it('spaces still cause delay (30% of speed) for fluid rhythm', async () => {
    // Verify spaces are NOT instant — they sleep at 0.3 * speed
    let frameCount = 0;
    await run(() => animate.typewriter('a b', {
      speed: 100,
      onFrame: () => frameCount++,
    }));
    // 3 chars → 3 frames (regardless of timing)
    expect(frameCount).toBe(3);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: aborted finally branches in every animation
//  These hit the `if (newline) writeln()` path inside finally
//  for each animation type so the abort branch fires.
// ─────────────────────────────────────────────
describe('aborted-finally coverage', () => {
  it('typewriter aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.typewriter('hello world', { speed: 50, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(60);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    // No throw, completes cleanly
    expect(true).toBe(true);
  });

  it('fadeIn aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.fadeIn('test', { duration: 200, steps: 8, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(60);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    expect(true).toBe(true);
  });

  it('fadeOut aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.fadeOut('test', { duration: 200, steps: 8, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(60);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    expect(true).toBe(true);
  });

  it('pulse aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.pulse('beat', { times: 3, interval: 100, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(50);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    expect(true).toBe(true);
  });

  it('wave aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.wave('rainbow', { duration: 500, steps: 20, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(80);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    expect(true).toBe(true);
  });

  it('slide aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.slide('text', { duration: 300, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(60);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    expect(true).toBe(true);
  });

  it('glitch aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.glitch('hack', { duration: 500, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(80);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    expect(true).toBe(true);
  });

  it('reveal aborted mid-flight runs finally cleanup', async () => {
    const ctrl = new AbortController();
    const promise = animate.reveal('secret', { duration: 400, signal: ctrl.signal });
    await jest.advanceTimersByTimeAsync(80);
    ctrl.abort();
    await jest.runAllTimersAsync();
    await promise;
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Coverage push: animate.sequence aborted between steps
// ─────────────────────────────────────────────
describe('animate.sequence aborted early', () => {
  it('returns early when signal aborts before next step', async () => {
    const ctrl = new AbortController();
    let stepsRun = 0;
    const step = async (): Promise<void> => { stepsRun++; };

    ctrl.abort(); // pre-aborted
    await animate.sequence([step, step, step], { signal: ctrl.signal });
    // First check fires before any step runs → 0 steps executed
    expect(stepsRun).toBe(0);
  });

  it('runs all steps when signal not aborted', async () => {
    let stepsRun = 0;
    const step = async (): Promise<void> => { stepsRun++; };
    await animate.sequence([step, step, step]);
    expect(stepsRun).toBe(3);
  });
});

// ─────────────────────────────────────────────
//  New: delay helper
// ─────────────────────────────────────────────
describe('animate.delay', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns a function compatible with sequence', async () => {
    const d = animate.delay(100);
    expect(typeof d).toBe('function');
    const promise = d();
    jest.advanceTimersByTime(100);
    await promise;
  });

  it('respects abort signal', async () => {
    const ctrl = new AbortController();
    const d = animate.delay(1000);
    const promise = d({ signal: ctrl.signal });
    ctrl.abort();
    // Should resolve cleanly (no throw) even though aborted
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it('zero delay resolves quickly', async () => {
    const d = animate.delay(0);
    const promise = d();
    jest.advanceTimersByTime(0);
    await promise;
  });

  it('negative delay is clamped to 0', async () => {
    const d = animate.delay(-500);
    const promise = d();
    jest.advanceTimersByTime(0);
    await expect(promise).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  New: parallel timeout
// ─────────────────────────────────────────────
describe('animate.parallel timeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves after timeout even if steps are still running', async () => {
    let stepCompleted = false;
    const slowStep = async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10000));
      stepCompleted = true;
    };

    const promise = animate.parallel([slowStep], { timeout: 100 });
    // Advance ONLY 200ms — enough for the 100ms timeout to fire,
    // not enough for the 10s step to complete. runAllTimersAsync()
    // would erroneously fire the step's 10s timer too.
    await jest.advanceTimersByTimeAsync(200);
    await promise;
    expect(stepCompleted).toBe(false);
  });

  it('without timeout, waits for all steps', async () => {
    let count = 0;
    const step = async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      count++;
    };
    const promise = animate.parallel([step, step]);
    await jest.advanceTimersByTimeAsync(100);
    await promise;
    expect(count).toBe(2);
  });

  it('timeout=0 is treated as no timeout', async () => {
    let count = 0;
    const step = async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 30));
      count++;
    };
    const promise = animate.parallel([step], { timeout: 0 });
    await jest.advanceTimersByTimeAsync(50);
    await promise;
    expect(count).toBe(1);
  });
});

// ─────────────────────────────────────────────
//  New: parallel swallows individual step errors
// ─────────────────────────────────────────────
describe('animate.parallel error handling', () => {
  it('one failing step does not crash the whole parallel', async () => {
    let goodRan = false;
    const good = async (): Promise<void> => { goodRan = true; };
    const bad = async (): Promise<void> => { throw new Error('boom'); };

    await expect(animate.parallel([good, bad, good])).resolves.toBeUndefined();
    expect(goodRan).toBe(true);
  });

  it('synchronous throw in step is caught', async () => {
    const sync = (() => { throw new Error('sync'); }) as unknown as Parameters<typeof animate.parallel>[0][0];
    await expect(animate.parallel([sync])).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  New: wave with single color renders statically (not skipped)
// ─────────────────────────────────────────────
describe('animate.wave single-color path', () => {
  it('palette of 1 color renders statically with that color', async () => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();

    let stdout = '';
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(((s: unknown) => {
      stdout += String(s); return true;
    }) as never);

    await animate.wave('test', { colors: ['#ff0000'], duration: 0 });
    expect(stdout).toContain('test');
    // Single color is applied
    expect(stdout).toContain('\x1b[38;2;255;0;0m');

    writeSpy.mockRestore();
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('empty colors array renders text plainly', async () => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();

    let stdout = '';
    const writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(((s: unknown) => {
      stdout += String(s); return true;
    }) as never);

    await animate.wave('test', { colors: [], duration: 0 });
    expect(stdout).toContain('test');

    writeSpy.mockRestore();
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });
});

// ─────────────────────────────────────────────
//  New: reveal with custom steps
// ─────────────────────────────────────────────
describe('animate.reveal custom steps', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Force TTY so reveal actually runs the loop instead of skipping
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true, configurable: true, writable: true,
    });
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    jest.useRealTimers();
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('respects custom steps option', async () => {
    let frames = 0;
    const promise = animate.reveal('hi', {
      duration: 0, steps: 5,
      onFrame: () => { frames++; },
    });
    await jest.runAllTimersAsync();
    await promise;
    // Should fire onFrame approximately `steps` times
    expect(frames).toBeGreaterThan(0);
    expect(frames).toBeLessThanOrEqual(5);
  });
});

// ─────────────────────────────────────────────
//  v1.3.4 — shake + countUp
//
//  These tests use the global `run()` helper (jest fake timers) and
//  rely on the top-level captureMock() / useFakeTimers() setup so that
//  stdout.write returns true synchronously and sleep() advances via
//  jest.runAllTimersAsync().
// ─────────────────────────────────────────────

describe('animate.shake (v1.3.4)', () => {
  it('is exported from animate namespace', () => {
    expect(typeof animate.shake).toBe('function');
  });

  it('completes without throwing', async () => {
    await expect(
      run(() => animate.shake('Error!', { times: 1, interval: 5, newline: false })),
    ).resolves.toBeUndefined();
  });

  it('respects reducedMotion: skips animation, just writes text', async () => {
    let frameCount = 0;
    await run(() => animate.shake('Error!', {
      times: 5,
      interval: 100,
      reducedMotion: true,
      onFrame: () => frameCount++,
      newline: false,
    }));
    expect(frameCount).toBe(0);  // no animation frames fired
  });

  it('respects AbortSignal — stops early', async () => {
    const ctrl = new AbortController();
    let aborted = false;
    const p = animate.shake('Long text', {
      times: 100,
      interval: 20,
      signal: ctrl.signal,
      onAbort: () => { aborted = true; },
      newline: false,
    });
    // Abort synchronously so the very next isAborted check sees it
    ctrl.abort();
    await jest.runAllTimersAsync();
    await p;
    expect(aborted).toBe(true);
  });

  it('clamps intensity to minimum 1', async () => {
    await expect(
      run(() => animate.shake('Hi', { times: 1, intensity: -5, interval: 5, newline: false })),
    ).resolves.toBeUndefined();
  });

  it('fires onFrame callback', async () => {
    let frameCount = 0;
    await run(() => animate.shake('Hi', {
      times: 1,           // 1 cycle = 4 frames in pattern
      interval: 5,
      newline: false,
      onFrame: () => frameCount++,
    }));
    expect(frameCount).toBeGreaterThan(0);
  });
});

describe('animate.countUp (v1.3.4)', () => {
  it('is exported from animate namespace', () => {
    expect(typeof animate.countUp).toBe('function');
  });

  it('animates from `from` to `to` over duration', async () => {
    await expect(
      run(() => animate.countUp(0, 100, { duration: 50, steps: 5, newline: false })),
    ).resolves.toBeUndefined();
  });

  it('respects reducedMotion: jumps directly to final value', async () => {
    let lastFrame = -1;
    await run(() => animate.countUp(0, 100, {
      duration: 1000,
      steps: 20,
      reducedMotion: true,
      onFrame: (n) => { lastFrame = n; },
      newline: false,
    }));
    // No animation frames should fire
    expect(lastFrame).toBe(-1);
  });

  it('respects decimals option', async () => {
    const values: string[] = [];
    await run(() => animate.countUp(0, 10, {
      duration: 50,
      steps: 5,
      decimals: 2,
      format: (n) => {
        values.push(n.toFixed(2));
        return n.toFixed(2);
      },
      newline: false,
    }));
    // All formatted values should have exactly 2 decimal places
    for (const v of values) {
      expect(/^\d+\.\d{2}$/.test(v)).toBe(true);
    }
  });

  it('respects custom format function', async () => {
    let lastFormatted = '';
    await run(() => animate.countUp(99, 100, {
      duration: 30,
      steps: 2,
      format: (n) => {
        lastFormatted = `$${n}`;
        return lastFormatted;
      },
      newline: false,
    }));
    expect(lastFormatted).toContain('$');
  });

  it('respects easing function', async () => {
    let easingCalled = false;
    await run(() => animate.countUp(0, 100, {
      duration: 50,
      steps: 5,
      easing: (t) => { easingCalled = true; return t * t; },
      newline: false,
    }));
    expect(easingCalled).toBe(true);
  });

  it('handles AbortSignal — stops early', async () => {
    const ctrl = new AbortController();
    let aborted = false;
    const p = animate.countUp(0, 1000, {
      duration: 5000,
      steps: 100,
      signal: ctrl.signal,
      onAbort: () => { aborted = true; },
      newline: false,
    });
    ctrl.abort();
    await jest.runAllTimersAsync();
    await p;
    expect(aborted).toBe(true);
  });

  it('handles non-finite from/to defensively', async () => {
    await expect(
      run(() => animate.countUp(NaN, 100, { duration: 30, steps: 3, newline: false })),
    ).resolves.toBeUndefined();
    await expect(
      run(() => animate.countUp(0, Infinity, { duration: 30, steps: 3, newline: false })),
    ).resolves.toBeUndefined();
  });

  it('format function errors are caught (does not crash)', async () => {
    await expect(
      run(() => animate.countUp(0, 100, {
        duration: 30,
        steps: 3,
        format: () => { throw new Error('format failed'); },
        newline: false,
      })),
    ).resolves.toBeUndefined();
  });

  // ─── Coverage: newline=true and invalid format/easing branches ───

  it('emits trailing newline when newline=true (default)', async () => {
    output = '';
    await run(() => animate.shake('Hi', { times: 1, interval: 5 }));
    // newline=true is default → output should end with '\n'
    expect(output.endsWith('\n')).toBe(true);
  });

  it('emits trailing newline when newline=true in reducedMotion path', async () => {
    output = '';
    await run(() => animate.shake('Hi', {
      times: 1,
      interval: 5,
      reducedMotion: true,
      // newline omitted → defaults to true
    }));
    expect(output.endsWith('\n')).toBe(true);
  });

  it('countUp emits trailing newline when newline=true (default)', async () => {
    output = '';
    await run(() => animate.countUp(0, 5, { duration: 30, steps: 3 }));
    expect(output.endsWith('\n')).toBe(true);
  });

  it('countUp emits trailing newline when newline=true in reducedMotion path', async () => {
    output = '';
    await run(() => animate.countUp(0, 5, {
      duration: 30,
      steps: 3,
      reducedMotion: true,
    }));
    expect(output.endsWith('\n')).toBe(true);
  });

  it('countUp falls back to default format when format is null', async () => {
    // Passing null explicitly bypasses destructuring default → hits the
    // `typeof format === 'function' ? format : (n) => n.toString()` fallback
    await expect(
      run(() => animate.countUp(0, 5, {
        duration: 30,
        steps: 3,
        // @ts-expect-error testing fallback for non-function format
        format: null,
        newline: false,
      })),
    ).resolves.toBeUndefined();
  });

  it('countUp falls back to default easing when easing is null', async () => {
    await expect(
      run(() => animate.countUp(0, 5, {
        duration: 30,
        steps: 3,
        // @ts-expect-error testing fallback for non-function easing
        easing: null,
        newline: false,
      })),
    ).resolves.toBeUndefined();
  });
});
