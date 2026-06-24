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
      items: ['item 1', 'item 2', 'item 3'],
    });
  });

  it('parses ordered lists', () => {
    const blocks = parseBlocks('1. one\n2. two\n3. three');
    expect(blocks[0]).toEqual({
      type: 'list',
      ordered: true,
      items: ['one', 'two', 'three'],
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
    // @ts-expect-error testing invalid theme
    const result = render('# Title', { theme: 'invalid' });
    expect(stripAnsi(result)).toContain('Title');
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
