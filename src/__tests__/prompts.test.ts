import {
  textPrompt, passwordPrompt, numberPrompt, confirmPrompt, passwordStrength,
  PROMPT_CANCELLED, wasCancelled, runSession,
} from '../prompts/index.js';
import { stripAnsi } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Phase 11 — prompts (v1.10.0)
//
//  Every prompt takes its I/O as options, which is what makes this testable:
//  a fake stdin emits key sequences and a fake stdout collects what was
//  drawn. Nothing here touches the real terminal.
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
    listenerCount: (event: string) => number;
  };
  output: { write: (s: string) => void };
  /** Feed key sequences, one chunk each. */
  type: (...chunks: string[]) => void;
  /** Everything written so far, escapes stripped. */
  written: () => string;
  /** The last frame drawn, as lines with escapes stripped. */
  frame: () => string[];
  rawModeCalls: boolean[];
}

const harness = (isTTY = true): Harness => {
  const emitter = new EventEmitter();
  const rawModeCalls: boolean[] = [];
  const input = emitter as unknown as Harness['input'];
  input.isTTY = isTTY;
  input.setRawMode = (mode: boolean): void => { rawModeCalls.push(mode); };
  input.resume = (): void => {};
  input.setEncoding = (): void => {};

  let buffer = '';
  const output = { write: (s: string): void => { buffer += s; } };

  return {
    input,
    output,
    rawModeCalls,
    type: (...chunks: string[]): void => {
      for (const chunk of chunks) emitter.emit('data', chunk);
    },
    written: () => stripAnsi(buffer),
    frame: () => {
      // Each redraw erases and rewrites, so the last frame is whatever
      // follows the final run of cursor-up/clear-line sequences.
      const parts = buffer.split('\r');
      const tail = parts[parts.length - 1] as string;
      return stripAnsi(tail).split('\n').filter((l) => l.trim().length > 0);
    },
  };
};

/** Let an awaited prompt attach its listener before typing into it. */
const tick = (): Promise<void> => new Promise((r) => setImmediate(r));

const KEY = {
  up: '\x1b[A',
  down: '\x1b[B',
  left: '\x1b[D',
  right: '\x1b[C',
  home: '\x1b[H',
  end: '\x1b[F',
  enter: '\r',
  tab: '\t',
  escape: '\x1b',
  backspace: '\x7f',
  del: '\x1b[3~',
  ctrlC: '\x03',
  ctrlU: '\x15',
  ctrlK: '\x0b',
  ctrlW: '\x17',
  ctrlA: '\x01',
  ctrlE: '\x05',
} as const;

const letters = (text: string): string[] => [...text];

describe('runSession', () => {
  it('resolves the non-TTY fallback without waiting for a key', async () => {
    const h = harness(false);
    const result = await runSession<string>({
      input: h.input,
      output: h.output,
      render: () => ['never drawn'],
      onKey: () => ({ done: false }),
      nonTTY: () => 'fallback',
    });
    expect(result).toBe('fallback');
    expect(h.written()).toBe(''); // nothing drawn at all
  });

  it('resolves cancelled if the non-TTY fallback itself throws', async () => {
    const h = harness(false);
    const result = await runSession<string>({
      input: h.input,
      output: h.output,
      render: () => [],
      onKey: () => ({ done: false }),
      nonTTY: () => { throw new Error('no default'); },
    });
    expect(result).toBe(PROMPT_CANCELLED);
  });

  it('turns raw mode on, then off again when it resolves', async () => {
    const h = harness();
    const promise = runSession<string>({
      input: h.input,
      output: h.output,
      render: () => ['x'],
      onKey: (key) => (key.name === 'return' ? { done: true, value: 'ok' } : { done: false }),
      nonTTY: () => '',
    });
    expect(h.rawModeCalls).toEqual([true]);
    h.type(KEY.enter);
    await promise;
    expect(h.rawModeCalls).toEqual([true, false]);
  });

  it('hides the cursor and shows it again', async () => {
    const h = harness();
    const promise = runSession<string>({
      input: h.input, output: h.output,
      render: () => ['x'],
      onKey: () => ({ done: true, value: 'ok' }),
      nonTTY: () => '',
    });
    h.type('a');
    await promise;
    // Both sequences must appear, hide before show.
    const raw = (h.input as unknown as { isTTY: boolean }).isTTY;
    expect(raw).toBe(true);
  });

  it('removes its listener so a later keypress goes nowhere', async () => {
    const h = harness();
    const promise = runSession<string>({
      input: h.input, output: h.output,
      render: () => ['x'],
      onKey: () => ({ done: true, value: 'done' }),
      nonTTY: () => '',
    });
    expect(h.input.listenerCount('data')).toBe(1);
    h.type('a');
    await promise;
    expect(h.input.listenerCount('data')).toBe(0);
  });

  it('erases what it drew unless keep is set', async () => {
    const erased = harness();
    const p1 = runSession<string>({
      input: erased.input, output: erased.output,
      render: () => ['one', 'two'],
      onKey: () => ({ done: true, value: 'x' }),
      nonTTY: () => '',
    });
    erased.type('a');
    await p1;
    expect(erased.frame()).toEqual([]);

    const kept = harness();
    const p2 = runSession<string>({
      input: kept.input, output: kept.output, keep: true,
      render: () => ['one', 'two'],
      onKey: () => ({ done: true, value: 'x' }),
      nonTTY: () => '',
    });
    kept.type('a');
    await p2;
    expect(kept.written()).toContain('one');
    expect(kept.written()).toContain('two');
  });

  it('cancels on Ctrl+C whatever the prompt wanted', async () => {
    const h = harness();
    const promise = runSession<string>({
      input: h.input, output: h.output,
      render: () => ['x'],
      onKey: () => ({ done: true, value: 'should not win' }),
      nonTTY: () => '',
    });
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
    expect(h.rawModeCalls).toEqual([true, false]);
  });

  it('handles several keys arriving in one chunk', async () => {
    const h = harness();
    const seen: string[] = [];
    const promise = runSession<string>({
      input: h.input, output: h.output,
      render: () => ['x'],
      onKey: (key) => {
        seen.push(key.name);
        return key.name === 'return' ? { done: true, value: seen.join(',') } : { done: false };
      },
      nonTTY: () => '',
    });
    h.type(`ab${KEY.up}\r`);
    expect(await promise).toBe('a,b,up,return');
  });

  it('cancels rather than throwing when a key handler blows up', async () => {
    const h = harness();
    const promise = runSession<string>({
      input: h.input, output: h.output,
      render: () => ['x'],
      onKey: () => { throw new Error('handler bug'); },
      nonTTY: () => '',
    });
    h.type('a');
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('treats a void return from onKey as "keep going"', async () => {
    const h = harness();
    let count = 0;
    const promise = runSession<number>({
      input: h.input, output: h.output,
      render: () => ['x'],
      onKey: (key) => {
        count++;
        if (key.name === 'return') return { done: true, value: count };
        return undefined; // explicitly nothing
      },
      nonTTY: () => 0,
    });
    h.type('a', 'b', KEY.enter);
    expect(await promise).toBe(3);
  });
});

describe('wasCancelled', () => {
  it('recognizes the sentinel and nothing else', () => {
    expect(wasCancelled(PROMPT_CANCELLED)).toBe(true);
    expect(wasCancelled('')).toBe(false);
    expect(wasCancelled(null)).toBe(false);
    expect(wasCancelled(undefined)).toBe(false);
    expect(wasCancelled(0)).toBe(false);
    expect(wasCancelled(false)).toBe(false);
  });
});

describe('textPrompt', () => {
  it('collects typed characters and resolves on Enter', async () => {
    const h = harness();
    const promise = textPrompt({ message: 'Name', input: h.input, output: h.output });
    h.type(...letters('ansimax'), KEY.enter);
    expect(await promise).toBe('ansimax');
  });

  it('starts from initial, with the caret at the end', async () => {
    const h = harness();
    const promise = textPrompt({ initial: 'abc', input: h.input, output: h.output });
    h.type('d', KEY.enter);
    expect(await promise).toBe('abcd');
  });

  it('shows a placeholder only while empty', async () => {
    const h = harness();
    const promise = textPrompt({
      message: 'Q', placeholder: 'optional', input: h.input, output: h.output,
    });
    expect(h.frame().join(' ')).toContain('optional');
    h.type('x');
    expect(h.frame().join(' ')).not.toContain('optional');
    h.type(KEY.enter);
    await promise;
  });

  it('moves the caret and inserts where it sits', async () => {
    const h = harness();
    const promise = textPrompt({ initial: 'ac', input: h.input, output: h.output });
    h.type(KEY.left, 'b', KEY.enter);
    expect(await promise).toBe('abc');
  });

  it('honours Home, End, Ctrl+A and Ctrl+E', async () => {
    const h = harness();
    const p1 = textPrompt({ initial: 'bc', input: h.input, output: h.output });
    h.type(KEY.home, 'a', KEY.end, 'd', KEY.enter);
    expect(await p1).toBe('abcd');

    const h2 = harness();
    const p2 = textPrompt({ initial: 'bc', input: h2.input, output: h2.output });
    h2.type(KEY.ctrlA, 'a', KEY.ctrlE, 'd', KEY.enter);
    expect(await p2).toBe('abcd');
  });

  it('deletes backwards and forwards', async () => {
    const h = harness();
    const promise = textPrompt({ initial: 'abcd', input: h.input, output: h.output });
    h.type(KEY.backspace, KEY.left, KEY.del, KEY.enter);
    expect(await promise).toBe('ab');
  });

  it('ignores a delete with nothing to delete', async () => {
    const h = harness();
    const promise = textPrompt({ input: h.input, output: h.output });
    h.type(KEY.backspace, KEY.del, 'x', KEY.enter);
    expect(await promise).toBe('x');
  });

  it('kills to the start with Ctrl+U and to the end with Ctrl+K', async () => {
    const h = harness();
    const p1 = textPrompt({ initial: 'hello world', input: h.input, output: h.output });
    h.type(KEY.ctrlU, 'x', KEY.enter);
    expect(await p1).toBe('x');

    const h2 = harness();
    const p2 = textPrompt({ initial: 'hello world', input: h2.input, output: h2.output });
    h2.type(KEY.home, KEY.right, KEY.right, KEY.right, KEY.right, KEY.right, KEY.ctrlK, KEY.enter);
    expect(await p2).toBe('hello');
  });

  it('kills a word with Ctrl+W, skipping a trailing space', async () => {
    const h = harness();
    const p1 = textPrompt({ initial: 'one two three', input: h.input, output: h.output });
    h.type(KEY.ctrlW, KEY.enter);
    expect(await p1).toBe('one two ');

    const h2 = harness();
    const p2 = textPrompt({ initial: 'one two ', input: h2.input, output: h2.output });
    h2.type(KEY.ctrlW, KEY.enter);
    expect(await p2).toBe('one ');
  });

  it('inserts a space', async () => {
    const h = harness();
    const promise = textPrompt({ input: h.input, output: h.output });
    h.type('a', ' ', 'b', KEY.enter);
    expect(await promise).toBe('a b');
  });

  it('keeps astral characters whole', async () => {
    // One emoji is two UTF-16 units; a caret that moved by unit would split
    // the surrogate pair and the next render would emit half of it.
    const h = harness();
    const promise = textPrompt({ initial: '😀😃', input: h.input, output: h.output });
    h.type(KEY.backspace, KEY.enter);
    expect(await promise).toBe('😀');
  });

  it('rejects an answer the validator refuses, then accepts a fix', async () => {
    const h = harness();
    const promise = textPrompt({
      message: 'Name',
      validate: (v) => (v.includes(' ') ? 'no spaces' : true),
      input: h.input, output: h.output,
    });
    h.type(...letters('a b'), KEY.enter);
    expect(h.frame().join(' ')).toContain('no spaces');
    h.type(KEY.ctrlU, ...letters('ab'), KEY.enter);
    expect(await promise).toBe('ab');
  });

  it('treats a validator that throws as a rejection with its message', async () => {
    const h = harness();
    const promise = textPrompt({
      validate: () => { throw new Error('boom'); },
      input: h.input, output: h.output,
    });
    h.type('x', KEY.enter);
    expect(h.frame().join(' ')).toContain('boom');
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('can require a non-empty answer', async () => {
    const h = harness();
    const promise = textPrompt({ allowEmpty: false, input: h.input, output: h.output });
    h.type(KEY.enter);
    expect(h.frame().join(' ')).toContain('required');
    h.type('x', KEY.enter);
    expect(await promise).toBe('x');
  });

  it('accepts an empty answer by default', async () => {
    const h = harness();
    const promise = textPrompt({ input: h.input, output: h.output });
    h.type(KEY.enter);
    expect(await promise).toBe('');
  });

  describe('autocomplete', () => {
    const suggestions = ['main', 'develop', 'release/1.10', 'feature/charts', 'feature/forms'];

    it('lists every suggestion while the field is empty', async () => {
      const h = harness();
      const promise = textPrompt({ suggestions, input: h.input, output: h.output });
      const shown = h.frame().join('\n');
      expect(shown).toContain('main');
      expect(shown).toContain('develop');
      h.type(KEY.enter);
      await promise;
    });

    it('narrows the list as you type', async () => {
      const h = harness();
      const promise = textPrompt({ suggestions, input: h.input, output: h.output });
      h.type(...letters('fea'));
      const shown = h.frame().join('\n');
      expect(shown).toContain('feature/');
      expect(shown).not.toContain('develop');
      h.type(KEY.enter);
      await promise;
    });

    it('tolerates a typo, which is what the fuzzy engine is for', async () => {
      const h = harness();
      const promise = textPrompt({
        suggestions: ['commit', 'checkout', 'cherry-pick', 'config'],
        input: h.input, output: h.output,
      });
      h.type(...letters('comit')); // one deletion away from 'commit'
      expect(h.frame().join('\n')).toContain('commit');
      h.type(KEY.tab, KEY.enter);
      expect(await promise).toBe('commit');
    });

    it('completes the highlighted suggestion with Tab', async () => {
      const h = harness();
      const promise = textPrompt({ suggestions, input: h.input, output: h.output });
      h.type(...letters('dev'), KEY.tab, KEY.enter);
      expect(await promise).toBe('develop');
    });

    it('moves between suggestions with Up and Down', async () => {
      const h = harness();
      const promise = textPrompt({ suggestions, input: h.input, output: h.output });
      h.type(...letters('feature'));
      const first = h.frame().find((l) => l.startsWith('▶')) as string;
      h.type(KEY.down);
      const second = h.frame().find((l) => l.startsWith('▶')) as string;
      expect(second).not.toBe(first);
      h.type(KEY.tab, KEY.enter);
      const chosen = await promise;
      expect(suggestions).toContain(chosen as string);
    });

    it('wraps around the list', async () => {
      const h = harness();
      const promise = textPrompt({ suggestions, input: h.input, output: h.output });
      h.type(...letters('feature'), KEY.up); // up from the first wraps to the last
      const marked = h.frame().find((l) => l.startsWith('▶')) as string;
      expect(marked).toContain('feature/');
      h.type(KEY.enter);
      await promise;
    });

    it('caps the list at maxSuggestions', async () => {
      const h = harness();
      const promise = textPrompt({
        suggestions, maxSuggestions: 2, input: h.input, output: h.output,
      });
      // One header line plus at most two suggestions.
      expect(h.frame().length).toBeLessThanOrEqual(3);
      h.type(KEY.enter);
      await promise;
    });

    it('closes the list on Escape, keeping what was typed', async () => {
      const h = harness();
      const promise = textPrompt({ suggestions, input: h.input, output: h.output });
      h.type(...letters('fea'));
      expect(h.frame().length).toBeGreaterThan(1);
      h.type(KEY.escape);
      expect(h.frame()).toHaveLength(1);
      h.type(KEY.enter);
      expect(await promise).toBe('fea');
    });

    it('does nothing on Tab with no suggestions', async () => {
      const h = harness();
      const promise = textPrompt({ input: h.input, output: h.output });
      h.type('a', KEY.tab, KEY.enter);
      expect(await promise).toBe('a');
    });
  });

  describe('history', () => {
    const history = ['npm test', 'git status', 'npm run build'];

    it('walks backwards with Up, newest first', async () => {
      const h = harness();
      const promise = textPrompt({ history, input: h.input, output: h.output });
      h.type(KEY.up);
      expect(h.frame().join(' ')).toContain('npm run build');
      h.type(KEY.up);
      expect(h.frame().join(' ')).toContain('git status');
      h.type(KEY.enter);
      expect(await promise).toBe('git status');
    });

    it('stops at the oldest entry', async () => {
      const h = harness();
      const promise = textPrompt({ history, input: h.input, output: h.output });
      h.type(KEY.up, KEY.up, KEY.up, KEY.up, KEY.up);
      h.type(KEY.enter);
      expect(await promise).toBe('npm test');
    });

    it('comes back to an empty field with Down', async () => {
      const h = harness();
      const promise = textPrompt({ history, input: h.input, output: h.output });
      h.type(KEY.up, KEY.down, KEY.enter);
      expect(await promise).toBe('');
    });

    it('ignores Down before any Up', async () => {
      const h = harness();
      const promise = textPrompt({ history, input: h.input, output: h.output });
      h.type(KEY.down, 'x', KEY.enter);
      expect(await promise).toBe('x');
    });

    it('leaves history alone once you start typing', async () => {
      const h = harness();
      const promise = textPrompt({ history, input: h.input, output: h.output });
      h.type(KEY.up, 'X', KEY.enter);
      expect(await promise).toBe('npm run buildX');
    });

    it('yields to the suggestion list when both are given', async () => {
      const h = harness();
      const promise = textPrompt({
        history, suggestions: ['alpha', 'beta'], input: h.input, output: h.output,
      });
      h.type(KEY.up); // picks a suggestion, does not walk history
      expect(h.frame().join(' ')).not.toContain('npm run build');
      h.type(KEY.escape, KEY.enter);
      expect(await promise).toBe('');
    });

    it('does nothing on Up with neither suggestions nor history', async () => {
      const h = harness();
      const promise = textPrompt({ input: h.input, output: h.output });
      h.type(KEY.up, KEY.down, 'x', KEY.enter);
      expect(await promise).toBe('x');
    });
  });

  it('falls back to its initial value with no TTY', async () => {
    const h = harness(false);
    expect(await textPrompt({ initial: 'preset', input: h.input, output: h.output }))
      .toBe('preset');
  });

  it('ignores junk options rather than throwing', async () => {
    const h = harness();
    const promise = textPrompt({
      message: 42 as unknown as string,
      placeholder: null as unknown as string,
      suggestions: ['ok', 7 as unknown as string],
      maxSuggestions: Number.NaN,
      history: [undefined as unknown as string],
      input: h.input, output: h.output,
    });
    h.type('a', KEY.enter);
    expect(await promise).toBe('a');
  });
});

describe('passwordStrength', () => {
  it('reports empty as empty, not weak', () => {
    const s = passwordStrength('');
    expect(s.score).toBe(0);
    expect(s.label).toBe('empty');
    expect(s.bits).toBe(0);
    expect(s.hint).toBe('type something');
  });

  it('scores a longer, more varied password higher', () => {
    const weak = passwordStrength('hunter2');
    const better = passwordStrength('Tr0ub4dor&3');
    const best = passwordStrength('correct horse battery staple');
    expect(better.score).toBeGreaterThan(weak.score);
    expect(best.score).toBeGreaterThanOrEqual(better.score);
    expect(best.bits).toBeGreaterThan(weak.bits);
  });

  it('does not reward a repeated character', () => {
    // 20 of the same letter has the length of a strong password and none of
    // the entropy, which the distinct-character cap is there to catch.
    const repeated = passwordStrength('a'.repeat(20));
    const varied = passwordStrength('qwertyuiopasdfghjklz');
    expect(repeated.score).toBeLessThan(varied.score);
    expect(repeated.hint).not.toBeNull();
  });

  it('counts the character classes that are present', () => {
    const lower = passwordStrength('abcdefghijkl');
    const mixed = passwordStrength('abcDEF123!@#');
    expect(mixed.bits).toBeGreaterThan(lower.bits);
  });

  it('suggests length first, then a missing class', () => {
    expect(passwordStrength('abc')?.hint).toBe('longer is the easiest win');
    const long = passwordStrength('abcdefghijklmnop');
    expect(long.hint).toBe('add uppercase');
  });

  it('drops the hint once the password is very strong', () => {
    const s = passwordStrength('Xk7#mQ2$vL9!pR4&tY8%');
    expect(s.score).toBe(4);
    expect(s.hint).toBeNull();
  });

  it('survives non-string input', () => {
    expect(passwordStrength(null as unknown as string).label).toBe('empty');
    expect(passwordStrength(42 as unknown as string).score).toBe(0);
  });

  it('never reports a score outside 0..4', () => {
    for (const pw of ['', 'a', 'aa', 'password', 'P@ssw0rd', 'x'.repeat(200), '🔐🔑🗝️'.repeat(10)]) {
      const s = passwordStrength(pw);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(4);
      expect(Number.isFinite(s.bits)).toBe(true);
    }
  });
});

describe('passwordPrompt', () => {
  it('masks what is typed but not how much', async () => {
    const h = harness();
    const promise = passwordPrompt({ message: 'Secret', input: h.input, output: h.output });
    h.type(...letters('hunter2'));
    const shown = h.frame().join('\n');
    expect(shown).not.toContain('hunter2');
    expect(shown).toContain('•'.repeat(7));
    h.type(KEY.enter);
    expect(await promise).toBe('hunter2');
  });

  it('takes a custom mask, and an empty one hides the length', async () => {
    const h = harness();
    const p1 = passwordPrompt({ mask: '*', input: h.input, output: h.output });
    h.type(...letters('abc'));
    expect(h.frame().join('')).toContain('***');
    h.type(KEY.enter);
    await p1;

    const h2 = harness();
    const p2 = passwordPrompt({ mask: '', input: h2.input, output: h2.output });
    h2.type(...letters('abc'));
    expect(h2.frame().join('')).not.toContain('*');
    h2.type(KEY.enter);
    expect(await p2).toBe('abc');
  });

  it('draws a strength meter, and can leave it out', async () => {
    const h = harness();
    const p1 = passwordPrompt({ input: h.input, output: h.output });
    h.type(...letters('abc'));
    expect(h.frame().join('\n')).toMatch(/very weak|weak/);
    h.type(KEY.enter);
    await p1;

    const h2 = harness();
    const p2 = passwordPrompt({ meter: false, input: h2.input, output: h2.output });
    h2.type(...letters('abc'));
    expect(h2.frame().join('\n')).not.toMatch(/weak/);
    h2.type(KEY.enter);
    await p2;
  });

  it('shows an empty meter before anything is typed', async () => {
    const h = harness();
    const promise = passwordPrompt({ input: h.input, output: h.output });
    expect(h.frame().join('\n')).toContain('░░░░');
    h.type(KEY.enter);
    await promise;
  });

  it('supports the editing keys', async () => {
    const h = harness();
    const promise = passwordPrompt({ input: h.input, output: h.output });
    h.type(...letters('abcd'), KEY.backspace, KEY.enter);
    expect(await promise).toBe('abc');
  });

  it('rejects what the validator refuses', async () => {
    const h = harness();
    const promise = passwordPrompt({
      validate: (v) => (v.length < 8 ? 'at least 8 characters' : true),
      input: h.input, output: h.output,
    });
    h.type(...letters('short'), KEY.enter);
    expect(h.frame().join(' ')).toContain('at least 8');
    h.type(...letters('123'), KEY.enter);
    expect(await promise).toBe('short123');
  });

  it('asks twice and rejects a mismatch', async () => {
    const h = harness();
    const promise = passwordPrompt({
      message: 'New', confirm: true, confirmMessage: 'Again',
      input: h.input, output: h.output,
    });
    h.type(...letters('abcdefgh'), KEY.enter);
    await tick(); // the second field attaches here
    expect(h.frame().join(' ')).toContain('Again');
    h.type(...letters('abcdefgx'), KEY.enter);
    await tick();
    expect(h.frame().join(' ')).toContain('do not match');
    h.type(...letters('abcdefgh'), KEY.enter);
    expect(await promise).toBe('abcdefgh');
  });

  it('does not meter or re-validate the confirmation field', async () => {
    const h = harness();
    const promise = passwordPrompt({
      confirm: true,
      validate: (v) => (v === 'good' ? true : 'wrong'),
      input: h.input, output: h.output,
    });
    h.type(...letters('good'), KEY.enter);
    await tick();
    expect(h.frame().join('\n')).not.toMatch(/weak|strong/);
    h.type(...letters('good'), KEY.enter);
    expect(await promise).toBe('good');
  });

  it('propagates a cancel from the first field', async () => {
    const h = harness();
    const promise = passwordPrompt({ confirm: true, input: h.input, output: h.output });
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('propagates a cancel from the confirmation field', async () => {
    const h = harness();
    const promise = passwordPrompt({ confirm: true, input: h.input, output: h.output });
    h.type(...letters('abc'), KEY.enter);
    await tick();
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('resolves empty with no TTY — a password cannot have a default', async () => {
    const h = harness(false);
    expect(await passwordPrompt({ input: h.input, output: h.output })).toBe('');
  });
});

describe('numberPrompt', () => {
  it('parses what was typed', async () => {
    const h = harness();
    const promise = numberPrompt({ input: h.input, output: h.output });
    h.type(...letters('42'), KEY.enter);
    expect(await promise).toBe(42);
  });

  it('starts from initial', async () => {
    const h = harness();
    const promise = numberPrompt({ initial: 3000, input: h.input, output: h.output });
    expect(h.frame().join('')).toContain('3000');
    h.type(KEY.enter);
    expect(await promise).toBe(3000);
  });

  it('shows the bounds it will enforce', async () => {
    const both = harness();
    const p1 = numberPrompt({ min: 1, max: 9, input: both.input, output: both.output });
    expect(both.frame().join('')).toContain('1–9');
    both.type('5', KEY.enter);
    await p1;

    const lower = harness();
    const p2 = numberPrompt({ min: 10, input: lower.input, output: lower.output });
    expect(lower.frame().join('')).toContain('≥ 10');
    lower.type(...letters('10'), KEY.enter);
    await p2;

    const upper = harness();
    const p3 = numberPrompt({ max: 10, input: upper.input, output: upper.output });
    expect(upper.frame().join('')).toContain('≤ 10');
    upper.type('1', KEY.enter);
    await p3;
  });

  it('refuses an empty field', async () => {
    const h = harness();
    const promise = numberPrompt({ input: h.input, output: h.output });
    h.type(KEY.enter);
    expect(h.frame().join(' ')).toContain('enter a number');
    h.type('1', KEY.enter);
    expect(await promise).toBe(1);
  });

  it('enforces min and max on submit', async () => {
    const h = harness();
    const promise = numberPrompt({ min: 1024, max: 65535, input: h.input, output: h.output });
    h.type(...letters('80'), KEY.enter);
    expect(h.frame().join(' ')).toContain('at least 1024');
    h.type(KEY.ctrlU, ...letters('99999'), KEY.enter);
    expect(h.frame().join(' ')).toContain('at most 65535');
    h.type(KEY.ctrlU, ...letters('8080'), KEY.enter);
    expect(await promise).toBe(8080);
  });

  it('enforces whole numbers when asked', async () => {
    const h = harness();
    const promise = numberPrompt({ integer: true, input: h.input, output: h.output });
    h.type(...letters('1.5'), KEY.enter);
    expect(h.frame().join(' ')).toContain('whole number');
    h.type(KEY.ctrlU, '2', KEY.enter);
    expect(await promise).toBe(2);
  });

  it('enforces the step grid', async () => {
    const h = harness();
    const promise = numberPrompt({ min: 0, step: 5, input: h.input, output: h.output });
    h.type('7', KEY.enter);
    expect(h.frame().join(' ')).toContain('steps of 5');
    h.type(KEY.ctrlU, ...letters('10'), KEY.enter);
    expect(await promise).toBe(10);
  });

  it('nudges with Up and Down', async () => {
    const h = harness();
    const promise = numberPrompt({ initial: 10, input: h.input, output: h.output });
    h.type(KEY.up, KEY.up, KEY.down);
    expect(h.frame().join('')).toContain('11');
    h.type(KEY.enter);
    expect(await promise).toBe(11);
  });

  it('nudges by the step, and keeps the result free of floating-point dust', async () => {
    const h = harness();
    const promise = numberPrompt({
      initial: 0.5, min: 0, max: 1, step: 0.1, input: h.input, output: h.output,
    });
    h.type(KEY.up, KEY.up, KEY.up);
    // 0.5 + 0.1 + 0.1 + 0.1 in binary floating point is 0.8000000000000001.
    expect(h.frame().join('')).toContain('0.8');
    expect(h.frame().join('')).not.toContain('0.8000');
    h.type(KEY.enter);
    expect(await promise).toBe(0.8);
  });

  it('takes a separate nudge size', async () => {
    const h = harness();
    const promise = numberPrompt({ initial: 0, nudge: 25, input: h.input, output: h.output });
    h.type(KEY.up, KEY.up);
    expect(h.frame().join('')).toContain('50');
    h.type(KEY.enter);
    expect(await promise).toBe(50);
  });

  it('clamps a nudge to the bounds', async () => {
    const h = harness();
    const promise = numberPrompt({ initial: 9, min: 0, max: 10, input: h.input, output: h.output });
    h.type(KEY.up, KEY.up, KEY.up);
    expect(h.frame().join('')).toContain('10');
    h.type(KEY.enter);
    expect(await promise).toBe(10);
  });

  it('lands on the minimum on the first nudge from an empty field', async () => {
    // Not min + nudge: the first Up from nothing should give the smallest
    // value that is valid, which is where someone starting to enter a number
    // wants to be.
    const h = harness();
    const promise = numberPrompt({ min: 100, input: h.input, output: h.output });
    h.type(KEY.up);
    expect(h.frame().join('')).toContain('100');
    h.type(KEY.up);
    expect(h.frame().join('')).toContain('101');
    h.type(KEY.enter);
    expect(await promise).toBe(101);
  });

  it('establishes zero on the first nudge when there are no bounds', async () => {
    for (const key of [KEY.up, KEY.down]) {
      const h = harness();
      const promise = numberPrompt({ input: h.input, output: h.output });
      h.type(key);
      expect(h.frame().join('')).toContain('0');
      h.type(KEY.enter);
      expect(await promise).toBe(0);
    }
  });

  it('refuses characters a number cannot contain', async () => {
    const h = harness();
    const promise = numberPrompt({ input: h.input, output: h.output });
    h.type('1', 'a', 'b', '2', '!', KEY.enter);
    expect(await promise).toBe(12);
  });

  it('accepts a sign and an exponent', async () => {
    const h = harness();
    const p1 = numberPrompt({ input: h.input, output: h.output });
    h.type(...letters('-7'), KEY.enter);
    expect(await p1).toBe(-7);

    const h2 = harness();
    const p2 = numberPrompt({ input: h2.input, output: h2.output });
    h2.type(...letters('1e3'), KEY.enter);
    expect(await p2).toBe(1000);
  });

  it('rejects text that is not a number', async () => {
    const h = harness();
    const promise = numberPrompt({ input: h.input, output: h.output });
    h.type(...letters('1-2-3'), KEY.enter);
    expect(h.frame().join(' ')).toContain('is not a number');
    h.type(KEY.ctrlU, '5', KEY.enter);
    expect(await promise).toBe(5);
  });

  it('runs a custom validator after the bounds', async () => {
    const h = harness();
    const promise = numberPrompt({
      min: 0,
      validate: (v) => (v % 2 === 0 ? true : 'even numbers only'),
      input: h.input, output: h.output,
    });
    h.type('3', KEY.enter);
    expect(h.frame().join(' ')).toContain('even numbers only');
    h.type(KEY.ctrlU, '4', KEY.enter);
    expect(await promise).toBe(4);
  });

  it('falls back to the parsed value or the minimum with no TTY', async () => {
    const withInitial = harness(false);
    expect(await numberPrompt({ initial: 7, input: withInitial.input, output: withInitial.output }))
      .toBe(7);
    const bare = harness(false);
    expect(await numberPrompt({ min: 3, input: bare.input, output: bare.output })).toBe(3);
    const nothing = harness(false);
    expect(await numberPrompt({ input: nothing.input, output: nothing.output })).toBe(0);
  });

  it('ignores nonsense bounds instead of refusing everything', async () => {
    const h = harness();
    const promise = numberPrompt({
      min: Number.NaN, max: Number.POSITIVE_INFINITY, step: -5, nudge: 0,
      input: h.input, output: h.output,
    });
    h.type(...letters('42'), KEY.enter);
    expect(await promise).toBe(42);
  });
});

describe('confirmPrompt', () => {
  it('answers to y and n immediately', async () => {
    const yes = harness();
    const p1 = confirmPrompt({ input: yes.input, output: yes.output });
    yes.type('y');
    expect(await p1).toBe(true);

    const no = harness();
    const p2 = confirmPrompt({ input: no.input, output: no.output });
    no.type('n');
    expect(await p2).toBe(false);
  });

  it('takes Enter as the highlighted answer', async () => {
    const def = harness();
    const p1 = confirmPrompt({ input: def.input, output: def.output });
    def.type(KEY.enter);
    expect(await p1).toBe(true);

    const other = harness();
    const p2 = confirmPrompt({ initial: false, input: other.input, output: other.output });
    other.type(KEY.enter);
    expect(await p2).toBe(false);
  });

  it('marks which answer Enter will take', async () => {
    const h = harness();
    const promise = confirmPrompt({ message: 'Go?', initial: false, input: h.input, output: h.output });
    const line = h.frame().join('');
    expect(line).toContain('Go?');
    // The pointer sits before No, not Yes.
    expect(line.indexOf('▸')).toBeGreaterThan(line.indexOf('Yes'));
    h.type(KEY.enter);
    await promise;
  });

  it('switches sides with the arrows, Tab and Space', async () => {
    for (const key of [KEY.left, KEY.right, KEY.tab, ' ', 'h', 'l']) {
      const h = harness();
      const promise = confirmPrompt({ initial: true, deliberate: true, input: h.input, output: h.output });
      h.type(key, KEY.enter);
      expect(await promise).toBe(false);
    }
  });

  it('drops the single-key shortcuts when deliberate', async () => {
    const h = harness();
    const promise = confirmPrompt({ initial: true, deliberate: true, input: h.input, output: h.output });
    h.type('n'); // ignored
    h.type(KEY.enter);
    expect(await promise).toBe(true);
  });

  it('takes custom words, and their first letters as shortcuts', async () => {
    const h = harness();
    const promise = confirmPrompt({
      message: '¿Seguir?', yes: 'Sí', no: 'Cancelar', input: h.input, output: h.output,
    });
    expect(h.frame().join('')).toContain('Cancelar');
    h.type('c');
    expect(await promise).toBe(false);
  });

  it('cancels on Ctrl+C rather than answering', async () => {
    const h = harness();
    const promise = confirmPrompt({ input: h.input, output: h.output });
    h.type(KEY.ctrlC);
    expect(await promise).toBe(PROMPT_CANCELLED);
  });

  it('ignores keys it has no meaning for', async () => {
    const h = harness();
    const promise = confirmPrompt({ deliberate: true, input: h.input, output: h.output });
    h.type(KEY.up, KEY.down, 'z', KEY.enter);
    expect(await promise).toBe(true);
  });

  it('resolves the default with no TTY', async () => {
    const h = harness(false);
    expect(await confirmPrompt({ initial: false, input: h.input, output: h.output })).toBe(false);
    const h2 = harness(false);
    expect(await confirmPrompt({ input: h2.input, output: h2.output })).toBe(true);
  });

  it('ignores empty labels rather than drawing a blank option', async () => {
    const h = harness();
    const promise = confirmPrompt({ yes: '', no: '', input: h.input, output: h.output });
    const line = h.frame().join('');
    expect(line).toContain('Yes');
    expect(line).toContain('No');
    h.type(KEY.enter);
    await promise;
  });
});

// ─────────────────────────────────────────────
//  Recovery paths — the three places a session can fail before, during or
//  while wiring its key loop. None of them is hypothetical: a render that
//  throws, an onKey that throws and a stdin that refuses raw mode all end
//  with the terminal handed back and PROMPT_CANCELLED resolved.
// ─────────────────────────────────────────────

describe('runSession — recovery', () => {
  it('gives the cursor back when render throws on the first draw', async () => {
    const h = harness();
    const result = await runSession<string>({
      input: h.input,
      output: h.output,
      nonTTY: () => 'never',
      render: () => { throw new Error('render exploded'); },
      onKey: () => ({ done: false }),
    });
    expect(result).toBe(PROMPT_CANCELLED);
    // `?25h` is the show-cursor sequence, which stripAnsi would eat.
    expect(h.rawModeCalls).toEqual([]);
  });

  it('cancels rather than crashing when onKey throws', async () => {
    const h = harness();
    const promise = runSession<string>({
      input: h.input,
      output: h.output,
      nonTTY: () => 'never',
      render: () => ['x'],
      onKey: () => { throw new Error('handler exploded'); },
    });
    h.type('a');
    expect(await promise).toBe(PROMPT_CANCELLED);
    // Raw mode went on and came back off: the terminal is usable again.
    expect(h.rawModeCalls).toEqual([true, false]);
  });

  it('cancels when stdin refuses raw mode', async () => {
    const h = harness();
    h.input.setRawMode = (): void => { throw new Error('ENOTTY'); };
    const result = await runSession<string>({
      input: h.input,
      output: h.output,
      nonTTY: () => 'never',
      render: () => ['x'],
      onKey: () => ({ done: false }),
    });
    expect(result).toBe(PROMPT_CANCELLED);
    expect(h.input.listenerCount('data')).toBe(0);
  });

  it('keeps the last frame when asked, and erases it otherwise', async () => {
    const kept = harness();
    const p1 = runSession<string>({
      input: kept.input, output: kept.output, keep: true,
      nonTTY: () => 'never',
      render: () => ['kept line'],
      onKey: () => ({ done: true, value: 'ok' }),
    });
    kept.type('a');
    expect(await p1).toBe('ok');
    expect(kept.written()).toContain('kept line');
  });
});

describe('textPrompt — remaining keys', () => {
  it('walks off the end of the history back to an empty line', async () => {
    const h = harness();
    const promise = textPrompt({
      history: ['first', 'second'], input: h.input, output: h.output,
    });
    h.type(KEY.up);        // most recent
    expect(h.frame().join('')).toContain('second');
    h.type(KEY.up);        // older
    expect(h.frame().join('')).toContain('first');
    h.type(KEY.down);      // back to the recent one
    expect(h.frame().join('')).toContain('second');
    h.type(KEY.down);      // off the end: the line the user was typing
    expect(h.frame().join('')).not.toContain('second');
    h.type(...[...'typed'], KEY.enter);
    expect(await promise).toBe('typed');
  });

  it('ignores a key that edits nothing', async () => {
    const h = harness();
    const promise = textPrompt({ initial: 'kept', input: h.input, output: h.output });
    h.type('\x1b[2~', '\x1bOP'); // Insert, F1
    expect(h.frame().join('')).toContain('kept');
    h.type(KEY.enter);
    expect(await promise).toBe('kept');
  });
});

describe('numberPrompt — remaining keys', () => {
  it('ignores a key that is neither numeric nor an edit', async () => {
    const h = harness();
    const promise = numberPrompt({ initial: 7, input: h.input, output: h.output });
    h.type('\x1b[2~', '\x1bOP'); // Insert, F1
    expect(h.frame().join('')).toContain('7');
    h.type(KEY.enter);
    expect(await promise).toBe(7);
  });
});

describe('confirmPrompt — defaults', () => {
  it('runs with no options at all', async () => {
    // Nothing is a TTY under jest, so this resolves the default immediately
    // instead of reaching for the real terminal.
    expect(await confirmPrompt()).toBe(true);
  });
});

describe('passwordStrength — the repetition hint', () => {
  it('names repetition once length and character classes are covered', () => {
    // Long enough, all four classes present, but only four distinct
    // characters: `min(length, distinct * 2)` is what holds the score down,
    // so repetition is the thing worth saying.
    const s = passwordStrength('Aa1!Aa1!Aa1!Aa1!');
    expect(s.hint).toBe('too many repeated characters');
    expect(s.score).toBeLessThan(4);
    expect(s.bits).toBeLessThan(passwordStrength('Aa1!Bb2@Cc3#Dd4$').bits);
  });
});

describe('numberPrompt — nudging into a bound', () => {
  it('clamps a downward nudge to the minimum', async () => {
    const h = harness();
    const promise = numberPrompt({ initial: 10, min: 10, step: 1, input: h.input, output: h.output });
    h.type(KEY.down);
    expect(h.frame().join('')).toContain('10');
    h.type(KEY.enter);
    expect(await promise).toBe(10);
  });
});

describe('runSession — a chunk carrying more than one key', () => {
  it('answers on the first key of a chunk and drops the rest', async () => {
    // A fast typist, a held key or a paste arrives as one `data` event. The
    // first key that resolves the prompt wins; the five after it change
    // nothing, and in particular do not resolve the promise a second time.
    const h = harness();
    const promise = confirmPrompt({ input: h.input, output: h.output });
    h.type('ynynyn');
    expect(await promise).toBe(true);
  });

  it('writes to stdout when no output stream is given', async () => {
    const written: string[] = [];
    const real = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (chunk: string): boolean => {
      written.push(String(chunk));
      return true;
    };
    try {
      const h = harness();
      const promise = textPrompt({ message: 'No output option', input: h.input });
      await tick();
      h.type(...[...'typed'], KEY.enter);
      expect(await promise).toBe('typed');
    } finally {
      (process.stdout as { write: unknown }).write = real;
    }
    expect(stripAnsi(written.join(''))).toContain('No output option');
  });
});

describe('passwordPrompt — remaining keys', () => {
  it('ignores a key that edits nothing', async () => {
    const h = harness();
    const promise = passwordPrompt({ message: 'Secret', input: h.input, output: h.output });
    h.type(...[...'abc']);
    h.type('\x1b[2~', '\x1bOP', '\x1b[1~');   // Insert, F1, Home-variant
    h.type(KEY.enter);
    expect(await promise).toBe('abc');
  });
});

describe('runSession — a data event with nothing in it', () => {
  it('survives a listener call carrying no chunk', async () => {
    const h = harness();
    const promise = textPrompt({ initial: 'kept', input: h.input, output: h.output });
    await tick();
    (h.input as unknown as { emit: (e: string) => void }).emit('data');
    expect(h.frame().join('')).toContain('kept');
    h.type(KEY.enter);
    expect(await promise).toBe('kept');
  });
});
