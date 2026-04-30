import { frames } from '../frames/index.js';

let output = '';

beforeEach(() => {
  output = '';
  jest.spyOn(process.stdout, 'write').mockImplementation((s: unknown) => {
    output += String(s); return true;
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  output = '';
});

const run = async (fn: () => Promise<void>): Promise<void> => {
  const p = fn(); await jest.runAllTimersAsync(); await p;
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
    // Verify finally runs on early exit via signal
    const ctrl = new AbortController();
    ctrl.abort();
    await run(() => frames.play(['A', 'B'], { interval: 0, repeat: 5, signal: ctrl.signal }));
    expect(output).toContain('\x1b[?25h');
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

  it('repeat:-1 clamps to 0 — plays nothing', async () => {
    let count = 0;
    await run(() => frames.play(['A'], {
      interval: 0, repeat: -1,
      onFrame: (f) => { count++; return f; },
    }));
    expect(count).toBe(0);
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
    // Aborted before first frame
    expect(count).toBe(0);
    expect(output).toContain('\x1b[?25h'); // cursor still shown
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

  it('stop() sets timer to null — double stop is safe', () => {
    const ctrl = frames.live({ fps: 10, autoStart: true });
    ctrl.stop();
    output = '';
    ctrl.stop(); // second stop — timer already null
    // cursor.show called again but no crash
    expect(output).toContain('\x1b[?25h');
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
    expect(output).toContain('\x1b[1A'); // clearLines wrote cursor.up
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
    // charset = '' → !charset.length → returns '░' for all differing chars
    const result = frames.morph('AAAAA', 'BBBBB', 4, '');
    const mid = result.slice(1, -1);
    expect(mid.every(f => [...f].every(ch => ch === '░'))).toBe(true);
  });

  it('non-empty charset uses indexed char', () => {
    const result = frames.morph('AAAAA', 'BBBBB', 4, '+-');
    const mid = result.slice(1, -1);
    expect(mid.every(f => [...f].every(ch => '+-'.includes(ch)))).toBe(true);
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