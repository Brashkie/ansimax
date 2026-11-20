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

// Short aliases accepted in a keybinding's key part → canonical KeyEvent name.
const KEY_ALIAS: Record<string, string> = {
  esc: 'escape', del: 'delete', ins: 'insert',
  pgup: 'pageup', pgdn: 'pagedown', pgdown: 'pagedown',
  enter: 'return', ret: 'return', cr: 'return',
  spacebar: 'space', bs: 'backspace', bksp: 'backspace',
};
const isCtrlToken = (p: string): boolean => p === 'ctrl' || p === 'control' || p === 'ctl';
const isMetaToken = (p: string): boolean => p === 'alt' || p === 'meta' || p === 'option' || p === 'opt';

/**
 * Test whether a parsed {@link KeyEvent} matches a human-written keybinding
 * string like `'ctrl+c'`, `'shift+tab'`, `'alt+x'`, `'ctrl+shift+up'`, or a
 * bare key (`'up'`, `'enter'`, `'q'`). Case-insensitive. Modifier aliases:
 * `ctrl`/`control`/`ctl`, `alt`/`meta`/`option`/`opt`, `shift`. Key aliases:
 * `esc`→`escape`, `del`→`delete`, `pgup`→`pageup`, `enter`/`ret`→`return`, etc.
 *
 * The match is exact on all three modifiers: `'up'` matches only an Up with no
 * modifiers, while `'shift+up'` matches only a shifted Up. Use `'+'` for the
 * plus key. A binding with no key part (just modifiers) never matches.
 *
 * @example
 * ```js
 * import { parseKey, matchKey } from 'ansimax';
 *
 * const key = parseKey(chunk);
 * if (matchKey(key, 'ctrl+c')) quit();
 * if (matchKey(key, 'shift+tab')) focusPrev();
 * ```
 *
 * @since 1.9.1
 */
export const matchKey = (event: KeyEvent, binding: string): boolean => {
  if (!event || typeof binding !== 'string') return false;
  const b = binding.trim().toLowerCase();
  if (b === '') return false;
  const parts = b === '+' ? ['+'] : b.split('+').map((s) => s.trim()).filter((s) => s !== '');

  let wantCtrl = false, wantMeta = false, wantShift = false;
  const names: string[] = [];
  for (const p of parts) {
    if (isCtrlToken(p)) wantCtrl = true;
    else if (isMetaToken(p)) wantMeta = true;
    else if (p === 'shift') wantShift = true;
    else names.push(KEY_ALIAS[p] ?? p);
  }
  if (names.length !== 1) return false;

  return event.name.toLowerCase() === names[0]
    && event.ctrl === wantCtrl && event.meta === wantMeta && event.shift === wantShift;
};

// ─────────────────────────────────────────────
//  Chunk splitting (v1.9.3)
// ─────────────────────────────────────────────

// A CSI sequence ends at the first "final byte" in the range 0x40–0x7E (@ … ~).
// Parameter bytes (0x30–0x3F, which includes the `<` of SGR mouse reports) and
// intermediate bytes (0x20–0x2F) come before it.
const isFinalByte = (ch: string): boolean => {
  const n = ch.codePointAt(0) ?? 0;
  return n >= 0x40 && n <= 0x7e;
};

/**
 * Split one raw stdin chunk into individual terminal sequences.
 *
 * A single `data` event often carries several keypresses — held arrow keys,
 * a fast typist, a paste, or a mouse report arriving mid-typing — and
 * {@link parseKey} expects exactly one sequence, so feeding it a whole chunk
 * yields `'unknown'`. This splits the chunk first, losslessly: joining the
 * result always reproduces the input.
 *
 * Recognizes CSI (`\x1b[…` up to its final byte, so SGR mouse reports stay
 * whole), SS3 (`\x1bO` + one char), Alt-prefixed keys (`\x1b` + one char),
 * a lone trailing `\x1b`, and otherwise one code point at a time (so an
 * astral-plane emoji is never split into surrogate halves). A truncated
 * sequence at the end of the chunk is returned as-is rather than dropped.
 *
 * @example
 * ```js
 * import { splitSequences, parseKey, parseMouse } from 'ansimax';
 *
 * splitSequences('\x1b[A\x1b[B');   // ['\x1b[A', '\x1b[B']
 * splitSequences('hi\r');            // ['h', 'i', '\r']
 *
 * // Keyboard and mouse from the same chunk:
 * for (const seq of splitSequences(chunk)) {
 *   const event = parseMouse(seq) ?? parseKey(seq);
 *   handle(event);
 * }
 * ```
 *
 * @since 1.9.3
 */
export const splitSequences = (chunk: string): string[] => {
  if (typeof chunk !== 'string' || chunk === '') return [];

  const out: string[] = [];
  let i = 0;

  while (i < chunk.length) {
    // Plain key: consume one whole code point.
    if (chunk[i] !== '\x1b') {
      const cp = String.fromCodePoint(chunk.codePointAt(i) ?? 0);
      out.push(cp);
      i += cp.length;
      continue;
    }

    const next = chunk[i + 1];

    // Lone ESC at the very end of the chunk.
    if (next === undefined) {
      out.push('\x1b');
      i += 1;
      continue;
    }

    // CSI — run to the final byte, keeping mouse reports in one piece.
    if (next === '[') {
      let j = i + 2;
      while (j < chunk.length && !isFinalByte(chunk[j] as string)) j++;
      if (j < chunk.length) {
        out.push(chunk.slice(i, j + 1));
        i = j + 1;
      } else {
        out.push(chunk.slice(i)); // truncated: hand it back intact
        i = chunk.length;
      }
      continue;
    }

    // SS3 — ESC O plus exactly one character.
    if (next === 'O') {
      if (i + 2 < chunk.length) {
        out.push(chunk.slice(i, i + 3));
        i += 3;
      } else {
        out.push(chunk.slice(i)); // truncated
        i = chunk.length;
      }
      continue;
    }

    // ESC ESC — the first one is a standalone Escape.
    if (next === '\x1b') {
      out.push('\x1b');
      i += 1;
      continue;
    }

    // Alt/Meta-prefixed key.
    const cp = String.fromCodePoint(chunk.codePointAt(i + 1) ?? 0);
    out.push(`\x1b${cp}`);
    i += 1 + cp.length;
  }

  return out;
};

/**
 * Decode a raw stdin chunk into every {@link KeyEvent} it contains —
 * {@link splitSequences} followed by {@link parseKey} on each piece.
 *
 * This is the function to wire to a raw-mode `data` listener; `parseKey`
 * alone only handles a chunk that holds exactly one sequence.
 *
 * @example
 * ```js
 * import { parseKeys, matchKey } from 'ansimax';
 *
 * process.stdin.setRawMode(true);
 * process.stdin.on('data', (buf) => {
 *   for (const key of parseKeys(buf.toString())) {
 *     if (matchKey(key, 'ctrl+c')) process.exit();
 *   }
 * });
 * ```
 *
 * @since 1.9.3
 */
export const parseKeys = (chunk: string): KeyEvent[] =>
  splitSequences(chunk).map(parseKey);

// ─────────────────────────────────────────────
//  Keymap (v1.9.3)
// ─────────────────────────────────────────────

/** Called with the event that matched a binding. @since 1.9.3 */
export type KeyHandler = (event: KeyEvent) => void;

/** A set of keybindings that dispatches {@link KeyEvent}s. @since 1.9.3 */
export interface Keymap {
  /** Register a handler for one binding or several. Chainable. */
  bind(binding: string | string[], handler: KeyHandler): Keymap;
  /** Remove one binding or several. Chainable. */
  unbind(binding: string | string[]): Keymap;
  /** Dispatch an event; `true` when a handler ran. */
  handle(event: KeyEvent): boolean;
  /** Registered bindings in canonical form, in registration order. */
  bindings(): string[];
}

// Canonical form so 'shift+ctrl+up', 'Ctrl+Shift+Up' and 'ctrl+shift+up' all
// land in the same slot instead of silently registering three times.
// Returns null when the binding has no single key part.
const normalizeBinding = (binding: string): string | null => {
  if (typeof binding !== 'string') return null;
  const b = binding.trim().toLowerCase();
  if (b === '') return null;
  const parts = b === '+' ? ['+'] : b.split('+').map((s) => s.trim()).filter((s) => s !== '');

  let wantCtrl = false, wantMeta = false, wantShift = false;
  const names: string[] = [];
  for (const p of parts) {
    if (isCtrlToken(p)) wantCtrl = true;
    else if (isMetaToken(p)) wantMeta = true;
    else if (p === 'shift') wantShift = true;
    else names.push(KEY_ALIAS[p] ?? p);
  }
  if (names.length !== 1) return null;

  const mods: string[] = [];
  if (wantCtrl) mods.push('ctrl');
  if (wantMeta) mods.push('meta');
  if (wantShift) mods.push('shift');
  return [...mods, names[0]].join('+');
};

/**
 * Create a keymap: bind shortcut strings to handlers and dispatch key events
 * at them, instead of hand-writing `if (matchKey(...))` chains.
 *
 * Bindings use the {@link matchKey} syntax and are stored in canonical form,
 * so `'shift+ctrl+up'` and `'Ctrl+Shift+Up'` are the same binding and the
 * second `bind` replaces the first. Matching is exact on all three modifiers:
 * `'up'` fires only on an unmodified Up. {@link Keymap.handle} tries bindings
 * in registration order, runs the first match and returns `true`; `false`
 * means nothing matched, which is the hook for treating the key as text.
 *
 * An invalid binding (no key part, such as `'ctrl+shift'`) throws a
 * `TypeError` rather than failing silently, since a typo'd shortcut that
 * never fires is hard to notice.
 *
 * @example
 * ```js
 * import { createKeymap, parseKeys } from 'ansimax';
 *
 * const keys = createKeymap()
 *   .bind(['ctrl+c', 'q'], () => process.exit())
 *   .bind('shift+tab', focusPrev)
 *   .bind('tab', focusNext);
 *
 * process.stdin.on('data', (buf) => {
 *   for (const key of parseKeys(buf.toString())) {
 *     if (!keys.handle(key)) insertText(key.sequence);
 *   }
 * });
 * ```
 *
 * @since 1.9.3
 */
export const createKeymap = (initial?: Record<string, KeyHandler>): Keymap => {
  const map = new Map<string, KeyHandler>();

  const resolve = (binding: string): string => {
    const key = normalizeBinding(binding);
    if (key === null) {
      throw new TypeError(
        `ANSIMAX_KEYMAP_BINDING: invalid keybinding ${JSON.stringify(binding)} — it needs exactly one key part, e.g. 'ctrl+c'`,
      );
    }
    return key;
  };

  const keymap: Keymap = {
    bind(binding, handler) {
      if (typeof handler !== 'function') {
        throw new TypeError('ANSIMAX_KEYMAP_HANDLER: handler must be a function');
      }
      for (const b of Array.isArray(binding) ? binding : [binding]) {
        map.set(resolve(b), handler);
      }
      return keymap;
    },

    unbind(binding) {
      for (const b of Array.isArray(binding) ? binding : [binding]) {
        map.delete(resolve(b));
      }
      return keymap;
    },

    handle(event) {
      if (!event) return false;
      for (const [binding, handler] of map) {
        if (matchKey(event, binding)) {
          handler(event);
          return true;
        }
      }
      return false;
    },

    bindings() {
      return [...map.keys()];
    },
  };

  if (initial) {
    for (const [binding, handler] of Object.entries(initial)) keymap.bind(binding, handler);
  }

  return keymap;
};
