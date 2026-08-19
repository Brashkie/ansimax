import {
  detectImageProtocol, supportsInlineImages,
  supportsKittyGraphics, supportsITermImages, supportsSixel,
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
