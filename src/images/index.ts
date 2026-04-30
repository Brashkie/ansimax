// ─────────────────────────────────────────────
//  IMAGES  –  pixel art, sprites, canvas
// ─────────────────────────────────────────────

import { fgRgb, bgRgb as bgRgbCode, reset, write } from '../utils/ansi.js';
import { hexToRgb, clamp, lerpColor, RGB } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
type Pixel     = RGB | null;
type PixelGrid = Pixel[][];

const FULL_BLOCK = '█';
const UPPER_HALF = '▀';

// ─────────────────────────────────────────────
//  Safe hex parser — same pattern as colors/loaders
// ─────────────────────────────────────────────
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const safeHex = (h: string): RGB | null => {
  if (!HEX_RE.test(h.trim())) return null;
  return hexToRgb(h);
};

// ─────────────────────────────────────────────
//  toRgb — null pixel → black
// ─────────────────────────────────────────────
const toRgb = (p: Pixel): RGB => p ?? { r: 0, g: 0, b: 0 };

// ─────────────────────────────────────────────
//  renderPixelArt
// ─────────────────────────────────────────────
export const renderPixelArt = (
  pixels: PixelGrid,
  opts: { scale?: number; halfBlock?: boolean } = {},
): string => {
  const { scale = 1, halfBlock = true } = opts;
  if (!pixels.length) return '';
  const lines: string[] = [];

  if (halfBlock) {
    for (let row = 0; row < pixels.length; row += 2) {
      let line = '';
      const topRow = pixels[row] ?? [];
      const botRow = pixels[row + 1] ?? [];
      for (let col = 0; col < topRow.length; col++) {
        const top = topRow[col] ?? null;
        const bot = botRow[col] ?? null;
        if (!top && !bot) { line += ' '.repeat(scale); continue; }
        let cell = '';
        for (let s = 0; s < scale; s++) {
          if (top && bot) {
            const t = toRgb(top), b = toRgb(bot);
            cell += fgRgb(t.r, t.g, t.b) + bgRgbCode(b.r, b.g, b.b) + UPPER_HALF + reset();
          } else if (top) {
            const { r, g, b } = toRgb(top);
            cell += fgRgb(r, g, b) + FULL_BLOCK + reset();
          } else {
            const { r, g, b } = toRgb(bot);
            cell += fgRgb(r, g, b) + '▄' + reset();
          }
        }
        line += cell;
      }
      lines.push(line);
    }
  } else {
    for (const row of pixels) {
      let line = '';
      for (const pixel of row) {
        if (!pixel) line += ' '.repeat(scale);
        else {
          const { r, g, b } = pixel;
          line += fgRgb(r, g, b) + FULL_BLOCK.repeat(scale) + reset();
        }
      }
      lines.push(line);
    }
  }
  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Built-in sprites
// ─────────────────────────────────────────────
const R: Pixel = { r: 255, g: 0,   b: 0   };
const Y: Pixel = { r: 255, g: 220, b: 0   };
const G: Pixel = { r: 255, g: 215, b: 0   };
const K: Pixel = { r: 0,   g: 0,   b: 0   };
const N: Pixel = null;

export const SPRITES: Record<string, { pixels: PixelGrid }> = {
  heart: { pixels: [
    [N,R,N,R,N],
    [R,R,R,R,R],
    [R,R,R,R,R],
    [N,R,R,R,N],
    [N,N,R,N,N],
  ]},
  star: { pixels: [
    [N,G,N,G,N],
    [G,G,G,G,G],
    [N,G,G,G,N],
    [G,N,G,N,G],
    [N,N,G,N,N],
  ]},
  smiley: { pixels: [
    [N,Y,Y,Y,N],
    [Y,K,Y,K,Y],
    [Y,Y,Y,Y,Y],
    [Y,K,Y,K,Y],
    [N,Y,Y,Y,N],
  ]},
  pacman: { pixels: [
    [N,Y,Y,Y,N],
    [Y,Y,Y,N,N],
    [Y,Y,N,N,N],
    [Y,Y,Y,N,N],
    [N,Y,Y,Y,N],
  ]},
};

// ─────────────────────────────────────────────
//  Sprite transforms
// ─────────────────────────────────────────────
export const flipHorizontal = (pixels: PixelGrid): PixelGrid =>
  pixels.map(row => [...row].reverse());

export const flipVertical = (pixels: PixelGrid): PixelGrid =>
  [...pixels].reverse();

export const rotate90 = (pixels: PixelGrid): PixelGrid => {
  if (!pixels.length || !pixels[0]?.length) return pixels;
  const rows = pixels.length;
  const cols = pixels[0].length;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (__, r) => pixels[rows - 1 - r]?.[c] ?? null)
  );
};

// ─────────────────────────────────────────────
//  Gradient rectangle
// ─────────────────────────────────────────────
export const gradientRect = (opts: {
  width?:  number;
  height?: number;
  colors?: string[];
  style?:  'horizontal' | 'vertical' | 'diagonal' | 'radial';
} = {}): string => {
  const {
    width  = 40,
    height = 10,
    colors = ['#ff0000', '#0000ff'],
    style  = 'horizontal',
  } = opts;

  // Validate colors — need at least 2 valid hex stops
  const stops = colors.map(safeHex).filter((c): c is RGB => c !== null);
  if (stops.length < 2) throw new Error('gradientRect: at least 2 valid hex color stops required');

  // Guard against division by zero when width or height is 1
  const safeW = Math.max(2, width);
  const safeH = Math.max(2, height);

  const pixels: PixelGrid = [];

  for (let row = 0; row < safeH; row++) {
    const line: Pixel[] = [];
    for (let col = 0; col < safeW; col++) {
      let t: number;
      if      (style === 'horizontal') t = col / (safeW - 1);
      else if (style === 'vertical')   t = row / (safeH - 1);
      else if (style === 'diagonal')   t = (col + row) / (safeW + safeH - 2);
      else {
        // radial — avoid sqrt: use squared distance comparison
        const cx = safeW / 2, cy = safeH / 2;
        const dx = (col - cx) / cx;
        const dy = (row - cy) / cy;
        t = clamp(Math.sqrt(dx * dx + dy * dy) / Math.SQRT2, 0, 1);
      }
      const scaled = t * (stops.length - 1);
      const lo     = Math.floor(scaled);
      const hi     = Math.min(lo + 1, stops.length - 1);
      line.push(lerpColor(stops[lo] as RGB, stops[hi] as RGB, scaled - lo));
    }
    pixels.push(line);
  }
  return renderPixelArt(pixels, { scale: 1, halfBlock: true });
};

// ─────────────────────────────────────────────
//  Canvas
// ─────────────────────────────────────────────
export interface Canvas {
  set:        (x: number, y: number, color: Pixel) => void;
  get:        (x: number, y: number) => Pixel;
  fill:       (color: Pixel) => void;
  drawRect:   (x: number, y: number, w: number, h: number, color: RGB, fill?: boolean) => void;
  drawCircle: (cx: number, cy: number, radius: number, color: RGB, fill?: boolean) => void;
  render:     (opts?: { scale?: number; halfBlock?: boolean }) => string;
  print:      (opts?: { scale?: number; halfBlock?: boolean }) => void;
  width:      number;
  height:     number;
  pixels:     PixelGrid;
}

export const createCanvas = (width: number, height: number, fillColor: Pixel = null): Canvas => {
  const pixels: PixelGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => fillColor ? { ...fillColor } : null)
  );

  return {
    set(x, y, color) {
      if (y >= 0 && y < height && x >= 0 && x < width) pixels[y]![x] = color;
    },
    get(x, y) { return pixels[y]?.[x] ?? null; },
    fill(color) {
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          pixels[y]![x] = color ? { ...color } : null;
    },
    drawRect(x, y, w, h, color, fill = false) {
      for (let dy = y; dy < y + h; dy++)
        for (let dx = x; dx < x + w; dx++)
          if (fill || dy === y || dy === y + h - 1 || dx === x || dx === x + w - 1)
            this.set(dx, dy, color);
    },
    drawCircle(cx, cy, radius, color, fill = false) {
      // Avoid sqrt: compare squared distances
      const r2 = radius * radius;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const dx = x - cx, dy = y - cy;
          const d2 = dx * dx + dy * dy;
          if (fill ? d2 <= r2 : Math.abs(Math.sqrt(d2) - radius) <= 0.7)
            this.set(x, y, color);
        }
    },
    render(opts = {}) { return renderPixelArt(pixels, opts); },
    // Use write() instead of console.log for consistency with the I/O layer
    print(opts = {}) { write(this.render(opts) + '\n'); },
    width, height, pixels,
  };
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────
export const images = {
  render:         renderPixelArt,
  sprites:        SPRITES,
  flipHorizontal,
  flipVertical,
  rotate90,
  sprite(name: string, opts: { scale?: number; halfBlock?: boolean } = {}): string {
    const s = SPRITES[name];
    if (!s) throw new Error(`Sprite "${name}" not found. Available: ${Object.keys(SPRITES).join(', ')}`);
    return renderPixelArt(s.pixels, opts);
  },
  gradientRect,
  createCanvas,
};

export default images;