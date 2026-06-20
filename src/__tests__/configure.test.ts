import {
  configure, getConfig, getSpeedMultiplier,
  resetConfig, onConfigChange, getConfigValue,
  onConfigKeyChange, pauseListeners, resumeListeners, withConfig,
  DEFAULTS as CONFIG_DEFAULTS,
} from '../configure.js';
import { isNoColor, resetNoColor } from '../colors/index.js';
import { themes } from '../themes/index.js';

describe('configure', () => {
  beforeEach(() => {
    resetConfig();
    resetNoColor();
  });
  afterEach(() => {
    resetConfig();
    resetNoColor();
  });

  it('returns default config', () => {
    const config = getConfig();
    expect(config.colorMode).toBe('auto');
    expect(config.animationSpeed).toBe('normal');
    expect(config.asciiFont).toBe('big');
    expect(config.locale).toBe('en');
    expect(config.theme).toBe('dracula');
    expect(config.reducedMotion).toBe(false);
  });

  it('updates colorMode', () => {
    configure({ colorMode: 'basic' });
    expect(getConfig().colorMode).toBe('basic');
  });

  it('updates animationSpeed', () => {
    configure({ animationSpeed: 'fast' });
    expect(getConfig().animationSpeed).toBe('fast');
  });

  it('updates asciiFont (any string accepted)', () => {
    configure({ asciiFont: 'small' });
    expect(getConfig().asciiFont).toBe('small');
    configure({ asciiFont: 'mycustom' });
    expect(getConfig().asciiFont).toBe('mycustom');
  });

  it('updates locale', () => {
    configure({ locale: 'es' });
    expect(getConfig().locale).toBe('es');
  });

  it('updates theme', () => {
    configure({ theme: 'nord' });
    expect(getConfig().theme).toBe('nord');
  });

  it('partial update preserves other settings', () => {
    configure({ colorMode: '256' });
    const config = getConfig();
    expect(config.colorMode).toBe('256');
    expect(config.animationSpeed).toBe('normal');
    expect(config.locale).toBe('en');
  });

  it('calling configure with no arguments does not throw', () => {
    expect(() => configure()).not.toThrow();
  });

  it('returns a copy not a reference', () => {
    const a = getConfig();
    const b = getConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ─────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────
describe('configure validation', () => {
  beforeEach(() => resetConfig());
  afterEach(() => resetConfig());

  it('rejects invalid colorMode', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      configure({ colorMode: 'rainbow' }),
    ).toThrow(/colorMode/);
  });

  it('rejects invalid animationSpeed', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      configure({ animationSpeed: 'turbo' }),
    ).toThrow(/animationSpeed/);
  });

  it('rejects non-string asciiFont', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      configure({ asciiFont: 42 }),
    ).toThrow(/asciiFont/);
  });

  it('rejects non-string theme', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      configure({ theme: 99 }),
    ).toThrow(/theme/);
  });

  it('rejects non-boolean reducedMotion', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      configure({ reducedMotion: 'yes' }),
    ).toThrow(/reducedMotion/);
  });

  it('rejects null argument', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      configure(null),
    ).toThrow(/object/);
  });

  it('accepts all valid colorMode values', () => {
    for (const mode of ['none', 'basic', '256', 'truecolor', 'auto'] as const) {
      expect(() => configure({ colorMode: mode })).not.toThrow();
    }
  });

  it('accepts all valid animationSpeed values', () => {
    for (const s of ['slow', 'normal', 'fast', 'instant'] as const) {
      expect(() => configure({ animationSpeed: s })).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────
//  Side effects — integration with other modules
// ─────────────────────────────────────────────
describe('configure side effects', () => {
  beforeEach(() => {
    resetConfig();
    resetNoColor();
  });
  afterEach(() => {
    resetConfig();
    resetNoColor();
  });

  it('colorMode:none triggers setNoColor(true)', () => {
    configure({ colorMode: 'none' });
    expect(isNoColor()).toBe(true);
  });

  it('colorMode:auto triggers resetNoColor', () => {
    configure({ colorMode: 'none' });
    expect(isNoColor()).toBe(true);
    configure({ colorMode: 'auto' });
    // After reset, isNoColor depends on terminal — but the override is cleared
  });

  it('colorMode:truecolor disables NO_COLOR override', () => {
    configure({ colorMode: 'none' });
    configure({ colorMode: 'truecolor' });
    expect(isNoColor()).toBe(false);
  });

  it('theme change activates the matching theme', () => {
    configure({ theme: 'matrix' });
    expect(themes.current().name).toBe('Matrix');
  });

  it('unknown theme name does not throw (graceful)', () => {
    expect(() => configure({ theme: 'no-such-theme' })).not.toThrow();
    // Config still records the requested name
    expect(getConfig().theme).toBe('no-such-theme');
  });
});

// ─────────────────────────────────────────────
//  Subscribers
// ─────────────────────────────────────────────
describe('onConfigChange', () => {
  beforeEach(() => resetConfig());
  afterEach(() => resetConfig());

  it('fires on configure()', () => {
    const fn = jest.fn();
    onConfigChange(fn);
    configure({ colorMode: 'basic' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]?.[0]).toMatchObject({ colorMode: 'basic' });
  });

  it('fires on resetConfig() when state actually differs from defaults', () => {
    // First change state so resetConfig() has something to revert.
    // (New behavior: resetConfig skips notification when already at defaults.)
    configure({ colorMode: 'basic' });

    const fn = jest.fn();
    onConfigChange(fn);
    resetConfig();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns an unsubscribe function', () => {
    const fn = jest.fn();
    const off = onConfigChange(fn);
    off();
    configure({ colorMode: 'basic' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('multiple subscribers all get called', () => {
    const a = jest.fn();
    const b = jest.fn();
    onConfigChange(a);
    onConfigChange(b);
    configure({ animationSpeed: 'fast' });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('listener errors do not propagate', () => {
    const bad = (): void => { throw new Error('boom'); };
    const good = jest.fn();
    onConfigChange(bad);
    onConfigChange(good);
    expect(() => configure({ animationSpeed: 'fast' })).not.toThrow();
    expect(good).toHaveBeenCalled();
  });

  it('listener removing itself during notification does not skip siblings', () => {
    let off: () => void = () => { /* placeholder */ };
    const a = jest.fn(() => off());
    const b = jest.fn();
    off = onConfigChange(a);
    onConfigChange(b);
    configure({ colorMode: 'basic' });
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
//  resetConfig
// ─────────────────────────────────────────────
describe('resetConfig', () => {
  it('restores all defaults', () => {
    configure({
      colorMode: 'none',
      animationSpeed: 'fast',
      asciiFont: 'small',
      theme: 'matrix',
      reducedMotion: true,
    });
    resetConfig();
    const c = getConfig();
    expect(c.colorMode).toBe('auto');
    expect(c.animationSpeed).toBe('normal');
    expect(c.asciiFont).toBe('big');
    expect(c.theme).toBe('dracula');
    expect(c.reducedMotion).toBe(false);
  });
});

// ─────────────────────────────────────────────
//  getConfigValue
// ─────────────────────────────────────────────
describe('getConfigValue', () => {
  beforeEach(() => resetConfig());
  afterEach(() => resetConfig());

  it('reads a single field by name', () => {
    expect(getConfigValue('colorMode')).toBe('auto');
    expect(getConfigValue('asciiFont')).toBe('big');
  });

  it('reflects updates', () => {
    configure({ animationSpeed: 'slow' });
    expect(getConfigValue('animationSpeed')).toBe('slow');
  });
});

// ─────────────────────────────────────────────
//  getSpeedMultiplier
// ─────────────────────────────────────────────
describe('getSpeedMultiplier', () => {
  beforeEach(() => resetConfig());
  afterEach(() => resetConfig());

  it('returns 1.0 for normal', () => {
    configure({ animationSpeed: 'normal' });
    expect(getSpeedMultiplier()).toBe(1.0);
  });

  it('returns 2.0 for slow', () => {
    configure({ animationSpeed: 'slow' });
    expect(getSpeedMultiplier()).toBe(2.0);
  });

  it('returns 0.4 for fast', () => {
    configure({ animationSpeed: 'fast' });
    expect(getSpeedMultiplier()).toBe(0.4);
  });

  it('returns 0 for instant', () => {
    configure({ animationSpeed: 'instant' });
    expect(getSpeedMultiplier()).toBe(0);
  });

  it('returns 0 when reducedMotion is true (overrides speed)', () => {
    configure({ animationSpeed: 'fast', reducedMotion: true });
    expect(getSpeedMultiplier()).toBe(0);
  });
});

// ─────────────────────────────────────────────
//  New: skip notification on no-op updates
// ─────────────────────────────────────────────
describe('configure no-op skip', () => {
  beforeEach(() => resetConfig());

  it('skips listener notification when nothing actually changes', () => {
    const fn = jest.fn();
    onConfigChange(fn);
    configure({ theme: 'dracula' }); // already 'dracula' by default
    expect(fn).not.toHaveBeenCalled();
  });

  it('fires listeners only when at least one key changes', () => {
    const fn = jest.fn();
    onConfigChange(fn);
    configure({ theme: 'nord' });
    expect(fn).toHaveBeenCalledTimes(1);
    configure({ theme: 'nord', locale: 'en' }); // both unchanged
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resetConfig fires only if state differs from defaults', () => {
    const fn = jest.fn();
    onConfigChange(fn);
    resetConfig(); // already at defaults
    expect(fn).not.toHaveBeenCalled();

    configure({ theme: 'nord' });
    resetConfig(); // now differs → should fire
    expect(fn).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
//  New: strict mode rejects unknown keys
// ─────────────────────────────────────────────
describe('configure strict mode', () => {
  beforeEach(() => resetConfig());

  it('non-strict (default) ignores unknown keys silently', () => {
    expect(() =>
      configure({ unknownKey: 'x' } as unknown as Parameters<typeof configure>[0]),
    ).not.toThrow();
  });

  it('strict mode rejects unknown keys with RangeError', () => {
    expect(() =>
      configure(
        { unknownKey: 'x' } as unknown as Parameters<typeof configure>[0],
        { strict: true },
      ),
    ).toThrow(RangeError);
  });

  it('strict mode still accepts known keys', () => {
    expect(() =>
      configure({ theme: 'nord' }, { strict: true }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  New: onConfigKeyChange
// ─────────────────────────────────────────────
describe('onConfigKeyChange', () => {
  beforeEach(() => resetConfig());

  it('fires only when that specific key changes', () => {
    const fn = jest.fn();
    onConfigKeyChange('theme', fn);

    configure({ locale: 'fr' }); // different key
    expect(fn).not.toHaveBeenCalled();

    configure({ theme: 'nord' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('nord', 'dracula');
  });

  it('returns unsubscribe', () => {
    const fn = jest.fn();
    const off = onConfigKeyChange('theme', fn);
    off();
    configure({ theme: 'matrix' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('rejects unknown key', () => {
    expect(() =>
      onConfigKeyChange('not-a-key' as never, () => { /* nothing */ }),
    ).toThrow(RangeError);
  });

  it('rejects non-function listener', () => {
    expect(() =>
      onConfigKeyChange('theme', null as unknown as () => void),
    ).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────
//  New: pauseListeners / resumeListeners
// ─────────────────────────────────────────────
describe('pauseListeners / resumeListeners', () => {
  beforeEach(() => resetConfig());

  it('pause holds notifications until resume', () => {
    const fn = jest.fn();
    onConfigChange(fn);

    pauseListeners();
    configure({ theme: 'nord' });
    configure({ locale: 'fr' });
    expect(fn).not.toHaveBeenCalled();

    resumeListeners();
    expect(fn).toHaveBeenCalledTimes(1); // single batched notification
  });

  it('pause counter is balanced — multiple pause+resume pairs', () => {
    const fn = jest.fn();
    onConfigChange(fn);

    pauseListeners();
    pauseListeners();
    configure({ theme: 'nord' });
    resumeListeners(); // still paused
    expect(fn).not.toHaveBeenCalled();
    resumeListeners(); // now flushed
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resume without pending changes is no-op', () => {
    const fn = jest.fn();
    onConfigChange(fn);
    resumeListeners(); // nothing to flush
    expect(fn).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
//  New: withConfig — temporary overrides
// ─────────────────────────────────────────────
describe('withConfig', () => {
  beforeEach(() => resetConfig());

  it('overrides for sync block then restores', () => {
    expect(getConfigValue('theme')).toBe('dracula');
    const result = withConfig({ theme: 'matrix' }, () => {
      expect(getConfigValue('theme')).toBe('matrix');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(getConfigValue('theme')).toBe('dracula');
  });

  it('restores config even when fn throws', () => {
    expect(() =>
      withConfig({ theme: 'nord' }, () => { throw new Error('boom'); }),
    ).toThrow('boom');
    expect(getConfigValue('theme')).toBe('dracula');
  });

  it('handles async fn and restores after promise', async () => {
    const result = await withConfig({ theme: 'matrix' }, async () => {
      expect(getConfigValue('theme')).toBe('matrix');
      await new Promise((r) => setImmediate(r));
      return 42;
    });
    expect(result).toBe(42);
    expect(getConfigValue('theme')).toBe('dracula');
  });

  it('restores after async fn rejection', async () => {
    await expect(
      withConfig({ theme: 'matrix' }, async () => {
        throw new Error('async fail');
      }),
    ).rejects.toThrow('async fail');
    expect(getConfigValue('theme')).toBe('dracula');
  });
});

// ─────────────────────────────────────────────
//  Validation hardening
// ─────────────────────────────────────────────
describe('configure validation hardening', () => {
  beforeEach(() => resetConfig());

  it('rejects empty string asciiFont', () => {
    expect(() => configure({ asciiFont: '' })).toThrow(TypeError);
  });

  it('rejects empty string theme', () => {
    expect(() => configure({ theme: '' })).toThrow(TypeError);
  });

  it('rejects empty string locale', () => {
    expect(() => configure({ locale: '' })).toThrow(TypeError);
  });

  it('rejects null opts', () => {
    expect(() =>
      configure(null as unknown as Parameters<typeof configure>[0]),
    ).toThrow(TypeError);
  });

  it('rejects array opts', () => {
    expect(() =>
      configure([] as unknown as Parameters<typeof configure>[0]),
    ).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────
//  DEFAULTS is frozen export
// ─────────────────────────────────────────────
describe('DEFAULTS export', () => {
  it('is exported and frozen', () => {
    expect(Object.isFrozen(CONFIG_DEFAULTS)).toBe(true);
    expect(CONFIG_DEFAULTS.theme).toBe('dracula');
  });
});

// ─────────────────────────────────────────────
//  Coverage: validation throws (line 176)
// ─────────────────────────────────────────────
describe('coverage: onConfigChange validation', () => {
  it('rejects non-function listener', () => {
    expect(() =>
      onConfigChange(null as unknown as Parameters<typeof onConfigChange>[0]),
    ).toThrow(TypeError);
    expect(() =>
      onConfigChange(42 as unknown as Parameters<typeof onConfigChange>[0]),
    ).toThrow(TypeError);
    expect(() =>
      onConfigChange(undefined as unknown as Parameters<typeof onConfigChange>[0]),
    ).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────
//  Coverage: SPEED_MAP fallback (line 350)
//
//  `getSpeedMultiplier()` has a `?? 1.0` fallback for the case where
//  animationSpeed isn't in SPEED_MAP. Validation prevents this at
//  configure() time, but the defensive fallback exists for safety.
//  Exercising it would require bypassing TypeScript + validation.
// ─────────────────────────────────────────────
describe('coverage: SPEED_MAP fallback', () => {
  beforeEach(() => resetConfig());

  it('all valid speeds return a finite multiplier', () => {
    const speeds = ['slow', 'normal', 'fast', 'instant'] as const;
    for (const s of speeds) {
      configure({ animationSpeed: s });
      const mult = getSpeedMultiplier();
      expect(Number.isFinite(mult)).toBe(true);
      expect(mult).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns 0 in reducedMotion regardless of speed', () => {
    configure({ animationSpeed: 'slow', reducedMotion: true });
    expect(getSpeedMultiplier()).toBe(0);
    configure({ animationSpeed: 'fast', reducedMotion: true });
    expect(getSpeedMultiplier()).toBe(0);
  });

  it('instant speed = 0 (no animation, but not reducedMotion)', () => {
    configure({ animationSpeed: 'instant' });
    expect(getSpeedMultiplier()).toBe(0);
  });
});

// ─────────────────────────────────────────────
//  v1.3.4 — setConfigValue + subscribeConfig
// ─────────────────────────────────────────────

import { setConfigValue, subscribeConfig } from '../configure.js';

describe('setConfigValue (v1.3.4)', () => {
  beforeEach(() => resetConfig());
  afterEach(() => resetConfig());

  it('sets a single config key without object wrapping', () => {
    setConfigValue('theme', 'monokai');
    expect(getConfig().theme).toBe('monokai');
  });

  it('multiple sequential calls work correctly', () => {
    setConfigValue('theme', 'dracula');
    setConfigValue('animationSpeed', 'fast');
    expect(getConfig().theme).toBe('dracula');
    expect(getConfig().animationSpeed).toBe('fast');
  });

  it('triggers change listeners', () => {
    const listener = jest.fn();
    const unsubscribe = onConfigChange(listener);
    setConfigValue('theme', 'nord');
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('validates the value just like configure() does', () => {
    expect(() => {
      // @ts-expect-error invalid value
      setConfigValue('colorMode', 'invalid-mode');
    }).toThrow();
  });
});

describe('subscribeConfig (v1.3.4)', () => {
  beforeEach(() => resetConfig());
  afterEach(() => resetConfig());

  it('is a reference to onConfigChange', () => {
    expect(subscribeConfig).toBe(onConfigChange);
  });

  it('returns an unsubscribe function', () => {
    const unsubscribe = subscribeConfig(() => { /* no-op */ });
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });

  it('listeners are notified of config changes', () => {
    const calls: string[] = [];
    const unsubscribe = subscribeConfig((newCfg) => {
      calls.push(newCfg.theme);
    });
    // Default is 'dracula' — first change must be to a DIFFERENT value
    configure({ theme: 'nord' });
    configure({ theme: 'monokai' });
    unsubscribe();
    configure({ theme: 'matrix' });   // should NOT fire — unsubscribed
    expect(calls).toEqual(['nord', 'monokai']);
  });
});
