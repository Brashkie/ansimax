/**
 * 09 — Themes
 *
 * Run: npx tsx examples/09-themes.ts
 */

import { themes, createTheme, color } from '../src/index.js';

console.log();
console.log(color.bold('━━━ Built-in Themes ━━━'));
console.log();

const builtIns = ['dracula', 'nord', 'monokai', 'cyberpunk', 'pastel', 'matrix', 'ocean', 'sunset'];
for (const name of builtIns) {
  themes.use(name);
  console.log(' ', name.padEnd(12),
    themes.primary('primary'),
    themes.secondary('secondary'),
    themes.accent('accent'),
    themes.success('success'),
    themes.warning('warning'),
    themes.error('error'),
    themes.info('info'),
  );
}
console.log();

console.log(color.bold('━━━ Background helpers ━━━'));
console.log();
themes.use('dracula');
console.log(' ',
  themes.bgPrimary(' bgPrimary '), '',
  themes.bgAccent(' bgAccent '), '',
);
console.log();

console.log(color.bold('━━━ Theme info ━━━'));
console.log();
console.log('  themes.list():', themes.list().join(', '));
console.log('  themes.current().name:', themes.current().name);
console.log();

console.log(color.bold('━━━ Listener (onChange) ━━━'));
console.log();
const off = themes.onChange((newTheme, oldTheme) => {
  console.log(`  ${color.dim('event:')} ${oldTheme.name} → ${color.bold(newTheme.name)}`);
});
themes.use('nord');
themes.use('matrix');
themes.use('cyberpunk');
off();
console.log();

console.log(color.bold('━━━ Register custom theme ━━━'));
console.log();
themes.register('custom-blue', {
  name: 'Custom Blue',
  primary: '#3b82f6',
  secondary: '#2563eb',
  accent: '#60a5fa',
  success: '#10b981',
  warning: '#fbbf24',
  error: '#ef4444',
  info: '#06b6d4',
  muted: '#6b7280',
  bg: '#1e293b',
  surface: '#334155',
  text: '#f1f5f9',
  gradient: ['#3b82f6', '#60a5fa', '#93c5fd'],
});
themes.use('custom-blue');
console.log(' ', themes.primary('Custom theme is now active'));
console.log(' ', themes.gradient('Theme gradient!'));
console.log('  current:', themes.current().name);
console.log();

console.log(color.bold('━━━ Per-instance isolation ━━━'));
console.log();
const tenantA = createTheme('nord');
const tenantB = createTheme('matrix');
console.log('  tenantA current:', tenantA.current().name);
console.log('  tenantB current:', tenantB.current().name);
console.log('  (Each instance has its own state)');
console.log();

themes.use('dracula');
themes.unregister('custom-blue');

console.log(color.bold(color.green('✓ Themes test complete')));
console.log();
