import {
  fuzzyDistance, fuzzyMatch, fuzzyScore, fuzzySearch,
} from '../fuzzy/index.js';

// Brute-force reference: minimum edit distance between `pattern` and ANY
// substring of `text` (approximate string search). Used to pin the
// bit-parallel implementation and its DP fallback to a known-correct answer.
const refDistance = (pattern: string, text: string): number => {
  if (pattern.length === 0) return 0;
  const edit = (a: string, b: string): number => {
    const m = a.length;
    const n = b.length;
    const d: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i]![0] = i;
    for (let j = 0; j <= n; j++) d[0]![j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + c);
      }
    }
    return d[m]![n]!;
  };
  let best = pattern.length;
  for (let s = 0; s <= text.length; s++) {
    for (let e = s; e <= text.length; e++) {
      best = Math.min(best, edit(pattern, text.slice(s, e)));
    }
  }
  return best;
};

describe('fuzzyDistance (v1.7.2)', () => {
  it('is 0 for an exact substring hit', () => {
    expect(fuzzyDistance('git', 'github')).toBe(0);
    expect(fuzzyDistance('hub', 'github')).toBe(0);
  });

  it('counts single-edit typos', () => {
    expect(fuzzyDistance('confg', 'config file')).toBe(1); // one insertion
    expect(fuzzyDistance('color', 'colour')).toBe(1);      // one deletion
    expect(fuzzyDistance('comit', 'commit')).toBe(1);      // one insertion
  });

  it('returns pattern length against empty text', () => {
    expect(fuzzyDistance('abc', '')).toBe(3);
  });

  it('returns 0 for an empty pattern', () => {
    expect(fuzzyDistance('', 'anything')).toBe(0);
    expect(fuzzyDistance('', '')).toBe(0);
  });

  it('matches the brute-force reference on many random cases', () => {
    const alpha = 'abcde';
    const rnd = (n: number): string =>
      Array.from({ length: n }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('');
    for (let k = 0; k < 2000; k++) {
      const p = rnd(1 + Math.floor(Math.random() * 8));
      const t = rnd(Math.floor(Math.random() * 12));
      expect(fuzzyDistance(p, t)).toBe(refDistance(p, t));
    }
  });

  it('agrees with the reference at the 32-char register boundary', () => {
    const p32 = 'a'.repeat(31) + 'b';
    expect(fuzzyDistance(p32, 'z' + p32 + 'z')).toBe(0);
    expect(fuzzyDistance(p32, p32.slice(0, 31) + 'c')).toBe(refDistance(p32, p32.slice(0, 31) + 'c'));
  });

  it('uses the DP fallback for patterns longer than 32 chars', () => {
    const p = 'a'.repeat(40);
    const text = 'x' + 'a'.repeat(40) + 'y';
    expect(fuzzyDistance(p, text)).toBe(0);
    const oneOff = 'a'.repeat(39) + 'b';
    expect(fuzzyDistance(p, 'z' + oneOff)).toBe(refDistance(p, 'z' + oneOff));
  });
});

describe('fuzzyMatch (v1.7.2)', () => {
  it('accepts matches within the default 2 edits', () => {
    expect(fuzzyMatch('comit', 'commit')).toBe(true);
    expect(fuzzyMatch('confg', 'config')).toBe(true);
  });

  it('rejects matches beyond the error budget', () => {
    expect(fuzzyMatch('zzz', 'commit')).toBe(false);
  });

  it('honors a custom maxErrors', () => {
    expect(fuzzyMatch('cfg', 'config', { maxErrors: 1 })).toBe(false);
    expect(fuzzyMatch('cfg', 'config', { maxErrors: 2 })).toBe(true);
  });

  it('is case-insensitive by default and case-sensitive on request', () => {
    expect(fuzzyMatch('GIT', 'github')).toBe(true);
    expect(fuzzyMatch('GIT', 'github', { caseSensitive: true })).toBe(false);
  });
});

describe('fuzzyScore (v1.7.2)', () => {
  it('scores an exact hit as 1', () => {
    expect(fuzzyScore('git', 'github')).toBe(1);
  });

  it('decreases as edits accumulate', () => {
    expect(fuzzyScore('color', 'colour')).toBeCloseTo(0.8, 10);
  });

  it('scores a non-match (past the cap) as 0', () => {
    expect(fuzzyScore('zzz', 'commit')).toBe(0);
  });

  it('scores an empty pattern as 1', () => {
    expect(fuzzyScore('', 'whatever')).toBe(1);
  });
});

describe('fuzzySearch (v1.7.2)', () => {
  const cmds = ['commit', 'config', 'checkout', 'clone', 'clean'];

  it('ranks a clear typo to a single best hit', () => {
    expect(fuzzySearch('comit', cmds).map((r) => r.value)).toEqual(['commit']);
  });

  it('finds a substring match', () => {
    // "confi" is a substring of "config" (distance 0). Tightening the budget
    // to 1 error isolates that exact hit — "commit" is distance 2 ("commi" vs
    // "confi" is two substitutions), a valid match only under the default cap.
    expect(fuzzySearch('confi', cmds, { maxErrors: 1 }).map((r) => r.value)).toEqual(['config']);
    // Under the default 2-error budget, "commit" also qualifies; "config"
    // still ranks first on the smaller distance.
    expect(fuzzySearch('confi', cmds)[0]!.value).toBe('config');
  });

  it('returns no hits when nothing is within range', () => {
    expect(fuzzySearch('zzzzz', cmds)).toHaveLength(0);
  });

  it('respects the limit', () => {
    expect(fuzzySearch('clen', cmds, { limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it('breaks ties by shorter candidate, then original order', () => {
    // All five are distance 2 from "cfg"; the two length-5 names lead, in order.
    const ranked = fuzzySearch('cfg', cmds).map((r) => r.value);
    expect(ranked.slice(0, 2)).toEqual(['clone', 'clean']);
  });

  it('attaches value, distance, score, and index', () => {
    const [hit] = fuzzySearch('comit', cmds);
    expect(hit).toBeDefined();
    expect(hit!.value).toBe('commit');
    expect(hit!.distance).toBe(1);
    expect(hit!.score).toBeCloseTo(1 - 1 / 5, 10);
    expect(hit!.index).toBe(0);
  });

  it('searches objects via a key extractor', () => {
    const items = [{ name: 'config' }, { name: 'commit' }];
    const hits = fuzzySearch('confi', items, { key: (o) => o.name });
    expect(hits[0]!.value.name).toBe('config');
  });

  it('is case-insensitive by default', () => {
    expect(fuzzySearch('COMMIT', cmds).map((r) => r.value)).toEqual(['commit']);
  });

  it('treats a zero/negative limit as empty', () => {
    expect(fuzzySearch('comit', cmds, { limit: 0 })).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
//  v1.9.5 — hoisted pattern table
//
//  fuzzySearch now builds the pattern's Myers bitmask once instead of once
//  per candidate, and carries each candidate's length for the comparator
//  rather than re-deriving it on every comparison. Results must be identical;
//  these pin the paths the hoisted helper can take.
// ─────────────────────────────────────────────
describe('fuzzySearch hoisted pattern table (v1.9.5)', () => {
  const pool = ['commit', 'comit', 'commits', 'command', 'config', '', 'x'.repeat(50)];

  it('matches the per-call distance exactly', () => {
    for (const candidate of pool) {
      const viaSearch = fuzzySearch('commit', [candidate], { maxErrors: 10 });
      const direct = fuzzyDistance('commit', candidate);
      if (viaSearch.length > 0) expect(viaSearch[0]!.distance).toBe(direct);
    }
  });

  it('handles an empty pattern (distance 0 for everything)', () => {
    const hits = fuzzySearch('', pool);
    expect(hits).toHaveLength(pool.length);
    expect(hits.every((h) => h.distance === 0 && h.score === 1)).toBe(true);
  });

  it('handles empty candidates', () => {
    const hits = fuzzySearch('ab', ['', 'ab'], { maxErrors: 2 });
    expect(hits.map((h) => h.value)).toEqual(['ab', '']);
    expect(hits[1]!.distance).toBe(2); // empty text → m insertions
  });

  it('handles a pattern longer than the 32-bit register (DP fallback)', () => {
    const long = 'a'.repeat(40);
    const hits = fuzzySearch(long, [long, `${long}b`, 'nope'], { maxErrors: 1 });
    expect(hits.map((h) => h.value)).toEqual([long, `${long}b`]);
    expect(hits[0]!.distance).toBe(0);
  });

  it('keeps the documented ordering: distance, then length, then input order', () => {
    // Search is end-free, so 'commit' occurs exactly inside 'commits' —
    // distance 0 for both, and the shorter candidate wins the tie.
    const hits = fuzzySearch('commit', ['commits', 'commit', 'comit'], { maxErrors: 2 });
    expect(hits.map((h) => h.value)).toEqual(['commit', 'commits', 'comit']);
    expect(hits.map((h) => h.distance)).toEqual([0, 0, 1]);
  });

  it('breaks a length tie by input order', () => {
    const hits = fuzzySearch('ab', ['xab', 'yab', 'zab'], { maxErrors: 0 });
    expect(hits.map((h) => h.value)).toEqual(['xab', 'yab', 'zab']);
  });

  it('orders identically when a key() accessor is used', () => {
    const objs = [{ n: 'commits' }, { n: 'commit' }, { n: 'comit' }];
    const hits = fuzzySearch('commit', objs, { key: (o) => o.n, maxErrors: 2 });
    expect(hits.map((h) => h.value.n)).toEqual(['commit', 'commits', 'comit']);
  });

  it('respects limit and caseSensitive unchanged', () => {
    expect(fuzzySearch('commit', pool, { limit: 2 })).toHaveLength(2);
    expect(fuzzySearch('COMMIT', ['commit'], { caseSensitive: true, maxErrors: 0 })).toHaveLength(0);
    expect(fuzzySearch('COMMIT', ['commit'], { caseSensitive: false, maxErrors: 0 })).toHaveLength(1);
    expect(fuzzySearch('commit', pool, { limit: 0 })).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
//  v1.10.0 — character prefilter (Phase 11)
//
//  A pattern position whose character is absent from the candidate costs at
//  least one error, so summing those gives a lower bound and a candidate over
//  maxErrors can be skipped without running Myers. Characters are hashed into
//  64 buckets, so a collision can only make the filter MISS a rejection —
//  never make a wrong one. These tests pin that the results are unchanged.
// ─────────────────────────────────────────────
describe('fuzzySearch character prefilter (v1.10.0)', () => {
  const diverse: string[] = [];
  const parts = ['react', 'vue', 'svelte', 'webpack', 'rollup', 'esbuild', 'babel',
    'eslint', 'prettier', 'jest', 'typescript', 'lodash', 'axios', 'express', 'zod'];
  for (let i = 0; i < 40; i++) for (const p of parts) diverse.push(`${p}-${i.toString(36)}`);

  const bruteForce = (pattern: string, pool: string[], max: number) =>
    pool.filter((c) => fuzzyDistance(pattern.toLowerCase(), c.toLowerCase()) <= max);

  it('never drops a candidate that actually matches', () => {
    for (const pattern of ['react', 'zod', 'prettier', 'axios', 'esbuild']) {
      for (const max of [0, 1, 2, 3]) {
        const found = fuzzySearch(pattern, diverse, { maxErrors: max }).map((h) => h.value);
        expect(found.slice().sort()).toEqual(bruteForce(pattern, diverse, max).sort());
      }
    }
  });

  it('returns nothing for a pattern no candidate can match', () => {
    expect(fuzzySearch('qqzzxxjj', diverse, { maxErrors: 2 })).toEqual([]);
  });

  it('is unaffected when every candidate shares the pattern characters', () => {
    // Homogeneous pool: the filter rejects nothing and switches itself off
    // after its probe window. Results must be identical either way.
    const homogeneous: string[] = [];
    for (let i = 0; i < 600; i++) homogeneous.push(`module-${i.toString(36)}-handler`);
    const found = fuzzySearch('modhandler', homogeneous, { maxErrors: 2 }).map((h) => h.value);
    expect(found.slice().sort()).toEqual(bruteForce('modhandler', homogeneous, 2).sort());
  });

  it('survives crossing the probe window with a pool larger than it', () => {
    const pool = [...diverse, ...diverse, ...diverse]; // > 256 candidates
    const found = fuzzySearch('react', pool, { maxErrors: 1 });
    expect(found.length).toBe(bruteForce('react', pool, 1).length);
  });

  it('keeps working with non-ASCII, empty and odd candidates', () => {
    const pool = ['', 'x', '日本語', ' spaces ', 'ñandú', '😀emoji', 'react'];
    for (const pattern of ['react', '日本', 'ñ', '', '😀']) {
      for (const max of [0, 2]) {
        const found = fuzzySearch(pattern, pool, { maxErrors: max }).map((h) => h.value);
        expect(found.slice().sort()).toEqual(bruteForce(pattern, pool, max).sort());
      }
    }
  });

  it('stays exact when maxErrors is at or above the pattern length', () => {
    // The filter cannot reject anything here, so every candidate is kept.
    const found = fuzzySearch('zod', diverse, { maxErrors: 3 });
    expect(found.length).toBe(bruteForce('zod', diverse, 3).length);
  });

  it('is unaffected by caseSensitive and key()', () => {
    const objs = diverse.map((n, i) => ({ n, i }));
    const viaKey = fuzzySearch('REACT', objs, { key: (o) => o.n, maxErrors: 1 }).map((h) => h.value.n);
    const direct = fuzzySearch('REACT', diverse, { maxErrors: 1 }).map((h) => h.value);
    expect(viaKey).toEqual(direct);
    expect(fuzzySearch('REACT', diverse, { caseSensitive: true, maxErrors: 0 })).toEqual([]);
  });
});
