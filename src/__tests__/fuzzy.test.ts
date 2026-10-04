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
