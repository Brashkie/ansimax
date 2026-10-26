import { createPipeline } from '../pipeline/index.js';
import { CycleError } from '../dag/index.js';

describe('createPipeline (v1.8.0)', () => {
  it('runs stages in dependency order regardless of registration order', async () => {
    const p = createPipeline<string>()
      .use({ name: 'upper', after: ['trim'], run: (s) => s.toUpperCase() })
      .use({ name: 'trim', run: (s) => s.trim() });
    expect(p.order()).toEqual(['trim', 'upper']);
    expect(await p.run('  hi  ')).toBe('HI');
  });

  it('threads the value through each stage', async () => {
    const p = createPipeline<number>()
      .use({ name: 'inc', run: (n) => n + 1 })
      .use({ name: 'double', after: ['inc'], run: (n) => n * 2 });
    expect(await p.run(5)).toBe(12); // (5+1)*2
  });

  it('awaits async stages', async () => {
    const p = createPipeline<number>()
      .use({ name: 'a', run: async (n) => n + 1 })
      .use({ name: 'b', after: ['a'], run: (n) => n * 10 });
    expect(await p.run(0)).toBe(10);
  });

  it('replaces a stage when its name is reused, keeping one slot', async () => {
    const p = createPipeline<number>()
      .use({ name: 'x', run: () => 1 })
      .use({ name: 'x', run: () => 2 });
    expect(p.stages()).toEqual(['x']);
    expect(await p.run(0)).toBe(2);
  });

  it('ignores after references to unregistered stages', async () => {
    const p = createPipeline<string>()
      .use({ name: 'only', after: ['ghost'], run: (s) => `${s}!` });
    expect(p.order()).toEqual(['only']);
    expect(await p.run('hi')).toBe('hi!');
  });

  it('breaks ties by registration order', () => {
    const p = createPipeline<number>()
      .use({ name: 'a', run: (n) => n })
      .use({ name: 'b', run: (n) => n })
      .use({ name: 'c', run: (n) => n });
    expect(p.order()).toEqual(['a', 'b', 'c']);
  });

  it('throws CycleError (naming the loop) on a dependency cycle', () => {
    const p = createPipeline<number>()
      .use({ name: 'a', after: ['b'], run: (n) => n })
      .use({ name: 'b', after: ['a'], run: (n) => n });
    expect(() => p.order()).toThrow(CycleError);
  });

  it('is a passthrough when empty', async () => {
    expect(await createPipeline<number>().run(42)).toBe(42);
    expect(createPipeline<number>().order()).toEqual([]);
  });

  it('resolves a diamond of stages', async () => {
    const p = createPipeline<string[]>()
      .use({ name: 'a', run: (x) => [...x, 'a'] })
      .use({ name: 'b', after: ['a'], run: (x) => [...x, 'b'] })
      .use({ name: 'c', after: ['a'], run: (x) => [...x, 'c'] })
      .use({ name: 'd', after: ['b', 'c'], run: (x) => [...x, 'd'] });
    const out = await p.run([]);
    expect(out[0]).toBe('a');
    expect(out[out.length - 1]).toBe('d');
    expect(out).toHaveLength(4);
  });
});
