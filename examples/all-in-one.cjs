/**
 * all-in-one.cjs
 *
 * Comprehensive ansimax demo — CommonJS (require).
 *
 * This example uses `require('ansimax')` directly so it works in
 * any CommonJS project after `npm install ansimax`.
 *
 * Run:
 *   node examples/all-in-one.cjs
 *
 * (Requires `ansimax` installed: `npm install ansimax`)
 */

const {
  color,
  gradient,
  rainbow,
  colorPresets,
  ascii,
  loader,
  animate,
  components,
  themes,
  images,
  gradientRect,
  tree,
  box,
} = require('ansimax');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.clear();

  // ── 1. Banner with gradient ───────────────────────────────
  console.log(ascii.banner('ANSIMAX', {
    font: 'big',
    align: 'center',
    colorFn: (t) => gradient(t, ['#ff79c6', '#bd93f9', '#8be9fd']),
  }));
  console.log();

  // ── 2. Setup theme + intro typewriter ────────────────────
  themes.use('dracula');
  await animate.typewriter('  All ansimax features in one script — CommonJS edition', {
    speed: 25,
    colorFn: (t) => themes.primary(t),
  });
  console.log('\n');
  await sleep(400);

  // ── 3. Colors ─────────────────────────────────────────────
  console.log(components.section('🎨 Colors', { width: 60 }));
  console.log();
  console.log(' Basic:    ',
    color.red('red'), color.green('green'), color.blue('blue'),
    color.yellow('yellow'), color.magenta('magenta'), color.cyan('cyan'));
  console.log(' Bright:   ',
    color.brightRed('red'), color.brightGreen('green'), color.brightBlue('blue'),
    color.brightYellow('yellow'), color.brightMagenta('magenta'), color.brightCyan('cyan'));
  console.log(' Modifiers:',
    color.bold('bold'), color.italic('italic'),
    color.underline('underline'), color.dim('dim'), color.inverse('inverse'));
  console.log(' Hex:      ',
    color.hex('#ff79c6')('#ff79c6'),
    color.hex('#bd93f9')('#bd93f9'),
    color.hex('#8be9fd')('#8be9fd'),
    color.hex('#50fa7b')('#50fa7b'));
  console.log();

  // ── 4. Gradients ──────────────────────────────────────────
  console.log(components.section('🌈 Gradients', { width: 60 }));
  console.log();
  console.log(' Rainbow:', rainbow('Rainbow text with multiple colors'));
  console.log(' Sunset: ', colorPresets.sunset('Beautiful sunset gradient'));
  console.log(' Ocean:  ', colorPresets.ocean('Deep ocean gradient'));
  console.log(' Fire:   ', colorPresets.fire('Burning fire gradient'));
  console.log(' Custom: ', gradient('Custom multi-stop gradient', ['#ff6b6b', '#feca57', '#48dbfb']));
  console.log();

  // ── 5. ASCII boxes ────────────────────────────────────────
  console.log(components.section('📦 Boxes', { width: 60 }));
  console.log();
  console.log(ascii.box('Single border', { padding: 1, borderStyle: 'single' }));
  console.log(ascii.box('Rounded border', { padding: 1, borderStyle: 'rounded' }));
  console.log(ascii.box('Heavy border', { padding: 1, borderStyle: 'heavy' }));
  console.log();

  // ── 6. Trees ──────────────────────────────────────────────
  console.log(components.section('🌳 Trees', { width: 60 }));
  console.log();
  const proj = tree({ label: 'project', icon: '📦', color: color.bold });
  const src = proj.add({ label: 'src', icon: '📁' });
  src.addLeaf({ label: 'index.js', icon: '📄' });
  src.addLeaf({ label: 'utils.js', icon: '📄' });
  proj.addLeaf({ label: 'package.json', icon: '📦' });
  proj.addLeaf({ label: 'README.md', icon: '📝' });
  console.log(proj.render({
    style: 'rounded',
    palette: [color.cyan, color.green, color.magenta],
    guideColor: color.dim,
  }));
  console.log();

  // ── 7. Tables ─────────────────────────────────────────────
  console.log(components.section('📊 Tables', { width: 60 }));
  console.log();
  console.log(components.table([
    ['Module', 'Status', 'Tests'],
    ['colors', color.green('● ready'), '180'],
    ['ascii',  color.green('● ready'), '125'],
    ['trees',  color.green('● ready'),  '87'],
  ], { borderStyle: 'rounded' }));
  console.log();

  // ── 8. Badges & Status ────────────────────────────────────
  console.log(components.section('🏷️  Badges & Status', { width: 60 }));
  console.log();
  console.log(' ',
    components.badge('VERSION', 'v1.4.0'),
    components.badge('BUILD', 'passing'),
    components.badge('LICENSE', 'Apache 2.0'));
  console.log();
  console.log(components.status('info',    'Build started'));
  console.log(components.status('success', 'Tests passed'));
  console.log(components.status('warn',    '1 deprecation'));
  console.log(components.status('error',   'Build failed'));
  console.log();

  // ── 9. Loaders ────────────────────────────────────────────
  console.log(components.section('⏳ Loaders', { width: 60 }));
  console.log();
  let stop = loader.spin('Loading data...', { color: '#bd93f9' });
  await sleep(1200);
  stop('Data loaded successfully!', true);

  await loader.tasks([
    { text: 'Compiling sources',    fn: async () => await sleep(700) },
    { text: 'Bundling modules',     fn: async () => await sleep(900) },
    { text: 'Generating type defs', fn: async () => await sleep(600) },
  ]);
  console.log();

  // ── 10. Pixel art ─────────────────────────────────────────
  console.log(components.section('🎨 Pixel Art', { width: 60 }));
  console.log();
  console.log(' Heart sprite:  ', images.sprite('heart'));
  console.log();
  console.log(' Gradient bar:');
  console.log(gradientRect({
    width: 50,
    height: 2,
    colors: ['#ff6b6b', '#feca57', '#48dbfb', '#a29bfe'],
    dither: 'bayer',
  }));
  console.log();

  // ── 11. Animations ────────────────────────────────────────
  console.log(components.section('✨ Animations', { width: 60 }));
  console.log();
  await animate.fadeIn('  Smooth fade-in animation', { duration: 500 });
  console.log();
  await animate.typewriter('  Typewriter effect typing one char at a time...', { speed: 25 });
  console.log('\n');

  // ── 12. Timeline ──────────────────────────────────────────
  console.log(components.section('📅 Timeline', { width: 60 }));
  console.log();
  console.log(components.timeline([
    { label: 'Project created',        done: true,  time: 'Mon' },
    { label: 'Dependencies installed', done: true,  time: 'Tue' },
    { label: 'Tests passing',          done: true,  time: 'Wed' },
    { label: 'Documentation written',  done: false, time: 'Thu' },
    { label: 'Published to npm',       done: false },
  ]));
  console.log();

  // ── 13. Themes ────────────────────────────────────────────
  console.log(components.section('🎭 Themes', { width: 60 }));
  console.log();
  for (const name of ['dracula', 'nord', 'monokai', 'cyberpunk', 'matrix']) {
    themes.use(name);
    console.log(' ', name.padEnd(12),
      themes.primary('primary'),
      themes.accent('accent'),
      themes.success('success'),
      themes.warning('warning'),
      themes.error('error'));
  }
  console.log();

  // ── 14. Final box ─────────────────────────────────────────
  themes.use('dracula');
  console.log(box(
    themes.primary('✨ Ansimax demo complete ✨') + '\n' +
    themes.muted('CommonJS · require · Zero deps'),
    { padding: 1, borderStyle: 'rounded' },
  ));
  console.log();

  // ── 15. Farewell ──────────────────────────────────────────
  await animate.fadeOut('Thanks for trying ansimax!', { duration: 800 });
  console.log();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
