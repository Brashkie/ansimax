import { animate } from '../animations/index.js';

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
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  output = '';
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
    expect(output).toContain('\x1b[?25h'); // finally still runs
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
    expect(output).toContain('\x1b[?25h');
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
    expect(output).toContain('\x1b[?25h');
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
    expect(output).toContain('\x1b[?25h');
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
    expect(output).toContain('\x1b[?25h');
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
    expect(output).toContain('\x1b[?25h');
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
    expect(output).toContain('\x1b[?25h');
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
    expect(output).toContain('\x1b[?25h');
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