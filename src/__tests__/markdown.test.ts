import { markdown, render, parseBlocks, parseInline } from '../markdown/index.js';
import { stripAnsi } from '../utils/helpers.js';
import { setNoColor, resetNoColor, clearColorCache } from '../colors/index.js';
import { resetColorSupportCache } from '../utils/ansi.js';

// ─────────────────────────────────────────────
//  parseBlocks — block tokenization
// ─────────────────────────────────────────────

describe('parseBlocks (v1.4.0)', () => {
  it('parses a simple heading', () => {
    const blocks = parseBlocks('# Hello');
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Hello' });
  });

  it('parses all 6 heading levels', () => {
    const source = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
    const blocks = parseBlocks(source).filter((b) => b.type === 'heading');
    expect(blocks.length).toBe(6);
    expect(blocks.map((b) => b.type === 'heading' && b.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('parses paragraphs with line wrapping (single space join)', () => {
    const blocks = parseBlocks('First line\nsecond line\nthird line');
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toEqual({
      type: 'paragraph',
      text: 'First line second line third line',
    });
  });

  it('separates paragraphs by blank lines', () => {
    const blocks = parseBlocks('Para one.\n\nPara two.');
    const paras = blocks.filter((b) => b.type === 'paragraph');
    expect(paras.length).toBe(2);
  });

  it('parses unordered lists', () => {
    const blocks = parseBlocks('- item 1\n- item 2\n- item 3');
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: false,
      // v1.4.3: items now use ListItem[] (was string[])
      items: [
        { text: 'item 1' },
        { text: 'item 2' },
        { text: 'item 3' },
      ],
    });
  });

  it('parses ordered lists', () => {
    const blocks = parseBlocks('1. one\n2. two\n3. three');
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: true,
      // v1.4.3: items now use ListItem[] (was string[])
      items: [
        { text: 'one' },
        { text: 'two' },
        { text: 'three' },
      ],
    });
  });

  it('accepts * and + as unordered list markers', () => {
    expect(parseBlocks('* a\n* b')[0]).toMatchObject({ type: 'list', ordered: false });
    expect(parseBlocks('+ a\n+ b')[0]).toMatchObject({ type: 'list', ordered: false });
  });

  it('parses code blocks with language tag', () => {
    const source = '```js\nconst x = 42;\nconst y = x + 1;\n```';
    const blocks = parseBlocks(source);
    expect(blocks[0]).toEqual({
      type: 'codeblock',
      lang: 'js',
      code: 'const x = 42;\nconst y = x + 1;',
    });
  });

  it('parses code blocks without language tag', () => {
    const blocks = parseBlocks('```\nplain code\n```');
    expect(blocks[0]).toEqual({ type: 'codeblock', lang: '', code: 'plain code' });
  });

  it('handles unclosed code blocks (EOF)', () => {
    const blocks = parseBlocks('```\nno close');
    expect(blocks[0]).toMatchObject({ type: 'codeblock', code: 'no close' });
  });

  it('does not parse inline markup inside code blocks', () => {
    // **bold** stays literal in code block
    const blocks = parseBlocks('```\n**not bold**\n```');
    expect(blocks[0]).toMatchObject({ type: 'codeblock', code: '**not bold**' });
  });

  it('parses blockquotes (single line)', () => {
    const blocks = parseBlocks('> quoted text');
    expect(blocks[0]).toEqual({ type: 'blockquote', text: 'quoted text' });
  });

  it('parses multi-line blockquotes', () => {
    const blocks = parseBlocks('> line 1\n> line 2');
    expect(blocks[0]).toMatchObject({
      type: 'blockquote',
      text: 'line 1\nline 2',
    });
  });

  it('parses horizontal rules (---, ***, ___)', () => {
    expect(parseBlocks('---')[0]).toEqual({ type: 'hr' });
    expect(parseBlocks('***')[0]).toEqual({ type: 'hr' });
    expect(parseBlocks('___')[0]).toEqual({ type: 'hr' });
    expect(parseBlocks('-----')[0]).toEqual({ type: 'hr' });
  });

  it('parses tables', () => {
    const source = '| Name | Value |\n|---|---|\n| foo | 1 |\n| bar | 2 |';
    const blocks = parseBlocks(source);
    expect(blocks[0]).toMatchObject({
      type: 'table',
      headers: ['Name', 'Value'],
      rows: [['foo', '1'], ['bar', '2']],
    });
  });

  it('handles tables with alignment markers', () => {
    const source = '| Name | Value |\n|:---|---:|\n| foo | 1 |';
    const blocks = parseBlocks(source);
    expect(blocks[0]).toMatchObject({ type: 'table' });
  });

  it('rejects table-looking rows without separator (treats as paragraph)', () => {
    // | a | b | followed by non-separator should be a paragraph
    const source = '| a | b |\nnot a separator\n| c | d |';
    const blocks = parseBlocks(source);
    // Should NOT be a table — table requires the |---|---| separator
    expect(blocks[0]?.type).not.toBe('table');
  });

  it('handles CRLF and CR line endings', () => {
    const blocks1 = parseBlocks('# H1\r\n\r\nbody');
    const blocks2 = parseBlocks('# H1\rbody');
    expect(blocks1.some((b) => b.type === 'heading')).toBe(true);
    expect(blocks2.some((b) => b.type === 'heading')).toBe(true);
  });

  it('returns empty array for empty input', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('   \n  \n  ')).toHaveLength(3);   // blank blocks
  });

  it('returns empty array for non-string input', () => {
    // @ts-expect-error testing defensive
    expect(parseBlocks(null)).toEqual([]);
    // @ts-expect-error testing defensive
    expect(parseBlocks(42)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
//  parseInline — inline markup
// ─────────────────────────────────────────────

describe('parseInline (v1.4.0)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  const opts = { theme: 'dark' as const, inlineCodeBackground: true };

  it('handles bold (**text** and __text__)', () => {
    const a = parseInline('**bold**', opts);
    const b = parseInline('__bold__', opts);
    expect(stripAnsi(a)).toBe('bold');
    expect(stripAnsi(b)).toBe('bold');
    // Should contain bold ANSI code
    expect(a).toContain('\x1b[1m');
    expect(b).toContain('\x1b[1m');
  });

  it('handles italic (*text* and _text_)', () => {
    const a = parseInline('*italic*', opts);
    const b = parseInline('_italic_', opts);
    expect(stripAnsi(a)).toBe('italic');
    expect(stripAnsi(b)).toBe('italic');
    expect(a).toContain('\x1b[3m');
  });

  it('handles strikethrough (~~text~~)', () => {
    const result = parseInline('~~deleted~~', opts);
    expect(stripAnsi(result)).toBe('deleted');
    expect(result).toContain('\x1b[9m');
  });

  it('handles inline code (`text`)', () => {
    const result = parseInline('`code`', opts);
    // strip should give back something containing "code"
    expect(stripAnsi(result)).toContain('code');
  });

  it('handles links [label](url) with OSC 8', () => {
    const result = parseInline('[click](https://example.com)', opts);
    // OSC 8 wrapper
    expect(result).toContain('\x1b]8;;https://example.com');
    expect(stripAnsi(result)).toContain('click');
  });

  it('protects inline code from further parsing', () => {
    // **inside code** should NOT be bolded
    const result = parseInline('Use `**not bold**` like this', opts);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('**not bold**');
  });

  it('handles mixed inline markup', () => {
    const result = parseInline('**bold** and *italic* and `code`', opts);
    expect(stripAnsi(result)).toContain('bold');
    expect(stripAnsi(result)).toContain('italic');
    expect(stripAnsi(result)).toContain('code');
  });

  it('returns empty string for empty input', () => {
    expect(parseInline('', opts)).toBe('');
  });

  it('returns empty string for non-string', () => {
    // @ts-expect-error testing defensive
    expect(parseInline(null, opts)).toBe('');
    // @ts-expect-error testing defensive
    expect(parseInline(42, opts)).toBe('');
  });

  it('handles inlineCodeBackground: false', () => {
    const result = parseInline('`code`', { theme: 'dark', inlineCodeBackground: false });
    expect(stripAnsi(result)).toBe('code');
  });

  it('handles light theme', () => {
    const result = parseInline('[link](https://x.com)', { theme: 'light', inlineCodeBackground: true });
    expect(stripAnsi(result)).toContain('link');
  });

  it('does NOT trigger italic when asterisk is part of bold (precedence)', () => {
    // Test: **really bold** should be only bold, not bold+italic
    const result = parseInline('**really bold**', opts);
    expect(stripAnsi(result)).toBe('really bold');
    // Only one open of bold, no italic
    const ansiCount = result.match(/\x1b\[/g)?.length ?? 0;
    // bold uses 2 escapes (open + close)
    expect(ansiCount).toBe(2);
  });
});

// ─────────────────────────────────────────────
//  render — full pipeline
// ─────────────────────────────────────────────

describe('markdown.render (v1.4.0)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('renders empty string for empty input', () => {
    expect(render('')).toBe('');
  });

  it('renders empty string for non-string input', () => {
    // @ts-expect-error testing defensive
    expect(render(null)).toBe('');
  });

  it('renders heading with bold style', () => {
    const result = render('# Title');
    expect(stripAnsi(result)).toContain('Title');
    expect(result).toContain('\x1b[1m');   // bold
  });

  it('renders h2 with bold + underline (line 422-424)', () => {
    const result = render('## Subtitle');
    expect(stripAnsi(result)).toContain('Subtitle');
    expect(result).toContain('\x1b[1m');   // bold
    expect(result).toContain('\x1b[4m');   // underline
  });

  it('renders h3 with bold + solid color (lines 425-429)', () => {
    const result = render('### H3 heading');
    expect(stripAnsi(result)).toContain('H3 heading');
    expect(result).toContain('\x1b[1m');   // bold
    // h3 uses solid hex color, not underline
    expect(result).not.toContain('\x1b[4m');
  });

  it('renders h4 with bold + own color', () => {
    const result = render('#### Level 4');
    expect(stripAnsi(result)).toContain('Level 4');
    expect(result).toContain('\x1b[1m');
  });

  it('renders h5 with bold + own color', () => {
    const result = render('##### Level 5');
    expect(stripAnsi(result)).toContain('Level 5');
    expect(result).toContain('\x1b[1m');
  });

  it('renders h6 with bold + own color', () => {
    const result = render('###### Level 6');
    expect(stripAnsi(result)).toContain('Level 6');
    expect(result).toContain('\x1b[1m');
  });

  it('h2 visually differs from h1 (different ANSI codes)', () => {
    // Force colors on so the difference is observable
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearColorCache();
    try {
      const h1 = render('# Same Text');
      const h2 = render('## Same Text');
      // Same plain text
      expect(stripAnsi(h1)).toBe(stripAnsi(h2));
      // Different rendering (h1 uses gradient, h2 uses solid + underline)
      expect(h1).not.toBe(h2);
    } finally {
      delete process.env['FORCE_COLOR'];
      resetColorSupportCache();
      clearColorCache();
    }
  });

  it('h3, h4, h5, h6 each execute their distinct color branch', () => {
    // The goal of this test is to ensure every level 3-6 hits the switch
    // branch (lines 425-429). We force color on to observe the differences.
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearColorCache();
    try {
      const h3 = render('### Text');
      const h4 = render('#### Text');
      const h5 = render('##### Text');
      const h6 = render('###### Text');
      // All produce the same plain text
      expect(stripAnsi(h3)).toBe('Text');
      expect(stripAnsi(h4)).toBe('Text');
      expect(stripAnsi(h5)).toBe('Text');
      expect(stripAnsi(h6)).toBe('Text');
      // And each contains bold ANSI marker
      for (const r of [h3, h4, h5, h6]) {
        expect(r).toContain('\x1b[1m');
      }
      // The branch t[colorKey] should produce visible color differences
      // when FORCE_COLOR is active. We compare any two adjacent levels.
      expect(h3).not.toBe(h4);
      expect(h4).not.toBe(h5);
      expect(h5).not.toBe(h6);
    } finally {
      delete process.env['FORCE_COLOR'];
      resetColorSupportCache();
      clearColorCache();
    }
  });

  it('renders paragraph as plain text (with inline styling)', () => {
    const result = render('Just a sentence.');
    expect(stripAnsi(result)).toContain('Just a sentence.');
  });

  it('renders unordered list with bullets', () => {
    const result = render('- one\n- two');
    expect(stripAnsi(result)).toMatch(/[•·] one/);
    expect(stripAnsi(result)).toMatch(/[•·] two/);
  });

  it('renders ordered list with numeric markers', () => {
    const result = render('1. first\n2. second');
    expect(stripAnsi(result)).toContain('1. first');
    expect(stripAnsi(result)).toContain('2. second');
  });

  it('renders code block inside a box (default)', () => {
    const result = render('```js\nconst x = 1;\n```');
    expect(stripAnsi(result)).toContain('const x = 1;');
    // Should have box characters
    expect(stripAnsi(result)).toMatch(/[╭╮│╰╯]/);
  });

  it('renders code block as indented dim text when boxCodeBlocks=false', () => {
    const result = render('```\nfoo\n```', { boxCodeBlocks: false });
    expect(stripAnsi(result)).toContain('    foo');
  });

  it('renders empty code block as a single space (line 116 branch)', () => {
    // Empty code body → ' ' placeholder so ascii.box doesn't choke
    const result = render('```\n```');
    // Should render a box (rounded borders) with at least 1 inner line
    expect(stripAnsi(result)).toMatch(/[╭╮│╰╯]/);
  });

  it('renders code block without language label (line 118 branch)', () => {
    // No lang → title is null → no labeled top border
    const result = render('```\nplain\n```');
    const stripped = stripAnsi(result);
    expect(stripped).toContain('plain');
    // Top border should not contain a language label (no leading word)
    // since lang='' makes labeled = null
    expect(stripped).not.toMatch(/╭\s*\w+/);
  });

  it('renders code block WITH language label (line 118 alt branch)', () => {
    const result = render('```js\nfoo\n```');
    const stripped = stripAnsi(result);
    expect(stripped).toContain('js');   // language label in top border
    expect(stripped).toContain('foo');
  });

  it('renders blockquote with indent + dim', () => {
    const result = render('> wisdom');
    expect(stripAnsi(result)).toContain('wisdom');
    // Should contain the | prefix
    expect(stripAnsi(result)).toMatch(/[│|]/);
  });

  it('renders hr as a divider line', () => {
    const result = render('---');
    expect(stripAnsi(result)).toMatch(/─{3,}/);
  });

  it('renders table with header + rows', () => {
    const source = '| Name | Value |\n|---|---|\n| foo | 1 |\n| bar | 2 |';
    const result = render(source);
    expect(stripAnsi(result)).toContain('Name');
    expect(stripAnsi(result)).toContain('Value');
    expect(stripAnsi(result)).toContain('foo');
    expect(stripAnsi(result)).toContain('bar');
  });

  it('renders the full integration example', () => {
    const source = `# Welcome

This is **bold** and *italic* with \`code\` and [a link](https://example.com).

- Item 1
- Item 2

\`\`\`js
const x = 42;
\`\`\`

> Quoted wisdom

---

| Name | Value |
|---|---|
| foo | 1 |
`;
    const result = render(source);
    const plain = stripAnsi(result);
    expect(plain).toContain('Welcome');
    expect(plain).toContain('bold');
    expect(plain).toContain('italic');
    expect(plain).toContain('code');
    expect(plain).toContain('Item 1');
    expect(plain).toContain('const x = 42');
    expect(plain).toContain('Quoted wisdom');
    expect(plain).toContain('foo');
  });

  it('respects custom width option', () => {
    const result = render('# H1', { width: 40 });
    expect(stripAnsi(result)).toContain('H1');
  });

  it('clamps invalid width to default', () => {
    const result = render('# H1', { width: NaN });
    expect(stripAnsi(result)).toContain('H1');
  });

  it('clamps width too small to default', () => {
    const result = render('# H1', { width: 2 });
    expect(stripAnsi(result)).toContain('H1');
  });

  it('respects light theme', () => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearColorCache();
    try {
      const dark = render('# Title', { theme: 'dark' });
      const light = render('# Title', { theme: 'light' });
      // Different colors → different ANSI codes
      expect(dark).not.toBe(light);
      expect(stripAnsi(dark)).toBe(stripAnsi(light));
    } finally {
      delete process.env['FORCE_COLOR'];
      resetColorSupportCache();
      clearColorCache();
    }
  });

  it('respects custom heading gradient', () => {
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    clearColorCache();
    try {
      const a = render('# Title', { headingGradient: ['#ff0000', '#00ff00'] });
      const b = render('# Title');
      expect(stripAnsi(a)).toBe(stripAnsi(b));
      expect(a).not.toBe(b);   // different colors
    } finally {
      delete process.env['FORCE_COLOR'];
      resetColorSupportCache();
      clearColorCache();
    }
  });

  it('ignores invalid heading gradient (length < 2)', () => {
    const a = render('# Title', { headingGradient: ['#ff0000'] });   // only 1 → fallback
    const b = render('# Title');
    expect(a).toBe(b);   // same output
  });

  it('falls back to dark theme for invalid theme value', () => {
    // v1.4.11: `MarkdownTheme` now accepts any string (registered themes),
    // so an unknown name is no longer a *type* error — it is a runtime
    // fallback. Assert the fallback actually resolves to dark.
    const result = render('# Title', { theme: 'invalid' });
    expect(stripAnsi(result)).toContain('Title');
    expect(result).toBe(render('# Title', { theme: 'dark' }));
  });
});

// ─────────────────────────────────────────────
//  markdown namespace
// ─────────────────────────────────────────────

describe('markdown namespace (v1.4.0)', () => {
  it('exposes render, parseBlocks, parseInline', () => {
    expect(typeof markdown.render).toBe('function');
    expect(typeof markdown.parseBlocks).toBe('function');
    expect(typeof markdown.parseInline).toBe('function');
  });

  it('default export === named export', () => {
    expect(markdown.render).toBe(render);
    expect(markdown.parseBlocks).toBe(parseBlocks);
    expect(markdown.parseInline).toBe(parseInline);
  });
});

// ─────────────────────────────────────────────
//  Barrel re-exports
// ─────────────────────────────────────────────

describe('barrel — v1.4.0 markdown re-exports', () => {
  it('markdown + helpers accessible from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.markdown).toBe('object');
    expect(typeof main.renderMarkdown).toBe('function');
    expect(typeof main.parseMarkdownBlocks).toBe('function');
    expect(typeof main.parseMarkdownInline).toBe('function');
    // Smoke
    expect(main.renderMarkdown('# Hi')).toBe(main.markdown.render('# Hi'));
  });

  it('markdown is in the default export', async () => {
    const mod = await import('../index.js');
    const ansimax = mod.default;
    expect(typeof ansimax.markdown).toBe('object');
    expect(typeof ansimax.markdown.render).toBe('function');
  });
});

// ─────────────────────────────────────────────
//  v1.4.1 — Refactor verification
// ─────────────────────────────────────────────

describe('v1.4.1 — markdown refactor (file split)', () => {
  it('can import parseBlocks from block-parser submodule directly', async () => {
    const mod = await import('../markdown/block-parser.js');
    expect(typeof mod.parseBlocks).toBe('function');
    // Behavior identical to barrel import
    expect(mod.parseBlocks('# Hi')).toEqual(parseBlocks('# Hi'));
  });

  it('can import parseInline from inline-parser submodule directly', async () => {
    const mod = await import('../markdown/inline-parser.js');
    expect(typeof mod.parseInline).toBe('function');
    expect(mod.parseInline('hello')).toBe(parseInline('hello'));
  });

  it('can import render from renderer submodule directly', async () => {
    const mod = await import('../markdown/renderer.js');
    expect(typeof mod.render).toBe('function');
    expect(mod.render('# Hi')).toBe(render('# Hi'));
  });

  it('types re-exported from barrel match submodule types', async () => {
    // This is a compile-time check — if types don't match, tsc fails.
    const types = await import('../markdown/types.js');
    expect(types).toBeDefined();
  });
});

// ─────────────────────────────────────────────
//  v1.4.3 — CommonMark escapes
// ─────────────────────────────────────────────

describe('CommonMark escapes (v1.4.3)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  const opts = { theme: 'dark' as const, inlineCodeBackground: false };

  it('escapes asterisks (\\*) to prevent bold/italic', () => {
    const result = parseInline('\\*not bold\\*', opts);
    expect(result).toBe('*not bold*');
  });

  it('escapes underscores (\\_) to prevent italic', () => {
    const result = parseInline('\\_not italic\\_', opts);
    expect(result).toBe('_not italic_');
  });

  it('escapes backticks (\\`) to prevent code spans', () => {
    const result = parseInline('\\`not code\\`', opts);
    expect(result).toBe('`not code`');
  });

  it('escapes backslash itself (\\\\)', () => {
    const result = parseInline('a \\\\ b', opts);
    expect(result).toBe('a \\ b');
  });

  it('escapes tildes (\\~) to prevent strikethrough', () => {
    const result = parseInline('\\~~not strike\\~~', opts);
    expect(result).toBe('~~not strike~~');
  });

  it('escapes brackets (\\[, \\]) to prevent links', () => {
    const result = parseInline('\\[not a link\\](url)', opts);
    expect(result).toContain('[not a link](url)');
  });

  it('mixes escaped and real markup', () => {
    // \*escaped\* with **bold** in same line
    const result = parseInline('\\*literal\\* and **bold**', opts);
    const stripped = stripAnsi(result);
    expect(stripped).toBe('*literal* and bold');
    // Bold ANSI should still be present
    expect(result).toContain('\x1b[1m');
  });

  it('passes non-escapable chars through with backslash', () => {
    // \. is not in ESCAPABLE_CHARS → passes through as \.
    const result = parseInline('\\.not escaped', opts);
    expect(result).toContain('\\.');
  });

  it('escapes inside link labels work', () => {
    // [text with \* literal](url)
    const result = parseInline('[has \\* lit](https://x.com)', opts);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('has * lit');
  });

  it('escapes inside code span are restored literally', () => {
    // `text with \* literal` → code span keeps \* as-is or just *
    const result = parseInline('`a \\* b`', opts);
    const stripped = stripAnsi(result);
    // Should contain the literal * (escape restored inside code)
    expect(stripped).toContain('a * b');
  });
});

// ─────────────────────────────────────────────
//  v1.4.3 — Nested lists
// ─────────────────────────────────────────────

describe('Nested lists (v1.4.3)', () => {
  it('parses 2-level nested unordered list', () => {
    const src = '- Outer 1\n  - Nested 1.1\n  - Nested 1.2';
    const blocks = parseBlocks(src);
    expect(blocks.length).toBe(1);
    const list = blocks[0];
    expect(list?.type).toBe('list');
    if (list?.type !== 'list') return;
    expect(list.items.length).toBe(1);
    expect(list.items[0]?.text).toBe('Outer 1');
    expect(list.items[0]?.children?.items.length).toBe(2);
    expect(list.items[0]?.children?.items[0]?.text).toBe('Nested 1.1');
  });

  it('parses 3-level deep nesting', () => {
    const src = '- L1\n  - L2\n    - L3';
    const blocks = parseBlocks(src);
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    const l2 = list.items[0]?.children?.items[0];
    expect(l2?.text).toBe('L2');
    expect(l2?.children?.items[0]?.text).toBe('L3');
  });

  it('mixes ordered and unordered at different levels', () => {
    const src = '- Outer\n  1. Sub 1\n  2. Sub 2';
    const blocks = parseBlocks(src);
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.ordered).toBe(false);
    expect(list.items[0]?.children?.ordered).toBe(true);
  });

  it('multiple top-level items each with their own nesting', () => {
    const src = '- A\n  - A.1\n- B\n  - B.1';
    const blocks = parseBlocks(src);
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items.length).toBe(2);
    expect(list.items[0]?.children?.items[0]?.text).toBe('A.1');
    expect(list.items[1]?.children?.items[0]?.text).toBe('B.1');
  });

  it('handles tabs as 4-space indent (CommonMark §5.2)', () => {
    const src = '- Outer\n\t- Tabbed nested';
    const blocks = parseBlocks(src);
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items[0]?.children?.items[0]?.text).toBe('Tabbed nested');
  });

  it('breaks at ordering mismatch within same indent (line 238)', () => {
    // Unordered list followed by ordered item at SAME indent → second list
    // is a separate block, not appended to the first.
    const src = '- one\n- two\n1. numbered';
    const blocks = parseBlocks(src);
    // Two separate lists
    expect(blocks.length).toBe(2);
    const first = blocks[0];
    const second = blocks[1];
    if (first?.type !== 'list' || second?.type !== 'list') {
      throw new Error('expected two lists');
    }
    expect(first.ordered).toBe(false);
    expect(first.items.length).toBe(2);
    expect(second.ordered).toBe(true);
    expect(second.items.length).toBe(1);
  });

  it('renders nested lists with depth-aware bullets', () => {
    const src = '- Outer\n  - Nested';
    const result = render(src);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('Outer');
    expect(stripped).toContain('Nested');
    // Nested should be indented more than outer
    const outerLine = stripped.split('\n').find((l) => l.includes('Outer')) as string;
    const nestedLine = stripped.split('\n').find((l) => l.includes('Nested')) as string;
    expect(nestedLine.indexOf('Nested')).toBeGreaterThan(outerLine.indexOf('Outer'));
  });

  it('renders ordered nested list with numbered markers', () => {
    const src = '1. First\n2. Second\n   1. Sub';
    const result = render(src);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('1. First');
    expect(stripped).toContain('2. Second');
    expect(stripped).toContain('1. Sub');
  });

  it('uses different bullet chars at different depths', () => {
    // Level 0: •  Level 1: ◦  Level 2: ▪  Level 3: ▫
    const src = '- L0\n  - L1\n    - L2\n      - L3';
    const result = render(src);
    const stripped = stripAnsi(result);
    // Each level should use a different bullet
    expect(stripped).toContain('•');   // L0
    expect(stripped).toContain('◦');   // L1
  });
});

// ─────────────────────────────────────────────
//  v1.4.4 — Task lists (GFM)
// ─────────────────────────────────────────────

describe('Task lists (v1.4.4)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('parses unchecked task item ([ ])', () => {
    const blocks = parseBlocks('- [ ] buy milk');
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items[0]?.text).toBe('buy milk');
    expect(list.items[0]?.checked).toBe(false);
  });

  it('parses checked task item ([x])', () => {
    const blocks = parseBlocks('- [x] shipped');
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items[0]?.checked).toBe(true);
    expect(list.items[0]?.text).toBe('shipped');
  });

  it('accepts uppercase [X] for checked', () => {
    const blocks = parseBlocks('- [X] done');
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items[0]?.checked).toBe(true);
  });

  it('regular item has checked=undefined', () => {
    const blocks = parseBlocks('- plain item');
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items[0]?.checked).toBeUndefined();
  });

  it('mixed regular and task items in same list', () => {
    const blocks = parseBlocks('- regular\n- [ ] todo\n- [x] done\n- another regular');
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items.length).toBe(4);
    expect(list.items[0]?.checked).toBeUndefined();
    expect(list.items[1]?.checked).toBe(false);
    expect(list.items[2]?.checked).toBe(true);
    expect(list.items[3]?.checked).toBeUndefined();
  });

  it('nested task lists work', () => {
    const src = '- [ ] outer todo\n  - [x] nested done';
    const blocks = parseBlocks(src);
    const list = blocks[0];
    if (list?.type !== 'list') throw new Error('expected list');
    expect(list.items[0]?.checked).toBe(false);
    expect(list.items[0]?.children?.items[0]?.checked).toBe(true);
  });

  it('renders checkbox for task items', () => {
    const result = render('- [ ] pending\n- [x] done');
    const stripped = stripAnsi(result);
    expect(stripped).toContain('[ ]');
    expect(stripped).toContain('[✓]');
    expect(stripped).toContain('pending');
    expect(stripped).toContain('done');
  });

  it('renders regular bullets when checked is undefined', () => {
    const result = render('- regular item');
    const stripped = stripAnsi(result);
    expect(stripped).toContain('•');
    expect(stripped).toContain('regular item');
  });
});

// ─────────────────────────────────────────────
//  v1.4.4 — Setext headings
// ─────────────────────────────────────────────

describe('Setext headings (v1.4.4)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('parses h1 with === underline', () => {
    const blocks = parseBlocks('Title\n===');
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toEqual({ type: 'heading', level: 1, text: 'Title' });
  });

  it('parses h2 with --- underline', () => {
    const blocks = parseBlocks('Subtitle\n---');
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toEqual({ type: 'heading', level: 2, text: 'Subtitle' });
  });

  it('accepts extended underlines (=========, ---------)', () => {
    const h1 = parseBlocks('X\n=====');
    const h2 = parseBlocks('X\n-----');
    expect(h1[0]).toMatchObject({ type: 'heading', level: 1 });
    expect(h2[0]).toMatchObject({ type: 'heading', level: 2 });
  });

  it('accepts leading whitespace on underline', () => {
    const blocks = parseBlocks('Title\n  ===  ');
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
  });

  it('treats standalone --- as HR (not setext)', () => {
    const blocks = parseBlocks('---');
    expect(blocks[0]).toEqual({ type: 'hr' });
  });

  it('treats blank line + --- as blank + HR', () => {
    const blocks = parseBlocks('\n---');
    expect(blocks[0]).toEqual({ type: 'blank' });
    expect(blocks[1]).toEqual({ type: 'hr' });
  });

  it('treats paragraph + blank + --- as separate (not setext)', () => {
    // Blank line between → not a setext heading
    const blocks = parseBlocks('foo\n\n---');
    expect(blocks.some((b) => b.type === 'paragraph')).toBe(true);
    expect(blocks.some((b) => b.type === 'hr')).toBe(true);
  });

  it('does not confuse setext with list markers', () => {
    // `- item\n---` should be list + hr, not h2 titled '- item'
    const blocks = parseBlocks('- item\n---');
    // First is a list
    expect(blocks[0]?.type).toBe('list');
  });

  it('renders setext h1 with same visual as ATX h1', () => {
    const setext = render('Title\n===');
    const atx = render('# Title');
    // Same stripped content (text-only comparison)
    expect(stripAnsi(setext)).toBe(stripAnsi(atx));
  });

  it('renders setext h2 with same visual as ATX h2', () => {
    const setext = render('Sub\n---');
    const atx = render('## Sub');
    expect(stripAnsi(setext)).toBe(stripAnsi(atx));
  });
});

// ─────────────────────────────────────────────
//  v1.4.5 — Syntax highlighting in code blocks
// ─────────────────────────────────────────────

describe('markdown.render with syntax highlighting (v1.4.5)', () => {
  beforeEach(() => {
    setNoColor(false);
    process.env.FORCE_COLOR = '3';
    resetColorSupportCache();
    clearColorCache();
  });
  afterEach(() => {
    resetNoColor();
    delete process.env.FORCE_COLOR;
    resetColorSupportCache();
    clearColorCache();
  });

  it('highlights js code block content', () => {
    const src = '```js\nconst x = 42;\n```';
    const result = render(src);
    // Stripped should preserve the code
    const stripped = stripAnsi(result);
    expect(stripped).toContain('const x = 42;');
    // Should contain bold ANSI for the 'const' keyword
    expect(result).toContain('\x1b[1m');
  });

  it('does not highlight when language is unsupported', () => {
    const src = '```rust\nfn main() { }\n```';
    const result = render(src);
    // Should contain the raw code
    expect(stripAnsi(result)).toContain('fn main() { }');
  });

  it('does not highlight when language is missing', () => {
    const src = '```\nplain text\n```';
    const result = render(src);
    expect(stripAnsi(result)).toContain('plain text');
  });

  it('highlights json code block', () => {
    const src = '```json\n{"name": "x"}\n```';
    const result = render(src);
    expect(stripAnsi(result)).toContain('{"name": "x"}');
    // JSON has strings colored
    expect(result).toMatch(/\x1b\[/);
  });

  it('highlights bash code block', () => {
    const src = '```bash\n# comment\necho hi\n```';
    const result = render(src);
    expect(stripAnsi(result)).toContain('# comment');
    expect(stripAnsi(result)).toContain('echo hi');
  });

  it('works with boxCodeBlocks=false (indented mode)', () => {
    const src = '```js\nconst x = 1;\n```';
    const result = render(src, { boxCodeBlocks: false });
    // Indented mode: 4 spaces prefix
    expect(stripAnsi(result)).toContain('    const x = 1;');
    // Highlighting still applied (bold for const)
    expect(result).toContain('\x1b[1m');
  });
});

// ─────────────────────────────────────────────
//  v1.4.6 — Autolinks
// ─────────────────────────────────────────────

describe('Autolinks (v1.4.6)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  const opts = { theme: 'dark' as const, inlineCodeBackground: false };

  it('renders angle-bracket autolink <https://…>', () => {
    const result = parseInline('<https://example.com>', opts);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('https://example.com');
    // Should contain hyperlink OSC 8 escape or underline
    expect(result).toMatch(/\x1b\[/);
  });

  it('renders bare URL', () => {
    const result = parseInline('visit https://example.com today', opts);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('https://example.com');
    expect(stripped).toContain('visit');
    expect(stripped).toContain('today');
  });

  it('excludes trailing sentence punctuation from bare URL', () => {
    const result = parseInline('see https://example.com.', opts);
    const stripped = stripAnsi(result);
    // The period should be outside the link
    expect(stripped).toContain('https://example.com');
    expect(stripped.endsWith('.')).toBe(true);
  });

  it('does not double-process [label](url) as autolink', () => {
    const result = parseInline('[click](https://example.com)', opts);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('click');
    // URL should not appear as visible text (it's the href)
    expect(stripped).not.toContain('https://example.com');
  });

  it('preserves underscores in URL path (no italic mangling)', () => {
    const result = parseInline('https://example.com/foo_bar_baz', opts);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('foo_bar_baz');
  });

  it('handles http as well as https', () => {
    const result = parseInline('<http://example.com>', opts);
    expect(stripAnsi(result)).toContain('http://example.com');
  });

  it('leaves non-URL text unchanged', () => {
    const result = parseInline('just plain text', opts);
    expect(stripAnsi(result)).toBe('just plain text');
  });
});

// ─────────────────────────────────────────────
//  v1.4.7 — Reference-style links
// ─────────────────────────────────────────────

import { collectLinkRefs, normalizeRefLabel } from '../markdown/block-parser.js';

describe('collectLinkRefs (v1.4.7)', () => {
  it('collects a simple definition', () => {
    const { refs } = collectLinkRefs('[ref]: https://example.com');
    expect(refs.get('ref')?.url).toBe('https://example.com');
  });

  it('collects definition with title', () => {
    const { refs } = collectLinkRefs('[ref]: https://example.com "My Title"');
    expect(refs.get('ref')?.url).toBe('https://example.com');
    expect(refs.get('ref')?.title).toBe('My Title');
  });

  it('removes definition lines from cleaned source', () => {
    const { cleaned } = collectLinkRefs('text\n[ref]: https://example.com\nmore');
    expect(cleaned).not.toContain('[ref]:');
    expect(cleaned).toContain('text');
    expect(cleaned).toContain('more');
  });

  it('normalizes labels (case-insensitive, whitespace-collapse)', () => {
    const { refs } = collectLinkRefs('[My  Ref]: https://example.com');
    expect(refs.get('my ref')?.url).toBe('https://example.com');
  });

  it('first definition wins on duplicates', () => {
    const { refs } = collectLinkRefs('[r]: https://first.com\n[r]: https://second.com');
    expect(refs.get('r')?.url).toBe('https://first.com');
  });

  it('handles empty input', () => {
    const { refs, cleaned } = collectLinkRefs('');
    expect(refs.size).toBe(0);
    expect(cleaned).toBe('');
  });
});

describe('normalizeRefLabel (v1.4.7)', () => {
  it('lowercases and trims', () => {
    expect(normalizeRefLabel('  Foo Bar  ')).toBe('foo bar');
  });
  it('collapses internal whitespace', () => {
    expect(normalizeRefLabel('a   b\tc')).toBe('a b c');
  });
});

describe('reference links rendering (v1.4.7)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('resolves full reference form [text][ref]', () => {
    const src = 'See [the docs][ref].\n\n[ref]: https://example.com';
    const result = render(src);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('the docs');
    // Definition line should not render
    expect(stripped).not.toContain('[ref]:');
  });

  it('resolves shortcut form [ref]', () => {
    const src = 'Visit [example].\n\n[example]: https://example.com';
    const result = render(src);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('example');
    expect(stripped).not.toContain('https://example.com');
  });

  it('resolves collapsed form [text][]', () => {
    const src = 'See [example][].\n\n[example]: https://example.com';
    const result = render(src);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('example');
  });

  it('leaves unresolved references as literal text', () => {
    const src = 'See [missing][nope].';
    const result = render(src);
    const stripped = stripAnsi(result);
    // No matching definition → literal brackets preserved
    expect(stripped).toContain('[missing][nope]');
  });

  it('is case-insensitive for reference matching', () => {
    const src = 'See [Docs][REF].\n\n[ref]: https://example.com';
    const result = render(src);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('Docs');
    expect(stripped).not.toContain('[Docs]');
  });

  it('inline [](url) links still take priority', () => {
    const src = 'A [direct](https://direct.com) link.\n\n[direct]: https://ref.com';
    const result = render(src);
    const stripped = stripAnsi(result);
    expect(stripped).toContain('direct');
  });
});

// ─────────────────────────────────────────────
//  v1.4.11 — Phase 4 closure: theme registry, footnotes, HTML blocks
// ─────────────────────────────────────────────

import {
  registerMarkdownTheme, unregisterMarkdownTheme, listMarkdownThemes,
  hasMarkdownTheme, clearMarkdownThemes, collectFootnotes,
} from '../markdown/index.js';
import { resolveTheme } from '../markdown/theme.js';

const VALID_PALETTE = {
  h1: ['#b58900', '#cb4b16'],
  h2: '#cb4b16', h3: '#d33682', h4: '#6c71c4',
  h5: '#268bd2', h6: '#2aa198',
  code: '#b58900', codeBlockBorder: '#586e75',
  link: '#268bd2', blockquote: '#586e75',
  hr: '#586e75', tableHeader: '#cb4b16',
};

describe('markdown theme registry (v1.4.11)', () => {
  afterEach(() => clearMarkdownThemes());

  it('registers and resolves a custom theme', () => {
    registerMarkdownTheme('solarized', VALID_PALETTE);
    expect(hasMarkdownTheme('solarized')).toBe(true);
    expect(resolveTheme('solarized').h2).toBe('#cb4b16');
  });

  it('normalizes the name (trim + lowercase)', () => {
    registerMarkdownTheme('  MyTheme  ', VALID_PALETTE);
    expect(hasMarkdownTheme('mytheme')).toBe(true);
    expect(hasMarkdownTheme('MYTHEME')).toBe(true);
  });

  it('lists built-ins first, then registered themes', () => {
    registerMarkdownTheme('custom', VALID_PALETTE);
    const list = listMarkdownThemes();
    expect(list[0]).toBe('dark');
    expect(list[1]).toBe('light');
    expect(list).toContain('custom');
  });

  it('protects built-in names unless force is set', () => {
    expect(() => registerMarkdownTheme('dark', VALID_PALETTE)).toThrow(/built-in/);
    expect(() => registerMarkdownTheme('dark', VALID_PALETTE, { force: true })).not.toThrow();
  });

  it('unregister removes only registered themes', () => {
    registerMarkdownTheme('temp', VALID_PALETTE);
    expect(unregisterMarkdownTheme('temp')).toBe(true);
    expect(hasMarkdownTheme('temp')).toBe(false);
    // Built-ins survive and stay resolvable
    expect(hasMarkdownTheme('dark')).toBe(true);
  });

  it('unregister returns false for unknown / non-string', () => {
    expect(unregisterMarkdownTheme('nope')).toBe(false);
    expect(unregisterMarkdownTheme(42 as unknown as string)).toBe(false);
  });

  it('hasMarkdownTheme is false for unknown and non-string', () => {
    expect(hasMarkdownTheme('nope')).toBe(false);
    expect(hasMarkdownTheme(null as unknown as string)).toBe(false);
  });

  it('unknown theme names fall back to dark instead of throwing', () => {
    const fallback = resolveTheme('does-not-exist');
    expect(fallback).toEqual(resolveTheme('dark'));
    expect(resolveTheme(undefined)).toEqual(resolveTheme('dark'));
  });

  it('rejects an invalid name', () => {
    expect(() => registerMarkdownTheme('', VALID_PALETTE)).toThrow(TypeError);
    expect(() => registerMarkdownTheme('   ', VALID_PALETTE)).toThrow(TypeError);
  });

  it('rejects a non-object palette', () => {
    expect(() => registerMarkdownTheme('x', null as never)).toThrow(/must be an object/);
    expect(() => registerMarkdownTheme('x', [] as never)).toThrow(/got array/);
  });

  it('rejects a bad h1 gradient', () => {
    expect(() => registerMarkdownTheme('x', { ...VALID_PALETTE, h1: ['#fff'] }))
      .toThrow(/2\+ hex colors/);
    expect(() => registerMarkdownTheme('x', { ...VALID_PALETTE, h1: ['#fff', 'nope'] }))
      .toThrow(/h1\[1\]/);
  });

  it('rejects a non-hex solid color, naming the key', () => {
    expect(() => registerMarkdownTheme('x', { ...VALID_PALETTE, link: 'blue' }))
      .toThrow(/link is not a hex color/);
  });

  it('render accepts a registered theme name', () => {
    setNoColor(false);
    registerMarkdownTheme('solarized', VALID_PALETTE);
    const out = render('# Title', { theme: 'solarized' });
    expect(stripAnsi(out)).toContain('Title');
    resetNoColor();
  });
});

describe('footnotes (v1.4.11)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('collects definitions and strips them from the source', () => {
    const { defs, cleaned } = collectFootnotes('Text [^a].\n\n[^a]: the note');
    expect(defs.get('a')).toBe('the note');
    expect(cleaned).not.toContain('[^a]: ');
    expect(cleaned).toContain('Text [^a].');
  });

  it('first definition wins on duplicates', () => {
    const { defs } = collectFootnotes('[^a]: first\n[^a]: second');
    expect(defs.get('a')).toBe('first');
  });

  it('normalizes labels (case + whitespace)', () => {
    const { defs } = collectFootnotes('[^My  Note]: text');
    expect(defs.get('my note')).toBe('text');
  });

  it('handles empty input', () => {
    const { defs, cleaned } = collectFootnotes('');
    expect(defs.size).toBe(0);
    expect(cleaned).toBe('');
  });

  it('numbers by FIRST REFERENCE order, not definition order', () => {
    // 'z' is defined first but 'a' is referenced first → a=[1], z=[2]
    const src = 'See [^a] then [^z].\n\n[^z]: zulu\n[^a]: alpha';
    const stripped = stripAnsi(render(src));
    expect(stripped).toContain('See [1] then [2].');
    // The footnote section lists alpha first
    const alphaPos = stripped.indexOf('alpha');
    const zuluPos = stripped.indexOf('zulu');
    expect(alphaPos).toBeGreaterThan(-1);
    expect(alphaPos).toBeLessThan(zuluPos);
  });

  it('repeated references reuse the same number', () => {
    const src = 'A [^n] and again [^n].\n\n[^n]: note';
    const stripped = stripAnsi(render(src));
    expect((stripped.match(/\[1\]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('renders a footnote section with the definition text', () => {
    const stripped = stripAnsi(render('Cite [^src].\n\n[^src]: Knuth, 1984'));
    expect(stripped).toContain('Knuth, 1984');
  });

  it('leaves undefined footnote references as literal text', () => {
    const stripped = stripAnsi(render('Missing [^nope] here.'));
    expect(stripped).toContain('[^nope]');
  });

  it('emits no section when nothing is referenced', () => {
    const stripped = stripAnsi(render('Plain text.\n\n[^unused]: never cited'));
    expect(stripped).not.toContain('never cited');
    expect(stripped.trim()).toBe('Plain text.');
  });

  it('does not confuse a footnote definition with a link reference', () => {
    // Single-word definitions used to be swallowed by LINK_REF_DEF_RE
    const stripped = stripAnsi(render('See [^a].\n\n[^a]: Note'));
    expect(stripped).toContain('[1]');
    expect(stripped).toContain('Note');
  });

  it('coexists with reference links', () => {
    const src = 'A [link][r] and a [^f].\n\n[r]: https://example.com\n[^f]: footnote';
    const stripped = stripAnsi(render(src));
    expect(stripped).toContain('link');
    expect(stripped).toContain('[1]');
    expect(stripped).toContain('footnote');
  });
});

describe('HTML blocks (v1.4.11)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('parses an HTML block', () => {
    const blocks = parseBlocks('<div>hello</div>');
    expect(blocks[0]?.type).toBe('html');
  });

  it('strips tags by default, keeping the text', () => {
    const stripped = stripAnsi(render('<div>hello world</div>'));
    expect(stripped).toContain('hello world');
    expect(stripped).not.toContain('<div>');
  });

  it('htmlMode raw prints the markup verbatim', () => {
    const stripped = stripAnsi(render('<div>x</div>', { htmlMode: 'raw' }));
    expect(stripped).toContain('<div>x</div>');
  });

  it('htmlMode hide drops the block entirely', () => {
    const stripped = stripAnsi(render('before\n\n<div>x</div>\n\nafter', { htmlMode: 'hide' }));
    expect(stripped).toContain('before');
    expect(stripped).toContain('after');
    expect(stripped).not.toContain('x</div>');
  });

  it('removes HTML comments when stripping', () => {
    const stripped = stripAnsi(render('<!-- a comment -->'));
    expect(stripped).not.toContain('comment');
  });

  it('handles multi-line blocks up to a blank line', () => {
    const blocks = parseBlocks('<details>\n<summary>More</summary>\n</details>\n\nafter');
    expect(blocks[0]?.type).toBe('html');
    const para = blocks.find((b) => b.type === 'paragraph');
    expect(para).toBeDefined();
  });

  it('does not treat inline < as an HTML block', () => {
    const blocks = parseBlocks('5 < 6 is true');
    expect(blocks[0]?.type).toBe('paragraph');
  });

  it('leaves HTML inside fenced code blocks untouched', () => {
    const blocks = parseBlocks('```html\n<div>x</div>\n```');
    expect(blocks[0]?.type).toBe('codeblock');
  });
});

describe('v1.4.11 — barrel re-exports', () => {
  afterEach(() => clearMarkdownThemes());

  it('theme registry + footnotes exported from main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.registerMarkdownTheme).toBe('function');
    expect(typeof main.unregisterMarkdownTheme).toBe('function');
    expect(typeof main.listMarkdownThemes).toBe('function');
    expect(typeof main.hasMarkdownTheme).toBe('function');
    expect(typeof main.clearMarkdownThemes).toBe('function');
    expect(typeof main.collectFootnotes).toBe('function');
  });

  it('available on the markdown namespace', () => {
    expect(typeof markdown.registerTheme).toBe('function');
    expect(typeof markdown.listThemes).toBe('function');
    expect(typeof markdown.hasTheme).toBe('function');
    expect(typeof markdown.collectFootnotes).toBe('function');
    markdown.registerTheme('ns-theme', VALID_PALETTE);
    expect(markdown.hasTheme('ns-theme')).toBe(true);
  });
});

// ─────────────────────────────────────────────
//  v1.4.11 — Regression guards found in self-review
// ─────────────────────────────────────────────

describe('v1.4.11 regressions', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('an autolink on its own line is NOT parsed as an HTML block', () => {
    // The HTML-block start condition matches `<tag`; without the
    // `(?=[\s/>])` lookahead, `<https://…>` would match too and the
    // autolink from v1.4.6 would silently stop working.
    const blocks = parseBlocks('<https://example.com>');
    expect(blocks[0]?.type).toBe('paragraph');

    const stripped = stripAnsi(render('<https://example.com>'));
    expect(stripped).toContain('example.com');
    expect(stripped).not.toContain('<https');
  });

  it('http and ftp autolinks are equally unaffected', () => {
    expect(parseBlocks('<http://x.com>')[0]?.type).toBe('paragraph');
    expect(parseBlocks('<ftp://files.org>')[0]?.type).toBe('paragraph');
  });

  it('tags with attributes are still detected as HTML', () => {
    expect(parseBlocks('<p class="note">x</p>')[0]?.type).toBe('html');
    expect(parseBlocks('<!DOCTYPE html>')[0]?.type).toBe('html');
  });

  it('a footnote citing another footnote resolves both and terminates', () => {
    const src = 'Start [^a].\n\n[^a]: see [^b]\n[^b]: the end';
    const stripped = stripAnsi(render(src));
    expect(stripped).toContain('[1]');
    expect(stripped).toContain('[2]');
    expect(stripped).toContain('the end');
  });

  it('mutually-referencing footnotes do not loop forever', () => {
    const src = 'Go [^a].\n\n[^a]: see [^b]\n[^b]: see [^a]';
    const stripped = stripAnsi(render(src));
    // Both get a number, and rendering completes
    expect(stripped).toContain('[1]');
    expect(stripped).toContain('[2]');
  });
});

describe('HTML block-level paragraph interruption (v1.4.11)', () => {
  it('a block-level tag interrupts an open paragraph', () => {
    const blocks = parseBlocks('some text\n<div>markup</div>');
    expect(blocks[0]?.type).toBe('paragraph');
    expect(blocks[1]?.type).toBe('html');
  });

  it('an inline tag does NOT interrupt (CommonMark type 7)', () => {
    const blocks = parseBlocks('some text\n<span>inline</span>');
    // Stays a single paragraph
    expect(blocks.filter((b) => b.type === 'html').length).toBe(0);
    expect(blocks[0]?.type).toBe('paragraph');
  });

  it('an unknown/custom element does not interrupt either', () => {
    const blocks = parseBlocks('text\n<custom-el>x</custom-el>');
    expect(blocks.filter((b) => b.type === 'html').length).toBe(0);
  });

  it('a closing block tag also interrupts', () => {
    const blocks = parseBlocks('text\n</p>');
    expect(blocks[1]?.type).toBe('html');
  });

  it('tag matching is case-insensitive', () => {
    expect(parseBlocks('text\n<DIV>x</DIV>')[1]?.type).toBe('html');
  });
});

// ─────────────────────────────────────────────
//  v1.4.11 — "defined but unmatched" branches
//
//  Both the footnote and reference-link resolvers are wrapped in a
//  `size > 0` guard, so a document with NO definitions skips the block
//  entirely and never reaches the "this label has no definition" branch.
//  These cases supply at least one definition AND cite a different,
//  undefined label, which is the only way in.
// ─────────────────────────────────────────────

describe('unmatched labels alongside real definitions (v1.4.11)', () => {
  beforeEach(() => setNoColor(false));
  afterEach(() => resetNoColor());

  it('an undefined footnote stays literal while a defined one resolves', () => {
    const src = 'Missing [^nope] but [^real] works.\n\n[^real]: exists';
    const stripped = stripAnsi(render(src));
    expect(stripped).toContain('[^nope]');   // untouched
    expect(stripped).toContain('[1]');       // the defined one got numbered
    expect(stripped).toContain('exists');    // and its section rendered
  });

  it('an unresolved full reference link stays literal alongside a resolved one', () => {
    const src = 'See [text][nope] and [ok][real].\n\n[real]: https://example.com';
    const stripped = stripAnsi(render(src));
    expect(stripped).toContain('[text][nope]');   // literal
    expect(stripped).toContain('ok');             // resolved label text
  });

  it('an unresolved shortcut reference stays literal alongside a resolved one', () => {
    const src = 'See [nope] and [real].\n\n[real]: https://example.com';
    const stripped = stripAnsi(render(src));
    expect(stripped).toContain('[nope]');   // literal
    expect(stripped).toContain('real');     // resolved
  });

  it('a collapsed reference with no definition stays literal', () => {
    const src = 'See [nope][] and [real][].\n\n[real]: https://example.com';
    const stripped = stripAnsi(render(src));
    expect(stripped).toContain('[nope][]');
    expect(stripped).toContain('real');
  });
});

describe('markdown barrel named re-exports (v1.4.11)', () => {
  afterEach(() => clearMarkdownThemes());

  it('resolveTheme is reachable by name from the markdown barrel', async () => {
    // The `markdown` namespace is assembled from separate import
    // statements, so using it does NOT exercise the
    // `export { … resolveTheme } from './theme.js'` line. Importing the
    // binding by name from the barrel is what covers it.
    const barrel = await import('../markdown/index.js');
    expect(typeof barrel.resolveTheme).toBe('function');

    // Exercise it for real, not just typeof
    expect(barrel.resolveTheme('dark').h2).toBe('#bd93f9');
    expect(barrel.resolveTheme('light').h2).toBe('#6f42c1');
    expect(barrel.resolveTheme('unknown-name')).toEqual(barrel.resolveTheme('dark'));

    // And that it sees runtime registrations
    barrel.registerMarkdownTheme('barrel-theme', VALID_PALETTE);
    expect(barrel.resolveTheme('barrel-theme').h2).toBe('#cb4b16');
  });

  it('resolveTheme is also on the markdown namespace', () => {
    expect(typeof markdown.resolveTheme).toBe('function');
    expect(markdown.resolveTheme('dark').link).toBe('#8be9fd');
  });

  it('the parsing helpers are reachable by name from the barrel too', async () => {
    // Same reasoning as above: elsewhere these are imported straight from
    // './block-parser.js', which leaves the barrel's re-export bindings
    // unexercised.
    const barrel = await import('../markdown/index.js');
    expect(typeof barrel.parseBlocks).toBe('function');
    expect(typeof barrel.collectLinkRefs).toBe('function');
    expect(typeof barrel.normalizeRefLabel).toBe('function');
    expect(typeof barrel.collectFootnotes).toBe('function');

    // Exercise each one so the binding is genuinely used
    expect(barrel.parseBlocks('# H')[0]?.type).toBe('heading');
    expect(barrel.collectLinkRefs('[r]: https://x.com').refs.get('r')?.url)
      .toBe('https://x.com');
    expect(barrel.normalizeRefLabel('  My  Ref ')).toBe('my ref');
    expect(barrel.collectFootnotes('[^a]: note').defs.get('a')).toBe('note');
  });
});
