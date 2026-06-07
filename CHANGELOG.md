# Changelog

All notable changes to **ansimax** are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [1.2.7] — Bug fixes + robustness

Patch release focused on edge case handling, better error messages, and
defensive coding. No breaking changes — every 1.2.x program runs identically.

### Fixed

- **`ascii.fromImage()` silently accepted `width: 0`, `NaN`, `Infinity`** —
  now returns an empty string explicitly. Previously it would clamp to 1
  and produce a single-character-wide output, which was confusing:

  ```js
  // Before (v1.2.6 and earlier):
  ascii.fromImage(pixels, { width: 0 });      // → 1-char-wide output 😞
  ascii.fromImage(pixels, { width: NaN });    // → 1-char-wide output 😞

  // Now (v1.2.7):
  ascii.fromImage(pixels, { width: 0 });      // → '' (explicit)
  ascii.fromImage(pixels, { width: NaN });    // → ''
  ascii.fromImage(pixels, { width: -10 });    // → ''
  ascii.fromImage(pixels, { width: 1 });      // → still works, 1-char wide
  ```

  Same validation applies to `height` when explicitly set.

- **`ascii.figletText('', font)` returned `font.height - 1` empty lines**
  instead of an empty string. Now returns `''` immediately.

- **`ascii.fromImage()` could crash on non-rectangular grids** (rows of
  different widths) because `_resizePixels` assumed all rows had the same
  length as the first row. Now each row is sampled by its actual width,
  with missing pixels coalesced to `null` (the standard "transparent"
  marker).

### Improved — Error codes everywhere

Errors thrown by the ASCII module now carry stable `.code` properties for
programmatic catching:

| Function | Error condition | `.code` |
|---|---|---|
| `parseFiglet` | non-string / empty input | `ANSIMAX_INVALID_FIGLET_INPUT` |
| `parseFiglet` | unrecognized header | `ANSIMAX_INVALID_FIGLET_HEADER` |
| `parseFiglet` | non-positive height | `ANSIMAX_INVALID_FIGLET_HEIGHT` |
| `ascii.registerFont` | empty name | `ANSIMAX_INVALID_FONT_NAME` |
| `ascii.registerFont` | reserved name without `force` | `ANSIMAX_RESERVED_FONT_NAME` |

Error messages also include a debug snippet for `parseFiglet` header
errors (truncated at 60 chars), so you immediately see what was wrong.

### Notes

- Error message text may have changed slightly — if you were matching exact
  strings in tests, switch to `.code` checks (which are stable forever)
- All 1983 + 17 new tests pass
- No new runtime dependencies — still zero

---

## [1.2.6] — ASCII module improvements

Patch release focused on ASCII module quality and feature additions. No
breaking changes — every 1.2.x program runs identically.

### Added — 4 new built-in ramps

`ASCII_RAMPS` now includes 4 additional ramps for different aesthetic styles:

```js
import { ASCII_RAMPS, ascii } from 'ansimax';

ASCII_RAMPS.binary    // ' █'         — pure 2-char ramp
ASCII_RAMPS.dots      // ' ⠁⠃⠇⠧⠷⡷⣷⣿' — Unicode braille (sparse aesthetic)
ASCII_RAMPS.shades    // ' ⠁⠃⠇⠧⠷⡷⣷⣿█' — combined shading
ASCII_RAMPS.ascii64   // 64-char printable ASCII — non-Unicode terminals

ascii.fromImage(pixels, { ramp: 'shades' });
ascii.fromImage(pixels, { ramp: 'binary', bgColor: true });  // photo-like effect
```

### Added — `bgColor` option in `fromImage`

Render the source pixel's color as the **background** instead of the foreground.
Pairs especially well with `ramp: 'binary'` for a photo-like effect where each
character cell becomes a colored block:

```js
ascii.fromImage(pixels, {
  width: 80,
  bgColor: true,        // colors go on background
  ramp: 'binary',       // chars are spaces/blocks
});
```

Implies `color: true` — no need to set both.

### Added — `brightness` and `contrast` in `fromImage`

Pre-adjust the image's tonal range without modifying the source pixels:

```js
ascii.fromImage(pixels, {
  width: 80,
  brightness: 0.2,    // [-1, 1] — positive = lighter, negative = darker
  contrast: 0.3,      // [-1, 1] — positive = boosted, negative = flattened
});
```

Useful for tuning hard-to-read photos without re-processing the source.
Values are clamped to `[-1, 1]`. Default `0` (no change, identical to v1.2.5).

### Added — `kerning` option in `figletText`

Control horizontal spacing between FIGfont glyphs:

```js
ascii.figletText('HELLO', font, {
  kerning: 1,    // 1-space gap between each character glyph
});
```

Default `0` (touching glyphs, matches previous behavior).

### Added — Multi-line `figletText`

`figletText` now handles `\n` in input — each line renders as a separate
FIGfont block:

```js
ascii.figletText('LINE 1\nLINE 2', font, {
  lineSpacing: 1,   // 1 blank line between rendered lines
});
```

Single-line text takes a fast path (no behavior change for v1.2.5 callers).

### Improved

- Better JSDoc on `ASCII_RAMPS` with `@example` showing every ramp
- Brightness/contrast use standard photo-editing formulas (linear stretch around midpoint)
- All 1958 + 25 new tests pass

### Notes

- No new runtime dependencies — still zero
- Drop-in replacement for `1.2.5`

---

## [1.2.5] — Phase 3 closure: image-to-ASCII engine

Minor release closing the **ASCII engine roadmap (Phase 3)** with five
new capabilities. All additions are fully backwards-compatible — existing
code runs identically.

### Added — `ascii.fromImage(pixels, opts)` — image-to-ASCII converter

Convert a `PixelGrid` (from `ansimax.images`) into ASCII art. Five
features in one call:

```ts
import { ascii } from 'ansimax';

console.log(ascii.fromImage(pixels, {
  width: 80,
  ramp: 'detailed',          // 'standard' | 'detailed' | 'blocks' | 'simple' | custom string
  invert: false,
  dither: 'floyd-steinberg', // 'none' | 'floyd-steinberg'
  edgeDetect: 'sobel',       // 'none' | 'sobel'
  edgeThreshold: 40,
  color: true,               // preserve source colors
  faceMode: false,           // histogram stretch for portraits
}));
```

**Aspect-ratio aware**: terminal cells are ~2× as tall as wide, so the
output height is auto-halved to maintain visual proportion (override
with `height`).

**Zero-dependency**: input is a `PixelGrid` (one Pixel per cell). Users
of `sharp`, `jimp`, or any decoder convert their output to `PixelGrid`
once, then call `ascii.fromImage()`.

### Added — `ASCII_RAMPS` — pre-built character ramps

Four curated character ramps, ordered dark → light, exported as a
read-only object:

```ts
ASCII_RAMPS.standard   // ' .:-=+*#%@'           — balanced 10-char (default)
ASCII_RAMPS.detailed   // 70-char Paul Bourke    — max detail
ASCII_RAMPS.blocks     // ' ░▒▓█'                — looks like a real photo
ASCII_RAMPS.simple     // ' .+#'                 — minimal 4-char
```

Or pass any custom string as the `ramp` option for full control.

### Added — Sobel edge detection

Set `edgeDetect: 'sobel'` to render edges instead of luminance. Useful
for line-art effects or technical diagrams:

```ts
console.log(ascii.fromImage(pixels, {
  width: 100,
  edgeDetect: 'sobel',
  edgeThreshold: 50,    // tune for noise/detail balance
  ramp: 'blocks',
}));
```

### Added — Floyd-Steinberg dithering

Set `dither: 'floyd-steinberg'` for error-diffusion dithering. Produces
smoother tonal gradients in photos. Most useful with shorter ramps:

```ts
ascii.fromImage(pixels, {
  width: 80,
  ramp: 'simple',
  dither: 'floyd-steinberg',
});
```

### Added — Face mode

Set `faceMode: true` to apply histogram stretching ([10%, 90%] percentile
remap to [0, 255]). Boosts midtone contrast where facial features live,
producing better results on portraits:

```ts
ascii.fromImage(portraitPixels, {
  width: 60,
  ramp: 'detailed',
  faceMode: true,
});
```

### Added — Figlet (.flf) font support

Parse and render with community FIGfonts (250+ available at
[figlet.org](http://www.figlet.org/fontdb.cgi)):

```ts
import { readFileSync } from 'node:fs';
import { parseFiglet, ascii } from 'ansimax';

const fontStr = readFileSync('./standard.flf', 'utf8');
const font = parseFiglet(fontStr);

console.log(ascii.figletText('Hello!', font, {
  trim: true,
  colorFn: (t) => t,  // optional colorize
}));
```

Returns a `FigletFont` object containing the parsed glyphs. Renders
ASCII 32-126; unknown chars fall back to space.

### Added — Type exports

`AsciiRamp`, `FromImageOptions`, `FigletFont`, `FigletOptions` — all
exported from the main barrel.

### Notes

- Phase 3 of the [roadmap](README.md#%EF%B8%8F-roadmap) is now **fully complete**.
- Image decoding (PNG/JPEG → PixelGrid) is intentionally **not** included;
  users pair ansimax with `sharp`/`jimp`/`pngjs` to keep zero deps.
- 1914 + 30 new tests pass.
- No new runtime dependencies — still zero.

---

## [1.2.4] — Gradient utilities + inspectability

Patch release adding gradient inspection and manipulation utilities.
No breaking changes — `createGradient()` callers from 1.2.3 continue
to work, but now have access to metadata.

### Added — `ReusableGradient` metadata

`createGradient()` now returns a `ReusableGradient` — still callable
like before, but with frozen metadata for inspection and debugging:

```ts
const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c'], {
  easing: 'ease-in',
});

// All still callable
console.log(fire('hello'));

// New: read-only inspection
fire.stops;            // → ['#ff5555', '#ffb86c', '#f1fa8c']
fire.resolvedStops;    // → [{r:255,g:85,b:85}, {r:255,g:184,b:108}, ...]
fire.defaultOptions;   // → { easing: 'ease-in' }
```

All three properties are frozen — attempting to mutate them throws in
strict mode and silently fails in sloppy mode.

### Added — `reverseGradient()` helper

Returns a new gradient with stops in reverse order. Works with both
plain arrays and `ReusableGradient` instances. Default options are
preserved when reversing a `ReusableGradient`:

```ts
const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);
const ice  = reverseGradient(fire);  // → '#f1fa8c' → '#ffb86c' → '#ff5555'

console.log(fire('warm side'));
console.log(ice('cool side'));

// Also works with plain arrays
reverseGradient(['#f00', '#0f0', '#00f']);  // → ['#00f', '#0f0', '#f00']
```

The original array / gradient is never mutated.

### Added — `presets` alias (canonical name)

Previously `presets` was exported only as `colorPresets`. Many users
referenced `presets` based on docs and got `ReferenceError`. Now both
names point to the same object:

```ts
import { presets, colorPresets } from 'ansimax';

presets === colorPresets;  // → true
```

`colorPresets` remains for backwards compatibility; new code can use
either name.

### Notes

- Coverage holds steady at ~98%.
- No new runtime dependencies — still zero.
- All 1892 + 22 new tests pass.

---

## [1.2.3] — Gradient factory + performance

Patch release adding a new performance-oriented API and refinements. No
breaking changes — every 1.2.x program runs identically.

### Added — `createGradient()` factory

A pre-resolved gradient that can be applied repeatedly to different
strings without re-parsing hex stops on every call. Significantly
faster for animation loops, frame-based rendering, and bulk colorizing:

```ts
import { createGradient } from 'ansimax';

const fire = createGradient(['#ff5555', '#ffb86c', '#f1fa8c']);

// Reuse — hex stops are pre-resolved
console.log(fire('first line'));
console.log(fire('second line'));

// Use as colorFn for ascii.banner (matches the ColorFn signature)
console.log(ascii.banner('FIRE', { colorFn: fire }));

// Per-call options still work (especially useful for animation)
for (let p = 0; p < 1; p += 0.05) {
  process.stdout.write('\r' + fire('flowing', { phase: p }));
}
```

**Performance**: hex→RGB conversion happens once at factory time. For
loops calling `gradient()` hundreds of times per frame, this can cut
gradient overhead by ~40–60% (depending on stop count).

**API surface**:
- `createGradient(stops, defaultOpts?)` returns `(text, opts?) => string`
- The returned function matches the `ColorFn` shape (compatible with
  `ascii.banner({ colorFn })`, `themes.gradient`, etc.)
- Per-call `opts` override defaults; useful for varying `phase` per frame
  while keeping the same colors/easing

### Improved

- **More JSDoc on `createGradient`** with three runnable `@example` blocks.
- All 1880 + 12 new tests pass.
- No new runtime dependencies — still zero.

---

## [1.2.2] — Quality polish

Patch release focused on API ergonomics and robustness refinements. No
breaking changes — every 1.2.x program runs identically.

### Improved

- **`animateGradient` controller is now thenable** — you can `await` it
  directly instead of `await ctrl.done`:

  ```ts
  // Before (v1.2.0)
  const ctrl = animateGradient(text, stops, { infinite: false, cycles: 1 });
  await ctrl.done;

  // After (v1.2.2) — both still work
  await animateGradient(text, stops, { infinite: false, cycles: 1 });

  // Also supports .then() / .catch() / .finally()
  animateGradient(text, stops, opts).finally(() => cleanup());
  ```

  The `.done` property remains for backwards compatibility.

- **Stable error codes for programmatic catch.** Errors thrown by the
  theme system now carry a `.code` property with the `ANSIMAX_*` prefix
  for stable programmatic filtering:

  ```ts
  try {
    themes.use('not-a-real-theme');
  } catch (e) {
    if ((e as { code?: string }).code === 'ANSIMAX_UNKNOWN_THEME') {
      // handle gracefully
    }
  }
  ```

  New codes: `ANSIMAX_INVALID_THEME`, `ANSIMAX_INVALID_THEME_NAME`,
  `ANSIMAX_UNKNOWN_THEME`. Error messages and types
  (`TypeError` / `RangeError`) are unchanged.

- **`animateGradient` is safer in sandboxed environments.** The default
  stdout-write path now checks `process?.stdout?.write` before calling
  it, so the function no longer crashes in workers, Edge runtimes, or
  embedded sandboxes that lack a writable stdout.

- **Better JSDoc on the `gradient()` function.** IntelliSense now shows
  parameter descriptions, return semantics, and three runnable
  `@example` blocks (basic, with easing, with phase animation).

- **README fix: `Easing Curves` snippet.** The v1.2.0 snippet was missing
  the `stops` variable declaration. Now copy-paste runnable.

### Notes

- 1880 + 7 new tests pass.
- No new dependencies — still zero runtime deps.
- All API additions are non-breaking and side-effect-free for existing code.

---

## [1.2.0] — Phase 2 complete: animated, eased & conic gradients

Minor release closing the **gradient engine roadmap (Phase 2)** with three
long-awaited capabilities. All additions are fully backwards-compatible —
existing `gradient()` calls work identically.

### Added — Easing curves

`gradient()` now accepts an `easing` option to control how colors are
distributed along the text. Five built-in curves plus custom functions:

```ts
gradient('hello world', ['#ff0000', '#0000ff'], { easing: 'ease-in' });
gradient('hello world', ['#ff0000', '#0000ff'], { easing: 'ease-out' });
gradient('hello world', ['#ff0000', '#0000ff'], { easing: 'ease-in-out' });
gradient('hello world', ['#ff0000', '#0000ff'], { easing: 'cubic-bezier' });

// Or pass a custom EasingFn (t → eased t, both in [0,1])
gradient('hello world', ['#ff0000', '#0000ff'], { easing: (t) => t * t * t });
```

- `linear` — even distribution (default, identical to pre-1.2.0 behavior)
- `ease-in` — concentrates colors at the end (quadratic)
- `ease-out` — concentrates colors at the start (quadratic)
- `ease-in-out` — slow at both ends, fast in middle
- `cubic-bezier` — CSS-style `ease` curve (Newton-Raphson approximated)
- Out-of-range custom easings are clamped to `[0, 1]` automatically

### Added — Phase offset (flowing colors)

`gradient()` now accepts a `phase` parameter `[0, 1)` that shifts the
gradient along the text. Combined with an animation loop, this produces
a flowing color effect:

```ts
gradient('hello', ['#ff0000', '#0000ff'], { phase: 0.5 });
// negative values wrap forward; NaN/Infinity falls back to 0
```

### Added — `animateGradient()` API

High-level API for animated gradients with proper lifecycle management:

```ts
import { animateGradient } from 'ansimax';

const ctrl = animateGradient('Loading...', ['#ff79c6', '#bd93f9', '#8be9fd'], {
  duration: 2000,
  fps: 30,
  direction: 'forward',  // or 'reverse'
  infinite: true,
});

// Later
ctrl.stop();
// Or via AbortController
const abort = new AbortController();
animateGradient('hi', stops, { signal: abort.signal });
abort.abort();
```

Returns an `AnimateGradientController` with `.stop()` and `.done` (Promise).
Supports `AbortSignal`, custom render via `onFrame`, fps cap at 60,
and direction reversal.

### Added — Conic gradients

`gradientRect()` now supports `style: 'conic'` for radial sweeps around
the center point:

```ts
import { gradientRect } from 'ansimax';

console.log(gradientRect({
  width: 30, height: 15,
  colors: ['#ff0000', '#00ff00', '#0000ff', '#ff0000'],
  style: 'conic',
  startAngle: 0,  // rotation in degrees
  dither: 'bayer',
}));
```

- `startAngle` (degrees) rotates the sweep
- Non-finite `startAngle` falls back to `0`
- Compatible with all existing options (`dither`, `braille`, `width`, `height`)

### Added — New exports

- `animateGradient` — function
- `AnimateGradientOptions` / `AnimateGradientController` — types
- `EasingName` — union type of built-in curve names
- `EasingFn` — `(t: number) => number` curve type

### Notes

- All 1848 + 30 new tests pass.
- Backwards-compatible: existing `gradient()` calls work identically.
- No new runtime dependencies.
- Phase 2 of the [roadmap](README.md#%EF%B8%8F-roadmap) is now **fully complete**.

---

## [1.1.2] — maturity & robustness

Patch release focused on maturity: better error semantics, defensive
defaults, and cleaner type re-exports. No API breaking changes — every
1.1.1 program runs identically.

### Fixed

- **CI: `jest.config.js` syntax error.** The config file used `export default {}`
  (ESM syntax), which crashed in Node CommonJS context — including in
  GitHub Actions runners. Fixed by switching to `module.exports = {}` to
  match `useESM: false` in the ts-jest configuration. Tests now run
  correctly across Linux, macOS, and Windows runners.

### Improved

- **`process.setMaxListeners` defensive bump.** Ansimax modules
  (`animations`, `frames`, `loaders`, `utils/ansi`) each register
  `SIGINT` / `SIGTERM` / `exit` handlers for crash-safe cursor
  restoration. With Node's default cap of 10, hot-reload setups
  (Vite HMR, nodemon, ts-node-dev) could occasionally emit
  `MaxListenersExceededWarning`. We now bump the cap to 20 on first
  install — silently and safely, only if the current limit is lower.
  Production apps unaffected.
- **Uniform `TypeError` for theme validation.** `themes.register()`
  now throws `TypeError` for any structural / type issue (missing
  fields, non-string `name`, invalid hex), matching the rest of the
  validation surface. Previously it threw a mix of `Error` and
  `TypeError`, which made `try / catch` filtering inconsistent.
- **`themes.use()` throws `RangeError`** for unknown theme names
  (was `Error`). `RangeError` better reflects "value out of allowed
  set" semantics — same standard library convention as `Array(-1)`.
  Error message now also says "Available themes:" instead of
  "Available:" for clarity.
- **Cleaner type re-exports in the barrel.** Added a header comment
  explaining the legacy aliases (`stripAnsiColors`, `stripAnsiCodes`)
  and recommending `stripAnsi` for new code. Version string in the
  barrel header updated from the stale `v1.0.0` to `v1.1.2`.

### Notes

- All 1848 tests pass; 4 new tests cover the error-type guarantees.
- The error-type changes are technically observable via `instanceof`
  checks, but `RangeError` and `TypeError` both extend `Error`, so any
  `catch (e: Error)` block keeps working. We classify this as a
  non-breaking quality-of-life improvement.
- No new dependencies — still zero runtime deps.

---

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
