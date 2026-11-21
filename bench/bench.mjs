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
const queries = vary((i) => `modhandler${i % 4}`);

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
