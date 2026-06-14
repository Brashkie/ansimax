# 📘 ansimax — TypeScript examples

All examples are written in **TypeScript** with explicit types. Save any snippet as `example.ts` and run with:

```bash
npx tsx example.ts
# or: npx ts-node example.ts
# or: npx tsc example.ts && node example.js
```

For JavaScript versions, see [`examples-mjs.md`](./examples-mjs.md) (ESM) or [`examples-cjs.md`](./examples-cjs.md) (CommonJS).

---

## 🎨 1. `color` — Terminal colors & styles

### 1.1 — Basic colored output

```ts
import { color } from 'ansimax';

console.log(color.green('✓ Build successful'));
console.log(color.red('✗ Build failed'));
console.log(color.yellow('⚠ 3 warnings'));
console.log(color.cyan('ℹ Check the logs above'));

// Composable styles
const heading: string = color.bold(color.magenta('Application started'));
console.log(heading);
```

### 1.2 — Status report with mixed colors

```ts
import { color } from 'ansimax';

interface Service {
  name: string;
  status: 'up' | 'down' | 'degraded';
  latency: number;
}

const services: Service[] = [
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

```ts
import { color } from 'ansimax';

// Hex colors via background helpers
console.log(color.bgHex('#bd93f9')(' Dracula purple '));
console.log(color.bgHex('#ff79c6')(' Pink '));
console.log(color.bgHex('#50fa7b')(' Green '));

// Foreground hex
console.log(color.hex('#ff6b6b')('Bright red text'));
console.log(color.hex('#4ecdc4')('Turquoise text'));

// ANSI escapes are stripped automatically when piped to a non-TTY:
//   node example.ts          → colored
//   node example.ts | cat    → plain text
```

---

## 🌈 2. `gradient` — Multi-stop gradients

### 2.1 — Simple two-color gradient

```ts
import { gradient } from 'ansimax';

console.log(gradient('Hello, gradients!', ['#ff79c6', '#bd93f9']));
console.log(gradient('Pink to purple', ['#ff79c6', '#bd93f9']));
console.log(gradient('Sunset', ['#ff5e62', '#ff9966', '#ffd86f']));
```

### 2.2 — Reusable gradient with easing

```ts
import { createGradient, type EasingName } from 'ansimax';

const easings: EasingName[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out'];

for (const ease of easings) {
  const grad = createGradient(['#8be9fd', '#bd93f9', '#ff79c6'], { easing: ease });
  console.log(`${ease.padEnd(15)} ${grad('████████████████████████████')}`);
}

// Custom easing function (t ∈ [0, 1] → eased t)
const cubic = createGradient(['#ff0000', '#0000ff'], {
  easing: (t: number) => t * t * t,
});
console.log(cubic('Custom cubic easing across this whole line'));
```

### 2.3 — Animated gradient (color cycles over time)

```ts
import { animateGradient } from 'ansimax';

const ctrl = animateGradient(
  '╔═══ Loading data... ═══╗',
  ['#ff79c6', '#bd93f9', '#8be9fd', '#50fa7b'],
  {
    interval: 80,
    cycles: 3,        // play 3 full color cycles
    duration: 800,    // ms per cycle
    infinite: false,
  },
);

await ctrl.promise;
console.log('\n✓ Done');
```

---

## 🔤 3. `ascii` — Boxes, banners, image-to-ASCII

### 3.1 — Boxes with multiple styles

```ts
import { ascii, gradient } from 'ansimax';

console.log(ascii.box('Hello world!', { borderStyle: 'rounded' }));
console.log(ascii.box('Important!', { borderStyle: 'double', padding: 2 }));

// Box around colored content — border stays uncolored
const colored = gradient('Rainbow inside', ['#ff79c6', '#bd93f9', '#8be9fd']);
console.log(ascii.box(colored, { borderStyle: 'heavy', padding: 1 }));

// Multi-line box
const multi = 'Line 1\nLine 2\nLine 3 longer\n\nWith blank line';
console.log(ascii.box(multi, { borderStyle: 'rounded', padding: 1 }));
```

### 3.2 — Banner with figlet font

```ts
import { ascii, gradient } from 'ansimax';

const banner: string = ascii.figletText('ANSIMAX', { font: 'standard' });
const colored: string = gradient(banner, ['#ff79c6', '#bd93f9', '#8be9fd']);
console.log(colored);

// Different font
const compact: string = ascii.figletText('v1.3.2', { font: 'small' });
console.log(ascii.box(compact, { borderStyle: 'rounded' }));
```

### 3.3 — Image-to-ASCII from a PixelGrid

```ts
import { ascii, type PixelGrid } from 'ansimax';

// Build a small "image" — a smiley face — programmatically
const N = null;
const Y = { r: 255, g: 220, b: 0 };
const K = { r: 0,   g: 0,   b: 0 };

const smiley: PixelGrid = [
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

```ts
import { animate } from 'ansimax';

await animate.typewriter('Loading project configuration...', { speed: 40 });
console.log();

// Abortable — stops after 500ms even on a long string
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
```

### 4.2 — Fade in with custom color

```ts
import { animate } from 'ansimax';

await animate.fadeIn('★ Welcome to the demo ★', {
  duration: 1200,
  color: '#bd93f9',
  steps: 25,
});
console.log();
```

### 4.3 — Sequenced reveals for a fake intro

```ts
import { animate, color } from 'ansimax';

const lines: string[] = [
  '> Initializing system...',
  '> Loading modules: 12/12 ✓',
  '> Connecting to mainframe...',
  '> Access granted',
  '> Welcome, operator.',
];

for (const line of lines) {
  await animate.typewriter(color.green(line), { speed: 25 });
  console.log();
  await new Promise<void>((resolve) => setTimeout(resolve, 200));
}
```

---

## ⏳ 5. `loaders` — Spinners, tasks, progress

### 5.1 — Spinner with success/error states

```ts
import { loader } from 'ansimax';

const stop = loader.spin('Fetching data from API...', {
  type: 'dots',
  color: '#bd93f9',
});

try {
  await new Promise<void>((resolve) => setTimeout(resolve, 1500));
  stop('Data loaded successfully!', true);
} catch {
  stop('Request failed', false);
}
```

### 5.2 — Hierarchical task runner

```ts
import { loader } from 'ansimax';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
```

### 5.3 — Parallel task execution with results

```ts
import { loader } from 'ansimax';

interface CheckResult {
  ok: boolean;
  duration: number;
}

const ping = async (name: string): Promise<CheckResult> => {
  const start = Date.now();
  await new Promise<void>((r) => setTimeout(r, 200 + Math.random() * 600));
  return { ok: Math.random() > 0.2, duration: Date.now() - start };
};

const results = await loader.tasks([
  { text: 'Check api.example.com',  fn: async () => { await ping('api'); } },
  { text: 'Check db.example.com',   fn: async () => { await ping('db');  } },
  { text: 'Check auth.example.com', fn: async () => { await ping('auth'); } },
  { text: 'Check cdn.example.com',  fn: async () => { await ping('cdn'); } },
], { parallel: true });

const failed = results.filter((r) => !r.success);
console.log(`\n${results.length - failed.length}/${results.length} services healthy`);
```

---

## 🧱 6. `components` — Table, badge, status, timeline

### 6.1 — Status report with badges

```ts
import { components } from 'ansimax';

console.log(
  components.badge('VERSION', 'v1.3.2'),
  components.badge('BUILD',   'passing'),
  components.badge('TESTS',   '2000+ passing'),
  components.badge('LICENSE', 'Apache 2.0'),
);

console.log();
console.log(components.status('success', 'Build completed in 4.2s'));
console.log(components.status('warn',    '3 deprecation warnings'));
console.log(components.status('error',   'Type error in src/main.ts:42'));
console.log(components.status('info',    'Documentation generated at docs/'));
```

### 6.2 — Table with ANSI-aware cells

```ts
import { components, color } from 'ansimax';

const rows: string[][] = [
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

```ts
import { components } from 'ansimax';

interface ProjectEvent {
  label: string;
  time?: string;
  done?: boolean;
}

const events: ProjectEvent[] = [
  { label: 'Project initialized',  time: 'Mon',  done: true },
  { label: 'Dependencies set up',  time: 'Tue',  done: true },
  { label: 'Core modules done',    time: 'Wed',  done: true },
  { label: 'Tests passing',        time: 'Thu',  done: true },
  { label: 'Documentation',        time: 'Fri',  done: false },  // current
  { label: 'Publish to npm',                     done: false },
];

console.log(components.timeline(events, { node: '●', connector: '│' }));
```

---

## 🎨 7. `themes` — Built-in and custom themes

### 7.1 — Switching active theme

```ts
import { themes, type Theme } from 'ansimax';

themes.use('dracula');
const active: Theme = themes.current();

console.log(`Active theme: ${active.name}`);
console.log(`Primary color: ${active.primary}`);
console.log(`Available themes: ${themes.list().join(', ')}`);
```

### 7.2 — Registering a custom theme

```ts
import { themes, type Theme } from 'ansimax';

const synthwave: Theme = {
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
};

themes.register('synthwave', synthwave);
themes.use('synthwave');

console.log(`Now using: ${themes.current().name}`);
```

### 7.3 — Subscribing to theme changes (live UI updates)

```ts
import { themes, type Theme } from 'ansimax';

const unsubscribe = themes.onChange((newT: Theme, oldT: Theme) => {
  console.log(`Theme changed: ${oldT.name} → ${newT.name}`);
  // In a real app: trigger UI re-render here
});

themes.use('dracula');   // logs "default → dracula"
themes.use('nord');      // logs "dracula → nord"
themes.use('monokai');   // logs "nord → monokai"

unsubscribe();           // stop listening
themes.use('dracula');   // no log this time
```

---

## 🌳 8. `trees` — Hierarchical rendering

### 8.1 — Simple file tree

```ts
import { trees, type TreeNode } from 'ansimax';

const projectTree: TreeNode = {
  label: 'my-app/',
  children: [
    {
      label: 'src/',
      children: [
        { label: 'index.ts' },
        { label: 'utils.ts' },
        { label: 'config.ts' },
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

```ts
import { trees, type TreeNode } from 'ansimax';

const deep: TreeNode = {
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

// Only show 2 levels deep, collapse rest with "..."
console.log(trees.tree(deep, { maxDepth: 2 }));
```

### 8.3 — Cycle-safe rendering (no infinite recursion)

```ts
import { trees, type TreeNode } from 'ansimax';

// Two nodes referencing each other → cycle
const a: TreeNode = { label: 'Node A', children: [] };
const b: TreeNode = { label: 'Node B', children: [] };
a.children = [b];
b.children = [a];     // ← cycle!

// trees.tree() detects the cycle and shows [Circular] instead of crashing
console.log(trees.tree(a, { maxDepth: 5 }));
```

---

## 🎬 9. `frames` — Frame-by-frame animation

### 9.1 — Loading spinner with custom frames

```ts
import { frames } from 'ansimax';

const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const ctrl = frames.play(
  spinner.map((f) => `${f}  Loading...`),
  { interval: 80, loop: true },
);

setTimeout(() => ctrl.stop(), 3000);
await ctrl.promise;
console.log('Done!');
```

### 9.2 — Procedural frame generation

```ts
import { frames } from 'ansimax';

// Generate a pulsing dot animation
const pulse: string[] = frames.generate(20, (i: number, total: number) => {
  const intensity = Math.sin((i / total) * Math.PI * 2);
  const size = Math.round(Math.abs(intensity) * 5) + 1;
  return '●'.repeat(size).padEnd(7);
});

await frames.play(pulse, { interval: 80, loop: true, signal: AbortSignal.timeout(2000) }).promise;
```

### 9.3 — Morph one text into another

```ts
import { frames } from 'ansimax';

// Decryption-style morph effect
const morphed: string[] = frames.morph('HELLO', 'WORLD', 15, '░▒▓█▓▒░');
await frames.play(morphed, { interval: 80, loop: false }).promise;

console.log('\n✓ Morph complete');
```

---

## 🖼️ 10. `images` — Pixel art, canvas, gradients

### 10.1 — Render a sprite from the built-in library

```ts
import { renderPixelArt, SPRITES } from 'ansimax';

console.log('All sprites:', Object.keys(SPRITES).join(', '));
console.log();
console.log(renderPixelArt(SPRITES.heart.pixels, { scale: 2 }));
```

### 10.2 — Gradient rectangle for visual demos

```ts
import { gradientRect } from 'ansimax';

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

```ts
import { createCanvas, type Canvas, type Pixel } from 'ansimax';

const canvas: Canvas = createCanvas(40, 20, { r: 30, g: 30, b: 40 });

const orange: Pixel = { r: 255, g: 165, b: 0 };
const cyan: Pixel = { r: 0, g: 200, b: 255 };
const pink: Pixel = { r: 255, g: 105, b: 180 };

canvas.drawRect(2, 2, 12, 6, cyan, true);
canvas.drawCircle(25, 8, 4, orange, true);
canvas.drawLine(0, 19, 39, 0, pink);

canvas.print();
```

---

## 🪟 11. `panels` + `json` — Layouts and pretty-printing (v1.3.0+)

### 11.1 — Side-by-side columns with nesting

```ts
import { panels, ascii } from 'ansimax';

const sidebar: string = ascii.box('Sidebar\n• Item 1\n• Item 2\n• Item 3', { borderStyle: 'rounded' });
const main: string    = ascii.box('Main content\n\nLorem ipsum dolor sit amet, consectetur.', { borderStyle: 'rounded' });

console.log(panels.vsplit([sidebar, main], { gap: 2, align: 'start' }));

console.log();

// Vertical stacking
console.log(panels.hsplit([
  '── Header ──',
  ascii.box('Body content'),
  '── Footer ──',
], { align: 'center', gap: 1 }));
```

### 11.2 — Centering and decorative frames

```ts
import { panels, ascii } from 'ansimax';

// Center a box within an 80-column terminal
const card: string = ascii.box('Welcome!', { borderStyle: 'rounded', padding: 2 });
console.log(panels.center(card, { width: 80 }));

console.log();

// Lighter alternative to a full box — only top/bottom rules
console.log(panels.frame('Important section content here', {
  title: 'Section Header',
  padding: 1,
  topChar: '─',
}));
```

### 11.3 — JSON pretty-print with all options

```ts
import { json } from 'ansimax';

interface AppData {
  name: string;
  version: string;
  features: string[];
  stats: { tests: number; coverage: number };
  meta: { active: boolean };
}

const data: AppData = {
  name: 'ansimax',
  version: '1.3.2',
  features: ['colors', 'gradients', 'panels', 'json'],
  stats: { tests: 2104, coverage: 0.98 },
  meta: { active: true },
};

// Default — colored, inline short arrays
console.log(json.pretty(data));

console.log('\n--- With sortKeys (alphabetical) ---');
console.log(json.pretty(data, { sortKeys: true }));

console.log('\n--- With maxDepth: 1 (collapsed) ---');
console.log(json.pretty(data, { maxDepth: 1 }));
```

---

## 🎯 Next steps

- **JavaScript ESM?** → [`examples-mjs.md`](./examples-mjs.md)
- **JavaScript CommonJS?** → [`examples-cjs.md`](./examples-cjs.md)
- **Complete demo app combining everything?** → [`showcase.md`](./showcase.md)
- **Back to docs index?** → [`README.md`](./README.md)
