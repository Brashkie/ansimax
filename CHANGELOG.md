# Changelog

All notable changes to **ansimax** are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [1.1.1] — bug fixes + improved examples

Patch release with two bug fixes from real-world testing of v1.1.0, plus
a cleaner set of examples covering every public API.

### Fixed

- **`box()` no longer crashes with object padding.** Previously, calling
  `box(text, { padding: { x: 2, y: 1 } })` threw `RangeError: Invalid
  array length` because the code assumed `padding` was always a number.
  Now non-numeric padding falls back to the default (`1`) gracefully.
  The fix also covers `NaN`, `Infinity`, strings, and other malformed
  input.
- **`components.menu()` cursor restoration on abrupt exit.** Previously,
  killing the process while a menu was active (Ctrl+C, kill signal)
  left the terminal cursor hidden because the cleanup handler only ran
  through the normal menu lifecycle. Now `SIGINT`, `SIGTERM`, and
  `exit` events trigger an emergency cursor restoration, so the terminal
  is always left in a sane state.

### Changed — Examples

- Replaced all examples in `/examples` with a clean set covering every
  public API:
  - `01-quick-smoke.ts` — verifies major imports
  - `02-colors-gradients.ts` — color fns, gradients, `colorPresets`
  - `03-ascii-banners.ts` — banners + 6 box styles + dividers
  - `04-trees.ts` — builder + plain-data + 4 styles + algorithms
  - `05-components.ts` — tables, badges, status, timeline, etc.
  - `06-pixel-art.ts` — sprites + canvas + transforms
  - `07-animations.ts` — typewriter, fade, slide, pulse, wave, glitch
  - `08-loaders.ts` — spinners + tasks + countdown
  - `09-themes.ts` — 8 themes + listeners + isolation
  - `10-everything.ts` — comprehensive showcase
  - `all-in-one.mjs` — ESM (`import`) version, no TypeScript
  - `all-in-one.cjs` — CommonJS (`require`) version, no TypeScript
- All examples now import from `'ansimax'` (npm registry) instead of
  `'../src/index.js'`, making them copy-pasteable into user projects.
- READMEs updated with animations + loaders preview GIFs in the
  header, and an `all-ansimax.gif` showcase near the footer.

### Notes

- No API changes — `1.1.1` is a drop-in replacement for `1.1.0`.
- No new dependencies — still zero runtime deps.
- All 1848 tests still pass.

---

## [1.1.0] — comprehensive hardening + new features

A massive robustness pass across every module, plus a new `trees` module,
new API surfaces, and broader test coverage (~1700+ tests across 16 suites).

**Backwards compatibility:** 100% preserved. All existing APIs work
identically — only defensive validation, new features, and bug fixes.

---

### Added — Trees (`trees/index.ts`) — NEW MODULE

Hierarchical text renderer inspired by Rich's `Tree`.

- **Builder API** — `tree('root').add('child').add('grandchild')`. `addLeaf()` returns the parent for fluent sibling-adds.
- **Plain-data API** — `renderTree({ label, children: [...] })` accepts any plain JS object.
- **4 visual styles** — `'normal'`, `'rounded'` (╰─), `'heavy'` (┣━), `'ascii'` (`+--`). Per-node `style` override mixes styles in one tree.
- **Per-node colors** — `color: ColorFn` colorizes the label.
- **Depth-based palette** — `palette: [color1, color2, ...]` cycles colors per depth level. Per-node `color` overrides.
- **Guide-line colors** — `guideColor` colorizes the `├──`/`│`/`└──` chars separately from labels.
- **Per-node icons** — `icon: '📁'` renders before the label.
- **Multi-line labels** — extra lines align with proper continuation glyph. CRLF normalized to LF.
- **Collapsed subtrees** — `collapse: N` hides the first N children, shows `[+N hidden]`.
- **Max depth truncation** — `maxDepth` truncates deep trees, shows `[+N more]` markers.
- **Indent option** — pad the entire tree with N leading spaces.
- **`renderTreeStream(root, opts)`** — generator that yields one rendered line at a time.
- **`measureTree(root, opts)`** — `{ width, height }` for layout decisions.
- **`walkTree(root, visitor)`** — depth-first traversal with cycle detection.
- **`findInTree(root, predicate)`** — locate first matching node.
- **`countNodes(root)`** — total node count.
- **`mapTree(root, fn)`** — transform every node, returns new tree (input untouched).
- **`filterTree(root, predicate, opts?)`** — keep matching nodes with optional `prune` mode.
- **Cycle detection** — `walkTree` / `mapTree` throw a clear error on circular references instead of stack overflow.
- **Strict validation** — non-string labels coerced, null/array root rejected.

### Added — Configuration (`configure.ts`)

- **`onConfigKeyChange(key, listener)`** — subscribe to changes of a specific config key only. Listener fires with `(newValue, oldValue)`.
- **`pauseListeners()`/`resumeListeners()`** — batch multiple updates without flooding subscribers; resume flushes a single notification.
- **`withConfig(overrides, fn)`** — temporarily override config for a sync or async block, restoring previous state automatically (even on throw).
- **`strict` mode** — `configure(opts, { strict: true })` rejects unknown keys with `RangeError`; useful for catching typos in config files.
- **`DEFAULTS` exported** — `Object.freeze`d, accessible to consumers as `CONFIG_DEFAULTS`.
- **No-op detection** — `configure({})` or setting unchanged values no longer fires listeners.
- **Soft theme fallback** — uses `themes.tryUse` instead of `themes.use` so configure() doesn't throw on themes registered later.
- **Validation hardening** — `null`/array opts rejected, empty-string `theme`/`locale`/`asciiFont` rejected.

### Added — Colors (`colors/index.ts`)

- **Adaptive escape cache** — `_fgEscCache` / `_bgEscCache` packed-RGB keyed, bounded LRU (512 entries). Gradient animations now 10–50× faster on repeated colors.
- **`clearColorCache()`** exported for tests and post-level-change cleanup.
- **`registerPreset(name, stops)`** — register custom gradient presets accessible via `color.<name>`.
- **`listPresets()`** — runtime list of available presets.
- **Reserved-preset guard** — registering presets with names like `bold`, `red`, `gradient` throws with a clear conflict message.
- **Text coercion** — `color.red(42)` now returns `"\x1b[31m42\x1b[0m"` (chalk/kleur compatibility).
- **NaN/Infinity-safe RGB** — `Infinity → 255`, `-Infinity → 0`, `NaN → 0` in `clampRgb`/`clamp256`.
- **`compose` filters non-functions** — `compose(red, null, bold)` works (null silently ignored).
- **`compose` swallows extractor errors** — user fns that throw on `extractOpen` skipped.
- **`gradient` single-stop colors statically** — consistent with CSS `linear-gradient` UX.
- **`gradient` defensive** — null/undefined/empty stops return text unchanged. Non-string text coerced. Grapheme iteration preserves emoji.
- **Bare `\x1b` literal in gradient** — malformed ANSI doesn't corrupt output.

### Added — Themes (`themes/index.ts`)

- **Per-instance isolation** — `createTheme()` instances have their own registry. Registering a theme on one no longer leaks into others. Critical for multi-tenant SSR.
- **`tryUse(name)`** — tolerant theme switch returning `boolean` instead of throwing.
- **`onChange(listener)`** — subscribe to theme changes, returns unsubscribe. Errors swallowed.
- **`unregister(name)`** — remove themes, throws if removing the active one.
- **Background color helpers** — `bgPrimary`, `bgSecondary`, `bgAccent`, `bgSuccess`, `bgWarning`, `bgError`, `bgInfo`, `bgMuted`, `bgSurface`.
- **`success` color with fallback** — built-ins define it; user themes without `success` fall back to `accent`.
- **`style(name)` dynamic accessor** — `theme.style('primary')(text)` for config-driven styling. Identity fn for unknown names (no throw).
- **HEX_RE consistent** — `#` optional, matches colors module.
- **Strict validation** — `register()` rejects non-string/empty names, null/array defs, non-array gradient, short gradient (< 2 stops).
- **`BannerOpts` interface** — explicit type instead of fragile `Omit<Parameters<...>>` derivation.

### Added — Animations (`animations/index.ts`)

- **Crash-safe cursor restore** — `exit/SIGINT/SIGTERM` handlers force-restore cursor even on uncaught exceptions.
- **Reference-counted `hideCursor`/`showCursor`** — concurrent animations don't reveal the cursor early.
- **`animate.delay(ms)` helper** — compatible with `sequence`/`chain`. Pause respecting signal.
- **`animate.parallel({ timeout })`** — race steps against a timeout to prevent hangs.
- **`animate.parallel` swallows per-step errors** — one failing step doesn't reject the whole Promise.all.
- **Signal propagation** — parallel steps receive the parent signal.
- **`wave` with single color** — renders statically with that color (better UX than skip).
- **`wave` with empty palette** — renders plain.
- **`reveal` with `steps` option** — scales with text length by default (`Math.min(60, Math.max(10, len*2))`).
- **`pulse`/`glitch` final write use `safeWriteAsync`** — backpressure-aware.
- **`safeWriteAsync`/`safeWrite`** wrappers swallow stream errors.
- **Hooks errors swallowed** — `onFrame`/`onDone`/`onAbort` errors don't break the loop.

### Added — ASCII (`ascii/index.ts`)

- **Strict input validation** — `ensureString()` throws `TypeError` with clear messages for non-string text.
- **`ensureFontMap` validates type** — rejects null/array/non-object font maps.
- **`hasFont(name)`** — check if a font is registered without throwing.
- **`measure(text, font?, letterSpacing?)`** — get `{ width, height }` without paying full render cost.
- **`stream(text, { signal })`** — pre-aborted yields nothing; aborted mid-stream stops at next poll.
- **Cache key uses `\u0001` separator** — eliminates collision risk from font names containing `|`.
- **Grapheme iteration** in `renderFont` — preserves surrogate pairs and emoji.
- **`box`/`divider`/`logo` defensive** against -Infinity from `Math.max([])`, width 0, empty text.
- **`colorEachVisibleChar` bare `\x1b` literal** — non-CSI escapes emitted instead of consumed.

### Added — Loaders (`loaders/index.ts`)

- **`spin` coerces non-string text/prefix/suffix**.
- **`spin` clamps NaN interval** to default 80.
- **`progress` clamps NaN/Infinity percent** to 0.
- **`progress` empty-char fallback**.
- **`countdown(NaN)` → 0**, negative → 0.
- **`tasks(non-array)` → `[]`** instead of crash.

### Added — Frames (`frames/index.ts`)

- **Reference-counted cursor** — concurrent `play()` + `live()` + animations safe.
- **`registerCrashHandlers()`** — restore cursor on exit/SIGINT/SIGTERM.
- **`resetFramesCursorCount()`** exported for tests.
- **`play(non-array)`** — no-op controller instead of crash.
- **`play({ repeat: 0 })`** — explicit infinite loop.
- **`play({ repeat: -N })`** — negative now falls back to 1 (was infinite — dangerous on bad input).
- **`fps` capped at 60** — prevents CPU saturation with `fps: 9999`.
- **`generate` swallows per-frame errors** — one bad frame doesn't poison the sequence.
- **`generate` coerces non-string returns**.
- **`morph(steps=1)` clamps to 2** — avoids division by zero.
- **All presets defensive** — width=0 OK, NaN fallback, empty char fallback.
- **`live` with stop() idempotent** — multiple stops safe via `wasRunning` flag.

### Added — Components (`components/index.ts`)

- **`progressBar(NaN/Infinity)` → 0%** — defensive numeric inputs.
- **`progressBar` with single-stop gradient** — colors statically (consistent with `gradient()` UX).
- **`badge` SGR codes validated** — NaN fg/bg falls back to defaults.
- **`table(non-array)` → `''`**, filters non-array rows, coerces non-string cells.
- **`columns(cols<1)` clamps to default** — no longer throws.
- **`columns(non-array)` → `''`**.
- **`timeline(non-array)` → `''`**, coerces event labels.
- **`section(NaN width)` falls back to terminal cols**.
- **`status({ icon: '' })` omits icon** — coherent with `icon: null`.
- **`menu([])` returns `MENU_CANCELLED`** instead of throwing (safer for runtime data).
- **`menu(non-array)` → `MENU_CANCELLED`**.
- **`menu` cleanup symmetric** — every path that hides cursor also restores it.
- **`menu` `safeResolve` prevents double-resolve** races.

### Added — Images (`images/index.ts`)

- **All numeric inputs clamped** — `MAX_DIMENSION = 10000` prevents OOM on `Infinity`.
- **`renderPixelArt(non-array)` → `''`** instead of crash.
- **`ensurePixelGrid`** filters malformed rows.
- **`flipHorizontal`/`flipVertical`/`rotate90` defensive** — non-array input returns `[]`.
- **`gradientRect` validates colors array** — clear errors for empty/all-invalid.
- **`gradientRect` single-stop renders solid fill** — better UX.
- **`gradientRect(Infinity width)` clamps** to MAX_DIMENSION.
- **`createCanvas(NaN/0)` → 1×1**.
- **`createCanvas(Infinity)`** clamps to MAX_DIMENSION.
- **`canvas.set/get` reject non-finite coords** as no-op.
- **`canvas.drawRect/Circle/Sprite` defensive** against NaN, negative dims, non-array sprites.
- **`canvas.pixels` getter returns deep clone** — callers can't mutate canvas state.
- **`canvas.print` with try/catch** — stream torn down doesn't crash.
- **ANSI cache LRU bounded** at 1024 entries — survives massive color counts.
- **`Pixel` and `PixelGrid` exported** for typed consumers.

### Added — Utils (`utils/ansi.ts`)

- **`OSC`, `ST`, `BEL` constants** exported.
- **`setTitle(text)`** — set terminal window title (OSC 2). Control chars stripped.
- **`link(text, url)`** — clickable hyperlink (OSC 8). Supported in iTerm2, Terminal.app, WezTerm, Kitty, modern xterm.
- **`bell()`** — terminal bell.
- **`cursor.position()`** — query position (CSI 6n).
- **`cursor.nextLine()`/`prevLine()`** — line-aware navigation.
- **`screen.clearAll()`** — alias for `clear()`.
- **`DEFAULT_TERM_COLS = 80`, `DEFAULT_TERM_ROWS = 24`** exported.
- **`writeAsync({ timeout })`** option — prevents infinite hangs on broken streams.
- **`OutputBuffer.pushIf(cond, str)`** — conditional append.
- **`detectColorSupport`** improved — TERM truecolor/24bit detection, 256 substring match, rxvt support, try/catch around `os.release()`.
- **All numeric inputs clamped** — `cursor.up(NaN)` → min=1, `fgRgb(Infinity, ...)` → 0.
- **`ensureString` coercion** — all writes accept any input.
- **`sleep(NaN/negative)` clamped** to 0.

### Added — Utils (`utils/helpers.ts`)

- **`once(fn)`** — invoke a function exactly once.
- **`escapeRegex(str)`** — escape regex metacharacters.
- **`safeJson(value, indent?)`** — JSON.stringify handling BigInt and circular references.
- **`padBoth(str, width, ch?)`** — pad both sides equally, Unicode-aware.
- **`nextTick(cb)`** — `setImmediate` fallback to `setTimeout(0)`.
- **`memoize` with `{ keyFn }` option** — multi-argument memoization.
- **`onResize` with implicit throttle (50ms default)** — coalesces rapid resize events.
- **`debounce` with `maxWait` option** — guarantees invocation within window.
- **`diffLines` with `type: 'added' | 'removed' | 'changed'`** — richer damage tracking.
- **`gradientColor` auto-clamps `t`** — values outside [0,1] clamped automatically. NaN → 0.
- **`stripAnsi`/`visibleLen` defensive** against non-string inputs.
- **`termSize` validates** cols/rows > 0.

---

### Test infrastructure

- **~1700+ tests across 16 suites**, all green.
- Coverage: ~98% statements, ~95% branches, ~99% functions, ~99% lines.
- All test files use `FORCE_COLOR=3` + `resetColorSupportCache()` in `beforeEach` for isolation.
- New test isolation helpers exported: `resetCursorRefCount`, `resetFramesCursorCount`, `resetLoaderCursorCount`, `clearAnsiCache`, `clearThemeColorCache`, `clearColorCache`, `clearRenderCache`, `resetConfig`.

### Examples

6 production-grade examples in `/examples`:

- `01-cli-installer.ts` — npm-create style installer (banner + hierarchical tasks + status icons + summary box).
- `02-live-dashboard.ts` — real-time dashboard (frames.live + service table + gradient bars + onResize + SIGINT cleanup).
- `03-pixel-art-game.ts` — bouncing rocket sprite (canvas + alpha blending + sunset gradient + FPS counter + drift-corrected loop).
- `04-interactive-deploy.ts` — interactive menu + multi-select + loader.multi + createTheme + onConfigChange.
- `05-tree-visualizations.ts` — filesystem + dependency + JSON + decision trees (4 scenarios, walk + measure bonus).
- `06-everything-together.ts` — comprehensive showcase touching every module (NEW).

---

## [1.0.0] — initial release

- Core modules: `color`, `animate`, `ascii`, `loader`, `frames`, `components`, `themes`, `images`, `configure`.
- TypeScript types exported.
- Adaptive color rendering (NO_COLOR / FORCE_COLOR / TTY detection).
- AbortSignal support across all blocking APIs.
- 750+ tests, 85%+ coverage.
