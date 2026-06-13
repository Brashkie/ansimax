/**
 * ansimax — json module
 * ─────────────────────────────────────────────
 *
 * Colored JSON / YAML pretty-printer for terminal display.
 *
 * Features:
 *   • Configurable indent
 *   • Color-coded by value type (string, number, boolean, null, key)
 *   • Max depth with collapse marker (`{...}` / `[...]`)
 *   • Circular reference detection (avoids infinite recursion)
 *   • ANSI cleanly disabled in NO_COLOR / non-TTY environments
 *
 * Philosophy: data → human-readable text. Not a parser, not a validator —
 * just pretty rendering of in-memory JS values.
 */

import { sgr, FG, reset } from '../utils/ansi.js';
import { isNoColor } from '../colors/index.js';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface PrettyOptions {
  /** Indent width in spaces. Default `2`. */
  indent?: number;
  /**
   * Apply ANSI colors to keys/values. Default `true`. Auto-disabled when
   * `NO_COLOR` is set or output is non-TTY.
   */
  colors?: boolean;
  /**
   * Maximum nesting depth. Objects/arrays beyond this level are collapsed
   * to `{...}` / `[...]`. Default `Infinity` (no limit).
   */
  maxDepth?: number;
  /**
   * Maximum array length to display fully. Arrays longer than this show
   * the first N items + a `... (M more)` marker. Default `Infinity`.
   */
  maxItems?: number;
  /**
   * Maximum string length before truncation with ellipsis. Default `Infinity`.
   */
  maxStringLength?: number;
  /**
   * Sort object keys alphabetically. Useful for deterministic diffs (e.g.,
   * comparing two JSON snapshots) and for visual scanning of large objects.
   * Default `false` (insertion order preserved).
   *
   * @since 1.3.1
   */
  sortKeys?: boolean;
  /**
   * Arrays of primitives shorter than this character width (in their
   * rendered form) are displayed on a single line: `[1, 2, 3]` instead of
   * three lines. Nested objects/arrays never inline regardless of size.
   * Set to `0` to disable inlining. Default `60`.
   *
   * @since 1.3.1
   */
  inlineArrayMaxLength?: number;
}

// ─────────────────────────────────────────────
//  Color theme — type → SGR code
// ─────────────────────────────────────────────

const COLORS = {
  key:     FG.cyan,
  string:  FG.green,
  number:  FG.yellow,
  boolean: FG.magenta,
  null:    FG.brightBlack,
  bracket: FG.white,
  comment: FG.brightBlack,
} as const;

// ─────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────

/** Wrap with ANSI color if `useColor`, otherwise return raw. */
const _c = (text: string, code: number, useColor: boolean): string =>
  useColor ? sgr(code) + text + reset() : text;

/** Truncate a string with ellipsis if it exceeds maxLength. */
const _truncString = (s: string, maxLength: number): string => {
  if (!Number.isFinite(maxLength) || s.length <= maxLength) return s;
  // Reserve 3 chars for "..."
  if (maxLength <= 3) return s.slice(0, maxLength);
  return s.slice(0, maxLength - 3) + '...';
};

/** Format a primitive (string, number, boolean, null) with color. */
const _formatPrimitive = (value: unknown, opts: { useColor: boolean; maxStringLength: number }): string => {
  const { useColor, maxStringLength } = opts;

  if (value === null) {
    return _c('null', COLORS.null, useColor);
  }
  if (value === undefined) {
    return _c('undefined', COLORS.null, useColor);
  }
  if (typeof value === 'string') {
    const truncated = _truncString(value, maxStringLength);
    const quoted = JSON.stringify(truncated);
    return _c(quoted, COLORS.string, useColor);
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return _c('NaN', COLORS.number, useColor);
    if (!Number.isFinite(value)) {
      return _c(value > 0 ? 'Infinity' : '-Infinity', COLORS.number, useColor);
    }
    return _c(String(value), COLORS.number, useColor);
  }
  if (typeof value === 'boolean') {
    return _c(String(value), COLORS.boolean, useColor);
  }
  if (typeof value === 'bigint') {
    return _c(`${value}n`, COLORS.number, useColor);
  }
  // Functions, symbols, etc. — render as descriptive placeholder
  if (typeof value === 'function') {
    const name = (value as { name?: string }).name || 'anonymous';
    return _c(`[Function: ${name}]`, COLORS.comment, useColor);
  }
  if (typeof value === 'symbol') {
    return _c(value.toString(), COLORS.comment, useColor);
  }
  /* istanbul ignore next — defensive: all primitive typeof values are handled above */
  return _c(String(value), COLORS.comment, useColor);
};

/**
 * Recursive pretty-printer. Tracks `seen` for circular ref detection.
 */
const _renderValue = (
  value: unknown,
  depth: number,
  config: {
    indent: number;
    maxDepth: number;
    maxItems: number;
    maxStringLength: number;
    useColor: boolean;
    seen: WeakSet<object>;
    // v1.3.1
    sortKeys: boolean;
    inlineArrayMaxLength: number;
  },
): string => {
  const {
    indent, maxDepth, maxItems, maxStringLength, useColor, seen,
    sortKeys, inlineArrayMaxLength,
  } = config;

  // Primitives (including null, undefined)
  if (value === null || typeof value !== 'object') {
    return _formatPrimitive(value, { useColor, maxStringLength });
  }

  // Circular reference guard
  if (seen.has(value as object)) {
    return _c('[Circular]', COLORS.comment, useColor);
  }
  seen.add(value as object);

  // Depth limit
  if (depth >= maxDepth) {
    if (Array.isArray(value)) {
      return _c('[', COLORS.bracket, useColor)
           + _c('...', COLORS.comment, useColor)
           + _c(']', COLORS.bracket, useColor);
    }
    return _c('{', COLORS.bracket, useColor)
         + _c('...', COLORS.comment, useColor)
         + _c('}', COLORS.bracket, useColor);
  }

  const pad = ' '.repeat(indent * (depth + 1));
  const closePad = ' '.repeat(indent * depth);

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return _c('[]', COLORS.bracket, useColor);
    }

    // v1.3.1: try inline rendering for arrays of primitives if short enough
    if (inlineArrayMaxLength > 0) {
      const allPrimitive = value.every((v) => v === null || typeof v !== 'object');
      if (allPrimitive) {
        const displayCount = Math.min(value.length, maxItems);
        const inlineItems: string[] = [];
        for (let i = 0; i < displayCount; i++) {
          inlineItems.push(_formatPrimitive(value[i], { useColor, maxStringLength }));
        }
        if (value.length > maxItems) {
          const remaining = value.length - maxItems;
          inlineItems.push(_c(`... (${remaining} more)`, COLORS.comment, useColor));
        }
        const candidate = _c('[', COLORS.bracket, useColor)
                        + inlineItems.join(', ')
                        + _c(']', COLORS.bracket, useColor);
        // Strip ANSI to measure visible length
        const visibleLen = candidate.replace(/\x1b\[[0-9;]*m/g, '').length;
        if (visibleLen <= inlineArrayMaxLength) {
          return candidate;
        }
      }
    }

    // Multi-line rendering
    const items: string[] = [];
    const displayCount = Math.min(value.length, maxItems);
    for (let i = 0; i < displayCount; i++) {
      const rendered = _renderValue(value[i], depth + 1, config);
      items.push(pad + rendered);
    }
    if (value.length > maxItems) {
      const remaining = value.length - maxItems;
      items.push(pad + _c(`... (${remaining} more)`, COLORS.comment, useColor));
    }

    return _c('[', COLORS.bracket, useColor)
         + '\n'
         + items.join(',\n')
         + '\n'
         + closePad
         + _c(']', COLORS.bracket, useColor);
  }

  // Plain objects (and class instances — render their own enumerable keys)
  let keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) {
    return _c('{}', COLORS.bracket, useColor);
  }

  // v1.3.1: sort keys alphabetically when requested
  if (sortKeys) {
    keys = [...keys].sort((a, b) => a.localeCompare(b));
  }

  const entries: string[] = [];
  for (const key of keys) {
    const keyStr = JSON.stringify(key);
    const renderedKey = _c(keyStr, COLORS.key, useColor);
    const renderedVal = _renderValue(
      (value as Record<string, unknown>)[key],
      depth + 1,
      config,
    );
    entries.push(`${pad}${renderedKey}: ${renderedVal}`);
  }

  return _c('{', COLORS.bracket, useColor)
       + '\n'
       + entries.join(',\n')
       + '\n'
       + closePad
       + _c('}', COLORS.bracket, useColor);
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

/**
 * Pretty-print a JavaScript value with colored output suitable for
 * terminal display. Handles primitives, objects, arrays, and circular
 * references gracefully.
 *
 * @param value - Any JavaScript value to render.
 * @param opts  - Optional formatting configuration.
 *
 * @example basic
 * ```js
 * import { json } from 'ansimax';
 *
 * console.log(json.pretty({
 *   name: 'ansimax',
 *   version: '1.3.0',
 *   features: ['colors', 'gradients', 'panels'],
 *   stats: { tests: 2000, coverage: 0.98 },
 * }));
 * ```
 *
 * @example with depth limit (collapses deeply nested objects)
 * ```js
 * console.log(json.pretty(deeplyNestedObject, { maxDepth: 2 }));
 * // Anything beyond depth 2 renders as {...} or [...]
 * ```
 *
 * @example with item limit (for huge arrays)
 * ```js
 * console.log(json.pretty(largeArray, { maxItems: 10 }));
 * // Shows first 10 items + "... (N more)"
 * ```
 *
 * @example monochrome (e.g. for log files)
 * ```js
 * console.log(json.pretty(data, { colors: false }));
 * ```
 *
 * @example handles circular references
 * ```js
 * const obj = { name: 'foo' };
 * obj.self = obj;  // circular!
 * console.log(json.pretty(obj));
 * // → { "name": "foo", "self": [Circular] }
 * ```
 */
export const pretty = (value: unknown, opts: PrettyOptions = {}): string => {
  const {
    indent = 2,
    colors = true,
    maxDepth = Infinity,
    maxItems = Infinity,
    maxStringLength = Infinity,
    // v1.3.1
    sortKeys = false,
    inlineArrayMaxLength = 60,
  } = opts;

  // Defensive: clamp indent
  const safeIndent = Math.max(0, Math.floor(Number(indent) || 0));
  // Defensive: clamp maxDepth
  const safeMaxDepth = Number.isFinite(maxDepth) ? Math.max(0, Math.floor(maxDepth)) : Infinity;
  // Defensive: clamp maxItems
  const safeMaxItems = Number.isFinite(maxItems) ? Math.max(0, Math.floor(maxItems)) : Infinity;
  // Defensive: clamp maxStringLength
  const safeMaxStrLen = Number.isFinite(maxStringLength)
    ? Math.max(0, Math.floor(maxStringLength))
    : Infinity;
  // Defensive: clamp inlineArrayMaxLength (0 disables inlining)
  const safeInlineMax = Number.isFinite(inlineArrayMaxLength)
    ? Math.max(0, Math.floor(inlineArrayMaxLength))
    : 60;

  const useColor = colors && !isNoColor();

  return _renderValue(value, 0, {
    indent: safeIndent,
    maxDepth: safeMaxDepth,
    maxItems: safeMaxItems,
    maxStringLength: safeMaxStrLen,
    useColor,
    seen: new WeakSet<object>(),
    sortKeys: Boolean(sortKeys),
    inlineArrayMaxLength: safeInlineMax,
  });
};

// ─────────────────────────────────────────────
//  Namespace
// ─────────────────────────────────────────────

export const json = {
  pretty,
};

export default json;
