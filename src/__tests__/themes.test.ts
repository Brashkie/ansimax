import { themes, createTheme, clearThemeColorCache, type Theme } from '../themes/index.js';
import { setNoColor, resetNoColor } from '../colors/index.js';
import { resetColorSupportCache } from '../utils/ansi.js';
import { stripAnsi } from '../utils/helpers.js';

describe('themes', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);       // Force colors ON — Jest has no TTY
    themes.use('dracula');   // Reset to default theme
  });

  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();          // Restore auto-detect
  });

  describe('list', () => {
    it('returns all theme names', () => {
      const list = themes.list();
      expect(list).toContain('dracula');
      expect(list).toContain('nord');
      expect(list).toContain('monokai');
      expect(list).toContain('cyberpunk');
      expect(list).toContain('pastel');
      expect(list).toContain('matrix');
      expect(list).toContain('ocean');
      expect(list).toContain('sunset');
    });

    it('returns at least 8 themes', () => {
      expect(themes.list().length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('get', () => {
    it('returns theme object for valid name', () => {
      const t = themes.get('dracula');
      expect(t).not.toBeNull();
      expect(t?.name).toBe('Dracula');
    });

    it('returns null for invalid name', () => {
      expect(themes.get('nonexistent')).toBeNull();
    });

    it('theme object has required properties', () => {
      const t = themes.get('nord');
      expect(t).toHaveProperty('primary');
      expect(t).toHaveProperty('secondary');
      expect(t).toHaveProperty('accent');
      expect(t).toHaveProperty('error');
      expect(t).toHaveProperty('warning');
      expect(t).toHaveProperty('gradient');
    });
  });

  describe('use', () => {
    it('changes the active theme', () => {
      themes.use('nord');
      expect(themes.current().name).toBe('Nord');
    });

    it('throws for unknown theme', () => {
      expect(() => themes.use('unknown')).toThrow();
    });

    it('returns themes for chaining', () => {
      const result = themes.use('matrix');
      expect(result).toBe(themes);
    });
  });

  describe('current', () => {
    it('returns dracula by default', () => {
      expect(themes.current().name).toBe('Dracula');
    });

    it('reflects theme change after use()', () => {
      themes.use('cyberpunk');
      expect(themes.current().name).toBe('Cyberpunk');
    });
  });

  describe('color functions', () => {
    const fns = ['primary','secondary','accent','warning','error','info','muted','text'] as const;

    for (const fn of fns) {
      it(`${fn}() wraps text with color`, () => {
        const result = themes[fn]('hello');
        expect(stripAnsi(result)).toBe('hello');
        expect(result).toContain('\x1b[38;2;');
      });
    }

    it('bold() applies bold style', () => {
      expect(themes.bold('x')).toContain('\x1b[1m');
    });

    it('gradient() applies gradient', () => {
      const result = themes.gradient('ABC');
      expect(stripAnsi(result)).toBe('ABC');
      expect(result).toContain('\x1b[38;2;');
    });
  });

  describe('register', () => {
    it('registers a custom theme', () => {
      themes.register('custom', {
        name: 'Custom',
        primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
        warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
        muted: '#888888', bg: '#000000', surface: '#111111',
        text: '#ffffff', gradient: ['#ff0000', '#0000ff'],
      });
      expect(themes.list()).toContain('custom');
      const t = themes.get('custom');
      expect(t?.name).toBe('Custom');
    });
  });

  describe('preview', () => {
    it('runs without throwing', () => {
      expect(() => themes.preview()).not.toThrow();
    });
  });
});


// ─────────────────────────────────────────────
//  NO_COLOR consistency — themes respect global suppression
// ─────────────────────────────────────────────
describe('themes — NO_COLOR consistency', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearThemeColorCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
    clearThemeColorCache();
  });

  it('themes.primary() respects setNoColor(true)', () => {
    setNoColor(true);
    const result = themes.primary('hello');
    expect(result).toBe('hello'); // no escapes
  });

  it('themes.bold() respects setNoColor(true)', () => {
    setNoColor(true);
    expect(themes.bold('x')).toBe('x');
  });

  it('themes.gradient() respects setNoColor(true)', () => {
    setNoColor(true);
    expect(themes.gradient('ABC')).toBe('ABC');
  });

  it('all theme color functions respect NO_COLOR', () => {
    setNoColor(true);
    const fns = ['primary','secondary','accent','warning','error','info','muted','text'] as const;
    for (const fn of fns) {
      expect(themes[fn]('test')).toBe('test');
    }
  });
});

// ─────────────────────────────────────────────
//  register — validation
// ─────────────────────────────────────────────
describe('themes.register validation', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearThemeColorCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
    clearThemeColorCache();
  });

  const validBase = {
    name: 'Test',
    primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
    warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
    muted: '#888888', bg: '#000000', surface: '#111111',
    text: '#ffffff', gradient: ['#ff0000', '#0000ff'],
  };

  it('rejects theme with invalid primary hex', () => {
    expect(() =>
      themes.register('bad-primary', { ...validBase, primary: 'red' }),
    ).toThrow(/Invalid hex.*primary/);
  });

  it('rejects theme with invalid gradient stop', () => {
    expect(() =>
      themes.register('bad-grad', { ...validBase, gradient: ['#ff0000', 'not-hex'] }),
    ).toThrow(/Invalid hex.*gradient/);
  });

  it('rejects theme with single-stop gradient', () => {
    expect(() =>
      themes.register('short-grad', { ...validBase, gradient: ['#ff0000'] }),
    ).toThrow(/at least 2 colors/);
  });

  it('rejects theme with non-array gradient', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      themes.register('non-arr', { ...validBase, gradient: '#ff0000' }),
    ).toThrow(/at least 2 colors/);
  });

  it('rejects theme with empty name', () => {
    expect(() =>
      themes.register('empty-name', { ...validBase, name: '' }),
    ).toThrow(/non-empty/);
  });

  it('rejects null/undefined input', () => {
    expect(() =>
      // @ts-expect-error testing runtime safety
      themes.register('null', null),
    ).toThrow(/object/);
  });

  it('accepts a fully valid theme', () => {
    expect(() =>
      themes.register('valid-test', validBase),
    ).not.toThrow();
    expect(themes.list()).toContain('valid-test');
  });

  it('accepts 3-digit hex colors', () => {
    expect(() =>
      themes.register('short-hex', { ...validBase, primary: '#f00' }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  gradient with custom override
// ─────────────────────────────────────────────
describe('themes.gradient custom stops', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('uses active theme gradient by default', () => {
    themes.use('dracula');
    const result = themes.gradient('TEST');
    expect(stripAnsi(result)).toBe('TEST');
    expect(result).toContain('\x1b[38;2;');
  });

  it('accepts custom gradient override', () => {
    const result = themes.gradient('TEST', ['#ff0000', '#0000ff']);
    expect(stripAnsi(result)).toBe('TEST');
  });
});

// ─────────────────────────────────────────────
//  banner integration with ASCII
// ─────────────────────────────────────────────
describe('themes.banner integration', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearThemeColorCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('renders ASCII banner with theme gradient', () => {
    themes.use('dracula');
    const result = themes.banner('A');
    // Should contain block characters (BLOCK font)
    expect(result).toContain('█');
    // Should contain color escapes from the gradient
    expect(result).toContain('\x1b[38;2;');
  });

  it('forwards font option to ascii.banner', () => {
    const result = themes.banner('A', { font: 'small' });
    // small font is 3 lines tall
    expect(result.split('\n').length).toBeGreaterThan(1);
  });

  it('forwards align option', () => {
    const result = themes.banner('X', { align: 'center' });
    expect(stripAnsi(result).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
//  preview — returns string, doesn't print
// ─────────────────────────────────────────────
describe('themes.preview', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('returns a multi-line string', () => {
    const result = themes.preview();
    expect(typeof result).toBe('string');
    expect(result.split('\n').length).toBeGreaterThanOrEqual(8);
  });

  it('does NOT call console.log', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    themes.preview();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('preview includes all theme names', () => {
    const result = stripAnsi(themes.preview());
    expect(result).toContain('Dracula');
    expect(result).toContain('Nord');
    expect(result).toContain('Matrix');
    expect(result).toContain('Sunset');
  });

  it('does not modify active theme', () => {
    themes.use('matrix');
    themes.preview();
    expect(themes.current().name).toBe('Matrix');
  });
});

// ─────────────────────────────────────────────
//  createTheme — isolated instances
// ─────────────────────────────────────────────
describe('createTheme — isolated instances', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearThemeColorCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('creates an independent instance', () => {
    const ui = createTheme('nord');
    const logs = createTheme('matrix');
    expect(ui.current().name).toBe('Nord');
    expect(logs.current().name).toBe('Matrix');
  });

  it('use() on one instance does not affect another', () => {
    const a = createTheme('dracula');
    const b = createTheme('ocean');
    a.use('cyberpunk');
    expect(a.current().name).toBe('Cyberpunk');
    expect(b.current().name).toBe('Ocean');
  });

  it('global themes singleton is not affected by createTheme', () => {
    themes.use('dracula');
    const isolated = createTheme('matrix');
    isolated.use('sunset');
    expect(themes.current().name).toBe('Dracula');
  });

  it('falls back to dracula when initial name is unknown', () => {
    const t = createTheme('nonexistent');
    expect(t.current().name).toBe('Dracula');
  });

  it('isolated instance has all the same methods', () => {
    const t = createTheme('nord');
    expect(typeof t.primary).toBe('function');
    expect(typeof t.banner).toBe('function');
    expect(typeof t.gradient).toBe('function');
    expect(typeof t.preview).toBe('function');
    expect(typeof t.register).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  ColorFn cache
// ─────────────────────────────────────────────
describe('ColorFn cache', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearThemeColorCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
    resetNoColor();
  });

  it('clearThemeColorCache does not throw', () => {
    expect(() => clearThemeColorCache()).not.toThrow();
  });

  it('repeated calls produce identical output (cache hit)', () => {
    themes.use('dracula');
    const a = themes.primary('test');
    const b = themes.primary('test');
    expect(a).toBe(b);
  });
});

// ─────────────────────────────────────────────
//  Instance isolation
// ─────────────────────────────────────────────
describe('createTheme isolation', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('register on one instance does not affect another', () => {
    const a = createTheme('dracula');
    const b = createTheme('nord');

    a.register('custom-only-on-a', {
      name: 'CustomA',
      primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
      warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
      muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
      gradient: ['#ff0000', '#00ff00'],
    });

    expect(a.list()).toContain('custom-only-on-a');
    expect(b.list()).not.toContain('custom-only-on-a');
  });

  it('switching theme on one instance does not affect another', () => {
    const a = createTheme('dracula');
    const b = createTheme('dracula');

    a.use('matrix');
    expect(a.current().name).toBe('Matrix');
    expect(b.current().name).toBe('Dracula');
  });

  it('listeners are scoped per instance', () => {
    const a = createTheme();
    const b = createTheme();
    const aFn = jest.fn();
    const bFn = jest.fn();
    a.onChange(aFn);
    b.onChange(bFn);
    a.use('nord');
    expect(aFn).toHaveBeenCalledTimes(1);
    expect(bFn).toHaveBeenCalledTimes(0);
  });
});

// ─────────────────────────────────────────────
//  tryUse — tolerant variant
// ─────────────────────────────────────────────
describe('tryUse', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('returns true when theme exists', () => {
    const t = createTheme('dracula');
    expect(t.tryUse('nord')).toBe(true);
    expect(t.current().name).toBe('Nord');
  });

  it('returns false when theme missing (no throw)', () => {
    const t = createTheme('dracula');
    expect(() => t.tryUse('not-a-theme')).not.toThrow();
    expect(t.tryUse('not-a-theme')).toBe(false);
    // Active theme unchanged
    expect(t.current().name).toBe('Dracula');
  });
});

// ─────────────────────────────────────────────
//  onChange listeners
// ─────────────────────────────────────────────
describe('onChange listeners', () => {
  it('fires on use() with old + new theme', () => {
    const t = createTheme('dracula');
    const fn = jest.fn();
    t.onChange(fn);
    t.use('nord');
    expect(fn).toHaveBeenCalledTimes(1);
    const [newT, oldT] = fn.mock.calls[0]!;
    expect(newT.name).toBe('Nord');
    expect(oldT.name).toBe('Dracula');
  });

  it('does not fire when same theme is selected', () => {
    const t = createTheme('dracula');
    const fn = jest.fn();
    t.onChange(fn);
    t.use('dracula');
    expect(fn).not.toHaveBeenCalled();
  });

  it('fires on tryUse', () => {
    const t = createTheme('dracula');
    const fn = jest.fn();
    t.onChange(fn);
    t.tryUse('nord');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns unsubscribe function', () => {
    const t = createTheme();
    const fn = jest.fn();
    const off = t.onChange(fn);
    off();
    t.use('nord');
    expect(fn).not.toHaveBeenCalled();
  });

  it('listener errors do not propagate', () => {
    const t = createTheme();
    const bad = (): void => { throw new Error('boom'); };
    const good = jest.fn();
    t.onChange(bad);
    t.onChange(good);
    expect(() => t.use('nord')).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
//  unregister
// ─────────────────────────────────────────────
describe('unregister', () => {
  it('removes a registered theme', () => {
    const t = createTheme('dracula');
    t.register('temp', {
      name: 'Temp',
      primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
      warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
      muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
      gradient: ['#ff0000', '#00ff00'],
    });
    expect(t.list()).toContain('temp');
    t.unregister('temp');
    expect(t.list()).not.toContain('temp');
  });

  it('throws when removing the active theme', () => {
    const t = createTheme('dracula');
    expect(() => t.unregister('dracula')).toThrow(/active/);
  });
});

// ─────────────────────────────────────────────
//  style() dynamic accessor
// ─────────────────────────────────────────────
describe('style() accessor', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('returns the matching color fn', () => {
    const t = createTheme('dracula');
    const fn = t.style('primary');
    expect(typeof fn).toBe('function');
    const colored = fn('hello');
    // Should be colored (Dracula primary #bd93f9)
    expect(colored).toContain('\x1b[38;2;');
  });

  it('returns identity for unknown name (no throw)', () => {
    const t = createTheme();
    // @ts-expect-error testing runtime safety
    const fn = t.style('not-a-style');
    expect(fn('hello')).toBe('hello');
  });

  it('all valid style names work', () => {
    const t = createTheme();
    const names = ['primary', 'secondary', 'accent', 'success',
                   'warning', 'error', 'info', 'muted', 'text'] as const;
    for (const name of names) {
      expect(typeof t.style(name)).toBe('function');
    }
  });
});

// ─────────────────────────────────────────────
//  success color (with fallback)
// ─────────────────────────────────────────────
describe('success color', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('all built-in themes expose a working success color', () => {
    const t = createTheme();
    for (const name of t.list()) {
      t.use(name);
      const colored = t.success('test');
      expect(stripAnsi(colored)).toBe('test');
      expect(colored).toContain('\x1b[38;2;');
    }
  });

  it('falls back to accent when user-registered theme omits success', () => {
    const t = createTheme();
    t.register('no-success', {
      name: 'NoSuccess',
      primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
      warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
      muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
      gradient: ['#ff0000', '#00ff00'],
      // success deliberately omitted
    });
    t.use('no-success');
    const colored = t.success('test');
    // Should fall back to accent (#0000ff)
    expect(colored).toContain('\x1b[38;2;0;0;255m');
  });
});

// ─────────────────────────────────────────────
//  Background color helpers
// ─────────────────────────────────────────────
describe('background colors', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('bgPrimary applies background color', () => {
    const t = createTheme('dracula');
    const result = t.bgPrimary('test');
    expect(stripAnsi(result)).toBe('test');
    expect(result).toContain('\x1b[48;2;'); // background RGB escape
  });

  it('all bg* methods are functions', () => {
    const t = createTheme();
    expect(typeof t.bgPrimary).toBe('function');
    expect(typeof t.bgSecondary).toBe('function');
    expect(typeof t.bgAccent).toBe('function');
    expect(typeof t.bgSuccess).toBe('function');
    expect(typeof t.bgWarning).toBe('function');
    expect(typeof t.bgError).toBe('function');
    expect(typeof t.bgInfo).toBe('function');
    expect(typeof t.bgMuted).toBe('function');
    expect(typeof t.bgSurface).toBe('function');
  });

  it('bgSurface uses the surface color from theme', () => {
    const t = createTheme('dracula');
    const dracula = t.current();
    const result = t.bgSurface('x');
    // surface is #44475a in dracula
    expect(result).toContain('\x1b[48;2;68;71;90m');
    expect(dracula.surface).toBe('#44475a');
  });
});

// ─────────────────────────────────────────────
//  Validation hardening
// ─────────────────────────────────────────────
describe('register validation', () => {
  it('rejects non-string name', () => {
    const t = createTheme();
    expect(() =>
      t.register(42 as unknown as string, {
        name: 'X',
        primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
        warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
        muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
        gradient: ['#ff0000', '#00ff00'],
      }),
    ).toThrow(TypeError);
  });

  it('rejects empty name', () => {
    const t = createTheme();
    expect(() =>
      t.register('', {
        name: 'X',
        primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
        warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
        muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
        gradient: ['#ff0000', '#00ff00'],
      }),
    ).toThrow(TypeError);
  });

  it('rejects null theme def', () => {
    const t = createTheme();
    expect(() => t.register('x', null as unknown as Theme)).toThrow(TypeError);
  });

  it('rejects array theme def', () => {
    const t = createTheme();
    expect(() => t.register('x', [] as unknown as Theme)).toThrow(TypeError);
  });

  it('rejects gradient with single color', () => {
    const t = createTheme();
    expect(() =>
      t.register('x', {
        name: 'X',
        primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
        warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
        muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
        gradient: ['#ff0000'],
      }),
    ).toThrow(/at least 2/);
  });

  it('accepts hex without # (matches colors module)', () => {
    const t = createTheme();
    expect(() =>
      t.register('hexless', {
        name: 'Hexless',
        primary: 'ff0000', secondary: '00ff00', accent: '0000ff',
        warning: 'ffff00', error: 'ff00ff', info: '00ffff',
        muted: '888888', bg: '000000', surface: '111111', text: 'ffffff',
        gradient: ['ff0000', '00ff00'],
      }),
    ).not.toThrow();
  });
});

// ─────────────────────────────────────────────
//  Coverage: exhaustive function exercise
//
//  These tests exist to guarantee every exported function on the
//  global `themes` singleton and `createTheme()` instance is invoked
//  at least once. The functions themselves are tiny (one-line color
//  wrappers), but Jest counts each as a separate "function" for
//  coverage purposes.
// ─────────────────────────────────────────────
describe('coverage: global themes singleton — every color function', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    themes.use('dracula');
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('exercises every foreground color method', () => {
    expect(stripAnsi(themes.primary('x'))).toBe('x');
    expect(stripAnsi(themes.secondary('x'))).toBe('x');
    expect(stripAnsi(themes.accent('x'))).toBe('x');
    expect(stripAnsi(themes.success('x'))).toBe('x');
    expect(stripAnsi(themes.warning('x'))).toBe('x');
    expect(stripAnsi(themes.error('x'))).toBe('x');
    expect(stripAnsi(themes.info('x'))).toBe('x');
    expect(stripAnsi(themes.muted('x'))).toBe('x');
    expect(stripAnsi(themes.text('x'))).toBe('x');
    expect(stripAnsi(themes.bold('x'))).toBe('x');
  });

  it('exercises every background color method', () => {
    expect(stripAnsi(themes.bgPrimary('x'))).toBe('x');
    expect(stripAnsi(themes.bgSecondary('x'))).toBe('x');
    expect(stripAnsi(themes.bgAccent('x'))).toBe('x');
    expect(stripAnsi(themes.bgSuccess('x'))).toBe('x');
    expect(stripAnsi(themes.bgWarning('x'))).toBe('x');
    expect(stripAnsi(themes.bgError('x'))).toBe('x');
    expect(stripAnsi(themes.bgInfo('x'))).toBe('x');
    expect(stripAnsi(themes.bgMuted('x'))).toBe('x');
    expect(stripAnsi(themes.bgSurface('x'))).toBe('x');
  });

  it('style() exercises every named style + identity fallback', () => {
    const names = ['primary', 'secondary', 'accent', 'success',
                   'warning', 'error', 'info', 'muted', 'text'] as const;
    for (const name of names) {
      const fn = themes.style(name);
      expect(typeof fn).toBe('function');
      expect(stripAnsi(fn('x'))).toBe('x');
    }
    // Unknown name → identity
    // @ts-expect-error testing runtime safety
    expect(themes.style('not-a-style')('hi')).toBe('hi');
  });

  it('gradient() with and without custom stops', () => {
    expect(stripAnsi(themes.gradient('hello'))).toBe('hello');
    expect(stripAnsi(themes.gradient('hello', ['#ff0000', '#0000ff']))).toBe('hello');
  });

  it('banner() renders something', () => {
    const out = themes.banner('hi');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });

  it('preview() lists all themes', () => {
    const out = themes.preview();
    // preview() applies gradients per-char → ANSI escapes interleave with
    // letters, so a raw substring match for "Dracula" fails. Strip ANSI
    // codes before checking the visible content.
    const plain = stripAnsi(out);
    expect(plain).toContain('Dracula');
    expect(plain).toContain('Nord');
  });

  it('get() returns theme or null', () => {
    expect(themes.get('dracula')?.name).toBe('Dracula');
    expect(themes.get('not-a-theme')).toBeNull();
  });

  it('list() returns built-in theme names', () => {
    const list = themes.list();
    expect(list).toContain('dracula');
    expect(list).toContain('nord');
  });

  it('current() returns active theme', () => {
    themes.use('matrix');
    expect(themes.current().name).toBe('Matrix');
    themes.use('dracula');
  });

  it('use() throws on unknown theme', () => {
    expect(() => themes.use('not-a-theme')).toThrow(/not found/);
  });

  it('tryUse() returns false silently for missing', () => {
    expect(themes.tryUse('not-a-theme')).toBe(false);
  });

  it('register() + unregister() cycle on global', () => {
    themes.register('temp-global', {
      name: 'TempGlobal',
      primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
      warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
      muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
      gradient: ['#ff0000', '#0000ff'],
    });
    expect(themes.list()).toContain('temp-global');
    themes.unregister('temp-global');
    expect(themes.list()).not.toContain('temp-global');
  });

  it('global unregister() throws when removing active theme', () => {
    expect(() => themes.unregister('dracula')).toThrow(/active/);
  });

  it('global onChange() listener fires + unsubscribes', () => {
    const fn = jest.fn();
    const off = themes.onChange(fn);
    themes.use('nord');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    themes.use('matrix');
    expect(fn).toHaveBeenCalledTimes(1); // unchanged
    themes.use('dracula');
  });

  it('global onChange() listener errors are swallowed', () => {
    const off1 = themes.onChange(() => { throw new Error('boom'); });
    const fn = jest.fn();
    const off2 = themes.onChange(fn);
    expect(() => themes.use('nord')).not.toThrow();
    expect(fn).toHaveBeenCalled();
    off1(); off2();
    themes.use('dracula');
  });

  it('global register() rejects non-string name', () => {
    expect(() =>
      themes.register(42 as unknown as string, {
        name: 'X', primary: '#000', secondary: '#000', accent: '#000',
        warning: '#000', error: '#000', info: '#000', muted: '#000',
        bg: '#000', surface: '#000', text: '#000',
        gradient: ['#000', '#fff'],
      }),
    ).toThrow(TypeError);
  });
});

describe('coverage: createTheme instance — every color function', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('exercises every method on a per-instance theme', () => {
    const t = createTheme('nord');

    // Foreground methods
    expect(stripAnsi(t.primary('x'))).toBe('x');
    expect(stripAnsi(t.secondary('x'))).toBe('x');
    expect(stripAnsi(t.accent('x'))).toBe('x');
    expect(stripAnsi(t.success('x'))).toBe('x');
    expect(stripAnsi(t.warning('x'))).toBe('x');
    expect(stripAnsi(t.error('x'))).toBe('x');
    expect(stripAnsi(t.info('x'))).toBe('x');
    expect(stripAnsi(t.muted('x'))).toBe('x');
    expect(stripAnsi(t.text('x'))).toBe('x');
    expect(stripAnsi(t.bold('x'))).toBe('x');

    // Background methods
    expect(stripAnsi(t.bgPrimary('x'))).toBe('x');
    expect(stripAnsi(t.bgSecondary('x'))).toBe('x');
    expect(stripAnsi(t.bgAccent('x'))).toBe('x');
    expect(stripAnsi(t.bgSuccess('x'))).toBe('x');
    expect(stripAnsi(t.bgWarning('x'))).toBe('x');
    expect(stripAnsi(t.bgError('x'))).toBe('x');
    expect(stripAnsi(t.bgInfo('x'))).toBe('x');
    expect(stripAnsi(t.bgMuted('x'))).toBe('x');
    expect(stripAnsi(t.bgSurface('x'))).toBe('x');

    // Style accessor + gradient + banner + preview
    expect(typeof t.style('primary')).toBe('function');
    expect(stripAnsi(t.gradient('x'))).toBe('x');
    expect(t.banner('x').length).toBeGreaterThan(0);
    // Strip ANSI — preview() applies per-char gradients that interleave escapes
    expect(stripAnsi(t.preview())).toContain('Nord');

    // Registry methods
    expect(t.get('dracula')?.name).toBe('Dracula');
    expect(t.list().length).toBeGreaterThan(0);
    expect(t.current().name).toBe('Nord');
  });

  it('createTheme with unknown initial theme falls back to dracula', () => {
    const t = createTheme('not-a-theme');
    expect(t.current().name).toBe('Dracula');
  });
});

// ─────────────────────────────────────────────
//  Coverage: success fallback to accent (line 184)
// ─────────────────────────────────────────────
describe('coverage: success color fallback', () => {
  beforeEach(() => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
  });
  afterEach(() => {
    delete process.env['FORCE_COLOR'];
    resetColorSupportCache();
  });

  it('global bgSuccess uses accent fallback for theme without success', () => {
    themes.register('no-success-global', {
      name: 'NoSuccessGlobal',
      primary: '#ff0000', secondary: '#00ff00', accent: '#0000ff',
      // success deliberately omitted
      warning: '#ffff00', error: '#ff00ff', info: '#00ffff',
      muted: '#888888', bg: '#000000', surface: '#111111', text: '#ffffff',
      gradient: ['#ff0000', '#0000ff'],
    });
    themes.use('no-success-global');
    const out = themes.bgSuccess('x');
    // Should be bg with accent color #0000ff
    expect(out).toContain('\x1b[48;2;0;0;255m');
    themes.use('dracula');
    themes.unregister('no-success-global');
  });
});

// ─────────────────────────────────────────────
//  v1.1.2 — Error type uniformity
// ─────────────────────────────────────────────
describe('themes: v1.1.2 error types', () => {
  it('themes.use("nonexistent") throws RangeError', () => {
    expect(() => themes.use('definitely-not-a-theme-xyz')).toThrow(RangeError);
  });

  it('themes.use error includes "Available themes:" in message', () => {
    expect(() => themes.use('nope')).toThrow(/Available themes:/);
  });

  it('themes.register with invalid name throws TypeError', () => {
    expect(() => themes.register('test-no-name', {
      // Missing required `name` field
      primary: '#ff0000',
      secondary: '#0000ff',
      accent: '#00ff00',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#0000ff',
      muted: '#808080',
      bg: '#000000',
      surface: '#111111',
      text: '#ffffff',
      gradient: ['#ff0000', '#0000ff'],
    } as unknown as Parameters<typeof themes.register>[1])).toThrow(TypeError);
  });

  it('themes.register with invalid hex throws TypeError', () => {
    expect(() => themes.register('bad-hex', {
      name: 'Bad',
      primary: 'not-a-hex',
      secondary: '#0000ff',
      accent: '#00ff00',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#0000ff',
      muted: '#808080',
      bg: '#000000',
      surface: '#111111',
      text: '#ffffff',
      gradient: ['#ff0000', '#0000ff'],
    })).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────
//  v1.2.2 — Error codes
// ─────────────────────────────────────────────
describe('themes: error codes (v1.2.2)', () => {
  it('themes.use("nonexistent") error has code ANSIMAX_UNKNOWN_THEME', () => {
    try {
      themes.use('definitely-not-a-real-theme-zzz');
      fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RangeError);
      expect((e as Error & { code?: string }).code).toBe('ANSIMAX_UNKNOWN_THEME');
    }
  });

  it('themes.register with non-object error has code ANSIMAX_INVALID_THEME', () => {
    try {
      themes.register('bad', null as unknown as Parameters<typeof themes.register>[1]);
      fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
      expect((e as Error & { code?: string }).code).toBe('ANSIMAX_INVALID_THEME');
    }
  });

  it('themes.register with missing name error has code ANSIMAX_INVALID_THEME_NAME', () => {
    try {
      themes.register('bad', {
        primary: '#ff0000', secondary: '#0000ff', accent: '#00ff00',
        success: '#00ff00', warning: '#ffff00', error: '#ff0000',
        info: '#0000ff', muted: '#808080', bg: '#000000',
        surface: '#111111', text: '#ffffff',
        gradient: ['#ff0000', '#0000ff'],
      } as unknown as Parameters<typeof themes.register>[1]);
      fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(TypeError);
      expect((e as Error & { code?: string }).code).toBe('ANSIMAX_INVALID_THEME_NAME');
    }
  });
});
