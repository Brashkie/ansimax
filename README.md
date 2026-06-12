<div align="center">

<img src="media/ansimax.png" alt="Ansimax logo" width="380"/>

### The ultimate CLI rendering library for Node.js

_Colors • Gradients • Animations • ASCII Art • Pixel Art • Trees • Components • Themes_

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/badge/npm-v1.3.0-cb3837.svg?style=flat-square)](https://www.npmjs.com/package/ansimax)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg?style=flat-square)](tsconfig.json)
[![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen.svg?style=flat-square)](#testing)
[![Tests](https://img.shields.io/badge/tests-2000%2B%20passing-brightgreen.svg?style=flat-square)](#testing)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen.svg?style=flat-square)](#)
[![Node](https://img.shields.io/badge/Node-%3E%3D18-43853d.svg?style=flat-square)](#requirements)
[![ESM%20%2B%20CJS](https://img.shields.io/badge/ESM%20%2B%20CJS-dual-blueviolet.svg?style=flat-square)](#)

**English** · [Español](README.es.md)

</div>

---

<div align="center">

### 🎬 Preview

<table>
  <tr>
    <td align="center">
      <strong>Animations</strong><br/>
      <img src="media/animations.gif" alt="Ansimax animations demo" width="420"/>
    </td>
    <td align="center">
      <strong>Loaders</strong><br/>
      <img src="media/loaders.gif" alt="Ansimax loaders demo" width="420"/>
    </td>
  </tr>
</table>

</div>

---

## 🌟 What is Ansimax?

Ansimax is a **batteries-included rendering library** for building beautiful terminal UIs in Node.js. One package replaces a stack of 8+ dependencies — colors, gradients, ASCII art, spinners, progress bars, tables, menus, trees, themes, pixel art — combined into a single coherent TypeScript API with **zero runtime dependencies**.

```bash
npm install ansimax
```

```js
import { color, gradient, ascii, loader, sleep } from 'ansimax';

console.log(ascii.banner('hello', {
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9', '#8be9fd']),
}));

const stop = loader.spin('Building project', { color: '#bd93f9' });
await sleep(1500);
stop('Build complete', true);
```

---

## 💡 Why Ansimax?

| Without Ansimax | With Ansimax |
|---|---|
| Install 8+ packages: `chalk`, `gradient-string`, `figlet`, `ora`, `cli-progress`, `cli-table3`, `boxen`, `inquirer` | One install: `ansimax` |
| Mix incompatible APIs, different paradigms, conflicting types | Consistent functional API, single source of truth |
| No coherent theme system across packages | Built-in themes (Dracula, Nord, Matrix, Cyberpunk, +5) |
| Manual cursor cleanup, no crash safety | Reference-counted cursor + crash handlers built in |
| No `AbortSignal` support in most CLI libs | Every animation, loader, and prompt is abortable |
| Each lib brings its own runtime fallback logic | Unified `NO_COLOR` / `FORCE_COLOR` / TTY detection |
| No memory bounds on color caches | Bounded LRU caches everywhere (no leaks under load) |

---

## 🆚 Comparison with the Node.js ecosystem

Ansimax replaces a stack of popular Node.js libraries with **one coherent, typed, zero-dependency package**:

| Feature | chalk | gradient-string | ora | cli-progress | figlet | boxen | inquirer | cli-table3 | **Ansimax** |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Basic + 256 colors | ✅ | — | — | — | — | — | — | — | ✅ |
| Truecolor with adaptive fallback | ✅ | ✅ | — | — | — | — | — | — | ✅ |
| Multi-stop gradients | — | ✅ | — | — | — | — | — | — | ✅ |
| **Animated gradients** | — | — | — | — | — | — | — | — | ✅ |
| **Easing curves (5 presets + custom)** | — | — | — | — | — | — | — | — | ✅ |
| **Conic gradients (radial sweep)** | — | — | — | — | — | — | — | — | ✅ |
| ASCII banners | — | — | — | — | ✅ | — | — | — | ✅ |
| **Image → ASCII converter** | — | — | — | — | — | — | — | — | ✅ |
| **Figlet `.flf` font parser** | — | — | — | — | ✅ (own) | — | — | — | ✅ (250+ fonts) |
| Custom font registry | — | — | — | — | partial | — | — | — | ✅ |
| Boxes with multiple styles | — | — | — | — | — | ✅ | — | — | ✅ (6 styles) |
| Spinners (multiple styles) | — | — | ✅ | — | — | — | — | — | ✅ (11 styles) |
| Animated progress bars | — | — | — | ✅ | — | — | — | — | ✅ |
| **Hierarchical/parallel tasks** | — | — | — | — | — | — | — | — | ✅ |
| Tables (multi-line, ANSI-aware) | — | — | — | — | — | — | — | ✅ | ✅ |
| Interactive menus + multi-select | — | — | — | — | — | — | ✅ | — | ✅ |
| **Trees with cycle detection** | — | — | — | — | — | — | — | — | ✅ |
| **Split layouts (vsplit/hsplit)** | — | — | — | — | — | — | — | — | ✅ (v1.3.0) |
| **JSON colored pretty-printer** | — | — | — | — | — | — | — | — | ✅ (v1.3.0) |
| **Pixel art + canvas + sprites** | — | — | — | — | — | — | — | — | ✅ |
| **Theme system + per-instance isolation** | — | — | — | — | — | — | — | — | ✅ |
| `AbortSignal` everywhere | — | — | partial | — | — | — | partial | — | ✅ |
| `NO_COLOR` env support | ✅ | partial | partial | — | — | — | — | — | ✅ |
| Stable error codes (`ANSIMAX_*`) | — | — | — | — | — | — | — | — | ✅ |
| TypeScript-first (strict mode) | partial | partial | ✅ | partial | partial | ✅ | partial | partial | ✅ |
| **Zero runtime dependencies** | ✅ | — | — | — | — | — | — | — | ✅ |
| ESM + CJS dual export | partial | partial | ✅ | ✅ | partial | ✅ | partial | partial | ✅ |
| **Test coverage** | ~95% | partial | partial | partial | partial | partial | partial | partial | **~98% (2000+ tests)** |

> Comparison reflects what each library officially supports at time of writing. Some libraries can be combined to approach ansimax's feature set, but at the cost of bundle size, version-skew bugs, and inconsistent APIs.

---

## 📦 Installation

```bash
npm install ansimax
# or
pnpm add ansimax
# or
yarn add ansimax
```

**Requirements:** Node.js ≥ 18. ESM and CJS both supported. Examples published with the package — see [`/examples`](./examples).

---

## ⚡ 30-second example

```js
import { color, gradient, loader, ascii, sleep } from 'ansimax';

console.log(ascii.banner('deploy', {
  colorFn: (t) => gradient(t, ['#ff6b6b', '#feca57', '#48dbfb']),
}));

const stop = loader.spin('Building project', { color: '#bd93f9' });
await sleep(1500);             // simulate async work
stop('Build complete', true);  // ✓ + success color

console.log(color.green('✓') + ' Ready in ' + color.bold('1.4s'));
```

---

## 🚀 Quick Start

```js
import { configure, color, themes, gradient } from 'ansimax';

// Global configuration
configure({ theme: 'dracula', animationSpeed: 'normal' });

// Basic styling
console.log(color.red('error'));
console.log(color.bold(color.cyan('important')));

// Multi-stop gradient
console.log(gradient('rainbow text', [
  '#ff5555', '#ffaa00', '#ffff00',
  '#00ff00', '#0099ff', '#cc44ff',
]));

// Switch theme — fires subscribers
themes.use('cyberpunk');
console.log(themes.primary('cyberpunk primary'));
```

---

## ✨ Features

- 🎨 **Colors** — Truecolor / 256 / basic with adaptive fallback. NO_COLOR / FORCE_COLOR / TTY detection
- 🌈 **Gradients** — Multi-stop linear, radial, diagonal, arbitrary-angle. Custom presets via `registerPreset`
- 🔠 **ASCII Art** — Banners (`big`/`small` fonts), boxes (6 styles), dividers, logos. Stream API + custom font registry
- 🖼️ **Pixel Art** — Sprites, alpha blending, dithered gradients, canvas with dirty-rect rendering, braille mode (2×4 sub-pixel)
- 🌳 **Trees** — Builder + plain-data API, 4 styles, per-node colors/icons, max-depth, cycle detection, walk/find/map/filter algorithms
- 🎞️ **Animations** — Typewriter, fade, slide, pulse, wave, glitch, reveal. AbortSignal-aware, reducedMotion mode
- ⏳ **Loaders** — 11 spinner styles, animated bars, hierarchical/parallel tasks, countdowns, multi-spinner manager
- 🎬 **Frames** — Sequenced playback with pause/resume/seek, live push-based renderer, drift-corrected timing, morph
- 🧱 **Components** — Tables (ANSI-aware, multi-line cells), badges, status lines, sections, columns, timelines, interactive menus
- 🎨 **Themes** — 8 built-ins (Dracula, Nord, Monokai, Cyberpunk, Pastel, Matrix, Ocean, Sunset). Per-instance isolation, `onChange` listeners, `bg*` helpers
- ⚙️ **Configure** — Centralized config with subscribers, batched updates, `withConfig()` temporary overrides, strict mode
- 🛠️ **Utils** — ANSI primitives, cursor control, terminal hyperlinks (OSC 8), `setTitle`, `safeJson`, `onResize`, debounce/throttle/memoize

---

## 📸 Showcase

### Colors & Gradients

<img src="media/colors.png" alt="Colors and gradients" />

```js
import { color, gradient, rainbow } from 'ansimax';

// Basic colors
console.log(color.red('red'), color.green('green'), color.blue('blue'));

// Style modifiers
console.log(color.bold('bold'), color.italic('italic'), color.underline('underlined'));

// Multi-stop gradient
console.log(gradient('fire to ocean', ['#ff6b6b', '#feca57', '#48dbfb']));

// Built-in rainbow preset
console.log(rainbow('built-in rainbow preset'));
```

### Animated Gradients (v1.2.0)

```js
import { animateGradient, sleep } from 'ansimax';

// Color flow animation — runs until you call stop()
const ctrl = animateGradient('Loading...', ['#ff79c6', '#bd93f9', '#8be9fd'], {
  duration: 2000,    // ms per cycle
  fps: 30,
  direction: 'forward',  // or 'reverse'
});

await sleep(3000);
ctrl.stop();

// v1.2.2: await directly (no .done needed)
await animateGradient('Done!', ['#50fa7b', '#bd93f9'], {
  infinite: false, cycles: 2, duration: 800,
});
```

### Easing Curves (v1.2.0)

<img src="media/easing_curves.png" alt="Easing curves preview" />

```js
import { gradient } from 'ansimax';

const stops = ['#ff79c6', '#bd93f9', '#8be9fd'];

// Five built-in easings + custom function support
console.log(gradient('hello world', stops, { easing: 'linear' }));
console.log(gradient('hello world', stops, { easing: 'ease-in' }));
console.log(gradient('hello world', stops, { easing: 'ease-out' }));
console.log(gradient('hello world', stops, { easing: 'ease-in-out' }));
console.log(gradient('hello world', stops, { easing: 'cubic-bezier' }));

// Or pass your own easing function (t → eased t, both in [0,1])
console.log(gradient('hello world', stops, { easing: (t) => t * t * t }));
```

### Conic Gradients (v1.2.0)

<img src="media/conic_gradients.png" alt="Conic gradients preview" />

```js
import { gradientRect } from 'ansimax';

// Radial sweep around center — rainbow wheel
console.log(gradientRect({
  width: 30, height: 15,
  colors: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
  style: 'conic',
  startAngle: 0,   // rotation angle in degrees
  dither: 'bayer',
}));
```

### Reusable Gradients (v1.2.3)

```js
import { createGradient, reverseGradient, ascii } from 'ansimax';

// Pre-resolve hex stops once — significantly faster for repeated use
const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);

console.log(fire('First line'));
console.log(fire('Second line'));
console.log(fire('Third line'));

// Use as a colorFn for banners — same ColorFn signature
console.log(ascii.banner('FIRE', { colorFn: fire }));

// v1.2.4: inspect metadata
console.log('Stops:', fire.stops);             // → ['#ff5555', '#ffb86c', '#f1fa8c']
console.log('Resolved:', fire.resolvedStops);  // → [{r:255,g:85,b:85}, ...]

// v1.2.4: reverse a gradient (preserves default options)
const ice = reverseGradient(fire);
console.log(ice('Cool side'));

// Per-call options still work — perfect for animation
for (let p = 0; p < 1; p += 0.05) {
  process.stdout.write('\r' + fire('flowing', { phase: p }));
  await new Promise((r) => setTimeout(r, 50));
}
```

### ASCII Art

<img src="media/ascii_art.png" alt="ASCII art" />

```js
import { ascii, gradient } from 'ansimax';

console.log(ascii.banner('HELLO', {
  font: 'big',
  align: 'center',
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9']),
}));

console.log(ascii.box('Rainbow box!', { padding: 1, borderStyle: 'rounded' }));
```

### Image → ASCII (v1.2.5)

```js
import { ascii } from 'ansimax';
import sharp from 'sharp';

// Get raw RGB pixels from any image library — example using `sharp`.
// You can use jimp, pngjs, canvas, or any decoder. Ansimax stays zero-deps.
const { data, info } = await sharp('./photo.png')
  .raw()
  .toBuffer({ resolveWithObject: true });

// Convert raw RGB buffer → PixelGrid (a 2D array of { r, g, b } objects)
const pixels = [];
for (let y = 0; y < info.height; y++) {
  const row = [];
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * info.channels;
    row.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
  }
  pixels.push(row);
}

// Now use ansimax — multiple ways:

// Monochrome
console.log(ascii.fromImage(pixels, { width: 80 }));

// Color + Floyd-Steinberg dithering + detailed ramp
console.log(ascii.fromImage(pixels, {
  width: 100,
  color: true,
  dither: 'floyd-steinberg',
  ramp: 'detailed',
}));

// Edge-detection mode (line art)
console.log(ascii.fromImage(pixels, {
  width: 80,
  edgeDetect: 'sobel',
  edgeThreshold: 50,
  ramp: 'blocks',
}));

// Face mode for portraits (boosts midtone contrast)
console.log(ascii.fromImage(pixels, {
  width: 60,
  ramp: 'detailed',
  faceMode: true,
}));
```

### Figlet Fonts (v1.2.5)

```js
import { readFileSync } from 'node:fs';
import { parseFiglet, ascii, gradient } from 'ansimax';

// Download fonts from http://www.figlet.org/fontdb.cgi
const font = parseFiglet(readFileSync('./standard.flf', 'utf8'));

console.log(ascii.figletText('Hello!', font));

// With color
console.log(ascii.figletText('STYLE', font, {
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9', '#8be9fd']),
}));
```

### Trees

<img src="media/trees.png" alt="Trees" />

```js
import { tree, color } from 'ansimax';

const project = tree({ label: 'my-app', icon: '📦', color: color.bold });
const src = project.add({ label: 'src', icon: '📁' });
src.addLeaf({ label: 'index.ts', icon: '📄' });
src.addLeaf({ label: 'app.ts',   icon: '📄' });

console.log(project.render({
  style: 'rounded',
  palette: [color.cyan, color.green, color.magenta],
  guideColor: color.dim,
}));
```

### Pixel Art & Canvas

<img src="media/pixel_art.png" alt="Pixel art" />

```js
import { images, createCanvas, gradientRect, SPRITES } from 'ansimax';

// Built-in sprite
console.log(images.sprite('heart'));

// Smooth gradient with Bayer dither
console.log(gradientRect({
  width: 50, height: 4,
  colors: ['#ff6b6b', '#feca57', '#48dbfb'],
  dither: 'bayer',
}));

// Custom canvas
const c = createCanvas(40, 10);
c.fill({ r: 18, g: 18, b: 38 });
c.drawCircle(20, 5, 4, { r: 255, g: 200, b: 0 }, true);
const starSprite = SPRITES.star;
if (starSprite) c.drawSprite(2, 2, starSprite.pixels);
c.print();
```

### Components

<img src="media/components.png" alt="Components" />

```js
import { components, color } from 'ansimax';

console.log(components.table([
  ['Module',     'Status',                'Coverage'],
  ['colors',     color.green('● ready'),  '100%'],
  ['animations', color.green('● ready'),  '100%'],
  ['loaders',    color.green('● ready'),  '100%'],
], { borderStyle: 'rounded' }));

console.log(components.badge('VERSION', 'v1.3.0'));
console.log(components.badge('BUILD',   'passing'));
```

### Timeline

<img src="media/timeline.png" alt="Timeline" />

```js
import { components } from 'ansimax';

console.log(components.timeline([
  { label: 'Project init',   done: true,  time: '10:00' },
  { label: 'Build pipeline', done: true,  time: '10:15' },
  { label: 'Run tests',      done: false, time: '10:32' },
  { label: 'Deploy to npm',  done: false },
]));
```

### Loaders & Progress

```js
import { loader, sleep } from 'ansimax';

// Spinner with success/failure
const stop = loader.spin('Loading...', { color: '#bd93f9' });
await sleep(1500);
stop('Done!', true);   // ✓ green icon

// Animated progress bar
await loader.progressAnimate(100, 'Downloading', {
  color: '#50fa7b', delay: 25,
});

// Hierarchical tasks with parallel execution
await loader.tasks([
  {
    text: 'Build',
    fn: async () => await sleep(500),
    subtasks: [
      { text: 'TypeScript', fn: async () => await sleep(800) },
      { text: 'Bundle',     fn: async () => await sleep(600) },
    ],
  },
  { text: 'Test', fn: async () => await sleep(700) },
], { parallel: true });
```

### Animations

```js
import { animate, gradient, sleep } from 'ansimax';

await animate.typewriter('Welcome to the deployment wizard...', {
  speed: 30,
  colorFn: (t) => gradient(t, ['#bd93f9', '#ff79c6']),
});

await animate.fadeIn('Loading complete', { duration: 600 });

// Race steps against a timeout — never hang
await animate.parallel([
  async () => await sleep(500),   // simulated network check
  async () => await sleep(700),   // simulated database check
  async () => await sleep(400),   // simulated auth check
], { timeout: 5000 });
```

### Themes

<img src="media/themes.png" alt="Themes" />

```js
import { themes, createTheme } from 'ansimax';

// Built-in themes
themes.use('dracula');
console.log(themes.primary('hello'));

// Listen for changes
const off = themes.onChange((newTheme, oldTheme) => {
  console.log(`Theme: ${oldTheme.name} → ${newTheme.name}`);
});

// Multi-tenant: each instance fully isolated
const tenantA = createTheme('nord');
const tenantB = createTheme('matrix');

// Define a custom theme and register it ONLY in tenantA
tenantA.register('custom', {
  name: 'Custom',
  primary:   '#ff5e5e',
  secondary: '#5e5eff',
  accent:    '#5eff5e',
  success:   '#10b981',
  warning:   '#fbbf24',
  error:     '#ef4444',
  info:      '#06b6d4',
  muted:     '#6b7280',
  bg:        '#1e293b',
  surface:   '#334155',
  text:      '#f1f5f9',
  gradient:  ['#ff5e5e', '#5eff5e', '#5e5eff'],
});

console.log('tenantA themes include custom?', tenantA.list().includes('custom'));
console.log('tenantB themes include custom?', tenantB.list().includes('custom'));
//                                            ↑ false — full isolation
```

### Panels — Split Layouts (v1.3.0)

```js
import { panels, ascii } from 'ansimax';

// Side-by-side columns
const left  = ascii.box('Sidebar',   { borderStyle: 'rounded' });
const right = ascii.box('Main view', { borderStyle: 'rounded' });

console.log(panels.vsplit([left, right], { gap: 2, align: 'center' }));

// Vertical stacking
console.log(panels.hsplit([
  '── Application ──',
  ascii.box('Body content'),
  '── Footer ──',
], { gap: 1, align: 'center' }));

// Nested — sidebar + main inside an app shell
console.log(panels.hsplit([
  '── My App ──',
  panels.vsplit([
    ascii.box('Sidebar', { width: 20 }),
    ascii.box('Main',    { width: 40 }),
  ], { gap: 2 }),
  '── End ──',
]));
```

### JSON Pretty-print (v1.3.0)

```js
import { json } from 'ansimax';

// Colored, depth-aware pretty-printing
console.log(json.pretty({
  name: 'ansimax',
  version: '1.3.0',
  features: ['colors', 'gradients', 'panels'],
  stats: { tests: 2000, coverage: 0.98 },
  active: true,
}));

// Depth limit — collapses deep objects to {...}
console.log(json.pretty(deeplyNested, { maxDepth: 2 }));

// Item limit — huge arrays show "... (N more)"
console.log(json.pretty(largeArray, { maxItems: 10 }));

// Circular references handled gracefully
const obj = { name: 'foo' };
obj.self = obj;
console.log(json.pretty(obj));   // → "self": [Circular]
```

---

## 📚 Examples

Eleven production-grade examples ship in the npm package and are runnable directly. Find them in [`/examples`](./examples) once you install:

| File | What it demonstrates |
|---|---|
| `01-quick-smoke.ts` | Quick smoke test — verifies every major import works |
| `02-colors-gradients.ts` | Every color fn, gradient types, presets, compose, chain API |
| `03-ascii-banners.ts` | Banners (`big`/`small`), 6 box styles, dividers, logo composer |
| `04-trees.ts` | Tree builder + plain-data API, 4 styles, palettes, algorithms (walk/find/map/filter) |
| `05-components.ts` | Tables, badges, status, sections, columns, timelines, progress bars |
| `06-pixel-art.ts` | Sprites, custom canvas, gradient rects with dither, transforms (flip/rotate) |
| `07-animations.ts` | typewriter, fadeIn/Out, slide, pulse, wave, glitch, reveal |
| `08-loaders.ts` | spinner styles, animated progress, hierarchical tasks, countdown |
| `09-themes.ts` | All 8 built-in themes, listeners, custom theme registration, per-instance isolation |
| `10-everything.ts` | Comprehensive showcase — every module exercised in one cohesive demo |
| `all-in-one.mjs` | Full demo in **ESM** (plain JS with `import`) — no TypeScript needed |
| `all-in-one.cjs` | Full demo in **CommonJS** (plain JS with `require`) — no TypeScript needed |

Run any example with:
```bash
# TypeScript examples
npx tsx examples/10-everything.ts

# Plain JS — ESM
node examples/all-in-one.mjs

# Plain JS — CommonJS
node examples/all-in-one.cjs
```

---

## 🎯 Use Cases

- **CLI installers & scaffolders** — beautiful first-run experience (create-react-app, create-next-app style)
- **DevOps tools** — deployment dashboards, build pipelines, health monitors
- **Dev experience** — better test runners, lint output, error formatting
- **Interactive prompts** — menus, confirmations, multi-select wizards
- **Data exploration** — tables, trees, charts for terminal-first workflows
- **Status reporters** — real-time progress, multi-task orchestration
- **ASCII intros** — game launchers, demo splash screens, login banners

---

## ⚙️ Configuration

Global config affects every module that respects it (colors, themes, animation speed, etc.):

```js
import { configure, getConfig, withConfig, onConfigKeyChange } from 'ansimax';

configure({
  colorMode:      'auto',     // 'none' | 'basic' | '256' | 'truecolor' | 'auto'
  animationSpeed: 'normal',   // 'slow' | 'normal' | 'fast' | 'instant'
  theme:          'dracula',  // any registered theme
  reducedMotion:  false,
});

// Listen for changes (per-key — avoids over-firing)
const off = onConfigKeyChange('theme', (newTheme, oldTheme) => {
  console.log(`Theme: ${oldTheme} → ${newTheme}`);
});

// Temporary override + auto-restore on completion or throw
await withConfig({ animationSpeed: 'fast' }, async () => {
  // ...your fast-mode code here...
});

// Strict mode catches config typos
// configure({ unknwnKey: 'x' }, { strict: true });  // throws RangeError
```

---

## ⚠️ Error codes

Several ansimax functions throw `Error` / `TypeError` / `RangeError` for invalid input.
Catching by error code is the **stable, recommended** way to handle them programmatically — message text may evolve, but `.code` values are guaranteed semver-stable.

```js
import { themes, ascii, parseFiglet } from 'ansimax';

try {
  themes.use('inexistent-theme');
} catch (e) {
  if (e.code === 'ANSIMAX_UNKNOWN_THEME') {
    themes.use('dracula');  // fallback
  } else {
    throw e;  // re-throw unexpected errors
  }
}
```

### All error codes

| Code | Thrown by | Type | When |
|---|---|---|---|
| `ANSIMAX_INVALID_THEME` | `themes.register` | `TypeError` | Theme value is not a plain object |
| `ANSIMAX_INVALID_THEME_NAME` | `themes.register` | `TypeError` | Theme has missing/empty `name` |
| `ANSIMAX_UNKNOWN_THEME` | `themes.use` | `RangeError` | Requested theme name not registered |
| `ANSIMAX_INVALID_FONT_NAME` | `ascii.registerFont` | `TypeError` | Empty or non-string font name |
| `ANSIMAX_RESERVED_FONT_NAME` | `ascii.registerFont` | `Error` | Overwriting built-in font without `{ force: true }` |
| `ANSIMAX_INVALID_FIGLET_INPUT` | `parseFiglet` | `TypeError` | Non-string or empty `.flf` content |
| `ANSIMAX_INVALID_FIGLET_HEADER` | `parseFiglet` | `TypeError` | First line is not a valid FIGfont header |
| `ANSIMAX_INVALID_FIGLET_HEIGHT` | `parseFiglet` | `TypeError` | Header declared zero/negative height |

---

## 🧩 Ecosystem packages

The **ansimax ecosystem** is structured in two tiers — companion packages that extend the core, and independent evolutions that target different platforms.

### `@ansimax/*` — Companion packages

Scoped packages that extend `ansimax` without breaking its zero-dependency promise. Each is published independently but shares ansimax's philosophy and naming.

| Package | Status | Description |
|---|:-:|---|
| `ansimax` | ✅ stable | Terminal-rendering core. Zero dependencies. |
| `@ansimax/image` | 🟡 planned | Image-to-ASCII loader — PNG/JPEG/WebP from file/buffer/URL |
| `@ansimax/cli` | 🟡 planned | Standalone binary — `npx @ansimax/cli demo`, font browser, image converter |
| `@ansimax/fonts` | 🟡 planned | 250+ figlet `.flf` fonts pre-bundled, ready to use |
| `@ansimax/sprites` | 🔴 future | Curated sprite library (animals, UI icons, technical diagrams) |
| `@ansimax/video` | 🔴 future | Video frame extraction → ASCII playback |
| `@ansimax/themes-extra` | 🔴 future | Community-contributed themes pack |

**How they connect:**

```
                ┌─────────────────────────────┐
                │   ansimax  (zero deps)      │  ← core, you always install
                │   • colors, ASCII, panels   │
                │   • types: PixelGrid, etc.  │
                └────────────┬────────────────┘
                             │ peer dependency
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  @ansimax/image      @ansimax/cli         @ansimax/fonts
  (deps: jimp)        (binary)             (data only)
```

Each companion declares `"ansimax": "^X.Y.Z"` as `peerDependency` — semver-coordinated, never duplicated, never out of sync.

### `ansimax-*` — Independent evolutions

Standalone projects that build **alongside** ansimax for different platforms. Not companions — these are separate identities with their own scope and release cycle.

| Package | Status | Description |
|---|:-:|---|
| `ansimax-native` | 🔴 future | **Rust + TS rewrite** of the rendering hot path. Native performance via napi-rs. Same API surface as `ansimax`. |
| `ansimax-web` | 🔴 future | **Browser rendering** layer. ANSI → HTML/CSS conversion + canvas rendering. For demos, docs sites, web terminals. |

**Sub-ecosystems**: each of these can have their own scoped sub-packages (`@ansimax-native/image`, `@ansimax-web/canvas`, etc.) over time.

### Why two naming conventions?

Industry convention used by many mature ecosystems (Babel, Vue, Webpack, etc.):

- **`@scope/*`** = "same project family, coordinated release, same team"
- **`name-*`** = "inspired by / works alongside, independent identity"

By using both, ansimax signals:
- The **core** (`ansimax`) stays small, zero-dep, focused on terminal rendering
- The **ecosystem** (`@ansimax/*`) grows around it as opt-in extensions
- **Evolutions** (`ansimax-native`, `ansimax-web`) explore different platforms without compromising the core

> 💡 **Coming soon**: When `@ansimax/image` or similar packages are released, this section will link to them. Want one of these built sooner? [Open an issue](https://github.com/Brashkie/ansimax/issues) to vote.

---

## 🛣️ Roadmap

Ansimax is being built toward a **full terminal rendering platform** — a Node-native answer to what Python developers get from `rich` + `textual` combined, with Node-specific improvements where it matters.

The roadmap intentionally targets — and aims to surpass — gaps that even mature Python TUI libraries haven't fully solved: live-diff renderers, animated gradients, terminal image protocols, and a true reactive layer.

### ✅ Phase 1 — Core foundation
- [x] Styling engine — ANSI 16 / 256 / truecolor with adaptive fallback
- [x] Hex + RGB helpers with clamping and validation
- [x] `NO_COLOR` / `FORCE_COLOR` env support + non-TTY auto-detection
- [x] `AbortSignal` integration across animations and loaders
- [x] `compose()` style stacking with single-reset emission
- [x] Bounded LRU escape cache (512 entries, packed-RGB keyed)
- [x] Custom preset registry (`registerPreset`, `listPresets`)

### ✅ Phase 2 — Gradient engine
- [x] Linear gradients (multi-stop)
- [x] Rainbow + 6 built-in presets
- [x] Radial gradients (in `gradientRect`)
- [x] Diagonal gradients
- [x] Arbitrary-angle gradients
- [x] Bayer 4×4 dithering for smooth tonal transitions
- [x] Single-stop UX (CSS-style behavior)
- [x] **Animated gradients** — color flow over time with `animateGradient()` (v1.2.0)
- [x] **Gradient interpolation curves** — `linear` / `ease-in` / `ease-out` / `ease-in-out` / `cubic-bezier` / custom (v1.2.0)
- [x] **Conic gradients** — radial sweep with `style: 'conic'` (v1.2.0)

### ✅ Phase 3 — ASCII engine
- [x] Block fonts (`big`, `small`)
- [x] Banner with gradient + alignment + per-char coloring
- [x] Box drawing (6 border styles)
- [x] Divider with style variants
- [x] Logo composer (gradient + box wrapping)
- [x] Custom font registry (`registerFont`, `hasFont`, `listFonts`)
- [x] Stream API (`ascii.stream()` with AbortSignal)
- [x] **Image → ASCII** converter — `ascii.fromImage()` with luminance mapping (v1.2.5)
- [x] **Color ASCII** rendering — preserve image colors via `color: true` (v1.2.5)
- [x] **Image dithering** — Floyd-Steinberg error diffusion (v1.2.5)
- [x] **Face-optimized ASCII** — histogram stretching for portraits (v1.2.5)
- [x] **Figlet font support** — `.flf` parser + renderer (`parseFiglet` + `ascii.figletText`) (v1.2.5)
- [x] **Edge detection** — Sobel operator integrated in `fromImage` (v1.2.5, bonus)

### ✅ Phase 4 — Terminal UI primitives
- [x] Tables (irregular rows, multi-line cells, ANSI-aware)
- [x] Boxes with multiple styles
- [x] Status messages + badges (with border option)
- [x] Timelines with done/pending states
- [x] Interactive menus (single + multi-select)
- [x] Columns layout (truncate/wrap overflow)
- [x] Sections (gradient headers with auto-width)
- [x] Trees (collapsible, max-depth, cycle-safe)
- [x] **Panels** — split layouts: `hsplit`, `vsplit` with alignment + nesting (v1.3.0)
- [x] **JSON/YAML pretty-printing** — colored, depth-limit, circular-safe (v1.3.0)
- [ ] **Layouts** (flexbox-style positioning)
- [ ] **Grid system** (CSS Grid-inspired column/row spans)
- [ ] **Markdown rendering** (headings, lists, code blocks, tables)
- [ ] **Syntax highlighting** (built-in language grammars)
- [ ] **Logging integration** (drop-in replacement for `console`/`pino`/`winston` transports)

### ✅ Phase 5 — Cursor & screen control
- [x] Cursor visibility, save/restore, positioning, line navigation
- [x] Screen clearing (line, area, full)
- [x] Reference-counted cursor (overlapping calls safe)
- [x] Crash-safe restore (exit/SIGINT/SIGTERM handlers)
- [x] Terminal hyperlinks (OSC 8)
- [x] Window title (OSC 2)
- [x] Bell (BEL)

### ✅ Phase 6 — Animation engine
- [x] Typewriter, fadeIn, fadeOut, slide, pulse, wave, glitch, reveal
- [x] All `AbortSignal`-aware
- [x] `reducedMotion` mode for accessibility
- [x] Frame morph (text → text interpolation, cinematic decryption)
- [x] `parallel()` with timeout
- [x] Signal propagation to nested animations
- [ ] **Easing functions library** (24 standard easings: cubic, elastic, bounce, back)
- [ ] **Animation composition** (`parallel + sequence + delay` DSL)
- [ ] **Spring physics** animations (`react-spring` style)
- [ ] **Tween engine** (interpolate any value type)

### 🟡 Phase 7 — Progress ecosystem
- [x] Spinners (11 styles) with color + AbortSignal
- [x] Animated progress bars
- [x] Multi-task runners (sequential + parallel)
- [x] Countdown timers
- [x] Multi-spinner manager (stacked concurrent spinners)
- [x] Hierarchical tasks (parent + subtasks rollup)
- [ ] **Live ETA estimation** (rolling average + Kalman filter projection)
- [ ] **Live refresh diff renderer** (no flicker, only redraw changed lines)
- [ ] **Progress groups** (named groups with shared theme)
- [ ] **Throughput meters** (bytes/sec, ops/sec with auto-scaling units)

### 🟡 Phase 8 — Capability detection
- [x] TTY detection (auto-disable in pipes/CI)
- [x] `NO_COLOR` / `FORCE_COLOR` env support
- [x] Color depth detection (16 / 256 / truecolor)
- [x] CI provider detection (GitHub Actions, CircleCI, GitLab, Buildkite, Drone, Travis)
- [x] Terminal program detection (iTerm, vscode, WezTerm, Hyper, Apple_Terminal)
- [x] Windows Terminal detection (`WT_SESSION`)
- [ ] **Unicode width detection** (CJK halfwidth/fullwidth, emoji clusters, ZWJ sequences)
- [ ] **Image protocol detection** (Sixel, iTerm inline images, Kitty graphics protocol)
- [ ] **Terminal capability database** (full xterm capability flags + version probes)
- [ ] **Font metrics detection** (cell width/height for pixel-accurate layouts)

### 🟡 Phase 9 — Advanced rendering
- [x] Dirty-rectangle canvas (only redraw changed pixels)
- [x] Bounded LRU caches (escape sequences, render cache, ANSI cache)
- [x] Drift-corrected timing (animations stay locked to wall-clock)
- [ ] **Diff renderer** (line-level damage tracking for full UIs)
- [ ] **Virtual buffer** (compose UI without writing to stdout)
- [ ] **Z-index / layering** (overlap panels with priority)
- [ ] **Mouse event support** (click, hover, drag, scroll wheel)
- [ ] **Keyboard event abstraction** (arrow keys, modifiers, key sequences, dead keys)
- [ ] **Full TUI framework** (reactive components — Textual-equivalent for Node)

### 🔴 Phase 10 — Terminal charts
- [ ] Bar charts (horizontal + vertical, grouped, stacked)
- [ ] Line charts (with braille for sub-character resolution)
- [ ] Sparklines (inline mini-charts for status bars)
- [ ] Area charts (filled with gradients)
- [ ] Heatmaps (color-mapped 2D grids)
- [ ] Pie / donut charts (with percentage labels)
- [ ] Scatter plots
- [ ] Box plots / candlestick charts
- [ ] Real-time streaming charts (live data feed with rolling window)
- [ ] **Plot composer** (multi-chart dashboards with shared axes)

### 🔴 Phase 11 — Forms & Input
- [ ] Text input prompts (with autocomplete + history)
- [ ] Password prompts (masked, strength meter)
- [ ] Confirm dialogs (yes/no with default highlight)
- [ ] Numeric input (with min/max validation)
- [ ] Date/time pickers (calendar widget)
- [ ] File picker (filesystem navigator)
- [ ] Form composer (multi-field with validation + error display)
- [ ] **Wizard flows** (multi-step forms with back/forward, progress indicator)

### 🔴 Phase 12 — Image & media
- [ ] Sixel image rendering (xterm, mlterm, WezTerm)
- [ ] iTerm2 inline images (base64 protocol)
- [ ] Kitty graphics protocol
- [ ] PNG/JPEG → terminal image (auto-detect best protocol)
- [ ] Video preview (frame-by-frame at low FPS)
- [ ] QR code generation (with size + ECC level options)
- [ ] Bar code generation (Code 128, EAN-13)

### 🔴 Phase 13 — Plugin system
- [ ] Plugin API for custom components
- [ ] Theme marketplace
- [ ] Custom font registration via npm packages
- [ ] Community animations registry
- [ ] Capability provider interface (plug in custom detectors)
- [ ] Renderer plugins (swap stdout for any writable stream)

### 🔴 Phase 14 — Reactivity layer (TUI framework)
- [ ] **Component lifecycle** (mount/unmount/update hooks)
- [ ] **Reactive state** (auto re-render on data change, signals or hooks)
- [ ] **Virtual DOM diffing** (line-level updates)
- [ ] **Event bus** (component communication)
- [ ] **Application loop** (single render tree with full lifecycle)
- [ ] **Routing** (multi-screen apps with history)
- [ ] **DevTools integration** (inspect component tree, mark changed nodes)
- [ ] **CSS-in-TS styling** (scoped styles per component)

**Legend:** ✅ Complete · 🟡 Partial · 🔴 Planned

---

## 🧪 Testing

```bash
npm test              # Run all 2000+ tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Coverage (as of v1.3.0):

| Metric | Score |
|---|:-:|
| **Statements** | ~98% |
| **Branches** | ~95% |
| **Functions** | ~99% |
| **Lines** | ~99% |
| **Total tests** | **2,000+** |
| **Test suites** | 18 |
| **CI matrix** | Node 18, 20, 22, latest |
| **Platforms tested** | Linux, macOS, Windows |

---

## 🛠️ Requirements

- **Node.js** ≥ 18
- **TypeScript** ≥ 5.0 (for typed consumption — optional)
- **Terminal** with truecolor support recommended (Windows Terminal, iTerm2, WezTerm, Kitty, modern xterm). Gracefully degrades to 256 / 16 / no-color.

---

## 🏗️ Project Structure

```
ansimax/
├── src/
│   ├── colors/         Color rendering + gradient engine
│   ├── themes/         Theme system + 8 built-ins
│   ├── ascii/          Banners, boxes, fonts
│   ├── animations/     Typewriter, fade, slide, pulse, wave, glitch, reveal
│   ├── loaders/        Spinners, progress, tasks, multi-loader
│   ├── frames/         Sequenced playback + live renderer + morph
│   ├── components/     Tables, badges, status, timelines, menus
│   ├── images/         Sprites, canvas, dithered gradients
│   ├── trees/          Tree builder + algorithms
│   ├── utils/          ANSI primitives + helpers
│   └── configure.ts    Global config + subscribers
├── examples/           10 examples (TS) + 2 (JS — ESM & CJS) — all features covered
└── __tests__/          16 test suites, 1700+ tests
```

---

## 📝 Changelog

### v1.3.0 — Phase 4 progress: Panels + JSON pretty-print

Minor release adding two new top-level modules — split layouts and JSON pretty-printing:

- 🪟 **`panels` module** — `vsplit` (columns) + `hsplit` (rows) with ANSI-aware width, alignment (`start`/`center`/`end`), gap, fixed-width mode, nesting
- 🎨 **`json` module** — colored JSON pretty-printer with depth limit, item limit, string truncation, circular reference detection
- 🛣️ **Phase 4 roadmap**: 8/15 → **10/15** complete

```js
import { panels, json, ascii } from 'ansimax';

// Side-by-side columns
console.log(panels.vsplit([
  ascii.box('Sidebar', { width: 20 }),
  ascii.box('Main',    { width: 40 }),
], { gap: 2 }));

// Pretty-print JSON
console.log(json.pretty({ name: 'app', tests: 2000 }, { maxDepth: 3 }));
```

Drop-in replacement for `1.2.8`. Two new modules, zero breaking changes.

### v1.2.8 — Documentation polish

Patch release with massively improved JSDoc + IntelliSense coverage:

- 📝 **`components` module** — `table`, `badge`, `status`, `timeline` now have full JSDoc with runnable examples
- 📝 **`loaders` module** — `loader.spin` and `loader.tasks` now show usage patterns in IntelliSense
- 📝 **`themes` module** — full JSDoc with switching, registering, subscribing examples
- 📝 **`animations` module** — `animate.typewriter` and `animate.fadeIn` show how to use abort signals, reduced-motion, custom colors
- 📝 **`ascii.box`** — 4 examples (basic, multiline, fixed-width, colored content)
- 📖 **Error codes section** in README — all 8 `ANSIMAX_*` codes documented

Total: ~30 new `@example` blocks visible in your editor. No code changes —
your existing programs run identically.

Drop-in replacement for `1.2.7`.

### v1.2.7 — Bug fixes + robustness

Patch release focused on edge case handling and better DX:

- 🐛 **`fromImage` rejects invalid dimensions explicitly** — `width: 0`, `NaN`, `Infinity` now return `''` instead of clamping silently
- 🐛 **`figletText('')` returns `''`** — previously returned empty rows
- 🛡️ **Non-rectangular grids handled gracefully** — rows of different widths no longer crash `fromImage`
- 🎯 **Error codes added throughout ASCII module** — `ANSIMAX_INVALID_FIGLET_HEADER`, `ANSIMAX_INVALID_FONT_NAME`, etc. for programmatic catch
- 📝 **Better error messages** — `parseFiglet` now includes a snippet of the problematic input

```js
try {
  ascii.registerFont('big', myFont);  // 'big' is reserved
} catch (e) {
  if (e.code === 'ANSIMAX_RESERVED_FONT_NAME') {
    ascii.registerFont('big', myFont, { force: true });  // override
  }
}
```

Drop-in replacement for `1.2.6`.

### v1.2.6 — ASCII module improvements

Patch release with ASCII engine improvements:

- 🎨 **4 new built-in ramps** — `binary`, `dots`, `shades`, `ascii64`
- 🖼️ **`bgColor` option** in `fromImage` — colors go on background (great with `ramp: 'binary'` for photo effect)
- 🔆 **`brightness` and `contrast`** pre-adjustment in `fromImage` — tune tonal range without re-processing
- 📏 **`kerning` option** in `figletText` — control space between glyphs
- 📄 **Multi-line `figletText`** — input with `\n` renders multiple FIGfont blocks with optional `lineSpacing`

```js
import { ascii, ASCII_RAMPS } from 'ansimax';

// Photo-like rendering with colored background blocks
console.log(ascii.fromImage(pixels, {
  width: 80,
  bgColor: true,
  ramp: 'binary',
  brightness: 0.1,
  contrast: 0.2,
}));

// Multi-line figlet with spacing
console.log(ascii.figletText('TITLE\nSUBTITLE', font, {
  kerning: 1,
  lineSpacing: 1,
}));
```

Drop-in replacement for `1.2.5`.

### v1.2.5 — Phase 3 complete: image-to-ASCII engine

Minor release closing the ASCII engine roadmap with 5 new features:

- 🖼️ **`ascii.fromImage(pixels, opts)`** — Image → ASCII converter (input: `PixelGrid`)
- 🎨 **Color ASCII rendering** — `color: true` preserves source colors
- 📐 **Floyd-Steinberg dithering** — `dither: 'floyd-steinberg'` for smoother tonal gradients
- 👤 **Face-optimized mode** — `faceMode: true` boosts midtone contrast for portraits
- 🔠 **Figlet (.flf) support** — `parseFiglet()` + `ascii.figletText()` for 250+ community fonts
- ⚡ **Bonus: Sobel edge detection** — `edgeDetect: 'sobel'` for line-art effects

```js
import { readFileSync } from 'node:fs';
import { ascii, parseFiglet } from 'ansimax';

// Build a small PixelGrid by hand (use sharp/jimp/etc for real images —
// see Image → ASCII section above)
const pixels = [
  [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }],
  [{ r: 0, g: 0, b: 255 }, { r: 255, g: 255, b: 0 }],
];

// Image to ASCII (input from sharp/jimp/etc, no decoder dependency)
console.log(ascii.fromImage(pixels, {
  width: 80,
  color: true,
  dither: 'floyd-steinberg',
  ramp: 'detailed',
}));

// Figlet rendering
const font = parseFiglet(readFileSync('./standard.flf', 'utf8'));
console.log(ascii.figletText('Hello!', font));
```

Drop-in replacement for `1.2.4`.

### v1.2.4 — Gradient utilities + inspectability

Patch release adding inspection metadata and a `reverseGradient()` helper:

- 🔍 **`ReusableGradient` exposes `.stops`, `.resolvedStops`, `.defaultOptions`** — all frozen, all read-only
- 🔄 **`reverseGradient()` helper** — flips a gradient's stop order (works with arrays or `ReusableGradient`)
- 🎯 **`presets` exported as canonical name** — alongside the existing `colorPresets` alias

```js
import { createGradient, reverseGradient } from 'ansimax';

const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);
const ice  = reverseGradient(fire);

console.log(fire.stops);  // ['#ff5555', '#ffb86c', '#f1fa8c']  — read-only
console.log(fire('warm'));
console.log(ice('cool'));
```

Drop-in replacement for `1.2.3`.

### v1.2.3 — Gradient factory + performance

Patch release adding a performance-oriented API:

- ⚡ **`createGradient()` factory** — pre-resolves hex stops once for reuse, ~40-60% faster for animation loops and bulk colorizing
- 📖 More JSDoc with runnable examples
- 🎯 Matches the `ColorFn` signature — works as `colorFn` in `ascii.banner`, themes, etc.

```js
import { createGradient, ascii } from 'ansimax';

const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);
console.log(fire('Reused colors!'));
console.log(ascii.banner('FIRE', { colorFn: fire }));
```

Drop-in replacement for `1.2.2`.

### v1.2.2 — Quality polish

Patch release focused on API ergonomics and robustness refinements.

- ✨ **`animateGradient` is now thenable** — `await animateGradient(...)` directly without `.done`
- 🎯 **Stable error codes** — theme errors carry `.code` properties (`ANSIMAX_UNKNOWN_THEME`, etc.) for programmatic catch
- 🛡️ **Sandbox safety** — `animateGradient` no longer crashes when `process.stdout` is unavailable (workers, edge runtimes)
- 📖 **Better JSDoc** — `gradient()` now shows full IntelliSense with examples
- 🐛 **README fix** — Easing Curves snippet now copy-paste runnable

Drop-in replacement for `1.2.0`.

### v1.2.0 — Phase 2 complete: animated, eased & conic gradients

Minor release closing the gradient engine roadmap with three powerful features:

- 🌊 **`animateGradient()`** — color flow over time with proper lifecycle (Promise, signal, fps, direction)
- 📐 **Easing curves** — `linear` / `ease-in` / `ease-out` / `ease-in-out` / `cubic-bezier` / custom functions
- ⭕ **Conic gradients** — `gradientRect({ style: 'conic', startAngle })` for radial sweeps

```js
import { animateGradient } from 'ansimax';

const ctrl = animateGradient('Loading...', ['#ff79c6', '#bd93f9', '#8be9fd']);
await sleep(3000);
ctrl.stop();
```

Fully backwards-compatible — every 1.1.x program runs identically.

### v1.1.2 — Maturity & robustness

Patch release focused on quality refinements — no API changes.

- 🛡️ **`process.setMaxListeners` defensive bump** — prevents `MaxListenersExceededWarning` in HMR / nodemon / ts-node-dev setups where ansimax modules re-register cursor-restore handlers
- 🧪 **Uniform `TypeError` for theme validation** — `themes.register()` now consistently throws `TypeError` for structural / type errors (was a mix of `Error` and `TypeError`)
- 🎯 **`themes.use()` throws `RangeError`** for unknown theme names (was `Error`) — better semantic match for "value out of allowed set"
- 📝 **Cleaner barrel re-exports** — header comment now documents legacy aliases and recommends canonical names

Drop-in replacement for `1.1.1`.

### v1.1.1 — Bug fixes + cleaner examples

Patch release fixing two bugs from real-world v1.1.0 testing, plus a refreshed examples folder.

- 🐛 **Fixed `box()` crash** with `padding: { x, y }` — now gracefully falls back to default for non-numeric padding (also handles NaN, Infinity, strings)
- 🐛 **Fixed `components.menu()` cursor leak** on abrupt exit (Ctrl+C, SIGTERM) — emergency cleanup handlers now restore the cursor even when the process is killed mid-menu
- 📚 **New examples** — 10 TypeScript examples + 2 plain JS variants (`all-in-one.mjs` for ESM, `all-in-one.cjs` for CommonJS)
- 📖 **READMEs updated** — preview GIFs in the header, comprehensive showcase GIF in the footer

No API changes — drop-in replacement for `1.1.0`.

### v1.1.0 — Comprehensive hardening + new features

A massive robustness pass across every module, plus a new `trees` module. **100% backward compatible** — every existing API works identically.

**Highlights:**

- 🌳 **New `trees` module** — builder API + plain-data API, 4 styles, cycle detection, algorithms (`walk`, `find`, `count`, `map`, `filter`)
- ⚙️ **`configure.ts` upgrades** — `onConfigKeyChange`, `pauseListeners` / `resumeListeners`, `withConfig()`, strict mode
- 🎨 **Themes** — per-instance isolation (multi-tenant safe), `tryUse`, `onChange` listeners, `unregister`, `bg*` helpers, dynamic `style(name)` accessor
- 🌈 **Colors** — `registerPreset` / `listPresets`, bounded LRU escape cache, NaN/Infinity-safe RGB, single-stop gradient UX
- 🖼️ **Images** — `Pixel` / `PixelGrid` exported, deep-clone `canvas.pixels`, defensive coords, ANSI cache LRU bounded
- 🔠 **ASCII** — `hasFont`, `measure`, `stream` with AbortSignal, grapheme-aware
- 🎞️ **Frames** — ref-counted cursor, crash-safe restore, `repeat: 0` = infinite, fps cap at 60, drift correction
- 🧱 **Components** — `menu([])` returns `MENU_CANCELLED` (no throw), defensive numeric inputs everywhere
- 🛠️ **Utils** — `setTitle`, `link` (OSC 8 hyperlinks), `bell`, `safeJson` (BigInt + circular), `once`, `escapeRegex`, `padBoth`, `nextTick`, `memoize` with custom keyFn, `debounce` with `maxWait`, throttled `onResize`
- 🧪 **Tests** — ~1700+ tests across 16 suites, all green, ~98% coverage

See [CHANGELOG.md](CHANGELOG.md) for the complete version history with per-module breakdowns.

### v1.0.0 — Initial release

- Core modules: `color`, `animate`, `ascii`, `loader`, `frames`, `components`, `themes`, `images`, `configure`
- TypeScript types exported, ESM + CJS dual build
- Adaptive color rendering (NO_COLOR / FORCE_COLOR / TTY detection)
- `AbortSignal` support across all blocking APIs
- 750+ tests, 85%+ coverage

---

## 🤝 Contributing

Contributions welcome! Areas where help is especially appreciated:

- New animation presets (easing, spring physics)
- Additional ASCII fonts (figlet `.flf` parser)
- Terminal capability database entries
- Translations (es, fr, de, ja, ...)
- Real-world example apps
- Chart implementations (Phase 10)

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 🐛 Reporting Issues

Found a bug? Have a feature request? [Open an issue](https://github.com/Brashkie/ansimax/issues/new).

For security disclosures, please email [security@brashkie.dev](mailto:security@brashkie.dev) instead of opening a public issue.

---

## ⭐ Support

If Ansimax saves you time, please star the repo on [GitHub](https://github.com/Brashkie/ansimax) — it helps the project grow and accelerates the roadmap.

---

## 👨‍💻 Author

**Brashkie** · [@Brashkie](https://github.com/Brashkie)

---

## 🎬 Full showcase

<div align="center">

<img src="media/all-ansimax.gif" alt="Ansimax full showcase — everything in action" width="720"/>

_All features in action — typewriter, gradients, ASCII banners, trees, tables, spinners, themes, and pixel art_

</div>

---

## 📜 License

[Apache License 2.0](LICENSE) © 2026 Brashkie

Ansimax is licensed under the **Apache License, Version 2.0** — a permissive license that allows commercial use, modification, distribution, and includes an explicit patent grant. See the [LICENSE](LICENSE) file for the full text.

---

**Keywords:** cli, terminal, ansi, colors, gradients, animation, spinner, ascii, ascii-art, pixel-art, progress-bar, loader, components, table, banner, theme, tree, trees, tui, typescript, nodejs, zero-dependencies, chalk, ora, boxen, figlet, inquirer

---

<div align="center">

**Built with ❤️ and TypeScript**

If Ansimax helps you ship better CLIs, give it a ⭐ on [GitHub](https://github.com/Brashkie/ansimax)!

</div>
