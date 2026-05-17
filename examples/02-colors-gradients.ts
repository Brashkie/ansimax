/**
 * 02 — Colors & Gradients
 * Tests verified against actual ansimax@1.1.0 exports.
 *
 * Run: npx tsx examples/02-colors-gradients.ts
 */

import {
  color,
  gradient,
  rainbow,
  colorPresets,
  presetNames,
  compose,
  chain,
  registerPreset,
  listPresets,
} from '../src/index.js';

console.log();
console.log(color.bold('━━━ Basic Colors ━━━'));
console.log();

const basic = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const;
console.log('Basic 8 colors:');
for (const c of basic) process.stdout.write(color[c](c.padEnd(8)) + ' ');
console.log('\n');

const bright = ['brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightMagenta', 'brightCyan'] as const;
console.log('Bright variants:');
for (const c of bright) process.stdout.write(color[c](c.padEnd(15)) + ' ');
console.log('\n');

const bg = ['bgRed', 'bgGreen', 'bgBlue', 'bgYellow', 'bgMagenta', 'bgCyan'] as const;
console.log('Backgrounds:');
for (const c of bg) process.stdout.write(color[c](` ${c} `) + ' ');
console.log('\n');

console.log('Modifiers:');
console.log(' ',
  color.bold('bold'),
  color.italic('italic'),
  color.underline('underline'),
  color.dim('dim'),
  color.inverse('inverse'),
  color.strikethrough('strikethrough'),
);
console.log();

console.log(color.bold('━━━ Hex / RGB / 256 ━━━'));
console.log();

const hexes = ['#ff79c6', '#bd93f9', '#8be9fd', '#50fa7b', '#ffb86c', '#ff5555'];
console.log('Hex colors:');
for (const hex of hexes) process.stdout.write(color.hex(hex)(hex) + ' ');
console.log('\n');

console.log('RGB:');
console.log(' ', color.rgb(255, 121, 198)('rgb(255, 121, 198)'));
console.log(' ', color.rgb(189, 147, 249)('rgb(189, 147, 249)'));
console.log();

console.log('256-color (palette indices):');
for (const n of [196, 208, 226, 46, 51, 21, 201]) {
  process.stdout.write(color.color256(n)(`[${n}]`) + ' ');
}
console.log('\n');

console.log(color.bold('━━━ Gradients ━━━'));
console.log();

console.log('Multi-stop gradients:');
console.log(' ', gradient('Hello gradient world!', ['#ff0000', '#00ff00', '#0000ff']));
console.log(' ', gradient('Fire to ice', ['#ff6b6b', '#feca57', '#48dbfb']));
console.log(' ', gradient('Dracula theme', ['#ff79c6', '#bd93f9', '#8be9fd']));
console.log();

console.log(color.bold('━━━ Built-in colorPresets ━━━'));
console.log();
console.log(' Available:', presetNames.join(', '));
console.log();
console.log(' rainbow: ', rainbow('rainbow text!'));
console.log(' sunset:  ', colorPresets.sunset!('sunset preset'));
console.log(' ocean:   ', colorPresets.ocean!('ocean preset'));
console.log(' fire:    ', colorPresets.fire!('fire preset'));
console.log(' neon:    ', colorPresets.neon!('neon preset'));
console.log(' forest:  ', colorPresets.forest!('forest preset'));
console.log(' aurora:  ', colorPresets.aurora!('aurora preset'));
console.log(' candy:   ', colorPresets.candy!('candy preset'));
console.log(' gold:    ', colorPresets.gold!('gold preset'));
console.log();

console.log(color.bold('━━━ Custom presets ━━━'));
console.log();
registerPreset('my-pink', ['#ff6b6b', '#ff79c6', '#ffb6c1']);
console.log(' Registered. All presets now:', listPresets().join(', '));
console.log(' my-pink: ', colorPresets['my-pink']!('My custom pink preset!'));
console.log();

console.log(color.bold('━━━ Compose & Chain ━━━'));
console.log();
const fancy = compose(color.red, color.bold, color.underline);
console.log(' compose: ', fancy('red + bold + underline'));
console.log(' chain:   ', chain().magenta().italic().underline().apply('chained styles'));
console.log();

console.log(color.bold(color.green('✓ Colors & gradients test complete')));
console.log();
