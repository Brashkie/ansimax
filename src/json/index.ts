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
  /**
   * Output mode controls what kind of string is produced:
   *
   * - `'display'` (default) — terminal-friendly output with colors (when
   *   enabled) and informational placeholders like `[Circular]`,
   *   `[Function: name]`, `Symbol(x)`, `Map(2) {...}`, `Set(3) {...}`,
   *   `Date(2026-06-13T...)`, `BigInt(123n)`. Not parseable as JSON.
   *
   * - `'json'` — strict, parseable JSON output. Colors are forced off,
   *   circular references throw `TypeError`, and types not representable
   *   in JSON (functions, symbols, undefined) are omitted from objects /
   *   replaced with `null` in arrays. Map/Set are converted to objects/arrays.
   *   Dates become ISO strings. BigInt becomes a number (or string if too large).
   *
   * @since 1.3.3
   */
  mode?: 'display' | 'json';
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
const _formatPrimitive = (
  value: unknown,
  opts: { useColor: boolean; maxStringLength: number; mode: 'display' | 'json' },
): string => {
  const { useColor, maxStringLength, mode } = opts;

  if (value === null) {
    return _c('null', COLORS.null, useColor);
  }
  if (value === undefined) {
    // In strict JSON mode, undefined → null (since JSON has no `undefined`)
    if (mode === 'json') return _c('null', COLORS.null, useColor);
    return _c('undefined', COLORS.null, useColor);
  }
  if (typeof value === 'string') {
    const truncated = _truncString(value, maxStringLength);
    const quoted = JSON.stringify(truncated);
    return _c(quoted, COLORS.string, useColor);
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      // NaN isn't valid JSON
      if (mode === 'json') return _c('null', COLORS.null, useColor);
      return _c('NaN', COLORS.number, useColor);
    }
    if (!Number.isFinite(value)) {
      if (mode === 'json') return _c('null', COLORS.null, useColor);
      return _c(value > 0 ? 'Infinity' : '-Infinity', COLORS.number, useColor);
    }
    return _c(String(value), COLORS.number, useColor);
  }
  if (typeof value === 'boolean') {
    return _c(String(value), COLORS.boolean, useColor);
  }
  if (typeof value === 'bigint') {
    // BigInt isn't valid JSON — best-effort: number if fits, string otherwise
    if (mode === 'json') {
      const big = value as bigint;
      const asNum = Number(big);
      if (Number.isSafeInteger(asNum) && BigInt(asNum) === big) {
        return _c(String(asNum), COLORS.number, useColor);
      }
      return _c(JSON.stringify(String(big)), COLORS.string, useColor);
    }
    return _c(`${value}n`, COLORS.number, useColor);
  }
  // Functions, symbols, etc. — render as descriptive placeholder
  if (typeof value === 'function') {
    if (mode === 'json') return _c('null', COLORS.null, useColor);
    const name = (value as { name?: string }).name || 'anonymous';
    return _c(`[Function: ${name}]`, COLORS.comment, useColor);
  }
  // typeof value === 'symbol' is the last possible primitive type
  if (mode === 'json') return _c('null', COLORS.null, useColor);
  return _c((value as symbol).toString(), COLORS.comment, useColor);
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
    // v1.3.3
    mode: 'display' | 'json';
  },
): string => {
  const {
    indent, maxDepth, maxItems, maxStringLength, useColor, seen,
    sortKeys, inlineArrayMaxLength, mode,
  } = config;

  // Primitives (including null, undefined)
  if (value === null || typeof value !== 'object') {
    return _formatPrimitive(value, { useColor, maxStringLength, mode });
  }

  // Circular reference guard
  if (seen.has(value as object)) {
    if (mode === 'json') {
      // Strict JSON has no representation for circulars
      throw new TypeError('Cannot serialize circular reference to JSON');
    }
    return _c('[Circular]', COLORS.comment, useColor);
  }
  seen.add(value as object);

  // v1.3.3 — Native built-ins that need special handling
  if (value instanceof Date) {
    const iso = value.toISOString();
    if (mode === 'json') {
      return _c(JSON.stringify(iso), COLORS.string, useColor);
    }
    return _c(`Date(${iso})`, COLORS.comment, useColor);
  }
  if (value instanceof Map) {
    // In 'json' mode: convert to plain object (only string keys preserved)
    if (mode === 'json') {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value as Map<unknown, unknown>) {
        if (typeof k === 'string') obj[k] = v;
        else obj[String(k)] = v;
      }
      return _renderValue(obj, depth, config);
    }
    // In 'display' mode: show entries as nested array
    const entries = Array.from(value as Map<unknown, unknown>);
    const sizeLabel = _c(`Map(${entries.length})`, COLORS.comment, useColor);
    if (entries.length === 0) {
      return `${sizeLabel} ${_c('{}', COLORS.bracket, useColor)}`;
    }
    if (depth >= maxDepth - 1 && depth > 0) {
      return `${sizeLabel} ${_c('{...}', COLORS.bracket, useColor)}`;
    }
    return `${sizeLabel} ${_renderValue(entries, depth, config)}`;
  }
  if (value instanceof Set) {
    if (mode === 'json') {
      // Convert Set to array (standard JSON pattern)
      return _renderValue(Array.from(value as Set<unknown>), depth, config);
    }
    const arr = Array.from(value as Set<unknown>);
    const sizeLabel = _c(`Set(${arr.length})`, COLORS.comment, useColor);
    if (arr.length === 0) {
      return `${sizeLabel} ${_c('[]', COLORS.bracket, useColor)}`;
    }
    return `${sizeLabel} ${_renderValue(arr, depth, config)}`;
  }

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
          inlineItems.push(_formatPrimitive(value[i], { useColor, maxStringLength, mode }));
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

  // v1.3.3 — in 'json' mode, drop keys whose value is undefined/function/symbol
  // (matches JSON.stringify behavior; those types have no JSON representation)
  if (mode === 'json') {
    keys = keys.filter((k) => {
      const v = (value as Record<string, unknown>)[k];
      return typeof v !== 'function' && typeof v !== 'symbol' && v !== undefined;
    });
  }

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
    // v1.3.3
    mode = 'display',
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
  // Defensive: mode validation
  const safeMode: 'display' | 'json' = mode === 'json' ? 'json' : 'display';

  // In 'json' mode, colors are forced off (output must be parseable)
  const useColor = safeMode === 'json' ? false : (colors && !isNoColor());

  return _renderValue(value, 0, {
    indent: safeIndent,
    maxDepth: safeMaxDepth,
    maxItems: safeMaxItems,
    maxStringLength: safeMaxStrLen,
    useColor,
    seen: new WeakSet<object>(),
    sortKeys: Boolean(sortKeys),
    inlineArrayMaxLength: safeInlineMax,
    mode: safeMode,
  });
};

// ─────────────────────────────────────────────
//  Namespace
// ─────────────────────────────────────────────

export const json = {
  pretty,
};

export default json;
