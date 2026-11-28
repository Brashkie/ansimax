import {
  datePrompt, formatISODate, formatTime,
  filePrompt, formPrompt, wizardPrompt,
  PROMPT_CANCELLED, PROMPT_BACK, wasBack,
} from '../prompts/index.js';
import { stripAnsi } from '../utils/helpers.js';
import type { FileEntry } from '../prompts/index.js';

// ─────────────────────────────────────────────
//  Phase 11 — calendar, file picker, form, wizard (v1.10.0)
//
//  The file picker's directory lister is injectable, which is most of why
//  these are testable: the tree below is a plain object, and no test here
//  touches a real filesystem or a real terminal.
// ─────────────────────────────────────────────

const { EventEmitter } = require('node:events') as typeof import('node:events');

interface Harness {
  input: {
    isTTY: boolean;
    setRawMode: (mode: boolean) => void;
    resume: () => void;
    setEncoding: (enc: string) => void;
    on: (event: string, listener: (...args: unknown[]) => void) => void;
    removeListener: (event: string, listener: (...args: unknown[]) => void) => void;
    emit: (event: string, ...args: unknown[]) => void;
  };
  output: { write: (s: string) => void };
  type: (...chunks: string[]) => void;
  written: () => string;
  frame: () => string[];
}

const harness = (isTTY = true): Harness => {
  const emitter = new EventEmitter();
  const input = emitter as unknown as Harness['input'];
  input.isTTY = isTTY;
  input.setRawMode = (): void => {};
  input.resume = (): void => {};
  input.setEncoding = (): void => {};

  let buffer = '';
  const output = { write: (s: string): void => { buffer += s; } };
  return {
    input,
    output,
    type: (...chunks: string[]): void => {
      for (const chunk of chunks) emitter.emit('data', chunk);
    },
    written: () => stripAnsi(buffer),
    frame: () => {
      const parts = buffer.split('\r');
      return stripAnsi(parts[parts.length - 1] as string)
        .split('\n')
        .filter((l) => l.trim().length > 0);
    },
  };
};

const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

const KEY = {
  up: '\x1b[A', down: '\x1b[B', left: '\x1b[D', right: '\x1b[C',
  shiftUp: '\x1b[1;2A', shiftDown: '\x1b[1;2B',
  pageUp: '\x1b[5~', pageDown: '\x1b[6~',
  home: '\x1b[H', end: '\x1b[F',
  enter: '\r', tab: '\t', shiftTab: '\x1b[Z', escape: '\x1b',
  backspace: '\x7f', ctrlC: '\x03', ctrlU: '\x15',
} as const;

const letters = (text: string): string[] => [...text];

describe('formatISODate / formatTime', () => {
  it('formats the one date layout nobody misreads', () => {
    expect(formatISODate(new Date(2026, 10, 28))).toBe('2026-11-28');
    expect(formatISODate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(formatISODate(new Date(2024, 1, 29))).toBe('2024-02-29');
  });

  it('formats a 24-hour clock with both parts padded', () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
    expect(formatTime(new Date(2026, 0, 1, 23, 59))).toBe('23:59');
    expect(formatTime(new Date(2026, 0, 1, 0, 0))).toBe('00:00');
  });
});

describe('datePrompt', () => {
  const nov28 = (): Date => new Date(2026, 10, 28);

  it('draws the month of the initial date, with it highlighted', async () => {
    const h = harness();
    const promise = datePrompt({ message: 'When', initial: nov28(), input: h.input, output: h.output });
    const shown = h.frame().join('\n');
    expect(shown).toContain('November 2026');
    expect(shown).toContain('2026-11-28');
    h.type(KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2026-11-28');
  });

  it('starts the week where asked, with the header to match', async () => {
    const sunday = harness();
    const p1 = datePrompt({ initial: nov28(), input: sunday.input, output: sunday.output });
    expect(sunday.frame()[2]).toContain('Su Mo');
    sunday.type(KEY.enter);
    await p1;

    const monday = harness();
    const p2 = datePrompt({ initial: nov28(), weekStart: 1, input: monday.input, output: monday.output });
    expect(monday.frame()[2]).toContain('Mo Tu');
    expect(monday.frame()[2]?.trim().endsWith('Su')).toBe(true);
    monday.type(KEY.enter);
    await p2;
  });

  it('moves a day with Left and Right', async () => {
    const h = harness();
    const promise = datePrompt({ initial: nov28(), input: h.input, output: h.output });
    h.type(KEY.right, KEY.right, KEY.left, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2026-11-29');
  });

  it('moves a week with Up and Down', async () => {
    const h = harness();
    const promise = datePrompt({ initial: nov28(), input: h.input, output: h.output });
    h.type(KEY.down, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2026-12-05');
  });

  it('moves a month with PageUp and PageDown', async () => {
    const h = harness();
    const promise = datePrompt({ initial: nov28(), input: h.input, output: h.output });
    h.type(KEY.pageDown, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2026-12-28');
  });

  it('clamps the day when the next month is shorter', async () => {
    // 31 January + 1 month is 28 February, not 3 March.
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 0, 31), input: h.input, output: h.output,
    });
    h.type(KEY.pageDown, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2026-02-28');
  });

  it('knows about leap years', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2024, 0, 31), input: h.input, output: h.output,
    });
    h.type(KEY.pageDown, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2024-02-29');

    // And 29 February a year later is the 28th.
    const h2 = harness();
    const p2 = datePrompt({
      initial: new Date(2024, 1, 29), input: h2.input, output: h2.output,
    });
    h2.type(KEY.shiftDown, KEY.enter);
    expect(formatISODate(await p2 as Date)).toBe('2025-02-28');
  });

  it('moves a year with Shift and an arrow', async () => {
    const h = harness();
    const promise = datePrompt({ initial: nov28(), input: h.input, output: h.output });
    h.type(KEY.shiftUp, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2025-11-28');
  });

  it('jumps to the ends of the month with Home and End', async () => {
    const h = harness();
    const promise = datePrompt({ initial: nov28(), input: h.input, output: h.output });
    h.type(KEY.home);
    expect(h.frame().join('')).toContain('2026-11-01');
    h.type(KEY.end);
    expect(h.frame().join('')).toContain('2026-11-30');
    h.type(KEY.enter);
    await promise;
  });

  it('jumps to today with t', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2000, 0, 1), input: h.input, output: h.output,
    });
    h.type('t', KEY.enter);
    const picked = await promise as Date;
    expect(formatISODate(picked)).toBe(formatISODate(new Date()));
  });

  it('refuses to move outside min and max', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: nov28(),
      min: new Date(2026, 10, 26),
      max: new Date(2026, 10, 30),
      input: h.input, output: h.output,
    });
    // Three Rights would reach the 1st of December; the cursor stops at the 30th.
    h.type(KEY.right, KEY.right, KEY.right, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2026-11-30');
  });

  it('pulls an out-of-range initial date into the range', async () => {
    const early = harness();
    const p1 = datePrompt({
      initial: new Date(2020, 0, 1), min: new Date(2026, 10, 10),
      input: early.input, output: early.output,
    });
    expect(early.frame().join('')).toContain('2026-11-10');
    early.type(KEY.enter);
    expect(formatISODate(await p1 as Date)).toBe('2026-11-10');

    const late = harness();
    const p2 = datePrompt({
      initial: new Date(2030, 0, 1), max: new Date(2026, 10, 20),
      input: late.input, output: late.output,
    });
    late.type(KEY.enter);
    expect(formatISODate(await p2 as Date)).toBe('2026-11-20');
  });

  it('runs a validator and shows what it said', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: nov28(),
      // 28 Nov 2026 is a Saturday.
      validate: (d) => (d.getDay() === 0 || d.getDay() === 6 ? 'weekdays only' : true),
      input: h.input, output: h.output,
    });
    h.type(KEY.enter);
    expect(h.frame().join(' ')).toContain('weekdays only');
    h.type(KEY.right, KEY.right, KEY.enter); // Monday the 30th
    expect(formatISODate(await promise as Date)).toBe('2026-11-30');
  });

  it('treats a validator that throws as a rejection', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: nov28(),
      validate: () => { throw new Error('calendar is closed'); },
      input: h.input, output: h.output,
    });
    h.type(KEY.enter);
    expect(h.frame().join(' ')).toContain('calendar is closed');
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('picks a time too when asked', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 28, 9, 0), time: true, minuteStep: 30,
      input: h.input, output: h.output,
    });
    expect(h.frame().join('')).toContain('09:00');
    h.type(KEY.tab, KEY.up, KEY.up); // hours
    h.type(KEY.tab, KEY.up); // minutes
    expect(h.frame().join('')).toContain('11:30');
    h.type(KEY.enter);
    const picked = await promise as Date;
    expect(formatTime(picked)).toBe('11:30');
    expect(formatISODate(picked)).toBe('2026-11-28');
  });

  it('cycles the clock focus with Tab and swaps it with the arrows', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 28, 9, 0), time: true, minuteStep: 15,
      input: h.input, output: h.output,
    });
    h.type(KEY.tab, KEY.right, KEY.up); // to hours, across to minutes, +15
    expect(h.frame().join('')).toContain('09:15');
    h.type(KEY.left, KEY.up); // back to hours, +1
    expect(h.frame().join('')).toContain('10:15');
    h.type(KEY.tab, KEY.tab, KEY.right, KEY.enter); // back to the date, +1 day
    expect(formatISODate(await promise as Date)).toBe('2026-11-29');
  });

  it('strips the time when time is off', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 28, 13, 45), input: h.input, output: h.output,
    });
    h.type(KEY.enter);
    const picked = await promise as Date;
    expect(picked.getHours()).toBe(0);
    expect(picked.getMinutes()).toBe(0);
  });

  it('takes localized day and month names', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: nov28(),
      dayNames: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
      monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
      input: h.input, output: h.output,
    });
    const shown = h.frame().join('\n');
    expect(shown).toContain('Noviembre 2026');
    expect(shown).toContain('Do Lu');
    h.type(KEY.enter);
    await promise;
  });

  it('ignores name arrays of the wrong length', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: nov28(),
      dayNames: ['only', 'two'],
      monthNames: ['one'],
      input: h.input, output: h.output,
    });
    expect(h.frame().join('\n')).toContain('November');
    h.type(KEY.enter);
    await promise;
  });

  it('ignores an invalid initial date and nonsense options', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date('not a date'),
      min: new Date('also not'),
      weekStart: 99 as 0,
      minuteStep: Number.NaN,
      input: h.input, output: h.output,
    });
    expect(h.frame()[2]).toContain('Su');
    h.type(KEY.enter);
    expect(await promise).toBeInstanceOf(Date);
  });

  it('cancels on Ctrl+C', async () => {
    const h = harness();
    const promise = datePrompt({ input: h.input, output: h.output });
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('resolves the cursor date with no TTY', async () => {
    const h = harness(false);
    const result = await datePrompt({ initial: nov28(), input: h.input, output: h.output });
    expect(formatISODate(result as Date)).toBe('2026-11-28');
  });
});

describe('filePrompt', () => {
  const tree: Record<string, FileEntry[]> = {
    '.': [
      { name: 'src', directory: true },
      { name: 'package.json', directory: false, size: 2838 },
      { name: 'README.md', directory: false, size: 132_721 },
      { name: '.git', directory: true },
      { name: '.env', directory: false, size: 40 },
    ],
    src: [
      { name: 'prompts', directory: true },
      { name: 'charts', directory: true },
      { name: 'index.ts', directory: false, size: 41_000 },
    ],
    'src/prompts': [
      { name: 'session.ts', directory: false, size: 8900 },
      { name: 'text.ts', directory: false, size: 19_000 },
    ],
  };
  const readDir = (path: string): readonly FileEntry[] => {
    const listed = tree[path];
    if (!listed) throw new Error(`ENOENT: ${path}`);
    return listed;
  };

  it('lists a directory, folders first', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    const shown = h.frame();
    expect(shown[1]).toContain('src');
    expect(shown.join('\n')).toContain('package.json');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('hides dotfiles unless asked', async () => {
    const hidden = harness();
    const p1 = filePrompt({ cwd: '.', readDir, input: hidden.input, output: hidden.output });
    expect(hidden.frame().join('\n')).not.toContain('.env');
    hidden.type(KEY.ctrlC);
    await p1;

    const shown = harness();
    const p2 = filePrompt({ cwd: '.', readDir, hidden: true, input: shown.input, output: shown.output });
    expect(shown.frame().join('\n')).toContain('.env');
    shown.type(KEY.ctrlC);
    await p2;
  });

  it('shows file sizes in human units', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    const shown = h.frame().join('\n');
    expect(shown).toContain('2.8 KB');
    expect(shown).toContain('129.6 KB');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('descends on Enter and picks a file', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    h.type(KEY.enter); // into src
    expect(h.frame()[0]).toContain('src');
    h.type(KEY.down, KEY.down, KEY.down, KEY.enter); // past .., charts, prompts → index.ts
    expect(await promise).toBe('src/index.ts');
  });

  it('descends on Right without picking', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: 'src', readDir, input: h.input, output: h.output });
    h.type(KEY.down, KEY.down, KEY.right); // onto prompts/, descend
    expect(h.frame()[0]).toContain('src/prompts');
    h.type(KEY.down, KEY.enter);
    expect(await promise).toBe('src/prompts/session.ts');
  });

  it('goes up with Left, Backspace and the .. entry', async () => {
    for (const key of [KEY.left, KEY.backspace]) {
      const h = harness();
      const promise = filePrompt({ cwd: 'src', readDir, input: h.input, output: h.output });
      h.type(key);
      expect(h.frame()[0]?.endsWith('.')).toBe(true);
      h.type(KEY.ctrlC);
      await promise;
    }

    const viaEntry = harness();
    const promise = filePrompt({ cwd: 'src', readDir, input: viaEntry.input, output: viaEntry.output });
    expect(viaEntry.frame()[1]).toContain('..');
    viaEntry.type(KEY.enter); // the .. entry is selected first
    expect(viaEntry.frame()[0]?.trim().endsWith('.')).toBe(true);
    viaEntry.type(KEY.ctrlC);
    await promise;
  });

  it('has no .. at the top of the tree', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    expect(h.frame().join('\n')).not.toContain('..');
    h.type(KEY.left); // nothing to go up to
    expect(h.frame()[0]).toContain('.');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('filters fuzzily as you type, and Escape clears it', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    h.type(...letters('pack'));
    expect(h.frame().join('\n')).toContain('package.json');
    expect(h.frame().join('\n')).not.toContain('README');
    h.type(KEY.escape);
    expect(h.frame().join('\n')).toContain('README');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('drops .. while filtering, so Enter does not go up by surprise', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: 'src', readDir, input: h.input, output: h.output });
    h.type(...letters('prom'));
    expect(h.frame().join('\n')).not.toContain('..');
    h.type(KEY.enter); // must descend into prompts/, not go up
    expect(h.frame()[0]).toContain('src/prompts');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('deletes from the query before it goes up a level', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: 'src', readDir, input: h.input, output: h.output });
    h.type(...letters('ind'), KEY.backspace);
    expect(h.frame()[0]).toContain('src'); // still in src
    expect(h.frame()[0]).toContain('/in');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('applies a file filter but never hides a directory', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.', readDir,
      filter: (e) => e.name.endsWith('.json'),
      input: h.input, output: h.output,
    });
    const shown = h.frame().join('\n');
    expect(shown).toContain('package.json');
    expect(shown).not.toContain('README.md');
    expect(shown).toContain('src'); // the way through the tree stays
    h.type(KEY.ctrlC);
    await promise;
  });

  it('treats a filter that throws as a rejection of that entry', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.', readDir,
      filter: () => { throw new Error('bad filter'); },
      input: h.input, output: h.output,
    });
    expect(h.frame().join('\n')).not.toContain('package.json');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('picks a directory in directory mode, and refuses a file', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.', readDir, directories: true, input: h.input, output: h.output,
    });
    h.type(KEY.down, KEY.enter); // package.json
    expect(h.frame().join(' ')).toContain('pick a directory');
    h.type(KEY.up, KEY.enter); // src
    expect(await promise).toBe('src');
  });

  it('wraps the cursor at both ends', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    h.type(KEY.up); // from the first entry, wrap to the last
    expect(h.frame().join('\n')).toMatch(/▶.*README\.md/);
    h.type(KEY.down); // and back round
    expect(h.frame().join('\n')).toMatch(/▶.*src/);
    h.type(KEY.ctrlC);
    await promise;
  });

  it('pages and jumps with PageUp, PageDown, Home and End', async () => {
    const many: FileEntry[] = Array.from({ length: 30 }, (_, i) => ({
      name: `file-${String(i).padStart(2, '0')}.txt`,
      directory: false,
      size: i,
    }));
    // `.` has no parent, so the listing is the 30 files and nothing else.
    const h = harness();
    const promise = filePrompt({
      cwd: '.', readDir: () => many, pageSize: 5, input: h.input, output: h.output,
    });
    h.type(KEY.end);
    expect(h.frame().join('\n')).toContain('30/30');
    h.type(KEY.home);
    expect(h.frame().join('\n')).toContain('1/30');
    h.type(KEY.pageDown);
    expect(h.frame().join('\n')).toContain('6/30');
    h.type(KEY.pageUp);
    expect(h.frame().join('\n')).toContain('1/30');
    h.type(KEY.enter);
    expect(await promise).toBe('file-00.txt');
  });

  it('shows the lister error instead of pretending the directory is empty', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: 'nope',
      readDir: () => { throw new Error('ENOENT: no such directory'); },
      input: h.input, output: h.output,
    });
    expect(h.frame().join(' ')).toContain('ENOENT');
    h.type(KEY.ctrlC);
    await promise;
  });

  it('says so when a directory is genuinely empty', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir: () => [], input: h.input, output: h.output });
    expect(h.frame().join(' ')).toContain('nothing here');
    h.type(KEY.enter); // nothing to pick
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('picks the directory itself when it is empty and directories are wanted', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.', readDir: () => [], directories: true, input: h.input, output: h.output,
    });
    h.type(KEY.enter);
    expect(await promise).toBe('.');
  });

  it('tolerates a lister that returns junk', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.',
      readDir: () => ([
        { name: 'ok', directory: false },
        null, undefined, { directory: true },
      ] as unknown as FileEntry[]),
      input: h.input, output: h.output,
    });
    expect(h.frame().join('\n')).toContain('ok');
    h.type(KEY.enter);
    expect(await promise).toBe('ok');
  });

  it('runs a validator on the chosen path', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.', readDir,
      validate: (p) => (p.endsWith('.md') ? 'not a markdown file' : true),
      input: h.input, output: h.output,
    });
    h.type(KEY.down, KEY.down, KEY.enter); // README.md
    expect(h.frame().join(' ')).toContain('not a markdown file');
    h.type(KEY.up, KEY.enter); // package.json
    expect(await promise).toBe('package.json');
  });

  it('takes a custom separator, and treats a drive root as a top', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: 'C:', separator: '\\',
      readDir: (p) => (p === 'C:'
        ? [{ name: 'Windows', directory: true }]
        : [{ name: 'notepad.exe', directory: false, size: 10 }]),
      input: h.input, output: h.output,
    });
    // No `..` at a drive root, so the first entry is the directory itself.
    expect(h.frame().join('\n')).not.toContain('..');
    h.type(KEY.right);
    expect(h.frame()[0]).toContain('C:\\Windows');
    // Inside the directory there *is* a way back up, so the file is second.
    expect(h.frame().join('\n')).toContain('..');
    h.type(KEY.down, KEY.enter);
    expect(await promise).toBe('C:\\Windows\\notepad.exe');
  });

  it('resolves the starting path with no TTY', async () => {
    const h = harness(false);
    expect(await filePrompt({ cwd: 'some/dir', readDir, input: h.input, output: h.output }))
      .toBe('some/dir');
  });
});

describe('formPrompt', () => {
  it('asks each field and keys the answers by name', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'name', type: 'text', message: 'Name' },
      { name: 'port', type: 'number', message: 'Port' },
      { name: 'ok', type: 'confirm', message: 'Sure?' },
    ], { input: h.input, output: h.output });

    await tick();
    h.type(...letters('ansimax'), KEY.enter);
    await tick();
    h.type(...letters('8080'), KEY.enter);
    await tick();
    h.type('y');

    expect(await promise).toEqual({ name: 'ansimax', port: 8080, ok: true });
  });

  it('prints a title and a tick per answered field', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'a', type: 'text', message: 'First' },
    ], { title: 'My form', input: h.input, output: h.output });
    await tick();
    h.type('x', KEY.enter);
    await promise;
    const log = h.written();
    expect(log).toContain('My form');
    expect(log).toContain('✔');
    expect(log).toContain('First');
  });

  it('numbers the fields when there are three or more', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'a', type: 'text' }, { name: 'b', type: 'text' }, { name: 'c', type: 'text' },
    ], { input: h.input, output: h.output });
    await tick();
    expect(h.frame().join('')).toContain('1/3');
    h.type(KEY.enter);
    await tick();
    expect(h.frame().join('')).toContain('2/3');
    h.type(KEY.enter);
    await tick();
    h.type(KEY.enter);
    await promise;
  });

  it('leaves the counter off a short form, and can be forced either way', async () => {
    const short = harness();
    const p1 = formPrompt([
      { name: 'a', type: 'text' }, { name: 'b', type: 'text' },
    ], { input: short.input, output: short.output });
    await tick();
    expect(short.frame().join('')).not.toContain('1/2');
    short.type(KEY.enter);
    await tick();
    short.type(KEY.enter);
    await p1;

    const forced = harness();
    const p2 = formPrompt([
      { name: 'a', type: 'text' }, { name: 'b', type: 'text' },
    ], { progress: true, input: forced.input, output: forced.output });
    await tick();
    expect(forced.frame().join('')).toContain('1/2');
    forced.type(KEY.enter);
    await tick();
    forced.type(KEY.enter);
    await p2;
  });

  it('skips a field whose condition is not met', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'private', type: 'confirm', message: 'Private?', initial: false },
      { name: 'org', type: 'text', message: 'Org', when: (a) => a.private === true },
      { name: 'done', type: 'confirm', message: 'Done?' },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('n'); // not private
    await tick();
    h.type('y'); // straight to 'done'
    const answers = await promise;
    expect(answers).toEqual({ private: false, done: true });
    expect(Object.keys(answers as object)).not.toContain('org');
  });

  it('asks a conditional field when the condition holds', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'private', type: 'confirm', message: 'Private?' },
      { name: 'org', type: 'text', message: 'Org', when: (a) => a.private === true },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('y');
    await tick();
    h.type(...letters('acme'), KEY.enter);
    expect(await promise).toEqual({ private: true, org: 'acme' });
  });

  it('treats a condition that throws as not met', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'a', type: 'text', message: 'A' },
      { name: 'b', type: 'text', when: () => { throw new Error('bad when'); } },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('x', KEY.enter);
    expect(await promise).toEqual({ a: 'x' });
  });

  it('steps back with Shift+Tab, keeping the earlier answer', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'a', type: 'text', message: 'A' },
      { name: 'b', type: 'text', message: 'B' },
      { name: 'c', type: 'text', message: 'C' },
    ], { input: h.input, output: h.output });
    await tick();
    h.type(...letters('one'), KEY.enter);
    await tick();
    h.type(...letters('two'), KEY.enter);
    await tick();
    h.type(KEY.shiftTab); // back to B
    await tick();
    expect(h.frame().join('')).toContain('two'); // its old answer is there
    h.type(...letters('!'), KEY.enter);
    await tick();
    h.type(...letters('three'), KEY.enter);
    expect(await promise).toEqual({ a: 'one', b: 'two!', c: 'three' });
  });

  it('offers no way back from the first field', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'a', type: 'text', message: 'A' },
      { name: 'b', type: 'text', message: 'B' },
    ], { input: h.input, output: h.output });
    await tick();
    h.type(KEY.shiftTab); // nothing happens
    h.type(...letters('x'), KEY.enter);
    await tick();
    h.type(...letters('y'), KEY.enter);
    expect(await promise).toEqual({ a: 'x', b: 'y' });
  });

  it('can have back turned off', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'a', type: 'text', message: 'A' },
      { name: 'b', type: 'text', message: 'B' },
    ], { back: false, input: h.input, output: h.output });
    await tick();
    h.type(...letters('x'), KEY.enter);
    await tick();
    h.type(KEY.shiftTab); // ignored
    h.type(...letters('y'), KEY.enter);
    expect(await promise).toEqual({ a: 'x', b: 'y' });
  });

  it('cancels the whole form when any field is cancelled', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'a', type: 'text' }, { name: 'b', type: 'text' },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('x', KEY.enter);
    await tick();
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('masks a password in the summary line', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'pw', type: 'password', message: 'Secret', meter: false },
    ], { input: h.input, output: h.output });
    await tick();
    h.type(...letters('hunter2'), KEY.enter);
    await promise;
    expect(h.written()).toContain('••••••••');
    expect(h.written()).not.toContain('hunter2');
  });

  it('summarizes dates and booleans readably', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'when', type: 'date', message: 'When', initial: new Date(2026, 10, 28) },
      { name: 'ok', type: 'confirm', message: 'OK?', initial: false },
    ], { input: h.input, output: h.output });
    await tick();
    h.type(KEY.enter);
    await tick();
    h.type(KEY.enter);
    await promise;
    const log = h.written();
    expect(log).toContain('2026-11-28');
    expect(log).toContain('no');
  });

  it('runs a file field through the picker', async () => {
    const h = harness();
    const promise = formPrompt([
      {
        name: 'config', type: 'file', message: 'Config',
        cwd: '.', readDir: () => [{ name: 'a.json', directory: false }],
      },
    ], { input: h.input, output: h.output });
    await tick();
    h.type(KEY.enter);
    expect(await promise).toEqual({ config: 'a.json' });
  });

  it('resolves an empty object for no fields', async () => {
    const h = harness();
    expect(await formPrompt([], { input: h.input, output: h.output })).toEqual({});
    expect(await formPrompt(null as unknown as [], { input: h.input, output: h.output })).toEqual({});
  });

  it('drops malformed field descriptors', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'ok', type: 'text', message: 'OK' },
      null as unknown as { name: string; type: 'text' },
      { type: 'text' } as unknown as { name: string; type: 'text' },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('x', KEY.enter);
    expect(await promise).toEqual({ ok: 'x' });
  });

  it('resolves each field default with no TTY', async () => {
    const h = harness(false);
    expect(await formPrompt([
      { name: 'a', type: 'text', initial: 'preset' },
      { name: 'n', type: 'number', initial: 5 },
      { name: 'b', type: 'confirm', initial: false },
    ], { input: h.input, output: h.output })).toEqual({ a: 'preset', n: 5, b: false });
  });
});

describe('wizardPrompt', () => {
  it('runs each step and merges the answers', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'One', fields: [{ name: 'a', type: 'text', message: 'A' }] },
      { title: 'Two', fields: [{ name: 'b', type: 'text', message: 'B' }] },
    ], { title: 'Setup', input: h.input, output: h.output });
    await tick();
    h.type(...letters('first'), KEY.enter);
    await tick();
    h.type(...letters('second'), KEY.enter);
    expect(await promise).toEqual({ a: 'first', b: 'second' });
  });

  it('prints the titles and a progress bar that fills', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'Alpha', fields: [{ name: 'a', type: 'text' }] },
      { title: 'Beta', fields: [{ name: 'b', type: 'text' }] },
    ], { title: 'Wizard', input: h.input, output: h.output });
    await tick();
    h.type(KEY.enter);
    await tick();
    h.type(KEY.enter);
    await promise;
    const log = h.written();
    expect(log).toContain('Wizard');
    expect(log).toContain('Alpha');
    expect(log).toContain('Beta');
    expect(log).toContain('0/2');
    expect(log).toContain('1/2');
    expect(log).toContain('2/2');
    expect(log).toContain('████████'); // full at the end
  });

  it('can run without the progress bar', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'Only', fields: [{ name: 'a', type: 'text' }] },
    ], { progress: false, input: h.input, output: h.output });
    await tick();
    h.type(KEY.enter);
    await promise;
    expect(h.written()).toContain('Only');
    expect(h.written()).not.toContain('1/1');
  });

  it('skips a step whose condition is not met', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'Deploy', fields: [{ name: 'deploy', type: 'confirm', message: 'Deploy?' }] },
      {
        title: 'Secrets',
        when: (a) => a.deploy === true,
        fields: [{ name: 'token', type: 'text', message: 'Token' }],
      },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('n');
    const answers = await promise;
    expect(answers).toEqual({ deploy: false });
    expect(h.written()).not.toContain('Secrets');
  });

  it('lets a later step depend on an earlier answer', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'A', fields: [{ name: 'deploy', type: 'confirm', message: 'Deploy?' }] },
      {
        title: 'B', when: (a) => a.deploy === true,
        fields: [{ name: 'host', type: 'text', message: 'Host' }],
      },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('y');
    await tick();
    h.type(...letters('prod'), KEY.enter);
    expect(await promise).toEqual({ deploy: true, host: 'prod' });
  });

  it('treats a step condition that throws as not met', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'A', fields: [{ name: 'a', type: 'text' }] },
      { title: 'B', when: () => { throw new Error('nope'); }, fields: [{ name: 'b', type: 'text' }] },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('x', KEY.enter);
    expect(await promise).toEqual({ a: 'x' });
  });

  it('cancels the whole wizard when a field is cancelled', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'A', fields: [{ name: 'a', type: 'text' }] },
      { title: 'B', fields: [{ name: 'b', type: 'text' }] },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('x', KEY.enter);
    await tick();
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('resolves an empty object for no steps', async () => {
    const h = harness();
    expect(await wizardPrompt([], { input: h.input, output: h.output })).toEqual({});
    expect(await wizardPrompt(null as unknown as [], { input: h.input, output: h.output })).toEqual({});
  });

  it('drops malformed steps', async () => {
    const h = harness();
    const promise = wizardPrompt([
      { title: 'Good', fields: [{ name: 'a', type: 'text' }] },
      null as unknown as { title: string; fields: [] },
      { title: 'No fields' } as unknown as { title: string; fields: [] },
    ], { input: h.input, output: h.output });
    await tick();
    h.type('x', KEY.enter);
    expect(await promise).toEqual({ a: 'x' });
  });
});

describe('PROMPT_BACK', () => {
  it('is its own sentinel, distinct from cancellation', () => {
    expect(PROMPT_BACK).not.toBe(PROMPT_CANCELLED);
    expect(wasBack(PROMPT_BACK)).toBe(true);
    expect(wasBack(PROMPT_CANCELLED)).toBe(false);
    expect(wasBack('')).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  The paths left over: the real `node:fs` lister, contradictory bounds, the
//  year jumps, and a form stepping back onto a non-text field.
// ─────────────────────────────────────────────

const fs = require('node:fs') as typeof import('node:fs');
const os = require('node:os') as typeof import('node:os');
const pathMod = require('node:path') as typeof import('node:path');

// A real directory on disk, shared by every test below that exercises the
// built-in `node:fs` lister. Its lifecycle is file-level on purpose: scoped to
// one describe, the afterAll would delete it before the later blocks ran.
let root = '';

beforeAll(() => {
  root = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'ansimax-file-'));
  fs.mkdirSync(pathMod.join(root, 'nested'));
  fs.writeFileSync(pathMod.join(root, 'a.txt'), 'hello');
  fs.writeFileSync(pathMod.join(root, 'nested', 'b.txt'), 'x'.repeat(2048));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('filePrompt — the node:fs fallback', () => {
  it('lists a real directory when no lister is given', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: root, input: h.input, output: h.output });
    const shown = h.frame().join('\n');
    expect(shown).toContain('nested');
    expect(shown).toContain('a.txt');
    expect(shown).toContain('5 B'); // the size came from statSync
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('descends into a real subdirectory and picks a real file', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: root, input: h.input, output: h.output });
    h.type(...letters('nest'), KEY.enter); // into nested/
    h.type(KEY.escape);                    // clear the filter
    h.type(...letters('b.t'), KEY.enter);
    // The default lister is node:fs, so the separator is the platform's —
    // a backslash on Windows, where `${root}/nested` would read wrong.
    expect(await promise).toBe(pathMod.join(root, 'nested', 'b.txt'));
  });

  it('reports a real ENOENT rather than an empty directory', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: pathMod.join(root, 'does-not-exist'), input: h.input, output: h.output,
    });
    expect(h.frame().join(' ')).toContain('ENOENT');
    h.type(KEY.ctrlC);
    await promise;
  });
});

describe('filePrompt — remaining keys', () => {
  const readDir = (): readonly FileEntry[] => [
    { name: 'my notes.md', directory: false, size: 10 },
    { name: 'other.md', directory: false, size: 10 },
  ];

  it('takes a space into the filter', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    h.type(...letters('my'), ' ', ...letters('not'));
    expect(h.frame().join('\n')).toContain('my notes.md');
    expect(h.frame().join('\n')).not.toContain('other.md');
    h.type(KEY.enter);
    expect(await promise).toBe('my notes.md');
  });

  it('ignores a key it has no meaning for', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '.', readDir, input: h.input, output: h.output });
    h.type('\x1bOP', KEY.ctrlU); // F1, Ctrl+U
    expect(h.frame().join('\n')).toContain('my notes.md');
    h.type(KEY.enter);
    expect(await promise).toBe('my notes.md');
  });

  it('has no .. at a filesystem or drive root', async () => {
    // `/` is its own last separator, so without the root check the listing
    // offers `..` and following it reloads `/` for ever.
    for (const [cwd, separator] of [['/', '/'], ['C:', '\\'], ['C:\\', '\\']] as const) {
      const h = harness();
      const promise = filePrompt({
        cwd, separator, readDir, input: h.input, output: h.output,
      });
      expect(h.frame().join('\n')).not.toContain('..');
      h.type(KEY.left); // nothing above the root
      expect(h.frame()[0]).toContain(cwd);
      h.type(KEY.ctrlC);
      expect(await promise).toBe(PROMPT_CANCELLED);
    }
  });

  it('still climbs out of a directory below the root', async () => {
    const h = harness();
    const promise = filePrompt({ cwd: '/usr/lib', readDir, input: h.input, output: h.output });
    h.type(KEY.left);
    expect(h.frame()[0]).toContain('/usr');
    h.type(KEY.left);
    expect(h.frame()[0]).toContain('/');
    expect(h.frame().join('\n')).not.toContain('..'); // and stops there
    h.type(KEY.ctrlC);
    await promise;
  });

  it('shows a validator error raised by a throw', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.', readDir,
      validate: () => { throw new Error('locked file'); },
      input: h.input, output: h.output,
    });
    h.type(KEY.enter);
    expect(h.frame().join(' ')).toContain('locked file');
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });
});

describe('datePrompt — remaining keys', () => {
  it('jumps a year with Shift and a page key', async () => {
    const up = harness();
    const p1 = datePrompt({
      initial: new Date(2026, 10, 28), input: up.input, output: up.output,
    });
    up.type(KEY.pageUp);
    expect(up.frame().join('')).toContain('2026-10-28');
    up.type('\x1b[5;2~'); // Shift+PageUp
    expect(up.frame().join('')).toContain('2025-10-28');
    up.type('\x1b[6;2~'); // Shift+PageDown
    expect(up.frame().join('')).toContain('2026-10-28');
    up.type(KEY.enter);
    expect(formatISODate(await p1 as Date)).toBe('2026-10-28');
  });

  it('moves a year forward with Shift+Down', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 28), input: h.input, output: h.output,
    });
    h.type(KEY.shiftDown, KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2027-11-28');
  });

  it('ignores a key the calendar has no meaning for', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 28), input: h.input, output: h.output,
    });
    h.type('z', '\x1bOP', KEY.enter);
    expect(formatISODate(await promise as Date)).toBe('2026-11-28');
  });

  it('refuses Enter when min and max contradict each other', async () => {
    // Nothing can satisfy max < min, so the prompt says so rather than
    // resolving a date it was told is out of range.
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 15),
      min: new Date(2026, 11, 1),
      max: new Date(2026, 9, 1),
      input: h.input, output: h.output,
    });
    h.type(KEY.enter);
    expect(h.frame().join(' ')).toContain('outside the allowed range');
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });
});

describe('formPrompt — stepping back onto every field type', () => {
  it('seeds a number, a confirm and a date with what they answered before', async () => {
    const h = harness();
    const promise = formPrompt([
      { name: 'port', type: 'number', message: 'Port' },
      { name: 'ok', type: 'confirm', message: 'OK?' },
      { name: 'when', type: 'date', message: 'When', initial: new Date(2026, 0, 1) },
      { name: 'tail', type: 'text', message: 'Tail' },
    ], { input: h.input, output: h.output });

    await tick();
    h.type(...letters('9090'), KEY.enter);
    await tick();
    h.type('n');                              // ok = false
    await tick();
    h.type(KEY.right, KEY.enter);             // when = 2026-01-02
    await tick();
    h.type(KEY.shiftTab);                     // back onto the date
    await tick();
    expect(h.frame().join('')).toContain('2026-01-02'); // its own answer, not the initial
    h.type(KEY.shiftTab);                     // back onto the confirm
    await tick();
    h.type(KEY.enter);                        // Enter takes the remembered 'no'
    await tick();
    h.type(KEY.shiftTab);                     // back again, now onto the number
    await tick();
    h.type(KEY.shiftTab);
    await tick();
    expect(h.frame().join('')).toContain('9090');
    h.type(KEY.enter);
    await tick();
    h.type('y');
    await tick();
    h.type(KEY.enter);
    await tick();
    h.type(...letters('end'), KEY.enter);

    const answers = await promise as Record<string, unknown>;
    expect(answers.port).toBe(9090);
    expect(answers.ok).toBe(true);
    expect(formatISODate(answers.when as Date)).toBe('2026-01-02');
    expect(answers.tail).toBe('end');
  });

  it('writes to stdout when given no output stream', async () => {
    const written: string[] = [];
    const real = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (chunk: string): boolean => {
      written.push(String(chunk));
      return true;
    };
    try {
      const h = harness(false); // non-TTY, so no key loop is needed
      const answers = await formPrompt(
        [{ name: 'a', type: 'text', message: 'A', initial: 'preset' }],
        { title: 'Headless', input: h.input },
      );
      expect(answers).toEqual({ a: 'preset' });
    } finally {
      (process.stdout as { write: unknown }).write = real;
    }
    const log = stripAnsi(written.join(''));
    expect(log).toContain('Headless');
    expect(log).toContain('preset');
  });
});

describe('datePrompt — the clock going down', () => {
  it('walks the hour and the minute backwards', async () => {
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 28, 9, 30), time: true, minuteStep: 15,
      input: h.input, output: h.output,
    });
    h.type(KEY.tab, KEY.down, KEY.down);   // hours: 09 → 07
    expect(h.frame().join('')).toContain('07:30');
    h.type(KEY.tab, KEY.down);             // minutes: 30 → 15
    expect(h.frame().join('')).toContain('07:15');
    h.type(KEY.enter);
    expect(formatTime(await promise as Date)).toBe('07:15');
  });

  it('refuses a clock move that would roll the day out of range', async () => {
    // Rolling back past midnight changes the day, which has to obey `min`
    // like any other move.
    const h = harness();
    const promise = datePrompt({
      initial: new Date(2026, 10, 28, 0, 0),
      min: new Date(2026, 10, 28),
      time: true, minuteStep: 30,
      input: h.input, output: h.output,
    });
    h.type(KEY.tab, KEY.tab, KEY.down);    // minutes down, which is 27 Nov
    expect(h.frame().join('')).toContain('2026-11-28 00:00');
    h.type(KEY.enter);
    const picked = await promise as Date;
    expect(formatISODate(picked)).toBe('2026-11-28');
    expect(formatTime(picked)).toBe('00:00');
  });
});

describe('filePrompt — sizes it cannot show', () => {
  it('leaves the size off an entry whose size makes no sense', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: '.',
      readDir: () => [
        { name: 'negative.bin', directory: false, size: -1 },
        { name: 'nonsense.bin', directory: false, size: Number.NaN },
        { name: 'real.bin', directory: false, size: 2048 },
      ],
      input: h.input, output: h.output,
    });
    const shown = h.frame().join('\n');
    expect(shown).toContain('negative.bin');
    expect(shown).toContain('nonsense.bin');
    expect(shown).toContain('2.0 KB');
    expect(shown).not.toContain('NaN');
    expect(shown).not.toContain('-1 B');
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });
});

describe('filePrompt — the separator default', () => {
  it("uses the platform's separator with the built-in lister", async () => {
    // A custom lister means the tree need not be a filesystem, so '/' stays
    // the default there. The node:fs lister is a filesystem by definition.
    const h = harness();
    const promise = filePrompt({ cwd: root, input: h.input, output: h.output });
    h.type(...letters('nest'), KEY.enter);
    expect(h.frame()[0]).toContain(pathMod.join(root, 'nested'));
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it("keeps '/' when a custom lister is given", async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: 'bucket',
      readDir: (p) => (p === 'bucket'
        ? [{ name: 'images', directory: true }]
        : [{ name: 'cat.png', directory: false, size: 1 }]),
      input: h.input, output: h.output,
    });
    h.type(KEY.down, KEY.right);   // past `..`, into images/
    expect(h.frame()[0]).toContain('bucket/images');
    h.type(KEY.down, KEY.enter);   // past `..`, onto cat.png
    expect(await promise).toBe('bucket/images/cat.png');
  });

  it('still takes an explicit separator over either default', async () => {
    const h = harness();
    const promise = filePrompt({
      cwd: 'C:', separator: '\\',
      readDir: (p) => (p === 'C:'
        ? [{ name: 'Windows', directory: true }]
        : [{ name: 'notepad.exe', directory: false, size: 1 }]),
      input: h.input, output: h.output,
    });
    h.type(KEY.right, KEY.down, KEY.enter);
    expect(await promise).toBe('C:\\Windows\\notepad.exe');
  });
});
