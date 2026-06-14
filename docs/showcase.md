# 🎬 ansimax — Complete showcase

A complete, runnable demo app combining **every module** of ansimax in one realistic scenario. Save as `showcase.mjs` and run:

```bash
node showcase.mjs
```

This file is **pure JavaScript ESM** — no transpilation needed. You can copy-paste the whole thing into a single `.mjs` file and it will work.

> ⏱️ Approximate runtime: ~12 seconds (it's animated; the demo has intentional delays).

---

## 📂 The scenario

We're going to build a fake CLI for a fictional service called **`stardust`** — a code-generation tool. The CLI does what real tools do: shows a banner, fetches data, runs build tasks, prints a results table, displays a project tree, and renders some pixel art.

This showcases:

1. **`color`** + **`gradient`** — Header banner
2. **`ascii`** — figlet text + box
3. **`animate`** — Typewriter intro
4. **`loader`** — Spinner during "fetch"
5. **`loader.tasks`** — Multi-step build pipeline
6. **`components`** — Status messages + table + badges + timeline
7. **`themes`** — Switch active theme mid-run
8. **`trees`** — Display project structure
9. **`frames`** — Animated transitions
10. **`images`** — Pixel art finale
11. **`panels`** — Side-by-side layouts
12. **`json`** — Pretty-printed config

---

## 🚀 The complete code

```js
// ─────────────────────────────────────────────────────────────
//  ansimax — complete showcase (v1.3.2)
//
//  Run:  node showcase.mjs
// ─────────────────────────────────────────────────────────────

import {
  color, gradient, animateGradient,
  ascii, animate, loader, frames,
  components, themes, trees,
  renderPixelArt, gradientRect, SPRITES, createCanvas,
  panels, json,
} from 'ansimax';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
//  Step 1 — Header banner (color, gradient, ascii)
// ─────────────────────────────────────────────────────────────

console.clear();

const banner = ascii.figletText('STARDUST', { font: 'standard' });
const colored = gradient(banner, ['#ff79c6', '#bd93f9', '#8be9fd']);
console.log(colored);

console.log(
  panels.center(
    color.bold('✨ Code generation, simplified ✨'),
    { width: 70 },
  ),
);
console.log();

await sleep(400);

// ─────────────────────────────────────────────────────────────
//  Step 2 — Animated intro (animate.typewriter)
// ─────────────────────────────────────────────────────────────

const introLines = [
  '> Initializing stardust v2.4.1',
  '> Loading configuration from .stardustrc',
  '> Checking for updates...',
];

for (const line of introLines) {
  await animate.typewriter(color.green(line), { speed: 22 });
  console.log();
  await sleep(150);
}

console.log();
await sleep(300);

// ─────────────────────────────────────────────────────────────
//  Step 3 — Show registered themes + switch (themes)
// ─────────────────────────────────────────────────────────────

console.log(color.cyan('🎨 Available themes: ') + themes.list().join(', '));

themes.use('dracula');
console.log(color.cyan(`🎨 Active theme: `) + themes.current().name);
console.log();

await sleep(500);

// ─────────────────────────────────────────────────────────────
//  Step 4 — Loader spinner during "fetch" (loader.spin)
// ─────────────────────────────────────────────────────────────

const stop = loader.spin('Fetching template from registry...', {
  type: 'dots',
  color: '#bd93f9',
});

await sleep(1500);
stop('Template loaded: react-app-typescript', true);
console.log();

await sleep(300);

// ─────────────────────────────────────────────────────────────
//  Step 5 — Hierarchical tasks (loader.tasks)
// ─────────────────────────────────────────────────────────────

console.log(color.bold('\n📦 Building project...\n'));

await loader.tasks([
  {
    text: 'Scaffold project structure',
    fn: async () => sleep(400),
    subtasks: [
      { text: 'Create directories',        fn: async () => sleep(150) },
      { text: 'Copy template files',       fn: async () => sleep(300) },
      { text: 'Generate package.json',     fn: async () => sleep(200) },
    ],
  },
  {
    text: 'Install dependencies',
    fn: async () => sleep(200),
    subtasks: [
      { text: 'Resolve versions',  fn: async () => sleep(300) },
      { text: 'Download packages', fn: async () => sleep(600) },
      { text: 'Link binaries',     fn: async () => sleep(200) },
    ],
  },
  { text: 'Run initial build',  fn: async () => sleep(500) },
  { text: 'Verify integrity',   fn: async () => sleep(250) },
]);

console.log();
await sleep(300);

// ─────────────────────────────────────────────────────────────
//  Step 6 — Components: status, badge, table (components)
// ─────────────────────────────────────────────────────────────

console.log(components.status('success', 'Build completed in 2.4s'));
console.log(components.status('warn',    '3 deprecation notices (run `stardust audit` for details)'));
console.log(components.status('info',    'Project ready at ./my-app'));
console.log();

console.log(
  components.badge('VERSION',     'v2.4.1'),
  components.badge('PROJECT',     'my-app'),
  components.badge('FRAMEWORK',   'react'),
  components.badge('TEMPLATE',    'typescript'),
);
console.log();

console.log(components.table([
  ['Stage',         'Duration', 'Status'],
  ['Scaffold',      '650ms',    color.green('✓ done')],
  ['Dependencies',  '1100ms',   color.green('✓ done')],
  ['Build',         '500ms',    color.green('✓ done')],
  ['Verify',        '250ms',    color.green('✓ done')],
  ['Total',         '2500ms',   color.green('✓ success')],
], { borderStyle: 'rounded', padding: 1 }));

console.log();
await sleep(500);

// ─────────────────────────────────────────────────────────────
//  Step 7 — Project structure (trees)
// ─────────────────────────────────────────────────────────────

console.log(color.bold('📁 Project structure:\n'));

console.log(trees.tree({
  label: 'my-app/',
  children: [
    {
      label: 'src/',
      children: [
        { label: 'components/', children: [
          { label: 'App.tsx' },
          { label: 'Header.tsx' },
          { label: 'Footer.tsx' },
        ]},
        { label: 'pages/', children: [
          { label: 'Home.tsx' },
          { label: 'About.tsx' },
        ]},
        { label: 'index.tsx' },
        { label: 'styles.css' },
      ],
    },
    { label: 'public/', children: [
      { label: 'favicon.ico' },
      { label: 'logo.svg' },
    ]},
    { label: 'package.json' },
    { label: 'tsconfig.json' },
    { label: 'README.md' },
  ],
}, { style: 'unicode' }));

console.log();
await sleep(500);

// ─────────────────────────────────────────────────────────────
//  Step 8 — Timeline of release milestones (components.timeline)
// ─────────────────────────────────────────────────────────────

console.log(color.bold('🗓️  Release milestones:\n'));

console.log(components.timeline([
  { label: 'v1.0 — Initial release',         time: 'Jan 2025', done: true },
  { label: 'v1.5 — TypeScript support',      time: 'Mar 2025', done: true },
  { label: 'v2.0 — Plugin system',           time: 'Jul 2025', done: true },
  { label: 'v2.4 — Current stable',          time: 'Now',      done: true },
  { label: 'v2.5 — Templates marketplace',   time: 'Q2 2026',  done: false },
  { label: 'v3.0 — AI-powered scaffolding',  time: 'Q4 2026',  done: false },
], { node: '●', connector: '│' }));

console.log();
await sleep(500);

// ─────────────────────────────────────────────────────────────
//  Step 9 — Config preview with JSON pretty-print (json)
// ─────────────────────────────────────────────────────────────

console.log(color.bold('⚙️  Generated configuration:\n'));

console.log(json.pretty({
  name: 'my-app',
  version: '0.1.0',
  framework: 'react',
  features: ['typescript', 'eslint', 'prettier', 'testing-library'],
  scripts: {
    dev:   'stardust dev',
    build: 'stardust build',
    test:  'stardust test',
  },
  meta: {
    generatedBy: 'stardust',
    generatedAt: '2026-06-13T10:00:00Z',
    template:    'react-app-typescript',
  },
}, { sortKeys: false }));

console.log();
await sleep(500);

// ─────────────────────────────────────────────────────────────
//  Step 10 — Side-by-side panel layout (panels)
// ─────────────────────────────────────────────────────────────

console.log(color.bold('📊 Quick stats:\n'));

const leftCard = ascii.box(
  color.cyan('FILES\n') +
  color.bold('42'),
  { borderStyle: 'rounded', padding: 1 },
);

const midCard = ascii.box(
  color.magenta('LINES\n') +
  color.bold('1,247'),
  { borderStyle: 'rounded', padding: 1 },
);

const rightCard = ascii.box(
  color.green('TESTS\n') +
  color.bold('38/38'),
  { borderStyle: 'rounded', padding: 1 },
);

console.log(panels.vsplit([leftCard, midCard, rightCard], { gap: 2 }));

console.log();
await sleep(500);

// ─────────────────────────────────────────────────────────────
//  Step 11 — Frame animation finale (frames)
// ─────────────────────────────────────────────────────────────

console.log();

const morphed = frames.morph('LOADING...', 'COMPLETE!', 16, '░▒▓█▓▒░');
await frames.play(morphed, { interval: 70, loop: false }).promise;

console.log();
await sleep(400);

// ─────────────────────────────────────────────────────────────
//  Step 12 — Pixel art + canvas finale (images)
// ─────────────────────────────────────────────────────────────

console.log(color.bold('\n🎨 Generated by stardust:\n'));

// A small banner with gradient rectangle + pixel art sprite
const canvas = createCanvas(50, 12, { r: 25, g: 25, b: 40 });

// Decorative frame
const cyan   = { r: 0,   g: 200, b: 255 };
const pink   = { r: 255, g: 105, b: 180 };
const yellow = { r: 255, g: 220, b: 0 };

canvas.drawRect(0, 0, 50, 12, cyan, false);   // border
canvas.drawCircle(10, 6, 3, pink, true);
canvas.drawCircle(40, 6, 3, yellow, true);

canvas.print();

console.log();
console.log(renderPixelArt(SPRITES.star.pixels, { scale: 2 }));
console.log();

await sleep(500);

// ─────────────────────────────────────────────────────────────
//  Step 13 — Final animated gradient farewell
// ─────────────────────────────────────────────────────────────

console.log();
const farewell = animateGradient(
  '✨ Built with ansimax — see you next time! ✨',
  ['#ff79c6', '#bd93f9', '#8be9fd', '#50fa7b', '#ffd93d'],
  {
    interval: 70,
    cycles: 2,
    duration: 600,
    infinite: false,
  },
);

await farewell.promise;
console.log('\n');

console.log(panels.frame(
  color.brightBlack('  npm install ansimax  |  github.com/Brashkie/ansimax  '),
  { title: ' Get started ', padding: 1 },
));

console.log();
```

---

## 🎯 What this showcase demonstrates

| Module       | Where it's used                                                              |
|---|---|
| `color`      | Status messages, table cells, stats cards                                    |
| `gradient`   | Header banner, animated farewell                                             |
| `ascii`      | Figlet banner, boxes for stats cards                                         |
| `animate`    | Typewriter intro lines                                                       |
| `loader`     | Spinner + hierarchical tasks pipeline                                        |
| `components` | Status messages, badges, table, timeline                                     |
| `themes`     | Theme listing + switching                                                    |
| `trees`      | Project structure visualization                                              |
| `frames`     | Morph animation for "LOADING → COMPLETE"                                     |
| `images`     | Canvas drawing + sprite rendering                                            |
| `panels`     | Three-column stats layout, centering header, frame footer                    |
| `json`       | Generated config display                                                     |

---

## 🛠️ Customizing the showcase

Want to use this as a starter for your own CLI? Here's what to change:

1. **Replace `STARDUST` banner** with your own brand name
2. **Edit `intro` lines** to describe your tool's startup process
3. **Replace the build task list** with your actual workflow steps
4. **Update the config JSON** with your tool's real output format
5. **Swap pixel art sprite** with your logo (use `SPRITES.heart`, `SPRITES.crown`, etc., or build a custom one)

The structure is intentionally generic — any code-generation, build, deploy, or scaffolding tool can adapt this pattern.

---

## 🎯 Next steps

- **Back to docs index?** → [`README.md`](./README.md)
- **TypeScript examples?** → [`examples-ts.md`](./examples-ts.md)
- **ESM examples?** → [`examples-mjs.md`](./examples-mjs.md)
- **CommonJS examples?** → [`examples-cjs.md`](./examples-cjs.md)
