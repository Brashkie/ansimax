<div align="center">

# 📚 ansimax — Documentation

Detailed examples covering every module in **ansimax**, with copy-paste runnable code in three formats.

</div>

---

## 📖 Where to start

Pick the document that matches your project setup:

| File | Format | Use when… |
|---|---|---|
| [`examples-ts.md`](./examples-ts.md) | **TypeScript** (`.ts`) | Your project uses TypeScript (with `ts-node`, `tsx`, or compiled output) |
| [`examples-mjs.md`](./examples-mjs.md) | **JavaScript ESM** (`.mjs` / `"type":"module"`) | Modern JavaScript with `import`/`export` |
| [`examples-cjs.md`](./examples-cjs.md) | **JavaScript CommonJS** (`.cjs` / classic Node) | Legacy or simple Node scripts with `require()` |
| [`showcase.md`](./showcase.md) | **Complete app** | A single end-to-end JavaScript app combining all modules |

Each `examples-*.md` file covers **all 11 modules** with **3 runnable examples each** (33 examples per file).

---

## 🧩 Modules covered in every file

Each examples file is organized in this order:

1. **`color`** — basic colors, ANSI styling, gradients
2. **`gradient`** — multi-stop, animated, eased, conic gradients
3. **`ascii`** — boxes, banners (figlet), image-to-ASCII
4. **`animations`** — typewriter, fadeIn, fadeOut
5. **`loaders`** — spinners, tasks, progress bars
6. **`components`** — table, badge, status, timeline
7. **`themes`** — built-in themes, custom themes, registry
8. **`trees`** — hierarchical rendering, max-depth, cycles
9. **`frames`** — frame-by-frame animation, morphing
10. **`images`** — pixel art, canvas, gradient rectangles
11. **`panels`** + **`json`** — split layouts + pretty-printing (v1.3.0+)

### Added since v1.4.0 — not yet covered in the example files

These modules and APIs shipped after the example files were written. They
are documented in the main [README](../README.md) and
[CHANGELOG](../CHANGELOG.md); dedicated example sections are still pending.

12. **`markdown`** — markdown → terminal renderer with themes, tables,
    nested/task lists, autolinks, reference links (v1.4.0–v1.4.7)
    - `markdown.render()`, `parseBlocks()`, `parseInline()`
    - Syntax highlighting for code blocks: `highlight()`, `tokenize()`,
      `isHighlightSupported()` — js/ts/json/bash (v1.4.5)
13. **`panels.grid`** / **`panels.gridAreas`** — CSS Grid-inspired layout with
    `colSpan`, `rowSpan` (mark-and-pack), template areas, per-cell alignment
    (v1.4.1–v1.4.4, v1.4.8)
14. **`panels.flex`** — flexbox-style layout: `justify`
    (start/end/center/between/around/evenly) + `grow` weights (v1.4.7)
15. **`panels.wrap`** — wrapping block flow (greedy bin-packing) (v1.4.8)
16. **`ascii.table`** — auto-layout tables with water-filling column sizing,
    6 border styles, cell wrapping, `minColWidth` (v1.4.8–v1.4.10)
17. **`cursor.scrollRegion`** / **`cursor.batch`** — DECSTBM scroll regions and
    atomic escape-sequence writes (v1.4.8)
18. **Math toolkit** — `lerp`, `smoothstep`, `mod`, `gcd`, `distribute`, and
    more (v1.4.6)

---

## 💡 Running the examples

### TypeScript (`examples-ts.md`)

```bash
# Quickest: tsx (no compile step)
npx tsx my-example.ts

# Or with ts-node
npx ts-node my-example.ts

# Or compile then run
npx tsc my-example.ts && node my-example.js
```

### JavaScript ESM (`examples-mjs.md`)

Either:
- Save the file with `.mjs` extension, OR
- Set `"type": "module"` in your `package.json` and use `.js`

```bash
node my-example.mjs
```

### JavaScript CommonJS (`examples-cjs.md`)

```bash
node my-example.cjs
```

### Showcase (`showcase.md`)

A complete demo app. Save as `.mjs`, run with `node`. Demonstrates how multiple modules compose in a real CLI.

---

## ⚙️ Project setup

For any of these, your `package.json` needs:

```json
{
  "dependencies": {
    "ansimax": "^1.3.2"
  }
}
```

Then `npm install` and pick an example.

---

## 🔗 More resources

- [Main README](../README.md) — overview, badges, comparison table, roadmap
- [CHANGELOG](../CHANGELOG.md) — version history
- [npm package](https://www.npmjs.com/package/ansimax)
- [GitHub](https://github.com/Brashkie/ansimax)

---

<div align="center">

If any example doesn't work, [open an issue](https://github.com/Brashkie/ansimax/issues) — we'll fix it.

</div>
