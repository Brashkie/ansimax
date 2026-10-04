// ─────────────────────────────────────────────
//  ansimax/fuzzy — Typo-tolerant matching & ranking (Phase 11)
//
//  v1.7.2 — Phase 11 begins. Approximate string matching via Myers'
//  bit-parallel Levenshtein algorithm. The classic DP edit-distance
//  matrix has a key property: adjacent cells differ by only {-1, 0, +1}.
//  Myers (1999) exploits that to pack an entire column into bit-vectors
//  (Pv/Mv for the vertical +1/-1 deltas, Ph/Mh for the horizontal ones)
//  and advance one text character per handful of AND/OR/shift ops.
//
//  Result: O(m·⌈n/w⌉) instead of O(m·n) — for a query of ≤ w characters
//  (w = 32 here, JS bitwise width) a whole match is one machine word of
//  work per candidate character. Fast enough to re-rank an autocomplete
//  list on every keystroke without blocking the event loop. Zero deps.
//
//  The search is end-free: the pattern may match any substring of the
//  candidate (first DP row = 0), so "confg" still finds "config file".
//  Patterns longer than 32 chars fall back to a classic banded DP that
//  returns the identical distance — just without the bit-parallel speedup.
// ─────────────────────────────────────────────

/** The JS bitwise register width — the longest pattern the fast path packs. */
const BITS = 32;

/**
 * Minimum edit distance between `pattern` and the *best-matching substring*
 * of `text` (approximate string search, not whole-string Levenshtein). This
 * is the typo-tolerance primitive: `fuzzyDistance('confg', 'config file')`
 * is `1`, because "confg"→"config" is one insertion and the surrounding text
 * is free.
 *
 * Uses Myers' bit-parallel algorithm when `pattern.length ≤ 32`, and an
 * equivalent O(m·n) dynamic-programming fallback for longer patterns.
 *
 * @since 1.7.2
 */
export const fuzzyDistance = (pattern: string, text: string): number => {
  const m = pattern.length;
  if (m === 0) return 0;          // empty pattern matches everywhere, 0 errors
  if (text.length === 0) return m; // nothing to match against → m insertions
  return m <= BITS
    ? _myers(pattern, text)
    : _searchDP(pattern, text);
};

// Myers' bit-parallel approximate search. Tracks the DP value D[m][j] for each
// text position j with the first row pinned to 0, and returns the minimum —
// the error count of the best occurrence ending anywhere in the text.
const _myers = (pattern: string, text: string): number => {
  const m = pattern.length;
  // Peq[c] = bitmask of pattern positions holding character c.
  const peq = new Map<string, number>();
  for (let i = 0; i < m; i++) {
    const ch = pattern[i] as string;
    peq.set(ch, (peq.get(ch) ?? 0) | (1 << i));
  }
  const highBit = 1 << (m - 1);
  let pv = ~0;        // vertical positive deltas — all 1s initially
  let mv = 0;         // vertical negative deltas
  let score = m;      // D[m][0] = m
  let best = m;
  for (let j = 0; j < text.length; j++) {
    const eq = peq.get(text[j] as string) ?? 0;
    const xv = eq | mv;
    const xh = ((((eq & pv) + pv) ^ pv) | eq) >>> 0;
    let ph = (mv | ~(xh | pv)) >>> 0;
    let mh = (pv & xh) >>> 0;
    if (ph & highBit) score++;
    else if (mh & highBit) score--;
    // Shift the horizontal deltas up to feed the next column.
    ph = (ph << 1) >>> 0;
    mh = (mh << 1) >>> 0;
    pv = (mh | ~(xv | ph)) >>> 0;
    mv = (ph & xv) >>> 0;
    if (score < best) best = score;
  }
  return best;
};

// Classic approximate-search DP for patterns longer than the register width.
// First row all-zero (end-free start); answer is the min of the last row.
const _searchDP = (pattern: string, text: string): number => {
  const m = pattern.length;
  const n = text.length;
  let prev = new Array<number>(m + 1);
  let curr = new Array<number>(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;
  let best = m;
  for (let j = 1; j <= n; j++) {
    curr[0] = 0; // starting a match at column j is free
    for (let i = 1; i <= m; i++) {
      const cost = pattern[i - 1] === text[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        (prev[i] as number) + 1,       // deletion from text
        (curr[i - 1] as number) + 1,   // insertion into text
        (prev[i - 1] as number) + cost, // match / substitution
      );
    }
    if ((curr[m] as number) < best) best = curr[m] as number;
    [prev, curr] = [curr, prev];
  }
  return best;
};

/** Options shared by {@link fuzzyMatch}, {@link fuzzyScore} and {@link fuzzySearch}. */
export interface FuzzyOptions {
  /** Maximum edit distance that still counts as a match. Default `2`. */
  maxErrors?: number;
  /** Compare case-sensitively. Default `false` (case-insensitive). */
  caseSensitive?: boolean;
}

const _norm = (s: string, caseSensitive: boolean): string =>
  caseSensitive ? s : s.toLowerCase();

/**
 * Whether `pattern` matches `text` within `maxErrors` edits (default 2),
 * tolerating typos, transposed-as-two-edits, and missing/extra characters.
 *
 * @since 1.7.2
 */
export const fuzzyMatch = (
  pattern: string,
  text: string,
  opts: FuzzyOptions = {},
): boolean => {
  const caseSensitive = opts.caseSensitive === true;
  const max = opts.maxErrors ?? 2;
  return fuzzyDistance(_norm(pattern, caseSensitive), _norm(text, caseSensitive)) <= max;
};

/**
 * A `[0, 1]` relevance score: `1` is an exact substring hit, falling toward
 * `0` as edits accumulate. Returns `0` once the distance exceeds `maxErrors`,
 * so non-matches sort to the bottom. An empty pattern scores `1`.
 *
 * @since 1.7.2
 */
export const fuzzyScore = (
  pattern: string,
  text: string,
  opts: FuzzyOptions = {},
): number => {
  const caseSensitive = opts.caseSensitive === true;
  const p = _norm(pattern, caseSensitive);
  if (p.length === 0) return 1;
  const max = opts.maxErrors ?? 2;
  const d = fuzzyDistance(p, _norm(text, caseSensitive));
  if (d > max) return 0;
  return 1 - d / p.length;
};

/** A ranked hit from {@link fuzzySearch}. @since 1.7.2 */
export interface FuzzyResult<T> {
  /** The original candidate. */
  value: T;
  /** Edit distance of the best-matching substring. */
  distance: number;
  /** Normalized `[0, 1]` relevance (see {@link fuzzyScore}). */
  score: number;
  /** The candidate's index in the input array. */
  index: number;
}

/** Options for {@link fuzzySearch}, extending {@link FuzzyOptions}. */
export interface FuzzySearchOptions<T> extends FuzzyOptions {
  /** Return at most this many hits. Default: all matches. */
  limit?: number;
  /** Extract the searchable string from a non-string candidate. */
  key?: (item: T) => string;
}

/**
 * Rank `candidates` by how well they fuzzy-match `pattern`, keeping only those
 * within `maxErrors` edits. Ties break by shorter candidate, then by original
 * order (a stable sort), so the tightest, most specific hit leads.
 *
 * @example
 * ```js
 * import { fuzzySearch } from 'ansimax';
 *
 * const cmds = ['commit', 'config', 'checkout', 'clone', 'clean'];
 * fuzzySearch('comit', cmds).map((r) => r.value);  // ['commit'] — one typo
 * fuzzySearch('confi', cmds).map((r) => r.value);  // ['config'] — substring
 * ```
 *
 * @since 1.7.2
 */
export const fuzzySearch = <T>(
  pattern: string,
  candidates: readonly T[],
  opts: FuzzySearchOptions<T> = {},
): FuzzyResult<T>[] => {
  const caseSensitive = opts.caseSensitive === true;
  const max = opts.maxErrors ?? 2;
  const key = opts.key;
  const p = _norm(pattern, caseSensitive);

  const hits: FuzzyResult<T>[] = [];
  for (let index = 0; index < candidates.length; index++) {
    const value = candidates[index] as T;
    const raw = key ? key(value) : String(value);
    const text = _norm(raw, caseSensitive);
    const distance = fuzzyDistance(p, text);
    if (distance > max) continue;
    const score = p.length === 0 ? 1 : 1 - distance / p.length;
    hits.push({ value, distance, score, index });
  }

  hits.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    const la = key ? key(a.value).length : String(a.value).length;
    const lb = key ? key(b.value).length : String(b.value).length;
    if (la !== lb) return la - lb;
    return a.index - b.index;
  });

  return opts.limit !== undefined ? hits.slice(0, Math.max(0, opts.limit)) : hits;
};
