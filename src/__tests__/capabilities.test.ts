import {
  detectImageProtocol, supportsInlineImages,
  supportsKittyGraphics, supportsITermImages, supportsSixel,
  cellAspectRatio, aspectScale, DEFAULT_CELL_ASPECT,
} from '../utils/capabilities.js';

// Helper: run a function with a specific env, restoring afterward.
const withEnv = <T>(vars: Record<string, string | undefined>, fn: () => T): T => {
  const saved: Record<string, string | undefined> = {};
  // Clear the vars we care about, then set the requested ones
  const keys = ['KITTY_WINDOW_ID', 'TERM', 'TERM_PROGRAM', 'ITERM_SESSION_ID'];
  for (const k of keys) { saved[k] = process.env[k]; delete process.env[k]; }
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try { return fn(); }
  finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
};

describe('image protocol detection (v1.6.4)', () => {
  it('detects Kitty via KITTY_WINDOW_ID', () => {
    withEnv({ KITTY_WINDOW_ID: '1' }, () => {
      expect(supportsKittyGraphics()).toBe(true);
      expect(detectImageProtocol()).toBe('kitty');
    });
  });

  it('detects Kitty via TERM=xterm-kitty', () => {
    withEnv({ TERM: 'xterm-kitty' }, () => {
      expect(supportsKittyGraphics()).toBe(true);
    });
  });

  it('detects iTerm via TERM_PROGRAM', () => {
    withEnv({ TERM_PROGRAM: 'iTerm.app' }, () => {
      expect(supportsITermImages()).toBe(true);
      expect(detectImageProtocol()).toBe('iterm');
    });
  });

  it('detects iTerm via ITERM_SESSION_ID', () => {
    withEnv({ ITERM_SESSION_ID: 'w0t0p0' }, () => {
      expect(supportsITermImages()).toBe(true);
    });
  });

  it('detects SIXEL via TERM (foot, mlterm)', () => {
    withEnv({ TERM: 'foot' }, () => {
      expect(supportsSixel()).toBe(true);
      expect(detectImageProtocol()).toBe('sixel');
    });
    withEnv({ TERM: 'mlterm' }, () => {
      expect(supportsSixel()).toBe(true);
    });
  });

  it('prefers Kitty over iTerm and SIXEL when multiple could match', () => {
    // WezTerm supports both Kitty and iTerm protocols; Kitty wins the order.
    withEnv({ TERM_PROGRAM: 'WezTerm' }, () => {
      expect(detectImageProtocol()).toBe('kitty');
    });
  });

  it('returns none for a plain terminal', () => {
    withEnv({ TERM: 'xterm-256color' }, () => {
      expect(detectImageProtocol()).toBe('none');
      expect(supportsInlineImages()).toBe(false);
    });
  });

  it('returns none when no relevant env vars are set', () => {
    withEnv({}, () => {
      expect(detectImageProtocol()).toBe('none');
      expect(supportsInlineImages()).toBe(false);
    });
  });

  it('supportsInlineImages is true when a protocol is detected', () => {
    withEnv({ KITTY_WINDOW_ID: '1' }, () => {
      expect(supportsInlineImages()).toBe(true);
    });
  });
});

describe('cellAspectRatio (v1.7.1)', () => {
  const KEY = 'ANSIMAX_CELL_ASPECT';
  let saved: string | undefined;
  beforeEach(() => { saved = process.env[KEY]; delete process.env[KEY]; });
  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it('defaults to DEFAULT_CELL_ASPECT (0.5) with no signals', () => {
    expect(DEFAULT_CELL_ASPECT).toBe(0.5);
    expect(cellAspectRatio()).toBe(0.5);
  });

  it('honors an explicit finite ratio > 0', () => {
    expect(cellAspectRatio({ ratio: 0.6 })).toBe(0.6);
  });

  it('ignores a non-positive explicit ratio', () => {
    expect(cellAspectRatio({ ratio: 0 })).toBe(0.5);
    expect(cellAspectRatio({ ratio: -1 })).toBe(0.5);
  });

  it('ignores a non-finite explicit ratio', () => {
    expect(cellAspectRatio({ ratio: NaN })).toBe(0.5);
    expect(cellAspectRatio({ ratio: Infinity })).toBe(0.5);
  });

  it('computes ratio from measured cellWidth / cellHeight', () => {
    expect(cellAspectRatio({ cellWidth: 10, cellHeight: 20 })).toBe(0.5);
    expect(cellAspectRatio({ cellWidth: 9, cellHeight: 18 })).toBe(0.5);
  });

  it('falls back when only one measurement is present', () => {
    expect(cellAspectRatio({ cellWidth: 10 })).toBe(0.5);
    expect(cellAspectRatio({ cellHeight: 20 })).toBe(0.5);
  });

  it('falls back when a measurement is zero or negative', () => {
    expect(cellAspectRatio({ cellWidth: 0, cellHeight: 20 })).toBe(0.5);
    expect(cellAspectRatio({ cellWidth: 10, cellHeight: -5 })).toBe(0.5);
  });

  it('prefers an explicit ratio over measurements', () => {
    expect(cellAspectRatio({ ratio: 0.7, cellWidth: 10, cellHeight: 20 })).toBe(0.7);
  });

  it('reads the ANSIMAX_CELL_ASPECT env override', () => {
    process.env[KEY] = '0.45';
    expect(cellAspectRatio()).toBeCloseTo(0.45, 10);
  });

  it('ignores a malformed env value', () => {
    process.env[KEY] = 'not-a-number';
    expect(cellAspectRatio()).toBe(0.5);
  });

  it('ignores a non-positive env value', () => {
    process.env[KEY] = '-0.5';
    expect(cellAspectRatio()).toBe(0.5);
  });

  it('prefers explicit ratio and measurements over the env override', () => {
    process.env[KEY] = '0.9';
    expect(cellAspectRatio({ ratio: 0.6 })).toBe(0.6);
    expect(cellAspectRatio({ cellWidth: 10, cellHeight: 20 })).toBe(0.5);
  });
});

describe('aspectScale (v1.7.1)', () => {
  it('builds S(1, 1/R) from a ratio', () => {
    expect(aspectScale(0.5)).toEqual({ sx: 1, sy: 2 });
    expect(aspectScale(0.25)).toEqual({ sx: 1, sy: 4 });
  });

  it('defaults to the resolved cell aspect ratio when called bare', () => {
    const s = aspectScale();
    expect(s.sx).toBe(1);
    expect(s.sy).toBeCloseTo(2, 10);
  });

  it('falls back to DEFAULT_CELL_ASPECT for a non-positive ratio', () => {
    expect(aspectScale(0)).toEqual({ sx: 1, sy: 2 });
    expect(aspectScale(-1)).toEqual({ sx: 1, sy: 2 });
  });

  it('falls back for a non-finite ratio', () => {
    expect(aspectScale(NaN)).toEqual({ sx: 1, sy: 2 });
    expect(aspectScale(Infinity)).toEqual({ sx: 1, sy: 2 });
  });
});
