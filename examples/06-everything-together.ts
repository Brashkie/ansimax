/**
 * ansimax — comprehensive showcase
 *
 * A fictional CLI for deploying a microservices stack. Demonstrates EVERY
 * module of ansimax in a cohesive narrative.
 *
 * Run: npx tsx examples/06-everything-together.ts
 */

import {
  // Config
  configure, getConfig, onConfigKeyChange, withConfig,
  // Themes
  createTheme, themes,
  // Color
  color, gradient, registerPreset,
  // ASCII
  ascii,
  // Animate
  animate,
  // Loader
  loader,
  // Frames
  frames,
  // Components
  components,
  // Images
  images, createCanvas, gradientRect,
  // Trees
  tree, findInTree, countNodes, walkTree,
  // Utils — ANSI
  setTitle, link, bell, cursor, createOutputBuffer, write,
  // Utils — helpers
  padBoth, safeJson, once, escapeRegex, sleep,
} from '../dist/index.js';

// ────────────────────────────────────────────────────────────────
//  0. Bootstrap
// ────────────────────────────────────────────────────────────────

process.stdout.write(setTitle('ansimax demo — deploying stack'));

configure({
  colorMode:      'auto',
  animationSpeed: 'normal',
  theme:          'dracula',
});

const offThemeListener = onConfigKeyChange('theme', (newTheme, oldTheme) => {
  console.log(color.dim(`  [config] theme: ${oldTheme} → ${newTheme}`));
});

// Custom gradient preset
registerPreset('sunsetSky', ['#ff6b6b', '#feca57', '#48dbfb']);

// Reusable stops for section headers
const SECTION_STOPS = ['#ff6b6b', '#feca57', '#48dbfb'];

// ────────────────────────────────────────────────────────────────
//  1. Banner
// ────────────────────────────────────────────────────────────────

const printBanner = (): void => {
  console.clear();
  const banner = ascii.banner('ansimax', {
    font:  'big',
    align: 'center',
    colorFn: (t: string) => gradient(t, ['#bd93f9', '#ff79c6', '#50fa7b']),
  });
  console.log(banner);

  const subtitle = color.dim('comprehensive showcase — every module in one demo');
  console.log(padBoth(subtitle, 80));

  // ascii.divider — DividerOptions has only char/width/label/style (no color).
  // Apply color externally via color.hex().
  const { width } = ascii.measure('ansimax', 'big');
  console.log(color.hex('#6272a4')(
    ascii.divider({ width: Math.max(width, 60), char: '═' }),
  ));
  console.log();
};

// ────────────────────────────────────────────────────────────────
//  2. Sections helper
// ────────────────────────────────────────────────────────────────

const section = (title: string): void => {
  console.log();
  console.log(gradient(`▸ ${title}`, SECTION_STOPS));
  console.log(color.dim('─'.repeat(60)));
};

// ────────────────────────────────────────────────────────────────
//  3. Theme demo
// ────────────────────────────────────────────────────────────────

const themeDemo = (): void => {
  section('1 · Themes (per-instance isolation)');

  const tenantA = createTheme('dracula');
  const tenantB = createTheme('nord');

  tenantA.register('corporate', {
    name:      'Corporate',
    primary:   '#0066cc',
    secondary: '#ffcc00',
    accent:    '#00aa66',
    success:   '#00aa66',
    warning:   '#ff8800',
    error:     '#cc0033',
    info:      '#0099ff',
    muted:     '#999999',
    bg:        '#ffffff',
    surface:   '#f5f5f5',
    text:      '#222222',
    gradient:  ['#0066cc', '#00aa66'],
  });

  console.log(`  ${tenantA.primary('tenantA')} themes: ${tenantA.list().length}`);
  console.log(`  ${tenantB.secondary('tenantB')} themes: ${tenantB.list().length} ${color.dim("(no 'corporate')")}`);

  const switched = tenantA.tryUse('not-a-theme');
  console.log(`  tryUse('not-a-theme') → ${switched ? color.green('ok') : color.red('false (handled)')}`);

  console.log(`  ${tenantA.bgPrimary(' PRIMARY ')}${tenantA.bgAccent(' ACCENT ')}${tenantA.bgError(' ERROR ')}`);

  console.log();
  console.log(themes.preview());
};

// ────────────────────────────────────────────────────────────────
//  4. Color showcase
// ────────────────────────────────────────────────────────────────

const colorDemo = (): void => {
  section('2 · Colors (gradients, presets, composition)');

  console.log(
    '  ' + color.red('red  ') + color.green('green  ') + color.blue('blue  ') +
    color.bold('bold  ') + color.italic('italic  ') + color.underline('underline'),
  );

  console.log('  ' + gradient('multi-stop gradient — fire to ocean', ['#ff6b6b', '#feca57', '#48dbfb']));

  // Built-in rainbow preset
  console.log('  ' + color.rainbow('built-in rainbow preset'));

  // Custom registered preset — registerPreset adds a stop list, accessed via gradient()
  console.log('  ' + gradient('custom registered preset (sunsetSky)', ['#ff6b6b', '#feca57', '#48dbfb']));

  // Compose: bold + red + underline
  const danger = (s: string): string => color.bold(color.red(color.underline(s)));
  console.log('  ' + danger('composed: bold + red + underline'));

  // ColorFn signature is (text: string) — coerce non-strings ourselves
  console.log('  ' + color.cyan(String(42)) + ' ' + color.magenta(String(true)));
};

// ────────────────────────────────────────────────────────────────
//  5. Animations
// ────────────────────────────────────────────────────────────────

const animateDemo = async (): Promise<void> => {
  section('3 · Animations (typewriter, parallel, delay)');

  // TypewriterOptions: { speed, newline, colorFn, signal, reducedMotion, hooks }
  await animate.typewriter('  Welcome to the deployment wizard...', { speed: 18 });

  console.log('  ' + color.dim('Running 3 parallel checks (timeout=2s)...'));
  await animate.parallel([
    async () => { await sleep(400); console.log('  ' + color.green('  ✓') + ' network'); },
    async () => { await sleep(600); console.log('  ' + color.green('  ✓') + ' DNS'); },
    async () => { await sleep(800); console.log('  ' + color.green('  ✓') + ' TLS'); },
  ], { timeout: 2000 });

  await animate.delay(200);
};

// ────────────────────────────────────────────────────────────────
//  6. Loaders — real Task shape: { text, fn, subtasks? }
// ────────────────────────────────────────────────────────────────

const loaderDemo = async (): Promise<void> => {
  section('4 · Loaders (spin, progress, hierarchical tasks)');

  const stop = loader.spin('Connecting to registry', { color: '#bd93f9' });
  await sleep(700);
  stop('Registry connected', true);

  console.log();
  await loader.progressAnimate(20, 'Downloading manifests', {
    color: '#50fa7b', delay: 25,
  });

  console.log();
  await loader.tasks([
    {
      text: 'Backend',
      fn: async () => undefined,
      subtasks: [
        { text: 'API gateway',  fn: async () => sleep(300) },
        { text: 'Auth service', fn: async () => sleep(400) },
        { text: 'User service', fn: async () => sleep(350) },
      ],
    },
    {
      text: 'Frontend',
      fn: async () => undefined,
      subtasks: [
        { text: 'Build bundle',  fn: async () => sleep(500) },
        { text: 'Optimize SVGs', fn: async () => sleep(200) },
      ],
    },
  ], { parallel: true });
};

// ────────────────────────────────────────────────────────────────
//  7. Components
// ────────────────────────────────────────────────────────────────

const componentsDemo = (): void => {
  section('5 · Components (table, badge, status, columns, timeline)');

  console.log();
  console.log(components.table([
    ['Service',        'Status',                'Replicas', 'Region'],
    ['api-gateway',    color.green('● running'),  '3',        'us-east-1'],
    ['auth-service',   color.green('● running'),  '2',        'us-east-1'],
    ['user-service',   color.yellow('● starting'),'1',        'us-west-2'],
    ['payments',       color.red('● failed'),     '0',        'eu-west-1'],
  ], { borderStyle: 'rounded' }));

  console.log();
  console.log('  ' + components.badge('env',     'production') +
              '  ' + components.badge('version', 'v1.2.3') +
              '  ' + components.badge('build',   '#1234'));

  console.log();
  console.log('  ' + components.status('success', 'Database migrations complete'));
  console.log('  ' + components.status('warn',    'Cache hit rate below threshold'));
  console.log('  ' + components.status('error',   'Connection pool exhausted'));
  console.log('  ' + components.status('info',    'Deployment scheduled for 14:30'));

  console.log();
  console.log(components.columns([
    'api-gateway', 'auth-service', 'user-service',
    'payments',    'notifications', 'analytics',
  ], { cols: 3, gap: 4 }));

  console.log();
  console.log(components.timeline([
    { label: 'Pull image',       done: true,  time: '14:00' },
    { label: 'Stop old version', done: true,  time: '14:02' },
    { label: 'Health check',     done: false, time: '14:03' },
    { label: 'Switch traffic',   done: false, time: '14:05' },
  ]));
};

// ────────────────────────────────────────────────────────────────
//  8. Images
// ────────────────────────────────────────────────────────────────

const imagesDemo = (): void => {
  section('6 · Images (gradient rect + canvas + sprite)');

  console.log();
  console.log(gradientRect({
    width: 50, height: 5,
    colors: ['#ff79c6', '#bd93f9', '#8be9fd'],
    style: 'horizontal',
    dither: 'bayer',
  }));

  console.log();
  const canvas = createCanvas(30, 8, { r: 18, g: 18, b: 38 });

  for (let y = 0; y < 8; y++) {
    const t = y / 7;
    const r = Math.round(40 + 100 * t);
    const g = Math.round(20 + 60 * t);
    const b = Math.round(80 + 80 * (1 - t));
    canvas.drawRect(0, y, 30, 1, { r, g, b }, true);
  }

  if (images.sprites.heart)  canvas.drawSprite(2,  2, images.sprites.heart.pixels);
  if (images.sprites.star)   canvas.drawSprite(12, 2, images.sprites.star.pixels);
  if (images.sprites.smiley) canvas.drawSprite(22, 2, images.sprites.smiley.pixels);
  canvas.print();
};

// ────────────────────────────────────────────────────────────────
//  9. Frames
// ────────────────────────────────────────────────────────────────

const framesDemo = async (): Promise<void> => {
  section('7 · Frames (live render, morph, presets)');

  console.log();
  console.log(color.dim('  Loading bar preset:'));
  const ctrl = frames.play(frames.presets.loadingBar({ width: 20, label: '  Progress' }), {
    fps: 30, repeat: 1,
  });
  await ctrl.done;

  console.log(color.dim('  Morph (text decryption):'));
  const morphFrames = frames.morph('SECRET CODE', 'DEPLOY OK ', 12);
  for (const f of morphFrames) {
    process.stdout.write('\r  ' + color.cyan(f));
    await sleep(60);
  }
  console.log();
};

// ────────────────────────────────────────────────────────────────
//  10. Trees
// ────────────────────────────────────────────────────────────────

const treesDemo = (): void => {
  section('8 · Trees (builder + algorithms)');

  const project = tree({ label: 'my-app', icon: '📦', color: color.bold });

  const src = project.add({ label: 'src', icon: '📁' });
  src.addLeaf({ label: 'index.ts',   icon: '📄' });
  src.addLeaf({ label: 'app.ts',     icon: '📄' });
  const utils = src.add({ label: 'utils', icon: '📁' });
  utils.addLeaf({ label: 'helpers.ts', icon: '📄' });
  utils.addLeaf({ label: 'ansi.ts',    icon: '📄' });

  const tests = project.add({ label: 'tests', icon: '🧪' });
  tests.addLeaf({ label: 'app.test.ts', icon: '📄' });

  project.addLeaf({ label: 'package.json', icon: '📋', color: color.yellow });
  project.addLeaf({ label: 'README.md',    icon: '📖' });

  console.log();
  console.log(project.render({
    style: 'rounded',
    palette: [color.cyan, color.green, color.magenta],
    guideColor: color.dim,
  }));

  const found = findInTree(project, (n) => n.label === 'helpers.ts');
  const total = countNodes(project);

  let leafCount = 0;
  walkTree(project, (n) => {
    if (!n.children || n.children.length === 0) leafCount++;
  });

  console.log();
  // ColorFn expects string — coerce numbers via String()
  console.log(`  ${color.dim('•')} total nodes: ${color.cyan(String(total))}`);
  console.log(`  ${color.dim('•')} leaf files:  ${color.cyan(String(leafCount))}`);
  console.log(`  ${color.dim('•')} found:       ${found ? color.green(found.label) : color.red('null')}`);
};

// ────────────────────────────────────────────────────────────────
//  11. Utils
// ────────────────────────────────────────────────────────────────

const utilsDemo = (): void => {
  section('9 · Utils (OutputBuffer, helpers, hyperlinks)');

  const buf = createOutputBuffer();
  const verbose = process.env.VERBOSE !== undefined;
  buf
    .push('  ')
    .push(color.bold('Built with: '))
    .push(link('ansimax', 'https://github.com/Brashkie/ansimax'))
    .push(' · ')
    .pushIf(verbose, color.dim('(verbose mode) '))
    .push(color.dim('TypeScript + Node.js'))
    .pushln();
  buf.flush();

  const obj: { name: string; count: bigint; self?: unknown } = {
    name: 'demo', count: 9876543210123456789n,
  };
  obj.self = obj;
  console.log('  ' + color.dim('safeJson:'));
  console.log('  ' + safeJson(obj, 2).split('\n').join('\n  '));

  const userInput = 'a.b+c?(x)';
  const re = new RegExp(escapeRegex(userInput));
  console.log('  ' + color.dim('escapeRegex:'));
  console.log(`  /${color.cyan(escapeRegex(userInput))}/ matches "${userInput}": ${color.green(String(re.test(userInput)))}`);

  let count = 0;
  const init = once(() => { count++; return 'initialized'; });
  init(); init(); init();
  // String() to satisfy ColorFn signature
  console.log(`  ${color.dim('once:')} called 3x, fn ran ${color.cyan(String(count))} time(s)`);

  console.log('  ' + color.dim('padBoth:'));
  console.log('  ' + color.bgBlue(padBoth(' centered ', 30)));
};

// ────────────────────────────────────────────────────────────────
//  12. Finale
// ────────────────────────────────────────────────────────────────

const finale = async (): Promise<void> => {
  section('10 · Finale (withConfig, bell)');

  await withConfig({ animationSpeed: 'fast' }, async () => {
    console.log();
    console.log('  Speed temporarily: ' + color.green(getConfig().animationSpeed));
    // TypewriterOptions uses `speed`, not `delay`
    await animate.typewriter('  Fast typewriter inside withConfig block.', { speed: 8 });
  });
  console.log('  Speed restored to: ' + color.green(getConfig().animationSpeed));

  // BoxOptions: padding/borderStyle/width only — no borderColor.
  // Apply color externally with color.hex() wrapping.
  const summary = color.hex('#50fa7b')(ascii.box(
    color.bold(color.green('✓ Demo complete')) + '\n' +
    color.dim('All modules exercised:') + '\n' +
    '  configure · themes · colors · ascii · animate\n' +
    '  loader · frames · components · images · trees · utils',
    { padding: 1 },
  ));
  console.log();
  console.log(summary);

  process.stdout.write(bell());

  offThemeListener();
};

// ────────────────────────────────────────────────────────────────
//  Main
// ────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  const handleSigint = once((): void => {
    write(cursor.show());
    console.log('\n' + color.dim('  Interrupted. Cleaning up...'));
    process.exit(130);
  });
  process.on('SIGINT', handleSigint);

  try {
    printBanner();
    themeDemo();
    colorDemo();
    await animateDemo();
    await loaderDemo();
    componentsDemo();
    imagesDemo();
    await framesDemo();
    treesDemo();
    utilsDemo();
    await finale();
  } catch (err) {
    write(cursor.show());
    console.error('\n' + color.red('Demo error:'), err);
    process.exit(1);
  }
};

main().catch((err) => {
  console.error(color.red('Fatal:'), err);
  process.exit(1);
});