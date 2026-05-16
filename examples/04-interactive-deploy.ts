// ─────────────────────────────────────────────
//  EXAMPLE 4 — Interactive prompt with menu + multi-loader
//
//  Demonstrates:
//   - components.menu (interactive arrow-key navigation)
//   - MENU_CANCELLED handling
//   - loader.multi() — concurrent named operations
//   - configure() side effects + onConfigChange
//   - Theme switching at runtime
//   - createTheme() for isolated theme instances
//
//  Walks the user through choosing a theme, then runs parallel
//  "deployment" operations under a multi-loader.
//
//  Run:
//    npx ts-node examples/04-interactive-deploy.ts
// ─────────────────────────────────────────────

import {
  components,
  loader,
  themes,
  createTheme,
  configure,
  onConfigChange,
  sleep,
  MENU_CANCELLED,
} from '../dist/index.js';

const main = async (): Promise<void> => {
  // ── Subscribe to config changes globally ──
  const offChange = onConfigChange((c) => {
    // Each time the theme changes, the global `themes` follows automatically
    // thanks to configure() side effects. We just log it.
    console.log(themes.muted(`  [config] theme=${c.theme} colorMode=${c.colorMode}`));
  });

  // ── Step 1: Banner ─────────────────────────────
  console.log();
  console.log(themes.banner('DEPLOY', { font: 'small' }));
  console.log(components.section(themes.primary('Configure deployment'), { width: 60 }));
  console.log();

  // ── Step 2: Pick a theme via menu ─────────────
  console.log(themes.text('Select a theme for the output:'));
  console.log();

  const themeChoices = ['dracula', 'nord', 'monokai', 'matrix', 'cyberpunk'];
  const choice = await components.menu(themeChoices, {
    title: '  Available themes',
    pointer: '▸',
  });

  if (choice === MENU_CANCELLED) {
    console.log();
    console.log(themes.warning('⚠ Cancelled by user'));
    offChange();
    return;
  }

  const themeName = themeChoices[choice as number]!;
  configure({ theme: themeName });
  console.log();
  console.log(themes.accent(`✓ Theme set to ${themeName}`));
  console.log();

  // ── Step 3: Pick deployment regions (multi-select) ──
  const regionChoices = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1', 'sa-east-1'];
  console.log(themes.text('Select target regions (Space to toggle, Enter to confirm):'));
  console.log();

  const regions = await components.menu(regionChoices, {
    title: '  Regions',
    pointer: '▸',
    multiSelect: true,
  });

  if (regions === MENU_CANCELLED) {
    console.log();
    console.log(themes.warning('⚠ Cancelled by user'));
    offChange();
    return;
  }

  const selectedRegions = (regions as number[]).map((i) => regionChoices[i]!);
  if (selectedRegions.length === 0) {
    console.log(themes.warning('⚠ No regions selected — aborting'));
    offChange();
    return;
  }

  console.log();
  console.log(components.box(
    themes.primary('Plan:') + '\n' +
    selectedRegions.map((r) => `  • ${r}`).join('\n'),
    { borderStyle: 'rounded', padding: 1 },
  ));
  console.log();

  // ── Step 4: Multi-loader for parallel deployments ──
  console.log(themes.text('Starting parallel deployments...'));
  console.log();

  const m = loader.multi();
  const items = selectedRegions.map((region) => {
    const item = m.add(`Deploying to ${region}`, { color: '#48dbfb' });
    return { region, item };
  });

  // Run each region in parallel
  await Promise.all(items.map(async ({ region, item }) => {
    // Stage 1: build
    item.update(`[${region}] Building image...`);
    await sleep(400 + Math.random() * 600);

    // Stage 2: upload
    item.update(`[${region}] Uploading...`);
    await sleep(600 + Math.random() * 800);

    // Stage 3: switch
    item.update(`[${region}] Switching traffic...`);
    await sleep(300 + Math.random() * 400);

    // Random failure chance for one region
    if (Math.random() < 0.15) {
      item.fail(`[${region}] Failed: health check timeout`);
    } else {
      item.succeed(`[${region}] Live`);
    }
  }));

  // Wait for the multi-loader to settle (final renders)
  await sleep(150);

  // ── Step 5: Multi-tenant theme demo ───────────
  // Create an isolated theme instance for the summary
  // (does not affect global state)
  const summary = createTheme('matrix');

  console.log();
  console.log(components.section(summary.primary('Deployment summary'), { width: 60 }));
  console.log();

  console.log(components.timeline(
    selectedRegions.map((r) => ({
      label: `Deployed to ${r}`,
      time: new Date().toLocaleTimeString(),
      done: true,
    })),
  ));

  console.log();
  console.log(summary.muted('Global theme remains: ' + themes.current().name));
  console.log(summary.muted('Isolated summary theme: ' + summary.current().name));
  console.log();

  offChange();
};

main().catch((err) => {
  console.error(themes.error('✗ ' + (err as Error).message));
  process.exit(1);
});