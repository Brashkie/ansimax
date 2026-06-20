// ─────────────────────────────────────────────
//  CONFIGURE  –  global runtime configuration
//
//  Central source of truth for cross-module behavior. Settings here
//  flow into colors, themes, animations, loaders, and ASCII rendering.
//
//  Robustness guarantees:
//   - Strict validation (rejects invalid inputs with descriptive errors)
//   - Subscriber model with key-scoped subscribers (avoid over-firing)
//   - Batch updates via pause/resume listener helpers
//   - No-op partial updates skip listener notification
//   - Temporary overrides via withConfig()
//   - tryUse on theme switch (soft fallback for unknown themes)
//   - Listener errors don't propagate, can't break the config itself
// ─────────────────────────────────────────────

import { setNoColor, resetNoColor } from './colors/index.js';
import { themes as themesGlobal } from './themes/index.js';

// ─────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────

/** Color rendering capability. 'none' suppresses all color output. */
export type ColorMode = 'none' | 'basic' | '256' | 'truecolor' | 'auto';

/** Animation pacing multiplier preset. */
export type AnimationSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface AnsimaxConfig {
  /** Color rendering mode. 'auto' (default) defers to terminal detection. */
  colorMode?: ColorMode;
  /** Animation speed preset. */
  animationSpeed?: AnimationSpeed;
  /** Default ASCII font name. Accepts built-in ('big', 'small') or custom names. */
  asciiFont?: string;
  /** UI locale. Currently informational; reserved for future i18n. */
  locale?: string;
  /** Active theme name. Setting this calls themes.tryUse(name). */
  theme?: string;
  /** Disable all motion (overrides animationSpeed). Useful for accessibility. */
  reducedMotion?: boolean;
}

export type ConfigChangeListener = (config: Required<AnsimaxConfig>) => void;
export type ConfigKey = keyof AnsimaxConfig;
export type ConfigKeyListener<K extends ConfigKey> = (
  newValue: Required<AnsimaxConfig>[K],
  oldValue: Required<AnsimaxConfig>[K],
) => void;

// ─────────────────────────────────────────────
//  Defaults — frozen template, exported for consumers
// ─────────────────────────────────────────────

export const DEFAULTS: Readonly<Required<AnsimaxConfig>> = Object.freeze({
  colorMode:      'auto',
  animationSpeed: 'normal',
  asciiFont:      'big',
  locale:         'en',
  theme:          'dracula',
  reducedMotion:  false,
});

// ─────────────────────────────────────────────
//  Validation
// ─────────────────────────────────────────────

const VALID_COLOR_MODES: ReadonlySet<ColorMode> =
  new Set(['none', 'basic', '256', 'truecolor', 'auto']);

const VALID_ANIMATION_SPEEDS: ReadonlySet<AnimationSpeed> =
  new Set(['slow', 'normal', 'fast', 'instant']);

const KNOWN_KEYS: ReadonlySet<string> = new Set([
  'colorMode', 'animationSpeed', 'asciiFont', 'locale', 'theme', 'reducedMotion',
]);

/** Throws a descriptive error pointing to the bad field. */
/* istanbul ignore next — `strict = false` default never fires;
   all callers pass explicit boolean (meta.strict ?? false) */
const validate = (opts: AnsimaxConfig, strict = false): void => {
  if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) {
    throw new TypeError('configure: argument must be a non-null object');
  }

  // Strict mode rejects unknown keys
  if (strict) {
    for (const key of Object.keys(opts)) {
      if (!KNOWN_KEYS.has(key)) {
        throw new RangeError(
          `configure: unknown key "${key}". ` +
          `Valid keys: ${[...KNOWN_KEYS].join(', ')}`,
        );
      }
    }
  }

  if (opts.colorMode !== undefined && !VALID_COLOR_MODES.has(opts.colorMode)) {
    throw new RangeError(
      `configure: invalid colorMode "${opts.colorMode}". ` +
      `Expected one of: ${[...VALID_COLOR_MODES].join(', ')}`,
    );
  }

  if (opts.animationSpeed !== undefined && !VALID_ANIMATION_SPEEDS.has(opts.animationSpeed)) {
    throw new RangeError(
      `configure: invalid animationSpeed "${opts.animationSpeed}". ` +
      `Expected one of: ${[...VALID_ANIMATION_SPEEDS].join(', ')}`,
    );
  }

  if (opts.asciiFont !== undefined &&
      (typeof opts.asciiFont !== 'string' || opts.asciiFont.length === 0)) {
    throw new TypeError(
      `configure: asciiFont must be a non-empty string, got ${typeof opts.asciiFont}`,
    );
  }

  if (opts.locale !== undefined &&
      (typeof opts.locale !== 'string' || opts.locale.length === 0)) {
    throw new TypeError(
      `configure: locale must be a non-empty string, got ${typeof opts.locale}`,
    );
  }

  if (opts.theme !== undefined &&
      (typeof opts.theme !== 'string' || opts.theme.length === 0)) {
    throw new TypeError(
      `configure: theme must be a non-empty string, got ${typeof opts.theme}`,
    );
  }

  if (opts.reducedMotion !== undefined && typeof opts.reducedMotion !== 'boolean') {
    throw new TypeError(
      `configure: reducedMotion must be a boolean, got ${typeof opts.reducedMotion}`,
    );
  }
};

// ─────────────────────────────────────────────
//  State + speed map
// ─────────────────────────────────────────────

let _config: Required<AnsimaxConfig> = { ...DEFAULTS };

const SPEED_MAP: Record<AnimationSpeed, number> = {
  slow:    2.0,
  normal:  1.0,
  fast:    0.4,
  instant: 0.0,
};

// ─────────────────────────────────────────────
//  Subscribers — full and key-scoped
// ─────────────────────────────────────────────

const _listeners = new Set<ConfigChangeListener>();
type AnyKeyListener = (newVal: unknown, oldVal: unknown) => void;
const _keyListeners = new Map<ConfigKey, Set<AnyKeyListener>>();

// Pause/resume — batch updates without flooding subscribers
let _paused = 0;
let _pendingChange = false;

/**
 * Subscribe to ANY configuration change.
 *
 * @param listener Called with the new config whenever it changes
 * @returns Unsubscribe function
 *
 * @example
 *   const off = onConfigChange((c) => console.log('Theme:', c.theme));
 *   // Later: off();
 */
export const onConfigChange = (listener: ConfigChangeListener): (() => void) => {
  if (typeof listener !== 'function') {
    throw new TypeError('onConfigChange: listener must be a function');
  }
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
};

/**
 * Subscribe to changes of a SPECIFIC key. Listener fires only when that
 * key's value actually changes (not on every config update).
 *
 * @example
 *   const off = onConfigKeyChange('theme', (newT, oldT) => updateUI(newT));
 */
export const onConfigKeyChange = <K extends ConfigKey>(
  key: K,
  listener: ConfigKeyListener<K>,
): (() => void) => {
  if (!KNOWN_KEYS.has(key)) {
    throw new RangeError(`onConfigKeyChange: unknown key "${key}"`);
  }
  if (typeof listener !== 'function') {
    throw new TypeError('onConfigKeyChange: listener must be a function');
  }
  let set = _keyListeners.get(key);
  if (!set) {
    set = new Set();
    _keyListeners.set(key, set);
  }
  set.add(listener as AnyKeyListener);
  return () => { set!.delete(listener as AnyKeyListener); };
};

/**
 * Pause listener notifications until resume() is called. Useful for
 * batch updates where you don't want intermediate states to fire
 * subscribers.
 *
 * @example
 *   pauseListeners();
 *   configure({ theme: 'matrix' });
 *   configure({ colorMode: 'none' });
 *   resumeListeners(); // fires once with final config
 */
export const pauseListeners = (): void => { _paused++; };

export const resumeListeners = (): void => {
  if (_paused > 0) _paused--;
  if (_paused === 0 && _pendingChange) {
    _pendingChange = false;
    notifyListeners(_config, _config); // synthetic — full state, no per-key diff
  }
};

const notifyKeyListeners = (
  prev: Required<AnsimaxConfig>,
  next: Required<AnsimaxConfig>,
): void => {
  for (const key of KNOWN_KEYS as Set<ConfigKey>) {
    if (prev[key] !== next[key]) {
      const listeners = _keyListeners.get(key);
      if (!listeners) continue;
      for (const listener of [...listeners]) {
        try { listener(next[key], prev[key]); }
        catch { /* swallow user errors */ }
      }
    }
  }
};

const notifyListeners = (
  prev: Required<AnsimaxConfig>,
  next: Required<AnsimaxConfig>,
): void => {
  if (_paused > 0) {
    _pendingChange = true;
    return;
  }
  // Snapshot before iterating — handles listener removing itself
  const snapshot = [..._listeners];
  for (const listener of snapshot) {
    try { listener({ ...next }); }
    catch { /* swallow user errors */ }
  }
  notifyKeyListeners(prev, next);
};

// ─────────────────────────────────────────────
//  Apply side effects to other modules
//
//  Configuration values that have meaning beyond "stored in this object"
//  are propagated here. Doing it in one place keeps modules decoupled.
// ─────────────────────────────────────────────

const applySideEffects = (
  prev: Required<AnsimaxConfig>,
  next: Required<AnsimaxConfig>,
): void => {
  // colorMode → colors module suppression
  if (prev.colorMode !== next.colorMode) {
    if (next.colorMode === 'none')      setNoColor(true);
    else if (next.colorMode === 'auto') resetNoColor();
    else                                setNoColor(false); // explicit basic/256/truecolor: enable
  }

  // theme → themes module active theme
  if (prev.theme !== next.theme) {
    // tryUse returns false silently — themes loaded after configure() can
    // still be referenced. Validation upstream rejects non-strings.
    try { themesGlobal.tryUse(next.theme); }
    catch { /* defensive — tryUse shouldn't throw but be safe */ }
  }
};

// ─────────────────────────────────────────────
//  Diff detection — skip no-op updates
// ─────────────────────────────────────────────

const hasChange = (
  prev: Required<AnsimaxConfig>,
  next: Required<AnsimaxConfig>,
): boolean => {
  for (const key of KNOWN_KEYS as Set<ConfigKey>) {
    if (prev[key] !== next[key]) return true;
  }
  return false;
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

export interface ConfigureOptions {
  /**
   * Strict mode rejects unknown keys with RangeError instead of
   * silently ignoring them. Useful for catching typos in config files.
   * Default: false.
   */
  strict?: boolean;
}

/**
 * Update one or more configuration values. Validates inputs strictly —
 * invalid colorMode or animationSpeed throws a RangeError, wrong types
 * throw a TypeError. Partial updates merge with current state.
 *
 * Triggers subscribed listeners ONLY if values actually changed.
 *
 * @example
 *   configure({ colorMode: 'none', theme: 'matrix' });
 *   configure({ theme: 'nord' }, { strict: true });
 */
export const configure = (
  opts: AnsimaxConfig = {},
  meta: ConfigureOptions = {},
): void => {
  validate(opts, meta.strict ?? false);

  const prev = { ..._config };
  const next = { ..._config, ...opts };

  // Skip side effects and listener notification when nothing changed
  if (!hasChange(prev, next)) return;

  _config = next;
  applySideEffects(prev, next);
  notifyListeners(prev, next);
};

/** Get a snapshot of the current configuration. */
export const getConfig = (): Required<AnsimaxConfig> => ({ ..._config });

/** Numeric multiplier for animation timings. Returns 0 in reducedMotion. */
export const getSpeedMultiplier = (): number => {
  if (_config.reducedMotion) return 0;
  /* istanbul ignore next — `?? 1.0` is a defensive fallback;
     validation guarantees animationSpeed is always in SPEED_MAP */
  return SPEED_MAP[_config.animationSpeed] ?? 1.0;
};

/**
 * Reset configuration to defaults. Triggers listeners if state differs
 * from defaults. Side effects are applied (NO_COLOR cleared, theme
 * reverts to 'dracula', etc.).
 */
export const resetConfig = (): void => {
  const prev = { ..._config };
  const next = { ...DEFAULTS };
  if (!hasChange(prev, next)) return;
  _config = next;
  applySideEffects(prev, next);
  notifyListeners(prev, next);
};

/** Read a single config field by name (typed). */
export const getConfigValue = <K extends keyof AnsimaxConfig>(
  key: K,
): Required<AnsimaxConfig>[K] => _config[key];

/**
 * Temporarily override config for the duration of `fn`, then restore
 * the previous state. Listeners fire for both the override and the
 * restore.
 *
 * @example
 *   await withConfig({ reducedMotion: true }, async () => {
 *     await runAccessibilityChecks();
 *   });
 */
export const withConfig = <T>(
  overrides: AnsimaxConfig,
  fn: () => T | Promise<T>,
): T | Promise<T> => {
  const snapshot = { ..._config };
  configure(overrides);

  const restore = (): void => {
    const prev = { ..._config };
    _config = snapshot;
    if (hasChange(prev, snapshot)) {
      applySideEffects(prev, snapshot);
      notifyListeners(prev, snapshot);
    }
  };

  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(
        (v) => { restore(); return v; },
        (err) => { restore(); throw err; },
      );
    }
    restore();
    return result;
  } catch (err) {
    restore();
    throw err;
  }
};

// ─────────────────────────────────────────────
//  v1.3.4 — DX shortcuts
// ─────────────────────────────────────────────

/**
 * Set a single config key without wrapping in an object. Convenience
 * shortcut equivalent to `configure({ [key]: value })`.
 *
 * @example
 * ```ts
 * import { setConfigValue } from 'ansimax';
 *
 * setConfigValue('theme', 'dracula');
 * setConfigValue('animationSpeed', 'fast');
 * ```
 */
export const setConfigValue = <K extends keyof AnsimaxConfig>(
  key: K,
  value: AnsimaxConfig[K],
): void => {
  configure({ [key]: value } as AnsimaxConfig);
};

/**
 * Alias for `onConfigChange` — matches the naming convention used by
 * `themes.onChange` and other observers in the codebase. Returns an
 * unsubscribe function.
 *
 * @example
 * ```ts
 * import { subscribeConfig } from 'ansimax';
 *
 * const unsubscribe = subscribeConfig((newCfg, oldCfg) => {
 *   console.log('Config changed:', newCfg);
 * });
 *
 * // Later: unsubscribe();
 * ```
 */
export const subscribeConfig = onConfigChange;

export default configure;
