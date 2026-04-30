// ─────────────────────────────────────────────
//  ANSI ESCAPE CODE PRIMITIVES
// ─────────────────────────────────────────────

export const ESC = '\x1b';
export const CSI = `${ESC}[`;

export const cursor = {
  up:      (n = 1): string => `${CSI}${n}A`,
  down:    (n = 1): string => `${CSI}${n}B`,
  right:   (n = 1): string => `${CSI}${n}C`,
  left:    (n = 1): string => `${CSI}${n}D`,
  to:      (x: number, y: number): string => `${CSI}${y};${x}H`,
  save:    (): string => `${CSI}s`,
  restore: (): string => `${CSI}u`,
  hide:    (): string => `${CSI}?25l`,
  show:    (): string => `${CSI}?25h`,
} as const;

export const screen = {
  clear:      (): string => `${CSI}2J${CSI}H`,
  clearLine:  (): string => `${CSI}2K`,
  clearRight: (): string => `${CSI}0K`,
  clearDown:  (): string => `${CSI}0J`,
  scrollUp:   (n = 1): string => `${CSI}${n}S`,
  scrollDown: (n = 1): string => `${CSI}${n}T`,
} as const;

export const FG = {
  black: 30, red: 31, green: 32, yellow: 33,
  blue: 34, magenta: 35, cyan: 36, white: 37,
  brightBlack: 90, brightRed: 91, brightGreen: 92,
  brightYellow: 93, brightBlue: 94, brightMagenta: 95,
  brightCyan: 96, brightWhite: 97,
} as const;

export const BG = {
  black: 40, red: 41, green: 42, yellow: 43,
  blue: 44, magenta: 45, cyan: 46, white: 47,
  brightBlack: 100, brightRed: 101, brightGreen: 102,
  brightYellow: 103, brightBlue: 104, brightMagenta: 105,
  brightCyan: 106, brightWhite: 107,
} as const;

export const STYLE = {
  reset: 0, bold: 1, dim: 2, italic: 3,
  underline: 4, blink: 5, inverse: 7,
  hidden: 8, strikethrough: 9,
} as const;

export const sgr = (...codes: number[]): string => `${CSI}${codes.join(';')}m`;
export const reset = (): string => sgr(STYLE.reset);
export const fgRgb = (r: number, g: number, b: number): string => `${CSI}38;2;${r};${g};${b}m`;
export const bgRgb = (r: number, g: number, b: number): string => `${CSI}48;2;${r};${g};${b}m`;
export const fg256 = (n: number): string => `${CSI}38;5;${n}m`;
export const bg256 = (n: number): string => `${CSI}48;5;${n}m`;

export type ColorSupport = 'none' | 'basic' | '256' | 'truecolor';

export const supportsColor = (): ColorSupport => {
  if (process.env['NO_COLOR']) return 'none';
  if (process.env['COLORTERM'] === 'truecolor' || process.env['COLORTERM'] === '24bit') return 'truecolor';
  if (process.env['TERM_PROGRAM'] === 'iTerm.app') return 'truecolor';
  if (process.env['TERM']?.includes('256color')) return '256';
  return 'basic';
};

export const sleep = (ms: number): Promise<void> => new Promise<void>((r) => setTimeout(() => r(), ms));
export const write = (str: string): boolean => process.stdout.write(str);
export const writeln = (str = ''): boolean => process.stdout.write(str + '\n');