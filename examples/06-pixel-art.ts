/**
 * 06 — Pixel Art & Canvas
 *
 * Tests sprites, custom canvas, gradient rectangles, transforms.
 *
 * Run: npx tsx examples/06-pixel-art.ts
 */

import {
  images,
  createCanvas,
  gradientRect,
  SPRITES,
  flipHorizontal,
  flipVertical,
  rotate90,
  color,
} from '../src/index.js';

console.log();
console.log(color.bold('━━━ Built-in Sprites ━━━'));
console.log();

// List available sprites
console.log(color.dim('Available sprites:'), Object.keys(SPRITES).join(', '));
console.log();

// Render a couple
console.log(color.dim('// heart sprite'));
console.log(images.sprite('heart'));
console.log();

console.log(color.dim('// star sprite'));
console.log(images.sprite('star'));
console.log();

console.log(color.bold('━━━ Gradient Rectangles ━━━'));
console.log();

console.log(color.dim('// Linear gradient'));
console.log(gradientRect({
  width: 50,
  height: 3,
  colors: ['#ff6b6b', '#feca57', '#48dbfb'],
}));
console.log();

console.log(color.dim('// Linear with Bayer dither'));
console.log(gradientRect({
  width: 50,
  height: 4,
  colors: ['#ff6b6b', '#feca57', '#48dbfb'],
  dither: 'bayer',
}));
console.log();

console.log(color.dim('// Diagonal gradient'));
console.log(gradientRect({
  width: 40,
  height: 4,
  colors: ['#bd93f9', '#8be9fd'],
  angle: 45,
}));
console.log();

console.log(color.dim('// Radial gradient'));
console.log(gradientRect({
  width: 30,
  height: 8,
  colors: ['#ff79c6', '#282a36'],
  type: 'radial',
}));
console.log();

console.log(color.bold('━━━ Custom Canvas ━━━'));
console.log();

const c = createCanvas(40, 10);

// Background
c.fill({ r: 18, g: 18, b: 38 });

// Some shapes
c.drawRect(2, 2, 8, 4, { r: 255, g: 100, b: 100 }, true);
c.drawRect(15, 2, 8, 4, { r: 100, g: 255, b: 100 }, true);
c.drawRect(28, 2, 8, 4, { r: 100, g: 100, b: 255 }, true);

// Circle
c.drawCircle(20, 7, 2, { r: 255, g: 220, b: 100 }, true);

c.print();
console.log();

console.log(color.bold('━━━ Sprite transforms ━━━'));
console.log();

const star = SPRITES.star!.pixels;

console.log(color.dim('// Original'));
console.log(images.render(star));
console.log();

console.log(color.dim('// Flipped horizontal'));
console.log(images.render(flipHorizontal(star)));
console.log();

console.log(color.dim('// Flipped vertical'));
console.log(images.render(flipVertical(star)));
console.log();

console.log(color.dim('// Rotated 90°'));
console.log(images.render(rotate90(star)));
console.log();

console.log(color.bold(color.green('✓ Pixel art test complete')));
console.log();
