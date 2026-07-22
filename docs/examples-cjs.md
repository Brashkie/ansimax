# 📙 ansimax — JavaScript CommonJS examples

All examples use **CommonJS** (`require()` / `module.exports`). Save any snippet as `.cjs` (or `.js` in a classic Node project) and run with:

```bash
node example.cjs
```

> ⚠️ **About top-level `await`**: CommonJS doesn't support top-level `await`. Examples that need async are wrapped in an `async function main()` + `main().catch(console.error)`.

For TypeScript, see [`examples-ts.md`](./examples-ts.md). For ESM, see [`examples-mjs.md`](./examples-mjs.md).

---

## 🎨 1. `color` — Terminal colors & styles

### 1.1 — Basic colored output

```js
const { color } = require('ansimax');

console.log(color.green('✓ Build successful'));
console.log(color.red('✗ Build failed'));
console.log(color.yellow('⚠ 3 warnings'));
console.log(color.cyan('ℹ Check the logs above'));

// Composable styles
console.log(color.bold(color.magenta('Application started')));
```

### 1.2 — Status report with mixed colors

```js
const { color } = require('ansimax');

const services = [
  { name: 'api',      status: 'up',       latency: 45 },
  { name: 'database', status: 'up',       latency: 12 },
  { name: 'cache',    status: 'degraded', latency: 240 },
  { name: 'auth',     status: 'down',     latency: 0 },
];

console.log(color.bold('Service Health Report\n'));

for (const svc of services) {
  const icon = svc.status === 'up' ? color.green('●')
             : svc.status === 'degraded' ? color.yellow('●')
             : color.red('●');
  const lat = svc.latency > 100 ? color.red(`${svc.latency}ms`)
            : svc.latency > 50  ? color.yellow(`${svc.latency}ms`)
            : color.green(`${svc.latency}ms`);

  console.log(`${icon} ${svc.name.padEnd(10)} ${lat}`);
}
```

### 1.3 — Truecolor & hex colors

```js
const { color } = require('ansimax');

console.log(color.bgHex('#bd93f9')(' Dracula purple '));
console.log(color.bgHex('#ff79c6')(' Pink '));
console.log(color.bgHex('#50fa7b')(' Green '));

console.log(color.hex('#ff6b6b')('Bright red text'));
console.log(color.hex('#4ecdc4')('Turquoise text'));
```

---

## 🌈 2. `gradient` — Multi-stop gradients

### 2.1 — Simple two-color gradient

```js
const { gradient } = require('ansimax');

console.log(gradient('Hello, gradients!', ['#ff79c6', '#bd93f9']));
console.log(gradient('Pink to purple', ['#ff79c6', '#bd93f9']));
console.log(gradient('Sunset', ['#ff5e62', '#ff9966', '#ffd86f']));
```

### 2.2 — Reusable gradient with easing

```js
const { createGradient } = require('ansimax');

const easings = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

for (const ease of easings) {
  const grad = createGradient(['#8be9fd', '#bd93f9', '#ff79c6'], { easing: ease });
  console.log(`${ease.padEnd(15)} ${grad('████████████████████████████')}`);
}

const cubic = createGradient(['#ff0000', '#0000ff'], {
  easing: (t) => t * t * t,
});
console.log(cubic('Custom cubic easing across this whole line'));
```

### 2.3 — Animated gradient

```js
const { animateGradient } = require('ansimax');

async function main() {
  const ctrl = animateGradient(
    '╔═══ Loading data... ═══╗',
    ['#ff79c6', '#bd93f9', '#8be9fd', '#50fa7b'],
    {
      interval: 80,
      cycles: 3,
      duration: 800,
      infinite: false,
    },
  );

  await ctrl.promise;
  console.log('\n✓ Done');
}

main().catch(console.error);
```

---

## 🔤 3. `ascii` — Boxes, banners, image-to-ASCII

### 3.1 — Boxes with multiple styles

```js
const { ascii, gradient } = require('ansimax');

console.log(ascii.box('Hello world!', { borderStyle: 'rounded' }));
console.log(ascii.box('Important!', { borderStyle: 'double', padding: 2 }));

const colored = gradient('Rainbow inside', ['#ff79c6', '#bd93f9', '#8be9fd']);
console.log(ascii.box(colored, { borderStyle: 'heavy', padding: 1 }));

const multi = 'Line 1\nLine 2\nLine 3 longer\n\nWith blank line';
console.log(ascii.box(multi, { borderStyle: 'rounded', padding: 1 }));
```

### 3.2 — Banner with figlet font

```js
const { ascii, gradient } = require('ansimax');

const banner = ascii.figlet('ANSIMAX', { font: 'big' });
console.log(gradient(banner, ['#ff79c6', '#bd93f9', '#8be9fd']));

const compact = ascii.figlet('v1.4.10', { font: 'small' });
console.log(ascii.box(compact, { borderStyle: 'rounded' }));
```

### 3.3 — Image-to-ASCII from a PixelGrid

```js
const { ascii } = require('ansimax');

const N = null;
const Y = { r: 255, g: 220, b: 0 };
const K = { r: 0,   g: 0,   b: 0 };

const smiley = [
  [N, N, Y, Y, Y, Y, N, N],
  [N, Y, Y, Y, Y, Y, Y, N],
  [Y, Y, K, Y, Y, K, Y, Y],
  [Y, Y, Y, Y, Y, Y, Y, Y],
  [Y, K, Y, Y, Y, Y, K, Y],
  [Y, Y, K, K, K, K, Y, Y],
  [N, Y, Y, Y, Y, Y, Y, N],
  [N, N, Y, Y, Y, Y, N, N],
];

console.log(ascii.fromImage(smiley, { width: 30, ramp: 'block' }));
```

---

## ✨ 4. `animations` — Typewriter, fadeIn, fadeOut

### 4.1 — Typewriter effect

```js
const { animate } = require('ansimax');

async function main() {
  await animate.typewriter('Loading project configuration...', { speed: 40 });
  console.log();

  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 500);

  try {
    await animate.typewriter(
      'This is a very long sentence that will get cut off mid-print.',
      { speed: 30, signal: ctrl.signal },
    );
  } catch {
    console.log('\n(aborted)');
  }
}

main().catch(console.error);
```

### 4.2 — Fade in with custom color

```js
const { animate } = require('ansimax');

async function main() {
  await animate.fadeIn('★ Welcome to the demo ★', {
    duration: 1200,
    color: '#bd93f9',
    steps: 25,
  });
  console.log();
}

main().catch(console.error);
```

### 4.3 — Sequenced reveals for a fake intro

```js
const { animate, color } = require('ansimax');

async function main() {
  const lines = [
    '> Initializing system...',
    '> Loading modules: 12/12 ✓',
    '> Connecting to mainframe...',
    '> Access granted',
    '> Welcome, operator.',
  ];

  for (const line of lines) {
    await animate.typewriter(color.green(line), { speed: 25 });
    console.log();
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

main().catch(console.error);
```

---

## ⏳ 5. `loaders` — Spinners, tasks, progress

### 5.1 — Spinner with success/error states

```js
const { loader } = require('ansimax');

async function main() {
  const stop = loader.spin('Fetching data from API...', {
    type: 'dots',
    color: '#bd93f9',
  });

  try {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    stop('Data loaded successfully!', true);
  } catch {
    stop('Request failed', false);
  }
}

main().catch(console.error);
```

### 5.2 — Hierarchical task runner

```js
const { loader } = require('ansimax');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await loader.tasks([
    {
      text: 'Build pipeline',
      fn: async () => sleep(200),
      subtasks: [
        { text: 'Compile TypeScript',    fn: async () => sleep(400) },
        { text: 'Bundle for production', fn: async () => sleep(300) },
        { text: 'Generate type defs',    fn: async () => sleep(200) },
      ],
    },
    {
      text: 'Quality checks',
      fn: async () => sleep(150),
      subtasks: [
        { text: 'Lint',  fn: async () => sleep(250) },
        { text: 'Test',  fn: async () => sleep(500) },
      ],
    },
    { text: 'Publish to npm', fn: async () => sleep(300) },
  ]);
}

main().catch(console.error);
```

### 5.3 — Parallel task execution

```js
const { loader } = require('ansimax');

async function main() {
  const ping = async () => {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 600));
    return Math.random() > 0.2;
  };

  const results = await loader.tasks([
    { text: 'Check api.example.com',  fn: ping },
    { text: 'Check db.example.com',   fn: ping },
    { text: 'Check auth.example.com', fn: ping },
    { text: 'Check cdn.example.com',  fn: ping },
  ], { parallel: true });

  const failed = results.filter((r) => !r.success);
  console.log(`\n${results.length - failed.length}/${results.length} services healthy`);
}

main().catch(console.error);
```

---

## 🧱 6. `components` — Table, badge, status, timeline

### 6.1 — Status report with badges

```js
const { components } = require('ansimax');

console.log(
  components.badge('VERSION', 'v1.3.2'),
  components.badge('BUILD',   'passing'),
  components.badge('TESTS',   '2000+ passing'),
  components.badge('LICENSE', 'Apache 2.0'),
);

console.log();
console.log(components.status('success', 'Build completed in 4.2s'));
console.log(components.status('warn',    '3 deprecation warnings'));
console.log(components.status('error',   'Type error in src/main.js:42'));
console.log(components.status('info',    'Documentation generated at docs/'));
```

### 6.2 — Table with ANSI-aware cells

```js
const { components, color } = require('ansimax');

const rows = [
  ['Service', 'Status', 'Latency', 'Uptime'],
  ['api',  color.green('✓ healthy'),   '45ms',  '99.99%'],
  ['db',   color.green('✓ healthy'),   '12ms',  '99.95%'],
  ['cache', color.yellow('⚠ degraded'), '240ms', '98.20%'],
  ['auth', color.red('✗ down'),        '—',     '95.10%'],
];

console.log(components.table(rows, {
  borderStyle: 'rounded',
  padding: 1,
}));
```

### 6.3 — Project timeline with done/pending

```js
const { components } = require('ansimax');

const events = [
  { label: 'Project initialized',  time: 'Mon',  done: true },
  { label: 'Dependencies set up',  time: 'Tue',  done: true },
  { label: 'Core modules done',    time: 'Wed',  done: true },
  { label: 'Tests passing',        time: 'Thu',  done: true },
  { label: 'Documentation',        time: 'Fri',  done: false },
  { label: 'Publish to npm',                     done: false },
];

console.log(components.timeline(events, { node: '●', connector: '│' }));
```

---

## 🎨 7. `themes` — Built-in and custom themes

### 7.1 — Switching active theme

```js
const { themes } = require('ansimax');

themes.use('dracula');
const active = themes.current();

console.log(`Active theme: ${active.name}`);
console.log(`Primary color: ${active.primary}`);
console.log(`Available themes: ${themes.list().join(', ')}`);
```

### 7.2 — Registering a custom theme

```js
const { themes } = require('ansimax');

themes.register('synthwave', {
  name: 'synthwave',
  primary:   '#ff6ec7',
  secondary: '#36d6e7',
  accent:    '#ffd93d',
  success:   '#06d6a0',
  warning:   '#ffd93d',
  error:     '#ff5e5b',
  info:      '#36d6e7',
  muted:     '#6c757d',
  bg:        '#241734',
  surface:   '#34174f',
  text:      '#ffffff',
  gradient:  ['#ff6ec7', '#36d6e7'],
});

themes.use('synthwave');
console.log(`Now using: ${themes.current().name}`);
```

### 7.3 — Subscribing to theme changes

```js
const { themes } = require('ansimax');

const unsubscribe = themes.onChange((newT, oldT) => {
  console.log(`Theme changed: ${oldT.name} → ${newT.name}`);
});

themes.use('dracula');
themes.use('nord');
themes.use('monokai');

unsubscribe();
themes.use('dracula');   // no log this time
```

---

## 🌳 8. `trees` — Hierarchical rendering

### 8.1 — Simple file tree

```js
const { trees } = require('ansimax');

const projectTree = {
  label: 'my-app/',
  children: [
    {
      label: 'src/',
      children: [
        { label: 'index.js' },
        { label: 'utils.js' },
        { label: 'config.js' },
      ],
    },
    {
      label: 'tests/',
      children: [
        { label: 'unit/' },
        { label: 'e2e/' },
      ],
    },
    { label: 'package.json' },
    { label: 'README.md' },
  ],
};

console.log(trees.tree(projectTree, { style: 'unicode' }));
```

### 8.2 — Limit depth for large trees

```js
const { trees } = require('ansimax');

const deep = {
  label: 'root',
  children: [
    { label: 'level-1', children: [
      { label: 'level-2', children: [
        { label: 'level-3', children: [
          { label: 'level-4 (hidden)' },
        ]},
      ]},
    ]},
  ],
};

console.log(trees.tree(deep, { maxDepth: 2 }));
```

### 8.3 — Cycle-safe rendering

```js
const { trees } = require('ansimax');

const a = { label: 'Node A', children: [] };
const b = { label: 'Node B', children: [] };
a.children = [b];
b.children = [a];     // cycle!

console.log(trees.tree(a, { maxDepth: 5 }));
```

---

## 🎬 9. `frames` — Frame-by-frame animation

### 9.1 — Loading spinner with custom frames

```js
const { frames } = require('ansimax');

async function main() {
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  const ctrl = frames.play(
    spinner.map((f) => `${f}  Loading...`),
    { interval: 80, loop: true },
  );

  setTimeout(() => ctrl.stop(), 3000);
  await ctrl.promise;
  console.log('Done!');
}

main().catch(console.error);
```

### 9.2 — Procedural frame generation

```js
const { frames } = require('ansimax');

async function main() {
  const pulse = frames.generate(20, (i, total) => {
    const intensity = Math.sin((i / total) * Math.PI * 2);
    const size = Math.round(Math.abs(intensity) * 5) + 1;
    return '●'.repeat(size).padEnd(7);
  });

  await frames.play(pulse, {
    interval: 80,
    loop: true,
    signal: AbortSignal.timeout(2000),
  }).promise;
}

main().catch(console.error);
```

### 9.3 — Morph one text into another

```js
const { frames } = require('ansimax');

async function main() {
  const morphed = frames.morph('HELLO', 'WORLD', 15, '░▒▓█▓▒░');
  await frames.play(morphed, { interval: 80, loop: false }).promise;
  console.log('\n✓ Morph complete');
}

main().catch(console.error);
```

---

## 🖼️ 10. `images` — Pixel art, canvas, gradients

### 10.1 — Render a sprite from the built-in library

```js
const { renderPixelArt, SPRITES } = require('ansimax');

console.log('All sprites:', Object.keys(SPRITES).join(', '));
console.log();
console.log(renderPixelArt(SPRITES.heart.pixels, { scale: 2 }));
```

### 10.2 — Gradient rectangle for visual demos

```js
const { gradientRect } = require('ansimax');

// Sunset
console.log(gradientRect({
  width: 50, height: 8,
  colors: ['#ff5e62', '#ff9966', '#ffd86f'],
  style: 'horizontal',
}));

console.log();

// Conic (rainbow wheel)
console.log(gradientRect({
  width: 30, height: 15,
  colors: ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'],
  style: 'conic',
  dither: 'bayer',
}));
```

### 10.3 — Canvas with drawing primitives

```js
const { createCanvas } = require('ansimax');

const canvas = createCanvas(40, 20, { r: 30, g: 30, b: 40 });

const orange = { r: 255, g: 165, b: 0 };
const cyan   = { r: 0,   g: 200, b: 255 };
const pink   = { r: 255, g: 105, b: 180 };

canvas.drawRect(2, 2, 12, 6, cyan, true);
canvas.drawCircle(25, 8, 4, orange, true);
canvas.drawLine(0, 19, 39, 0, pink);

canvas.print();
```

---

## 🪟 11. `panels` + `json` — Layouts and pretty-printing (v1.3.0+)

### 11.1 — Side-by-side columns with nesting

```js
const { panels, ascii } = require('ansimax');

const sidebar = ascii.box('Sidebar\n• Item 1\n• Item 2\n• Item 3', { borderStyle: 'rounded' });
const main    = ascii.box('Main content\n\nLorem ipsum dolor sit amet.', { borderStyle: 'rounded' });

console.log(panels.vsplit([sidebar, main], { gap: 2, align: 'start' }));

console.log();

console.log(panels.hsplit([
  '── Header ──',
  ascii.box('Body content'),
  '── Footer ──',
], { align: 'center', gap: 1 }));
```

### 11.2 — Centering and decorative frames

```js
const { panels, ascii } = require('ansimax');

const card = ascii.box('Welcome!', { borderStyle: 'rounded', padding: 2 });
console.log(panels.center(card, { width: 80 }));

console.log();

console.log(panels.frame('Important section content here', {
  title: 'Section Header',
  padding: 1,
  topChar: '─',
}));
```

### 11.3 — JSON pretty-print with all options

```js
const { json } = require('ansimax');

const data = {
  name: 'ansimax',
  version: '1.3.2',
  features: ['colors', 'gradients', 'panels', 'json'],
  stats: { tests: 2104, coverage: 0.98 },
  meta: { active: true },
};

console.log(json.pretty(data));

console.log('\n--- With sortKeys (alphabetical) ---');
console.log(json.pretty(data, { sortKeys: true }));

console.log('\n--- With maxDepth: 1 (collapsed) ---');
console.log(json.pretty(data, { maxDepth: 1 }));
```

---

## 🎯 Next steps

- **TypeScript?** → [`examples-ts.md`](./examples-ts.md)
- **JavaScript ESM?** → [`examples-mjs.md`](./examples-mjs.md)
- **Complete demo app combining everything?** → [`showcase.md`](./showcase.md)
- **Back to docs index?** → [`README.md`](./README.md)
