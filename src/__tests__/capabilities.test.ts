import {
  detectImageProtocol, supportsInlineImages,
  supportsKittyGraphics, supportsITermImages, supportsSixel,
  cellAspectRatio, aspectScale, DEFAULT_CELL_ASPECT,
  detectCapabilities,
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

describe('detectCapabilities (v1.8.1)', () => {
  // Full save/restore of every env var detectCapabilities reads, so the
  // ambient CI environment can't skew assertions.
  const KEYS = [
    'NO_COLOR', 'FORCE_COLOR', 'TERM', 'COLORTERM', 'TERM_PROGRAM', 'WT_SESSION',
    'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'CIRCLECI', 'BUILDKITE', 'DRONE',
    'TRAVIS', 'APPVEYOR', 'TEAMCITY_VERSION', 'KITTY_WINDOW_ID', 'ITERM_SESSION_ID',
  ];
  const withEnv2 = <T>(vars: Record<string, string | undefined>, fn: () => T): T => {
    const saved: Record<string, string | undefined> = {};
    for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    try { return fn(); } finally {
      for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
      }
    }
  };

  it('returns the full capability shape', () => {
    withEnv2({ TERM: 'xterm' }, () => {
      const caps = detectCapabilities();
      expect(Object.keys(caps).sort()).toEqual([
        'cellAspect', 'ciProvider', 'colorDepth', 'columns', 'forceColor', 'imageProtocol',
        'isCI', 'isTTY', 'isWindowsTerminal', 'noColor', 'program', 'rows',
      ]);
    });
  });

  it('infers truecolor from COLORTERM / known programs / Windows Terminal', () => {
    withEnv2({ COLORTERM: 'truecolor' }, () => expect(detectCapabilities().colorDepth).toBe('truecolor'));
    withEnv2({ TERM_PROGRAM: 'vscode' }, () => {
      const c = detectCapabilities();
      expect(c.colorDepth).toBe('truecolor');
      expect(c.program).toBe('vscode');
    });
    withEnv2({ WT_SESSION: 'abc' }, () => {
      const c = detectCapabilities();
      expect(c.colorDepth).toBe('truecolor');
      expect(c.isWindowsTerminal).toBe(true);
    });
    // truecolor advertised through the TERM string itself
    withEnv2({ TERM: 'xterm-truecolor' }, () => expect(detectCapabilities().colorDepth).toBe('truecolor'));
    withEnv2({ TERM: 'konsole-24bit' }, () => expect(detectCapabilities().colorDepth).toBe('truecolor'));
  });

  it('infers 256 / basic / none from TERM', () => {
    withEnv2({ TERM: 'xterm-256color' }, () => expect(detectCapabilities().colorDepth).toBe('256'));
    withEnv2({ TERM: 'xterm' }, () => expect(detectCapabilities().colorDepth).toBe('basic'));
    withEnv2({ TERM: '' }, () => expect(detectCapabilities().colorDepth).toBe('none'));
  });

  it('honors NO_COLOR and FORCE_COLOR', () => {
    withEnv2({ NO_COLOR: '1', COLORTERM: 'truecolor' }, () => {
      const c = detectCapabilities();
      expect(c.noColor).toBe(true);
      expect(c.colorDepth).toBe('none');
    });
    withEnv2({ FORCE_COLOR: '1', TERM: 'dumb' }, () => {
      const c = detectCapabilities();
      expect(c.forceColor).toBe(true);
      expect(c.colorDepth).toBe('basic');
    });
  });

  it('detects CI providers (specific and generic)', () => {
    withEnv2({ GITHUB_ACTIONS: 'true' }, () => {
      const c = detectCapabilities();
      expect(c.isCI).toBe(true);
      expect(c.ciProvider).toBe('github');
    });
    withEnv2({ GITLAB_CI: 'true' }, () => expect(detectCapabilities().ciProvider).toBe('gitlab'));
    withEnv2({ CI: '1' }, () => expect(detectCapabilities().ciProvider).toBe('unknown'));
    withEnv2({ TERM: 'xterm' }, () => {
      const c = detectCapabilities();
      expect(c.isCI).toBe(false);
      expect(c.ciProvider).toBeNull();
    });
  });

  it('reports a numeric cell aspect and a valid image protocol', () => {
    withEnv2({ TERM: 'xterm' }, () => {
      const c = detectCapabilities();
      expect(typeof c.cellAspect).toBe('number');
      expect(['kitty', 'iterm', 'sixel', 'none']).toContain(c.imageProtocol);
    });
  });

  it('reports positive terminal columns and rows (with 80×24 fallback)', () => {
    const c = detectCapabilities();
    expect(typeof c.columns).toBe('number');
    expect(typeof c.rows).toBe('number');
    expect(c.columns).toBeGreaterThan(0);
    expect(c.rows).toBeGreaterThan(0);
    // In a non-TTY test runner stdout has no size → the classic fallback.
    if (process.stdout.columns === undefined) {
      expect(c.columns).toBe(80);
      expect(c.rows).toBe(24);
    }
  });
});
