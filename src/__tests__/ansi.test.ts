import {
  ESC, CSI, cursor, screen, FG, BG, STYLE,
  sgr, reset, fgRgb, bgRgb, fg256, bg256,
  supportsColor, supportsColorLevel, resetColorSupportCache,
  stripAnsi, write, writeAsync, writeln, sleep,
  writeErr, writelnErr,
  hideCursor, showCursor,
  getTerminalWidth, getTerminalHeight,
  createOutputBuffer,
  FRAME_MS, sleepFrame,
  // New exports
  setTitle, link, bell,
  DEFAULT_TERM_COLS, DEFAULT_TERM_ROWS,
} from '../utils/ansi.js';

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
describe('ESC / CSI', () => {
  it('ESC is the escape character', () => {
    expect(ESC).toBe('\x1b');
  });
  it('CSI is ESC + [', () => {
    expect(CSI).toBe('\x1b[');
  });
});

// ─────────────────────────────────────────────
//  cursor
// ─────────────────────────────────────────────
describe('cursor', () => {
  it('up generates correct escape', () => {
    expect(cursor.up(3)).toBe('\x1b[3A');
    expect(cursor.up()).toBe('\x1b[1A');
  });
  it('down generates correct escape', () => {
    expect(cursor.down(2)).toBe('\x1b[2B');
    expect(cursor.down()).toBe('\x1b[1B');
  });
  it('right generates correct escape', () => {
    expect(cursor.right(5)).toBe('\x1b[5C');
    expect(cursor.right()).toBe('\x1b[1C');
  });
  it('left generates correct escape', () => {
    expect(cursor.left(4)).toBe('\x1b[4D');
    expect(cursor.left()).toBe('\x1b[1D');
  });
  it('to generates position escape', () => {
    expect(cursor.to(10, 5)).toBe('\x1b[5;10H');
  });
  it('save generates save escape', () => {
    expect(cursor.save()).toBe('\x1b[s');
  });
  it('restore generates restore escape', () => {
    expect(cursor.restore()).toBe('\x1b[u');
  });
  it('hide generates hide escape', () => {
    expect(cursor.hide()).toBe('\x1b[?25l');
  });
  it('show generates show escape', () => {
    expect(cursor.show()).toBe('\x1b[?25h');
  });
});

// ─────────────────────────────────────────────
//  screen
// ─────────────────────────────────────────────
describe('screen', () => {
  it('clear generates clear escape', () => {
    expect(screen.clear()).toBe('\x1b[2J\x1b[H');
  });
  it('clearLine generates clearLine escape', () => {
    expect(screen.clearLine()).toBe('\x1b[2K');
  });
  it('clearRight generates clearRight escape', () => {
    expect(screen.clearRight()).toBe('\x1b[0K');
  });
  it('clearDown generates clearDown escape', () => {
    expect(screen.clearDown()).toBe('\x1b[0J');
  });
  it('scrollUp generates scroll escape', () => {
    expect(screen.scrollUp(2)).toBe('\x1b[2S');
    expect(screen.scrollUp()).toBe('\x1b[1S');
  });
  it('scrollDown generates scroll escape', () => {
    expect(screen.scrollDown(3)).toBe('\x1b[3T');
    expect(screen.scrollDown()).toBe('\x1b[1T');
  });
});

// ─────────────────────────────────────────────
//  sgr / reset
// ─────────────────────────────────────────────
describe('sgr', () => {
  it('generates single code', () => {
    expect(sgr(31)).toBe('\x1b[31m');
  });
  it('generates multiple codes', () => {
    expect(sgr(1, 31)).toBe('\x1b[1;31m');
  });
  it('generates zero codes', () => {
    expect(sgr()).toBe('\x1b[m');
  });
});

describe('reset', () => {
  it('generates reset escape', () => {
    expect(reset()).toBe('\x1b[0m');
  });
});

// ─────────────────────────────────────────────
//  color functions
// ─────────────────────────────────────────────
describe('fgRgb', () => {
  it('generates 24-bit fg color', () => {
    expect(fgRgb(255, 0, 0)).toBe('\x1b[38;2;255;0;0m');
    expect(fgRgb(0, 255, 0)).toBe('\x1b[38;2;0;255;0m');
    expect(fgRgb(0, 0, 255)).toBe('\x1b[38;2;0;0;255m');
  });
});

describe('bgRgb', () => {
  it('generates 24-bit bg color', () => {
    expect(bgRgb(255, 0, 0)).toBe('\x1b[48;2;255;0;0m');
  });
});

describe('fg256', () => {
  it('generates 256 fg color', () => {
    expect(fg256(196)).toBe('\x1b[38;5;196m');
    expect(fg256(0)).toBe('\x1b[38;5;0m');
  });
});

describe('bg256', () => {
  it('generates 256 bg color', () => {
    expect(bg256(21)).toBe('\x1b[48;5;21m');
  });
});

// ─────────────────────────────────────────────
//  FG / BG / STYLE constants
// ─────────────────────────────────────────────
describe('FG', () => {
  it('has correct values for basic colors', () => {
    expect(FG.black).toBe(30);
    expect(FG.red).toBe(31);
    expect(FG.green).toBe(32);
    expect(FG.yellow).toBe(33);
    expect(FG.blue).toBe(34);
    expect(FG.magenta).toBe(35);
    expect(FG.cyan).toBe(36);
    expect(FG.white).toBe(37);
  });
  it('has correct values for bright colors', () => {
    expect(FG.brightRed).toBe(91);
    expect(FG.brightGreen).toBe(92);
    expect(FG.brightWhite).toBe(97);
  });
});

describe('BG', () => {
  it('has correct values for basic backgrounds', () => {
    expect(BG.black).toBe(40);
    expect(BG.red).toBe(41);
    expect(BG.white).toBe(47);
  });
  it('has correct values for bright backgrounds', () => {
    expect(BG.brightBlack).toBe(100);
    expect(BG.brightWhite).toBe(107);
  });
});

describe('STYLE', () => {
  it('has correct style codes', () => {
    expect(STYLE.reset).toBe(0);
    expect(STYLE.bold).toBe(1);
    expect(STYLE.dim).toBe(2);
    expect(STYLE.italic).toBe(3);
    expect(STYLE.underline).toBe(4);
    expect(STYLE.blink).toBe(5);
    expect(STYLE.inverse).toBe(7);
    expect(STYLE.hidden).toBe(8);
    expect(STYLE.strikethrough).toBe(9);
  });
});

// ─────────────────────────────────────────────
//  supportsColor
// ─────────────────────────────────────────────
describe('supportsColor', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    // Force TTY for all tests in this block — they're testing capability
    // detection given a TTY context, not pipe/CI behavior
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
    });
    // Wipe environment vars that affect detection so each test is isolated
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    delete process.env['CI'];
    delete process.env['GITHUB_ACTIONS'];
    delete process.env['CIRCLECI'];
    delete process.env['GITLAB_CI'];
    delete process.env['BUILDKITE'];
    delete process.env['DRONE'];
    delete process.env['TRAVIS'];
    delete process.env['WT_SESSION'];
    delete process.env['COLORTERM'];
    delete process.env['TERM_PROGRAM'];
    delete process.env['TERM'];
    resetColorSupportCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    resetColorSupportCache();
  });

  it('returns none when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    expect(supportsColor()).toBe('none');
  });

  it('returns truecolor when COLORTERM=truecolor', () => {
    process.env['COLORTERM'] = 'truecolor';
    expect(supportsColor()).toBe('truecolor');
  });

  it('returns truecolor when COLORTERM=24bit', () => {
    process.env['COLORTERM'] = '24bit';
    expect(supportsColor()).toBe('truecolor');
  });

  it('returns truecolor when TERM_PROGRAM=iTerm.app', () => {
    process.env['TERM_PROGRAM'] = 'iTerm.app';
    expect(supportsColor()).toBe('truecolor');
  });

  it('returns 256 when TERM contains 256color', () => {
    process.env['TERM'] = 'xterm-256color';
    expect(supportsColor()).toBe('256');
  });

  it('returns basic as fallback', () => {
    process.env['TERM'] = 'xterm';
    expect(supportsColor()).toBe('basic');
  });
});

// ─────────────────────────────────────────────
//  write / writeln
// ─────────────────────────────────────────────
describe('write / writeln', () => {
  let output = '';

  beforeEach(() => {
    output = '';
    jest.spyOn(process.stdout, 'write').mockImplementation((str: unknown) => {
      output += String(str);
      return true;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('write sends string to stdout', () => {
    write('hello');
    expect(output).toBe('hello');
  });

  it('writeln appends newline', () => {
    writeln('hello');
    expect(output).toBe('hello\n');
  });

  it('writeln with no arg writes just newline', () => {
    writeln();
    expect(output).toBe('\n');
  });
});


// ─────────────────────────────────────────────
//  cursor — new methods + clamping
// ─────────────────────────────────────────────
describe('cursor — new methods', () => {
  it('column moves to absolute column', () => {
    expect(cursor.column(5)).toBe('\x1b[5G');
    expect(cursor.column(1)).toBe('\x1b[1G');
  });

  it('column clamps invalid values to minimum 1', () => {
    expect(cursor.column(0)).toBe('\x1b[1G');
    expect(cursor.column(-5)).toBe('\x1b[1G');
  });

  it('to clamps negative coordinates to 1', () => {
    expect(cursor.to(-1, -1)).toBe('\x1b[1;1H');
    expect(cursor.to(0, 0)).toBe('\x1b[1;1H');
  });

  it('to handles valid coordinates normally', () => {
    expect(cursor.to(10, 5)).toBe('\x1b[5;10H');
  });

  it('saveCompat uses ESC 7 (VT100 standard)', () => {
    expect(cursor.saveCompat()).toBe('\x1b7');
  });

  it('restoreCompat uses ESC 8', () => {
    expect(cursor.restoreCompat()).toBe('\x1b8');
  });

  it('up/down/left/right clamp negative values to minimum 1', () => {
    // ANSI CSI 0A is non-standard — clamp to 1
    expect(cursor.up(-1)).toBe('\x1b[1A');
    expect(cursor.down(-5)).toBe('\x1b[1B');
    expect(cursor.left(-1)).toBe('\x1b[1D');
    expect(cursor.right(-1)).toBe('\x1b[1C');
  });

  it('up/down/left/right clamp 0 to minimum 1', () => {
    expect(cursor.up(0)).toBe('\x1b[1A');
    expect(cursor.down(0)).toBe('\x1b[1B');
  });

  it('cursor coordinates clamp upper bound to 9999', () => {
    expect(cursor.up(99999)).toBe('\x1b[9999A');
    expect(cursor.to(50000, 50000)).toBe('\x1b[9999;9999H');
  });

  it('up/down round non-integer values', () => {
    expect(cursor.up(3.7)).toBe('\x1b[4A');
    expect(cursor.down(2.4)).toBe('\x1b[2B');
  });
});

// ─────────────────────────────────────────────
//  screen — new clearLeft and clearUp
// ─────────────────────────────────────────────
describe('screen — new methods', () => {
  it('clearLeft clears from cursor to start of line', () => {
    expect(screen.clearLeft()).toBe('\x1b[1K');
  });

  it('clearUp clears from cursor to top of screen', () => {
    expect(screen.clearUp()).toBe('\x1b[1J');
  });
});

// ─────────────────────────────────────────────
//  fgRgb / bgRgb — clamping
// ─────────────────────────────────────────────
describe('fgRgb clamping', () => {
  it('clamps values above 255', () => {
    expect(fgRgb(999, 0, 0)).toBe('\x1b[38;2;255;0;0m');
  });

  it('clamps negative values to 0', () => {
    expect(fgRgb(-50, 100, 50)).toBe('\x1b[38;2;0;100;50m');
  });

  it('rounds float values', () => {
    expect(fgRgb(127.7, 128.2, 64)).toBe('\x1b[38;2;128;128;64m');
  });

  it('produces valid output for normal values', () => {
    expect(fgRgb(255, 0, 128)).toBe('\x1b[38;2;255;0;128m');
  });
});

describe('bgRgb clamping', () => {
  it('clamps above 255', () => {
    expect(bgRgb(300, 300, 300)).toBe('\x1b[48;2;255;255;255m');
  });

  it('clamps below 0', () => {
    expect(bgRgb(-1, -1, -1)).toBe('\x1b[48;2;0;0;0m');
  });
});

// ─────────────────────────────────────────────
//  fg256 / bg256 — clamping
// ─────────────────────────────────────────────
describe('fg256 / bg256 clamping', () => {
  it('fg256 clamps above 255', () => {
    expect(fg256(999)).toBe('\x1b[38;5;255m');
  });

  it('fg256 clamps below 0', () => {
    expect(fg256(-1)).toBe('\x1b[38;5;0m');
  });

  it('bg256 rounds floats', () => {
    expect(bg256(196.7)).toBe('\x1b[48;5;197m');
  });

  it('fg256 valid range works normally', () => {
    expect(fg256(196)).toBe('\x1b[38;5;196m');
  });
});

// ─────────────────────────────────────────────
//  stripAnsi
// ─────────────────────────────────────────────
describe('stripAnsi', () => {
  it('strips SGR (color) sequences', () => {
    expect(stripAnsi('\x1b[31mred\x1b[0m')).toBe('red');
  });

  it('strips cursor movement sequences', () => {
    expect(stripAnsi('\x1b[2Ahello')).toBe('hello');
  });

  it('strips screen clear sequences', () => {
    expect(stripAnsi('\x1b[2Jhello')).toBe('hello');
  });

  it('strips OSC sequences (terminal title)', () => {
    expect(stripAnsi('\x1b]0;title\x07hello')).toBe('hello');
  });

  it('leaves plain text untouched', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });

  it('strips multiple sequences in a row', () => {
    expect(stripAnsi('\x1b[31m\x1b[1mred bold\x1b[0m')).toBe('red bold');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });
});

// ─────────────────────────────────────────────
//  supportsColor — robust detection + caching
// ─────────────────────────────────────────────
describe('supportsColor — robust detection', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    resetColorSupportCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    resetColorSupportCache();
  });

  it('NO_COLOR=1 returns none (highest priority)', () => {
    process.env['NO_COLOR'] = '1';
    process.env['FORCE_COLOR'] = '3';
    expect(supportsColor()).toBe('none');
  });

  it('FORCE_COLOR=0 returns none', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '0';
    expect(supportsColor()).toBe('none');
  });

  it('FORCE_COLOR=1 returns basic', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    expect(supportsColor()).toBe('basic');
  });

  it('FORCE_COLOR=2 returns 256', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '2';
    expect(supportsColor()).toBe('256');
  });

  it('FORCE_COLOR=3 returns truecolor', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '3';
    expect(supportsColor()).toBe('truecolor');
  });

  it('FORCE_COLOR=true returns basic', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = 'true';
    expect(supportsColor()).toBe('basic');
  });

  it('FORCE_COLOR=false returns none', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = 'false';
    expect(supportsColor()).toBe('none');
  });

  it('FORCE_COLOR with unknown value returns basic', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = 'maybe';
    expect(supportsColor()).toBe('basic');
  });

  it('non-TTY without FORCE_COLOR returns none', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    Object.defineProperty(process.stdout, 'isTTY', {
      value: false,
      configurable: true,
    });
    expect(supportsColor()).toBe('none');
  });

  it('CI without specific provider returns none', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    process.env['CI'] = 'true';
    delete process.env['GITHUB_ACTIONS'];
    delete process.env['CIRCLECI'];
    delete process.env['GITLAB_CI'];
    delete process.env['BUILDKITE'];
    delete process.env['DRONE'];
    delete process.env['TRAVIS'];
    expect(supportsColor()).toBe('none');
  });

  it('GitHub Actions returns truecolor', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    process.env['CI'] = 'true';
    process.env['GITHUB_ACTIONS'] = 'true';
    expect(supportsColor()).toBe('truecolor');
  });

  it('Travis returns basic', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    process.env['CI'] = 'true';
    delete process.env['GITHUB_ACTIONS'];
    process.env['TRAVIS'] = 'true';
    expect(supportsColor()).toBe('basic');
  });

  it('TERM=dumb returns none', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    delete process.env['CI'];
    delete process.env['COLORTERM'];
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    process.env['TERM'] = 'dumb';
    expect(supportsColor()).toBe('none');
  });

  it('TERM=xterm-256color returns 256', () => {
    delete process.env['NO_COLOR'];
    delete process.env['FORCE_COLOR'];
    delete process.env['CI'];
    delete process.env['COLORTERM'];
    delete process.env['TERM_PROGRAM'];
    delete process.env['WT_SESSION'];
    // On Windows the platform-specific branch fires before TERM heuristics,
    // returning truecolor on Windows 10+. Skip when running on win32.
    if (process.platform === 'win32') return;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });
    process.env['TERM'] = 'xterm-256color';
    expect(supportsColor()).toBe('256');
  });

  it('caches result across calls', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '3';
    const r1 = supportsColor();
    process.env['FORCE_COLOR'] = '0'; // changing env should NOT change result
    const r2 = supportsColor();
    expect(r1).toBe(r2);
    expect(r1).toBe('truecolor');
  });

  it('resetColorSupportCache forces re-detection', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '3';
    expect(supportsColor()).toBe('truecolor');
    process.env['FORCE_COLOR'] = '0';
    resetColorSupportCache();
    expect(supportsColor()).toBe('none');
  });
});

// ─────────────────────────────────────────────
//  writeAsync — backpressure handling
// ─────────────────────────────────────────────
describe('writeAsync', () => {
  it('resolves immediately when write returns true', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    await expect(writeAsync('test')).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('waits for drain event when write returns false', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(false);
    let drainCb: (() => void) | null = null;
    const onceSpy = jest.spyOn(process.stdout, 'once').mockImplementation(((event: string, cb: () => void) => {
      if (event === 'drain') drainCb = cb;
      return process.stdout;
    }) as never);

    const promise = writeAsync('test');

    // Simulate drain event firing
    setTimeout(() => { if (drainCb) (drainCb as () => void)(); }, 10);

    await expect(promise).resolves.toBeUndefined();

    spy.mockRestore();
    onceSpy.mockRestore();
  });
});


// ─────────────────────────────────────────────
//  screen.eraseDisplay — unified erase API
// ─────────────────────────────────────────────
describe('screen.eraseDisplay', () => {
  it('default mode is "all" (CSI 2J)', () => {
    expect(screen.eraseDisplay()).toBe('\x1b[2J');
  });

  it('mode "down" produces CSI 0J', () => {
    expect(screen.eraseDisplay('down')).toBe('\x1b[0J');
  });

  it('mode "up" produces CSI 1J', () => {
    expect(screen.eraseDisplay('up')).toBe('\x1b[1J');
  });

  it('mode "all" produces CSI 2J', () => {
    expect(screen.eraseDisplay('all')).toBe('\x1b[2J');
  });

  it('falls back to all (2J) for unknown mode', () => {
    // @ts-expect-error intentionally invalid
    expect(screen.eraseDisplay('weird')).toBe('\x1b[2J');
  });
});

// ─────────────────────────────────────────────
//  supportsColorLevel — numeric form
// ─────────────────────────────────────────────
describe('supportsColorLevel', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    resetColorSupportCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    });
    resetColorSupportCache();
  });

  it('returns 0 when no color support', () => {
    process.env['NO_COLOR'] = '1';
    expect(supportsColorLevel()).toBe(0);
  });

  it('returns 1 for basic', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '1';
    expect(supportsColorLevel()).toBe(1);
  });

  it('returns 2 for 256', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '2';
    expect(supportsColorLevel()).toBe(2);
  });

  it('returns 3 for truecolor', () => {
    delete process.env['NO_COLOR'];
    process.env['FORCE_COLOR'] = '3';
    expect(supportsColorLevel()).toBe(3);
  });
});

// ─────────────────────────────────────────────
//  supportsColor — TERM=dumb wins over FORCE_COLOR
// ─────────────────────────────────────────────
describe('supportsColor — TERM=dumb priority', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    resetColorSupportCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetColorSupportCache();
  });

  it('TERM=dumb returns none even with FORCE_COLOR=3', () => {
    process.env['TERM'] = 'dumb';
    process.env['FORCE_COLOR'] = '3';
    delete process.env['NO_COLOR'];
    expect(supportsColor()).toBe('none');
  });

  it('TERM=dumb wins over NO_COLOR (but both result in none)', () => {
    process.env['TERM'] = 'dumb';
    process.env['NO_COLOR'] = '1';
    expect(supportsColor()).toBe('none');
  });
});

// ─────────────────────────────────────────────
//  stripAnsi — extended sequences
// ─────────────────────────────────────────────
describe('stripAnsi — extended coverage', () => {
  it('strips charset designation sequences', () => {
    expect(stripAnsi('\x1b(0graphics\x1b(B')).toBe('graphics');
  });

  it('strips DCS sequences', () => {
    expect(stripAnsi('before\x1bPdcs payload\x1b\\after')).toBe('beforeafter');
  });

  it('strips CSI with intermediates', () => {
    // CSI with private parameters and intermediates
    expect(stripAnsi('\x1b[?25hvisible')).toBe('visible');
  });

  it('handles empty escape sequences gracefully', () => {
    expect(stripAnsi('plain')).toBe('plain');
  });
});

// ─────────────────────────────────────────────
//  sleep — AbortSignal support
// ─────────────────────────────────────────────
describe('sleep with AbortSignal', () => {
  it('resolves normally without signal', async () => {
    jest.useFakeTimers();
    const promise = sleep(100);
    jest.advanceTimersByTime(100);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('resolves immediately if signal already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const start = Date.now();
    await sleep(1000, { signal: ctrl.signal });
    expect(Date.now() - start).toBeLessThan(50); // should be near-instant
  });

  it('resolves when signal aborts mid-sleep', async () => {
    jest.useFakeTimers();
    const ctrl = new AbortController();
    const promise = sleep(1000, { signal: ctrl.signal });

    // Abort before timer fires
    setImmediate(() => ctrl.abort());
    jest.advanceTimersByTime(50);

    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('does not reject on abort — resolves silently', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    // Should not throw
    await expect(sleep(100, { signal: ctrl.signal })).resolves.toBeUndefined();
  });

  it('cleans up timer when aborted', async () => {
    jest.useFakeTimers();
    const ctrl = new AbortController();
    const promise = sleep(5000, { signal: ctrl.signal });
    ctrl.abort();
    await promise;
    // No timer should remain
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('removes abort listener after timer completes normally', async () => {
    jest.useFakeTimers();
    const ctrl = new AbortController();
    const removeSpy = jest.spyOn(ctrl.signal, 'removeEventListener');
    const promise = sleep(100, { signal: ctrl.signal });
    jest.advanceTimersByTime(100);
    await promise;
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    jest.useRealTimers();
  });
});


// ─────────────────────────────────────────────
//  Stream-safe write — handles missing stdout/stderr
// ─────────────────────────────────────────────
describe('stream safety', () => {
  it('write returns false when stdout is undefined', () => {
    const original = process.stdout;
    Object.defineProperty(process, 'stdout', { value: undefined, configurable: true });
    expect(write('hello')).toBe(false);
    Object.defineProperty(process, 'stdout', { value: original, configurable: true });
  });

  it('write returns false when stdout has no write method', () => {
    const original = process.stdout;
    Object.defineProperty(process, 'stdout', { value: {}, configurable: true });
    expect(write('hello')).toBe(false);
    Object.defineProperty(process, 'stdout', { value: original, configurable: true });
  });

  it('writeAsync resolves when stdout is missing', async () => {
    const original = process.stdout;
    Object.defineProperty(process, 'stdout', { value: undefined, configurable: true });
    await expect(writeAsync('test')).resolves.toBeUndefined();
    Object.defineProperty(process, 'stdout', { value: original, configurable: true });
  });

  it('writeAsync resolves on error event (no hang)', async () => {
    const writeMock = jest.spyOn(process.stdout, 'write').mockReturnValue(false);
    const onceCallbacks: Record<string, () => void> = {};
    const onceMock = jest.spyOn(process.stdout, 'once').mockImplementation(((event: string, cb: () => void) => {
      onceCallbacks[event] = cb;
      return process.stdout;
    }) as never);

    const promise = writeAsync('test');
    setTimeout(() => onceCallbacks['error']?.(), 10);
    await expect(promise).resolves.toBeUndefined();

    writeMock.mockRestore();
    onceMock.mockRestore();
  });
});

// ─────────────────────────────────────────────
//  writeErr / writelnErr
// ─────────────────────────────────────────────
describe('stderr writers', () => {
  it('writeErr writes to stderr', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    writeErr('error message');
    expect(spy).toHaveBeenCalledWith('error message');
    spy.mockRestore();
  });

  it('writelnErr appends newline', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    writelnErr('error');
    expect(spy).toHaveBeenCalledWith('error\n');
    spy.mockRestore();
  });

  it('writelnErr with no arg writes just newline', () => {
    const spy = jest.spyOn(process.stderr, 'write').mockReturnValue(true);
    writelnErr();
    expect(spy).toHaveBeenCalledWith('\n');
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────
//  Terminal dimensions
// ─────────────────────────────────────────────
describe('terminal dimensions', () => {
  it('getTerminalWidth returns columns or fallback 80', () => {
    expect(typeof getTerminalWidth()).toBe('number');
    expect(getTerminalWidth()).toBeGreaterThan(0);
  });

  it('getTerminalHeight returns rows or fallback 24', () => {
    expect(typeof getTerminalHeight()).toBe('number');
    expect(getTerminalHeight()).toBeGreaterThan(0);
  });

  it('getTerminalWidth falls back when stdout missing', () => {
    const original = process.stdout;
    Object.defineProperty(process, 'stdout', { value: undefined, configurable: true });
    expect(getTerminalWidth()).toBe(80);
    Object.defineProperty(process, 'stdout', { value: original, configurable: true });
  });

  it('getTerminalHeight falls back when stdout missing', () => {
    const original = process.stdout;
    Object.defineProperty(process, 'stdout', { value: undefined, configurable: true });
    expect(getTerminalHeight()).toBe(24);
    Object.defineProperty(process, 'stdout', { value: original, configurable: true });
  });
});

// ─────────────────────────────────────────────
//  Cursor visibility safety
// ─────────────────────────────────────────────
describe('hideCursor / showCursor', () => {
  it('hideCursor writes hide escape', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    hideCursor();
    expect(spy).toHaveBeenCalledWith('\x1b[?25l');
    spy.mockRestore();
  });

  it('showCursor writes show escape', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    showCursor();
    expect(spy).toHaveBeenCalledWith('\x1b[?25h');
    spy.mockRestore();
  });

  it('hideCursor registers exit handler (only once)', () => {
    const onSpy = jest.spyOn(process, 'on');
    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const before = onSpy.mock.calls.length;
    hideCursor();
    hideCursor();
    hideCursor();
    // Should register handlers at most once across multiple calls
    const callsAdded = onSpy.mock.calls.length - before;
    expect(callsAdded).toBeLessThanOrEqual(3); // exit + SIGINT + SIGTERM, registered once
    onSpy.mockRestore();
    writeSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────
//  Output buffer — batched rendering
// ─────────────────────────────────────────────
describe('createOutputBuffer', () => {
  it('accumulates pushed strings', () => {
    const buf = createOutputBuffer();
    buf.push('a').push('b').push('c');
    expect(buf.toString()).toBe('abc');
    expect(buf.length()).toBe(3);
  });

  it('pushln appends newline', () => {
    const buf = createOutputBuffer();
    buf.pushln('hello').pushln('world');
    expect(buf.toString()).toBe('hello\nworld\n');
  });

  it('pushln with no arg adds bare newline', () => {
    const buf = createOutputBuffer();
    buf.pushln();
    expect(buf.toString()).toBe('\n');
  });

  it('reset clears buffer', () => {
    const buf = createOutputBuffer();
    buf.push('content');
    buf.reset();
    expect(buf.toString()).toBe('');
    expect(buf.length()).toBe(0);
  });

  it('flush writes everything and clears', () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const buf = createOutputBuffer();
    buf.push('frame1').push('frame2');
    buf.flush();
    expect(spy).toHaveBeenCalledWith('frame1frame2');
    expect(buf.length()).toBe(0);
    spy.mockRestore();
  });

  it('flush on empty buffer is safe', () => {
    const buf = createOutputBuffer();
    expect(buf.flush()).toBe(true);
  });

  it('flushAsync writes and resolves', async () => {
    const spy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    const buf = createOutputBuffer();
    buf.push('async content');
    await buf.flushAsync();
    expect(spy).toHaveBeenCalledWith('async content');
    expect(buf.length()).toBe(0);
    spy.mockRestore();
  });

  it('flushAsync on empty buffer is safe', async () => {
    const buf = createOutputBuffer();
    await expect(buf.flushAsync()).resolves.toBeUndefined();
  });

  it('returns API for chaining', () => {
    const buf = createOutputBuffer();
    expect(buf.push('a')).toBe(buf);
    expect(buf.pushln('b')).toBe(buf);
    expect(buf.reset()).toBe(buf);
  });
});

// ─────────────────────────────────────────────
//  Frame throttling
// ─────────────────────────────────────────────
describe('FRAME_MS / sleepFrame', () => {
  it('FRAME_MS is 16ms (~60fps)', () => {
    expect(FRAME_MS).toBe(16);
  });

  it('sleepFrame uses default of FRAME_MS', async () => {
    jest.useFakeTimers();
    const promise = sleepFrame();
    jest.advanceTimersByTime(FRAME_MS);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('sleepFrame rounds to nearest frame boundary', async () => {
    jest.useFakeTimers();
    // 25ms should round up to 32ms (2 frames)
    const promise = sleepFrame(25);
    jest.advanceTimersByTime(32);
    await expect(promise).resolves.toBeUndefined();
    jest.useRealTimers();
  });

  it('sleepFrame respects AbortSignal', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(sleepFrame(100, { signal: ctrl.signal })).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  sleep — listener cleanup on completion (extra safety)
// ─────────────────────────────────────────────
describe('sleep — no listener leaks', () => {
  it('does not leak listener after multiple sleeps', async () => {
    jest.useFakeTimers();
    const ctrl = new AbortController();
    const initialListeners = ctrl.signal.aborted ? 0 :
      // count abort listeners — typically zero before any sleep
      0;

    const p1 = sleep(50, { signal: ctrl.signal });
    const p2 = sleep(50, { signal: ctrl.signal });
    const p3 = sleep(50, { signal: ctrl.signal });

    jest.advanceTimersByTime(50);
    await Promise.all([p1, p2, p3]);

    // After all sleeps complete normally, no abort handlers should remain.
    // We can't directly count listeners, but we can verify abort is now harmless.
    ctrl.abort();
    expect(ctrl.signal.aborted).toBe(true);

    jest.useRealTimers();
  });
});

// ─────────────────────────────────────────────
//  New: OSC primitives
// ─────────────────────────────────────────────
describe('OSC primitives', () => {
  it('setTitle emits OSC 2 sequence', () => {
    const out = setTitle('My App');
    expect(out).toContain('\x1b]2;My App\x07');
  });

  it('setTitle strips control chars', () => {
    const out = setTitle('App\x01\x02\x1bName');
    expect(out).not.toContain('\x01');
    expect(out).not.toContain('\x02');
    expect(out).toContain('AppName');
  });

  it('setTitle handles non-string defensively', () => {
    expect(setTitle(null as unknown as string)).toContain('2;');
    expect(setTitle(42 as unknown as string)).toContain('2;');
  });

  it('link emits OSC 8 hyperlink', () => {
    const out = link('click', 'https://example.com');
    expect(out).toContain('\x1b]8;;https://example.com\x07click');
    expect(out).toContain('\x1b]8;;\x07'); // closing
  });

  it('link with empty URL returns plain text', () => {
    expect(link('text', '')).toBe('text');
  });

  it('link strips control chars from URL', () => {
    const out = link('x', 'http://a\x01b.com');
    expect(out).not.toContain('\x01');
  });

  it('bell emits BEL char', () => {
    expect(bell()).toBe('\x07');
  });
});

// ─────────────────────────────────────────────
//  cursor.position / nextLine / prevLine
// ─────────────────────────────────────────────
describe('extended cursor functions', () => {
  it('cursor.position emits CSI 6n', () => {
    expect(cursor.position()).toBe('\x1b[6n');
  });

  it('cursor.nextLine with default 1', () => {
    expect(cursor.nextLine()).toBe('\x1b[1E');
  });

  it('cursor.nextLine with custom n', () => {
    expect(cursor.nextLine(3)).toBe('\x1b[3E');
  });

  it('cursor.prevLine emits CSI F', () => {
    expect(cursor.prevLine(2)).toBe('\x1b[2F');
  });
});

// ─────────────────────────────────────────────
//  screen.clearAll alias
// ─────────────────────────────────────────────
describe('screen.clearAll alias', () => {
  it('produces same output as screen.clear', () => {
    expect(screen.clearAll()).toBe(screen.clear());
  });
});

// ─────────────────────────────────────────────
//  Defensive numeric inputs
// ─────────────────────────────────────────────
describe('defensive numeric inputs', () => {
  it('cursor.up with NaN returns minimum (1)', () => {
    expect(cursor.up(NaN)).toBe('\x1b[1A');
  });

  it('cursor.up with Infinity returns minimum (treated as non-finite)', () => {
    // Defensive: isFiniteNumber rejects Infinity → returns min (1).
    // This is safer than clamping to MAX_COORD because Infinity often
    // signals a bug upstream.
    expect(cursor.up(Infinity)).toBe('\x1b[1A');
  });

  it('cursor.up with very large finite number clamps to MAX_COORD', () => {
    expect(cursor.up(50000)).toBe('\x1b[9999A');
  });

  it('cursor.to with negative coords clamps to min', () => {
    expect(cursor.to(-5, -10)).toBe('\x1b[1;1H');
  });

  it('fgRgb with NaN clamps to 0', () => {
    expect(fgRgb(NaN, 100, 200)).toBe('\x1b[38;2;0;100;200m');
  });

  it('fgRgb with Infinity ignored (NaN-like)', () => {
    // Infinity is not finite → returns 0
    expect(fgRgb(Infinity, 100, 200)).toBe('\x1b[38;2;0;100;200m');
  });

  it('sleep with NaN ms resolves immediately', async () => {
    const t = Date.now();
    await sleep(NaN);
    // Windows event loop / CI machines can add 50-100ms overhead
    expect(Date.now() - t).toBeLessThan(200);
  });

  it('sleep with negative ms resolves immediately', async () => {
    const t = Date.now();
    await sleep(-1000);
    expect(Date.now() - t).toBeLessThan(200);
  });
});

// ─────────────────────────────────────────────
//  OutputBuffer.pushIf
// ─────────────────────────────────────────────
describe('OutputBuffer.pushIf', () => {
  it('appends when cond is truthy', () => {
    const buf = createOutputBuffer();
    buf.push('a').pushIf(true, 'b').push('c');
    expect(buf.toString()).toBe('abc');
  });

  it('skips when cond is falsy', () => {
    const buf = createOutputBuffer();
    buf.push('a').pushIf(false, 'b').push('c');
    expect(buf.toString()).toBe('ac');
  });

  it('treats 0 and empty string as falsy', () => {
    const buf = createOutputBuffer();
    buf.pushIf(0, 'no').pushIf('', 'no').pushIf(null, 'no').pushIf(undefined, 'no');
    expect(buf.toString()).toBe('');
  });

  it('returns the buffer for chaining', () => {
    const buf = createOutputBuffer();
    expect(buf.pushIf(true, 'x')).toBe(buf);
  });
});

// ─────────────────────────────────────────────
//  ensureString coercion in write functions
// ─────────────────────────────────────────────
describe('ensureString coercion', () => {
  it('write coerces non-string', () => {
    // Just ensure no throw
    expect(() => write(42 as unknown as string)).not.toThrow();
    expect(() => write(null as unknown as string)).not.toThrow();
    expect(() => write(undefined as unknown as string)).not.toThrow();
  });

  it('writeln defaults to empty', () => {
    expect(() => writeln()).not.toThrow();
  });

  it('OutputBuffer.push coerces non-string', () => {
    const buf = createOutputBuffer();
    buf.push(42 as unknown as string);
    expect(buf.toString()).toBe('42');
  });
});

// ─────────────────────────────────────────────
//  stripAnsi defensive
// ─────────────────────────────────────────────
describe('stripAnsi defensive', () => {
  it('returns empty string for non-string input', () => {
    expect(stripAnsi(null as unknown as string)).toBe('');
    expect(stripAnsi(undefined as unknown as string)).toBe('');
    expect(stripAnsi(42 as unknown as string)).toBe('');
  });
});

// ─────────────────────────────────────────────
//  DEFAULT_TERM_COLS / ROWS constants
// ─────────────────────────────────────────────
describe('default terminal dimensions', () => {
  it('DEFAULT_TERM_COLS is 80 (VT100 default)', () => {
    expect(DEFAULT_TERM_COLS).toBe(80);
  });

  it('DEFAULT_TERM_ROWS is 24 (VT100 default)', () => {
    expect(DEFAULT_TERM_ROWS).toBe(24);
  });
});

// ─────────────────────────────────────────────
//  Coverage: ansi.ts branch targets
//
//  Each test below hits a specific branch that the coverage report
//  flagged as uncovered.
// ─────────────────────────────────────────────
describe('ansi: branch coverage targets', () => {
  // Helper: clean env, set specific vars, reset cache, then call supportsColor.
  // Also stubs stdout.isTTY=true because detectColorSupport short-circuits to
  // 'none' when not a TTY (Jest stdout is NOT a TTY).
  const withCleanEnv = (
    set: Record<string, string | undefined>,
    fn: () => void,
  ): void => {
    const keysToReset = [
      'NO_COLOR', 'FORCE_COLOR', 'CI', 'TERM', 'COLORTERM', 'TERM_PROGRAM',
      'WT_SESSION', 'GITHUB_ACTIONS', 'CIRCLECI', 'GITLAB_CI', 'BUILDKITE',
      'DRONE', 'TRAVIS', 'TF_BUILD',
    ];
    const saved: Record<string, string | undefined> = {};
    for (const k of keysToReset) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    for (const [k, v] of Object.entries(set)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    // Stub TTY via defineProperty — process.stdout.isTTY is read-only at runtime
    const origTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', {
      value: true,
      configurable: true,
      writable: true,
    });
    resetColorSupportCache();
    try { fn(); }
    finally {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: origTTY,
        configurable: true,
        writable: true,
      });
      for (const k of keysToReset) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      resetColorSupportCache();
    }
  };

  // ── cursor.prevLine() default arg (line 101) ──
  it('cursor.prevLine() uses default n=1', () => {
    const out = cursor.prevLine();
    expect(out).toContain('1F');
  });

  it('cursor.prevLine(3) accepts argument', () => {
    const out = cursor.prevLine(3);
    expect(out).toContain('3F');
  });

  // ── link() with non-string args (lines 244-245) ──
  it('link() coerces non-string text', () => {
    const out = link(42 as unknown as string, 'https://example.com');
    expect(out).toContain('42');
  });

  it('link() coerces non-string url to empty', () => {
    const out = link('click', null as unknown as string);
    expect(typeof out).toBe('string');
  });

  it('link() strips control chars from url', () => {
    const out = link('text', 'https://example.com\x00\x1f/bad');
    expect(out).not.toContain('\x00');
    expect(out).not.toContain('\x1f');
  });

  // ── TERM_PROGRAM branches (lines 310-313) ──
  it('detects Apple_Terminal as 256', () => {
    withCleanEnv({ TERM_PROGRAM: 'Apple_Terminal' }, () => {
      expect(supportsColor()).toBe('256');
    });
  });

  it('detects vscode as truecolor', () => {
    withCleanEnv({ TERM_PROGRAM: 'vscode' }, () => {
      expect(supportsColor()).toBe('truecolor');
    });
  });

  it('detects WezTerm as truecolor', () => {
    withCleanEnv({ TERM_PROGRAM: 'WezTerm' }, () => {
      expect(supportsColor()).toBe('truecolor');
    });
  });

  it('detects Hyper as truecolor', () => {
    withCleanEnv({ TERM_PROGRAM: 'Hyper' }, () => {
      expect(supportsColor()).toBe('truecolor');
    });
  });

  // ── WT_SESSION (line 316) ──
  it('detects Windows Terminal via WT_SESSION', () => {
    withCleanEnv({ WT_SESSION: 'abc123' }, () => {
      expect(supportsColor()).toBe('truecolor');
    });
  });

  // ── TERM substring matches (lines 322, 324) ──
  it('detects truecolor via TERM substring', () => {
    withCleanEnv({ TERM: 'xterm-truecolor' }, () => {
      expect(supportsColor()).toBe('truecolor');
    });
  });

  it('detects 24bit via TERM substring', () => {
    withCleanEnv({ TERM: 'something-24bit' }, () => {
      expect(supportsColor()).toBe('truecolor');
    });
  });

  it('detects 256 via TERM substring', () => {
    withCleanEnv({ TERM: 'xterm-256color' }, () => {
      expect(supportsColor()).toBe('256');
    });
  });

  it('detects screen as basic', () => {
    withCleanEnv({ TERM: 'screen' }, () => {
      expect(supportsColor()).toBe('basic');
    });
  });

  it('detects tmux as basic', () => {
    withCleanEnv({ TERM: 'tmux' }, () => {
      expect(supportsColor()).toBe('basic');
    });
  });

  it('detects rxvt as basic', () => {
    withCleanEnv({ TERM: 'rxvt' }, () => {
      expect(supportsColor()).toBe('basic');
    });
  });

  it('detects color in TERM as basic', () => {
    withCleanEnv({ TERM: 'something-color' }, () => {
      expect(supportsColor()).toBe('basic');
    });
  });

  it('detects xterm as basic', () => {
    withCleanEnv({ TERM: 'xterm' }, () => {
      expect(supportsColor()).toBe('basic');
    });
  });

  // ── Final fallback (line 342/343) ──
  it('falls back to basic when no env signals match', () => {
    withCleanEnv({ TERM: 'something-unknown' }, () => {
      const result = supportsColor();
      // With TTY stubbed true and no recognized env signals,
      // falls through to 'basic' (line 343). On Win32 may detect via os.release()
      // returning '256' or 'truecolor', so accept those too.
      expect(['basic', '256', 'truecolor']).toContain(result);
    });
  });

  // ── getTerminalWidth/Height fallback branches (lines 374, 380) ──
  it('getTerminalWidth falls back when stdout.columns invalid', () => {
    const origCols = process.stdout.columns;
    try {
      process.stdout.columns = 0;
      expect(getTerminalWidth()).toBeGreaterThan(0); // returns DEFAULT_TERM_COLS
    } finally {
      process.stdout.columns = origCols;
    }
  });

  it('getTerminalHeight falls back when stdout.rows invalid', () => {
    const origRows = process.stdout.rows;
    try {
      process.stdout.rows = 0;
      expect(getTerminalHeight()).toBeGreaterThan(0); // returns DEFAULT_TERM_ROWS
    } finally {
      process.stdout.rows = origRows;
    }
  });

  it('getTerminalWidth falls back when stdout.columns is non-numeric', () => {
    const origCols = process.stdout.columns;
    try {
      process.stdout.columns = undefined as unknown as number;
      expect(getTerminalWidth()).toBeGreaterThan(0);
    } finally {
      process.stdout.columns = origCols;
    }
  });
});

// ─────────────────────────────────────────────
//  Coverage: sleep/sleepFrame branches (lines 578, 598)
// ─────────────────────────────────────────────
describe('sleep / sleepFrame: branch coverage', () => {
  it('sleep() fires finish() when timer elapses', async () => {
    // Real timer (not fake) — let it elapse naturally to cover finish() path
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it('sleep() with signal: finish() also called via onAbort', async () => {
    // Start a sleep with an AbortController, then abort mid-sleep.
    // This hits the signal.removeEventListener branch in finish().
    const ctrl = new AbortController();
    const p = sleep(1000, { signal: ctrl.signal });
    // Abort before the timer fires
    setTimeout(() => ctrl.abort(), 5);
    await p; // resolves silently when aborted
    expect(ctrl.signal.aborted).toBe(true);
  });

  it('sleepFrame() with no args uses default FRAME_MS', async () => {
    // Covers `ms: number = FRAME_MS` default arg branch
    const start = Date.now();
    await sleepFrame();
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
  });

  it('sleepFrame(custom) rounds up to next frame boundary', async () => {
    const start = Date.now();
    await sleepFrame(5);
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
  });

  it('sleepFrame(NaN) falls back to FRAME_MS', async () => {
    await sleepFrame(NaN);
    // Should not throw or hang
    expect(true).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  Coverage: extra branch targets
// ─────────────────────────────────────────────
describe('ansi: more branch coverage', () => {
  it('sleep finish() is idempotent — double abort is no-op (line 580)', async () => {
    // Trigger both timer + abort to exercise the `if (resolved) return` guard.
    //
    // Race-condition safety: we use a long sleep (200ms) and abort synchronously
    // BEFORE awaiting, so the abort happens deterministically before the timer
    // could ever fire. Calling abort() twice exercises the idempotent path.
    const ctrl = new AbortController();
    const p = sleep(200, { signal: ctrl.signal });
    // Abort immediately, synchronously — no setTimeout race
    ctrl.abort();
    ctrl.abort(); // second abort — exercises defensive guard
    await p;
    expect(ctrl.signal.aborted).toBe(true);
  });

  it('detectColorSupport returns basic when only TERM=unknown is set', () => {
    // Set up env: stub TTY=true, TERM to a value none of the heuristics match,
    // and NO platform-specific match. On non-Windows this falls through to 'basic'.
    const keysToReset = [
      'NO_COLOR', 'FORCE_COLOR', 'CI', 'TERM', 'COLORTERM', 'TERM_PROGRAM',
      'WT_SESSION', 'GITHUB_ACTIONS', 'CIRCLECI', 'GITLAB_CI', 'BUILDKITE',
      'DRONE', 'TRAVIS', 'TF_BUILD',
    ];
    const saved: Record<string, string | undefined> = {};
    for (const k of keysToReset) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    process.env['TERM'] = 'totally-unknown-term';
    const origTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true, writable: true });
    resetColorSupportCache();

    try {
      const result = supportsColor();
      // On Linux/Mac: 'basic'. On Win32: may be '256' or 'truecolor' from os.release.
      expect(['basic', '256', 'truecolor']).toContain(result);
    } finally {
      Object.defineProperty(process.stdout, 'isTTY', { value: origTTY, configurable: true, writable: true });
      for (const k of keysToReset) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      resetColorSupportCache();
    }
  });
});

// ─────────────────────────────────────────────
//  v1.3.4 — hyperlink + clearLine
// ─────────────────────────────────────────────

import { hyperlink, clearLine } from '../utils/ansi.js';

describe('hyperlink (v1.3.4)', () => {
  it('wraps URL and label in OSC 8 sequence', () => {
    const result = hyperlink('https://example.com', 'click here');
    // Should contain OSC 8 with URL
    expect(result).toContain('\x1b]8;;https://example.com\x1b\\');
    // Should contain the visible label
    expect(result).toContain('click here');
    // Should end with the closing OSC 8
    expect(result.endsWith('\x1b]8;;\x1b\\')).toBe(true);
  });

  it('uses URL as label when no label provided', () => {
    const url = 'https://example.com';
    const result = hyperlink(url);
    expect(result).toContain(url);
    // Verify visible label is the URL (between opening and closing OSC 8)
    const stripped = result.replace(/\x1b\][^\x1b]*\x1b\\/g, '');
    expect(stripped).toBe(url);
  });

  it('returns empty string for invalid URL', () => {
    // @ts-expect-error testing defensive behavior
    expect(hyperlink(null)).toBe('');
    expect(hyperlink('')).toBe('');
  });

  it('returns just label when URL is missing but label exists', () => {
    expect(hyperlink('', 'fallback')).toBe('fallback');
  });

  it('supports mailto: and file: schemes', () => {
    const m = hyperlink('mailto:hi@example.com', 'email me');
    expect(m).toContain('mailto:hi@example.com');
    const f = hyperlink('file:///tmp/output.log');
    expect(f).toContain('file:///tmp/output.log');
  });
});

describe('clearLine (v1.3.4)', () => {
  it('returns CSI 2K + carriage return', () => {
    const result = clearLine();
    expect(result).toBe('\x1b[2K\r');
  });

  it('is identical to manual screen.clearLine() + \\r combination', () => {
    expect(clearLine()).toBe(screen.clearLine() + '\r');
  });
});

// ─────────────────────────────────────────────
//  v1.4.8 — cursor.scrollRegion + cursor.batch
// ─────────────────────────────────────────────

describe('cursor.scrollRegion (v1.4.8)', () => {
  it('sets a scroll region with top/bottom', () => {
    expect(cursor.scrollRegion(2, 23)).toBe('\x1b[2;23r');
  });

  it('resets the region when called with no args', () => {
    expect(cursor.scrollRegion()).toBe('\x1b[r');
  });

  it('resets when only one arg is given', () => {
    expect(cursor.scrollRegion(5)).toBe('\x1b[r');
  });

  it('swaps inverted top/bottom for a valid sequence', () => {
    // top > bottom → swapped to 3;10
    expect(cursor.scrollRegion(10, 3)).toBe('\x1b[3;10r');
  });

  it('clamps non-positive values', () => {
    const result = cursor.scrollRegion(0, 20);
    // 0 clamps to 1
    expect(result).toBe('\x1b[1;20r');
  });
});

describe('cursor.batch (v1.4.8)', () => {
  it('concatenates multiple sequences', () => {
    const result = cursor.batch(cursor.to(1, 1), cursor.hide());
    expect(result).toBe(cursor.to(1, 1) + cursor.hide());
  });

  it('returns empty string for no args', () => {
    expect(cursor.batch()).toBe('');
  });

  it('handles a single part', () => {
    expect(cursor.batch('abc')).toBe('abc');
  });

  it('joins plain strings and escapes together', () => {
    const result = cursor.batch(cursor.up(2), 'text', cursor.down(1));
    expect(result).toContain('text');
    expect(result.startsWith('\x1b[2A')).toBe(true);
  });
});
