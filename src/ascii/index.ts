// ─────────────────────────────────────────────
//  ASCII ART  –  built-in fonts, boxes, banners
// ─────────────────────────────────────────────

import { termSize, center, visibleLen, truncateAnsi, padEnd } from '../utils/helpers.js';
import { ColorFn } from '../colors/index.js';

type FontMap = Record<string, string[]>;

// ── Block font (5 lines tall) ──
const BLOCK: FontMap = {
  ' ': ['     ', '     ', '     ', '     ', '     '],
  A: [' ███ ', '█   █', '█████', '█   █', '█   █'],
  B: ['████ ', '█   █', '████ ', '█   █', '████ '],
  C: [' ███ ', '█    ', '█    ', '█    ', ' ███ '],
  D: ['████ ', '█   █', '█   █', '█   █', '████ '],
  E: ['█████', '█    ', '████ ', '█    ', '█████'],
  F: ['█████', '█    ', '████ ', '█    ', '█    '],
  G: [' ████', '█    ', '█  ██', '█   █', ' ████'],
  H: ['█   █', '█   █', '█████', '█   █', '█   █'],
  I: ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  J: ['█████', '   █ ', '   █ ', '█  █ ', ' ██  '],
  K: ['█   █', '█  █ ', '███  ', '█  █ ', '█   █'],
  L: ['█    ', '█    ', '█    ', '█    ', '█████'],
  M: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  N: ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  O: [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  P: ['████ ', '█   █', '████ ', '█    ', '█    '],
  Q: [' ███ ', '█   █', '█ █ █', '█  ██', ' ████'],
  R: ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  S: [' ████', '█    ', ' ███ ', '    █', '████ '],
  T: ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  U: ['█   █', '█   █', '█   █', '█   █', ' ███ '],
  V: ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  W: ['█   █', '█   █', '█ █ █', '██ ██', '█   █'],
  X: ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  Y: ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  Z: ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  '0': [' ███ ', '█  ██', '█ █ █', '██  █', ' ███ '],
  '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
  '2': [' ███ ', '█   █', '  ██ ', ' █   ', '█████'],
  '3': ['████ ', '    █', ' ███ ', '    █', '████ '],
  '4': ['█   █', '█   █', '█████', '    █', '    █'],
  '5': ['█████', '█    ', '████ ', '    █', '████ '],
  '6': [' ███ ', '█    ', '████ ', '█   █', ' ███ '],
  '7': ['█████', '   █ ', '  █  ', ' █   ', '█    '],
  '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
  '9': [' ███ ', '█   █', ' ████', '    █', ' ███ '],
  '!': ['  █  ', '  █  ', '  █  ', '     ', '  █  '],
  '?': [' ███ ', '█   █', '   █ ', '     ', '  █  '],
  '.': ['     ', '     ', '     ', '     ', '  █  '],
  '-': ['     ', '     ', '████ ', '     ', '     '],
  '+': ['     ', '  █  ', '█████', '  █  ', '     '],
  '#': [' █ █ ', '█████', ' █ █ ', '█████', ' █ █ '],
  '@': [' ███ ', '█   █', '█ ██ ', '█    ', ' ████'],
};

// ── Small font (3 lines tall) ──
const SMALL: FontMap = {
  ' ': ['   ', '   ', '   '],
  A: ['▄▀▄', '█▀█', '▀ ▀'],
  B: ['█▀▄', '█▀▄', '▀▀ '],
  C: ['▄▀▀', '█  ', '▀▀▄'],
  D: ['█▀▄', '█ █', '▀▀ '],
  E: ['█▀▀', '█▀ ', '▀▀▀'],
  F: ['█▀▀', '█▀ ', '▀  '],
  G: ['▄▀▀', '█ ▄', '▀▀▘'],
  H: ['█ █', '███', '▀ ▀'],
  I: ['▀█▀', ' █ ', '▀█▀'],
  J: [' ▄█', '  █', '▀▀ '],
  K: ['█▄▀', '█▀▄', '▀ ▀'],
  L: ['█  ', '█  ', '▀▀▀'],
  M: ['█▄█', '█ █', '▀ ▀'],
  N: ['█▄█', '█▀█', '▀ ▀'],
  O: ['▄▀▄', '█ █', '▀▄▀'],
  P: ['█▀▄', '██ ', '▀  '],
  Q: ['▄▀▄', '█▄█', '▀▄▀'],
  R: ['█▀▄', '██▄', '▀ ▀'],
  S: ['▄▀▀', '▀▀▄', '▄▄▘'],
  T: ['▀█▀', ' █ ', ' ▀ '],
  U: ['█ █', '█ █', '▀▄▀'],
  V: ['█ █', '█ █', ' ▀ '],
  W: ['█ █', '█▄█', '▀ ▀'],
  X: ['▀▄▀', ' █ ', '▀ ▀'],
  Y: ['▀▄▀', ' █ ', ' ▀ '],
  Z: ['▀▀█', ' █ ', '█▀▀'],
  '0': ['▄▀▄', '█ █', '▀▄▀'],
  '1': [' █ ', ' █ ', ' █ '],
  '2': ['▄▀▄', ' ▄▀', '▀▀▀'],
  '3': ['▀▀▄', ' ▀▄', '▄▄▘'],
  '4': ['█▄█', '  █', '  ▀'],
  '5': ['█▀▀', '▀▀▄', '▄▄▘'],
  '6': ['▄▀ ', '█▀▄', '▀▄▀'],
  '7': ['▀▀█', '  █', '  ▀'],
  '8': ['▄▀▄', '▄▀▄', '▀▄▀'],
  '9': ['▄▀▄', '▀▀█', ' ▄▘'],
  '!': [' █ ', ' █ ', ' ▪ '],
  '?': ['▄▀▄', ' ▄▘', ' ▪ '],
  '.': ['   ', '   ', ' ▪ '],
  '-': ['   ', '───', '   '],
  ':': [' ▪ ', '   ', ' ▪ '],
};

const renderFont = (text: string, fontMap: FontMap): string => {
  // Empty text → empty output (no glyphs to render)
  if (!text.length) return '';

  // Derive per-font cell width from the space character — every built-in font
  // defines a space, so this lookup is guaranteed to succeed.
  const sampleChar = fontMap[' '] as string[];
  const charWidth  = (sampleChar[0] as string).length;
  const empty      = ' '.repeat(charWidth);

  const chars = text
    .toUpperCase()
    .split('')
    .map((c) => fontMap[c] ?? fontMap['?'] ?? [empty]);
  const height = (chars[0] as string[]).length;
  const lines: string[] = [];
  for (let row = 0; row < height; row++) {
    lines.push(chars.map((c) => (c[row] ?? empty)).join(' '));
  }
  return lines.join('\n');
};

// ── Box drawing ──
export type BoxStyle = 'single' | 'double' | 'rounded' | 'heavy' | 'dashed' | 'ascii';

interface BoxChars { tl: string; tr: string; bl: string; br: string; h: string; v: string }

const BOX_STYLES: Record<BoxStyle, BoxChars> = {
  single:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double:  { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  rounded: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  heavy:   { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  dashed:  { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '╌', v: '╎' },
  ascii:   { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
};

export interface BoxOptions {
  padding?: number;
  borderStyle?: BoxStyle;
  width?: number | null;
}

export interface BannerOptions {
  font?: 'big' | 'small';
  colorFn?: ColorFn | null;
  align?: 'left' | 'center';
}

export interface DividerOptions {
  char?: string;
  width?: number | null;
  label?: string | null;
  style?: BoxStyle;
}

export interface LogoOptions {
  gradient?: ColorFn | null;
  boxStyle?: BoxStyle;
}

// ── Public API ──
const big = (text: string): string => renderFont(text, BLOCK);
const small = (text: string): string => renderFont(text, SMALL);

const figlet = (text: string, opts: { font?: 'big' | 'small' } = {}): string =>
  opts.font === 'small' ? small(text) : big(text);

const banner = (text: string, opts: BannerOptions = {}): string => {
  const { font = 'big', colorFn = null, align = 'left' } = opts;
  let rendered = font === 'small' ? small(text) : big(text);
  if (align === 'center') {
    const { cols } = termSize();
    rendered = rendered
      .split('\n')
      .map((l) => center(l, cols))
      .join('\n');
  }
  if (colorFn) rendered = rendered.split('\n').map(colorFn).join('\n');
  return rendered;
};

const box = (text: string, opts: BoxOptions = {}): string => {
  const { padding = 1, borderStyle = 'rounded', width = null } = opts;
  const b = BOX_STYLES[borderStyle] ?? BOX_STYLES.rounded;
  // text is typed as string — no need for Array.isArray check
  const lines = text.split('\n');
  // Use truncateAnsi to respect ANSI escape sequences and visible length
  const inner = width != null
    ? lines.map((l) => padEnd(truncateAnsi(l, width, ''), width))
    : lines;
  const w = Math.max(...inner.map((l) => visibleLen(l)), 0);
  const pad = ' '.repeat(padding);

  const top      = b.tl + b.h.repeat(w + padding * 2) + b.tr;
  const bottom   = b.bl + b.h.repeat(w + padding * 2) + b.br;
  const emptyRow = b.v  + ' '.repeat(w + padding * 2) + b.v;
  const rows     = inner.map((l) => b.v + pad + padEnd(l, w) + pad + b.v);
  const vPad     = Array(padding).fill(emptyRow) as string[];

  return [top, ...vPad, ...rows, ...vPad, bottom].join('\n');
};

const divider = (opts: DividerOptions = {}): string => {
  const { char, width = null, label = null, style = 'single' } = opts;
  const { cols } = termSize();
  const w     = width ?? cols;
  const b     = BOX_STYLES[style] ?? BOX_STYLES.single;
  const fill  = char ?? b.h;

  if (label) {
    const labelLen = visibleLen(label);              // ANSI-aware
    const side     = Math.max(0, Math.floor((w - labelLen - 2) / 2));
    const trailLen = Math.max(0, w - side - labelLen - 2);
    return fill.repeat(side) + ' ' + label + ' ' + fill.repeat(trailLen);
  }
  return fill.repeat(Math.max(0, w));
};

const logo = (text: string, opts: LogoOptions = {}): string => {
  const { gradient: gfn = null, boxStyle = 'double' } = opts;
  const art = big(text);
  const lines = art.split('\n').map((l) => (gfn ? gfn(l) : l));
  return box(lines.join('\n'), { borderStyle: boxStyle, padding: 1 });
};

export const ascii = {
  big,
  small,
  figlet,
  banner,
  box,
  divider,
  logo,
  boxStyles: Object.keys(BOX_STYLES) as Array<keyof typeof BOX_STYLES>,
};

export default ascii;