// ─────────────────────────────────────────────
//  GENERAL HELPERS
// ─────────────────────────────────────────────

export interface RGB { r: number; g: number; b: number }

// ─────────────────────────────────────────────
//  Numeric helpers
// ─────────────────────────────────────────────
export const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const clampByte = (v: number): number => clamp(Math.round(v), 0, 255);

// ─────────────────────────────────────────────
//  Hex / RGB
// ─────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Returns true when a string is a valid 3- or 6-digit hex color. */
export const isHexColor = (hex: string): boolean =>
  typeof hex === 'string' && HEX_RE.test(hex.trim());

/**
 * Parses a hex color string to RGB. Throws on invalid input.
 * Use isHexColor() first if you need fail-soft behaviour.
 */
export const hexToRgb = (hex: string): RGB => {
  if (!isHexColor(hex)) {
    throw new Error(`Invalid hex color: "${hex}"`);
  }
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  const int = parseInt(full, 16);
  return { r: (int >> 16) & 0xff, g: (int >> 8) & 0xff, b: int & 0xff };
};

/** Converts R, G, B values to a hex string. Values are clamped to 0–255. */
export const rgbToHex = (r: number, g: number, b: number): string =>
  '#' + [clampByte(r), clampByte(g), clampByte(b)]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');

/** Linearly interpolates between two RGB colors. t is clamped to [0, 1]. */
export const lerpColor = (a: RGB, b: RGB, t: number): RGB => {
  const ct = clamp(t, 0, 1);
  return {
    r: Math.round(lerp(a.r, b.r, ct)),
    g: Math.round(lerp(a.g, b.g, ct)),
    b: Math.round(lerp(a.b, b.b, ct)),
  };
};

// Maps a 24-bit RGB value to the nearest xterm-256 palette index.
// Grayscale ramp: indices 232–255. Color cube: 16–231 (6×6×6).
export const rgbTo256 = (r: number, g: number, b: number): number => {
  const cr = clampByte(r), cg = clampByte(g), cb = clampByte(b);
  if (cr === cg && cg === cb) {
    if (cr < 8)   return 16;
    if (cr > 248) return 231;
    return Math.round((cr - 8) / 247 * 24) + 232;
  }
  return 16
    + 36 * Math.round(cr / 255 * 5)
    +  6 * Math.round(cg / 255 * 5)
    +      Math.round(cb / 255 * 5);
};

// ─────────────────────────────────────────────
//  ANSI string utilities
// ─────────────────────────────────────────────

// Covers SGR (m), cursor moves, screen clears, scrolling, save/restore,
// and OSC sequences (\x1b]...\x07 or \x1b]...\x1b\\).
const ANSI_RE = new RegExp(
  [
    '\\x1b\\[[0-9;?]*[a-zA-Z]', // CSI
    '\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)', // OSC
    '\\x1b[NOMP78=>c]',          // single-char escapes
  ].join('|'),
  'g',
);

export const stripAnsi = (str: string): string => str.replace(ANSI_RE, '');

export const visibleLen = (str: string): number => stripAnsi(str).length;

/**
 * Truncates a string with ANSI escapes to a max visible width.
 * Preserves color codes that started before the cut and emits a final reset.
 */
export const truncateAnsi = (str: string, width: number, ellipsis = '…'): string => {
  if (visibleLen(str) <= width) return str;
  const ellipsisLen = visibleLen(ellipsis);
  const target = Math.max(0, width - ellipsisLen);

  let visible = 0;
  let result = '';
  let i = 0;
  while (i < str.length && visible < target) {
    if (str[i] === '\x1b') {
      // Copy the entire escape sequence verbatim
      const match = str.slice(i).match(ANSI_RE);
      if (match && match[0] && str.indexOf(match[0], i) === i) {
        result += match[0];
        i += match[0].length;
        continue;
      }
    }
    result += str[i];
    visible++;
    i++;
  }
  return result + ellipsis + '\x1b[0m';
};

// ─────────────────────────────────────────────
//  Padding & alignment
// ─────────────────────────────────────────────
export const padEnd = (str: string, width: number, ch = ' '): string => {
  const pad = width - visibleLen(str);
  return pad > 0 ? str + ch.repeat(pad) : str;
};

export const padStart = (str: string, width: number, ch = ' '): string => {
  const pad = width - visibleLen(str);
  return pad > 0 ? ch.repeat(pad) + str : str;
};

export const center = (str: string, width: number, ch = ' '): string => {
  const pad = width - visibleLen(str);
  if (pad <= 0) return str;
  const l = Math.floor(pad / 2);
  const r = pad - l;
  return ch.repeat(l) + str + ch.repeat(r);
};

/** Repeats a string until its visible length reaches the target width. */
export const repeatVisible = (str: string, width: number): string => {
  if (!str || width <= 0) return '';
  const unit = visibleLen(str);
  if (unit === 0) return '';
  const times = Math.ceil(width / unit);
  return truncateAnsi(str.repeat(times), width, '');
};

// ─────────────────────────────────────────────
//  Terminal info
// ─────────────────────────────────────────────
export const termSize = (): { cols: number; rows: number } => ({
  cols: process.stdout.columns || 80,
  rows: process.stdout.rows    || 24,
});

// ─────────────────────────────────────────────
//  Word wrap — handles long tokens via soft-break
// ─────────────────────────────────────────────
export const wordWrap = (text: string, width: number): string[] => {
  if (width <= 0) return [text];

  const words  = text.split(' ');
  const lines: string[] = [];
  let current  = '';

  const breakLong = (word: string): string[] => {
    // Soft-break tokens longer than width into chunks
    const chunks: string[] = [];
    for (let i = 0; i < word.length; i += width) {
      chunks.push(word.slice(i, i + width));
    }
    return chunks;
  };

  for (const raw of words) {
    // Handle long tokens that don't fit on any line
    const tokens = raw.length > width ? breakLong(raw) : [raw];

    for (const word of tokens) {
      if (current.length + word.length + (current ? 1 : 0) <= width) {
        current += (current ? ' ' : '') + word;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
};