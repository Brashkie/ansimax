#!/usr/bin/env node
/**
 * ansimax benchmark harness — zero dependencies, like the library itself.
 *
 *   npm run bench                  run every suite, print a table
 *   npm run bench -- --json        emit JSON (for CI / baselines)
 *   npm run bench -- --save        write the result to bench/baseline.json
 *   npm run bench -- --check       compare against the baseline, exit 1 on regression
 *   npm run bench -- --filter=wrap only cases whose name matches
 *
 * Two measurement rules this harness enforces, because getting them wrong
 * produces numbers that look great and mean nothing:
 *
 *  1. CONSUME THE RESULT. V8 deletes work whose result is never used. An
 *     earlier hand-rolled run showed cache *misses* beating cache *hits*,
 *     which was pure dead-code elimination.
 *  2. ROTATE THE INPUT. With a constant argument and a pure function, V8
 *     hoists the call out of the loop (loop-invariant code motion) and you
 *     end up timing one call amortized over N iterations — we measured an
 *     "0.06 µs" grapheme segmentation that way, which is impossible.
 *
 * So every case supplies an array of inputs and returns a number.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../dist/index.js');

const args = process.argv.slice(2);
const hasFlag = (f) => args.includes(f);
const flagValue = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const asJson = hasFlag('--json');
const save = hasFlag('--save');
const check = hasFlag('--check');
const filter = flagValue('filter');
const BASELINE = new URL('./baseline.json', import.meta.url);

// Regression threshold: a case may get this much slower before we fail.
// Generous because CI machines are noisy; it still catches a real blowup.
const TOLERANCE = 1.5;

let sink = 0;

/**
 * Time one case. `inputs` is rotated so V8 cannot hoist the call, and the
 * returned number is accumulated so it cannot eliminate the work.
 */
const measure = (fn, inputs, iterations) => {
  const n = inputs.length;
  for (let i = 0; i < Math.min(iterations, 500); i++) sink += fn(inputs[i % n]); // warm up

  // Three samples, keep the best — the minimum is the least noisy estimator
  // for "how fast can this go", which is what we want to track.
  let best = Infinity;
  for (let pass = 0; pass < 3; pass++) {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) sink += fn(inputs[i % n]);
    const us = Number(process.hrtime.bigint() - t0) / 1e3 / iterations;
    if (us < best) best = us;
  }
  return best;
};

// ── inputs ───────────────────────────────────────────────
// Each case gets several distinct inputs of the same shape.
const VARIANTS = 16;
const vary = (make) => Array.from({ length: VARIANTS }, (_, i) => make(i));

const word = vary((i) => `consectetur${i}`);
const paragraph = vary((i) =>
  (`lorem${i} ipsum dolor sit amet consectetur adipiscing elit sed do `.repeat(200)).slice(0, 1000));
const colored = paragraph.map((p) => lib.gradient(p, ['#ff0000', '#0000ff']));
const cjk = vary((i) => `日本語テキスト${i}`.repeat(10));
const emoji = vary((i) => `😀👍🏽${i}`.repeat(30));
const cells = vary((i) => lib.color.hex(`status ${i}: ok`, '#00ff88'));

const frame = (seed, w, h) => Array.from({ length: h }, (_, r) =>
  Array.from({ length: w }, (_, c) => String.fromCharCode(97 + ((r * w + c + seed) % 26))).join(''));
const framesPrev = vary((i) => frame(i, 80, 24));
const framesNext = framesPrev.map((rows) => {
  const next = rows.slice();
  next[12] = `${next[12].slice(0, 10)}CHANGED!!!${next[12].slice(20)}`;
  return next;
});
const framePairs = framesPrev.map((prev, i) => [prev, framesNext[i]]);

const candidates = (count) => {
  const list = [];
  for (let i = 0; i < count; i++) list.push(`module-${i.toString(36)}-handler`);
  return list;
};
const pool1k = candidates(1000);
const pool20k = candidates(20000);
// A diverse pool, where the character prefilter can actually reject.
const diversePool = (() => {
  const parts = ['react','vue','svelte','webpack','rollup','esbuild','babel','eslint',
    'prettier','jest','typescript','lodash','axios','express','zod','chalk','figlet','sharp'];
  const out = [];
  for (let i = 0; out.length < 20000; i++) for (const p of parts) out.push(`${p}-${i.toString(36)}`);
  return out.slice(0, 20000);
})();
const diverseQueries = vary((i) => ['react', 'zod', 'prettier', 'axios'][i % 4]);
const missQueries = vary((i) => `qqzzxxjj${i % 4}`);
const queries = vary((i) => `modhandler${i % 4}`);

// Chart inputs. Each variant is a distinct series so V8 cannot hoist the call.
const series200 = vary((i) =>
  Array.from({ length: 200 }, (_, x) => Math.sin((x + i) / 9) * 50 + Math.cos(x / 3) * 8 + 60));
const stacked3 = vary((i) => [
  { name: 'ok', values: series200[i].slice(0, 24) },
  { name: 'warn', values: series200[i].slice(24, 48) },
  { name: 'err', values: series200[i].slice(48, 72) },
]);
const grids = vary((i) =>
  Array.from({ length: 20 }, (_, r) =>
    Array.from({ length: 40 }, (_, c) => ((r * 40 + c + i) % 97) / 97)));
const cloud2k = vary((i) =>
  Array.from({ length: 2000 }, (_, n) => [(n * 7 + i) % 211, (n * 13 + i) % 173]));
const pies = vary((i) =>
  [3, 5, 8, 13].map((v, k) => ({ label: `s${k}`, value: v + (i % 5) })));
const scalars = vary((i) => Math.sin(i) * 40 + 50);
const stream = lib.createStreamChart({ width: 80, height: 12 });

// A 64x48 baseline JPEG, 4:2:0, quality 50, written by libjpeg.
const JPEG_FIXTURE =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1R' +
  'V19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2Nj' +
  'Y2NjY2NjY2NjY2NjY2P/wAARCAAwAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAA' +
  'AgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6' +
  'Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA' +
  'AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5' +
  'OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPE' +
  'xcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDh0iqdIParEcVWo4PataNP2hEK1imlv7VO' +
  'lr7Vb2KhxjJ9Kesbt3x9K3lCjB8u78jtp1mVltQOTgfWpFgQdSPwqytuq43cVMkY/hT86zkoLRxSf3/kd9Or5lUQJ2BP0FTJ' +
  'An91vyqyImGM4X8KkSPnqx+lZvkT1S+5f53O+nVMeGL2q1s2KMDk1JBF04qYRbpDx04oo1HCiuXd6HwMKmpXit/WplQk4QYH' +
  'rVjyiW2DoOtSiPHyr17mk5qK5Y6Jfe32R3U6pWWFU4xk+lTLG2Mn5RU6w7MADLVKsODz8zelYufLpt/XfdvyR6FOqV0hH8K5' +
  '9zUqx++f92rAiPRuf9kVKseOOnsOtZOpbTb+v63bfkd9OqZMEeBkjpUsUW1C2OlTxR4iPFTCLhV/GlCpaEWt0vz0PgYVSukW' +
  'xOOp6VKkWwAAfMasrF8xJ6LUiREDP8TdKlz5dun9P5t6I7qdUrpFj5V69z6VKkWOFwB3arCw4+UdB1NSLFnBI47D1rFzt/X9' +
  'fN7t6I9CnVIEiwOPlHr61KkWB02j9TVhYT36/oKkWPv+vc1m6lv6/r+t29jvp1T/2Q==';

// Phase 12 inputs. Each variant differs so nothing can be hoisted or cached.
const pixelGrids = vary((i) =>
  Array.from({ length: 96 }, (_, y) =>
    Array.from({ length: 128 }, (_, x) => ({
      r: (x * 2 + i) & 255, g: (y * 2 + i * 3) & 255, b: (x ^ y) & 255,
    }))));
const scanlineBlobs = vary((i) => {
  const w = 128;
  const h = 96;
  const out = new Uint8Array(h * (1 + w * 3));
  let at = 0;
  for (let y = 0; y < h; y++) {
    out[at++] = 0;
    for (let x = 0; x < w; x++) {
      out[at++] = (x * 2 + i) & 255;
      out[at++] = (y * 2) & 255;
      out[at++] = (x ^ y) & 255;
    }
  }
  return out;
});
const packedBlobs = scanlineBlobs.map((d) => lib.deflate(d, { level: 6 }));
const rawBlobs = scanlineBlobs;
const pngFiles = pixelGrids.map((g) => lib.encodePNG(g));
// A JPEG to decode has to come from somewhere, and this library has no
// encoder — so one is built here from a PNG round trip through the only
// encoder available: none. Instead, decode cost is measured on a synthetic
// baseline file assembled once at startup from a fixed fixture.
// The library has no JPEG encoder, so the variants cannot be generated — all
// 16 are the same fixture. That is acceptable here only because decoding
// allocates a fresh pixel grid per call, so there is no pure result for V8 to
// hoist out of the loop; the measured work is real.
const jpegFiles = (() => {
  const bytes = Buffer.from(JPEG_FIXTURE, 'base64');
  return Array.from({ length: VARIANTS }, () => new Uint8Array(bytes));
})();
const barcodeTexts = vary((i) => `ANSIMAX-${i}-${(i * 7919) % 100000}`);

// Phase 11 inputs. `passwordStrength` runs on *every keystroke* of a password
// prompt, so its per-call cost is the one that decides whether the meter feels
// instant. Rotate through lengths and character classes, since the score walks
// the string once per class it finds.
const PW_ALPHABETS = [
  'abcdefghijklmnopqrstuvwxyz',
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.<>?/~`',
];
const passwords = vary((i) => {
  const alphabet = PW_ALPHABETS[i % PW_ALPHABETS.length];
  const length = 6 + (i % 27);
  let out = '';
  for (let c = 0; c < length; c++) {
    out += alphabet[(i * 31 + c * 17) % alphabet.length];
  }
  return out;
});
const promptDates = vary((i) => new Date(2020 + (i % 12), i % 12, 1 + (i % 28), i % 24, i % 60));
const eanDigits = vary((i) => String(400638133393 + i).padStart(12, '0').slice(0, 12));

// ── cases ────────────────────────────────────────────────
const cases = [
  // The width machinery — everything that lays out text depends on it.
  ['visibleLen/ascii-word', (s) => lib.visibleLen(s), word, 100_000],
  ['visibleLen/ascii-1kb', (s) => lib.visibleLen(s), paragraph, 20_000],
  ['visibleLen/colored-1kb', (s) => lib.visibleLen(s), colored, 5_000],
  ['visibleLen/colored-cell', (s) => lib.visibleLen(s), cells, 100_000],
  ['visibleLen/cjk', (s) => lib.visibleLen(s), cjk, 5_000],
  ['visibleLen/emoji', (s) => lib.visibleLen(s), emoji, 5_000],
  ['charWidth/ascii', (s) => lib.charWidth(s[0]), word, 200_000],

  // Wrapping sits directly on top of it.
  ['wrapAnsi/1kb-80', (s) => lib.wrapAnsi(s, 80).length, paragraph, 5_000],
  ['wrapAnsi/colored-1kb-80', (s) => lib.wrapAnsi(s, 80).length, colored, 1_000],
  ['balancedWrap/1kb-80', (s) => lib.balancedWrap(s, 80).length, paragraph, 1_000],

  // Colour.
  ['color/hex', (s) => lib.color.hex(s, '#ff8800').length, word, 100_000],
  ['gradient/80-chars', (s) => lib.gradient(s.slice(0, 80), ['#f00', '#00f']).length, paragraph, 20_000],
  ['stripAnsi/colored-1kb', (s) => lib.stripAnsi(s).length, colored, 20_000],

  // Frame diffing — the render hot path.
  ['renderFrame/80x24-1-edit', (p) => lib.renderFrame(p[0], p[1]).length, framePairs, 20_000],

  // Fuzzy search — linear scan today; this is the case the trie should fix.
  ['fuzzySearch/1k-candidates', (q) => lib.fuzzySearch(q, pool1k, { limit: 10 }).length, queries, 500],
  ['fuzzySearch/20k-candidates', (q) => lib.fuzzySearch(q, pool20k, { limit: 10 }).length, queries, 60],
  ['fuzzySearch/20k-diverse', (q) => lib.fuzzySearch(q, diversePool, { limit: 10 }).length, diverseQueries, 60],
  ['fuzzySearch/20k-no-match', (q) => lib.fuzzySearch(q, diversePool, { limit: 10 }).length, missQueries, 60],

  // Charts (Phase 10, completed in v1.10.0). A dashboard redraws these every
  // frame, so the per-render cost is what decides the achievable frame rate.
  ['areaChart/200x80x20', (s) => lib.areaChart(s, { width: 80, height: 20 }).length, series200, 2_000],
  ['barChart/3x24-stacked', (s) => lib.barChart(s, { mode: 'stacked', height: 24 }).length, stacked3, 2_000],
  ['heatmap/40x20', (g) => lib.heatmap(g, { cellWidth: 2 }).length, grids, 2_000],
  ['scatterPlot/2k-braille', (p) => lib.scatterPlot(p, { width: 80, height: 20 }).length, cloud2k, 1_000],
  ['pieChart/r15', (s) => lib.pieChart(s, { radius: 15 }).length, pies, 2_000],
  ['streamChart/push-render', (v) => { stream.push(v); return stream.render().length; }, scalars, 5_000],

  // Phase 12 codecs, completed in v1.10.0. These are the heavy ones: a
  // terminal image goes through decode, quantization and an encoder.
  ['deflate/scanlines-48k', (d) => lib.deflate(d, { level: 6 }).length, scanlineBlobs, 20],
  ['inflate/scanlines-48k', (d) => lib.inflate(d).length, packedBlobs, 60],
  ['png/encode-128x96', (g) => lib.encodePNG(g).length, pixelGrids, 20],
  ['png/decode-128x96', (f) => lib.decodePNG(f).width, pngFiles, 20],
  ['jpeg/decode-64x48', (f) => lib.decodeJPEG(f).width, jpegFiles, 20],
  ['sixel/encode-128x96', (g) => lib.encodeSixel(g, { maxColors: 64 }).length, pixelGrids, 10],
  ['medianCut/128x96-64', (g) => lib.medianCutPalette(g, { maxColors: 64 }).length, pixelGrids, 10],
  ['barcode/code128', (s) => lib.encodeCode128(s).width, barcodeTexts, 20_000],
  ['barcode/ean13', (s) => lib.encodeEAN13(s).width, eanDigits, 50_000],
  ['base64/48k', (d) => lib.base64Encode(d).length, rawBlobs, 200],

  // Phase 11 prompts, completed in v1.10.0. Only the pure parts are
  // measurable without a terminal — and they are the ones in the hot path:
  // the strength meter is recomputed on every keystroke.
  ['passwordStrength/6-32-chars', (p) => lib.passwordStrength(p).bits, passwords, 50_000],
  ['formatISODate', (d) => lib.formatISODate(d).length, promptDates, 200_000],
  ['formatTime', (d) => lib.formatTime(d).length, promptDates, 200_000],

  // QR symbols (Phase 12, new in v1.10.0).
  ['qr/encode-url', (s) => lib.encodeQR(s, { level: 'M' }).size, vary((i) => `https://example.com/p/${i}`), 300],
  ['qr/encode-v10', (s) => lib.encodeQR(s, { level: 'L', version: 10 }).size, vary((i) => `${'a'.repeat(200)}${i}`), 100],
  ['qr/render-url', (s) => lib.renderQR(s, { level: 'M' }).length, vary((i) => `https://example.com/p/${i}`), 300],
];

// ── run ──────────────────────────────────────────────────
const selected = filter ? cases.filter(([name]) => name.includes(filter)) : cases;
const results = {};

for (const [name, fn, inputs, iterations] of selected) {
  results[name] = Number(measure(fn, inputs, iterations).toFixed(4));
}

const meta = {
  version: require('../package.json').version,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  date: new Date().toISOString(),
};

if (asJson) {
  console.log(JSON.stringify({ meta, results }, null, 2));
} else {
  console.log(`\nansimax ${meta.version} — ${meta.node} on ${meta.platform}\n`);
  console.log(`${'case'.padEnd(30)}${'µs/op'.padStart(12)}${'ops/sec'.padStart(14)}`);
  console.log('─'.repeat(56));
  for (const [name, us] of Object.entries(results)) {
    const ops = Math.round(1e6 / us).toLocaleString('en-US');
    console.log(`${name.padEnd(30)}${us.toFixed(3).padStart(12)}${ops.padStart(14)}`);
  }
  console.log();
}

if (save) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(BASELINE, `${JSON.stringify({ meta, results }, null, 2)}\n`);
  if (!asJson) console.log(`baseline written to bench/baseline.json\n`);
}

if (check) {
  const { readFileSync, existsSync } = await import('node:fs');
  if (!existsSync(BASELINE)) {
    console.error('No bench/baseline.json — run `npm run bench -- --save` first.');
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const regressions = [];
  const improvements = [];
  for (const [name, us] of Object.entries(results)) {
    const was = base.results[name];
    if (was === undefined) continue;
    const ratio = us / was;
    if (ratio > TOLERANCE) regressions.push([name, was, us, ratio]);
    else if (ratio < 1 / TOLERANCE) improvements.push([name, was, us, ratio]);
  }
  for (const [name, was, now, ratio] of improvements) {
    console.log(`  faster  ${name.padEnd(28)} ${was.toFixed(3)} → ${now.toFixed(3)} µs  (${(1 / ratio).toFixed(1)}x)`);
  }
  if (regressions.length > 0) {
    console.error(`\n${regressions.length} regression(s) beyond ${TOLERANCE}x:\n`);
    for (const [name, was, now, ratio] of regressions) {
      console.error(`  SLOWER  ${name.padEnd(28)} ${was.toFixed(3)} → ${now.toFixed(3)} µs  (${ratio.toFixed(2)}x)`);
    }
    process.exit(1);
  }
  console.log('\nno regressions\n');
}

if (sink === Number.MIN_SAFE_INTEGER) console.log('unreachable'); // keep `sink` alive
