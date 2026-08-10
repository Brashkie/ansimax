# 🎬 ansimax — Enterprise showcase

A complete, runnable demo that combines **every module** of ansimax in one
realistic scenario: a deployment CLI called **Stardust Deploy**. Unlike a
list of isolated snippets, this is a single cohesive program — the kind of
tool you'd actually ship.

Save as `showcase.mjs` and run:

```bash
node showcase.mjs
```

This file is **pure JavaScript ESM** — no transpilation needed. Copy-paste
the whole thing into one `.mjs` file and it runs as-is.

> ⏱️ Approximate runtime: ~10 seconds (it's animated, with intentional delays).

---

## 📂 The scenario

**Stardust Deploy** is a fictional enterprise release pipeline. The CLI runs
a real-looking deployment end to end and, in doing so, exercises the whole
library in one flow:

| Stage | Modules used |
|-------|--------------|
| Boot banner | `gradient` · `ascii.figlet` · `color` · `animate.typewriter` |
| Config load | `json.pretty` |
| Health checks | `loader.spin` · `components.status` |
| Build pipeline | `loader.tasks` |
| Rolling deploy | `tween` · `spring` · `stagger` |
| Dashboard | `ascii.table` · `components.badge` |
| Artifact tree | `trees.render` |
| Release notes | `markdown.render` |
| Timeline | `components.timeline` |
| Finale | `createCanvas` · `frames.morph` · `createLogger` · `themes` |

Every module pulls its weight inside a story, so you see not just *what* each
API does but *how they fit together* in a real app.

---

## 🚀 The complete code

```js
// ─────────────────────────────────────────────────────────────
//  ansimax — Enterprise showcase: "Stardust Deploy"
//
//  A single, cohesive CLI that mimics a real deployment tool end to
//  end: boot banner, config load, health checks, a build pipeline,
//  a results dashboard, a changelog, and an animated finale.
//
//  Combines EVERY module of ansimax in one realistic flow — not
//  isolated snippets. Pure ESM JavaScript, no transpilation needed.
//  Save as `showcase.mjs` and run:  node showcase.mjs
// ─────────────────────────────────────────────────────────────

import {
  color, gradient,
  ascii,
  animate,
  loader,
  components,
  themes,
  trees,
  frames,
  createCanvas,
  panels,
  json,
  markdown,
  tween, spring, stagger, sequence,
  createLogger,
  sleep,
} from 'ansimax';

// A render callback used by the animation demos below.
// Clamps to [0,1] so a spring's natural overshoot never breaks the bar.
const bar = (label) => (v) => {
  const clamped = Math.max(0, Math.min(1, v));
  const filled = Math.round(clamped * 30);
  const track = '█'.repeat(filled) + '░'.repeat(30 - filled);
  process.stdout.write(`\r  ${label} ${track} ${Math.round(clamped * 100)}%  `);
};

async function main() {
  // Use a consistent theme for the whole app.
  themes.use('dracula');
  const log = createLogger({ level: 'info' });

  // ── 1. Boot banner ────────────────────────────────────────────
  console.clear();
  console.log(gradient(ascii.figlet('stardust', { font: 'big' }), [
    '#ff79c6', '#bd93f9', '#8be9fd',
  ]));
  console.log(color.dim('  Stardust Deploy — enterprise release pipeline v4.2\n'));

  await animate.typewriter('  Initializing deployment environment...', { speed: 20 });
  console.log('\n');

  // ── 2. Config load (json) ─────────────────────────────────────
  const config = {
    project: 'stardust-api',
    region: 'us-east-1',
    replicas: 3,
    features: { tracing: true, cache: 'redis' },
  };
  console.log(color.bold('  Loaded configuration:'));
  console.log(json.pretty(config, { sortKeys: true, indent: 2 })
    .split('\n').map((l) => '  ' + l).join('\n'));
  console.log();

  // ── 3. Health checks (loader.spin) ────────────────────────────
  const stop = loader.spin('  Running pre-flight health checks...');
  await sleep(1200);
  stop();
  console.log(components.status('success', 'All 4 health checks passed'));
  console.log();

  // ── 4. Build pipeline (loader.tasks) ──────────────────────────
  console.log(color.bold('  Build pipeline:'));
  await loader.tasks([
    { title: 'Compile TypeScript', fn: () => sleep(700) },
    { title: 'Bundle assets', fn: () => sleep(500) },
    { title: 'Run test suite', fn: () => sleep(900) },
    { title: 'Build container image', fn: () => sleep(600) },
  ]);
  console.log();

  // ── 5. Animated deploy progress (tween + spring + stagger) ────
  console.log(color.bold('  Rolling out replicas:\n'));
  // A tween for the primary rollout bar
  await tween({ from: 0, to: 1, duration: 900, easing: 'easeOutCubic', onUpdate: bar('primary ') });
  process.stdout.write('\n');
  // A spring for a "settling" load metric
  await spring({ from: 0, to: 1, config: { stiffness: 180, damping: 18 }, onUpdate: bar('warmup  ') });
  process.stdout.write('\n');
  // Stagger three canary checks so they cascade in
  const canaries = ['canary-a', 'canary-b', 'canary-c'];
  await stagger(canaries.map((name) => async () => {
    console.log(components.status('success', `${name} healthy`));
  }), 200);
  console.log();

  // ── 6. Results dashboard (ascii.table + components + panels) ──
  const metricsTable = ascii.table([
    ['Metric', 'Value', 'Status'],
    ['Latency p50', '42ms', 'OK'],
    ['Latency p99', '180ms', 'OK'],
    ['Error rate', '0.02%', 'OK'],
    ['Throughput', '12k rps', 'OK'],
  ], { align: ['left', 'right', 'center'], borderStyle: 'rounded' });

  const badges = [
    components.badge('BUILD', 'passing'),
    components.badge('COVERAGE', '98%'),
    components.badge('DEPLOY', 'live'),
  ].join('  ');

  console.log(color.bold('  Deployment dashboard:\n'));
  console.log(metricsTable.split('\n').map((l) => '  ' + l).join('\n'));
  console.log('\n  ' + badges + '\n');

  // ── 7. Project structure (trees) ──────────────────────────────
  console.log(color.bold('  Deployed artifact tree:'));
  console.log(trees.render({
    label: 'stardust-api/',
    children: [
      { label: 'dist/', children: [{ label: 'index.js' }, { label: 'server.js' }] },
      { label: 'config/', children: [{ label: 'prod.yaml' }] },
      { label: 'Dockerfile' },
    ],
  }, { style: 'rounded' }).split('\n').map((l) => '  ' + l).join('\n'));
  console.log();

  // ── 8. Release notes (markdown) ───────────────────────────────
  console.log(color.bold('  Release notes:\n'));
  console.log(markdown.render([
    '## v4.2.0',
    '',
    '- **Added** zero-downtime rolling deploys',
    '- **Fixed** cache stampede under load',
    '- Improved cold-start by `40%`',
  ].join('\n')).split('\n').map((l) => '  ' + l).join('\n'));

  // ── 9. Event timeline (components.timeline) ───────────────────
  console.log(color.bold('  Deploy timeline:'));
  console.log(components.timeline([
    { label: 'Build started', time: '10:00' },
    { label: 'Tests passed', time: '10:02' },
    { label: 'Image pushed', time: '10:03' },
    { label: 'Rollout complete', time: '10:05' },
  ]).split('\n').map((l) => '  ' + l).join('\n'));
  console.log();

  // ── 10. Canvas art finale (createCanvas + frames.morph) ───────
  const canvas = createCanvas(30, 8, { r: 20, g: 20, b: 30 });
  const green = { r: 80, g: 250, b: 123 };
  const purple = { r: 189, g: 147, b: 249 };
  canvas.drawRect(2, 1, 26, 6, purple, false);
  for (let i = 0; i < 26; i++) canvas.set(2 + i, 4, green);
  canvas.print();

  const morphed = frames.morph('deploying', 'deployed!', 12, '░▒▓█');
  await frames.play(morphed, { interval: 70, repeat: 1 }).done;

  console.log('\n' + components.status('success', 'Deployment complete — stardust-api is live 🚀'));
  log.info('showcase finished cleanly');
}

main().catch((err) => {
  console.error(components.status('error', `Showcase failed: ${err.message}`));
  process.exit(1);
});
```

---

## 🧩 What to notice

- **One theme, one logger, one flow.** `themes.use('dracula')` sets the
  palette once; every colored component inherits it. A single `createLogger`
  threads structured logging through the run.
- **Real animation, not fake progress.** The rollout bar is a `tween` with
  `easeOutCubic`; the warmup metric is a `spring` that settles with a natural
  overshoot (note the `Math.min(1, v)` clamp in `bar()` — springs can pass
  their target, and good UI code accounts for it).
- **Cascading UI with `stagger`.** The canary checks don't all print at once —
  they cascade in, 200ms apart, the way a polished CLI reveals a list.
- **Everything composes.** `ascii.table` feeds a dashboard, `trees.render`
  shows the artifact layout, `markdown.render` formats release notes, and
  `frames.morph` animates the finale — all in the same output stream.

Want the same techniques split into focused, per-module examples? See
[`examples-mjs.md`](./examples-mjs.md), [`examples-cjs.md`](./examples-cjs.md),
and [`examples-ts.md`](./examples-ts.md).
