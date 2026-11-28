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
    ? _myers(pattern, text, _buildPeq(pattern))
    : _searchDP(pattern, text);
};

// Same distance as {@link fuzzyDistance}, with the pattern's bitmask table
// supplied by the caller. Lets a batch search hoist that table out of its
// loop; the result is bit-for-bit identical.
const _distanceWith = (
  pattern: string,
  text: string,
  peq: Map<string, number>,
): number => {
  const m = pattern.length;
  if (m === 0) return 0;
  if (text.length === 0) return m;
  return m <= BITS ? _myers(pattern, text, peq) : _searchDP(pattern, text);
};

// Myers' bit-parallel approximate search. Tracks the DP value D[m][j] for each
// text position j with the first row pinned to 0, and returns the minimum —
// the error count of the best occurrence ending anywhere in the text.
// Peq[c] = bitmask of pattern positions holding character c. Depends only on
// the pattern, so a repeated search (fuzzySearch over N candidates) builds it
// once instead of N times — see _distanceWith.
const _buildPeq = (pattern: string): Map<string, number> => {
  const peq = new Map<string, number>();
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i] as string;
    peq.set(ch, (peq.get(ch) ?? 0) | (1 << i));
  }
  return peq;
};

const _myers = (pattern: string, text: string, peq: Map<string, number>): number => {
  const m = pattern.length;
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


// ─────────────────────────────────────────────
//  Character prefilter (v1.10.0)
//
//  A necessary condition for an occurrence within k errors: every pattern
//  position whose character is absent from the candidate costs at least one
//  error. Summing those gives a lower bound, so a candidate exceeding k can be
//  rejected without running Myers at all.
//
//  The roadmap planned a trie + Levenshtein automaton here, but that cannot
//  work: this is an END-FREE search (see _searchDP, where `curr[0] = 0` makes
//  starting a match at any position free), so the pattern is sought INSIDE the
//  candidate and any subtree may still hold an occurrence further along — a
//  prefix's minimum never licenses pruning it. A prefilter does work, because
//  it reasons about the candidate as a whole rather than about prefixes.
//
//  Characters are hashed into 64 buckets. Collisions only make the filter
//  miss a rejection, never cause a wrong one, so the result is always exact.
// ─────────────────────────────────────────────

const PREFILTER_BUCKETS = 64;
/** Candidates probed before deciding whether the filter earns its keep. */
const PREFILTER_PROBE = 256;
/** Below this rejection rate the filter costs more than it saves. */
const PREFILTER_MIN_RATE = 0.1;

const _bucket = (code: number): number => code & (PREFILTER_BUCKETS - 1);

/** Pattern positions per bucket, as a compact list of the buckets in use. */
const _patternBuckets = (pattern: string): [number, number][] => {
  const counts = new Uint8Array(PREFILTER_BUCKETS);
  for (let i = 0; i < pattern.length; i++) {
    const b = _bucket(pattern.charCodeAt(i));
    // Saturate rather than wrap: the bound only has to be valid, not exact.
    if ((counts[b] as number) < 255) counts[b] = (counts[b] as number) + 1;
  }
  const used: [number, number][] = [];
  for (let b = 0; b < PREFILTER_BUCKETS; b++) {
    const c = counts[b] as number;
    if (c > 0) used.push([b, c]);
  }
  return used;
};

/** True when the candidate provably cannot match within `max` errors. */
const _prefilterRejects = (used: [number, number][], text: string, max: number): boolean => {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < text.length; i++) {
    const b = _bucket(text.charCodeAt(i));
    if (b < 32) lo |= 1 << b;
    else hi |= 1 << (b - 32);
  }
  let missing = 0;
  for (let i = 0; i < used.length; i++) {
    const entry = used[i] as [number, number];
    const b = entry[0];
    const present = b < 32 ? (lo >>> b) & 1 : (hi >>> (b - 32)) & 1;
    if (present === 0) {
      missing += entry[1];
      if (missing > max) return true;
    }
  }
  return false;
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

  // v1.9.5: the pattern's bitmask table is built once here rather than inside
  // every _myers call — it depends only on the pattern, so scanning 20,000
  // candidates was rebuilding the identical Map 20,000 times.
  const peq = _buildPeq(p);

  // v1.10.0 prefilter. It is pure overhead when every candidate shares the
  // pattern's characters, so it watches its own rejection rate over the first
  // PREFILTER_PROBE candidates and switches itself off if it isn't paying.
  const patternBuckets = _patternBuckets(p);
  let filterOn = p.length > 0 && max < p.length;
  let probed = 0;
  let rejected = 0;

  // Candidate length is carried alongside each hit because the comparator
  // below needs it: deriving it there re-ran `key(value)` on every single
  // comparison, i.e. O(n log n) times instead of once per candidate.
  const hits: FuzzyResult<T>[] = [];
  const lengths: number[] = [];
  for (let index = 0; index < candidates.length; index++) {
    const value = candidates[index] as T;
    const raw = key ? key(value) : String(value);
    const text = _norm(raw, caseSensitive);

    if (filterOn) {
      const skip = _prefilterRejects(patternBuckets, text, max);
      probed++;
      if (skip) rejected++;
      if (probed === PREFILTER_PROBE && rejected / probed < PREFILTER_MIN_RATE) filterOn = false;
      if (skip) continue;
    }

    const distance = _distanceWith(p, text, peq);
    if (distance > max) continue;
    const score = p.length === 0 ? 1 : 1 - distance / p.length;
    lengths.push(raw.length);
    hits.push({ value, distance, score, index });
  }

  // Sort an index permutation so each hit keeps its precomputed length.
  const order = hits.map((_, i) => i);
  order.sort((ia, ib) => {
    const a = hits[ia] as FuzzyResult<T>;
    const b = hits[ib] as FuzzyResult<T>;
    if (a.distance !== b.distance) return a.distance - b.distance;
    const la = lengths[ia] as number;
    const lb = lengths[ib] as number;
    if (la !== lb) return la - lb;
    return a.index - b.index;
  });

  const sorted = order.map((i) => hits[i] as FuzzyResult<T>);
  return opts.limit !== undefined ? sorted.slice(0, Math.max(0, opts.limit)) : sorted;
};
