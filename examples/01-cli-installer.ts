// ─────────────────────────────────────────────
//  EXAMPLE 1 — CLI installer with hierarchical tasks
//
//  Demonstrates a realistic project setup flow:
//   - Banner intro with theme gradient
//   - Hierarchical tasks (parent + subtasks with rollup)
//   - Status indicators with custom icons
//   - Box for final summary
//
//  Run:
//    npx ts-node examples/01-cli-installer.ts
// ─────────────────────────────────────────────

import {
  ascii,
  themes,
  loader,
  components,
  configure,
  sleep,
} from '../dist/index.js';

// Configure global defaults
configure({
  theme: 'dracula',
  animationSpeed: 'fast',
});

// Simulated work
const work = (ms: number, fail = false) => async (): Promise<string> => {
  await sleep(ms);
  if (fail) throw new Error('Simulated failure');
  return 'ok';
};

const main = async (): Promise<void> => {
  // ── Intro banner ──────────────────────────────
  console.log();
  console.log(themes.banner('CREATE-APP', { font: 'small' }));
  console.log();
  console.log(components.section(themes.primary('Initializing project'), { width: 60 }));
  console.log();

  // ── Hierarchical task list ────────────────────
  const results = await loader.tasks([
    {
      text: 'Setup environment',
      fn: work(300),
      subtasks: [
        { text: 'Detect Node version',  fn: work(150) },
        { text: 'Verify npm registry',  fn: work(200) },
        { text: 'Create project dir',   fn: work(100) },
      ],
    },
    {
      text: 'Install dependencies',
      fn: work(400),
      subtasks: [
        { text: 'Resolve package tree', fn: work(250) },
        { text: 'Download tarballs',    fn: work(500) },
        { text: 'Build native modules', fn: work(300) },
      ],
    },
    {
      text: 'Run post-install hooks',
      fn: work(200),
      subtasks: [
        { text: 'Generate types',  fn: work(150) },
        { text: 'Lint workspace',  fn: work(180) },
      ],
    },
  ]);

  // ── Final summary box ─────────────────────────
  console.log();
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.length - succeeded;

  const summary = [
    components.status('success', `${succeeded} steps completed`),
    failed > 0
      ? components.status('error',  `${failed} steps failed`)
      : components.status('info',   'No errors'),
    '',
    themes.muted('Next steps:'),
    '  ' + themes.accent('cd my-app && npm run dev'),
  ].join('\n');

  console.log(components.box(summary, { borderStyle: 'rounded', padding: 1 }));
  console.log();
};

main().catch((err) => {
  console.error(themes.error('✗ ' + err.message));
  process.exit(1);
});