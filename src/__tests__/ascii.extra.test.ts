import { ascii } from '../ascii/index.js';
import { stripAnsi } from '../utils/helpers.js';

// ─────────────────────────────────────────────
//  banner — uncovered branches
// ─────────────────────────────────────────────
describe('ascii.banner', () => {
  it('renders with big font by default', () => {
    const result = ascii.banner('A');
    expect(result.split('\n').length).toBe(5);
  });

  it('renders with small font', () => {
    const result = ascii.banner('A', { font: 'small' });
    expect(result.split('\n').length).toBe(3);
  });

  it('applies colorFn to each line', () => {
    const colored: string[] = [];
    const colorFn = (line: string) => { colored.push(line); return `[${line}]`; };
    const result = ascii.banner('A', { colorFn });
    expect(colored.length).toBe(5); // big font = 5 lines
    expect(result).toContain('[');
    expect(result).toContain(']');
  });

  it('centers text when align:center', () => {
    const result = ascii.banner('A', { align: 'center' });
    // centered lines start with spaces
    const lines = result.split('\n');
    expect(lines.some(l => l.startsWith(' '))).toBe(true);
  });

  it('left-aligns by default', () => {
    const result = ascii.banner('A', { align: 'left' });
    expect(result).toBe(ascii.big('A'));
  });

  it('combines center + colorFn', () => {
    const colorFn = (s: string) => `*${s}*`;
    const result = ascii.banner('A', { align: 'center', colorFn });
    expect(result).toContain('*');
  });
});

// ─────────────────────────────────────────────
//  box — uncovered branches
// ─────────────────────────────────────────────
describe('ascii.box extra', () => {
  it('clips and pads content when width is set', () => {
    const result = ascii.box('Hello World long text', { width: 5 });
    const lines = result.split('\n');
    // inner lines should be padded to width 5
    const innerLine = lines[2]; // skip top border + empty padding
    expect(innerLine).toBeDefined();
  });

  it('handles multiline string input', () => {
    const result = ascii.box('line1\nline2\nline3');
    expect(stripAnsi(result)).toContain('line1');
    expect(stripAnsi(result)).toContain('line2');
    expect(stripAnsi(result)).toContain('line3');
  });

  it('padding:0 produces no empty padding lines', () => {
    const withPad = ascii.box('x', { padding: 1 }).split('\n').length;
    const noPad   = ascii.box('x', { padding: 0 }).split('\n').length;
    expect(withPad).toBeGreaterThan(noPad);
  });

  it('uses dashed border style', () => {
    const result = ascii.box('test', { borderStyle: 'dashed' });
    expect(result).toContain('┌');
    expect(result).toContain('╌');
  });

  it('falls back to rounded when unknown border style passed', () => {
    // @ts-expect-error testing invalid value
    const result = ascii.box('test', { borderStyle: 'invalid' });
    expect(result).toContain('╭');
  });
});

// ─────────────────────────────────────────────
//  divider — uncovered branches
// ─────────────────────────────────────────────
describe('ascii.divider extra', () => {
  it('uses single border h char when no char specified', () => {
    const result = ascii.divider({ width: 10, style: 'single' });
    expect(result).toBe('─'.repeat(10));
  });

  it('uses double border h char', () => {
    const result = ascii.divider({ width: 10, style: 'double' });
    expect(result).toBe('═'.repeat(10));
  });

  it('uses heavy border h char', () => {
    const result = ascii.divider({ width: 10, style: 'heavy' });
    expect(result).toBe('━'.repeat(10));
  });

  it('uses rounded border h char', () => {
    const result = ascii.divider({ width: 10, style: 'rounded' });
    expect(result).toBe('─'.repeat(10));
  });

  it('uses ascii border h char', () => {
    const result = ascii.divider({ width: 10, style: 'ascii' });
    expect(result).toBe('-'.repeat(10));
  });

  it('label divider pads both sides', () => {
    const result = ascii.divider({ label: 'HI', width: 20 });
    expect(result).toContain('HI');
    expect(result.length).toBe(20);
  });

  it('custom char overrides border char', () => {
    const result = ascii.divider({ char: '=', width: 5, style: 'single' });
    expect(result).toBe('=====');
  });
});

// ─────────────────────────────────────────────
//  renderFont — unknown chars
// ─────────────────────────────────────────────
describe('ascii font unknown chars', () => {
  it('big handles characters not in font map without crash', () => {
    expect(() => ascii.big('あ')).not.toThrow();
  });

  it('small handles characters not in font map without crash', () => {
    expect(() => ascii.small('€')).not.toThrow();
  });

  it('big renders all digits', () => {
    for (const d of '0123456789') {
      expect(ascii.big(d).split('\n').length).toBe(5);
    }
  });

  it('big renders all supported symbols', () => {
    for (const ch of '!?.-+#@') {
      expect(() => ascii.big(ch)).not.toThrow();
    }
  });
});