import { createScreen, SCREEN_SEQUENCES } from '../screen/index.js';

// Capture output instead of writing to a real terminal, and never install
// process signal handlers in tests.
const makeScreen = () => {
  const out: string[] = [];
  const screen = createScreen({ out: (s) => out.push(s), installSignalHandlers: false });
  return { screen, out, joined: () => out.join('') };
};

describe('createScreen (v1.7.0)', () => {
  it('starts inactive', () => {
    const { screen } = makeScreen();
    expect(screen.isActive()).toBe(false);
  });

  it('enter switches to the alternate buffer, hides cursor, and clears', () => {
    const { screen, joined } = makeScreen();
    screen.enter();
    expect(screen.isActive()).toBe(true);
    const s = joined();
    expect(s).toContain('1049h'); // enter alt buffer
    expect(s).toContain('25l');   // hide cursor
    expect(s).toContain('2J');    // clear
  });

  it('exit restores cursor and main buffer', () => {
    const { screen, out } = makeScreen();
    screen.enter();
    out.length = 0;
    screen.exit();
    const s = out.join('');
    expect(s).toContain('25h');   // show cursor
    expect(s).toContain('1049l'); // exit alt buffer
    expect(screen.isActive()).toBe(false);
  });

  it('enter is idempotent (second call does nothing)', () => {
    const { screen, out } = makeScreen();
    screen.enter();
    out.length = 0;
    screen.enter(); // already active
    expect(out).toEqual([]);
  });

  it('exit is idempotent and safe when never entered', () => {
    const { screen, out } = makeScreen();
    expect(() => screen.exit()).not.toThrow();
    expect(out).toEqual([]);
    screen.enter();
    screen.exit();
    out.length = 0;
    screen.exit(); // second exit — no-op
    expect(out).toEqual([]);
  });

  it('moveTo emits a 1-based cursor position and clamps to >=1', () => {
    const { screen, out } = makeScreen();
    screen.enter();
    out.length = 0;
    screen.moveTo(5, 10);
    expect(out.join('')).toContain('5;10H');
    out.length = 0;
    screen.moveTo(-3, 0); // clamps to 1;1
    expect(out.join('')).toContain('1;1H');
  });

  it('write and clear only emit while active', () => {
    const { screen, out } = makeScreen();
    // Not active yet → no output
    screen.write('hi');
    screen.clear();
    expect(out).toEqual([]);
    screen.enter();
    out.length = 0;
    screen.write('hello');
    expect(out).toContain('hello');
    out.length = 0;
    screen.clear();
    expect(out.join('')).toContain('2J');
  });

  it('run() enters, runs the fn, and exits with the result', async () => {
    const { screen, joined } = makeScreen();
    const result = await screen.run((s) => {
      s.write('working');
      return 42;
    });
    expect(result).toBe(42);
    expect(screen.isActive()).toBe(false);
    const s = joined();
    expect(s).toContain('1049h'); // entered
    expect(s).toContain('1049l'); // exited
    expect(s).toContain('working');
  });

  it('run() restores the terminal even when the fn throws', async () => {
    const { screen, out } = makeScreen();
    await expect(screen.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    // Must have torn down despite the throw
    expect(screen.isActive()).toBe(false);
    expect(out.join('')).toContain('1049l');
  });

  it('respects hideCursor:false and clearOnEnter:false', () => {
    const out: string[] = [];
    const screen = createScreen({
      out: (s) => out.push(s),
      installSignalHandlers: false,
      hideCursor: false,
      clearOnEnter: false,
    });
    screen.enter();
    const s = out.join('');
    expect(s).toContain('1049h');   // still enters alt buffer
    expect(s).not.toContain('25l'); // but does not hide cursor
    expect(s).not.toContain('2J');  // and does not clear
    screen.exit();
  });

  it('exposes raw sequences', () => {
    expect(SCREEN_SEQUENCES.enterAlt).toContain('1049h');
    expect(SCREEN_SEQUENCES.exitAlt).toContain('1049l');
  });

  it('defaults to writing to stdout when no out is given', () => {
    // Exercise the default `out` (process.stdout via ansiWrite) without
    // dirtying the test terminal — shim process.stdout.write and restore it.
    const writes: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: (s: string) => boolean }).write = (s: string) => {
      writes.push(String(s)); return true;
    };
    try {
      const screen = createScreen({ installSignalHandlers: false }); // no `out` → default sink
      screen.enter();
      screen.write('x');
      screen.exit();
    } finally {
      process.stdout.write = orig;
    }
    const s = writes.join('');
    expect(s).toContain('1049h'); // entered via the default sink
    expect(s).toContain('1049l'); // exited via the default sink
  });
});
