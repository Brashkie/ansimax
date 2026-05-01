// ─────────────────────────────────────────────────────────────
//  ANSIMAX — Animations Showcase
//
//  Designed for screen recording. Each animation has:
//   - A clear label before
//   - A pause to capture the start
//   - The animation itself
//   - A pause to capture the end
//
//  Run with:
//    npx tsx examples/animations.ts
// ─────────────────────────────────────────────────────────────

import {
  color, gradient, rainbow,
  animate,
  ascii,
  sleep, write, writeln, screen,
} from '../dist/index.js';

// ── Helper: clear screen and show section header ─────────────
const showHeader = async (num: number, name: string, description: string): Promise<void> => {
  write(screen.clear());
  writeln('');
  writeln(ascii.banner('ANIMATIONS', { font: 'small', colorFn: rainbow, align: 'center' }));
  writeln('');
  writeln(ascii.divider({ width: 60 }));
  writeln('  ' + color.bold(color.cyan(`${num}. ${name}`)));
  writeln('  ' + color.dim(description));
  writeln(ascii.divider({ width: 60 }));
  writeln('');
  await sleep(1500); // pause to capture title
};

const main = async (): Promise<void> => {
  write(screen.clear());

  // ── INTRO ─────────────────────────────────────────────────
  writeln('');
  writeln(ascii.banner('ANSIMAX', { font: 'big', colorFn: rainbow, align: 'center' }));
  writeln('');
  writeln('  ' + color.bold('  All 7 animation effects'));
  writeln('  ' + color.dim('  Watch each one in action'));
  writeln('');
  await sleep(2500);

  // ── 1. TYPEWRITER ─────────────────────────────────────────
  await showHeader(1, 'TYPEWRITER', 'Types each character one by one');
  await animate.typewriter('  Welcome to Ansimax — typing character by character...', { speed: 60 });
  writeln('');
  await animate.typewriter('  ' + color.cyan('Perfect for intros and storytelling.'), { speed: 50 });
  await sleep(2000);

  // ── 2. FADE IN ────────────────────────────────────────────
  await showHeader(2, 'FADE IN', 'Smooth color fade from black to full brightness');
  await animate.fadeIn('  Fading in gracefully into view...', {
    duration: 1500, steps: 20, color: '#48dbfb',
  });
  writeln('');
  await animate.fadeIn('  Use it for elegant reveals.', {
    duration: 1200, color: '#feca57',
  });
  await sleep(2000);

  // ── 3. FADE OUT ───────────────────────────────────────────
  await showHeader(3, 'FADE OUT', 'Disappears smoothly into the background');
  writeln('  Watch this text fade away...');
  await sleep(800);
  await animate.fadeOut('  Watch this text fade away...', {
    duration: 1500, steps: 20, color: '#ff6b6b',
  });
  await sleep(1500);

  // ── 4. SLIDE ──────────────────────────────────────────────
  await showHeader(4, 'SLIDE', 'Slides in from a direction');
  await animate.slide('  Sliding in from the left...', {
    direction: 'left', duration: 800,
  });
  writeln('');
  await sleep(500);
  await animate.slide('  And from the right...', {
    direction: 'right', duration: 800,
  });
  await sleep(2000);

  // ── 5. PULSE ──────────────────────────────────────────────
  await showHeader(5, 'PULSE', 'Pulses between two colors — great for alerts');
  await animate.pulse('  ⚠️  IMPORTANT NOTIFICATION', {
    times: 4, interval: 350,
    color1: { r: 255, g: 100, b: 100 },
    color2: { r: 255, g: 220, b: 100 },
  });
  writeln('');
  await animate.pulse('  ✓ SUCCESS — Operation complete', {
    times: 3, interval: 400,
    color1: { r: 100, g: 255, b: 150 },
    color2: { r: 100, g: 200, b: 255 },
  });
  await sleep(2000);

  // ── 6. WAVE ───────────────────────────────────────────────
  await showHeader(6, 'WAVE', 'Color wave flowing across each character');
  await animate.wave('  WAVE OF COLORS FLOWING ACROSS LETTERS', {
    duration: 2500, steps: 40,
    colors: ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'],
  });
  writeln('');
  await animate.wave('  Custom palette: ocean tones', {
    duration: 2000, steps: 30,
    colors: ['#0070f3', '#48dbfb', '#7928ca', '#ff0080'],
  });
  await sleep(2000);

  // ── 7. GLITCH ─────────────────────────────────────────────
  await showHeader(7, 'GLITCH', 'Random character corruption — perfect for cyberpunk vibes');
  await animate.glitch('  S Y S T E M   E R R O R', {
    duration: 1500, intensity: 5,
  });
  writeln('');
  await animate.glitch('  Hacking the mainframe...', {
    duration: 1800, intensity: 4,
  });
  writeln('');
  await animate.glitch('  ACCESS GRANTED', {
    duration: 1200, intensity: 6,
  });
  await sleep(2000);

  // ── 8. REVEAL ─────────────────────────────────────────────
  await showHeader(8, 'REVEAL', 'Decrypts random characters into the real text');
  await animate.reveal('  TOP SECRET — CLASSIFIED INFORMATION', {
    duration: 2000,
  });
  writeln('');
  await animate.reveal('  Decoding transmission...', {
    duration: 1500,
    charset: '0123456789ABCDEF',
  });
  writeln('');
  await animate.reveal('  Welcome to the future', {
    duration: 1800,
  });
  await sleep(2000);

  // ── COMBO ─────────────────────────────────────────────────
  await showHeader(9, 'COMBINING EFFECTS', 'All animations work together');
  await animate.typewriter('  Step 1: Typewriter intro...', { speed: 40 });
  await sleep(500);
  await animate.fadeIn('  Step 2: Fade in confirmation', { duration: 1000, color: '#00ff88' });
  await sleep(500);
  await animate.pulse('  Step 3: Pulse alert', { times: 2, interval: 400 });
  await sleep(500);
  await animate.glitch('  Step 4: Final glitch', { duration: 1000, intensity: 4 });
  await sleep(2000);

  // ── OUTRO ─────────────────────────────────────────────────
  write(screen.clear());
  writeln('');
  writeln(ascii.banner('THANKS!', { font: 'big', colorFn: rainbow, align: 'center' }));
  writeln('');
  writeln('  ' + color.bold(color.cyan('  All 7 animations covered.')));
  writeln('  ' + color.dim('  Each one supports AbortSignal + reducedMotion.'));
  writeln('');
  writeln('  ' + color.dim('  $ npm install ansimax'));
  writeln('');
  await sleep(3000);
};

main().catch((err: unknown) => {
  console.error(color.red('Demo failed:'), err);
  process.exit(1);
});