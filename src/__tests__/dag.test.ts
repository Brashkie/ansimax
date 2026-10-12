import { topoSort, tryTopoSort, CycleError } from '../dag/index.js';

// Validate that a result honours every edge: `before` precedes `after`.
const respectsEdges = (
  result: string[],
  edges: Array<{ before: string; after: string }>,
): boolean => {
  const pos = new Map(result.map((n, i) => [n, i]));
  return edges.every(({ before, after }) =>
    !pos.has(before) || !pos.has(after) || (pos.get(before) as number) < (pos.get(after) as number));
};

describe('topoSort (v1.7.6)', () => {
  it('orders a simple chain so dependencies come first', () => {
    const edges = [
      { before: 'layout', after: 'render' },
      { before: 'render', after: 'pack' },
    ];
    const r = topoSort(['render', 'layout', 'pack'], edges);
    expect(r).toEqual(['layout', 'render', 'pack']);
    expect(respectsEdges(r, edges)).toBe(true);
  });

  it('keeps input order when there are no edges (deterministic ties)', () => {
    expect(topoSort(['a', 'b', 'c', 'd'], [])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('resolves a diamond dependency', () => {
    const edges = [
      { before: 'a', after: 'b' }, { before: 'a', after: 'c' },
      { before: 'b', after: 'd' }, { before: 'c', after: 'd' },
    ];
    const r = topoSort(['a', 'b', 'c', 'd'], edges);
    expect(respectsEdges(r, edges)).toBe(true);
    expect(r[0]).toBe('a');
    expect(r[r.length - 1]).toBe('d');
  });

  it('ignores edges that reference unknown nodes', () => {
    const r = topoSort(['a', 'b'], [{ before: 'a', after: 'ghost' }, { before: 'a', after: 'b' }]);
    expect(r).toEqual(['a', 'b']);
  });

  it('ignores self-edges', () => {
    expect(topoSort(['a', 'b'], [{ before: 'a', after: 'a' }])).toEqual(['a', 'b']);
  });

  it('de-duplicates repeated node names', () => {
    expect(topoSort(['a', 'a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('returns [] for an empty node list', () => {
    expect(topoSort([], [])).toEqual([]);
    expect(topoSort([])).toEqual([]);
  });

  it('throws CycleError naming the cycle members', () => {
    const edges = [
      { before: 'x', after: 'y' }, { before: 'y', after: 'z' }, { before: 'z', after: 'x' },
    ];
    expect(() => topoSort(['x', 'y', 'z'], edges)).toThrow(CycleError);
    try {
      topoSort(['x', 'y', 'z'], edges);
    } catch (err) {
      expect(err).toBeInstanceOf(CycleError);
      expect((err as CycleError).cycle).toEqual(['x', 'y', 'z']);
      expect((err as CycleError).message).toContain('ANSIMAX_PLUGIN_CYCLE');
    }
  });

  it('detects a two-node cycle', () => {
    expect(() => topoSort(['a', 'b'], [{ before: 'a', after: 'b' }, { before: 'b', after: 'a' }]))
      .toThrow(CycleError);
  });
});

describe('tryTopoSort (v1.7.6)', () => {
  it('returns the order on success', () => {
    expect(tryTopoSort(['a', 'b'], [{ before: 'a', after: 'b' }])).toEqual(['a', 'b']);
  });

  it('returns null on a cycle instead of throwing', () => {
    expect(tryTopoSort(['x', 'y'], [{ before: 'x', after: 'y' }, { before: 'y', after: 'x' }]))
      .toBeNull();
  });

  it('defaults edges to empty', () => {
    expect(tryTopoSort(['a', 'b'])).toEqual(['a', 'b']);
  });
});
