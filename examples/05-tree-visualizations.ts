// ─────────────────────────────────────────────
//  EXAMPLE 5 — Tree visualizations
//
//  Demonstrates the new `trees` module with 4 real-world scenarios:
//   1. Filesystem tree with icons + per-node colors
//   2. Dependency tree with depth-based palette + collapsed nodes
//   3. JSON-as-tree with multiline values + max-depth truncation
//   4. Heavy-style decision tree with guide colors
//
//  Run:
//    npx ts-node examples/05-tree-visualizations.ts
// ─────────────────────────────────────────────

import {
  trees, tree,
  themes, color,
  components,
} from '../dist/index.js';

const main = (): void => {
  // ─────────────────────────────────────────────
  //  Scenario 1: Filesystem tree
  // ─────────────────────────────────────────────
  console.log();
  console.log(components.section(themes.primary('Project structure'), { width: 60 }));
  console.log();

  const fs = tree({ label: 'my-app', icon: '📁', color: themes.primary });
  const src = fs.add({ label: 'src', icon: '📁' });
  src.addLeaf({ label: 'index.ts', icon: '📄', color: themes.accent })
     .addLeaf({ label: 'app.ts', icon: '📄', color: themes.accent })
     .addLeaf({ label: 'utils', icon: '📁' });
  src.children![2]!.children = [
    { label: 'helpers.ts', icon: '📄', color: themes.accent },
    { label: 'constants.ts', icon: '📄', color: themes.accent },
  ];

  const tests = fs.add({ label: 'tests', icon: '📁' });
  tests.addLeaf({ label: 'app.test.ts', icon: '🧪', color: themes.warning })
       .addLeaf({ label: 'utils.test.ts', icon: '🧪', color: themes.warning });

  fs.add({ label: 'package.json', icon: '📦', color: themes.muted });
  fs.add({ label: 'README.md', icon: '📖', color: themes.muted });
  fs.add({ label: 'tsconfig.json', icon: '⚙️', color: themes.muted });

  console.log(fs.render({ guideColor: themes.muted }));

  // ─────────────────────────────────────────────
  //  Scenario 2: Dependency tree with collapsed branches
  // ─────────────────────────────────────────────
  console.log();
  console.log(components.section(themes.primary('Dependency tree (with collapse)'), { width: 60 }));
  console.log();

  const deps = tree('myapp@1.0.0');
  const react = deps.add('react@18.2.0');
  react.addLeaf('scheduler@0.23.0').addLeaf('loose-envify@1.4.0');

  const express = deps.add('express@4.18.2');
  // 14 transitive deps — collapse to show only the last 3
  express.add({
    label: 'transitive dependencies',
    collapse: 11,
    children: [
      { label: 'accepts@1.3.8' },
      { label: 'array-flatten@1.1.1' },
      { label: 'body-parser@1.20.1' },
      { label: 'content-disposition@0.5.4' },
      { label: 'content-type@1.0.5' },
      { label: 'cookie@0.5.0' },
      { label: 'cookie-signature@1.0.6' },
      { label: 'debug@2.6.9' },
      { label: 'depd@2.0.0' },
      { label: 'encodeurl@1.0.2' },
      { label: 'escape-html@1.0.3' },
      { label: 'etag@1.8.1' },
      { label: 'finalhandler@1.2.0' },
      { label: 'fresh@0.5.2' },
    ],
  });

  deps.add('lodash@4.17.21');

  console.log(deps.render({
    palette: [
      color.cyan,    // depth 0 (root)
      color.yellow,  // depth 1 (direct deps)
      color.gray,    // depth 2+ (transitive)
    ],
    guideColor: themes.muted,
    style: 'rounded',
  }));

  // ─────────────────────────────────────────────
  //  Scenario 3: JSON-as-tree with maxDepth
  // ─────────────────────────────────────────────
  console.log();
  console.log(components.section(themes.primary('Config tree (maxDepth: 2)'), { width: 60 }));
  console.log();

  const cfg = tree({ label: 'tsconfig.json', icon: '⚙️' });
  const compiler = cfg.add({ label: 'compilerOptions', icon: '🔧' });
  compiler.addLeaf('target: "ES2022"')
          .addLeaf('module: "ESNext"')
          .addLeaf({ label: 'lib', children: [
            { label: '"ES2022"' },
            { label: '"DOM"' },
            { label: '"DOM.Iterable"' },
          ]})
          .addLeaf({ label: 'paths', children: [
            { label: '"@/*": ["./src/*"]' },
            { label: '"@utils/*": ["./src/utils/*"]' },
          ]});

  cfg.add({ label: 'include', children: [
    { label: '"src/**/*"' },
    { label: '"tests/**/*"' },
  ]});
  cfg.add({ label: 'exclude', children: [
    { label: '"node_modules"' },
    { label: '"dist"' },
  ]});

  console.log(cfg.render({
    maxDepth: 2,
    guideColor: themes.muted,
  }));

  // ─────────────────────────────────────────────
  //  Scenario 4: Decision tree with heavy style + multiline
  // ─────────────────────────────────────────────
  console.log();
  console.log(components.section(themes.primary('Decision flow (heavy + multiline)'), { width: 60 }));
  console.log();

  const decision = tree({
    label: 'User clicks "Deploy"',
    icon: '🚀',
    color: themes.primary,
  });

  const valid = decision.add({
    label: 'Tests pass?\n(must include integration suite)',
    color: color.cyan,
  });
  valid.add({ label: 'Yes → Deploy to production', color: themes.accent, icon: '✓' });
  valid.add({
    label: 'No → Block deployment\nNotify team via Slack',
    color: themes.error,
    icon: '✗',
  });

  decision.add({
    label: 'Build artifact > 100MB?',
    color: color.cyan,
  });

  console.log(decision.render({
    style: 'heavy',
    guideColor: themes.warning,
  }));

  // ─────────────────────────────────────────────
  //  Bonus: walkTree to count nodes
  // ─────────────────────────────────────────────
  console.log();
  let nodeCount = 0;
  let leafCount = 0;
  trees.walk(fs, (node) => {
    nodeCount++;
    if (!node.children || node.children.length === 0) leafCount++;
  });
  console.log(themes.muted(`📊 Project tree: ${nodeCount} nodes total, ${leafCount} leaves`));

  // ─────────────────────────────────────────────
  //  Bonus: measureTree for layout
  // ─────────────────────────────────────────────
  const dims = trees.measure(fs, { guideColor: themes.muted });
  console.log(themes.muted(`📐 Renders as ${dims.width}×${dims.height} characters`));
  console.log();
};

main();