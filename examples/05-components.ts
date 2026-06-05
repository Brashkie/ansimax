/**
 * 05 — Components (NO interactive menu — tested separately)
 *
 * Run: npx tsx examples/05-components.ts
 */

import { components, box, color } from '../src/index.js';

console.log();
console.log(color.bold('━━━ Tables ━━━'));
console.log();

console.log(components.table([
  ['Module', 'Status', 'Coverage', 'Tests'],
  ['colors', color.green('● ready'), '100%', '180'],
  ['animations', color.green('● ready'), '99%', '245'],
  ['loaders', color.green('● ready'), '99%', '210'],
  ['frames', color.green('● ready'), '99%', '125'],
  ['components', color.green('● ready'), '100%', '198'],
  ['themes', color.green('● ready'), '100%', '94'],
  ['trees', color.green('● ready'), '100%', '87'],
], { borderStyle: 'rounded' }));
console.log();

console.log(color.dim('// Table with double border'));
console.log(components.table([
  ['Name', 'Age', 'City'],
  ['Ana', '25', 'Madrid'],
  ['Carlos', '30', 'Lima'],
], { borderStyle: 'double' }));
console.log();

console.log(color.bold('━━━ Badges ━━━'));
console.log();
console.log(' ',
  components.badge('VERSION', 'v1.1.0'),
  components.badge('BUILD', 'passing'),
  components.badge('LICENSE', 'Apache 2.0'),
  components.badge('NPM', 'ansimax'),
);
console.log();

console.log(color.bold('━━━ Status ━━━'));
console.log();
console.log(components.status('info',    'Build started'));
console.log(components.status('success', 'Linting passed'));
console.log(components.status('warn',    '5 deprecation warnings'));
console.log(components.status('error',   'Build failed'));
console.log();

console.log(color.bold('━━━ Section ━━━'));
console.log();
console.log(components.section('Installation Steps', { width: 60 }));
console.log();
console.log(components.section('Configuration', { width: 60 }));
console.log();

console.log(color.bold('━━━ Columns ━━━'));
console.log();
console.log(components.columns([
  'Lorem ipsum dolor sit amet',
  'Consectetur adipiscing elit',
  'Sed do eiusmod tempor',
], { cols: 3, gap: 2, width: 60 }));
console.log();

console.log(color.bold('━━━ Timeline ━━━'));
console.log();
console.log(components.timeline([
  { label: 'Project initialized', done: true, time: '10:00' },
  { label: 'Dependencies installed', done: true, time: '10:05' },
  { label: 'Build pipeline configured', done: true, time: '10:15' },
  { label: 'Tests running', done: false, time: '10:32' },
  { label: 'Deploy to npm', done: false },
]));
console.log();

console.log(color.bold('━━━ Static progress bars ━━━'));
console.log();
for (const pct of [10, 25, 50, 75, 90, 100]) {
  console.log(' ', `${pct.toString().padStart(3)}%`, components.progressBar(pct, { width: 30 }));
}
console.log();

console.log(color.bold('━━━ box utility ━━━'));
console.log();
console.log(box('Simple box utility', { padding: 1 }));
console.log();
console.log(box('Padded + bordered\nwith multiple lines', {
  padding: 2,
  borderStyle: 'rounded',
}));
console.log();

console.log(color.bold(color.green('✓ Components test complete')));
console.log();
