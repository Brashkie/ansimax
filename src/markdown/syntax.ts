// ─────────────────────────────────────────────
//  ansimax/markdown — Basic syntax highlighter
//
//  v1.4.5 — Regex-based tokenizer for code blocks.
//
//  Supported languages: js, ts, json, bash (with aliases).
//  Unknown languages fall back to plain rendering.
//
//  Design constraints:
//   • Zero external dependencies
//   • Non-nested tokenization (no full parser)
//   • Preserve original text length + newlines exactly
//   • ANSI codes wrap each token
//
//  This is intentionally simple — perfect for CLIs, sufficient for
//  most terminal code blocks. Full-parser highlighting (like shiki)
//  is out of scope.
// ─────────────────────────────────────────────

import { color } from '../colors/index.js';
import type { MarkdownTheme } from './types.js';

/** Named token classes shared across languages. */
export type TokenKind =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'boolean'
  | 'null'
  | 'property'
  | 'plain';

/** Colors per theme and token kind. */
interface HighlightPalette {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  operator: string;
  punctuation: string;
  boolean: string;
  null: string;
  property: string;
}

const DARK_PALETTE: HighlightPalette = {
  keyword: '#ff79c6',       // pink
  string:  '#f1fa8c',       // yellow
  number:  '#bd93f9',       // purple
  comment: '#6272a4',       // gray-blue
  operator: '#ff79c6',      // pink
  punctuation: '#f8f8f2',   // near-white
  boolean: '#bd93f9',       // purple
  null:    '#bd93f9',       // purple
  property: '#8be9fd',      // cyan
};

const LIGHT_PALETTE: HighlightPalette = {
  keyword: '#d63384',
  string:  '#664d03',
  number:  '#6f42c1',
  comment: '#6c757d',
  operator: '#d63384',
  punctuation: '#212529',
  boolean: '#6f42c1',
  null:    '#6f42c1',
  property: '#0d6efd',
};

const _paletteFor = (theme: MarkdownTheme): HighlightPalette =>
  theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;

// ─────────────────────────────────────────────
//  Language grammars
//
//  Each grammar is a list of ordered rules. First matching rule wins
//  per position, so more-specific rules (comments, strings) must
//  precede more-general ones (identifiers, operators).
// ─────────────────────────────────────────────

interface Rule {
  kind: TokenKind;
  match: RegExp;   // sticky ('y' flag) — anchored at lastIndex
}

/** JS/TS grammar. TypeScript adds a few more keywords. */
const JS_KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'default', 'try', 'catch', 'finally',
  'throw', 'new', 'class', 'extends', 'super', 'this', 'import', 'export', 'from',
  'as', 'async', 'await', 'yield', 'typeof', 'instanceof', 'in', 'of', 'delete',
  'void', 'null', 'undefined',
]);
const TS_KEYWORDS = new Set([
  ...JS_KEYWORDS,
  'interface', 'type', 'enum', 'namespace', 'abstract', 'public', 'private',
  'protected', 'readonly', 'implements', 'declare', 'is', 'keyof', 'infer',
  'satisfies', 'unknown', 'any', 'never', 'string', 'number', 'boolean', 'object',
]);

const JS_RULES: Rule[] = [
  { kind: 'comment',     match: /\/\/[^\n]*/y },
  { kind: 'comment',     match: /\/\*[\s\S]*?\*\//y },
  { kind: 'string',      match: /"(?:[^"\\]|\\.)*"/y },
  { kind: 'string',      match: /'(?:[^'\\]|\\.)*'/y },
  { kind: 'string',      match: /`(?:[^`\\]|\\.)*`/y },
  { kind: 'number',      match: /-?\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b/y },
  { kind: 'boolean',     match: /\b(?:true|false)\b/y },
  { kind: 'null',        match: /\b(?:null|undefined)\b/y },
  { kind: 'keyword',     match: /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/y },   // resolved below
  { kind: 'operator',    match: /[=+\-*/%<>!&|^~?]+/y },
  { kind: 'punctuation', match: /[{}[\]().,;:]/y },
];

/** JSON grammar — strict subset of JS. */
const JSON_RULES: Rule[] = [
  { kind: 'string',      match: /"(?:[^"\\]|\\.)*"/y },
  { kind: 'number',      match: /-?\b\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b/y },
  { kind: 'boolean',     match: /\b(?:true|false)\b/y },
  { kind: 'null',        match: /\bnull\b/y },
  { kind: 'punctuation', match: /[{}[\]:,]/y },
];

/** Bash grammar — commands, strings, comments, variables. */
const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case',
  'esac', 'in', 'function', 'return', 'break', 'continue', 'echo', 'exit',
]);
const BASH_RULES: Rule[] = [
  { kind: 'comment',     match: /#[^\n]*/y },
  { kind: 'string',      match: /"(?:[^"\\]|\\.)*"/y },
  { kind: 'string',      match: /'[^']*'/y },
  { kind: 'property',    match: /\$\{[^}]+\}/y },              // ${VAR}
  { kind: 'property',    match: /\$[a-zA-Z_][a-zA-Z0-9_]*/y }, // $VAR
  { kind: 'number',      match: /-?\b\d+\b/y },
  { kind: 'keyword',     match: /\b[a-zA-Z_][a-zA-Z0-9_-]*\b/y },
  { kind: 'operator',    match: /[|&<>=!]+/y },
  { kind: 'punctuation', match: /[{}();,]/y },
];

// ─────────────────────────────────────────────
//  Language resolution
// ─────────────────────────────────────────────

interface Grammar {
  rules: Rule[];
  keywordSet?: Set<string>;
}

const _grammars: Record<string, Grammar> = {
  js:         { rules: JS_RULES,   keywordSet: JS_KEYWORDS },
  javascript: { rules: JS_RULES,   keywordSet: JS_KEYWORDS },
  jsx:        { rules: JS_RULES,   keywordSet: JS_KEYWORDS },
  ts:         { rules: JS_RULES,   keywordSet: TS_KEYWORDS },
  typescript: { rules: JS_RULES,   keywordSet: TS_KEYWORDS },
  tsx:        { rules: JS_RULES,   keywordSet: TS_KEYWORDS },
  json:       { rules: JSON_RULES },
  bash:       { rules: BASH_RULES, keywordSet: BASH_KEYWORDS },
  sh:         { rules: BASH_RULES, keywordSet: BASH_KEYWORDS },
  shell:      { rules: BASH_RULES, keywordSet: BASH_KEYWORDS },
  zsh:        { rules: BASH_RULES, keywordSet: BASH_KEYWORDS },
};

/**
 * Returns true when the language has a highlighter grammar.
 *
 * @since 1.4.5
 */
export const isHighlightSupported = (lang: string): boolean =>
  typeof lang === 'string' && _grammars[lang.toLowerCase()] !== undefined;

// ─────────────────────────────────────────────
//  Tokenizer
// ─────────────────────────────────────────────

/**
 * A single token from the syntax highlighter — kind + the exact source
 * text that produced it. Exposed for tests and advanced consumers.
 *
 * @since 1.4.5
 */
export interface Token {
  kind: TokenKind;
  text: string;
}

/**
 * Tokenize `code` using the grammar for `lang`. Returns a flat token
 * stream. Unmatched positions become `plain` tokens (fallback for
 * whitespace and characters no rule captures).
 *
 * @since 1.4.5
 */
export const tokenize = (code: string, lang: string): Token[] => {
  const grammar = _grammars[lang.toLowerCase()];
  if (!grammar) return [{ kind: 'plain', text: code }];

  const tokens: Token[] = [];
  let pos = 0;
  const len = code.length;

  while (pos < len) {
    let matched = false;
    for (const rule of grammar.rules) {
      rule.match.lastIndex = pos;
      const m = rule.match.exec(code);
      if (m && m.index === pos) {
        let kind = rule.kind;
        // Post-process: identifier → keyword if in keyword set
        if (rule.kind === 'keyword' && grammar.keywordSet) {
          const isKw = grammar.keywordSet.has(m[0]);
          if (!isKw) {
            // Check if followed by ':' (property in object literal / JSX)
            const nextCh = code[pos + m[0].length];
            kind = nextCh === ':' ? 'property' : 'plain';
          }
        }
        tokens.push({ kind, text: m[0] });
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // No rule matches this char → plain token (whitespace, unknown chars)
      tokens.push({ kind: 'plain', text: code[pos] as string });
      pos++;
    }
  }

  return tokens;
};

// ─────────────────────────────────────────────
//  Colorizer
// ─────────────────────────────────────────────

/**
 * Highlight `code` using the grammar for `lang`. Returns a string with
 * ANSI color escapes applied to each token. If `lang` is unsupported,
 * returns the code unchanged.
 *
 * @since 1.4.5
 */
export const highlight = (code: string, lang: string, theme: MarkdownTheme = 'dark'): string => {
  if (!isHighlightSupported(lang)) return code;

  const palette = _paletteFor(theme);
  const tokens = tokenize(code, lang);
  const out: string[] = [];

  for (const tok of tokens) {
    if (tok.kind === 'plain') {
      out.push(tok.text);
      continue;
    }
    const hex = palette[tok.kind as keyof HighlightPalette];
    /* istanbul ignore next — TokenKind ⊆ HighlightPalette keys by construction */
    if (!hex) {
      out.push(tok.text);
      continue;
    }
    // Comments get dim + color; keywords get bold
    if (tok.kind === 'comment') {
      out.push(color.dim(color.hex(hex)(tok.text)));
    } else if (tok.kind === 'keyword') {
      out.push(color.bold(color.hex(hex)(tok.text)));
    } else {
      out.push(color.hex(hex)(tok.text));
    }
  }

  return out.join('');
};
