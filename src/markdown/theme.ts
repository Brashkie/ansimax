// ─────────────────────────────────────────────
//  ansimax/markdown — Color palettes + theme registry
//
//  v1.4.1  — Split out from index.ts.
//  v1.4.11 — Added a runtime theme registry so consumers can register
//  their own palettes by name and pass that name as `theme`.
//
//  Resolution order for a theme name:
//    1. user-registered palette (registry)
//    2. built-in palette ('dark' | 'light')
//    3. 'dark' as the final fallback (never throws at render time)
// ─────────────────────────────────────────────

import { isHexColor } from '../utils/helpers.js';
import type { MarkdownTheme, MarkdownPalette } from './types.js';

/** @deprecated since 1.4.11 — use `MarkdownPalette` from './types.js'. */
export type ThemePalette = MarkdownPalette;

// ─────────────────────────────────────────────
//  Built-in palettes
// ─────────────────────────────────────────────

const BUILT_INS: Record<'dark' | 'light', MarkdownPalette> = {
  dark: {
    h1: ['#ff79c6', '#bd93f9', '#8be9fd'],
    h2: '#bd93f9',
    h3: '#8be9fd',
    h4: '#50fa7b',
    h5: '#f1fa8c',
    h6: '#ffb86c',
    code: '#ff79c6',
    codeBlockBorder: '#6272a4',
    link: '#8be9fd',
    blockquote: '#6272a4',
    hr: '#6272a4',
    tableHeader: '#bd93f9',
  },
  light: {
    h1: ['#d63384', '#6f42c1', '#0d6efd'],
    h2: '#6f42c1',
    h3: '#0d6efd',
    h4: '#198754',
    h5: '#664d03',
    h6: '#fd7e14',
    code: '#d63384',
    codeBlockBorder: '#adb5bd',
    link: '#0d6efd',
    blockquote: '#6c757d',
    hr: '#adb5bd',
    tableHeader: '#6f42c1',
  },
};

const BUILT_IN_NAMES: ReadonlyArray<string> = ['dark', 'light'];

// ─────────────────────────────────────────────
//  Registry
// ─────────────────────────────────────────────

const _registry = new Map<string, MarkdownPalette>();

/** Palette keys that must be a single hex color. */
const SOLID_KEYS: ReadonlyArray<keyof MarkdownPalette> = [
  'h2', 'h3', 'h4', 'h5', 'h6',
  'code', 'codeBlockBorder', 'link', 'blockquote', 'hr', 'tableHeader',
];

/**
 * Validate a palette. Throws `TypeError` with a message naming the
 * offending key — registering a broken theme should fail loudly at setup
 * time rather than produce silently wrong colors at render time.
 *
 * @since 1.4.11
 */
export const _validatePalette = (palette: unknown, name: string): MarkdownPalette => {
  if (!palette || typeof palette !== 'object' || Array.isArray(palette)) {
    throw new TypeError(
      `registerMarkdownTheme("${name}"): palette must be an object, got ${
        Array.isArray(palette) ? 'array' : typeof palette}`,
    );
  }
  const p = palette as Record<string, unknown>;

  // h1 is a gradient — needs 2+ valid hex stops
  const h1 = p['h1'];
  if (!Array.isArray(h1) || h1.length < 2) {
    throw new TypeError(
      `registerMarkdownTheme("${name}"): h1 must be an array of 2+ hex colors (a gradient)`,
    );
  }
  for (let i = 0; i < h1.length; i++) {
    const stop = h1[i];
    if (typeof stop !== 'string' || !isHexColor(stop)) {
      throw new TypeError(
        `registerMarkdownTheme("${name}"): h1[${i}] is not a hex color: ${JSON.stringify(stop)}`,
      );
    }
  }

  // Every other key is a single hex color
  for (const key of SOLID_KEYS) {
    const value = p[key];
    if (typeof value !== 'string' || !isHexColor(value)) {
      throw new TypeError(
        `registerMarkdownTheme("${name}"): ${key} is not a hex color: ${JSON.stringify(value)}`,
      );
    }
  }

  return palette as MarkdownPalette;
};

/**
 * Register a custom markdown palette under `name`. The name can then be
 * passed as `theme` to `markdown.render()`.
 *
 * Built-in names (`dark`, `light`) are protected — pass `{ force: true }`
 * to override them deliberately.
 *
 * @example
 * ```js
 * import { registerMarkdownTheme, markdown } from 'ansimax';
 *
 * registerMarkdownTheme('solarized', {
 *   h1: ['#b58900', '#cb4b16'],
 *   h2: '#cb4b16', h3: '#d33682', h4: '#6c71c4',
 *   h5: '#268bd2', h6: '#2aa198',
 *   code: '#b58900', codeBlockBorder: '#586e75',
 *   link: '#268bd2', blockquote: '#586e75',
 *   hr: '#586e75', tableHeader: '#cb4b16',
 * });
 *
 * console.log(markdown.render('# Hello', { theme: 'solarized' }));
 * ```
 *
 * @since 1.4.11
 */
export const registerMarkdownTheme = (
  name: string,
  palette: MarkdownPalette,
  opts: { force?: boolean } = {},
): void => {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TypeError('registerMarkdownTheme: name must be a non-empty string');
  }
  const key = name.trim().toLowerCase();

  if (BUILT_IN_NAMES.includes(key) && opts.force !== true) {
    throw new Error(
      `registerMarkdownTheme: "${key}" is a built-in theme. Pass { force: true } to override it.`,
    );
  }

  _registry.set(key, _validatePalette(palette, key));
};

/**
 * Remove a registered theme. Built-ins cannot be removed (they are the
 * fallback), so this only affects the runtime registry.
 *
 * @returns `true` when a registered theme was removed.
 * @since 1.4.11
 */
export const unregisterMarkdownTheme = (name: string): boolean => {
  if (typeof name !== 'string') return false;
  return _registry.delete(name.trim().toLowerCase());
};

/**
 * List every available theme name — built-ins first, then registered ones
 * in insertion order.
 *
 * @since 1.4.11
 */
export const listMarkdownThemes = (): string[] => {
  const custom = [...(_registry.keys())].filter((k) => !BUILT_IN_NAMES.includes(k));
  return [...BUILT_IN_NAMES, ...custom];
};

/**
 * Returns true when `name` resolves to a real palette (built-in or
 * registered). Useful for validating user input before rendering.
 *
 * @since 1.4.11
 */
export const hasMarkdownTheme = (name: string): boolean => {
  if (typeof name !== 'string') return false;
  const key = name.trim().toLowerCase();
  return _registry.has(key) || BUILT_IN_NAMES.includes(key);
};

/**
 * Resolve a theme name to its palette. Registered themes take precedence
 * over built-ins (so `force`-overridden built-ins work), and an unknown
 * name falls back to `dark` instead of throwing — rendering should never
 * fail because of a typo in a theme name.
 *
 * @since 1.4.11
 */
export const resolveTheme = (name: MarkdownTheme | undefined): MarkdownPalette => {
  if (typeof name === 'string') {
    const key = name.trim().toLowerCase();
    const custom = _registry.get(key);
    if (custom) return custom;
    if (key === 'light') return BUILT_INS.light;
  }
  return BUILT_INS.dark;
};

/**
 * Clear every registered theme. Built-ins are untouched.
 * Exposed mainly so tests can reset global state.
 *
 * @since 1.4.11
 */
export const clearMarkdownThemes = (): void => { _registry.clear(); };

/**
 * Built-in palettes, kept exported for backward compatibility with code
 * that indexed `THEMES.dark` / `THEMES.light` directly.
 *
 * @deprecated since 1.4.11 — prefer `resolveTheme(name)`, which also
 * honors registered themes.
 */
export const THEMES = BUILT_INS;
