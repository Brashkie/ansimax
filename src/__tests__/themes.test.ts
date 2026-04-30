import { themes } from '../themes/index.js';
import { setNoColor, resetNoColor } from '../colors/index.js';
import { stripAnsi } from '../utils/helpers.js';

describe('themes', () => {
  beforeEach(() => {
    setNoColor(false);       // Force colors ON — Jest has no TTY
    themes.use('dracula');   // Reset to default theme
  });

  afterEach(() => {
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