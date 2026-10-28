import { createScreenBuffer, renderFrame, renderFrameCost, compositeLayers } from '../buffer/index.js';

describe('createScreenBuffer (v1.8.0)', () => {
  it('starts filled with the fill char and reports its dimensions', () => {
    const b = createScreenBuffer(4, 2);
    expect(b.width).toBe(4);
    expect(b.height).toBe(2);
    expect(b.rows()).toEqual(['    ', '    ']);
    expect(b.toString()).toBe('    \n    ');
  });

  it('honors a custom fill character (first code point only)', () => {
    expect(createScreenBuffer(3, 1, '.').row(0)).toBe('...');
    expect(createScreenBuffer(3, 1, 'ab').row(0)).toBe('aaa');
  });

  it('set writes one cell and ignores out-of-bounds', () => {
    const b = createScreenBuffer(3, 2);
    b.set(1, 0, 'X');
    expect(b.row(0)).toBe(' X ');
    b.set(-1, 0, 'Z');
    b.set(9, 9, 'Z');
    expect(b.rows()).toEqual([' X ', '   ']);
  });

  it('text writes a string left to right, clipped to the width', () => {
    const b = createScreenBuffer(5, 1);
    b.text(0, 0, 'hello world');
    expect(b.row(0)).toBe('hello');
  });

  it('text starting mid-row clips the tail', () => {
    const b = createScreenBuffer(6, 1);
    b.text(3, 0, 'abcd');
    expect(b.row(0)).toBe('   abc');
  });

  it('text ignores an out-of-range row', () => {
    const b = createScreenBuffer(4, 2);
    b.text(0, 9, 'abc');   // y past the bottom
    b.text(0, -1, 'abc');  // y above the top
    expect(b.rows()).toEqual(['    ', '    ']);
  });

  it('clear resets every cell', () => {
    const b = createScreenBuffer(3, 2);
    b.text(0, 0, 'xy');
    b.clear('.');
    expect(b.rows()).toEqual(['...', '...']);
    b.clear();
    expect(b.rows()).toEqual(['   ', '   ']);
  });

  it('row/toString are empty/safe out of bounds', () => {
    const b = createScreenBuffer(2, 1);
    expect(b.row(5)).toBe('');
    expect(b.row(-1)).toBe('');
  });

  it('handles zero dimensions', () => {
    const b = createScreenBuffer(0, 0);
    expect(b.rows()).toEqual([]);
    expect(b.toString()).toBe('');
  });
});

describe('renderFrame (v1.8.0)', () => {
  it('returns "" when nothing changed', () => {
    expect(renderFrame(['abc', 'def'], ['abc', 'def'])).toBe('');
  });

  it('rewrites only the changed run with a cursor move', () => {
    const out = renderFrame(['health: 100'], ['health:  90']);
    // Only cols 8–9 differ ("1 0" → " 9"); the trailing "0" is unchanged, so
    // the run is cols 8–9 (0-based) → CSI 1;9H then " 9".
    expect(out).toBe('\x1b[1;9H 9');
  });

  it('is cheaper than a full redraw', () => {
    const prev = ['health: 100', 'mana:    50'];
    const next = ['health:  90', 'mana:    50'];
    const diffBytes = renderFrameCost(prev, next);
    const fullBytes = next.join('').length;
    expect(diffBytes).toBeLessThan(fullBytes);
  });

  it('draws a grown frame\'s new rows in full', () => {
    expect(renderFrame(['a'], ['a', 'new'])).toBe('\x1b[2;1Hnew');
  });

  it('emits nothing for shrunk rows (caller clears)', () => {
    expect(renderFrame(['a', 'b'], ['a'])).toBe('');
  });

  it('applies originRow / originCol offsets', () => {
    expect(renderFrame(['xx'], ['yx'], { originRow: 5, originCol: 3 }))
      .toBe('\x1b[6;4Hy');
  });

  it('respects moveCost when merging runs on a row', () => {
    // Two 1-char changes 3 apart: merged at the default moveCost (7).
    expect(renderFrame(['aXbcdY'], ['a_bcd_'])).toBe('\x1b[1;2H_bcd_');
    // At moveCost 0 they stay separate (two cursor moves).
    const sep = renderFrame(['aXbcdY'], ['a_bcd_'], { moveCost: 0 });
    expect(sep).toBe('\x1b[1;2H_\x1b[1;6H_');
  });
});

describe('compositeLayers (v1.8.1)', () => {
  it('paints a floating layer over a background', () => {
    const bg = { content: ['..........', '..........', '..........'], z: 0 };
    const card = { content: ['+--+', '|hi|', '+--+'], x: 3, y: 0, z: 1 };
    expect(compositeLayers([bg, card], 10, 3)).toEqual([
      '...+--+...',
      '...|hi|...',
      '...+--+...',
    ]);
  });

  it('higher z wins regardless of array order', () => {
    const a = { content: ['AAA'], z: 5 };
    const b = { content: ['BBB'], z: 1 };
    expect(compositeLayers([a, b], 3, 1)).toEqual(['AAA']);
  });

  it('treats a space as transparent — lower layers show through', () => {
    const base = { content: ['#####'], z: 0 };
    const top = { content: ['X X'], x: 1, z: 1 };
    expect(compositeLayers([base, top], 5, 1)).toEqual(['#X#X#']);
  });

  it('transparent:"" makes every cell opaque', () => {
    const base = { content: ['#####'], z: 0 };
    const top = { content: ['X X'], x: 1, z: 1 };
    expect(compositeLayers([base, top], 5, 1, { transparent: '' })).toEqual(['#X X#']);
  });

  it('clips layers to the frame (negative x, overflow y)', () => {
    expect(compositeLayers([{ content: ['ABCDEFG'], x: -2, y: 0 }], 4, 1)).toEqual(['CDEF']);
    expect(compositeLayers([{ content: ['a', 'b', 'c'] }, { content: ['Z'], y: 9 }], 1, 2))
      .toEqual(['a', 'b']);
  });

  it('breaks z ties by array order (painter order)', () => {
    expect(compositeLayers([{ content: ['11'] }, { content: ['22'] }], 2, 1)).toEqual(['22']);
  });

  it('uses a custom fill for uncovered cells', () => {
    expect(compositeLayers([{ content: ['X'], x: 2 }], 4, 1, { fill: '.' })).toEqual(['..X.']);
  });

  it('returns [] for zero dimensions', () => {
    expect(compositeLayers([{ content: ['x'] }], 0, 0)).toEqual([]);
  });

  it('defaults x/y/z to 0', () => {
    expect(compositeLayers([{ content: ['ab'] }], 2, 1)).toEqual(['ab']);
  });
});
