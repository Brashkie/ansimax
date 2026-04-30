import { configure, getConfig, getSpeedMultiplier } from '../configure.js';

describe('configure', () => {
  afterEach(() => {
    // Reset to defaults after each test
    configure({
      colorMode: 'truecolor',
      animationSpeed: 'normal',
      asciiFont: 'big',
      locale: 'es',
      theme: 'dracula',
    });
  });

  it('returns default config', () => {
    const config = getConfig();
    expect(config.colorMode).toBe('truecolor');
    expect(config.animationSpeed).toBe('normal');
    expect(config.asciiFont).toBe('big');
    expect(config.locale).toBe('es');
    expect(config.theme).toBe('dracula');
  });

  it('updates colorMode', () => {
    configure({ colorMode: 'basic' });
    expect(getConfig().colorMode).toBe('basic');
  });

  it('updates animationSpeed', () => {
    configure({ animationSpeed: 'fast' });
    expect(getConfig().animationSpeed).toBe('fast');
  });

  it('updates asciiFont', () => {
    configure({ asciiFont: 'small' });
    expect(getConfig().asciiFont).toBe('small');
  });

  it('updates locale', () => {
    configure({ locale: 'en' });
    expect(getConfig().locale).toBe('en');
  });

  it('updates theme', () => {
    configure({ theme: 'nord' });
    expect(getConfig().theme).toBe('nord');
  });

  it('partial update preserves other settings', () => {
    configure({ colorMode: '256' });
    const config = getConfig();
    expect(config.colorMode).toBe('256');
    expect(config.animationSpeed).toBe('normal'); // unchanged
    expect(config.locale).toBe('es'); // unchanged
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

describe('getSpeedMultiplier', () => {
  afterEach(() => configure({ animationSpeed: 'normal' }));

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

  it('returns 1.0 fallback for unknown animationSpeed value', () => {
    // Force an unrecognized value to hit the ?? 1.0 branch
    // @ts-expect-error intentionally invalid value
    configure({ animationSpeed: 'turbo' });
    expect(getSpeedMultiplier()).toBe(1.0);
  });
});