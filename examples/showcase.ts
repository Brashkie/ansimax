// ─────────────────────────────────────────────────────────────
//  ANSIMAX — Showcase Demo
//
//  Compact visual demo designed for README screenshots.
//  Run with:
//    npx tsx examples/showcase.ts
// ─────────────────────────────────────────────────────────────

import {
  color, gradient, rainbow, compose,
  ascii,
  loader,
  components,
  themes,
  images, createCanvas,
  sleep, writeln,
} from '../dist/index.js';

const main = async (): Promise<void> => {
  writeln('');

  // ── HERO BANNER ───────────────────────────────────────────
  writeln(ascii.banner('ANSIMAX', { font: 'big', colorFn: rainbow, align: 'center' }));
  writeln(color.dim('         The ultimate CLI rendering library'));
  writeln('');
  await sleep(400);

  // ── 1 · COLORS & GRADIENTS ────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' COLORS ')), width: 60 }));
  writeln('');
  writeln('  ' + color.red('● red') + '  ' + color.green('● green') + '  ' +
              color.blue('● blue') + '  ' + color.yellow('● yellow') + '  ' +
              color.magenta('● magenta') + '  ' + color.cyan('● cyan'));
  writeln('  ' + color.bold('bold  ') + color.italic('italic  ') +
              color.underline('underline  ') + color.strikethrough('strike'));
  writeln('  ' + gradient('Smooth gradients across multiple stops', ['#ff6b6b', '#feca57', '#48dbfb', '#7928ca']));
  writeln('  ' + rainbow('Taste the rainbow across every character!'));
  writeln('  ' + compose(color.bold, color.red, color.underline)('CRITICAL ERROR — composed styles'));
  writeln('');
  await sleep(400);

  // ── 2 · ASCII ART ─────────────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' ASCII ART ')), width: 60 }));
  writeln('');
  writeln(ascii.big('HELLO'));
  writeln('');
  writeln(ascii.box(rainbow('Rainbow box!'), { borderStyle: 'double', padding: 1 }));
  writeln('');
  await sleep(400);

  // ── 3 · COMPONENTS ────────────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' COMPONENTS ')), width: 60 }));
  writeln('');
  writeln(components.table([
    ['Module',     'Status',       'Coverage'],
    ['colors',     '✓ ready',      '100%'],
    ['animations', '✓ ready',      '100%'],
    ['loaders',    '✓ ready',      '100%'],
    ['frames',     '✓ ready',      '100%'],
  ], { header: true, borderStyle: 'rounded' }));
  writeln('');

  writeln(components.status('success', 'All 750+ tests passing'));
  writeln(components.status('info',    'Zero runtime dependencies'));
  writeln(components.status('warn',    'TypeScript strict mode enabled'));
  writeln(components.status('error',   'Without ansimax, your CLI looks boring'));
  writeln('');

  writeln('  ' + components.badge('VERSION', 'v1.0.0') + '  ' +
                components.badge('BUILD', 'passing') + '  ' +
                components.badge('LICENSE', 'MIT') + '  ' +
                components.badge('TYPES', 'included'));
  writeln('');
  await sleep(400);

  // ── 4 · TIMELINE ──────────────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' TIMELINE ')), width: 60 }));
  writeln('');
  writeln(components.timeline([
    { label: 'Project init',   done: true,  time: '10:00' },
    { label: 'Build pipeline', done: true,  time: '10:15' },
    { label: 'Run tests',      done: true,  time: '10:32' },
    { label: 'Deploy to npm',  done: false, time: 'pending' },
    { label: 'Notify users',   done: false },
  ]));
  writeln('');
  await sleep(400);

  // ── 5 · PIXEL ART ─────────────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' PIXEL ART ')), width: 60 }));
  writeln('');
  writeln('  Built-in sprites:');
  writeln('');
  writeln(images.sprite('heart', { scale: 1 }));
  writeln(images.sprite('star',  { scale: 1 }));
  writeln('');

  writeln('  Custom canvas drawing:');
  writeln('');
  const canvas = createCanvas(30, 10);
  canvas.drawRect(0, 0, 30, 10, { r: 30, g: 30, b: 50 }, true);
  canvas.drawCircle(15, 5, 4, { r: 255, g: 200, b: 0 }, true);
  canvas.drawRect(5, 2, 8, 6, { r: 255, g: 100, b: 100 });
  canvas.drawRect(17, 2, 8, 6, { r: 100, g: 200, b: 255 });
  writeln(canvas.render({ halfBlock: true }));
  writeln('');

  writeln('  Smooth gradients:');
  writeln('');
  writeln(images.gradientRect({
    width: 50, height: 6,
    colors: ['#ff0080', '#7928ca', '#0070f3', '#48dbfb'],
    style: 'horizontal',
  }));
  writeln('');
  await sleep(400);

  // ── 6 · LOADER ────────────────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' LOADERS ')), width: 60 }));
  writeln('');

  const spin = loader.spin('Building project...', { type: 'dots', color: '#00ff88' });
  await sleep(1200);
  spin('Project built successfully', true);

  await loader.progressAnimate(20, 'Installing packages', { delay: 40, color: '#48dbfb' });

  await loader.tasks([
    { text: 'Fetching dependencies', fn: async () => { await sleep(400); return 'ok'; } },
    { text: 'Compiling TypeScript',  fn: async () => { await sleep(500); return 'ok'; } },
    { text: 'Running test suite',    fn: async () => { await sleep(300); return 'ok'; } },
    { text: 'Generating coverage',   fn: async () => { await sleep(250); return 'ok'; } },
  ]);
  writeln('');

  // ── 7 · THEMES ────────────────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' THEMES ')), width: 60 }));
  writeln('');
  themes.list().forEach((name) => {
    themes.use(name);
    const t = themes.current();
    writeln('  ' +
      color.hex(t.primary)(name.padEnd(12)) +
      color.hex(t.primary)('███') +
      color.hex(t.secondary)('███') +
      color.hex(t.accent)('███') +
      color.hex(t.error)('███') +
      color.hex(t.warning)('███'));
  });
  themes.use('dracula');
  writeln('');

  // ── CLOSING ───────────────────────────────────────────────
  writeln(ascii.divider({ label: color.bold(color.cyan(' GET STARTED ')), width: 60 }));
  writeln('');
  writeln(ascii.box(
    color.bold('npm install ansimax') + '\n\n' +
    color.dim('Then import what you need:') + '\n' +
    color.cyan("import { color, animate, ") + '\n' +
    color.cyan("         loader, ascii } ") + '\n' +
    color.cyan("from 'ansimax';"),
    { borderStyle: 'rounded', padding: 2 },
  ));
  writeln('');

  writeln(ascii.banner('THANKS!', { font: 'small', colorFn: rainbow, align: 'center' }));
  writeln(color.dim('       Made with ❤  by Brashkie · MIT License'));
  writeln('');
};

main().catch((err: unknown) => {
  console.error(color.red('Showcase failed:'), err);
  process.exit(1);
});