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
