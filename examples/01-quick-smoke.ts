/**
 * 01 — Quick Smoke Test
 *
 * Verifies all major named exports from `ansimax` are importable and callable.
 * This is the FIRST test to run — if it fails, the package is broken.
 *
 * Run: npx tsx examples/01-quick-smoke.ts
 */

import {
  color,
  gradient,
  rainbow,
  ascii,
  loader,
  animate,
  frames,
  components,
  themes,
  images,
  trees,
  tree,
  configure,
  getConfig,
  // Utils
  stripAnsi,
  visibleLen,
  hexToRgb,
  rgbToHex,
  clamp,
  // ANSI primitives
  cursor,
  screen,
  supportsColor,
} from '../src/index.js';

const pass = (msg: string): void => console.log(color.green('✓'), msg);
const info = (label: string, value: unknown): void =>
  console.log('  ' + color.dim(label.padEnd(20)), value);

console.log();
console.log(color.bold(color.cyan('━━━ Ansimax v1.1.0 Smoke Test ━━━')));
console.log();

// 1. Colors
pass('color.red / color.green / color.blue');
info('color.red:', color.red('red text'));
info('color.green:', color.green('green text'));

// 2. Gradient
pass('gradient with multi-stop');
info('gradient:', gradient('rainbow text', ['#ff0000', '#00ff00', '#0000ff']));

// 3. Rainbow preset
pass('rainbow preset');
info('rainbow:', rainbow('hello rainbow!'));

// 4. Style modifiers
pass('color.bold / italic / underline');
info('bold:', color.bold('bold text'));
info('italic:', color.italic('italic text'));
info('underline:', color.underline('underlined text'));

// 5. Hex & RGB
pass('color.hex / color.rgb');
info('color.hex:', color.hex('#ff79c6')('Dracula pink'));
info('color.rgb:', color.rgb(189, 147, 249)('Dracula purple'));

// 6. ANSI utils
pass('stripAnsi / visibleLen');
const colored = color.red('hello');
info('stripAnsi:', JSON.stringify(stripAnsi(colored)));
info('visibleLen:', visibleLen(colored));

// 7. hexToRgb / rgbToHex
pass('hexToRgb / rgbToHex');
info('hexToRgb #ff79c6:', JSON.stringify(hexToRgb('#ff79c6')));
info('rgbToHex 189,147,249:', rgbToHex(189, 147, 249));

// 8. clamp
pass('clamp');
info('clamp(15, 0, 10):', clamp(15, 0, 10));

// 9. Capability detection
pass('supportsColor');
info('supportsColor():', supportsColor());

// 10. Module namespaces
pass('All namespaces accessible');
info('color:', typeof color);
info('ascii:', typeof ascii);
info('loader:', typeof loader);
info('animate:', typeof animate);
info('frames:', typeof frames);
info('components:', typeof components);
info('themes:', typeof themes);
info('images:', typeof images);
info('trees:', typeof trees);

// 11. tree() builder
pass('tree() builder');
const t = tree({ label: 'root', icon: '📦' });
t.addLeaf({ label: 'child1', icon: '📄' });
info('tree.render():', '\n' + t.render());

// 12. configure
pass('configure / getConfig');
const cfg = getConfig();
info('theme:', cfg.theme);
info('colorMode:', cfg.colorMode);

// 13. cursor / screen primitives
pass('cursor / screen primitives');
info('cursor.hide():', JSON.stringify(cursor.hide()));
info('cursor.show():', JSON.stringify(cursor.show()));
info('screen.clearLine():', JSON.stringify(screen.clearLine()));

console.log();
console.log(color.bold(color.green('✅ All smoke tests passed!')));
console.log(color.dim('You have a working ansimax installation.'));
console.log();
