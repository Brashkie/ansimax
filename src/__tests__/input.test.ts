import {
  parseKey, parseMouse, matchKey,
  splitSequences, parseKeys, createKeymap,
} from '../input/index.js';
import type { KeyEvent } from '../input/index.js';

describe('parseKey — printable & control (v1.9.0)', () => {
  it('passes through printable characters with no modifiers', () => {
    for (const ch of ['q', 'A', '7', '/', 'ñ']) {
      const k = parseKey(ch);
      expect(k.name).toBe(ch);
      expect(k.ctrl).toBe(false);
      expect(k.meta).toBe(false);
      expect(k.sequence).toBe(ch);
    }
  });

  it('names the common control keys', () => {
    expect(parseKey('\r').name).toBe('return');
    expect(parseKey('\n').name).toBe('return');
    expect(parseKey('\t').name).toBe('tab');
    expect(parseKey('\x7f').name).toBe('backspace');
    expect(parseKey('\b').name).toBe('backspace');
    expect(parseKey('\x1b').name).toBe('escape');
    expect(parseKey(' ').name).toBe('space');
  });

  it('decodes Ctrl+letter control codes', () => {
    expect(parseKey('\x03')).toMatchObject({ name: 'c', ctrl: true });   // Ctrl+C
    expect(parseKey('\x01')).toMatchObject({ name: 'a', ctrl: true });   // Ctrl+A
    expect(parseKey('\x1a')).toMatchObject({ name: 'z', ctrl: true });   // Ctrl+Z
  });

  it('decodes Alt/Meta-prefixed keys', () => {
    expect(parseKey('\x1ba')).toMatchObject({ name: 'a', meta: true, ctrl: false });
  });

  it('returns unknown for the empty string', () => {
    expect(parseKey('').name).toBe('unknown');
  });
});

describe('parseKey — special & modified keys (v1.9.0)', () => {
  it('decodes CSI arrows and home/end', () => {
    expect(parseKey('\x1b[A').name).toBe('up');
    expect(parseKey('\x1b[B').name).toBe('down');
    expect(parseKey('\x1b[C').name).toBe('right');
    expect(parseKey('\x1b[D').name).toBe('left');
    expect(parseKey('\x1b[H').name).toBe('home');
    expect(parseKey('\x1b[F').name).toBe('end');
  });

  it('decodes SS3 arrows and F1–F4', () => {
    expect(parseKey('\x1bOA').name).toBe('up');
    expect(parseKey('\x1bOP').name).toBe('f1');
    expect(parseKey('\x1bOS').name).toBe('f4');
    expect(parseKey('\x1bOZ').name).toBe('unknown');
  });

  it('decodes xterm modified letter sequences', () => {
    expect(parseKey('\x1b[1;5C')).toMatchObject({ name: 'right', ctrl: true, meta: false, shift: false });
    expect(parseKey('\x1b[1;2A')).toMatchObject({ name: 'up', shift: true, ctrl: false });
    expect(parseKey('\x1b[1;3D')).toMatchObject({ name: 'left', meta: true, ctrl: false });
    expect(parseKey('\x1b[1;6A')).toMatchObject({ name: 'up', ctrl: true, shift: true });
  });

  it('decodes tilde navigation / function keys', () => {
    expect(parseKey('\x1b[2~').name).toBe('insert');
    expect(parseKey('\x1b[3~').name).toBe('delete');
    expect(parseKey('\x1b[5~').name).toBe('pageup');
    expect(parseKey('\x1b[6~').name).toBe('pagedown');
    expect(parseKey('\x1b[15~').name).toBe('f5');
    expect(parseKey('\x1b[24~').name).toBe('f12');
  });

  it('decodes a modified tilde key', () => {
    expect(parseKey('\x1b[3;5~')).toMatchObject({ name: 'delete', ctrl: true });
  });

  it('decodes Shift+Tab (back-tab)', () => {
    expect(parseKey('\x1b[Z')).toMatchObject({ name: 'tab', shift: true });
  });

  it('returns unknown for an unrecognized CSI sequence', () => {
    expect(parseKey('\x1b[999X').name).toBe('unknown');
  });

  it('returns unknown for a multi-char sequence that is not an escape sequence', () => {
    expect(parseKey('ab').name).toBe('unknown');      // not ESC-prefixed
    expect(parseKey('\x1bO').name).toBe('unknown');   // truncated SS3
  });
});

describe('parseMouse (v1.9.0)', () => {
  it('decodes a left press and release', () => {
    expect(parseMouse('\x1b[<0;10;5M')).toEqual({
      x: 10, y: 5, button: 'left', action: 'down', wheel: null,
      ctrl: false, meta: false, shift: false,
    });
    expect(parseMouse('\x1b[<0;10;5m')).toMatchObject({ button: 'left', action: 'up' });
  });

  it('decodes middle and right buttons', () => {
    expect(parseMouse('\x1b[<1;3;3M')!.button).toBe('middle');
    expect(parseMouse('\x1b[<2;1;1M')!.button).toBe('right');
  });

  it('decodes the wheel (up and down)', () => {
    expect(parseMouse('\x1b[<64;3;3M')).toMatchObject({ button: 'none', action: 'wheel', wheel: 'up' });
    expect(parseMouse('\x1b[<65;3;3M')).toMatchObject({ action: 'wheel', wheel: 'down' });
  });

  it('decodes drag (motion) as a move', () => {
    expect(parseMouse('\x1b[<32;5;5M')!.action).toBe('move');
  });

  it('decodes modifier bits', () => {
    expect(parseMouse('\x1b[<16;2;2M')).toMatchObject({ ctrl: true, button: 'left' });
    expect(parseMouse('\x1b[<4;2;2M')!.shift).toBe(true);
    expect(parseMouse('\x1b[<8;2;2M')!.meta).toBe(true);
  });

  it('returns null for non-mouse input', () => {
    expect(parseMouse('q')).toBeNull();
    expect(parseMouse('\x1b[A')).toBeNull();
    expect(parseMouse('')).toBeNull();
  });
});

describe('matchKey (v1.9.1)', () => {
  it('matches modified keys against a binding string', () => {
    expect(matchKey(parseKey('\x03'), 'ctrl+c')).toBe(true);
    expect(matchKey(parseKey('\x03'), 'Ctrl+C')).toBe(true);     // case-insensitive
    expect(matchKey(parseKey('\x03'), 'control+c')).toBe(true);  // modifier alias
    expect(matchKey(parseKey('\x1b[1;2A'), 'shift+up')).toBe(true);
    expect(matchKey(parseKey('\x1b[Z'), 'shift+tab')).toBe(true);
    expect(matchKey(parseKey('\x1b[1;6A'), 'ctrl+shift+up')).toBe(true);
    expect(matchKey(parseKey('\x1ba'), 'alt+a')).toBe(true);
    expect(matchKey(parseKey('\x1ba'), 'meta+a')).toBe(true);    // alt === meta
  });

  it('matches bare keys and key aliases', () => {
    expect(matchKey(parseKey('q'), 'q')).toBe(true);
    expect(matchKey(parseKey('\x1b[A'), 'up')).toBe(true);
    expect(matchKey(parseKey('\x1bOP'), 'f1')).toBe(true);
    expect(matchKey(parseKey('\x1b'), 'esc')).toBe(true);           // esc → escape
    expect(matchKey(parseKey('\x1b[3;5~'), 'ctrl+del')).toBe(true); // del → delete
    expect(matchKey(parseKey(' '), 'space')).toBe(true);
  });

  it('is exact on modifiers and rejects mismatches', () => {
    expect(matchKey(parseKey('q'), 'ctrl+q')).toBe(false);         // ctrl not held
    expect(matchKey(parseKey('\x03'), 'c')).toBe(false);           // ctrl IS held
    expect(matchKey(parseKey('\x1b[A'), 'shift+up')).toBe(false);  // shift not held
    expect(matchKey(parseKey('\x1b[1;2A'), 'up')).toBe(false);     // shift held
  });

  it('rejects empty or key-less bindings', () => {
    expect(matchKey(parseKey('q'), '')).toBe(false);
    expect(matchKey(parseKey('q'), '   ')).toBe(false);
    expect(matchKey(parseKey('\x03'), 'ctrl+shift')).toBe(false);  // no key part
  });

  it('matches the literal plus key', () => {
    expect(matchKey(parseKey('+'), '+')).toBe(true);
    expect(matchKey(parseKey('+'), 'q')).toBe(false);
  });

  it('rejects malformed arguments defensively (JS callers)', () => {
    const key = parseKey('q');
    expect(matchKey(undefined as unknown as KeyEvent, 'q')).toBe(false);
    expect(matchKey(null as unknown as KeyEvent, 'q')).toBe(false);
    expect(matchKey(key, undefined as unknown as string)).toBe(false);
    expect(matchKey(key, 42 as unknown as string)).toBe(false);
  });
});

describe('splitSequences (v1.9.3)', () => {
  it('splits consecutive escape sequences', () => {
    expect(splitSequences('\x1b[A\x1b[B')).toEqual(['\x1b[A', '\x1b[B']);
    expect(splitSequences('\x1b[1;5C\x03')).toEqual(['\x1b[1;5C', '\x03']);
    expect(splitSequences('\x1bOP\x1b[15~')).toEqual(['\x1bOP', '\x1b[15~']);
  });

  it('splits plain text one code point at a time', () => {
    expect(splitSequences('hola\r')).toEqual(['h', 'o', 'l', 'a', '\r']);
    expect(splitSequences('ab\x1b[Acd')).toEqual(['a', 'b', '\x1b[A', 'c', 'd']);
  });

  it('keeps astral-plane code points whole', () => {
    expect(splitSequences('😀')).toEqual(['😀']);
    expect(splitSequences('a😀b')).toEqual(['a', '😀', 'b']);
    expect(splitSequences('\x1b😀')).toEqual(['\x1b😀']);
  });

  it('keeps an SGR mouse report in one piece', () => {
    expect(splitSequences('\x1b[A\x1b[<0;10;5M\x1b[B'))
      .toEqual(['\x1b[A', '\x1b[<0;10;5M', '\x1b[B']);
  });

  it('handles a lone and a doubled ESC', () => {
    expect(splitSequences('\x1b')).toEqual(['\x1b']);
    expect(splitSequences('\x1b\x1b')).toEqual(['\x1b', '\x1b']);
    expect(splitSequences('\x1ba')).toEqual(['\x1ba']);
  });

  it('returns a truncated trailing sequence intact instead of dropping it', () => {
    expect(splitSequences('\x1b[')).toEqual(['\x1b[']);      // CSI with no final byte
    expect(splitSequences('\x1b[1;5')).toEqual(['\x1b[1;5']);
    expect(splitSequences('\x1bO')).toEqual(['\x1bO']);      // SS3 missing its char
    expect(splitSequences('a\x1b[')).toEqual(['a', '\x1b[']);
  });

  it('brackets a paste as its own sequences', () => {
    expect(splitSequences('\x1b[200~x\x1b[201~')).toEqual(['\x1b[200~', 'x', '\x1b[201~']);
  });

  it('returns an empty array for empty or non-string input', () => {
    expect(splitSequences('')).toEqual([]);
    expect(splitSequences(undefined as unknown as string)).toEqual([]);
    expect(splitSequences(null as unknown as string)).toEqual([]);
    expect(splitSequences(42 as unknown as string)).toEqual([]);
  });

  it('is lossless — joining the pieces reproduces the chunk', () => {
    const pieces = ['a', 'Z', '\r', '\t', '\x1b', '\x1b[A', '\x1b[1;5C', '\x1b[15~',
      '\x1bOP', '\x1ba', '\x03', '\x1b[<0;5;5M', '😀', '\x1b[Z', ' '];
    for (let n = 0; n < 500; n++) {
      let chunk = '';
      const count = 1 + (n % 6);
      for (let m = 0; m < count; m++) chunk += pieces[(n * 7 + m * 3) % pieces.length];
      expect(splitSequences(chunk).join('')).toBe(chunk);
    }
  });
});

describe('parseKeys (v1.9.3)', () => {
  it('decodes every key in a chunk', () => {
    const keys = parseKeys('\x1b[A\x1b[B\x03');
    expect(keys).toHaveLength(3);
    expect(keys[0]!.name).toBe('up');
    expect(keys[1]!.name).toBe('down');
    expect(keys[2]!).toMatchObject({ name: 'c', ctrl: true });
  });

  it('decodes typed text', () => {
    expect(parseKeys('hi').map((k) => k.name)).toEqual(['h', 'i']);
  });

  it('preserves each original sequence', () => {
    expect(parseKeys('\x1b[A')[0]!.sequence).toBe('\x1b[A');
  });

  it('returns an empty array for an empty chunk', () => {
    expect(parseKeys('')).toEqual([]);
  });

  it('pairs with parseMouse over one mixed chunk', () => {
    const events = splitSequences('\x1b[A\x1b[<0;10;5M')
      .map((seq) => parseMouse(seq) ?? parseKey(seq));
    expect(events[0]).toMatchObject({ name: 'up' });
    expect(events[1]).toMatchObject({ x: 10, y: 5, button: 'left', action: 'down' });
  });
});

describe('createKeymap (v1.9.3)', () => {
  it('dispatches to the bound handler and reports the hit', () => {
    const seen: string[] = [];
    const keys = createKeymap()
      .bind('ctrl+c', () => seen.push('quit'))
      .bind(['q', 'escape'], () => seen.push('close'))
      .bind('shift+tab', () => seen.push('prev'));

    expect(keys.handle(parseKey('\x03'))).toBe(true);
    expect(keys.handle(parseKey('q'))).toBe(true);
    expect(keys.handle(parseKey('\x1b'))).toBe(true);
    expect(keys.handle(parseKey('\x1b[Z'))).toBe(true);
    expect(seen).toEqual(['quit', 'close', 'close', 'prev']);
  });

  it('passes the matching event to the handler', () => {
    let got: KeyEvent | null = null;
    createKeymap().bind('ctrl+c', (e) => { got = e; }).handle(parseKey('\x03'));
    expect(got).toMatchObject({ name: 'c', ctrl: true, sequence: '\x03' });
  });

  it('returns false when nothing matches', () => {
    const keys = createKeymap().bind('ctrl+c', () => {});
    expect(keys.handle(parseKey('z'))).toBe(false);
    expect(keys.handle(null as unknown as KeyEvent)).toBe(false);
  });

  it('is exact on modifiers', () => {
    const keys = createKeymap().bind('up', () => {});
    expect(keys.handle(parseKey('\x1b[A'))).toBe(true);
    expect(keys.handle(parseKey('\x1b[1;2A'))).toBe(false); // shifted Up
  });

  it('stores bindings in canonical form, so modifier order collapses', () => {
    let which = '';
    const keys = createKeymap()
      .bind('ctrl+shift+up', () => { which = 'first'; })
      .bind('shift+ctrl+up', () => { which = 'second'; });

    expect(keys.bindings()).toEqual(['ctrl+shift+up']);
    keys.handle(parseKey('\x1b[1;6A'));
    expect(which).toBe('second'); // the second bind replaced the first
  });

  it('canonicalizes aliases and case', () => {
    const keys = createKeymap()
      .bind('ESC', () => {})
      .bind('Alt+A', () => {})
      .bind('ctrl+Del', () => {})
      .bind('+', () => {});
    expect(keys.bindings()).toEqual(['escape', 'meta+a', 'ctrl+delete', '+']);
  });

  it('accepts an initial binding map', () => {
    let hit = 0;
    const keys = createKeymap({ 'ctrl+c': () => hit++, q: () => hit++ });
    expect(keys.bindings()).toEqual(['ctrl+c', 'q']);
    keys.handle(parseKey('\x03'));
    expect(hit).toBe(1);
  });

  it('unbinds, normalizing the binding first', () => {
    const keys = createKeymap({ 'ctrl+c': () => {} });
    expect(keys.unbind('Ctrl+C').bindings()).toEqual([]);
    expect(keys.handle(parseKey('\x03'))).toBe(false);
    expect(keys.unbind(['q', 'escape']).bindings()).toEqual([]); // unknown: no-op
  });

  it('throws on a binding with no key part', () => {
    expect(() => createKeymap().bind('ctrl+shift', () => {})).toThrow(TypeError);
    expect(() => createKeymap().bind('', () => {})).toThrow(/ANSIMAX_KEYMAP_BINDING/);
    expect(() => createKeymap().bind(42 as unknown as string, () => {})).toThrow(TypeError);
    expect(() => createKeymap().unbind('ctrl+alt')).toThrow(/ANSIMAX_KEYMAP_BINDING/);
    expect(() => createKeymap({ 'ctrl+shift': () => {} })).toThrow(TypeError);
  });

  it('throws when the handler is not a function', () => {
    expect(() => createKeymap().bind('q', 'nope' as unknown as () => void))
      .toThrow(/ANSIMAX_KEYMAP_HANDLER/);
  });
});
