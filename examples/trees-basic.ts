/**
 * Trees — basic usage example
 *
 * Shows the most common tree patterns:
 *   1. Builder API with icons + colors
 *   2. Plain-data API (for JSON / filesystem walks)
 *   3. Style variants (rounded, heavy, ascii)
 *   4. Tree algorithms (find, count, walk)
 *
 * Run: npx tsx examples/trees-basic.ts
 */

import {
  tree, renderTree, findInTree, countNodes, walkTree,
  color, gradient,
} from '../dist/index.js';

// ────────────────────────────────────────────────────────────────
//  1. Builder API — fluent, with icons and per-node colors
// ────────────────────────────────────────────────────────────────

console.log(gradient('Project structure', ['#ff79c6', '#bd93f9', '#8be9fd']));
console.log();

const project = tree({ label: 'my-app', icon: '📦', color: color.bold });

const src = project.add({ label: 'src', icon: '📁' });
src.addLeaf({ label: 'index.ts', icon: '📄' });
src.addLeaf({ label: 'app.ts',   icon: '📄' });

const utils = src.add({ label: 'utils', icon: '📁' });
utils.addLeaf({ label: 'helpers.ts', icon: '📄' });
utils.addLeaf({ label: 'ansi.ts',    icon: '📄' });

const tests = project.add({ label: 'tests', icon: '🧪' });
tests.addLeaf({ label: 'app.test.ts', icon: '📄' });

project.addLeaf({ label: 'package.json', icon: '📋', color: color.yellow });
project.addLeaf({ label: 'README.md',    icon: '📖' });

console.log(project.render({
  style:      'rounded',
  palette:    [color.cyan, color.green, color.magenta],
  guideColor: color.dim,
}));

// ────────────────────────────────────────────────────────────────
//  2. Plain-data API — for JSON / filesystem walks
// ────────────────────────────────────────────────────────────────

console.log();
console.log(gradient('Dependency graph', ['#ff79c6', '#bd93f9', '#8be9fd']));
console.log();

console.log(renderTree({
  label: 'react@18.2.0',
  icon:  '⚛',
  children: [
    {
      label: 'react-dom@18.2.0',
      children: [
        { label: 'scheduler@0.23.0' },
        { label: 'loose-envify@1.4.0' },
      ],
    },
    {
      label: 'react-router@6.14.0',
      children: [
        { label: '@remix-run/router@1.7.0' },
        { label: 'history@5.3.0' },
      ],
    },
  ],
}, {
  style:      'heavy',
  palette:    [color.magenta, color.cyan, color.green, color.yellow],
  guideColor: color.dim,
}));

// ────────────────────────────────────────────────────────────────
//  3. Tree algorithms — find, count, walk
// ────────────────────────────────────────────────────────────────

console.log();
console.log(gradient('Algorithms', ['#ff79c6', '#bd93f9', '#8be9fd']));
console.log();

const found = findInTree(project, (node) => node.label === 'helpers.ts');
const total = countNodes(project);

let leafCount = 0;
walkTree(project, (node) => {
  if (!node.children || node.children.length === 0) leafCount++;
});

console.log(`  ${color.dim('•')} total nodes: ${color.cyan(String(total))}`);
console.log(`  ${color.dim('•')} leaf files:  ${color.cyan(String(leafCount))}`);
console.log(`  ${color.dim('•')} found:       ${found ? color.green(found.label) : color.red('null')}`);
console.log();