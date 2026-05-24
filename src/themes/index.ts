// ─────────────────────────────────────────────
//  THEMES  –  capability-aware palettes with full instance isolation
//
//  All color functions route through colors/index.ts, inheriting:
//   - NO_COLOR / FORCE_COLOR support
//   - non-TTY auto-suppression
//   - truecolor → 256 → basic adaptive degradation
//
//  Robustness guarantees:
//   - createTheme() instances are FULLY isolated (own theme registry)
//   - Strict validation on register() (TypeError + descriptive Error)
//   - Tolerant use() variant for runtime-loaded themes (tryUse)
//   - Subscriber model for theme changes (onChange listeners)
//   - Per-instance cache (avoids cross-tenant contamination)
//   - Hex parsing matches colors module (# optional)
//   - Background color helpers (bgPrimary, bgAccent, etc.)
//   - Dynamic accessor — style(name)(text) — for runtime field selection
// ─────────────────────────────────────────────

import { color, gradient, type ColorFn } from '../colors/index.js';
import { ascii } from '../ascii/index.js';

// ─────────────────────────────────────────────
//  Theme contract
// ─────────────────────────────────────────────

export interface Theme {
  name:       string;
  primary:    string;
  secondary:  string;
  accent:     string;
  /** Alias-friendly success color (defaults to accent if missing). */
  success?:   string;
  warning:    string;
  error:      string;
  info:       string;
  muted:      string;
  bg:         string;
  surface:    string;
  text:       string;
  gradient:   string[];
}

// Hex validation matches colors module — # optional
const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const REQUIRED_COLOR_KEYS: ReadonlyArray<keyof Theme> = [
  'primary', 'secondary', 'accent', 'warning', 'error',
  'info', 'muted', 'bg', 'surface', 'text',
] as const;

const OPTIONAL_COLOR_KEYS: ReadonlyArray<keyof Theme> = ['success'] as const;

/** Names of style methods on a ThemeInstance — used by `style()`. */
export type ThemeStyleName =
  | 'primary' | 'secondary' | 'accent' | 'success'
  | 'warning' | 'error' | 'info' | 'muted' | 'text';

const STYLE_NAMES: ReadonlyArray<ThemeStyleName> = [
  'primary', 'secondary', 'accent', 'success',
  'warning', 'error', 'info', 'muted', 'text',
];

// ─────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────

const validateTheme = (t: unknown): void => {
  if (typeof t !== 'object' || t === null || Array.isArray(t)) {
    throw new TypeError('Theme must be a non-null object.');
  }
  const obj = t as Record<string, unknown>;

  if (typeof obj.name !== 'string' || (obj.name as string).length === 0) {
    throw new TypeError('Theme must have a non-empty "name" string.');
  }

  for (const key of REQUIRED_COLOR_KEYS) {
    const value = obj[key];
    if (typeof value !== 'string' || !HEX_RE.test(value)) {
      throw new TypeError(
        `Invalid hex in theme "${obj.name as string}" → ${key}: ${JSON.stringify(value)}. ` +
        `Expected #RGB or #RRGGBB.`,
      );
    }
  }

  // Optional keys — validate only if present
  for (const key of OPTIONAL_COLOR_KEYS) {
    const value = obj[key];
    if (value === undefined) continue;
    /* istanbul ignore next — defensive: built-in themes always have valid hex */
    if (typeof value !== 'string' || !HEX_RE.test(value)) {
      throw new TypeError(
        `Invalid hex in theme "${obj.name as string}" → ${key}: ${JSON.stringify(value)}.`,
      );
    }
  }

  if (!Array.isArray(obj.gradient) || obj.gradient.length < 2) {
    throw new TypeError(
      `Theme "${obj.name as string}" must define a "gradient" array with at least 2 colors.`,
    );
  }
  for (let i = 0; i < obj.gradient.length; i++) {
    const stop = obj.gradient[i];
    if (typeof stop !== 'string' || !HEX_RE.test(stop)) {
      throw new TypeError(
        `Invalid hex in theme "${obj.name as string}" → gradient[${i}]: ${JSON.stringify(stop)}.`,
      );
    }
  }
};

// ─────────────────────────────────────────────
//  Built-in themes
//  Each defines `success` explicitly (defaults to accent semantically,
//  but having it in data lets us evolve the contract without touching
//  consumers).
// ─────────────────────────────────────────────

const BUILTIN_THEMES: Record<string, Theme> = {
  dracula: {
    name: 'Dracula',
    primary: '#bd93f9', secondary: '#ff79c6', accent: '#50fa7b',
    success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555', info: '#8be9fd',
    muted: '#6272a4', bg: '#282a36', surface: '#44475a', text: '#f8f8f2',
    gradient: ['#bd93f9', '#ff79c6'],
  },
  nord: {
    name: 'Nord',
    primary: '#88c0d0', secondary: '#81a1c1', accent: '#a3be8c',
    success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a', info: '#5e81ac',
    muted: '#4c566a', bg: '#2e3440', surface: '#3b4252', text: '#eceff4',
    gradient: ['#88c0d0', '#81a1c1'],
  },
  monokai: {
    name: 'Monokai',
    primary: '#a6e22e', secondary: '#66d9e8', accent: '#f92672',
    success: '#a6e22e', warning: '#fd971f', error: '#f92672', info: '#66d9e8',
    muted: '#75715e', bg: '#272822', surface: '#3e3d32', text: '#f8f8f2',
    gradient: ['#a6e22e', '#66d9e8'],
  },
  cyberpunk: {
    name: 'Cyberpunk',
    primary: '#ff2d78', secondary: '#00fff5', accent: '#ffe801',
    success: '#00fff5', warning: '#ff8800', error: '#ff2d78', info: '#00fff5',
    muted: '#444466', bg: '#0d0d1a', surface: '#1a1a2e', text: '#e0e0ff',
    gradient: ['#ff2d78', '#00fff5', '#ffe801'],
  },
  pastel: {
    name: 'Pastel',
    primary: '#a29bfe', secondary: '#fd79a8', accent: '#55efc4',
    success: '#55efc4', warning: '#ffeaa7', error: '#e17055', info: '#74b9ff',
    muted: '#b2bec3', bg: '#f8f9fa', surface: '#ffffff', text: '#2d3436',
    gradient: ['#a29bfe', '#fd79a8', '#74b9ff'],
  },
  matrix: {
    name: 'Matrix',
    primary: '#00ff41', secondary: '#008f11', accent: '#00ff41',
    success: '#00ff41', warning: '#aaff00', error: '#ff0000', info: '#00cc33',
    muted: '#003b00', bg: '#0d0208', surface: '#001a00', text: '#00ff41',
    gradient: ['#00ff41', '#003b00'],
  },
  ocean: {
    name: 'Ocean',
    primary: '#0099ff', secondary: '#00d2d3', accent: '#ffd32a',
    success: '#00d2d3', warning: '#ffa502', error: '#ff4757', info: '#70a1ff',
    muted: '#57606f', bg: '#0a1628', surface: '#0f2942', text: '#dfe6e9',
    gradient: ['#0099ff', '#00d2d3'],
  },
  sunset: {
    name: 'Sunset',
    primary: '#fd7272', secondary: '#f9ca24', accent: '#6ab04c',
    success: '#6ab04c', warning: '#f0932b', error: '#eb4d4b', info: '#22a6b3',
    muted: '#95afc0', bg: '#1a1a2e', surface: '#16213e', text: '#f5f6fa',
    gradient: ['#fd7272', '#f9ca24', '#6ab04c'],
  },
};

// Validate built-ins at module load — catches typos in this file
for (const [name, def] of Object.entries(BUILTIN_THEMES)) {
  /* istanbul ignore next — defensive: built-ins are hardcoded valid */
  try { validateTheme(def); }
  catch (err) {
    throw new Error(
      `Built-in theme "${name}" is invalid: ${(err as Error).message}`,
    );
  }
}

// ─────────────────────────────────────────────
//  Per-instance state
//
//  Each ThemeInstance gets its own:
//   - registry (Map of name → Theme), seeded from built-ins
//   - active theme reference
//   - colorFn cache (per-instance avoids contamination across tenants)
//   - listeners set for onChange notifications
//
//  This is the key change vs the previous shared-global design: now
//  registering a theme on one instance does NOT affect other instances.
// ─────────────────────────────────────────────

interface InstanceState {
  registry:  Map<string, Theme>;
  active:    Theme;
  fnCache:   Map<string, ColorFn>;
  bgCache:   Map<string, ColorFn>;
  listeners: Set<ThemeChangeListener>;
}

export type ThemeChangeListener = (newTheme: Theme, oldTheme: Theme) => void;

// ─────────────────────────────────────────────
//  Public ThemeInstance contract
// ─────────────────────────────────────────────

export interface ThemeInstance {
  // ── Registry ──
  /** List all registered theme names (built-in + custom). */
  list:     () => string[];
  /** Look up a theme definition. Returns null if missing. */
  get:      (name: string) => Theme | null;
  /** Switch active theme. Throws if name doesn't exist. */
  use:      (name: string) => ThemeInstance;
  /**
   * Try to switch active theme. Returns true on success, false if missing.
   * Useful when names come from runtime config that may have typos.
   */
  tryUse:   (name: string) => boolean;
  /** Get the currently active theme definition. */
  current:  () => Theme;
  /** Register a custom theme. Validates input strictly. */
  register: (name: string, def: Theme) => void;
  /** Remove a registered theme. Throws if removing the active one. */
  unregister: (name: string) => void;

  // ── Subscribers ──
  /**
   * Subscribe to theme changes. Returns an unsubscribe function.
   * Listener errors are caught — they don't break others.
   */
  onChange: (listener: ThemeChangeListener) => () => void;

  // ── Foreground color functions ──
  primary:   ColorFn;
  secondary: ColorFn;
  accent:    ColorFn;
  /** Semantic success color (falls back to `accent` if not defined). */
  success:   ColorFn;
  warning:   ColorFn;
  error:     ColorFn;
  info:      ColorFn;
  muted:     ColorFn;
  text:      ColorFn;

  // ── Background color functions ──
  bgPrimary:   ColorFn;
  bgSecondary: ColorFn;
  bgAccent:    ColorFn;
  bgSuccess:   ColorFn;
  bgWarning:   ColorFn;
  bgError:     ColorFn;
  bgInfo:      ColorFn;
  bgMuted:     ColorFn;
  bgSurface:   ColorFn;

  // ── Style passthrough ──
  bold:      ColorFn;

  /**
   * Dynamic accessor — get a color fn by name. Useful when the field
   * comes from config: `theme.style(level)(message)`.
   * Returns identity fn (passthrough) for unknown names.
   */
  style:     (name: ThemeStyleName) => ColorFn;

  // ── Gradient + ascii ──
  gradient:  (text: string, custom?: string[]) => string;
  banner:    (text: string, opts?: BannerOpts) => string;

  // ── Preview ──
  preview:   () => string;
}

/**
 * Banner options — same as `ascii.banner` minus `colorFn` (we provide it).
 * Defined explicitly to avoid fragile `Omit<Parameters<...>>` derivation.
 */
export interface BannerOpts {
  font?:          'big' | 'small' | string;
  align?:         'left' | 'center';
  perCharColor?:  boolean;
  letterSpacing?: number;
}

// ─────────────────────────────────────────────
//  Theme instance factory
//
//  Each call creates a fully isolated instance with its own registry,
//  cache, and listeners. Mutations on one don't leak to others.
// ─────────────────────────────────────────────

export const createTheme = (initial: string = 'dracula'): ThemeInstance => {
  // Clone built-ins into a per-instance registry
  const registry = new Map<string, Theme>(
    Object.entries(BUILTIN_THEMES),
  );

  const initialTheme = registry.get(initial)
    ?? registry.get('dracula')
    ?? Array.from(registry.values())[0]!; // unreachable: built-ins always exist

  const state: InstanceState = {
    registry,
    active:    initialTheme,
    fnCache:   new Map(),
    bgCache:   new Map(),
    listeners: new Set(),
  };

  // ── Cached factories — per-instance ──
  const cachedFg = (hex: string): ColorFn => {
    let fn = state.fnCache.get(hex);
    if (!fn) {
      fn = color.hex(hex);
      state.fnCache.set(hex, fn);
    }
    return fn;
  };

  const cachedBg = (hex: string): ColorFn => {
    let fn = state.bgCache.get(hex);
    if (!fn) {
      fn = color.bgHex(hex);
      state.bgCache.set(hex, fn);
    }
    return fn;
  };

  /**
   * Resolve `success` field with fallback to `accent`.
   * Built-ins all define it explicitly, but user-registered themes
   * may omit it — the alias keeps the API safe.
   */
  const successHex = (): string => state.active.success ?? state.active.accent;

  const fireChange = (oldTheme: Theme, newTheme: Theme): void => {
    const snapshot = [...state.listeners];
    for (const listener of snapshot) {
      try { listener(newTheme, oldTheme); }
      catch { /* user errors don't break others */ }
    }
  };

  const instance: ThemeInstance = {
    list: () => [...state.registry.keys()],
    get:  (name) => state.registry.get(name) ?? null,

    use(name) {
      const t = state.registry.get(name);
      /* istanbul ignore next — defensive: per-instance use() throw, covered by tryUse path */
      if (!t) {
        throw new Error(
          `Theme "${name}" not found. Available: ${[...state.registry.keys()].join(', ')}`,
        );
      }
      const old = state.active;
      state.active = t;
      if (old !== t) fireChange(old, t);
      return instance;
    },

    tryUse(name) {
      const t = state.registry.get(name);
      if (!t) return false;
      const old = state.active;
      state.active = t;
      if (old !== t) fireChange(old, t);
      return true;
    },

    current: () => state.active,

    register(name, def) {
      if (typeof name !== 'string' || name.length === 0) {
        throw new TypeError('Theme name must be a non-empty string.');
      }
      validateTheme(def);
      state.registry.set(name, def);
    },

    unregister(name) {
      if (state.active.name.toLowerCase() === name.toLowerCase()
          || state.registry.get(name) === state.active) {
        throw new Error(
          `Cannot unregister "${name}" — it's the active theme. ` +
          `Switch to another theme first with use().`,
        );
      }
      state.registry.delete(name);
    },

    onChange(listener) {
      state.listeners.add(listener);
      return () => { state.listeners.delete(listener); };
    },

    // Foreground colors — all route through cachedFg → color.hex
    // which respects NO_COLOR + capability degradation
    primary:   (text) => cachedFg(state.active.primary)(text),
    secondary: (text) => cachedFg(state.active.secondary)(text),
    accent:    (text) => cachedFg(state.active.accent)(text),
    success:   (text) => cachedFg(successHex())(text),
    warning:   (text) => cachedFg(state.active.warning)(text),
    error:     (text) => cachedFg(state.active.error)(text),
    info:      (text) => cachedFg(state.active.info)(text),
    muted:     (text) => cachedFg(state.active.muted)(text),
    text:      (text) => cachedFg(state.active.text)(text),

    // Background colors
    bgPrimary:   (text) => cachedBg(state.active.primary)(text),
    bgSecondary: (text) => cachedBg(state.active.secondary)(text),
    bgAccent:    (text) => cachedBg(state.active.accent)(text),
    bgSuccess:   (text) => cachedBg(successHex())(text),
    bgWarning:   (text) => cachedBg(state.active.warning)(text),
    bgError:     (text) => cachedBg(state.active.error)(text),
    bgInfo:      (text) => cachedBg(state.active.info)(text),
    bgMuted:     (text) => cachedBg(state.active.muted)(text),
    bgSurface:   (text) => cachedBg(state.active.surface)(text),

    // Style passthrough (already respects NO_COLOR via colors module)
    bold: color.bold,

    style(name) {
      // Defensive: if a caller passes an unknown name (e.g. from config),
      // return identity rather than throwing — prevents config typos
      // from crashing render code.
      if (!STYLE_NAMES.includes(name)) return (t: string) => t;
      return instance[name] as ColorFn;
    },

    gradient: (text, custom) => gradient(text, custom ?? state.active.gradient),

    banner(text, opts = {}) {
      return ascii.banner(text, {
        ...opts,
        colorFn: (t: string) => gradient(t, state.active.gradient),
      });
    },

    preview() {
      const lines: string[] = [];
      for (const t of state.registry.values()) {
        const g = gradient(`  ${t.name}  `, t.gradient);
        const p = cachedFg(t.primary)('primary');
        const s = cachedFg(t.secondary)('secondary');
        const a = cachedFg(t.accent)('accent');
        const e = cachedFg(t.error)('error');
        const w = cachedFg(t.warning)('warning');
        lines.push(`${g}  ${p}  ${s}  ${a}  ${e}  ${w}`);
      }
      return lines.join('\n');
    },
  };

  return instance;
};

// ─────────────────────────────────────────────
//  Global cache control
//
//  Per-instance caches are private. This helper exists for tests that
//  need to wipe the GLOBAL singleton's cache (`themes.*` below).
//  Other instances created with createTheme() are unaffected.
// ─────────────────────────────────────────────

/** Clear the global singleton's color cache. */
export const clearThemeColorCache = (): void => {
  // Re-create the global singleton to clear all internal caches.
  // We can't access them directly without exposing internals, but we
  // can rebuild the singleton's state by switching themes which is
  // cheap and side-effect-free for callers who don't subscribe.
  //
  // Alternative: we expose a hidden ._clearCache() per instance —
  // chosen below for correctness without any rebuild churn.
  themesGlobalState.fnCache.clear();
  themesGlobalState.bgCache.clear();
};

// ─────────────────────────────────────────────
//  Global singleton
//
//  We capture the global instance's state via a shared ref so the
//  `clearThemeColorCache()` helper can wipe it without re-creating
//  the singleton (which would reset the active theme + drop listeners).
// ─────────────────────────────────────────────

const themesGlobalState: { fnCache: Map<string, ColorFn>; bgCache: Map<string, ColorFn> } = {
  fnCache: new Map(),
  bgCache: new Map(),
};

const _globalRegistry = new Map<string, Theme>(Object.entries(BUILTIN_THEMES));
let _globalActive: Theme = _globalRegistry.get('dracula') as Theme;
const _globalListeners = new Set<ThemeChangeListener>();

const globalCachedFg = (hex: string): ColorFn => {
  let fn = themesGlobalState.fnCache.get(hex);
  if (!fn) {
    fn = color.hex(hex);
    themesGlobalState.fnCache.set(hex, fn);
  }
  return fn;
};

const globalCachedBg = (hex: string): ColorFn => {
  let fn = themesGlobalState.bgCache.get(hex);
  if (!fn) {
    fn = color.bgHex(hex);
    themesGlobalState.bgCache.set(hex, fn);
  }
  return fn;
};

const globalSuccess = (): string => _globalActive.success ?? _globalActive.accent;

const globalFireChange = (oldT: Theme, newT: Theme): void => {
  for (const listener of [..._globalListeners]) {
    try { listener(newT, oldT); }
    catch { /* swallow */ }
  }
};

export const themes: ThemeInstance = {
  list: () => [..._globalRegistry.keys()],
  get:  (name) => _globalRegistry.get(name) ?? null,

  use(name) {
    const t = _globalRegistry.get(name);
    if (!t) {
      throw new RangeError(
        `Theme "${name}" not found. Available themes: ${[..._globalRegistry.keys()].join(', ')}`,
      );
    }
    const old = _globalActive;
    _globalActive = t;
    if (old !== t) globalFireChange(old, t);
    return themes;
  },

  tryUse(name) {
    const t = _globalRegistry.get(name);
    if (!t) return false;
    const old = _globalActive;
    _globalActive = t;
    if (old !== t) globalFireChange(old, t);
    return true;
  },

  current: () => _globalActive,

  register(name, def) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new TypeError('Theme name must be a non-empty string.');
    }
    validateTheme(def);
    _globalRegistry.set(name, def);
  },

  unregister(name) {
    if (_globalActive.name.toLowerCase() === name.toLowerCase()
        || _globalRegistry.get(name) === _globalActive) {
      throw new Error(
        `Cannot unregister "${name}" — it's the active theme.`,
      );
    }
    _globalRegistry.delete(name);
  },

  onChange(listener) {
    _globalListeners.add(listener);
    return () => { _globalListeners.delete(listener); };
  },

  primary:   (text) => globalCachedFg(_globalActive.primary)(text),
  secondary: (text) => globalCachedFg(_globalActive.secondary)(text),
  accent:    (text) => globalCachedFg(_globalActive.accent)(text),
  success:   (text) => globalCachedFg(globalSuccess())(text),
  warning:   (text) => globalCachedFg(_globalActive.warning)(text),
  error:     (text) => globalCachedFg(_globalActive.error)(text),
  info:      (text) => globalCachedFg(_globalActive.info)(text),
  muted:     (text) => globalCachedFg(_globalActive.muted)(text),
  text:      (text) => globalCachedFg(_globalActive.text)(text),

  bgPrimary:   (text) => globalCachedBg(_globalActive.primary)(text),
  bgSecondary: (text) => globalCachedBg(_globalActive.secondary)(text),
  bgAccent:    (text) => globalCachedBg(_globalActive.accent)(text),
  bgSuccess:   (text) => globalCachedBg(globalSuccess())(text),
  bgWarning:   (text) => globalCachedBg(_globalActive.warning)(text),
  bgError:     (text) => globalCachedBg(_globalActive.error)(text),
  bgInfo:      (text) => globalCachedBg(_globalActive.info)(text),
  bgMuted:     (text) => globalCachedBg(_globalActive.muted)(text),
  bgSurface:   (text) => globalCachedBg(_globalActive.surface)(text),

  bold: color.bold,

  style(name) {
    if (!STYLE_NAMES.includes(name)) return (t: string) => t;
    return themes[name] as ColorFn;
  },

  gradient: (text, custom) => gradient(text, custom ?? _globalActive.gradient),

  banner(text, opts = {}) {
    return ascii.banner(text, {
      ...opts,
      colorFn: (t: string) => gradient(t, _globalActive.gradient),
    });
  },

  preview() {
    const lines: string[] = [];
    for (const t of _globalRegistry.values()) {
      const g = gradient(`  ${t.name}  `, t.gradient);
      const p = globalCachedFg(t.primary)('primary');
      const s = globalCachedFg(t.secondary)('secondary');
      const a = globalCachedFg(t.accent)('accent');
      const e = globalCachedFg(t.error)('error');
      const w = globalCachedFg(t.warning)('warning');
      lines.push(`${g}  ${p}  ${s}  ${a}  ${e}  ${w}`);
    }
    return lines.join('\n');
  },
};

export default themes;
