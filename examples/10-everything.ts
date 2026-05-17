/**
 * 10 — Everything Together
 *
 * Run: npx tsx examples/10-everything.ts
 */

import {
  color,
  gradient,
  ascii,
  loader,
  animate,
  components,
  themes,
  images,
  gradientRect,
  tree,
} from '../src/index.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

console.clear();

// 1. Banner with gradient
console.log(ascii.banner('ANSIMAX', {
  font: 'big',
  align: 'center',
  colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9', '#8be9fd']),
}));
console.log();

themes.use('dracula');

// 2. Typewriter intro
await animate.typewriter('Welcome to the comprehensive ansimax showcase...', {
  speed: 25,
  colorFn: (t) => themes.primary(t),
});
console.log();
await sleep(500);

// 3. Section header
console.log(components.section('📦 Project Setup', { width: 60 }));
console.log();

// 4. Tree
const project = tree({ label: 'my-microservices', icon: '📦', color: color.bold });
const api = project.add({ label: 'api', icon: '🌐' });
api.addLeaf({ label: 'auth-service', icon: '🔐' });
api.addLeaf({ label: 'user-service', icon: '👤' });
api.addLeaf({ label: 'payment-service', icon: '💳' });
const infra = project.add({ label: 'infra', icon: '☁️' });
infra.addLeaf({ label: 'database', icon: '🗄️' });
infra.addLeaf({ label: 'cache', icon: '⚡' });
project.addLeaf({ label: 'docs', icon: '📝' });

console.log(project.render({
  style: 'rounded',
  palette: [themes.primary, themes.accent, themes.success],
  guideColor: themes.muted,
}));
console.log();

// 5. Badges
console.log(components.section('🏷️  Status', { width: 60 }));
console.log();
console.log(' ',
  components.badge('VERSION', 'v1.1.0'),
  components.badge('BUILD', 'passing'),
  components.badge('TESTS', '1848 ✓'),
  components.badge('LICENSE', 'Apache 2.0'),
);
console.log();
await sleep(500);

// 6. Hierarchical tasks
console.log(components.section('🚀 Deployment', { width: 60 }));
console.log();
await loader.tasks([
  {
    text: 'Build services',
    fn: async () => await sleep(300),
    subtasks: [
      { text: 'auth-service', fn: async () => await sleep(800) },
      { text: 'user-service', fn: async () => await sleep(600) },
      { text: 'payment-service', fn: async () => await sleep(900) },
    ],
  },
  {
    text: 'Deploy to staging',
    fn: async () => await sleep(1200),
  },
]);

// 7. Service status
console.log();
console.log(components.section('📊 Service Status', { width: 60 }));
console.log();
console.log(components.table([
  ['Service', 'Status', 'Version', 'Latency'],
  ['auth-service', themes.success('● healthy'), 'v2.1.0', '14ms'],
  ['user-service', themes.success('● healthy'), 'v1.8.3', '22ms'],
  ['payment-service', themes.warning('● degraded'), 'v1.2.0', '180ms'],
  ['database', themes.success('● healthy'), 'pg-15.4', '3ms'],
  ['cache', themes.success('● healthy'), 'redis-7', '1ms'],
], { borderStyle: 'rounded' }));
console.log();

// 8. Pixel art
console.log(components.section('🎉 Complete', { width: 60 }));
console.log();
console.log('  ', images.sprite('star'), '   ', images.sprite('heart'), '   ', images.sprite('star'));
console.log();

// 9. Gradient bar (using top-level gradientRect — verified works)
console.log(gradientRect({
  width: 60,
  height: 2,
  colors: ['#ff6b6b', '#feca57', '#48dbfb', '#a29bfe', '#fd79a8'],
  dither: 'bayer',
}));
console.log();

// 10. Final summary
console.log(ascii.box(
  themes.primary('✨ All systems deployed successfully ✨') + '\n' +
  themes.muted('Total time: 7.2s · Services: 6 · Tests: 1848'),
  { padding: 1, borderStyle: 'rounded' },
));
console.log();

await animate.fadeOut('Thank you for using ansimax!', { duration: 800 });
console.log();
