# Changelog

All notable changes to **ansimax** are documented in this file.
This project follows [Semantic Versioning](https://semver.org/).

## [1.4.7] — Reference links + flexbox layout

Two roadmap items land together, both building on v1.4.6 foundations
(link placeholders + the `distribute` helper). Zero breaking changes.

### Added — Markdown reference-style links

Full CommonMark reference-link support:

```js
import { markdown } from 'ansimax';

markdown.render(`
See [the docs][docs] and [Google][].

You can also use a [shortcut].

[docs]: https://docs.example.com "Documentation"
[Google]: https://google.com
[shortcut]: https://example.com
`);
```

Three reference forms are supported:
- **Full** — `[text][ref]`
- **Collapsed** — `[text][]` (uses `text` as the label)
- **Shortcut** — `[ref]` (label doubles as the display text)

Details:
- **Definitions** (`[label]: url "title"`) are collected in a pre-pass and
  stripped from the output — they never render as text
- **Case-insensitive** — labels are normalized (lowercase + whitespace
  collapse) per CommonMark §4.7, so `[Docs][REF]` matches `[ref]:`
- **First definition wins** on duplicate labels
- **Forward references** work — a link may reference a definition that
  appears later in the document
- **Inline links take priority** — `[text](url)` is resolved before
  reference forms, and unresolved references stay as literal text

New exports: `collectLinkRefs`, `normalizeRefLabel`, and the `LinkRef` type.

### Added — `panels.flex` (flexbox-style layout)

Horizontal layout with CSS `justify-content` semantics, powered by the
`distribute()` helper from v1.4.6 (integer gap distribution with no
rounding drift):

```js
import { panels, ascii } from 'ansimax';

const a = ascii.box('A');
const b = ascii.box('B');
const c = ascii.box('C');

// Spread three boxes across 60 columns
console.log(panels.flex([a, b, c], { width: 60, justify: 'between' }));
```

**Justify strategies** (`justify`):
- `start` (default) — blocks left, free space trails right
- `end` — blocks pushed right
- `center` — balanced leading/trailing space
- `between` — equal gaps between items, none at the edges
- `around` — half-size gaps at the edges, full gaps between
- `evenly` — equal gaps everywhere including the edges

**Flex-grow** (`grow: number[]`) — distribute leftover width to blocks in
proportion to their weights (largest-remainder method for exact integer
allocation):

```js
// Block A grows 3× as much as B to fill the row
panels.flex([a, b], { width: 40, grow: [3, 1] });
```

Also supports `gap` (minimum inter-block spacing) and `align` (vertical
alignment of shorter blocks). **Every justify strategy is space-conserving**
— the output width always equals `width` exactly (property-tested across
900 input combinations).

### Improved — Tests

- `+6` `collectLinkRefs` tests (definitions, titles, cleaning, normalization, first-wins, empty)
- `+2` `normalizeRefLabel` tests
- `+6` reference-link rendering tests (full, shortcut, collapsed, unresolved, case-insensitive, inline-priority)
- `+13` `flex` tests (all justify strategies, grow, gap, vertical align, width-conservation, single block)
- `+3` barrel re-export tests

Total: **+30 tests**.

### Notes

- **Zero breaking changes** — new exports only (`flex`, `collectLinkRefs`,
  `normalizeRefLabel`, `FlexOptions`, `FlexJustify`, `LinkRef`)
- Both features reuse v1.4.6 infrastructure: reference links use the link
  placeholder system; `flex` uses `distribute()` for gap allocation
- `flex` width-conservation and `distribute` sum-invariant are both
  property-tested

### Roadmap

- ✅ v1.4.7 — Reference links + flexbox layout — **done**
- ⏳ CommonMark strict mode (footnotes, HTML blocks) — pending
- ⏳ Custom markdown theme registry — pending

---

## [1.4.6] — Consolidation v4 + math toolkit + autolinks

Maintenance + feature release. Continues the DRY work of v1.3.7/v1.4.2,
adds a reusable math module, and closes another markdown roadmap item.

### Improved — Internal consolidation (`HEX_RE`)

The hex-color validation regex `HEX_RE` was duplicated **5 times**
(colors, images, loaders, themes, helpers). All 4 non-canonical copies
now delegate to the existing `isHexColor()` helper — single source of
truth:

| Module | Before | After |
|---|---|---|
| colors | local `HEX_RE` | `isHexColor()` |
| images | local `HEX_RE` | `isHexColor()` |
| loaders | local `HEX_RE` | `isHexColor()` |
| themes | local `HEX_RE` (×3 uses) | `isHexColor()` |
| helpers | canonical | unchanged |

`isHexColor()` is a strict superset of the inline checks — it includes
the `typeof` guard and `.trim()`, so behavior is byte-identical.

### Added — `utils/math` pure numeric toolkit

A small, dependency-free math module for the rendering engine and
downstream consumers:

```js
import {
  lerp, inverseLerp, remap, clampRange, clamp01,
  smoothstep, smootherstep, roundTo, mod, wrapRange,
  gcd, lcm, sum, mean, distribute,
} from 'ansimax';
```

Highlights:

- **`lerp` / `inverseLerp` / `remap`** — the interpolation trio.
  `remap(5, 0, 10, 0, 100) → 50`.
- **`smoothstep` / `smootherstep`** — Hermite (3t²−2t³) and Perlin's
  improved (6t⁵−15t⁴+10t³) easing curves, clamped to the edges.
- **`mod` / `wrapRange`** — true modulo (sign of divisor) and range
  wrapping. `mod(-1, 4) → 3`, `wrapRange(370, 0, 360) → 10`.
- **`gcd` / `lcm`** — Euclid's algorithm, sign-agnostic.
- **`distribute(total, parts)`** — split an integer across N buckets with
  the remainder to the front. **Guarantees the result sums exactly to
  `total`** — no rounding drift. `distribute(10, 3) → [4, 3, 3]`.

Exported under range-suffixed aliases (`clampRange`, `wrapRange`) to
avoid collision with existing string-`center`/`clamp` helpers. `lerp`
was already exported since v1.3.x — `math.ts` re-uses it rather than
redefining, keeping one source of truth.

Every function is pure, total, and deterministic. The `distribute` sum
invariant is property-tested across hundreds of input combinations.

### Added — Markdown autolinks

Bare URLs and angle-bracket autolinks now render as clickable terminal
hyperlinks (OSC 8):

```js
markdown.render('Visit https://example.com for docs');
markdown.render('Or <https://example.com/path>');
```

Details:
- **Angle-bracket form** `<https://…>` — explicit autolink
- **Bare URL form** `https://…` — detected in running text
- **Trailing punctuation** (`.,;:!?`) is excluded from the link so
  `see https://example.com.` keeps the period outside the URL
- **URL-safe** — underscores in the path (`/foo_bar_baz`) are not mangled
  by the emphasis passes (URLs are stashed before emphasis processing)
- `[label](url)` links still take priority — bare-URL detection runs
  after and won't double-process them

### Improved — Tests

- `+37` math toolkit tests (interpolation, easing, mod/wrap, gcd/lcm,
  distribute sum-invariant property test, barrel re-exports)
- `+7` autolink tests (angle-bracket, bare, punctuation, URL-safety,
  http/https, no double-processing)

Total: **+44 tests**.

### Notes

- **Zero behavior changes** — HEX_RE consolidation is byte-identical
- **Zero dependencies added**
- **Zero breaking changes** — only additions (15 math exports + autolinks)
- `distribute` is designed for future flexbox-style layout distribution

### Roadmap

- ✅ v1.4.6 — Autolinks (`<url>` + bare URLs) — **done**
- ⏳ CommonMark strict mode (reference links, footnotes) — pending
- ⏳ Custom markdown theme registry — pending
- ⏳ Flexbox-style layout (the `distribute` helper lays groundwork) — pending

---

## [1.4.5] — Panels refactor + syntax highlighting

Two substantial improvements. Both **fully backward-compatible**:

### Improved — `panels` module refactored (1116 → 993 lines, 7 files)

Following the same pattern as v1.4.1 for markdown, the monolithic
`src/panels/index.ts` splits into 7 focused files:

```
src/panels/
├── types.ts        (127 lines)  ← public types (Alignment, Options, GridCell)
├── helpers.ts      (101 lines)  ← internal string manipulation
├── split.ts        (110 lines)  ← vsplit + hsplit
├── layout.ts       (128 lines)  ← center + frame
├── grid.ts         (322 lines)  ← grid (3-phase algorithm)
├── grid-areas.ts   (145 lines)  ← gridAreas + _validateAreas
└── index.ts        (60 lines)   ← barrel + panels namespace
```

**The 250-line `grid` monolith is decomposed into 3 pure phases**:

```typescript
export const grid = (blocks, opts) => {
  // Phase 1: resolve + validate options
  const resolved = _resolveOptions(blocks, opts);

  // Phase 2: pack blocks into rows (mark-and-pack, column, or row flow)
  const cellRows = _packCells(blocks, resolved);

  // Phase 3: compute widths + render
  const widths = _computeWidths(cellRows, resolved);
  const renderedRows = cellRows.map(row => _renderRow(row, widths, resolved));

  return hsplit(renderedRows, { gap: resolved.gapY, align: resolved.alignX });
};
```

Each phase is a pure function testable in isolation:
- `_resolveOptions`: normalizes options + pre-computes `hasSpans` flags
- `_packCells`: dispatches to `_packMarkAndFill`, `_packColumnFlow`, or `_packRowFlow`
- `_computeWidths` + `_renderRow`: independent width calculation and row rendering

**Zero API changes** — the barrel re-exports everything that was public before.

### Added — Syntax highlighting for code blocks

Basic tokenizer + colorizer for 4 languages:

```js
import { markdown } from 'ansimax';

console.log(markdown.render(`
\`\`\`js
const greet = (name) => {
  // wave to the world
  return \`Hello, \${name}!\`;
};
\`\`\`

\`\`\`json
{
  "name": "ansimax",
  "version": "1.4.5"
}
\`\`\`

\`\`\`bash
# deploy the app
export NODE_ENV=production
echo "Deploying \${NODE_ENV}"
\`\`\`
`));
```

**Supported languages** (with aliases):
- **JavaScript** — `js`, `javascript`, `jsx`
- **TypeScript** — `ts`, `typescript`, `tsx`
- **JSON** — `json`
- **Bash** — `bash`, `sh`, `shell`, `zsh`

Unknown languages fall back to the plain (uncolored) code block — no
errors, just no highlighting.

**Token classes**: `keyword`, `string`, `number`, `comment`, `operator`,
`punctuation`, `boolean`, `null`, `property`, `plain`.

**Public API** (3 new functions + 2 types):

```js
import { highlightCode, tokenizeCode, isHighlightSupported } from 'ansimax';

// Direct highlighting
highlightCode('const x = 42;', 'js', 'dark');
//   → 'const x = 42;' with ANSI escapes for each token

// Access individual tokens (for custom rendering)
tokenizeCode('const x = 42;', 'js');
//   → [{ kind: 'keyword', text: 'const' }, ...]

// Check support before highlighting
isHighlightSupported('rust');   // false
isHighlightSupported('js');     // true
```

Also accessible on the `markdown` namespace as
`markdown.highlight()`, `markdown.tokenize()`, `markdown.isHighlightSupported()`.

**Design constraints** (intentionally simple):
- Zero external dependencies
- Regex-based tokenizer (no full parser)
- Preserve original text length + newlines exactly (round-trippable)
- ANSI codes wrap each individual token

For advanced highlighting needs (nested syntax, dozens of languages,
TextMate grammars), stick with `shiki` or similar. This module targets
CLI tools that want reasonable highlighting for the most common
languages without pulling in megabytes of dependencies.

### Improved — Tests

- `+7` panels refactor tests (submodule direct imports, barrel identity)
- `+35` syntax tokenizer tests across all 4 languages + fallbacks
- `+6` markdown integration tests (highlighting inside code blocks)
- `+2` barrel re-export tests

Total: **+50 tests**.

### Notes

- **Zero API changes** — all existing v1.4.4 code paths work unchanged
- **Zero dependencies added**
- Round-trip guarantee: `tokenize(x, lang).map(t => t.text).join('') === x`
- Highlighting is applied only when the code fence includes a supported language tag
- The tokenizer's grammar rules use sticky regex (`y` flag) for O(n) tokenization

### Roadmap

Progress on the post-Phase-4 items listed in v1.4.4:

- ✅ v1.4.5 — Syntax highlighting for code blocks (JS/TS/JSON/Bash) — **done**
- ⏳ CommonMark strict mode (reference links, autolinks, footnotes) — pending
- ⏳ Custom markdown theme registry — pending

Possible directions for v1.4.6+:
- Autolinks (`<https://…>` and bare URLs) — smaller, self-contained
- More highlighter languages (python, yaml, css) — additive to `_grammars`
- Reference-style links (`[label][ref]` + `[ref]: url`)

---

## [1.4.4] — Grid areas + task lists + setext headings

Patch release finishing the roadmap planned in v1.4.3. Four features
that build on top of the v1.4.3 foundation:

### Added — `panels.gridAreas` (CSS Grid template areas)

Symbolic layouts using a matrix of names — the same mental model as
CSS `grid-template-areas`:

```js
import { panels, ascii } from 'ansimax';

console.log(panels.gridAreas(
  {
    header:  ascii.box('HEADER'),
    sidebar: ascii.box('SIDE'),
    main:    ascii.box('MAIN CONTENT'),
    footer:  ascii.box('FOOTER'),
  },
  {
    areas: [
      ['header',  'header', 'header'],
      ['sidebar', 'main',   'main'  ],
      ['footer',  'footer', 'footer'],
    ],
    cellHeight: 3,
  },
));
```

Use `'.'` for gap cells:

```js
areas: [
  ['a', '.', 'b'],
  ['a', '.', 'b'],
]
```

**Rectangle validation** — every name must form a contiguous rectangle.
Non-rectangular layouts throw with a helpful message:

```
Error: areas: "foo" is not a rectangle — cells at [0,0]..[1,1]
       have 3 occurrences, expected 4
```

**Overlap detection** — same-name cells inside a bounding box are
verified; other names inside violate the constraint:

```
Error: areas: "a" overlaps or is interrupted by "b" at [1,1]
```

**Algorithm**: For each unique name, compute the bounding box
`[minR,minC]..[maxR,maxC]`. Then verify:
1. Occurrence count equals `rowSpan × colSpan` (rectangle-fill check)
2. Every cell in the bounding box holds the same name (overlap check)

Complexity: `O(rows × cols × names)`.

Internally, `gridAreas` derives `colSpan`/`rowSpan` per rect and delegates
to `panels.grid` with the mark-and-pack algorithm from v1.4.3.

### Added — Task lists (GFM syntax)

GitHub-flavored `- [ ]` and `- [x]` task items are now recognized:

```js
markdown.render(`
- [ ] pending task
- [x] completed task
- [X] uppercase X also works
- regular non-task item
`);
```

Rendered output uses `[ ]` for pending (dim) and `[✓]` for done (green).

The `Block.type === 'list'` items now carry an optional `checked?: boolean`:
- `undefined` — regular item (no task syntax)
- `false` — pending (`[ ]`)
- `true` — done (`[x]` or `[X]`)

Works with nesting from v1.4.3:

```markdown
- [ ] Outer task
  - [x] Nested subtask
  - [ ] Another subtask
```

### Added — Setext headings

Alternative CommonMark heading syntax with underlines:

```markdown
Title
=====

Subtitle
--------
```

- `===` (2+ chars) → `h1`
- `---` (2+ chars) → `h2`

Priority is handled correctly:
- `Title\n===` → h1 heading
- `---` alone → HR (unchanged)
- `\n---` → blank + HR (unchanged)
- `foo\n\n---` → paragraph + HR (blank line breaks the pair)
- `- item\n---` → list + HR (list takes priority over paragraph)

Renders identically to the equivalent ATX syntax (`# Title` / `## Sub`).

### Improved — Tests

- `+7` tests for `_validateAreas` rectangle detection (valid, gaps, L-shape rejection, interrupted, empty, uneven rows, zero-width)
- `+4` tests for `gridAreas` rendering (simple layout, missing name defensive, invalid throws)
- `+8` tests for task lists (pending, done, uppercase, mixed, nested, rendering)
- `+8` tests for setext headings (h1, h2, extended underlines, whitespace, HR-standalone, blank+HR, blank-between, list priority, render match)

Total: **+27 tests**.

### Notes

- **No breaking changes** — new exports (`gridAreas`, `GridAreasOptions`,
  `AreaRect`), new optional `checked?` on `ListItem`
- `panels.gridAreas` internally delegates to `panels.grid` → same
  packing behavior as v1.4.3
- Task list rendering respects theme colors
- Setext heading detection has correct CommonMark priority vs HR

### Roadmap

Phase 4 features from the original v1.4.0 roadmap are now complete:

- ✅ v1.4.0 — Markdown module (Phase 4 closure)
- ✅ v1.4.1 — Grid v2 (colSpan, cellHeight, flow) + markdown refactor
- ✅ v1.4.2 — Internal consolidation v3
- ✅ v1.4.3 — Grid rowSpan (mark-and-pack) + CommonMark escapes + nested lists
- ✅ v1.4.4 — Grid areas + task lists + setext headings

Next up (v1.4.5+):
- Syntax highlighting for code blocks (basic JS/TS/JSON/Bash)
- CommonMark strict mode (reference links, autolinks, footnotes)
- Custom markdown theme registry

---

## [1.4.3] — Grid rowSpan + markdown escapes + nested lists

Patch release adding **3 substantial features** across grid layouts and
markdown. Zero behavior changes for existing v1.4.2 code paths — all
new behavior opt-in.

### Added — `panels.grid` rowSpan with mark-and-pack algorithm

CSS Grid-style multi-row layouts now work with a proper packing algorithm:

```js
import { panels, ascii } from 'ansimax';

// Sidebar spans 2 rows, content blocks fill around it
panels.grid([sidebar, top, footer, top2, footer2], {
  columns: 3,
  colSpan: [1, 2, 2, 1, 1],
  rowSpan: [2, 1, 1, 1, 1],
  cellHeight: 4,
});

//  ┌────────────┬─────────────────────────┐
//  │            │                         │
//  │   SIDEBAR  │      TOP CONTENT        │
//  │            │                         │
//  │            ├────────┬────────────────┤
//  │            │  TOP2  │     FOOTER     │
//  └────────────┴────────┴────────────────┘
```

**Algorithm**: mark-and-pack (the same technique CSS Grid uses):

1. Maintain a 2D `occupancy[row][col]` boolean matrix
2. For each block in source order, scan row-by-row, column-by-column
3. Place the block at the first `(row, col)` where its full `colSpan × rowSpan` rectangle fits
4. Mark those cells occupied and move on

Time complexity: `O(blocks × rows × cols)` — fine for typical terminal grids.

When `rowSpan > 1` is used, `flow` is forced to `'row'` (column-flow + multi-axis spans requires deferred logic).

### Added — CommonMark backslash escapes in markdown

Literal markdown characters now work via `\X`:

```js
markdown.render('Show \\*literal asterisks\\* and \\_underscores\\_')
// Renders: Show *literal asterisks* and _underscores_

markdown.render('Use \\`code\\` for inline code')
// Renders: Use `code` for inline code (no actual code span)
```

Escapable characters (CommonMark spec §6.1 subset):

```
\\  \`  \*  \_  \~  \[  \]
```

Non-escapable characters pass through unchanged: `\.` → `\.`, `\?` → `\?` (matches behavior of most markdown renderers).

Escapes inside code spans are restored literally — `\`a \\* b\`` renders as ` a * b ` inside the code span.

### Added — Nested lists in markdown

Indented list items now create proper sublists, recursively:

```markdown
- Outer item
  - Nested item
    - Deep item
  - Back to nested
- Another outer
  1. Ordered sublist
  2. Second numbered
```

**Indentation rules** (CommonMark §5.2):
- 2 or more spaces of indent (relative to parent) = sublist
- Tabs count as 4 spaces with tab stops
- Sublist can be ordered (`1.`) or unordered (`-`/`*`/`+`) independently from parent
- Lower indent than parent = end of nesting

**Depth-aware bullets**: outer level uses `•`, then `◦`, `▪`, `▫` cycling per depth.

**Breaking detail**: `Block` type for lists changed from `items: string[]` to `items: ListItem[]` where `ListItem = { text: string; children?: { ordered: boolean; items: ListItem[] } }`. **External code that reads `parseBlocks()` output and treated `items` as strings must access `item.text` per entry.**

If you were only using `markdown.render(source)`, no changes needed — the rendering pipeline handles the new type internally.

### Improved — Tests

- `+8` tests for `rowSpan` (packing, combined with colSpan, invalid input, deterministic)
- `+10` tests for CommonMark escapes (each escapable char, mixed, inside code/links, non-escapable passthrough)
- `+9` tests for nested lists (2-level, 3-level, mixed ordered, tabs, orphan, rendering depth)

Total: **+27 tests**.

### Notes

- **No behavior changes** for v1.4.2 code paths
- `Block` type changed for `list` items (see above) — backward compatible if
  you only use `render`, breaking if you use `parseBlocks` directly
- Packing algorithm is `O(n × rows × cols)` — fine for typical grids
- All 3 features fully covered by tests; matched against CommonMark spec
  where applicable

---

## [1.4.2] — Internal consolidation v3

Patch release continuing the DRY work from v1.3.7. Three more helper
patterns that were duplicated across modules are now consolidated into
`utils/helpers` and exported. **Zero behavior changes** — the
consolidated implementations are byte-identical to the inline copies
they replace.

### Added — Three new exported helpers

**`ensureString(value)`** — coerce any value to a string, with `null`
and `undefined` becoming `''` (not `'null'`/`'undefined'`):

```js
import { ensureString } from 'ansimax';

ensureString('hello')      // → 'hello'
ensureString(42)           // → '42'
ensureString(null)         // → ''
ensureString(undefined)    // → ''
ensureString({})           // → '[object Object]'
```

**`clampNonNeg(value, fallback?)`** — coerce to a non-negative integer
(≥ 0), with floor and fallback for non-finite input:

```js
import { clampNonNeg } from 'ansimax';

clampNonNeg(5.7)            // → 5
clampNonNeg(-3)             // → 0
clampNonNeg(NaN, 10)        // → 10
clampNonNeg('abc', 5)       // → 5
```

**`clampPositiveInt(value, fallback?)`** — coerce to a positive integer
(≥ 1), with floor and fallback. Default fallback is `1`:

```js
import { clampPositiveInt } from 'ansimax';

clampPositiveInt(5.7)       // → 5
clampPositiveInt(0)         // → 1 (clamped up)
clampPositiveInt(NaN, 10)   // → 10
```

### Improved — Internal consolidation

Removed **10 duplicate inline implementations** across modules:

| Helper | Was duplicated in | Now imported from |
|---|---|---|
| `ensureString` | components, frames, loaders, trees (×4 identical) | `utils/helpers` |
| `clampNonNeg` | components, trees (×2 identical) | `utils/helpers` |
| `clampPositive` / `clampPositiveInt` | components, loaders (×3 identical) | `utils/helpers` |

What's left intentionally:
- `utils/ansi.ts` keeps its own private versions (architectural choice
  from v1.3.7 — `ansi` and `helpers` stay at the bottom of the
  dependency graph with no cross-imports)
- `ascii/index.ts` keeps a distinct `ensureString(value, paramName)`
  variant that throws with parameter info (different semantics, not a
  duplicate)

### Improved — Tests

- `+5` tests for `ensureString` (string/number/boolean/null/object)
- `+6` tests for `clampNonNeg` (range, floor, fallback, default, clamp)
- `+6` tests for `clampPositiveInt` (clamp-up, range, floor, fallback)
- `+1` test for barrel re-exports

Total: **+18 tests**.

### Notes

- **Zero behavior changes** — drop-in replacement for `1.4.1`
- **Zero API changes** — only additions (3 new exports)
- All call sites use explicit `fallback` arguments → compatible with
  default-arg signatures of the exported helpers
- ~30 lines of duplicated source removed across 4 modules

---

## [1.4.1] — Grid v2 + markdown internal refactor

Patch release with two improvements: **grid** gains CSS Grid-style
column spans + uniform row heights + flow direction control, and the
**markdown** module is internally refactored from a 522-line monolith
into 4 focused files (no API changes).

### Added — `panels.grid` v2

**`colSpan: number[]`** — per-block column span (CSS Grid-style):

```js
import { panels, ascii } from 'ansimax';

const header   = ascii.box('Dashboard', { borderStyle: 'rounded' });
const sidebar  = ascii.box('Sidebar', { borderStyle: 'rounded' });
const content  = ascii.box('Main content area', { borderStyle: 'rounded' });
const footer   = ascii.box('Footer', { borderStyle: 'rounded' });

// 2 columns, header + footer span the full width
console.log(panels.grid([header, sidebar, content, footer], {
  columns: 2,
  colSpan: [2, 1, 1, 2],
}));
```

Auto-flow: each block consumes its `span` columns. If a row's remaining
capacity can't fit the next block, the layout wraps to a new row.
Invalid spans (NaN, negative, > columns) are normalized to safe values.

**`cellHeight: number | null`** — uniform vertical sizing per row:

```js
// All rows exactly 5 lines tall — short blocks padded, tall blocks truncated
panels.grid(blocks, { columns: 3, cellHeight: 5 });
```

Complements the existing `cellWidth` option for fully uniform grids.

**`flow: 'row' | 'column'`** — auto-flow direction:

```js
// Default: row flow (left-to-right, then wrap down)
panels.grid([1, 2, 3, 4, 5, 6], { columns: 3, flow: 'row' });
//   1 2 3
//   4 5 6

// Column flow (top-to-bottom, then wrap right)
panels.grid([1, 2, 3, 4, 5, 6], { columns: 3, flow: 'column' });
//   1 3 5
//   2 4 6
```

When `colSpan` contains values > 1, flow is forced to `'row'` (the
column-flow + spans combination requires a full packing algorithm,
deferred to a later release).

### Improved — `markdown` module refactored

The single-file `src/markdown/index.ts` (522 lines) split into 5 files
of focused responsibility — **zero API changes, fully backward compatible**:

```
src/markdown/
├── types.ts          — Public types (MarkdownTheme, Block, …)
├── theme.ts          — Color palettes (THEMES record, private)
├── block-parser.ts   — parseBlocks + line regexes
├── inline-parser.ts  — parseInline + protected-code placeholders
├── renderer.ts       — render (dispatches blocks → ansimax primitives)
└── index.ts          — Re-exports + `markdown` namespace
```

External imports keep working unchanged:

```js
import { markdown, parseMarkdownBlocks, parseMarkdownInline, renderMarkdown }
  from 'ansimax';
```

Submodule imports now also work (advanced use):

```js
import { parseBlocks } from 'ansimax/markdown/block-parser';   // tree-shake friendly
```

### Improved — Tests

- `+18` tests for `colSpan` (defaults, clamping, wrapping, invalid input)
- `+4` tests for `cellHeight` (pad, truncate, null, zero clamp)
- `+5` tests for `flow` (row, column, non-multiples, fallback with colSpan)
- `+1` integration test (colSpan + cellHeight together)
- `+4` tests verifying submodule imports work after refactor

Total: **+32 tests** in `panels.test.ts` and `markdown.test.ts`.

### Notes

- **Zero behavior changes** for v1.4.0 users — `panels.grid` without the
  new options produces byte-identical output
- **Zero breaking changes** — `markdown` API surface unchanged
- Submodule imports enabled (`ansimax/markdown/block-parser`) for
  tree-shaking-friendly bundling

---

## [1.4.0] — Phase 4 closure: Markdown rendering

**Minor release** introducing the long-planned `markdown` module — the
final piece of Phase 4 (after `panels` v1.3.0 and `json` v1.3.0).

Renders standard Markdown to ANSI-styled terminal output using the
existing ansimax primitives (`color`, `gradient`, `ascii.box`,
`components.table`, `hyperlink`). **Zero new runtime dependencies.**

### Added — `markdown` module

```js
import { markdown } from 'ansimax';

console.log(markdown.render(`
# Welcome

This is **bold** and *italic* with \`code\` and [a link](https://example.com).

- Item 1
- Item 2

\`\`\`js
const x = 42;
\`\`\`

> Quoted wisdom

---

| Name | Value |
|---|---|
| foo | 1 |
| bar | 2 |
`));
```

### Supported markdown

| Markdown | Rendered using |
|---|---|
| `#` to `######` headings | `gradient` (h1) + `color.hex` (h2–h6) |
| **Bold** (`**` or `__`) | `color.bold` |
| *Italic* (`*` or `_`) | `color.italic` |
| ~~Strikethrough~~ (`~~`) | `color.strikethrough` |
| `Inline code` (``` ` ```) | dim + tinted background |
| ```` ```code blocks``` ```` | `ascii.box` with language label as title |
| `- item` / `* item` / `1.` lists | indented bullets |
| `> blockquote` | `│` prefix + dim |
| `--- / *** / ___` HRs | `ascii.divider` |
| `[label](url)` | `hyperlink` (OSC 8) |
| `\| a \| b \|` tables | `components.table` |

### API

```ts
// Main entry — high-level render
markdown.render(source: string, opts?: MarkdownOptions): string

// Lower-level helpers (advanced use)
markdown.parseBlocks(source: string): Block[]
markdown.parseInline(text: string, opts?): string
```

### Options

```ts
interface MarkdownOptions {
  width?: number;                     // default: terminal width or 80
  theme?: 'dark' | 'light';           // default 'dark'
  headingGradient?: string[];         // override h1 gradient colors
  boxCodeBlocks?: boolean;            // default true; false = indented dim
  inlineCodeBackground?: boolean;     // default true
}
```

### Design notes

- **Pure functions** — `parseBlocks` and `parseInline` are deterministic
- **No regex backtracking** — all patterns are anchored, single-pass
- **Code blocks protect contents** — `**bold**` inside `` ` `` stays literal
- **Inline parser precedence**: code > links > strikethrough > bold > italic
- **Graceful degradation** — malformed markdown renders as plain text
  rather than throwing

### Tests

- `+18` tests for `parseBlocks` (headings, lists, code, tables, blockquotes, HRs, edge cases)
- `+13` tests for `parseInline` (bold/italic/code/links/strikethrough, precedence, protection)
- `+19` tests for `render` (full pipeline, integration, options, theming)
- `+2` tests for namespace + `+2` for barrel re-exports

Total: **+54 tests** in a new `markdown.test.ts` file.

### Roadmap note

Phase 4 of the project is now closed. Future v1.4.x patches will refine
the markdown module:
- v1.4.1+ — CommonMark spec strict mode (escapes, reference links, setext headings)
- v1.4.2+ — Optional syntax highlighting for code blocks (basic JS/TS/JSON/Bash)
- v1.4.3+ — Nested lists (currently flat)
- v1.4.4+ — Custom themes / theme registry

### Notes

- **No breaking changes** — new module, all existing APIs unchanged
- **Drop-in replacement** for `1.3.7`
- Zero runtime dependencies maintained
- All markdown features implemented in ~450 lines of source

---

## [1.3.7] — Internal consolidation + new clamp helpers

Maintenance release focused on code cleanup. Zero behavior changes —
internal duplications consolidated into the existing `utils/helpers`
module, plus two new exported helpers that codify the most common
defensive patterns.

### Added — New exported helpers

**`clampPercent(value)`** — clamp + coerce to 0–100 range, with 0 fallback
for non-finite input. Previously duplicated as a private function in
`components/index.ts` and `loaders/index.ts`:

```js
import { clampPercent } from 'ansimax';

clampPercent(50)      // → 50
clampPercent(150)     // → 100
clampPercent(-5)      // → 0
clampPercent(NaN)     // → 0
clampPercent('abc')   // → 0
```

**`clampInt(value, min, max, fallback?)`** — coerce to integer clamped
between `[min, max]`. Falls back (and clamps) when input is non-finite:

```js
import { clampInt } from 'ansimax';

clampInt(50.7, 0, 100)         // → 50  (floored)
clampInt(150, 0, 100)          // → 100 (clamped)
clampInt(NaN, 0, 100, 25)      // → 25  (fallback, also clamped)
clampInt(NaN, 10, 20, 999)     // → 20  (fallback clamped to range)
```

### Improved — Internal consolidation (DRY)

Removed 5 copies of the inline `isFiniteNumber` definition that were
duplicated across modules. They now all import the canonical version
from `utils/helpers` (exported since v1.3.5):

- `components/index.ts` — was 1 inline copy + 1 inline `clampPercent`
- `frames/index.ts` — was 1 inline copy
- `images/index.ts` — was 1 inline copy + 1 inline `clampInt`
- `loaders/index.ts` — was 1 inline copy + 1 inline `clampPercent`
- `trees/index.ts` — was 1 inline copy

`utils/ansi.ts` intentionally keeps its private copy to avoid creating a
dependency on `utils/helpers` (the two modules are deliberately
independent at the bottom of the dependency graph).

### Improved — Tests

- `+6` tests for `clampPercent` (range, fallback, fractional values, non-numeric input)
- `+6` tests for `clampInt` (clamping, fallback behavior, edge cases)
- `+1` test for barrel re-exports

Total: **+13 tests**.

### Notes

- **No behavior changes** — the consolidated helpers are byte-identical
  to the inline copies they replaced
- **No API changes** — only additions (`clampPercent`, `clampInt`)
- **No breaking changes** — drop-in replacement for `1.3.6`
- Smaller bundle output expected as TypeScript can dedupe the
  consolidated implementations

---

## [1.3.6] — Branch coverage improvements

Maintenance release. Zero behavior changes — only adds tests covering
defensive branches and adjusts `istanbul ignore` comments where branches
are genuinely unreachable in normal usage.

### Improved — Tests

**panels (`+7` tests):**
- `vsplit` default `gap = 1` when option omitted
- `vsplit` handles columns of unequal heights (triggers `block[r] ?? ''` fallback)
- `centerBlock` default `align = 'center'` with `height` (vertical centering branch)
- `centerBlock` with explicit `align='start'` (alternative branch)
- `frame` fallback `'─'` when `topChar=''` or non-string
- `grid` default `columns = 1` when option omitted/undefined

**frames (`+7` tests):**
- `ensureString` handles `null`/`undefined` via `?? ''` fallback
- `presets.loadingBar` fallback `'░'` for invalid `empty` (`''` or non-string)
- `presets.ball` fallback `width = 20` for `NaN`/non-number input
- `presets.breathe` fallback `steps = 8` for `NaN`/non-number input

**loaders (`+5` tests):**
- `loader.bar` fallback `'░'` for invalid `emptyChar`
- `loader.spin` finalText with all three success states (`undefined`, `true`, `false`)
  — exercises icon ternary chain branches

### Improved — `istanbul ignore` comments

Some `??` and conditional-spread branches are unreachable in real usage
(e.g. `frames[frame] ?? ''` after `frame = i % frames.length` with a non-empty
array). Marked with explanatory `istanbul ignore next` comments instead of
chasing coverage with synthetic tests:

- `loaders:376` — `frames[frame] ?? ''` (frame index always in bounds)
- `loaders:997` — second instance of `addOpts.color !== undefined` spread

Total: **+19 tests** added across panels, frames, loaders.

### Notes

- No runtime changes — drop-in replacement for `1.3.5`
- No new exports, no API surface changes
- Same `dist/` output as `1.3.5` would have produced

---

## [1.3.5] — Mathematical color science + cleanup

Patch release focused on mathematical depth: perceptually-uniform color
spaces (Oklab/HSL), comprehensive easing library, and removing duplicate
defensive patterns. **Zero breaking changes** — `lerpColor` and
`gradientColor` accept a new optional `space` parameter that defaults to
`'rgb'` (the previous behavior).

### Added — Perceptually-uniform color spaces

**Oklab** — modern perceptual color space. Interpolating in Oklab produces
smoother, more natural-looking gradients than naive RGB:

```js
import { lerpColor, mixColors, gradientStops } from 'ansimax';

const red  = { r: 255, g: 0, b: 0   };
const blue = { r: 0,   g: 0, b: 255 };

lerpColor(red, blue, 0.5);            // → { r: 128, g: 0,  b: 128 } (RGB midpoint — muddy)
lerpColor(red, blue, 0.5, 'oklab');   // → { r: 140, g: 83, b: 162 } (perceptual midpoint — vibrant)

// Or with hex inputs:
mixColors('#ff0000', '#0000ff', 0.5, 'oklab');

// Multi-stop gradients:
gradientStops('#ff0000', '#0000ff', 5, 'oklab');
```

**HSL** — useful for hue rotation and color manipulation:

```js
import { rgbToHsl, hslToRgb, lerpColor } from 'ansimax';

const hsl = rgbToHsl({ r: 255, g: 100, b: 50 });   // → { h: 12, s: 1, l: 0.598 }

// hslToRgb wraps hue automatically:
hslToRgb({ h: -120, s: 1, l: 0.5 });   // → { r: 0, g: 0, b: 255 }
hslToRgb({ h: 720,  s: 1, l: 0.5 });   // → { r: 255, g: 0, b: 0 }

// Interpolation through HSL takes the shorter arc on the color wheel:
lerpColor(red, blue, 0.5, 'hsl');
```

### Added — `easings` library (Robert Penner library)

Comprehensive easing curve library:

```js
import { easings, resolveEasingByName, animate } from 'ansimax';

// All curves: in/out/inOut variants of:
// quad, cubic, quart, quint, sine, expo, circ, back, elastic, bounce
// Plus linear.

await animate.countUp(0, 1000, {
  duration: 2000,
  easing: easings.easeOutBounce,    // bouncing ball deceleration
});

// Resolve by name:
const fn = resolveEasingByName('easeInElastic');
```

### Added — Color utilities

**`mixColors(a, b, t, space?)`** — semantic alias accepting hex or RGB:

```js
mixColors('#ff0000', { r: 0, g: 0, b: 255 }, 0.5, 'oklab');
```

**`quantizeColor(color, levels)`** — palette reduction (posterize effect):

```js
quantizeColor({ r: 100, g: 150, b: 200 }, 4);
// Snaps each channel to nearest of [0, 85, 170, 255] → 64-color palette
```

### Added — Numeric helpers

**`isFiniteNumber(n)`** — type guard, previously internal:

```js
isFiniteNumber(42);         // → true
isFiniteNumber(NaN);        // → false
isFiniteNumber('5');        // → false
```

**`safeInt(value, fallback?, min?, max?)`** — consolidates the
`Math.max(0, Math.floor(Number(x) || 0))` pattern that appeared 25+
times across the codebase:

```js
safeInt('abc')                 // → 0
safeInt(3.7)                   // → 3
safeInt(NaN, 50)               // → 50  (fallback)
safeInt(500, 0, 0, 100)        // → 100 (clamped to max)
```

**`clampByte(v)`** — previously private, now exported.

### Improved — `gradientStops` accepts `space` parameter

```js
gradientStops('#ff0000', '#0000ff', 5);          // RGB (default, fast)
gradientStops('#ff0000', '#0000ff', 5, 'oklab'); // perceptually uniform
```

### Improved — Code cleanliness

- Replaced internal duplicate `typeof n === 'number' && Number.isFinite(n)`
  checks with `isFiniteNumber()` calls
- `gradientColor` now uses `isFiniteNumber` instead of inline check

### Improved — Tests

- `+18` tests for color spaces (rgbToHsl, hslToRgb, rgbToOklab, oklabToRgb)
- `+9` tests for `lerpColor` with spaces + `mixColors`
- `+6` tests for `quantizeColor`
- `+10` tests for numeric helpers (`isFiniteNumber`, `safeInt`, `clampByte`)
- `+30` tests for `easings` library (every curve + endpoint preservation)
- `+5` tests for `resolveEasingByName`
- `+4` tests for v1.3.5 barrel re-exports

Total: **+82 tests** added.

### Notes

- No runtime dependencies — still zero
- **No breaking changes** — `lerpColor(a, b, t)` defaults to `'rgb'` and
  produces identical output to v1.3.4
- Oklab math validated via roundtrip identity tests (±1 byte tolerance
  for floating-point through linear sRGB intermediate)
- All easing curves verified to map `f(0) ≈ 0` and `f(1) ≈ 1`

---

## [1.3.4] — Feature additions across animations, configure, utils

Patch release adding small but useful features to several modules. No
breaking changes — every addition is opt-in.

### Added — `animations` module

**`animate.shake(text, opts)`** — horizontal tremble effect for errors or alerts:

```js
import { animate } from 'ansimax';

await animate.shake('Connection failed', {
  times: 5,
  intensity: 2,
  interval: 50,
});
```

**`animate.countUp(from, to, opts)`** — numeric animation for counters:

```js
await animate.countUp(0, 100, {
  duration: 1500,
  decimals: 0,
  format: (n) => `$${n.toLocaleString()}`,
  easing: (t) => 1 - (1 - t) ** 3,   // ease-out cubic
});
// Animates from "$0" → "$100" over 1.5 seconds
```

Both functions support the standard animation pattern: `signal`, `reducedMotion`,
`onFrame`, `onDone`, `onAbort`.

### Added — `configure` module

**`setConfigValue(key, value)`** — single-key shortcut:

```js
import { setConfigValue } from 'ansimax';

setConfigValue('theme', 'dracula');
setConfigValue('animationSpeed', 'fast');
// equivalent to: configure({ theme: 'dracula' })
```

**`subscribeConfig(listener)`** — alias for `onConfigChange` matching the
naming convention used by `themes.onChange`:

```js
import { subscribeConfig } from 'ansimax';

const unsubscribe = subscribeConfig((newCfg, oldCfg) => {
  console.log('Config changed:', newCfg);
});
```

### Added — `utils/ansi` module

**`hyperlink(url, label?)`** — OSC 8 escape sequence for clickable terminal links:

```js
import { hyperlink } from 'ansimax';

console.log(`Visit ${hyperlink('https://github.com/Brashkie/ansimax', 'the repo')}`);
console.log(`Email: ${hyperlink('mailto:hi@example.com')}`);
```

Supported terminals: VS Code, iTerm2, WezTerm, Kitty, Hyper, Alacritty, modern
Windows Terminal. Terminals without support just show the label text.

**`clearLine()`** — convenience for clearing current line + carriage return:

```js
import { clearLine } from 'ansimax';

for (let i = 0; i <= 100; i++) {
  process.stdout.write(clearLine() + `Progress: ${i}%`);
  await sleep(30);
}
```

### Added — `utils/helpers` module

**`gradientStops(start, end, count)`** — interpolate N hex stops between two colors:

```js
import { gradientStops } from 'ansimax';

const stops = gradientStops('#ff0000', '#0000ff', 5);
// → ['#ff0000', '#bf003f', '#7f007f', '#3f00bf', '#0000ff']
```

**`escapeForRegex(str)`** — escape regex meta-characters in user input:

```js
import { escapeForRegex } from 'ansimax';

const userInput = 'hello.world+code';
const re = new RegExp(escapeForRegex(userInput));
// Matches the literal string, not as a regex pattern
```

**`measureBlock(block)`** — get dimensions of a multi-line string (ANSI-aware):

```js
import { measureBlock, ascii } from 'ansimax';

const box = ascii.box('Hello world!');
const { width, height } = measureBlock(box);
// → { width: 15, height: 3 }
```

### Improved — `node-globals.d.ts`

Added ambient declarations for `AsyncIterator`, `AsyncIterable`, `AsyncGenerator`,
and `Symbol.asyncIterator`. Lets code using `for await...of` type-check without
needing `@types/node` installed at consumer projects.

### Improved — Tests

- `+6` tests for `gradientStops`
- `+5` tests for `escapeForRegex`
- `+7` tests for `measureBlock`
- `+5` tests for `hyperlink`
- `+2` tests for `clearLine`
- `+4` tests for `setConfigValue`
- `+3` tests for `subscribeConfig`
- `+5` tests for `animate.shake`
- `+8` tests for `animate.countUp`

Total: **+45 tests** across utils, ansi, configure, animations.

### Notes

- No runtime dependencies — still zero
- No breaking changes — drop-in replacement for `1.3.3`
- All new exports backward-compatible by default

---

## [1.3.3] — Feature additions to panels, json, ascii

Patch release adding new functionality to three modules. No breaking changes —
all additions are opt-in via new options/exports.

### Added — `panels.grid(blocks, opts)`

N-column grid layout with auto-flow (reading order). Each row auto-sizes to
the tallest block; each column auto-sizes to its widest member.

```js
import { panels, ascii } from 'ansimax';

const cards = [
  ascii.box('FILES\n42',   { padding: 1 }),
  ascii.box('LINES\n1247', { padding: 1 }),
  ascii.box('TESTS\n38',   { padding: 1 }),
  ascii.box('COV\n98%',    { padding: 1 }),
];

// 2×2 grid
console.log(panels.grid(cards, { columns: 2, gapX: 2, gapY: 1 }));

// 3-column with auto-flow (7 items → 3 rows: [3, 3, 1])
console.log(panels.grid(items, { columns: 3, gapX: 4 }));

// Fixed cell width for uniform appearance
console.log(panels.grid(blocks, {
  columns: 4,
  cellWidth: 15,
  alignX: 'center',
}));
```

Options: `columns` (required), `gapX`, `gapY`, `alignX`, `alignY`, `cellWidth`.

### Added — `panels.frame` option `titleAlign`

Frame titles can now be aligned `'left'`, `'center'` (default), or `'right'`.

```js
panels.frame('Body', { title: 'Section', titleAlign: 'left' });
// ─ Section ───────────
//
// Body
// ────────────────────

panels.frame('Body', { title: 'Section', titleAlign: 'right' });
// ─────────── Section ─
//
// Body
// ────────────────────
```

### Added — `ascii.box` options `title` + `titleAlign`

Boxes can now have a title in the top border. When the title is wider than the
content, the box expands to fit it.

```js
console.log(ascii.box('Body content', {
  title: 'Header',
  titleAlign: 'left',     // 'left' | 'center' (default) | 'right'
  borderStyle: 'rounded',
}));

// ╭─ Header ──────╮
// │ Body content  │
// ╰───────────────╯
```

### Added — `ascii.divider` option `align`

Divider labels can now be aligned similar to box titles.

```js
ascii.divider({ label: 'Section', align: 'left',   width: 40 });
// ─ Section ──────────────────────────────
ascii.divider({ label: 'Section', align: 'center', width: 40 });
// ─────────────── Section ────────────────
ascii.divider({ label: 'Section', align: 'right',  width: 40 });
// ────────────────────────────── Section ─
```

### Added — `json.pretty` native types support: `Map`, `Set`, `Date`

```js
import { json } from 'ansimax';

const data = {
  created: new Date('2026-06-13'),
  cache: new Map([['user1', 'Alice'], ['user2', 'Bob']]),
  tags: new Set(['frontend', 'react']),
};

console.log(json.pretty(data));
// {
//   "created": Date(2026-06-13T00:00:00.000Z),
//   "cache": Map(2) [...],
//   "tags": Set(2) ["frontend", "react"]
// }
```

### Added — `json.pretty` option `mode: 'json'`

Produces **strict, parseable JSON** instead of display-only output. Useful
for piping to files, scripts, or other tools.

```js
const out = json.pretty(myData, { mode: 'json' });
const parsed = JSON.parse(out);   // ✓ works
```

In `'json'` mode:
- Colors are forced off (output is always plain text)
- `undefined` / functions / symbols are dropped from objects, become `null` in arrays
- `NaN` / `Infinity` / `-Infinity` become `null`
- `BigInt` becomes a number (if safe) or a string (if out of safe range)
- `Date` becomes its ISO string
- `Map` becomes a plain object (string-keys only)
- `Set` becomes an array
- Circular references throw `TypeError` (matches `JSON.stringify` behavior)

Default `'display'` mode preserves all v1.3.2 behavior. **No breaking changes.**

### Improved — Tests

- `+8` tests for `panels.grid`
- `+3` tests for `panels.frame` titleAlign
- `+5` tests for `ascii.box` title/titleAlign
- `+4` tests for `ascii.divider` align
- `+18` tests for `json` Map/Set/Date/mode

### Notes

- No runtime dependencies — still zero
- No breaking changes — drop-in replacement for `1.3.2`
- All new options have backward-compatible defaults

---

## [1.3.2] — Documentation polish for frames + images

Patch release improving JSDoc + IntelliSense coverage for the two largest
modules that were under-documented. No code changes — pure DX upgrade.

### Improved — JSDoc with runnable examples

**`frames` module (previously 0 examples → now 17):**
- `frames.play` — 5 examples (basic loop, play-once, abortable, pause/resume, custom onFrame)
- `frames.generate` — 3 examples (pulsing dot, progress bar, error tolerance)
- `frames.live` — 3 examples (reactive counter, async data stream, FPS clamping)
- `frames.morph` — 3 examples (basic, custom charset, chained sequences)
- `frames.presets` — 3 examples (loadingBar, pulse, wave with custom rendering)

**`images` module (previously 0 examples → now 18):**
- `renderPixelArt` — 4 examples (heart sprite, scaling, background, sprite lookup)
- `gradientRect` — 7 examples (horizontal, vertical, diagonal, radial, conic, dithered, braille)
- `createCanvas` — 4 examples (basic scene, animated frame, sprite composition, resize)
- `SPRITES` — 3 examples (render single, list all, compose on canvas)

### Why this matters

Before v1.3.2, users hovering `frames.play(...)` in their editor saw just
the signature `(frames: string[], opts?: PlayOptions): PlayController`.
Now they see 5 runnable examples showing pause/resume patterns, AbortSignal
integration, custom rendering callbacks — significantly reducing the
"what do I pass here?" friction for new users.

### Notes

- No code changes — pure documentation
- No runtime dependencies — still zero
- No new tests required — existing test coverage unchanged
- Drop-in replacement for `1.3.1`

---

## [1.3.1] — Polish for panels + json

Patch release improving the two modules introduced in v1.3.0 — adds layout
helpers, JSON readability options, and tests. No breaking changes.

### Added — `panels.center(block, opts)`

Center a multi-line block horizontally (and optionally vertically) within
a fixed width/height. Useful for centering boxes, banners, or any pre-rendered
block in a known terminal width.

```js
import { panels, ascii } from 'ansimax';

// Horizontal centering only
console.log(panels.center('Hello!', { width: 30 }));
//   "            Hello!            "

// Vertical too — content fits in 5 rows
console.log(panels.center('X', { width: 5, height: 5, align: 'center' }));

// Combine with box for a centered card
console.log(panels.center(ascii.box('Hello'), { width: 80 }));
```

Exported as `centerBlock` from the main barrel (to avoid colliding with the
existing `center` text helper). The namespaced form `panels.center` works
identically.

### Added — `panels.frame(block, opts)`

Lighter alternative to `ascii.box`: draws only top/bottom decorative rules
(not full sides). Supports a centered title, padding, and custom characters.

```js
import { panels } from 'ansimax';

// Simple rules
console.log(panels.frame('Hello world!'));
// ─────────────
// Hello world!
// ─────────────

// With title + padding
console.log(panels.frame('Body content\nMore content', {
  title: 'Header',
  padding: 1,
}));
// ───── Header ─────
//
//  Body content
//  More content
//
// ──────────────────

// Custom decoration chars
console.log(panels.frame('Important!', {
  topChar: '═',
  padding: 2,
}));
```

### Added — `json.pretty` option `sortKeys`

Sort object keys alphabetically for deterministic output. Useful for diffs,
snapshots, and visual scanning of large objects.

```js
import { json } from 'ansimax';

console.log(json.pretty({ zebra: 1, apple: 2, mango: 3 }, { sortKeys: true }));
// {
//   "apple": 2,
//   "mango": 3,
//   "zebra": 1
// }
```

Recursive — applies to all nested objects. Default `false` (preserves
insertion order).

### Added — `json.pretty` option `inlineArrayMaxLength`

Arrays of primitives now render on a single line when their rendered length
is short enough (default threshold: 60 visible characters). This improves
readability significantly for typical configs:

```js
// Before v1.3.1:
{
  "tags": [
    "frontend",
    "react",
    "typescript"
  ]
}

// In v1.3.1 (default behavior):
{
  "tags": ["frontend", "react", "typescript"]
}
```

Arrays containing objects/arrays never inline regardless of length. Set
`inlineArrayMaxLength: 0` to restore the v1.3.0 always-expand behavior.

### Improved — Tests

- `+11` tests for `panels.center` + `panels.frame`
- `+15` tests for `json.pretty` `sortKeys` + `inlineArrayMaxLength`
- Total tests: 2,000+ → **~2,026** across 18 suites

### Notes

- No runtime dependencies — still zero
- No breaking changes — drop-in replacement for `1.3.0`
- `panels.center` is exposed as `centerBlock` at the top level to avoid
  conflict with the existing `center` text helper; both `panels.center` and
  `centerBlock` reference the same function

---

## [1.3.0] — Phase 4 progress: Panels + JSON pretty-print

Minor release adding **split layout primitives** and **JSON pretty-printing**.
Two new top-level modules, zero breaking changes — every 1.2.x program runs
identically.

### Added — `panels` module (split layouts)

Two composition primitives for combining already-rendered blocks:

- **`panels.vsplit(blocks, opts)`** — joins blocks side-by-side (columns).
  ANSI-aware width measurement, variable height handling, alignment, gap,
  fixed-width mode.

- **`panels.hsplit(blocks, opts)`** — stacks blocks vertically (rows).
  Width alignment, vertical gap.

```js
import { panels, ascii } from 'ansimax';

// Two columns side-by-side
console.log(panels.vsplit([
  ascii.box('Left side',  { borderStyle: 'rounded' }),
  ascii.box('Right side', { borderStyle: 'rounded' }),
], { gap: 2 }));

// Three rows stacked vertically
console.log(panels.hsplit([
  '── Header ──',
  ascii.box('Body content'),
  '── Footer ──',
], { align: 'center' }));

// Nested — sidebar + main in an app shell
const sidebar = ascii.box('Sidebar', { width: 20 });
const main    = ascii.box('Main',    { width: 40 });

console.log(panels.hsplit([
  '── Application ──',
  panels.vsplit([sidebar, main], { gap: 2 }),
]));
```

**Both functions:**
- Preserve ANSI escapes from input blocks
- Handle multi-line blocks of variable height
- Coerce invalid inputs (`gap: -5` → `0`, empty arrays → `''`)
- Compose freely with each other (panels-in-panels)

Three alignment modes (`'start'` / `'center'` / `'end'`) for both axes.

### Added — `json` module (pretty-printer)

Color-coded JSON pretty-printer for terminal display:

```js
import { json } from 'ansimax';

// Basic — colored output
console.log(json.pretty({
  name: 'ansimax',
  version: '1.3.0',
  features: ['colors', 'gradients', 'panels'],
  stats: { tests: 2000, coverage: 0.98 },
}));

// With depth limit — deep nesting collapses to {...}
console.log(json.pretty(deeplyNested, { maxDepth: 2 }));

// Limit array display — huge arrays show "... (N more)"
console.log(json.pretty(bigArray, { maxItems: 10 }));

// Monochrome for log files
console.log(json.pretty(data, { colors: false }));

// Handles circular refs gracefully
const obj = { name: 'foo' };
obj.self = obj;
console.log(json.pretty(obj));   // → { "name": "foo", "self": [Circular] }
```

**Features:**
- Color-coded by type: cyan (keys), green (strings), yellow (numbers), magenta (booleans), gray (null/undefined)
- Circular reference detection
- Depth limit with `{...}` / `[...]` collapse markers
- Array length limit with `... (N more)` marker
- String length limit with `...` truncation
- BigInt, function, symbol rendering
- ANSI auto-disabled in `NO_COLOR` / non-TTY environments
- Configurable indent (default `2`)

### Roadmap impact — Phase 4 progress

Phase 4 (Terminal UI primitives) advances from 8/15 → **10/15**:

- [x] Panels (split layouts: hsplit, vsplit) ← **v1.3.0**
- [x] JSON/YAML pretty-printing (with depth limit + collapse) ← **v1.3.0**

Still pending in Phase 4: Layouts (flexbox-style), Grid system, Markdown
rendering, Syntax highlighting, Logging integration. These come in later
1.3.x / 1.4.x releases.

### Notes

- 2 new test files: `panels.test.ts` (~25 tests), `json.test.ts` (~30 tests)
- No runtime dependencies — still zero
- No breaking API changes — pure additions
- Drop-in replacement for `1.2.8`

---

## [1.2.8] — Documentation polish

Patch release improving JSDoc and IntelliSense coverage across previously
under-documented modules. No code changes — pure documentation upgrade.

### Improved — JSDoc with runnable examples

The following functions now have full JSDoc with `@example` blocks visible
in editor IntelliSense (VS Code, IntelliJ, etc.):

**`components/` (previously 0 examples → now 4):**
- `components.table` — 3 examples (basic, custom borders, colored cells)
- `components.badge` — 3 examples (basic, custom colors, inline composition)
- `components.status` — 3 examples (basic, multiline, custom icons)
- `components.timeline` — 3 examples (basic, done/pending, custom symbols)

**`loaders/` (previously 0 examples → now 2):**
- `loader.spin` — 3 examples (basic, custom type/color, try/finally pattern)
- `loader.tasks` — 4 examples (serial, subtasks, parallel mode, error handling)

**`themes/` (previously 0 examples → now 4):**
- `themes` object — 4 examples (switching, registering, subscribing, fallback)

**`animations/` (previously 1 example → now 6):**
- `animate.typewriter` — 4 examples (basic, colored, abortable, reduced-motion)
- `animate.fadeIn` — 3 examples (basic, custom timing, abortable)

**`ascii/`:**
- `ascii.box` — 4 examples (basic, multiline, fixed-width, with color)

### Notes

- No new tests required — pure documentation changes
- No runtime dependencies — still zero
- No API changes — drop-in replacement for `1.2.7`
- IntelliSense quality dramatically improved for new users

---

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
