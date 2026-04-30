// ─────────────────────────────────────────────
//  COLOR SYSTEM  –  24-bit, gradients, presets
// ─────────────────────────────────────────────

import { fgRgb, bgRgb, fg256, bg256, reset, sgr, FG, BG, STYLE } from '../utils/ansi.js';
import { hexToRgb, lerpColor, RGB } from '../utils/helpers.js';

export type ColorFn = (text: string) => string;

// ─────────────────────────────────────────────
//  Color suppression
//  Priority: NO_COLOR env > non-TTY stdout
//
//  _noColor starts as false. setNoColor() overrides it explicitly.
//  The isTTY check is evaluated lazily inside isNoColor() so that:
//    - production: non-TTY pipes/CI automatically suppress color
//    - tests: Jest runs without a TTY but setNoColor(false) keeps colors on
// ─────────────────────────────────────────────
let _noColor: boolean | null = null;  // null = "not overridden yet"

/** Override color suppression at runtime. Pass true to suppress, false to force on. */
export const setNoColor = (v: boolean): void => { _noColor = v; };

/** Reset to auto-detect mode (reads NO_COLOR + isTTY at call time). */
export const resetNoColor = (): void => { _noColor = null; };

/** Returns true when colors should be suppressed. */
export const isNoColor = (): boolean => {
  if (_noColor !== null) return _noColor;
  return Boolean(process.env['NO_COLOR']) || !process.stdout.isTTY;
};

// ─────────────────────────────────────────────
//  Clamp helpers — prevent malformed ANSI sequences
// ─────────────────────────────────────────────
const clampRgb = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const clamp256 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

// ─────────────────────────────────────────────
//  Safe hex parser — fail-soft on invalid input
//  Validates that the string is a real hex color before parsing.
//  hexToRgb() never throws — it parses anything — so we validate first.
// ─────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const safeHex = (h: string): RGB | null => {
  if (!HEX_RE.test(h.trim())) return null;
  return hexToRgb(h);
};

// ─────────────────────────────────────────────
//  Core wrap — respects color suppression
// ─────────────────────────────────────────────
const wrap = (open: string, text: string): string =>
  isNoColor() ? text : `${open}${text}${reset()}`;

// ─────────────────────────────────────────────
//  Basic color factories
// ─────────────────────────────────────────────
const makeFg = (code: number): ColorFn => (text) => wrap(sgr(code), text);
const makeBg = (code: number): ColorFn => (text) => wrap(sgr(code), text);

// ─────────────────────────────────────────────
//  compose — combine ANSI codes without nesting resets
//
//  Instead of wrapping strings inside each other (which produces
//  double resets), we collect the raw SGR opens and emit a single
//  combined escape + text + single reset.
//
//  Usage:
//    compose(sgr(STYLE.bold), sgr(FG.red))("Hi")
//    → "\x1b[1m\x1b[31mHi\x1b[0m"  (one reset at the end)
//
//  For convenience, compose() also accepts ColorFn — it extracts
//  the escape prefix by applying the function to an empty string
//  and stripping the trailing reset.
// ─────────────────────────────────────────────
export const compose = (...fns: ColorFn[]): ColorFn => (text: string) => {
  if (isNoColor()) return text;
  // Build a combined open sequence by applying each fn to '' and
  // extracting what it prepends (everything before the empty-string body)
  const opens = fns.map((fn) => {
    const result = fn('');
    // result is: <open><reset> — strip the trailing reset
    return result.endsWith(reset()) ? result.slice(0, -reset().length) : result;
  });
  return opens.join('') + text + reset();
};

// ─────────────────────────────────────────────
//  Gradient — interpolates stops across visible chars
//  Spaces are skipped for interpolation (no color wasted on whitespace).
//  Invalid hex stops are filtered out gracefully.
// ─────────────────────────────────────────────
export const gradient = (text: string, stops: string[]): string => {
  if (!text || isNoColor()) return text;

  // Filter out invalid hex stops — fail-soft
  const colors = stops.map(safeHex).filter((c): c is RGB => c !== null);
  if (colors.length < 2) return text;

  const chars   = [...text];
  const visible = chars.filter((c) => c !== ' ').length;
  if (visible === 0) return text;

  let colorIdx = 0;
  return chars.map((ch) => {
    if (ch === ' ') return ch;
    const t      = visible === 1 ? 0 : colorIdx / (visible - 1);
    const scaled = t * (colors.length - 1);
    const lo     = Math.floor(scaled);
    const hi     = Math.min(lo + 1, colors.length - 1);
    const { r, g, b } = lerpColor(colors[lo] as RGB, colors[hi] as RGB, scaled - lo);
    colorIdx++;
    return fgRgb(r, g, b) + ch + reset();
  }).join('');
};

const RAINBOW = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'];
export const rainbow: ColorFn = (text) => gradient(text, RAINBOW);

// ─────────────────────────────────────────────
//  Gradient presets
// ─────────────────────────────────────────────
export const presets = {
  sunset:  (t: string) => gradient(t, ['#ff6b6b', '#feca57', '#48dbfb']),
  ocean:   (t: string) => gradient(t, ['#0575e6', '#021b79']),
  fire:    (t: string) => gradient(t, ['#f7971e', '#ffd200', '#ff0000']),
  neon:    (t: string) => gradient(t, ['#f953c6', '#b91d73']),
  forest:  (t: string) => gradient(t, ['#134e5e', '#71b280']),
  aurora:  (t: string) => gradient(t, ['#00c6ff', '#0072ff', '#7e57c2']),
  candy:   (t: string) => gradient(t, ['#fd79a8', '#a29bfe', '#74b9ff']),
  gold:    (t: string) => gradient(t, ['#f7971e', '#ffd200']),
};

// ─────────────────────────────────────────────
//  Main color API
// ─────────────────────────────────────────────
export const color = {
  // ── Named foreground colors ──
  black:   makeFg(FG.black),
  red:     makeFg(FG.red),
  green:   makeFg(FG.green),
  yellow:  makeFg(FG.yellow),
  blue:    makeFg(FG.blue),
  magenta: makeFg(FG.magenta),
  cyan:    makeFg(FG.cyan),
  white:   makeFg(FG.white),

  // ── Bright foreground ──
  brightBlack:   makeFg(FG.brightBlack),
  brightRed:     makeFg(FG.brightRed),
  brightGreen:   makeFg(FG.brightGreen),
  brightYellow:  makeFg(FG.brightYellow),
  brightBlue:    makeFg(FG.brightBlue),
  brightMagenta: makeFg(FG.brightMagenta),
  brightCyan:    makeFg(FG.brightCyan),
  brightWhite:   makeFg(FG.brightWhite),

  // ── Common aliases ──
  gray:   makeFg(FG.brightBlack),
  grey:   makeFg(FG.brightBlack),
  orange: (t: string) => wrap(fgRgb(255, 165, 0), t),
  purple: makeFg(FG.magenta),

  // ── Named background colors ──
  bgBlack:   makeBg(BG.black),
  bgRed:     makeBg(BG.red),
  bgGreen:   makeBg(BG.green),
  bgYellow:  makeBg(BG.yellow),
  bgBlue:    makeBg(BG.blue),
  bgMagenta: makeBg(BG.magenta),
  bgCyan:    makeBg(BG.cyan),
  bgWhite:   makeBg(BG.white),

  // ── Text styles ──
  bold:          (t: string) => wrap(sgr(STYLE.bold),          t),
  dim:           (t: string) => wrap(sgr(STYLE.dim),           t),
  italic:        (t: string) => wrap(sgr(STYLE.italic),        t),
  underline:     (t: string) => wrap(sgr(STYLE.underline),     t),
  blink:         (t: string) => wrap(sgr(STYLE.blink),         t), // terminal support varies
  inverse:       (t: string) => wrap(sgr(STYLE.inverse),       t),
  strikethrough: (t: string) => wrap(sgr(STYLE.strikethrough), t),
  hidden:        (t: string) => wrap(sgr(STYLE.hidden),        t),

  // ── True-color (24-bit) — values clamped to 0–255 ──
  rgb: (r: number, g: number, b: number): ColorFn =>
    (t) => wrap(fgRgb(clampRgb(r), clampRgb(g), clampRgb(b)), t),

  bgRgb: (r: number, g: number, b: number): ColorFn =>
    (t) => wrap(bgRgb(clampRgb(r), clampRgb(g), clampRgb(b)), t),

  // ── Hex — fail-soft: invalid hex → plain text ──
  hex: (h: string): ColorFn => (t) => {
    const p = safeHex(h);
    return p ? wrap(fgRgb(p.r, p.g, p.b), t) : t;
  },

  bgHex: (h: string): ColorFn => (t) => {
    const p = safeHex(h);
    return p ? wrap(bgRgb(p.r, p.g, p.b), t) : t;
  },

  // ── 256-color — value clamped to 0–255 ──
  color256:   (n: number): ColorFn => (t) => wrap(fg256(clamp256(n)), t),
  bgColor256: (n: number): ColorFn => (t) => wrap(bg256(clamp256(n)), t),

  // ── Gradients ──
  gradient,
  rainbow,
  ...presets,
};

export default color;