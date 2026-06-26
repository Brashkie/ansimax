// ─────────────────────────────────────────────
//  ansimax/markdown — Color palettes per theme
//
//  v1.4.1 — Split out from index.ts. The THEMES record encodes hex
//  colors for each markdown element under both 'dark' and 'light'
//  themes. Not exported — only consumed by the renderer + inline-parser.
// ─────────────────────────────────────────────

import type { MarkdownTheme } from './types.js';

export interface ThemePalette {
  h1: string[];                // h1 gradient
  h2: string;                  // h2 single color
  h3: string;
  h4: string;
  h5: string;
  h6: string;
  code: string;                // inline code text
  codeBlockBorder: string;     // code-block frame color
  link: string;
  blockquote: string;
  hr: string;
  tableHeader: string;
}

export const THEMES: Record<MarkdownTheme, ThemePalette> = {
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
