import {
  table, badge, progressBar, status, section, columns, timeline, menu,
  MENU_CANCELLED,
  type MenuResult, type MenuInput, type MenuOutput,
} from '../components/index.js';
import { stripAnsi } from '../utils/helpers.js';
import { FG, BG } from '../utils/ansi.js';

// ─────────────────────────────────────────────
//  table — extra branches
// ─────────────────────────────────────────────
describe('table extra', () => {
  const rows = [['Name', 'Score'], ['Alice', '100'], ['Bob', '80']];

  it('header:false does not bold first row', () => {
    const result = table(rows, { header: false });
    // no bold escape on first row
    const lines = result.split('\n');
    expect(lines[1]).not.toContain('\x1b[1m');
  });

  it('padding:0 removes cell padding', () => {
    const noPad   = table([['A', 'B']], { padding: 0 });
    const withPad = table([['A', 'B']], { padding: 1 });
    expect(noPad.length).toBeLessThan(withPad.length);
  });

  it('padding:2 adds extra space', () => {
    const result = table([['X']], { padding: 2 });
    const inner = result.split('\n').find(l => l.includes('X')) ?? '';
    expect(inner).toContain('X');
    // strip any non-space, non-X chars (border glyphs) then compare
    expect(inner.replace(/[^\sX]/g, '')).toBe('  X  ');
  });

  it('all four border styles render without error', () => {
    const styles = ['single', 'double', 'rounded', 'heavy'] as const;
    for (const s of styles) {
      expect(() => table(rows, { borderStyle: s })).not.toThrow();
    }
  });

  it('single-row table (no header separator)', () => {
    const result = table([['Only']], { header: true });
    // No separator line since only 1 row
    expect(result).not.toContain('├');
  });

  it('cells with ANSI codes align correctly', () => {
    const colored = '\x1b[32mGreen\x1b[0m';
    const result = table([[colored, 'Plain']]);
    // should not crash and visible content should be present
    expect(stripAnsi(result)).toContain('Green');
    expect(stripAnsi(result)).toContain('Plain');
  });

  it('handles null/undefined cell values', () => {
    // @ts-expect-error testing nullish cells
    const result = table([[null, undefined, 'ok']]);
    expect(stripAnsi(result)).toContain('ok');
  });
});

// ─────────────────────────────────────────────
//  badge — custom options
// ─────────────────────────────────────────────
describe('badge extra', () => {
  it('uses custom labelBg and valueBg', () => {
    const result = badge('tag', 'val', { labelBg: BG.red, valueBg: BG.yellow });
    expect(result).toContain(String(BG.red));
    expect(result).toContain(String(BG.yellow));
  });

  it('uses custom labelFg and valueFg', () => {
    const result = badge('x', 'y', { labelFg: FG.black, valueFg: FG.black });
    expect(result).toContain(String(FG.black));
  });

  it('contains spaces around label and value', () => {
    const result = stripAnsi(badge('npm', '1.0.0'));
    expect(result).toBe(' npm  1.0.0 ');
  });
});

// ─────────────────────────────────────────────
//  progressBar — color branch
// ─────────────────────────────────────────────
describe('progressBar extra', () => {
  it('applies sgr color code when color is provided', () => {
    const result = progressBar(50, { color: FG.green });
    expect(result).toContain(String(FG.green));
  });

  it('no color code when color is null (default)', () => {
    const result = progressBar(50);
    expect(result).not.toContain('\x1b[32m');
  });
});

// ─────────────────────────────────────────────
//  section — options
// ─────────────────────────────────────────────
describe('section extra', () => {
  it('uses custom char', () => {
    const result = stripAnsi(section('X', { char: '=', width: 20 }));
    expect(result).toContain('=');
  });

  it('uses custom color code', () => {
    const result = section('X', { color: FG.red, width: 20 });
    expect(result).toContain(String(FG.red));
  });

  it('falls back to termSize width when width not specified', () => {
    const result = section('TITLE');
    expect(result).toContain('TITLE');
    expect(result.length).toBeGreaterThan('TITLE'.length);
  });

  it('title is bold', () => {
    const result = section('BOLD', { width: 30 });
    // sgr(STYLE.bold, colorCode) produces [1;36m — bold + color combined
    expect(result).toContain('\x1b[1;');
  });
});

// ─────────────────────────────────────────────
//  columns — extra
// ─────────────────────────────────────────────
describe('columns extra', () => {
  it('respects gap option', () => {
    const result = columns(['a', 'b'], { cols: 2, gap: 4, width: 20 });
    expect(result).toContain('    '); // 4 spaces gap
  });

  it('3 columns layout', () => {
    const result = columns(['a', 'b', 'c', 'd', 'e', 'f'], { cols: 3, width: 60 });
    expect(result.split('\n').length).toBe(2);
  });

  it('uses termSize when width not specified', () => {
    const result = columns(['x', 'y']);
    expect(typeof result).toBe('string');
  });

  it('handles odd number of items', () => {
    const result = columns(['a', 'b', 'c'], { cols: 2, width: 20 });
    expect(result.split('\n').length).toBe(2);
    expect(stripAnsi(result)).toContain('a');
    expect(stripAnsi(result)).toContain('c');
  });
});

// ─────────────────────────────────────────────
//  timeline — extra branches
// ─────────────────────────────────────────────
describe('timeline extra', () => {
  it('first undone event uses primary color not pending', () => {
    const result = timeline([
      { label: 'First', done: false },
      { label: 'Second', done: false },
    ]);
    expect(result).toContain('First');
    expect(result).toContain('Second');
  });

  it('done events use bold style', () => {
    const result = timeline([{ label: 'Done', done: true }]);
    expect(result).toContain('\x1b[1m');
  });

  it('no connector after last event', () => {
    const result = timeline([
      { label: 'A', done: true },
      { label: 'B', done: false },
    ]);
    const lines = result.split('\n');
    // Last line should be the last event node, not a connector
    expect(stripAnsi(lines[lines.length - 1] ?? '')).toContain('B');
  });

  it('custom connector and node chars', () => {
    const result = timeline(
      [{ label: 'X', done: true }, { label: 'Y', done: false }],
      { connector: '|', node: '◆' }
    );
    expect(stripAnsi(result)).toContain('◆');
    expect(stripAnsi(result)).toContain('|');
  });

  it('custom doneColor and pendingColor', () => {
    const result = timeline(
      [{ label: 'Done', done: true }, { label: 'Pending', done: false }],
      { doneColor: FG.magenta, pendingColor: FG.yellow }
    );
    expect(result).toContain(String(FG.magenta));
    expect(result).toContain(String(FG.yellow));
  });

  it('event without time does not show time', () => {
    const result = stripAnsi(timeline([{ label: 'NoTime', done: true }]));
    expect(result).toBe(`● NoTime`);
  });
});

// ─────────────────────────────────────────────
//  menu — non-TTY path (only safe path to test)
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
//  table — ?? fallback branches
// ─────────────────────────────────────────────
describe('table ?? branches', () => {
  it('falls back to rounded when unknown borderStyle passed', () => {
    // @ts-expect-error intentionally invalid style
    const result = table([['A', 'B']], { borderStyle: 'neon' });
    expect(result).toContain('╭'); // rounded fallback
  });

  it('rows[0]?.length ?? 0 — single row with no cells', () => {
    // Empty inner arrays produce a table with 0 columns — should not crash
    expect(() => table([[]])).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  status — ?? STATUS_MAP.info fallback
// ─────────────────────────────────────────────
describe('status ?? fallback', () => {
  it('falls back to info style for unknown type', () => {
    // @ts-expect-error intentionally invalid type
    const result = status('unknown', 'msg');
    // info icon is ℹ, color is FG.cyan (36)
    expect(result).toContain('ℹ');
    expect(result).toContain('msg');
  });
});

// ─────────────────────────────────────────────
//  menu — injected I/O
// ─────────────────────────────────────────────
describe('menu with injected I/O', () => {
  const { EventEmitter } = require('events');

  const ENTER  = '\r';
  const UP     = '\x1b[A';
  const DOWN   = '\x1b[B';
  const SPACE  = ' ';
  const CTRL_C = '\x03';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fakeInput: any;
  let outputStr: string;
  let fakeOutput: { write: (s: string) => void };
  let removeListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    outputStr = '';

    fakeInput = new EventEmitter();
    fakeInput.isTTY      = true;
    fakeInput.setRawMode = jest.fn().mockReturnValue(fakeInput);
    fakeInput.resume     = jest.fn().mockReturnValue(fakeInput);

    // jest.spyOn alone is safe — it wraps the original without replacing it.
    // The cycle only happens when mockImplementation calls the spied method again.
    // Here we just observe calls; the real EventEmitter.removeListener still runs.
    removeListenerSpy = jest.spyOn(fakeInput, 'removeListener');

    fakeOutput = { write: (s: string) => { outputStr += s; } };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // await Promise.resolve() yields to the microtask queue, guaranteeing
  // menu's on('data') listener is registered before keys fire.
  // More stable than process.nextTick in Jest's async environment.
  const sim = async (
    items: string[],
    keys: string[],
    opts: Record<string, unknown> = {},
  ): Promise<MenuResult> => {
    const promise = menu(items, {
      ...opts,
      input:  fakeInput  as unknown as MenuInput,
      output: fakeOutput as MenuOutput,
    });
    await Promise.resolve(); // yield — let menu register its on('data') listener
    for (const key of keys) fakeInput.emit('data', Buffer.from(key));
    return promise as Promise<MenuResult>;
  };

  // ── Guard ───────────────────────────────────
  it('returns MENU_CANCELLED when items is empty (defensive)', async () => {
    // menu() now returns MENU_CANCELLED for empty items rather than throwing —
    // safer for callers that may receive runtime-generated lists.
    const result = await menu([], {
      input:  fakeInput  as unknown as MenuInput,
      output: fakeOutput as MenuOutput,
    });
    expect(result).toBe(MENU_CANCELLED);
  });

  // ── Non-TTY fallback ────────────────────────
  it('non-TTY single-select returns 0', async () => {
    fakeInput.isTTY = false;
    const result = await menu(['A', 'B'], {
      input:  fakeInput  as unknown as MenuInput,
      output: fakeOutput as MenuOutput,
    });
    expect(result).toBe(0);
  });

  it('non-TTY multiSelect returns [] (no interaction = no selection)', async () => {
    fakeInput.isTTY = false;
    const result = await menu(['A', 'B'], {
      multiSelect: true,
      input:  fakeInput  as unknown as MenuInput,
      output: fakeOutput as MenuOutput,
    });
    expect(result).toEqual([]);
  });

  // ── Navigation ──────────────────────────────
  it('ENTER on first item resolves with 0', async () => {
    expect(await sim(['A', 'B', 'C'], [ENTER])).toBe(0);
  });

  it('DOWN + ENTER resolves with 1', async () => {
    expect(await sim(['A', 'B', 'C'], [DOWN, ENTER])).toBe(1);
  });

  it('DOWN DOWN UP ENTER resolves with 1', async () => {
    expect(await sim(['A', 'B', 'C'], [DOWN, DOWN, UP, ENTER])).toBe(1);
  });

  it('UP wraps to last item', async () => {
    expect(await sim(['A', 'B', 'C'], [UP, ENTER])).toBe(2);
  });

  it('DOWN wraps to first item', async () => {
    expect(await sim(['A', 'B', 'C'], [DOWN, DOWN, DOWN, ENTER])).toBe(0);
  });

  it('single item: UP always resolves with 0', async () => {
    expect(await sim(['Only'], [UP, ENTER])).toBe(0);
  });

  it('single item: DOWN always resolves with 0', async () => {
    expect(await sim(['Only'], [DOWN, ENTER])).toBe(0);
  });

  // ── Vim keybindings ─────────────────────────
  it('j moves down (vim)', async () => {
    expect(await sim(['A', 'B', 'C'], ['j', ENTER])).toBe(1);
  });

  it('k moves up (vim), wraps to last', async () => {
    expect(await sim(['A', 'B', 'C'], ['k', ENTER])).toBe(2);
  });

  it('s moves down (wasd)', async () => {
    expect(await sim(['A', 'B'], ['s', ENTER])).toBe(1);
  });

  it('w moves up (wasd), wraps to last', async () => {
    expect(await sim(['A', 'B'], ['w', ENTER])).toBe(1);
  });

  // ── Title ───────────────────────────────────
  it('renders title when provided', async () => {
    await sim(['A'], [ENTER], { title: 'Pick one' });
    expect(outputStr).toContain('Pick one');
  });

  // ── multiSelect ─────────────────────────────
  it('multiSelect: ENTER without SPACE auto-selects cursor (0)', async () => {
    const result = await sim(['A', 'B'], [ENTER], { multiSelect: true });
    expect(result).toEqual([0]);
  });

  it('multiSelect: SPACE selects, ENTER resolves array', async () => {
    const result = await sim(['A', 'B', 'C'], [SPACE, DOWN, SPACE, ENTER], { multiSelect: true });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain(0);
    expect(result).toContain(1);
  });

  it('multiSelect: SPACE twice deselects — auto-selects cursorPos', async () => {
    // SPACE selects 0, SPACE again deselects 0 → empty set → auto-selects cursorPos (0)
    const result = await sim(['A', 'B'], [SPACE, SPACE, ENTER], { multiSelect: true });
    expect(result).toEqual([0]);
  });

  // ── Ctrl+C ──────────────────────────────────
  it('Ctrl+C resolves with MENU_CANCELLED symbol', async () => {
    const { MENU_CANCELLED } = await import('../components/index.js');
    const result = await sim(['A', 'B'], [CTRL_C]);
    expect(result).toBe(MENU_CANCELLED);
  });

  // ── Cleanup / no memory leaks ────────────────
  it('removeListener called on ENTER (no memory leak)', async () => {
    await sim(['A'], [ENTER]);
    expect(removeListenerSpy).toHaveBeenCalledWith('data', expect.any(Function));
  });

  it('removeListener called on Ctrl+C (no memory leak)', async () => {
    await sim(['A'], [CTRL_C]);
    expect(removeListenerSpy).toHaveBeenCalledWith('data', expect.any(Function));
  });

  it('setRawMode(true) then setRawMode(false) on ENTER', async () => {
    await sim(['A'], [ENTER]);
    expect(fakeInput.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(fakeInput.setRawMode).toHaveBeenNthCalledWith(2, false);
  });

  it('setRawMode(false) called even on Ctrl+C', async () => {
    await sim(['A'], [CTRL_C]);
    expect(fakeInput.setRawMode).toHaveBeenCalledWith(false);
  });
});

// ─────────────────────────────────────────────
//  Final branch coverage — components/index.ts
// ─────────────────────────────────────────────

describe('table — renderRow default isHeader=false branch', () => {
  it('single row table never calls renderRow with isHeader=true (header branch false)', () => {
    // Only 1 row — ri===0 && header===true but rows.length===1 so no separator
    // renderRow is called with isHeader=true for ri===0, isHeader=false for ri>0
    const result = table([['A', 'B'], ['C', 'D'], ['E', 'F']], { header: true });
    // Rows 1 and 2 use isHeader=false → no bold escape on those rows
    const lines = result.split('\n');
    // Line 3 = row index 1 (0-indexed), should not contain bold
    expect(stripAnsi(lines[3] ?? '')).toContain('C');
    expect(lines[3]).not.toContain('\x1b[1m');
  });

  it('widths[ci] ?? 0 fallback — jagged row with fewer cells', () => {
    // Row has 3 cols but second row has 1 — widths[2] is defined but cell is empty
    // This exercises the widths[ci] ?? 0 path in padEnd
    const result = table([['A', 'B', 'C'], ['X']], { header: false });
    expect(stripAnsi(result)).toContain('A');
    expect(stripAnsi(result)).toContain('X');
  });
});

describe('columns — numCols < 1 clamps to default (defensive)', () => {
  it('cols:0 clamps to default (no throw)', () => {
    expect(() => columns(['a'], { cols: 0 })).not.toThrow();
    const result = columns(['a'], { cols: 0 });
    expect(typeof result).toBe('string');
  });

  it('cols:-1 clamps to default (no throw)', () => {
    expect(() => columns(['a'], { cols: -1 })).not.toThrow();
    const result = columns(['a'], { cols: -1 });
    expect(typeof result).toBe('string');
  });

  it('cols:NaN clamps to default (no throw)', () => {
    expect(() => columns(['a'], { cols: NaN })).not.toThrow();
  });
});

describe('menu — default process.stdin/stdout branches', () => {
  const { EventEmitter } = require('events');
  const origIsTTY = process.stdin.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', { value: origIsTTY, configurable: true });
    jest.restoreAllMocks();
  });

  it('non-TTY with default stdin resolves immediately', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    // No opts.input — uses process.stdin default (line 230)
    const result = await menu(['A', 'B']);
    expect(result).toBe(0);
  });

  it('default output writes to process.stdout (TTY path)', async () => {
    // To hit the default output branch (line 231), we need TTY=true so menu
    // actually calls emit() which calls out.write() → process.stdout.write()
    // Use a fake stdin with TTY=true but fire ENTER immediately
    const fakeInput = new EventEmitter();
    fakeInput.isTTY      = true;
    fakeInput.setRawMode = jest.fn().mockReturnValue(fakeInput);
    fakeInput.resume     = jest.fn().mockReturnValue(fakeInput);
    Object.defineProperty(process, 'stdin', { value: fakeInput, configurable: true });

    const writeSpy = jest.spyOn(process.stdout, 'write').mockReturnValue(true);

    // No opts.output — uses default { write: process.stdout.write } (line 231)
    const promise = menu(['A', 'B'], { input: fakeInput });
    await Promise.resolve();
    fakeInput.emit('data', Buffer.from('\r')); // ENTER
    const result = await promise;

    expect(writeSpy).toHaveBeenCalled(); // default output wrote to process.stdout
    expect(result).toBe(0);

    writeSpy.mockRestore();
    Object.defineProperty(process, 'stdin', { value: origIsTTY !== undefined ? process.stdin : fakeInput, configurable: true });
  });

  it('resolves to MENU_CANCELLED with default stdin when items empty', async () => {
    // menu() now returns MENU_CANCELLED for empty items rather than throwing —
    // covered with default opts (no input/output provided)
    const result = await menu([]);
    expect(result).toBe(MENU_CANCELLED);
  });
});

// ─────────────────────────────────────────────
//  menu — all tests via injected I/O
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
//  Components — remaining branch coverage
// ─────────────────────────────────────────────

describe('timeline — remaining branches', () => {
  it('first undone event uses colorCode (not pendingColor)', () => {
    // Line 185: i === 0 && !done → colorCode branch
    const result = timeline([
      { label: 'First undone', done: false },
      { label: 'Second undone', done: false },
    ]);
    // Both are undone; first uses FG.cyan (colorCode=36), second uses brightBlack (90)
    expect(result).toContain('\x1b[36m');  // colorCode = FG.cyan for first
    expect(result).toContain('\x1b[90m');  // pendingColor = FG.brightBlack for second
  });

  it('non-first undone event uses pendingColor', () => {
    const result = timeline([
      { label: 'Done',    done: true  },
      { label: 'Pending', done: false },
    ]);
    // Second item is not done and not i===0 → pendingColor branch
    expect(result).toContain('Pending');
  });
});

describe('table — renderRow header branch', () => {
  it('header:true bolds first row (renderRow isHeader=true branch)', () => {
    const result = table([['H1', 'H2'], ['A', 'B']], { header: true });
    // Bold escape in first row
    expect(result).toContain('\x1b[1m');
  });

  it('header:false does not bold any row (renderRow isHeader=false branch)', () => {
    const result = table([['A', 'B'], ['C', 'D']], { header: false });
    expect(result).not.toContain('\x1b[1m');
  });

  it('rowSep with separator row (header + multiple rows)', () => {
    // The middle separator (ml, cx, mr) is the third rowSep call
    const result = table([['A'], ['B']], { header: true });
    expect(result).toContain('├'); // ml from single border (fallback)
  });
});

describe('columns — remaining branches', () => {
  it('items that fill exactly numCols per row', () => {
    const result = columns(['a', 'b', 'c', 'd'], { cols: 2, width: 20 });
    expect(result.split('\n')).toHaveLength(2);
  });

  it('single item in columns', () => {
    const result = columns(['only'], { cols: 2, width: 20 });
    expect(stripAnsi(result)).toContain('only');
  });
});

describe('menu — remaining input branches', () => {
  const { EventEmitter } = require('events');

  let fakeInput: any;
  let outputStr: string;
  let fakeOutput: { write: (s: string) => void };

  beforeEach(() => {
    outputStr = '';
    fakeInput = new EventEmitter();
    fakeInput.isTTY      = true;
    fakeInput.setRawMode = jest.fn().mockReturnValue(fakeInput);
    fakeInput.resume     = jest.fn().mockReturnValue(fakeInput);
    fakeOutput = { write: (s: string) => { outputStr += s; } };
  });

  const sim = async (items: string[], keys: string[], opts = {}) => {
    const promise = menu(items, { ...opts, input: fakeInput, output: fakeOutput } as Parameters<typeof menu>[1]);
    await Promise.resolve();
    for (const key of keys) fakeInput.emit('data', Buffer.from(key));
    return promise;
  };

  it('SPACE when not multiSelect is ignored (branch: KEY_SPACE && multiSelect → false)', async () => {
    // Space pressed but not multiSelect — falls through to clearLines + render
    const result = await sim(['A', 'B'], [' ', '\r']);
    expect(result).toBe(0); // cursor stays at 0, space ignored
  });

  it('multiSelect renders ○ for unselected items', async () => {
    await sim(['A', 'B'], ['\r'], { multiSelect: true } as any);
    expect(outputStr).toContain('○');
  });

  it('multiSelect renders ● for selected items', async () => {
    await sim(['A', 'B'], [' ', '\r'], { multiSelect: true } as any);
    expect(outputStr).toContain('●');
  });

  it('unknown key is ignored gracefully', async () => {
    // Send a random key that is not UP/DOWN/ENTER/SPACE/CTRL_C
    const result = await sim(['A', 'B'], ['x', '\r']);
    expect(result).toBe(0); // x is vim down... actually test 'z' which is truly unknown
  });

  it('z key is truly unknown — cursor stays, renders again', async () => {
    const result = await sim(['A', 'B'], ['z', '\r']);
    expect(typeof result).toBe('number');
  });

  it('no setRawMode when input lacks it', async () => {
    fakeInput.setRawMode = undefined;
    const result = await sim(['A', 'B'], ['\r']);
    expect(result).toBe(0); // no crash when setRawMode is absent
  });
});