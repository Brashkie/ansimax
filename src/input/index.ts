// ─────────────────────────────────────────────
//  ansimax/input — Keyboard & mouse sequence parsing (Phase 9)
//
//  v1.9.0 — Phase 9. Turning raw terminal input bytes into structured events.
//  A TTY in raw mode delivers keystrokes as escape sequences — `\x1b[A` for Up,
//  `\x1b[1;5C` for Ctrl+Right, `\x03` for Ctrl+C, `\x1b[<0;10;5M` for a left
//  click — and an app has to decode them. `parseKey` and `parseMouse` do that
//  decoding as *pure functions*: give them the sequence string, get back a
//  normalized event. No stdin, no raw-mode toggling, no listeners — so they are
//  fully testable off a TTY and the caller owns the I/O loop.
//
//  The CSI modifier convention is the xterm one: a trailing `;m` parameter
//  where `m - 1` is a bitmask (bit0 shift, bit1 alt/meta, bit2 ctrl). Mouse is
//  the SGR protocol (`\x1b[<b;x;yM|m`), the modern, unambiguous one. Zero deps.
// ─────────────────────────────────────────────

/** A decoded key press. @since 1.9.0 */
export interface KeyEvent {
  /**
   * Canonical key name: a printable character (`'a'`, `'7'`), or a named key
   * (`'up'`, `'return'`, `'escape'`, `'backspace'`, `'tab'`, `'space'`,
   * `'home'`, `'end'`, `'pageup'`, `'pagedown'`, `'insert'`, `'delete'`,
   * `'f1'`…`'f12'`), or `'unknown'` for an unrecognized sequence.
   */
  name: string;
  /** Ctrl was held. */
  ctrl: boolean;
  /** Alt/Meta was held. */
  meta: boolean;
  /** Shift was held (only reliably reported for modified special keys). */
  shift: boolean;
  /** The raw input sequence this event was parsed from. */
  sequence: string;
}

// CSI final letter → arrow/home/end name.
const CSI_LETTER: Record<string, string> = {
  A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end',
};
// CSI `[n~` numeric → name.
const CSI_TILDE: Record<string, string> = {
  '1': 'home', '2': 'insert', '3': 'delete', '4': 'end',
  '5': 'pageup', '6': 'pagedown', '7': 'home', '8': 'end',
  '11': 'f1', '12': 'f2', '13': 'f3', '14': 'f4', '15': 'f5',
  '17': 'f6', '18': 'f7', '19': 'f8', '20': 'f9', '21': 'f10',
  '23': 'f11', '24': 'f12',
};
// SS3 final letter (`\x1bO…`) → name (application cursor mode, F1–F4).
const SS3_LETTER: Record<string, string> = {
  A: 'up', B: 'down', C: 'right', D: 'left', H: 'home', F: 'end',
  P: 'f1', Q: 'f2', R: 'f3', S: 'f4',
};

const noMods = (): { ctrl: boolean; meta: boolean; shift: boolean } =>
  ({ ctrl: false, meta: false, shift: false });

// Decode an xterm modifier parameter (the `m` in `CSI 1;m X`): m-1 is a
// bitmask — bit0 shift, bit1 alt, bit2 ctrl.
const decodeModifier = (m: number): { ctrl: boolean; meta: boolean; shift: boolean } => {
  const bits = Math.max(0, m - 1);
  return {
    shift: (bits & 1) !== 0,
    meta: (bits & 2) !== 0,
    ctrl: (bits & 4) !== 0,
  };
};

/**
 * Parse one terminal input sequence into a normalized {@link KeyEvent}.
 * Handles printable characters, Ctrl+letter control codes, Alt/Meta-prefixed
 * keys, the arrow/navigation/function keys (both CSI `\x1b[` and SS3 `\x1bO`
 * forms), and xterm modified sequences like `\x1b[1;5C` (Ctrl+Right). An
 * unrecognized sequence yields `{ name: 'unknown' }`.
 *
 * @example
 * ```js
 * import { parseKey } from 'ansimax';
 *
 * parseKey('\x1b[A');     // { name: 'up',     ctrl: false, ... }
 * parseKey('\x1b[1;5C');  // { name: 'right',  ctrl: true,  ... }
 * parseKey('\x03');       // { name: 'c',      ctrl: true,  ... }  (Ctrl+C)
 * parseKey('q');          // { name: 'q',      ctrl: false, ... }
 * ```
 *
 * @since 1.9.0
 */
export const parseKey = (sequence: string): KeyEvent => {
  const ev = (name: string, mods = noMods()): KeyEvent => ({ name, ...mods, sequence });

  if (sequence === '') return ev('unknown');

  // Single-byte keys and control codes.
  if (sequence.length === 1) {
    const code = sequence.charCodeAt(0);
    if (sequence === '\r' || sequence === '\n') return ev('return');
    if (sequence === '\t') return ev('tab');
    if (sequence === '\x7f' || sequence === '\b') return ev('backspace');
    if (sequence === '\x1b') return ev('escape');
    if (sequence === ' ') return ev('space');
    // Ctrl+letter: 0x01–0x1a map to a–z (0x09/0x0d/0x08 handled above).
    if (code >= 1 && code <= 26) {
      return ev(String.fromCharCode(code + 96), { ctrl: true, meta: false, shift: false });
    }
    // Any other printable single char.
    return ev(sequence);
  }

  // Alt/Meta-prefixed printable (ESC + char), e.g. Alt+a → "\x1ba".
  if (sequence.length === 2 && sequence[0] === '\x1b' && sequence[1] !== '[' && sequence[1] !== 'O') {
    return ev(sequence[1] as string, { ctrl: false, meta: true, shift: false });
  }

  // Shift+Tab (back-tab).
  if (sequence === '\x1b[Z') return ev('tab', { ctrl: false, meta: false, shift: true });

  // SS3 sequences: \x1bO<letter> (application cursor mode, F1–F4).
  if (sequence.length === 3 && sequence[0] === '\x1b' && sequence[1] === 'O') {
    const name = SS3_LETTER[sequence[2] as string];
    return name ? ev(name) : ev('unknown');
  }

  // CSI sequences: \x1b[ … final.
  if (sequence[0] === '\x1b' && sequence[1] === '[') {
    const body = sequence.slice(2);
    const final = body[body.length - 1] as string;

    // Plain letter form: \x1b[A .. also \x1b[H / \x1b[F.
    if (body.length === 1 && CSI_LETTER[final]) {
      return ev(CSI_LETTER[final] as string);
    }
    // Modified letter form: \x1b[1;5C → ctrl+right.
    const modLetter = /^1;(\d+)([A-Z])$/.exec(body);
    if (modLetter && CSI_LETTER[modLetter[2] as string]) {
      return ev(CSI_LETTER[modLetter[2] as string] as string, decodeModifier(Number(modLetter[1])));
    }
    // Tilde form: \x1b[3~ (delete), with optional modifier \x1b[3;5~.
    const tilde = /^(\d+)(?:;(\d+))?~$/.exec(body);
    if (tilde && CSI_TILDE[tilde[1] as string]) {
      const mods = tilde[2] ? decodeModifier(Number(tilde[2])) : noMods();
      return ev(CSI_TILDE[tilde[1] as string] as string, mods);
    }
    return ev('unknown');
  }

  return ev('unknown');
};

/** The button a mouse event concerns. @since 1.9.0 */
export type MouseButton = 'left' | 'middle' | 'right' | 'none';
/** What the mouse did. @since 1.9.0 */
export type MouseAction = 'down' | 'up' | 'move' | 'wheel';

/** A decoded SGR mouse event. @since 1.9.0 */
export interface MouseEvent {
  /** 1-based column. */
  x: number;
  /** 1-based row. */
  y: number;
  /** Which button (`'none'` for motion-only and wheel). */
  button: MouseButton;
  /** Press, release, drag/move, or wheel. */
  action: MouseAction;
  /** Wheel direction when `action === 'wheel'`, else `null`. */
  wheel: 'up' | 'down' | null;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

const SGR_MOUSE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;
const MOUSE_BUTTONS: readonly MouseButton[] = ['left', 'middle', 'right', 'none'];

/**
 * Parse an SGR mouse sequence (`\x1b[<b;x;yM` press / `…m` release) into a
 * normalized {@link MouseEvent}, or `null` when the string isn't one. Decodes
 * the button, wheel (button bit 64, direction in bit 0), drag (bit 32), and the
 * shift/alt/ctrl modifier bits (4 / 8 / 16). Coordinates are 1-based, as the
 * terminal reports them.
 *
 * @example
 * ```js
 * import { parseMouse } from 'ansimax';
 *
 * parseMouse('\x1b[<0;10;5M');  // { x:10, y:5, button:'left',  action:'down', ... }
 * parseMouse('\x1b[<0;10;5m');  // { x:10, y:5, button:'left',  action:'up',   ... }
 * parseMouse('\x1b[<64;3;3M');  // { x:3,  y:3, button:'none',  action:'wheel', wheel:'up' }
 * parseMouse('q');              // null
 * ```
 *
 * @since 1.9.0
 */
export const parseMouse = (sequence: string): MouseEvent | null => {
  const m = SGR_MOUSE.exec(sequence);
  if (!m) return null;
  const cb = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  const final = m[4];

  const isWheel = (cb & 64) !== 0;
  const isMove = (cb & 32) !== 0;
  const shift = (cb & 4) !== 0;
  const meta = (cb & 8) !== 0;
  const ctrl = (cb & 16) !== 0;

  let button: MouseButton;
  let action: MouseAction;
  let wheel: 'up' | 'down' | null = null;

  if (isWheel) {
    button = 'none';
    action = 'wheel';
    wheel = (cb & 1) ? 'down' : 'up';
  } else {
    button = MOUSE_BUTTONS[cb & 3] as MouseButton;
    action = isMove ? 'move' : final === 'M' ? 'down' : 'up';
  }

  return { x, y, button, action, wheel, ctrl, meta, shift };
};
