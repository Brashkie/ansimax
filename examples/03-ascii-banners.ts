/**
 * 03 — ASCII Banners & Boxes
 * Real box styles: single, double, rounded, heavy, dashed, ascii
 *
 * Run: npx tsx examples/03-ascii-banners.ts
 */

import { ascii, gradient, color, listFonts, hasFont } from '../src/index.js';

console.log();
console.log(color.bold('━━━ ASCII Banners ━━━'));
console.log();

console.log(color.dim('// Big font (default)'));
console.log(ascii.banner('HELLO'));

console.log(color.dim('// Small font'));
console.log(ascii.banner('HELLO', { font: 'small' }));

console.log(color.dim('// With gradient'));
console.log(ascii.banner('ANSIMAX', {
  font: 'big',
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9', '#8be9fd']),
}));

console.log(color.dim('// Aligned center'));
console.log(ascii.banner('CENTER', { align: 'center' }));

console.log(color.dim('// Available fonts:'));
console.log('  fonts:', listFonts().join(', '));
console.log('  has "big":', hasFont('big'));
console.log('  has "small":', hasFont('small'));
console.log('  has "unicorn":', hasFont('unicorn'));
console.log();

console.log(color.bold('━━━ Boxes (6 real styles) ━━━'));
console.log();

// REAL box styles: single, double, rounded, heavy, dashed, ascii
const boxStyles = ['single', 'double', 'rounded', 'heavy', 'dashed', 'ascii'] as const;
for (const style of boxStyles) {
  console.log(color.dim(`// borderStyle: ${style}`));
  console.log(ascii.box(`This is a ${style} box`, {
    padding: 1,
    borderStyle: style,
  }));
}

console.log(color.dim('// Multi-line box'));
console.log(ascii.box(
  'Line 1\nLine 2 with a bit longer text\nLine 3',
  { padding: 1, borderStyle: 'rounded' },
));

console.log();
console.log(color.bold('━━━ Dividers ━━━'));
console.log();

console.log(ascii.divider({ char: '─', width: 50 }));
console.log(ascii.divider({ char: '═', width: 50 }));
console.log(ascii.divider({ char: '━', width: 50, label: 'Section' }));
console.log();

console.log(color.bold('━━━ Logo composer ━━━'));
console.log();

console.log(ascii.logo('LOGO', {
  font: 'big',
  colorFn: (t) => gradient(t, ['#ff6b6b', '#feca57', '#48dbfb']),
  borderStyle: 'rounded',
}));

console.log();
console.log(color.bold('━━━ ascii.measure ━━━'));
console.log();
const dim = ascii.measure('Hello World', { font: 'big' });
console.log(`  Banner dimensions: ${dim.width} × ${dim.height}`);
console.log();

console.log(color.bold(color.green('✓ ASCII test complete')));
console.log();
