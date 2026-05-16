// ─────────────────────────────────────────────
//  EXAMPLE 2 — Real-time dashboard with live updates
//
//  Demonstrates:
//   - frames.live() for sticky bottom-of-screen UI
//   - components.progressBar with gradient
//   - components.table for data display
//   - onResize listener for responsive layout
//   - throttle for rate-limited updates
//   - AbortSignal cleanup
//
//  Run:
//    npx ts-node examples/02-live-dashboard.ts
// ─────────────────────────────────────────────

import {
  themes,
  components,
  frames,
  onResize,
  throttle,
  termSize,
  sleep,
  cursor,
  screen,
  write,
} from '../dist/index.js';

interface Stat {
  service: string;
  status:  'up' | 'down' | 'pending';
  latency: number;
  load:    number; // 0..100
}

// Simulated metrics that drift over time
const stats: Stat[] = [
  { service: 'api-gateway',  status: 'up',      latency: 14, load: 32 },
  { service: 'auth-service', status: 'up',      latency: 22, load: 58 },
  { service: 'database',     status: 'pending', latency: 0,  load: 0  },
  { service: 'cdn-edge',     status: 'up',      latency: 8,  load: 18 },
  { service: 'cache-layer',  status: 'up',      latency: 3,  load: 71 },
];

const drift = (): void => {
  for (const s of stats) {
    if (s.status === 'pending') {
      // Pending services come online randomly
      if (Math.random() < 0.1) {
        s.status = 'up';
        s.latency = 10 + Math.floor(Math.random() * 30);
      }
    } else if (s.status === 'up') {
      // Slight load + latency wander
      s.load = Math.max(0, Math.min(100, s.load + (Math.random() - 0.5) * 8));
      s.latency = Math.max(1, s.latency + (Math.random() - 0.5) * 3);
      // Tiny chance of going down
      if (Math.random() < 0.005) s.status = 'down';
    }
  }
};

const renderFrame = (): string => {
  const { cols } = termSize();
  const innerWidth = Math.max(40, Math.min(cols - 4, 80));

  // ── Header with theme gradient ──
  const title = themes.banner('STATUS', { font: 'small', perCharColor: false });

  // ── Service rows ──
  const rows: string[][] = [
    ['Service', 'Status', 'Latency', 'Load'],
    ...stats.map((s) => {
      const statusIcon =
        s.status === 'up'      ? themes.accent('● up')
      : s.status === 'down'    ? themes.error('● down')
                               : themes.warning('● pending');

      const latencyStr = s.status === 'up'
        ? (s.latency < 20 ? themes.accent : s.latency < 50 ? themes.warning : themes.error)
            (`${s.latency.toFixed(0)}ms`)
        : themes.muted('—');

      const loadBar = s.status === 'up'
        ? components.progressBar(s.load, {
            width: 20,
            gradient: ['#00ff88', '#fdcb6e', '#ff6b6b'],
            showPercentage: true,
          })
        : themes.muted('—');

      return [s.service, statusIcon, latencyStr, loadBar];
    }),
  ];

  const table = components.table(rows, { borderStyle: 'rounded', maxColWidth: innerWidth / 4 });

  // ── Footer ──
  const upCount   = stats.filter((s) => s.status === 'up').length;
  const downCount = stats.filter((s) => s.status === 'down').length;
  const footer = themes.muted(
    `${upCount} up · ${downCount} down · ${stats.length} total · ` +
    `${cols}×${termSize().rows} terminal · Ctrl+C to exit`,
  );

  return [title, '', table, '', footer].join('\n');
};

const main = async (): Promise<void> => {
  // Hide cursor while live UI runs
  write(cursor.hide());

  // Throttled resize redraw — coalesce rapid resize events into one render
  const onAnyResize = throttle(() => {
    // Frame engine will pick up the new size on its next tick
  }, 100);
  const offResize = onResize(onAnyResize);

  // Start live engine at 4 fps (smooth but not CPU-hungry)
  const live = frames.live({ fps: 4, autoStart: true });

  // Drift loop
  const ctrl = new AbortController();
  process.on('SIGINT', () => {
    ctrl.abort();
    live.stop({ clear: false });
    offResize();
    write(cursor.show());
    write('\n');
    console.log(themes.muted('Dashboard stopped.'));
    process.exit(0);
  });

  try {
    while (!ctrl.signal.aborted) {
      drift();
      live.update(renderFrame());
      await sleep(250, { signal: ctrl.signal });
    }
  } catch {
    // Aborted — fall through to cleanup
  } finally {
    live.stop({ clear: false });
    offResize();
    write(cursor.show());
  }
};

main().catch((err) => {
  console.error(themes.error('✗ ' + (err as Error).message));
  process.exit(1);
});