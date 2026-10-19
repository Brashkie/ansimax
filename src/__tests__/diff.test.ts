import { diffRow, diffRowCost } from '../diff/index.js';

// Apply a diff back onto `prev` to confirm it reproduces `next` (in the
// overlapping region).
const applyEdits = (prev: string, edits: Array<{ col: number; text: string }>): string => {
  const a = [...prev];
  for (const { col, text } of edits) {
    const t = [...text];
    for (let k = 0; k < t.length; k++) a[col + k] = t[k] as string;
  }
  return a.join('');
};

describe('diffRow (v1.7.7)', () => {
  it('returns [] for identical rows', () => {
    expect(diffRow('abc', 'abc')).toEqual([]);
    expect(diffRow('', '')).toEqual([]);
  });

  it('emits a single run for one changed region', () => {
    expect(diffRow('the quick brown fox', 'the slow  brown fox'))
      .toEqual([{ col: 4, text: 'slow ' }]);
  });

  it('keeps two changes separate when the gap ≥ moveCost', () => {
    const edits = diffRow('aXbbbbbbbbbbY', 'a_bbbbbbbbbb_', { moveCost: 7 });
    expect(edits).toHaveLength(2);
    expect(edits[0]).toEqual({ col: 1, text: '_' });
    expect(edits[1]!.col).toBe(12);
  });

  it('merges two changes when the gap < moveCost', () => {
    expect(diffRow('aXbbY', 'a_bb_', { moveCost: 7 }))
      .toEqual([{ col: 1, text: '_bb_' }]);
  });

  it('never merges at moveCost 0', () => {
    expect(diffRow('aXbbY', 'a_bb_', { moveCost: 0 }))
      .toEqual([{ col: 1, text: '_' }, { col: 4, text: '_' }]);
  });

  it('merges the whole row at a very large moveCost', () => {
    expect(diffRow('aXbYc', 'a_b_c', { moveCost: 999 }))
      .toEqual([{ col: 1, text: '_b_' }]);
  });

  it('appends a trailing run when next is longer', () => {
    expect(diffRow('abc', 'abcdef')).toEqual([{ col: 3, text: 'def' }]);
  });

  it('emits nothing for a pure deletion tail when next is shorter', () => {
    expect(diffRow('abcdef', 'abc')).toEqual([]);
  });

  it('returns [] when next is empty', () => {
    expect(diffRow('abc', '')).toEqual([]);
  });

  it('defaults moveCost to 7 and ignores a negative moveCost', () => {
    const def = diffRow('aXbbY', 'a_bb_');
    expect(def).toEqual([{ col: 1, text: '_bb_' }]);     // gap 2 < 7 → merged
    expect(diffRow('aXbbY', 'a_bb_', { moveCost: -5 })).toEqual(def);
  });

  it('reproduces next when its edits are applied (overlap region)', () => {
    const cases: Array<[string, string]> = [
      ['the quick brown fox', 'the slow  brown fox'],
      ['aXbbbbbbbbbbY', 'a_bbbbbbbbbb_'],
      ['aXbbY', 'a_bb_'],
      ['abc', 'abcdef'],
    ];
    for (const [p, n] of cases) {
      expect(applyEdits(p, diffRow(p, n))).toBe(n);
    }
  });

  it('diffs by code point, not UTF-16 unit', () => {
    // '😀' is one code point; a change beside it reports the right column.
    const edits = diffRow('a😀b', 'a😀c');
    expect(edits).toEqual([{ col: 2, text: 'c' }]);
  });
});

describe('diffRowCost (v1.7.7)', () => {
  it('is 0 for identical rows', () => {
    expect(diffRowCost('abc', 'abc')).toBe(0);
  });

  it('charges one moveCost per run plus one byte per cell', () => {
    // One merged run '_bb_' (4 cells) + one move (7) = 11.
    expect(diffRowCost('aXbbY', 'a_bb_', { moveCost: 7 })).toBe(11);
    // Two separate runs at moveCost 0: 0 + 1 + 0 + 1 = 2.
    expect(diffRowCost('aXbbY', 'a_bb_', { moveCost: 0 })).toBe(2);
  });
});
