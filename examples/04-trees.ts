/**
 * 04 — Trees
 *
 * Run: npx tsx examples/04-trees.ts
 */

import {
  tree,
  renderTree,
  walkTree,
  findInTree,
  countNodes,
  mapTree,
  filterTree,
  measureTree,
  color,
  type TreeData,
} from '../src/index.js';

console.log();
console.log(color.bold('━━━ Builder API ━━━'));
console.log();

const project = tree({ label: 'my-app', icon: '📦', color: color.bold });
const src = project.add({ label: 'src', icon: '📁' });
src.addLeaf({ label: 'index.ts', icon: '📄' });
src.addLeaf({ label: 'app.ts', icon: '📄' });
const utils = src.add({ label: 'utils', icon: '📁' });
utils.addLeaf({ label: 'helpers.ts', icon: '📄' });
utils.addLeaf({ label: 'logger.ts', icon: '📄' });
project.addLeaf({ label: 'package.json', icon: '📦' });
project.addLeaf({ label: 'README.md', icon: '📝' });

console.log(project.render());
console.log();

console.log(color.bold('━━━ Tree styles ━━━'));
console.log();

const styles = ['rounded', 'classic', 'thick', 'double', 'ascii', 'heavy'] as const;
for (const style of styles) {
  console.log(color.dim(`// style: ${style}`));
  console.log(project.render({ style }));
}

console.log(color.bold('━━━ Palette colors ━━━'));
console.log();

console.log(project.render({
  style: 'rounded',
  palette: [color.cyan, color.green, color.magenta, color.yellow],
  guideColor: color.dim,
}));
console.log();

console.log(color.bold('━━━ Plain-data API ━━━'));
console.log();

const tree2: TreeData = {
  label: 'dependencies',
  icon: '📦',
  children: [
    {
      label: 'production',
      icon: '🔒',
      children: [
        { label: 'react@18.2.0', icon: '⚛️' },
        { label: 'tailwind@3.4.1', icon: '🎨' },
      ],
    },
    {
      label: 'development',
      icon: '🛠️',
      children: [
        { label: 'typescript@5.4.0', icon: '🔷' },
        { label: 'jest@29.7.0', icon: '🧪' },
        { label: 'eslint@8.57.0', icon: '✅' },
      ],
    },
  ],
};

console.log(renderTree(tree2));
console.log();

console.log(color.bold('━━━ maxDepth truncation ━━━'));
console.log();
console.log(color.dim('// maxDepth: 1'));
console.log(renderTree(tree2, { maxDepth: 1 }));
console.log();

console.log(color.bold('━━━ Algorithms ━━━'));
console.log();
console.log('  countNodes:', countNodes(tree2));

const found = findInTree(tree2, (n) => n.label.includes('react'));
console.log('  findInTree (react):', found?.label);

console.log('  walkTree paths:');
walkTree(tree2, (node, depth) => {
  if (depth > 0) console.log('    ' + '  '.repeat(depth) + '→ ' + node.label);
});

const upper = mapTree(tree2, (node) => ({ ...node, label: node.label.toUpperCase() }));
console.log('\n  mapTree (uppercase):');
console.log(renderTree(upper));

const onlyDev = filterTree(tree2, (n) => n.label !== 'production', { prune: true });
console.log('  filterTree (no production):');
if (onlyDev) console.log(renderTree(onlyDev));

const dim = measureTree(tree2);
console.log(`  measureTree: ${dim.width} × ${dim.height}`);
console.log();

console.log(color.bold(color.green('✓ Trees test complete')));
console.log();
