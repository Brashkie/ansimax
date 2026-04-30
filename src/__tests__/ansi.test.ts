import {
  ESC, CSI, cursor, screen, FG, BG, STYLE,
  sgr, reset, fgRgb, bgRgb, fg256, bg256,
  supportsColor, write, writeln,
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
  const orig = { ...process.env };

  afterEach(() => {
    // Restore env
    for (const key of ['NO_COLOR', 'COLORTERM', 'TERM_PROGRAM', 'TERM']) {
      if (orig[key] === undefined) delete process.env[key];
      else process.env[key] = orig[key];
    }
  });

  it('returns none when NO_COLOR is set', () => {
    process.env['NO_COLOR'] = '1';
    expect(supportsColor()).toBe('none');
  });

  it('returns truecolor when COLORTERM=truecolor', () => {
    delete process.env['NO_COLOR'];
    process.env['COLORTERM'] = 'truecolor';
    expect(supportsColor()).toBe('truecolor');
  });

  it('returns truecolor when COLORTERM=24bit', () => {
    delete process.env['NO_COLOR'];
    process.env['COLORTERM'] = '24bit';
    expect(supportsColor()).toBe('truecolor');
  });

  it('returns truecolor when TERM_PROGRAM=iTerm.app', () => {
    delete process.env['NO_COLOR'];
    delete process.env['COLORTERM'];
    process.env['TERM_PROGRAM'] = 'iTerm.app';
    expect(supportsColor()).toBe('truecolor');
  });

  it('returns 256 when TERM contains 256color', () => {
    delete process.env['NO_COLOR'];
    delete process.env['COLORTERM'];
    delete process.env['TERM_PROGRAM'];
    process.env['TERM'] = 'xterm-256color';
    expect(supportsColor()).toBe('256');
  });

  it('returns basic as fallback', () => {
    delete process.env['NO_COLOR'];
    delete process.env['COLORTERM'];
    delete process.env['TERM_PROGRAM'];
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