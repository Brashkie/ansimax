import { parseKey, parseMouse } from '../input/index.js';

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
