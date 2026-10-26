// ─────────────────────────────────────────────
//  ansimax/pipeline — Ordered plugin stages (Phase 13)
//
//  v1.8.0 — Phase 13 closure. The `dag` module (v1.7.6) answers "given these
//  dependencies, what order?" with a deterministic topological sort and an
//  actionable cycle error. This is the stage contract that consumes it: a
//  pipeline you register named stages into, each optionally declaring which
//  other stages it must run *after*, then run — the stages fire in dependency
//  order, each transforming the value the previous one returned.
//
//  That contract is the point, not the sort: stages compose regardless of
//  registration order, a missing `after` reference is ignored rather than
//  fatal (a plugin may name a stage the host didn't install), and a cycle
//  fails loudly with the offending stage names (CycleError). Zero deps beyond
//  the sibling `dag` module.
// ─────────────────────────────────────────────

import { topoSort } from '../dag/index.js';
import type { DagEdge } from '../dag/index.js';

/** A single pipeline stage. @since 1.8.0 */
export interface Stage<T> {
  /** Unique stage name. Re-registering a name replaces the earlier stage. */
  name: string;
  /** Names of stages this one must run after. Unknown names are ignored. */
  after?: string[];
  /** Transform the running value. May return a value or a promise of one. */
  run: (value: T) => T | Promise<T>;
}

/** A composable, dependency-ordered stage pipeline. @since 1.8.0 */
export interface Pipeline<T> {
  /** Register (or replace, by name) a stage. Returns `this` for chaining. */
  use(stage: Stage<T>): Pipeline<T>;
  /** The stage names in resolved run order (throws `CycleError` on a cycle). */
  order(): string[];
  /** Run every stage in dependency order, threading the value through. */
  run(input: T): Promise<T>;
  /** The registered stage names, in registration order. */
  stages(): string[];
}

/**
 * Create a stage pipeline. Stages are ordered by their `after` dependencies
 * via {@link topoSort} — deterministic, with ties broken by registration
 * order — so you can `use()` them in any order and still get a stable run
 * sequence. `run` threads the value through each stage (awaiting async ones);
 * `order()` exposes the resolved sequence without running.
 *
 * A cycle in the `after` graph throws `CycleError` (from the `dag` module) at
 * `order()`/`run()` time, naming the stages in the loop.
 *
 * @example
 * ```js
 * import { createPipeline } from 'ansimax';
 *
 * const p = createPipeline()
 *   .use({ name: 'trim',  run: (s) => s.trim() })
 *   .use({ name: 'upper', after: ['trim'], run: (s) => s.toUpperCase() });
 *
 * await p.run('  hi  '); // 'HI'
 * p.order();             // ['trim', 'upper']
 * ```
 *
 * @since 1.8.0
 */
export const createPipeline = <T>(): Pipeline<T> => {
  const order: string[] = [];              // registration order
  const byName = new Map<string, Stage<T>>();

  const resolve = (): string[] => {
    const edges: DagEdge[] = [];
    for (const name of order) {
      const stage = byName.get(name) as Stage<T>;
      if (Array.isArray(stage.after)) {
        for (const dep of stage.after) edges.push({ before: dep, after: name });
      }
    }
    return topoSort(order, edges);
  };

  const api: Pipeline<T> = {
    use(stage) {
      if (!byName.has(stage.name)) order.push(stage.name);
      byName.set(stage.name, stage);
      return api;
    },
    order() {
      return resolve();
    },
    stages() {
      return [...order];
    },
    async run(input) {
      let value = input;
      for (const name of resolve()) {
        value = await (byName.get(name) as Stage<T>).run(value);
      }
      return value;
    },
  };
  return api;
};
