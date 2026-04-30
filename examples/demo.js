// ─────────────────────────────────────────────────────────────
//  ANSIMAX — JavaScript Demo (CommonJS)
//
//  Run after build:
//    npm run build
//    node examples/demo.js
//
//  This file imports from the compiled output in dist/ so it works
//  with plain Node.js — no TypeScript or transpiler required.
// ─────────────────────────────────────────────────────────────

const ansimax = require('../dist/index.js').default;
const {
  color, gradient, rainbow, compose,
  animate,
  ascii,
  loader,
  frames,
  components,
  themes,
  images, createCanvas,
  sleep, writeln,
  hexToRgb, isHexColor, truncateAnsi, wordWrap,
} = require('../dist/index.js');

// ── Section divider ──────────────────────────────────────────
const section = (title) => {
  writeln('');
  writeln(ascii.divider({ label: color.bold(color.cyan(title)), width: 60 }));
  writeln('');
};

const main = async () => {
  // ── 0 · INTRO ─────────────────────────────────────────────
  writeln('');
  writeln(ascii.banner('ANSIMAX', { font: 'big', colorFn: rainbow, align: 'center' }));
  writeln(color.dim('       JavaScript demo — all modules'));
  await sleep(800);

  // ── 1 · COLORS ────────────────────────────────────────────
  section('1 · Colors');
  writeln('  ' + color.red('red') + '  ' + color.green('green') + '  ' + color.blue('blue') +
              '  ' + color.yellow('yellow') + '  ' + color.magenta('magenta'));
  writeln('  ' + color.bold('bold') + '  ' + color.italic('italic') + '  ' +
              color.underline('underline') + '  ' + color.strikethrough('strike'));
  writeln('  ' + color.gray('gray') + '  ' + color.orange('orange') + '  ' + color.purple('purple'));
  writeln('  rgb:      ' + color.rgb(255, 100, 50)('custom RGB'));
  writeln('  hex:      ' + color.hex('#ff6b6b')('#ff6b6b'));
  writeln('  bgHex:    ' + color.bgHex('#0575e6')(color.white('  background  ')));
  writeln('  compose:  ' + compose(color.bold, color.red, color.underline)('CRITICAL'));
  writeln('  gradient: ' + gradient('Smooth color transitions', ['#ff6b6b', '#feca57', '#48dbfb']));
  writeln('  rainbow:  ' + rainbow('Taste the rainbow!'));
  await sleep(800);

  // ── 2 · ASCII ART ─────────────────────────────────────────
  section('2 · ASCII Art');
  writeln(ascii.big('HELLO'));
  writeln('');
  writeln(ascii.small('small font'));
  writeln('');
  writeln(ascii.box('Rounded box with padding', { borderStyle: 'rounded', padding: 1 }));
  writeln('');
  writeln(ascii.box(rainbow('Rainbow inside box'), { borderStyle: 'double', padding: 2 }));
  await sleep(800);

  // ── 3 · ANIMATIONS ────────────────────────────────────────
  section('3 · Animations');
  await animate.typewriter('  Typewriter effect — typing one char at a time...', { speed: 25 });
  await animate.fadeIn('  Fading in...', { duration: 500, color: '#48dbfb' });
  await animate.slide('  Sliding in', { direction: 'left', duration: 400 });
  await animate.pulse('  Pulsing color', { times: 2, interval: 200 });
  await animate.wave('  Wave through letters', { duration: 800, steps: 20 });
  await animate.glitch('  Glitch effect!', { duration: 500, intensity: 4 });
  await animate.reveal('  Revealing hidden text', { duration: 700 });

  // ── 4 · LOADERS ───────────────────────────────────────────
  section('4 · Loaders & Progress');

  const spin = loader.spin('Processing data...', { type: 'dots', color: '#00ff88' });
  await sleep(1500);
  spin('Data processed', true);

  await loader.progressAnimate(25, 'Installing packages', { delay: 30, color: '#48dbfb' });

  const taskResults = await loader.tasks([
    { text: 'Fetching dependencies', fn: async () => { await sleep(400); return 'ok'; } },
    { text: 'Compiling sources',     fn: async () => { await sleep(600); return 'ok'; } },
    { text: 'Running tests',         fn: async () => { await sleep(300); return 'ok'; } },
  ]);
  writeln(color.dim(`  → ${taskResults.length} tasks completed`));

  writeln('');
  await loader.countdown(3, { label: 'Launching in', color: '#ffd700' });
  writeln(color.green('  🚀 Launched!'));

  // ── 5 · FRAMES ────────────────────────────────────────────
  section('5 · Frame Engine');

  await frames.play(frames.presets.loadingBar({ width: 30 }), { interval: 40, repeat: 1 });
  await frames.play(frames.presets.ball({ width: 25 }), { interval: 60, repeat: 2 });

  // Morph — unique ansimax feature
  const morphed = frames.morph('LOADING', 'COMPLETE', 12);
  await frames.play(morphed, { interval: 80, repeat: 1 });
  writeln('');

  // ── 6 · COMPONENTS ────────────────────────────────────────
  section('6 · UI Components');

  writeln(components.table([
    ['Name',    'Status',      'Score'],
    ['Alice',   '✓ active',    '95'],
    ['Bob',     '⚠ pending',   '78'],
    ['Charlie', '✗ inactive',  '42'],
  ], { header: true, borderStyle: 'rounded' }));
  writeln('');

  writeln(components.status('success', 'All tests passed'));
  writeln(components.status('error',   'Build failed'));
  writeln(components.status('warn',    'Deprecation notice'));
  writeln(components.status('info',    'Update available'));
  writeln(components.status('wait',    'Syncing...'));
  writeln('');

  writeln('  ' + components.badge('VERSION', 'v1.0.0') + '  ' +
                components.badge('BUILD', 'passing') + '  ' +
                components.badge('LICENSE', 'MIT'));
  writeln('');

  writeln(components.timeline([
    { label: 'Setup',  done: true,  time: '10:00' },
    { label: 'Build',  done: true,  time: '10:15' },
    { label: 'Test',   done: true,  time: '10:32' },
    { label: 'Deploy', done: false, time: 'pending' },
    { label: 'Notify', done: false },
  ]));
  await sleep(600);

  // ── 7 · THEMES ────────────────────────────────────────────
  section('7 · Themes');

  themes.list().forEach((name) => {
    themes.use(name);
    const t = themes.current();
    writeln('  ' +
      color.hex(t.primary)(name.padEnd(12)) +
      color.hex(t.primary)('●') +
      color.hex(t.secondary)('●') +
      color.hex(t.accent)('●') +
      color.hex(t.error)('●') +
      color.hex(t.warning)('●'));
  });
  themes.use('dracula');

  // ── 8 · IMAGES & CANVAS ───────────────────────────────────
  section('8 · Pixel Art & Canvas');

  writeln('  Built-in sprites:');
  writeln(images.sprite('heart'));
  writeln(images.sprite('star'));
  writeln('');

  writeln('  Sprite transforms (original / flipped):');
  const heart = images.sprites.heart.pixels;
  writeln(images.render(heart, { halfBlock: true }));
  writeln(images.render(images.flipHorizontal(heart), { halfBlock: true }));
  writeln('');

  writeln('  Custom canvas:');
  const canvas = createCanvas(20, 8);
  canvas.drawRect(0, 0, 20, 8, { r: 30, g: 30, b: 40 }, true);
  canvas.drawCircle(10, 4, 3, { r: 255, g: 200, b: 0 }, true);
  canvas.drawRect(5, 2, 10, 4, { r: 255, g: 100, b: 100 });
  writeln(canvas.render({ halfBlock: true }));
  writeln('');

  writeln('  Gradient rectangle:');
  writeln(images.gradientRect({
    width: 40, height: 6,
    colors: ['#ff0080', '#7928ca', '#0070f3'],
    style: 'horizontal',
  }));

  // ── 9 · UTILITIES ─────────────────────────────────────────
  section('9 · Utilities');

  writeln(`  isHexColor('#ff0000'):           ${color.green(String(isHexColor('#ff0000')))}`);
  writeln(`  isHexColor('banana'):            ${color.red(String(isHexColor('banana')))}`);
  writeln(`  hexToRgb('#48dbfb'):             ${JSON.stringify(hexToRgb('#48dbfb'))}`);
  writeln(`  truncateAnsi('hello world', 8):  ${truncateAnsi('hello world', 8)}`);
  writeln('');
  writeln('  wordWrap demo (width 20):');
  for (const line of wordWrap('Lorem ipsum dolor sit amet consectetur adipiscing', 20)) {
    writeln('    ' + color.dim('│') + ' ' + line);
  }

  // ── 10 · DEFAULT EXPORT ───────────────────────────────────
  section('10 · Default export');
  writeln('  ansimax.color.cyan : ' + ansimax.color.cyan('reachable via default export'));
  writeln('  ansimax.themes.list: ' + JSON.stringify(ansimax.themes.list()));

  // ── CLOSING ───────────────────────────────────────────────
  section('DONE');
  writeln(ascii.banner('ALL MODULES OK', { font: 'small', colorFn: rainbow, align: 'center' }));
  writeln('');
  writeln(color.dim('  Built with JavaScript + Ansimax · MIT License'));
  writeln('');
};

main().catch((err) => {
  console.error(color.red('Demo failed:'), err);
  process.exit(1);
});