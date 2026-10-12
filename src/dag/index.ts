// ─────────────────────────────────────────────
//  ansimax/dag — Dependency ordering via topological sort (Phase 13)
//
//  v1.7.6 — Phase 13. The ordering backbone for a plugin / render pipeline:
//  given stages and their "must run after" dependencies, produce a linear
//  order that honours every edge, or fail with an actionable error naming the
//  cycle. Kahn's algorithm (BFS on in-degrees) runs in O(V + E) and yields the
//  cycle members for free — whatever still has a non-zero in-degree when the
//  queue drains is part of (or downstream of) a cycle.
//
//  The real value here isn't the sort — it's the contract: a stable,
//  deterministic order (ties broken by insertion order) and a cycle error you
//  can actually act on, because it tells you which stages form the loop.
//  Zero dependencies, pure functions.
// ─────────────────────────────────────────────

/** A dependency edge: `after` must run after `before`. @since 1.7.6 */
export interface DagEdge {
  /** The prerequisite — runs first. */
  before: string;
  /** The dependent — runs after {@link DagEdge.before}. */
  after: string;
}

/** Thrown by {@link topoSort} when the graph contains a cycle. @since 1.7.6 */
export class CycleError extends Error {
  /** The stages that form (or feed into) the unresolved cycle, in input order. */
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`ANSIMAX_PLUGIN_CYCLE: dependency cycle among: ${cycle.join(' -> ')}`);
    this.name = 'CycleError';
    this.cycle = cycle;
  }
}

/**
 * Topologically sort `nodes` so every edge `before → after` is respected:
 * `before` always lands earlier in the result than `after`. Uses Kahn's
 * algorithm; ties (nodes whose prerequisites are all satisfied at the same
 * time) keep their original `nodes` order, so the output is deterministic.
 *
 * Edges referencing unknown nodes are ignored (the pipeline shouldn't blow up
 * because a plugin named a stage that isn't installed). Duplicate edges are
 * harmless. Throws {@link CycleError} — whose `.cycle` lists the offending
 * stages — if no valid order exists.
 *
 * @example
 * ```js
 * import { topoSort } from 'ansimax';
 *
 * topoSort(
 *   ['render', 'layout', 'pack'],
 *   [{ before: 'layout', after: 'render' }, { before: 'render', after: 'pack' }],
 * );
 * // → ['layout', 'render', 'pack']
 * ```
 *
 * @since 1.7.6
 */
export const topoSort = (nodes: string[], edges: DagEdge[] = []): string[] => {
  // Preserve first-seen order; drop duplicate node names.
  const order: string[] = [];
  const known = new Set<string>();
  for (const n of nodes) {
    if (!known.has(n)) { known.add(n); order.push(n); }
  }

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const n of order) { inDegree.set(n, 0); dependents.set(n, []); }

  for (const { before, after } of edges) {
    // Ignore edges that reference a node we don't have.
    if (!known.has(before) || !known.has(after) || before === after) continue;
    (dependents.get(before) as string[]).push(after);
    inDegree.set(after, (inDegree.get(after) as number) + 1);
  }

  // Seed the queue with every zero-in-degree node, in input order.
  const queue: string[] = order.filter((n) => inDegree.get(n) === 0);
  const result: string[] = [];
  while (queue.length > 0) {
    const n = queue.shift() as string;
    result.push(n);
    for (const dep of dependents.get(n) as string[]) {
      const d = (inDegree.get(dep) as number) - 1;
      inDegree.set(dep, d);
      if (d === 0) queue.push(dep);
    }
  }

  if (result.length !== order.length) {
    // Whatever never reached in-degree 0 is in or below the cycle.
    const cycle = order.filter((n) => (inDegree.get(n) as number) > 0);
    throw new CycleError(cycle);
  }
  return result;
};

/**
 * Non-throwing companion to {@link topoSort}: returns the ordered stages, or
 * `null` when the graph has a cycle. Handy when a cycle is an expected,
 * recoverable condition rather than a programming error.
 *
 * @since 1.7.6
 */
export const tryTopoSort = (nodes: string[], edges: DagEdge[] = []): string[] | null => {
  try {
    return topoSort(nodes, edges);
  } catch (err) {
    /* istanbul ignore next — only CycleError is thrown above; rethrow anything else */
    if (err instanceof CycleError) return null;
    /* istanbul ignore next */
    throw err;
  }
};
