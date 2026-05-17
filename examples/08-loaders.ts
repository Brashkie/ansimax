/**
 * 08 — Loaders
 * Real spinner types: dots, dots2, line, arrow, bounce, star, moon, clock, pong, aesthetic, blocks
 *
 * Run: npx tsx examples/08-loaders.ts
 */

import { loader, SPINNERS, color } from '../src/index.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

console.log();
console.log(color.bold('━━━ Available Spinners ━━━'));
console.log();
console.log(' ', Object.keys(SPINNERS).join(', '));
console.log();

console.log(color.bold('━━━ Basic spinner with success ━━━'));
let stop = loader.spin('Loading data...', { color: '#bd93f9' });
await sleep(1500);
stop('Data loaded!', true);

console.log(color.dim('\n// Spinner with failure'));
stop = loader.spin('Connecting to API...', { color: '#ff5555' });
await sleep(1500);
stop('Connection failed', false);

console.log(color.bold('\n━━━ Different spinner types ━━━'));
const types = ['dots', 'line', 'arrow', 'star', 'bounce', 'moon'] as const;
for (const type of types) {
  stop = loader.spin(`Type: ${type}`, { type, color: '#50fa7b' });
  await sleep(1000);
  stop();
}

console.log(color.bold('\n━━━ Static progress bar ━━━'));
console.log();
console.log(' ', loader.progress(0, { width: 30 }));
console.log(' ', loader.progress(33, { width: 30 }));
console.log(' ', loader.progress(66, { width: 30 }));
console.log(' ', loader.progress(100, { width: 30 }));
console.log();

console.log(color.bold('━━━ Animated progress ━━━'));
console.log();
await loader.progressAnimate(100, 'Downloading file', {
  color: '#50fa7b',
  delay: 15,
});

console.log(color.bold('\n━━━ Sequential tasks ━━━'));
console.log();
await loader.tasks([
  { text: 'Cloning repository', fn: async () => await sleep(800) },
  { text: 'Installing dependencies', fn: async () => await sleep(1200) },
  { text: 'Building project', fn: async () => await sleep(900) },
  { text: 'Running tests', fn: async () => await sleep(700) },
]);

console.log(color.bold('\n━━━ Parallel tasks ━━━'));
console.log();
await loader.tasks([
  { text: 'Type check', fn: async () => await sleep(1000) },
  { text: 'Lint', fn: async () => await sleep(1500) },
  { text: 'Bundle', fn: async () => await sleep(800) },
  { text: 'Generate types', fn: async () => await sleep(1200) },
], { parallel: true });

console.log(color.bold('\n━━━ Hierarchical tasks ━━━'));
console.log();
await loader.tasks([
  {
    text: 'Build',
    fn: async () => await sleep(500),
    subtasks: [
      { text: 'TypeScript', fn: async () => await sleep(800) },
      { text: 'Bundle ESM', fn: async () => await sleep(600) },
      { text: 'Bundle CJS', fn: async () => await sleep(600) },
    ],
  },
  {
    text: 'Test',
    fn: async () => await sleep(500),
    subtasks: [
      { text: 'Unit tests', fn: async () => await sleep(900) },
      { text: 'Integration tests', fn: async () => await sleep(700) },
    ],
  },
]);

console.log(color.bold('\n━━━ Countdown ━━━'));
console.log();
await loader.countdown(3, { color: '#ff79c6', prefix: 'Starting in ', suffix: 's' });
console.log(color.green('  Started!'));

console.log();
console.log(color.bold(color.green('✓ Loaders test complete')));
console.log();
