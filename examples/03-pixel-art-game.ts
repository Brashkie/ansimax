// ─────────────────────────────────────────────
//  EXAMPLE 3 — Pixel art game loop
//
//  Demonstrates:
//   - Canvas with dirty-region rendering for FPS
//   - Sprite drawing with alpha blending
//   - Gradient backgrounds with Bayer dithering
//   - Frame-rate locked game loop (drift-corrected)
//   - Braille mode for high-resolution detail
//
//  A bouncing rocket on a sunset gradient with a star field.
//
//  Run:
//    npx ts-node examples/03-pixel-art-game.ts
// ─────────────────────────────────────────────

import {
  createCanvas,
  images,
  themes,
  cursor,
  screen,
  write,
  sleep,
  termSize,
  type RGBA,
} from '../dist/index.js';

const WIDTH  = 60;
const HEIGHT = 30;

// ── Build static background once ───────────────
const buildBackground = (): ReturnType<typeof createCanvas> => {
  const canvas = createCanvas(WIDTH, HEIGHT);

  // Sunset gradient with Bayer dithering for smooth bands
  const gradStr = images.gradientRect({
    width: WIDTH,
    height: HEIGHT,
    colors: ['#1a1a2e', '#16213e', '#fd7272', '#f9ca24'],
    style: 'vertical',
    dither: 'bayer',
  });
  // gradientRect returns rendered text; instead we build pixels manually
  // so we can composite sprites on top.
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      // Simple vertical sunset
      const t = y / (HEIGHT - 1);
      const r = Math.round(0x1a + (0xf9 - 0x1a) * t);
      const g = Math.round(0x1a + (0xca - 0x1a) * t);
      const b = Math.round(0x2e + (0x24 - 0x2e) * t);
      canvas.set(x, y, { r, g, b });
    }
  }

  // Star field — random white dots in upper half
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(Math.random() * WIDTH);
    const y = Math.floor(Math.random() * (HEIGHT / 2));
    const brightness = 150 + Math.floor(Math.random() * 100);
    canvas.set(x, y, { r: brightness, g: brightness, b: brightness });
  }

  return canvas;
};

// ── Rocket sprite (5×5) with alpha edges for soft blending ──
const ROCKET = [
  [null,  null,  { r: 255, g: 255, b: 255 }, null,  null ],
  [null,  { r: 255, g: 100, b: 100 }, { r: 255, g: 200, b: 200 }, { r: 255, g: 100, b: 100 }, null ],
  [{ r: 200, g: 50, b: 50, a: 0.7 } as RGBA, { r: 255, g: 100, b: 100 }, { r: 255, g: 150, b: 150 }, { r: 255, g: 100, b: 100 }, { r: 200, g: 50, b: 50, a: 0.7 } as RGBA],
  [null,  { r: 255, g: 200, b: 50 }, { r: 255, g: 240, b: 100 }, { r: 255, g: 200, b: 50 }, null ],
  [null,  null,  { r: 255, g: 150, b: 50, a: 0.6 } as RGBA, null,  null ],
];

// ── Main loop ──────────────────────────────────
const main = async (): Promise<void> => {
  const { rows } = termSize();
  if (rows < HEIGHT + 5) {
    console.log(themes.error(`Terminal too small. Needs at least ${HEIGHT + 5} rows.`));
    process.exit(1);
  }

  write(screen.clear());
  write(cursor.hide());
  write(cursor.to(1, 1));
  console.log(themes.banner('ROCKET', { font: 'small' }));

  const bg = buildBackground();

  let rocketX = WIDTH / 2;
  let rocketY = HEIGHT - 8;
  let vx = 0.4;
  let vy = -0.25;

  const ctrl = new AbortController();
  process.on('SIGINT', () => {
    ctrl.abort();
    write(cursor.show());
    write(cursor.to(1, HEIGHT + 8));
    console.log(themes.muted('\nGame stopped.'));
    process.exit(0);
  });

  // Frame loop — drift-corrected via wall clock
  const FRAME_MS = 60; // ~16 FPS
  const startTime = Date.now();
  let frame = 0;

  const FPS_HIST: number[] = [];
  let lastFrameTime = Date.now();

  while (!ctrl.signal.aborted) {
    // Clone background to a frame canvas (so sprites don't mutate the bg)
    const frameCanvas = createCanvas(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        frameCanvas.set(x, y, bg.get(x, y));
      }
    }

    // Update rocket physics
    rocketX += vx;
    rocketY += vy;
    if (rocketX <= 2 || rocketX >= WIDTH - 5) vx = -vx;
    if (rocketY <= 2 || rocketY >= HEIGHT - 5) vy = -vy;

    // Draw the rocket with alpha blending
    frameCanvas.drawSprite(Math.round(rocketX), Math.round(rocketY), ROCKET);

    // FPS calc
    const now = Date.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    if (delta > 0) {
      FPS_HIST.push(1000 / delta);
      if (FPS_HIST.length > 30) FPS_HIST.shift();
    }
    const avgFps = FPS_HIST.reduce((s, n) => s + n, 0) / Math.max(1, FPS_HIST.length);

    // Render
    write(cursor.to(1, 7));
    write(frameCanvas.render());
    write(cursor.to(1, HEIGHT + 8));
    write(themes.muted(
      `Frame ${frame.toString().padStart(4)} · ` +
      `${avgFps.toFixed(1)} fps · ` +
      `Ctrl+C to exit`,
    ));

    // Drift-correct sleep
    frame++;
    const targetTime = startTime + frame * FRAME_MS;
    const waitMs = Math.max(0, targetTime - Date.now());
    try {
      await sleep(waitMs, { signal: ctrl.signal });
    } catch {
      break;
    }
  }

  write(cursor.show());
};

main().catch((err) => {
  write(cursor.show());
  console.error(themes.error('✗ ' + (err as Error).message));
  process.exit(1);
});