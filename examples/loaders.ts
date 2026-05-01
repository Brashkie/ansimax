// ─────────────────────────────────────────────────────────────
//  ANSIMAX — Loaders Showcase
//
//  Designed for screen recording. Shows every spinner style,
//  progress bar variant, multi-task runner, and countdown.
//
//  Run with:
//    npx tsx examples/loaders.ts
// ─────────────────────────────────────────────────────────────

import {
  color, rainbow,
  loader, SPINNERS,
  ascii,
  sleep, write, writeln, screen,
} from '../dist/index.js';

// ── Helper: clear screen and show section header ─────────────
const showHeader = async (num: number, name: string, description: string): Promise<void> => {
  write(screen.clear());
  writeln('');
  writeln(ascii.banner('LOADERS', { font: 'small', colorFn: rainbow, align: 'center' }));
  writeln('');
  writeln(ascii.divider({ width: 60 }));
  writeln('  ' + color.bold(color.cyan(`${num}. ${name}`)));
  writeln('  ' + color.dim(description));
  writeln(ascii.divider({ width: 60 }));
  writeln('');
  await sleep(1500);
};

const main = async (): Promise<void> => {
  write(screen.clear());

  // ── INTRO ─────────────────────────────────────────────────
  writeln('');
  writeln(ascii.banner('ANSIMAX', { font: 'big', colorFn: rainbow, align: 'center' }));
  writeln('');
  writeln('  ' + color.bold('  Complete loaders showcase'));
  writeln('  ' + color.dim('  11 spinners + progress + tasks + countdown'));
  writeln('');
  await sleep(2500);

  // ─────────────────────────────────────────────────────────
  //  PART 1 — All 11 spinner styles
  // ─────────────────────────────────────────────────────────
  const spinnerTypes: Array<keyof typeof SPINNERS> = [
    'dots', 'dots2', 'line', 'arrow', 'bounce',
    'star', 'moon', 'clock', 'pong', 'aesthetic', 'blocks',
  ];

  const spinnerColors = [
    '#00ff88', '#48dbfb', '#feca57', '#ff6b6b', '#a29bfe',
    '#ffd700', '#7928ca', '#0070f3', '#ff0080', '#48dbfb', '#00ff88',
  ];

  for (let i = 0; i < spinnerTypes.length; i++) {
    const type = spinnerTypes[i] as keyof typeof SPINNERS;
    const clr  = spinnerColors[i] as string;

    await showHeader(i + 1, `SPINNER: ${type.toUpperCase()}`, `Style "${type}"`);

    const stop = loader.spin(`Loading with ${type} spinner...`, {
      type,
      color: clr,
    });
    await sleep(2500);
    stop(`${type} spinner — done`, true);
    await sleep(1200);
  }

  // ─────────────────────────────────────────────────────────
  //  PART 2 — Spinner with success / error states
  // ─────────────────────────────────────────────────────────
  await showHeader(12, 'SUCCESS & ERROR STATES', 'Spinners show ✓ or ✗ on completion');

  const s1 = loader.spin('Building project...', { type: 'dots', color: '#00ff88' });
  await sleep(2000);
  s1('Build successful', true);
  writeln('');

  const s2 = loader.spin('Running tests...', { type: 'dots', color: '#48dbfb' });
  await sleep(2000);
  s2('All tests passed', true);
  writeln('');

  const s3 = loader.spin('Deploying...', { type: 'dots', color: '#ff6b6b' });
  await sleep(2000);
  s3('Deployment failed: connection timeout', false);
  await sleep(2500);

  // ─────────────────────────────────────────────────────────
  //  PART 3 — Static progress bar (different percentages)
  // ─────────────────────────────────────────────────────────
  await showHeader(13, 'STATIC PROGRESS BAR', 'Render at any percentage');

  const percentages = [0, 25, 50, 75, 100];
  for (const pct of percentages) {
    loader.progress(pct, 'Snapshot');
    writeln('');
    await sleep(600);
  }
  writeln('');
  await sleep(1500);

  // ─────────────────────────────────────────────────────────
  //  PART 4 — Animated progress bar (different colors)
  // ─────────────────────────────────────────────────────────
  await showHeader(14, 'ANIMATED PROGRESS', 'Smoothly animates from 0% to 100%');

  await loader.progressAnimate(30, 'Downloading files', {
    delay: 60, color: '#48dbfb', width: 40,
  });
  await sleep(800);

  await loader.progressAnimate(25, 'Installing packages', {
    delay: 80, color: '#00ff88', char: '▓', emptyChar: '░',
  });
  await sleep(800);

  await loader.progressAnimate(20, 'Building bundle', {
    delay: 100, color: '#ffd700', char: '█', emptyChar: '·',
  });
  await sleep(2000);

  // ─────────────────────────────────────────────────────────
  //  PART 5 — Sequential task runner
  // ─────────────────────────────────────────────────────────
  await showHeader(15, 'SEQUENTIAL TASKS', 'Run tasks one after another with status icons');

  await loader.tasks([
    { text: 'Fetching dependencies',  fn: async () => { await sleep(1200); return 'ok'; } },
    { text: 'Compiling TypeScript',   fn: async () => { await sleep(1500); return 'ok'; } },
    { text: 'Running test suite',     fn: async () => { await sleep(1000); return 'ok'; } },
    { text: 'Generating coverage',    fn: async () => { await sleep(800);  return 'ok'; } },
    { text: 'Bundling output',        fn: async () => { await sleep(1100); return 'ok'; } },
  ], { type: 'dots', spinColor: '#00ff88' });
  await sleep(2000);

  // ─────────────────────────────────────────────────────────
  //  PART 6 — Tasks with failure
  // ─────────────────────────────────────────────────────────
  await showHeader(16, 'TASKS WITH ERRORS', 'Continues running even when one fails');

  await loader.tasks([
    { text: 'Lint check',     fn: async () => { await sleep(800); return 'ok'; } },
    { text: 'Type check',     fn: async () => { await sleep(1000); throw new Error('15 type errors found'); } },
    { text: 'Format check',   fn: async () => { await sleep(700); return 'ok'; } },
    { text: 'Security audit', fn: async () => { await sleep(900); throw new Error('2 vulnerabilities'); } },
  ], { type: 'dots', spinColor: '#ff6b6b' });
  await sleep(2500);

  // ─────────────────────────────────────────────────────────
  //  PART 7 — Custom dots loader
  // ─────────────────────────────────────────────────────────
  await showHeader(17, 'DOTS LOADER', 'Animated dots that count up');

  const stopDots = loader.dots('Processing data', { interval: 350, max: 4 });
  await sleep(4000);
  stopDots();
  writeln(color.green('  ✓ Done processing'));
  await sleep(2000);

  // ─────────────────────────────────────────────────────────
  //  PART 8 — Custom frame loader
  // ─────────────────────────────────────────────────────────
  await showHeader(18, 'CUSTOM SPINNER', 'Build your own spinner from any frames');

  const customStop = loader.custom(
    ['◐', '◓', '◑', '◒'],
    'Custom rotation...',
    { interval: 200 },
  );
  await sleep(3500);
  customStop();
  writeln(color.cyan('  ✓ Custom spinner stopped'));
  writeln('');

  const wavyStop = loader.custom(
    ['🌊  ', ' 🌊 ', '  🌊', ' 🌊 '],
    'Wavy progress...',
    { interval: 250 },
  );
  await sleep(3500);
  wavyStop();
  writeln(color.cyan('  ✓ Wavy spinner stopped'));
  await sleep(2000);

  // ─────────────────────────────────────────────────────────
  //  PART 9 — Countdown
  // ─────────────────────────────────────────────────────────
  await showHeader(19, 'COUNTDOWN', 'Animated countdown to zero');

  await loader.countdown(5, {
    label: 'Launching in',
    color: '#ffd700',
  });
  writeln(color.green('  🚀 Launched!'));
  await sleep(1500);
  writeln('');

  await loader.countdown(3, {
    label: 'Self-destruct in',
    color: '#ff0000',
  });
  writeln(color.red('  💥 Boom!'));
  await sleep(2500);

  // ─────────────────────────────────────────────────────────
  //  PART 10 — Real-world flow
  // ─────────────────────────────────────────────────────────
  await showHeader(20, 'REAL WORLD FLOW', 'Combining everything in a typical CLI run');

  // Step 1: spinner
  const buildStop = loader.spin('Initializing project...', { type: 'dots', color: '#a29bfe' });
  await sleep(1500);
  buildStop('Project initialized', true);
  writeln('');

  // Step 2: animated progress
  await loader.progressAnimate(15, 'Installing 247 packages', {
    delay: 50, color: '#48dbfb',
  });

  // Step 3: parallel-feel tasks
  await loader.tasks([
    { text: 'Lint',         fn: async () => { await sleep(600); return 'ok'; } },
    { text: 'TypeScript',   fn: async () => { await sleep(900); return 'ok'; } },
    { text: 'Unit tests',   fn: async () => { await sleep(800); return 'ok'; } },
    { text: 'Build bundle', fn: async () => { await sleep(700); return 'ok'; } },
  ]);

  writeln('');
  writeln(color.green('  ✓ All checks passed!'));
  writeln(color.dim('  Total time: 8.3s'));
  await sleep(2500);

  // ── OUTRO ─────────────────────────────────────────────────
  write(screen.clear());
  writeln('');
  writeln(ascii.banner('THANKS!', { font: 'big', colorFn: rainbow, align: 'center' }));
  writeln('');
  writeln('  ' + color.bold(color.cyan('  20 different loader scenarios covered.')));
  writeln('  ' + color.dim('  All AbortSignal-aware. Auto-degrades in non-TTY environments.'));
  writeln('');
  writeln('  ' + color.dim('  $ npm install ansimax'));
  writeln('');
  await sleep(3000);
};

main().catch((err: unknown) => {
  console.error(color.red('Demo failed:'), err);
  process.exit(1);
});