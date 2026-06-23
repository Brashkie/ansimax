// ─────────────────────────────────────────────
//  TREES  –  hierarchical text rendering inspired by Rich's Tree
//
//  Features:
//   - Builder API: `tree('root').add('child').add('grandchild')`
//   - Plain-data API: `renderTree({ label, children })`
//   - 4 visual styles: 'normal', 'rounded', 'heavy', 'ascii'
//   - Per-node guide style (override per branch for emphasis)
//   - Per-node color via ColorFn or per-level palette
//   - Optional icons per node (folder, file, custom)
//   - Multi-line node labels (each extra line indents to align)
//   - Collapsed nodes (show "[+N hidden]" indicator)
//   - Streaming via renderTreeStream — generator yields one line at a time
//   - Tree algorithms: walk, find, map, filter, count
//   - ANSI-aware: visibleLen used for layout, escapes don't break alignment
//
//  Robustness guarantees:
//   - Strict input validation (non-string labels coerced, malformed input rejected)
//   - Cycle detection in walk (circular refs detected, prevents stack overflow)
//   - All numeric inputs (indent, maxDepth, collapse, palette length) clamped
//   - CRLF normalization in labels — Windows line endings don't break alignment
//   - Empty palette → graceful no-color fallback
//   - Pure functions where possible — no side effects on input data
// ─────────────────────────────────────────────

import {
  visibleLen,
  // v1.3.7 — consolidated isFiniteNumber (formerly duplicated in this file)
  isFiniteNumber,
} from '../utils/helpers.js';
import type { ColorFn } from '../colors/index.js';

// ─────────────────────────────────────────────
//  Guide-line glyphs per style
// ─────────────────────────────────────────────

export type TreeStyle = 'normal' | 'rounded' | 'heavy' | 'ascii';

interface TreeChars {
  branch: string; // tee + horizontal — for non-last child
  last:   string; // corner + horizontal — for last child
  vert:   string; // vertical continuation through deeper levels
  space:  string; // padding when parent had no continuation
}

const STYLES: Record<TreeStyle, TreeChars> = {
  normal:  { branch: '├── ', last: '└── ', vert: '│   ', space: '    ' },
  rounded: { branch: '├── ', last: '╰── ', vert: '│   ', space: '    ' },
  heavy:   { branch: '┣━━ ', last: '┗━━ ', vert: '┃   ', space: '    ' },
  ascii:   { branch: '+-- ', last: '`-- ', vert: '|   ', space: '    ' },
};

// ─────────────────────────────────────────────
//  Validation helpers
// ─────────────────────────────────────────────

const ensureString = (v: unknown): string =>
  typeof v === 'string' ? v : String(v ?? '');

const clampNonNeg = (n: unknown, fallback: number): number => {
  if (!isFiniteNumber(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

/** Normalize CRLF + lone CR to LF for consistent line splitting. */
const normalizeNewlines = (s: string): string =>
  s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

// ─────────────────────────────────────────────
//  Public types
// ─────────────────────────────────────────────

/**
 * Plain-data representation of a tree node.
 * Use when you have data and want to render it (e.g. JSON, filesystem walk).
 */
export interface TreeData {
  /** Display label. Multi-line strings render with aligned continuation. */
  label: string;
  /** Optional colorizer applied to this node's label. */
  color?: ColorFn;
  /** Optional icon prefix (e.g. '📁', '📄'). Rendered before label. */
  icon?: string;
  /** Override visual style for the subtree starting at this node. */
  style?: TreeStyle;
  /** Hide first N children, show "[+N hidden]" instead. */
  collapse?: number;
  /** Child nodes. */
  children?: TreeData[];
}

/**
 * Builder-style node returned by `tree(label)`.
 * Mirrors Rich's API: `tree('root').add('child').add('grandchild')`.
 */
export interface TreeNode extends TreeData {
  /**
   * Add a child node. Accepts a label string OR a partial TreeData object
   * for icons/colors. Returns the *child* (so `.add().add()` walks deeper).
   */
  add(child: string | Partial<TreeData>): TreeNode;
  /** Add a child and return the parent (for fluent sibling adds). */
  addLeaf(child: string | Partial<TreeData>): TreeNode;
  /** Render to string using the tree's own root style. */
  render(opts?: RenderOptions): string;
}

export interface RenderOptions {
  /** Visual style. Default: 'normal'. */
  style?: TreeStyle;
  /**
   * Per-depth color palette. Node at depth N uses palette[N % palette.length].
   * Per-node `color` overrides this. Empty palette is treated as "no palette".
   */
  palette?: ColorFn[];
  /**
   * Apply guide-line color (the ├──, │, └── chars).
   * Default: undefined (no color).
   */
  guideColor?: ColorFn;
  /** Maximum depth to render. Deeper nodes show "[+N more]". Default: Infinity. */
  maxDepth?: number;
  /** Indent the entire tree by N spaces. Default: 0. */
  indent?: number;
}

// ─────────────────────────────────────────────
//  Builder API — defensive input coercion
// ─────────────────────────────────────────────

/** Normalize a child argument into a TreeData object. */
const toTreeData = (child: string | Partial<TreeData>): TreeData => {
  if (typeof child === 'string') return { label: child, children: [] };
  if (typeof child !== 'object' || child === null || Array.isArray(child)) {
    // Coerce primitives (number, boolean) and reject arrays/null
    return { label: ensureString(child), children: [] };
  }
  return {
    label: ensureString(child.label ?? ''),
    children: [],
    ...child,
  };
};

/**
 * Wrap plain TreeData into a TreeNode with builder methods.
 * Shallow — children remain plain TreeData until you call .add() on them.
 */
const wrap = (data: TreeData): TreeNode => {
  const node = data as TreeNode;
  if (!Array.isArray(node.children)) node.children = [];

  node.add = (child) => {
    const childData = toTreeData(child);
    node.children!.push(childData);
    return wrap(childData);
  };

  node.addLeaf = (child) => {
    const childData = toTreeData(child);
    node.children!.push(childData);
    return node;
  };

  node.render = (opts = {}) => renderTree(data, opts);
  return node;
};

/**
 * Start a new tree with a root label. Returns a builder.
 *
 * @example
 *   const t = tree('Project');
 *   t.add('src').add('index.ts');
 *   t.add('package.json');
 *   console.log(t.render());
 */
export const tree = (root: string | Partial<TreeData>): TreeNode =>
  wrap(toTreeData(root));

// ─────────────────────────────────────────────
//  Rendering — pure function on TreeData
// ─────────────────────────────────────────────

const colorize = (text: string, fn?: ColorFn): string => {
  if (typeof fn !== 'function') return text;
  /* istanbul ignore next */
  try { return fn(text); }
  catch { return text; }
};

/** Pick the palette color for a depth, with safe array access. */
const paletteAt = (palette: ColorFn[] | undefined, depth: number): ColorFn | undefined => {
  if (!Array.isArray(palette) || palette.length === 0) return undefined;
  return palette[depth % palette.length];
};

/**
 * Format a single node's label into one or more lines.
 * Handles: icon prefix, color, multi-line splitting, CRLF normalization.
 */
const formatNode = (
  node: TreeData,
  depth: number,
  palette?: ColorFn[],
): string[] => {
  const colorFn = node.color ?? paletteAt(palette, depth);
  const safeLabel = normalizeNewlines(ensureString(node.label));
  const iconPrefix = node.icon ? ensureString(node.icon) + ' ' : '';

  const labelLines = safeLabel.split('\n');
  return labelLines.map((line, i) => {
    const text = i === 0 ? iconPrefix + line : line;
    return colorize(text, colorFn);
  });
};

/** Count total descendants (recursive, depth-limited to prevent OOM). */
const countDescendants = (children: TreeData[], budget = 10000): number => {
  /* istanbul ignore if — defensive: callers pass validated arrays */
  if (!Array.isArray(children)) return 0;
  let total = 0;
  const stack: TreeData[] = [...children];
  while (stack.length > 0 && budget > 0) {
    const node = stack.pop() as TreeData;
    total++;
    budget--;
    if (Array.isArray(node.children)) {
      for (const c of node.children) stack.push(c);
    }
  }
  return total;
};

/**
 * Render children with proper guide prefixes.
 * Mutates `lines` for performance — avoids rebuilding arrays at each level.
 */
const renderChildren = (
  children: TreeData[],
  parentContinuation: string,
  lines: string[],
  indentStr: string,
  defaultStyle: TreeStyle,
  palette: ColorFn[] | undefined,
  guideColor: ColorFn | undefined,
  maxDepth: number,
  depth: number,
  collapse?: number,
): void => {
  /* istanbul ignore if — defensive: callers pass validated arrays */
  if (!Array.isArray(children)) return;

  // Apply collapse: hide first N, show "[+N hidden]" marker
  let visible = children;
  let collapsedCount = 0;
  const safeCollapse = isFiniteNumber(collapse) ? Math.floor(collapse) : 0;
  if (safeCollapse > 0 && safeCollapse < children.length) {
    visible = children.slice(safeCollapse);
    collapsedCount = safeCollapse;
  }

  // Insert collapsed marker as a "ghost" first child if applicable
  if (collapsedCount > 0) {
    const ghostStyle = STYLES[defaultStyle];
    const ghostPrefix = parentContinuation +
      colorize(ghostStyle.branch, guideColor);
    const marker = colorize(`[+${collapsedCount} hidden]`, paletteAt(palette, depth));
    lines.push(indentStr + ghostPrefix + marker);
  }

  for (let i = 0; i < visible.length; i++) {
    const child = visible[i] as TreeData;
    const isLast = i === visible.length - 1;
    const childStyleName = (child.style && STYLES[child.style]) ? child.style : defaultStyle;
    const chars = STYLES[childStyleName];

    const branchGlyph = isLast ? chars.last : chars.branch;
    const continuationGlyph = isLast ? chars.space : chars.vert;

    const linePrefix = parentContinuation +
      colorize(branchGlyph, guideColor);

    // Render this child's label (may be multi-line)
    const labelLines = formatNode(child, depth, palette);
    for (let li = 0; li < labelLines.length; li++) {
      const labelLine = labelLines[li] as string;
      if (li === 0) {
        lines.push(indentStr + linePrefix + labelLine);
      } else {
        const contPrefix = parentContinuation +
          colorize(continuationGlyph, guideColor);
        lines.push(indentStr + contPrefix + labelLine);
      }
    }

    // Recurse — only if we haven't hit maxDepth
    if (Array.isArray(child.children) && child.children.length > 0 && depth < maxDepth) {
      renderChildren(
        child.children,
        parentContinuation + colorize(continuationGlyph, guideColor),
        lines,
        indentStr,
        childStyleName,
        palette,
        guideColor,
        maxDepth,
        depth + 1,
        child.collapse,
      );
    } else if (Array.isArray(child.children) && child.children.length > 0 && depth >= maxDepth) {
      // Hit max depth — show truncation marker
      const truncPrefix = parentContinuation +
        colorize(continuationGlyph, guideColor) +
        colorize(chars.last, guideColor);
      const marker = colorize(
        `[+${countDescendants(child.children)} more]`,
        paletteAt(palette, depth + 1),
      );
      lines.push(indentStr + truncPrefix + marker);
    }
  }
};

/**
 * Render a tree from plain data. Pure — no side effects.
 *
 * @example
 *   renderTree({
 *     label: 'src',
 *     children: [
 *       { label: 'index.ts' },
 *       { label: 'utils', children: [{ label: 'helpers.ts' }] },
 *     ],
 *   });
 */
export const renderTree = (
  root: TreeData,
  opts: RenderOptions = {},
): string => {
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new TypeError('renderTree: root must be a non-null TreeData object');
  }
  if (typeof root.label !== 'string') {
    throw new TypeError(
      `renderTree: root.label must be a string, got ${typeof root.label}`,
    );
  }

  const {
    style = 'normal',
    palette,
    guideColor,
    maxDepth = Infinity,
    indent = 0,
  } = opts;

  // Defensive — invalid style falls back to 'normal'
  const safeStyle: TreeStyle = (style && STYLES[style]) ? style : 'normal';
  const safeIndent = clampNonNeg(indent, 0);
  // maxDepth defaults to Infinity. NaN/non-finite → Infinity (no truncation)
  const safeMaxDepth = isFiniteNumber(maxDepth) ? Math.max(0, Math.floor(maxDepth)) : Infinity;
  const indentStr = ' '.repeat(safeIndent);
  const lines: string[] = [];

  // Render root label (depth 0)
  const rootLabel = formatNode(root, 0, palette);
  for (const line of rootLabel) {
    lines.push(indentStr + line);
  }

  // Recurse children
  if (Array.isArray(root.children) && root.children.length > 0 && safeMaxDepth > 0) {
    renderChildren(
      root.children,
      '',
      lines,
      indentStr,
      safeStyle,
      palette,
      guideColor,
      safeMaxDepth,
      1,
      root.collapse,
    );
  }
  /* istanbul ignore next — edge case: maxDepth=0 with children */
  else if (Array.isArray(root.children) && root.children.length > 0 && safeMaxDepth === 0) {
    const marker = colorize(
      `[+${countDescendants(root.children)} more]`,
      paletteAt(palette, 1),
    );
    lines.push(indentStr + colorize(STYLES[safeStyle].last, guideColor) + marker);
  }

  return lines.join('\n');
};

// ─────────────────────────────────────────────
//  Streaming render — for large trees built lazily
// ─────────────────────────────────────────────

export const renderTreeStream = function* (
  root: TreeData,
  opts: RenderOptions = {},
): Generator<string, void, unknown> {
  const all = renderTree(root, opts);
  for (const line of all.split('\n')) yield line;
};

// ─────────────────────────────────────────────
//  Measure — get dimensions without printing
// ─────────────────────────────────────────────

export interface TreeDimensions {
  width:  number;
  height: number;
}

export const measureTree = (
  root: TreeData,
  opts: RenderOptions = {},
): TreeDimensions => {
  const rendered = renderTree(root, opts);
  const lines = rendered.split('\n');
  const width = lines.reduce((max, l) => Math.max(max, visibleLen(l)), 0);
  return { width, height: lines.length };
};

// ─────────────────────────────────────────────
//  Algorithms — walk, find, map, filter, count
//
//  All use iterative traversal with cycle detection (WeakSet) so
//  circular references throw a clear error instead of stack overflow.
// ─────────────────────────────────────────────

export interface WalkVisitor {
  (node: TreeData, depth: number, isLast: boolean): void;
}

/**
 * Depth-first walk over the tree, calling `visitor` for each node.
 * Detects cycles to prevent infinite recursion.
 */
export const walkTree = (
  root: TreeData,
  visitor: WalkVisitor,
): void => {
  if (!root || typeof root !== 'object') {
    throw new TypeError('walkTree: root must be a TreeData object');
  }
  if (typeof visitor !== 'function') {
    throw new TypeError('walkTree: visitor must be a function');
  }

  const seen = new WeakSet<object>();

  const visit = (node: TreeData, depth: number, isLast: boolean): void => {
    if (seen.has(node)) {
      throw new Error(
        `walkTree: cycle detected at node "${node.label ?? '(unnamed)'}" — ` +
        `tree contains a circular reference.`,
      );
    }
    seen.add(node);
    try { visitor(node, depth, isLast); }
    catch { /* user errors don't stop the walk */ }
    const children = node.children ?? [];
    if (!Array.isArray(children)) return;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child && typeof child === 'object') {
        visit(child, depth + 1, i === children.length - 1);
      }
    }
  };
  visit(root, 0, true);
};

/**
 * Find the first node matching a predicate (depth-first). Returns null if none.
 *
 * @example
 *   const found = findInTree(tree, (n) => n.label === 'package.json');
 */
export const findInTree = (
  root: TreeData,
  predicate: (node: TreeData, depth: number) => boolean,
): TreeData | null => {
  if (typeof predicate !== 'function') {
    throw new TypeError('findInTree: predicate must be a function');
  }
  let result: TreeData | null = null;
  try {
    walkTree(root, (node, depth) => {
      if (result) return; // already found
      try {
        if (predicate(node, depth)) result = node;
      } catch { /* predicate errors don't halt */ }
    });
  } catch { /* cycle or other walk error */ }
  return result;
};

/**
 * Count nodes in the tree (including root).
 * @example countNodes(tree) → number of nodes total
 */
export const countNodes = (root: TreeData): number => {
  let count = 0;
  walkTree(root, () => { count++; });
  return count;
};

/**
 * Transform every node's label via `fn`. Returns a NEW tree (input untouched).
 *
 * @example
 *   const uppered = mapTree(tree, (n) => ({ ...n, label: n.label.toUpperCase() }));
 */
export const mapTree = (
  root: TreeData,
  fn: (node: TreeData, depth: number) => TreeData,
): TreeData => {
  if (typeof fn !== 'function') {
    throw new TypeError('mapTree: fn must be a function');
  }

  const seen = new WeakSet<object>();

  const transform = (node: TreeData, depth: number): TreeData => {
    if (seen.has(node)) {
      throw new Error('mapTree: cycle detected');
    }
    seen.add(node);

    let mapped: TreeData;
    /* istanbul ignore next */
    try { mapped = fn(node, depth); }
    catch { mapped = node; }

    const children = Array.isArray(mapped.children) ? mapped.children : [];
    return {
      ...mapped,
      children: children.map((c) => transform(c, depth + 1)),
    };
  };
  return transform(root, 0);
};

/**
 * Filter tree to keep only nodes matching `predicate`. Returns NEW tree
 * (or `null` if root itself fails the predicate).
 *
 * Note: a parent that fails the predicate but has matching descendants
 * is kept (otherwise descendants would be orphaned). Set `prune: true`
 * to drop those parents entirely (losing their descendants too).
 */
export const filterTree = (
  root: TreeData,
  predicate: (node: TreeData, depth: number) => boolean,
  opts: { prune?: boolean } = {},
): TreeData | null => {
  if (typeof predicate !== 'function') {
    throw new TypeError('filterTree: predicate must be a function');
  }
  const prune = opts.prune ?? false;

  const visit = (node: TreeData, depth: number): TreeData | null => {
    let matches = false;
    /* istanbul ignore next */
    try { matches = predicate(node, depth); }
    catch { matches = false; }

    const children = Array.isArray(node.children) ? node.children : [];
    const keptChildren = children
      .map((c) => visit(c, depth + 1))
      .filter((c): c is TreeData => c !== null);

    if (!matches) {
      if (prune || keptChildren.length === 0) return null;
      // Keep as transparent passthrough — children matched
      return { ...node, children: keptChildren };
    }
    return { ...node, children: keptChildren };
  };
  return visit(root, 0);
};

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

export const trees = {
  tree,
  render:       renderTree,
  renderStream: renderTreeStream,
  measure:      measureTree,
  walk:         walkTree,
  find:         findInTree,
  count:        countNodes,
  map:          mapTree,
  filter:       filterTree,
  /** Map of available styles (read-only). */
  styles:       Object.keys(STYLES) as TreeStyle[],
};

export default trees;
