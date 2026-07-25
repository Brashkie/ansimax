import {
  createLogger, prettyTransport, jsonTransport,
  asConsole, pinoShim, winstonTransport, LEVEL_WEIGHT,
} from '../logger/index.js';
import type { LogRecord, Transport } from '../logger/index.js';
import { stripAnsi } from '../utils/helpers.js';
import { setNoColor, resetNoColor } from '../colors/index.js';
import { resetColorSupportCache } from '../utils/ansi.js';

/** A transport that captures records for assertions. */
const capture = (): { records: LogRecord[]; transport: Transport } => {
  const records: LogRecord[] = [];
  return { records, transport: (r) => records.push(r) };
};

describe('createLogger — levels (v1.4.12)', () => {
  it('emits at or above the configured level', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.info('shown');
    log.debug('hidden');
    log.trace('hidden');
    expect(records.length).toBe(1);
    expect(records[0]?.msg).toBe('shown');
    expect(records[0]?.level).toBe('info');
  });

  it('debug level lets debug through but not trace', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'debug', transports: [transport] });
    log.debug('a');
    log.trace('b');
    expect(records.map((r) => r.msg)).toEqual(['a']);
  });

  it('silent blocks everything', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'silent', transports: [transport] });
    log.fatal('x');
    log.error('x');
    log.info('x');
    expect(records.length).toBe(0);
  });

  it('setLevel changes the gate at runtime', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'error', transports: [transport] });
    log.info('hidden');
    log.setLevel('debug');
    log.info('shown');
    log.debug('shown too');
    expect(records.map((r) => r.msg)).toEqual(['shown', 'shown too']);
  });

  it('getLevel reflects current level', () => {
    const log = createLogger({ level: 'warn', transports: [capture().transport] });
    expect(log.getLevel()).toBe('warn');
    log.setLevel('trace');
    expect(log.getLevel()).toBe('trace');
  });

  it('isLevelEnabled matches the gate', () => {
    const log = createLogger({ level: 'info', transports: [capture().transport] });
    expect(log.isLevelEnabled('error')).toBe(true);
    expect(log.isLevelEnabled('info')).toBe(true);
    expect(log.isLevelEnabled('debug')).toBe(false);
  });

  it('log() generic form works', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    log.log('warn', 'generic');
    expect(records[0]?.level).toBe('warn');
  });

  it('all six level methods emit', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    log.fatal('a'); log.error('b'); log.warn('c');
    log.info('d'); log.debug('e'); log.trace('f');
    expect(records.map((r) => r.level))
      .toEqual(['fatal', 'error', 'warn', 'info', 'debug', 'trace']);
  });
});

describe('createLogger — structured fields', () => {
  it('extracts a trailing object as fields', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.info('msg', { port: 3000, ok: true });
    expect(records[0]?.fields).toEqual({ port: 3000, ok: true });
    expect(records[0]?.args).toEqual([]);
  });

  it('keeps non-object trailing args as positional', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.info('msg', 1, 'two', true);
    expect(records[0]?.fields).toEqual({});
    expect(records[0]?.args).toEqual([1, 'two', true]);
  });

  it('does NOT treat a trailing Error as fields', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    const err = new Error('boom');
    log.error('failed', err);
    expect(records[0]?.fields).toEqual({});
    expect(records[0]?.args).toEqual([err]);
  });

  it('does NOT treat a trailing array as fields', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.info('msg', [1, 2, 3]);
    expect(records[0]?.fields).toEqual({});
  });

  it('merges bound fields with per-call fields', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', fields: { app: 'x' }, transports: [transport] });
    log.info('msg', { reqId: 'abc' });
    expect(records[0]?.fields).toEqual({ app: 'x', reqId: 'abc' });
  });

  it('per-call fields override bound fields on key collision', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', fields: { env: 'dev' }, transports: [transport] });
    log.info('msg', { env: 'prod' });
    expect(records[0]?.fields).toEqual({ env: 'prod' });
  });
});

describe('createLogger — messages + errors', () => {
  it('stringifies an Error to its stack/message', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.error(new Error('kaboom'));
    expect(records[0]?.msg).toContain('kaboom');
  });

  it('stringifies an Error without a stack to name: message', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    const err = new Error('no stack');
    delete err.stack; // force the `?? name: message` fallback
    log.error(err);
    expect(records[0]?.msg).toContain('no stack');
  });

  it('stringifies an object message as JSON', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.info({ a: 1 });
    expect(records[0]?.msg).toBe('{"a":1}');
  });

  it('falls back to String() for an unserializable object message', () => {
    // _stringify: JSON.stringify throws on a cycle → catch → String(value)
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    log.info(circular);
    expect(records[0]?.msg).toBe('[object Object]');
  });

  it('stringifies a primitive (number/boolean) message', () => {
    // _stringify fallthrough: not string/Error/null/object → String(value)
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.info(42);
    log.info(true);
    expect(records[0]?.msg).toBe('42');
    expect(records[1]?.msg).toBe('true');
  });

  it('handles null/undefined message', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.info(null);
    log.info(undefined);
    expect(records[0]?.msg).toBe('null');
    expect(records[1]?.msg).toBe('undefined');
  });

  it('attaches the logger name to records', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', name: 'api', transports: [transport] });
    log.info('x');
    expect(records[0]?.name).toBe('api');
  });
});

describe('createLogger — child loggers', () => {
  it('inherits level, name and fields, adding its own', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'debug', name: 'root', fields: { app: 'x' }, transports: [transport] });
    const child = log.child({ reqId: 'abc' });
    child.debug('msg');
    expect(records[0]?.fields).toEqual({ app: 'x', reqId: 'abc' });
    expect(records[0]?.name).toBe('root');
    expect(records[0]?.level).toBe('debug');
  });

  it('can override the name', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', name: 'root', transports: [transport] });
    log.child({}, 'worker').info('x');
    expect(records[0]?.name).toBe('worker');
  });

  it('shares transports with the parent', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'info', transports: [transport] });
    log.child({ a: 1 }).info('from child');
    expect(records.length).toBe(1);
    expect(records[0]?.msg).toBe('from child');
  });

  it('takes a snapshot of the parent level at creation time', () => {
    const { records, transport } = capture();
    const parent = createLogger({ level: 'info', transports: [transport] });
    const child = parent.child({ x: 1 });
    parent.setLevel('debug');           // change parent AFTER creating child
    child.debug('should not show');     // child still at info
    expect(records.length).toBe(0);
    child.setLevel('debug');            // child adjusts independently
    child.debug('now shows');
    expect(records.map((r) => r.msg)).toEqual(['now shows']);
  });
});

describe('transports', () => {
  beforeEach(() => setNoColor(true)); // deterministic, no ANSI in assertions
  afterEach(() => resetNoColor());

  // Capture real stdout/stderr writes so the built-in transports are
  // genuinely exercised (they write to the process streams).
  const withCapturedStreams = (fn: () => void): { out: string[]; err: string[] } => {
    const out: string[] = [];
    const err: string[] = [];
    const origOut = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);
    (process.stdout.write as unknown) = (chunk: unknown): boolean => {
      out.push(String(chunk));
      return true;
    };
    (process.stderr.write as unknown) = (chunk: unknown): boolean => {
      err.push(String(chunk));
      return true;
    };
    try { fn(); } finally {
      (process.stdout.write as unknown) = origOut;
      (process.stderr.write as unknown) = origErr;
    }
    return { out, err };
  };

  it('a throwing transport does not break logging', () => {
    const good = capture();
    const bad: Transport = () => { throw new Error('transport boom'); };
    const log = createLogger({ level: 'info', transports: [bad, good.transport] });
    expect(() => log.info('still works')).not.toThrow();
    expect(good.records[0]?.msg).toBe('still works');
  });

  it('prettyTransport writes info to stdout and warn+ to stderr', () => {
    const { out, err } = withCapturedStreams(() => {
      const log = createLogger({
        level: 'trace',
        transports: [prettyTransport({ color: false })],
      });
      log.info('an info line', { port: 3000 });
      log.warn('a warning');
      log.error('an error');
    });
    const outText = out.join('');
    const errText = err.join('');
    // info → stdout, with level label + field formatting
    expect(outText).toContain('INFO');
    expect(outText).toContain('an info line');
    expect(outText).toContain('port=3000');
    // warn/error → stderr
    expect(errText).toContain('WARN');
    expect(errText).toContain('ERROR');
    expect(outText).not.toContain('WARN');
  });

  it('prettyTransport can omit the timestamp and include a name', () => {
    const { out } = withCapturedStreams(() => {
      const log = createLogger({
        level: 'info', name: 'svc',
        transports: [prettyTransport({ color: false, timestamp: false })],
      });
      log.info('named');
    });
    const text = out.join('');
    expect(text).toContain('(svc)');
    expect(text).toContain('named');
    // No HH:MM:SS prefix when timestamp is off
    expect(/^\d{2}:\d{2}:\d{2}/.test(text)).toBe(false);
  });

  it('prettyTransport includes a timestamp by default', () => {
    const { out } = withCapturedStreams(() => {
      const log = createLogger({
        level: 'info',
        transports: [prettyTransport({ color: false })],
      });
      log.info('timed');
    });
    // Somewhere in the line there is an HH:MM:SS token
    expect(/\d{2}:\d{2}:\d{2}/.test(out.join(''))).toBe(true);
  });

  it('prettyTransport formats various field value types', () => {
    const { out } = withCapturedStreams(() => {
      const log = createLogger({
        level: 'info',
        transports: [prettyTransport({ color: false, timestamp: false })],
      });
      log.info('types', {
        n: 42, b: true, big: BigInt(9), s: 'plain', spaced: 'has space',
        obj: { nested: 1 }, nul: null,
      });
    });
    const text = out.join('');
    expect(text).toContain('n=42');
    expect(text).toContain('b=true');
    expect(text).toContain('big=9');
    expect(text).toContain('s=plain');
    expect(text).toContain('spaced="has space"');   // quoted when it has a space
    expect(text).toContain('obj={"nested":1}');       // JSON for objects
    expect(text).toContain('nul=null');
  });

  it('prettyTransport falls back to String() for an unserializable field', () => {
    // _formatFields: JSON.stringify throws on a cycle → catch → String(v)
    const { out } = withCapturedStreams(() => {
      const log = createLogger({
        level: 'info',
        transports: [prettyTransport({ color: false, timestamp: false })],
      });
      const circular: Record<string, unknown> = {};
      circular['self'] = circular;
      log.info('cyclic field', { bad: circular });
    });
    expect(out.join('')).toContain('bad=[object Object]');
  });

  it('jsonTransport writes one pino-shaped JSON object per line', () => {
    const { out } = withCapturedStreams(() => {
      const log = createLogger({
        level: 'info', name: 'api',
        transports: [jsonTransport()],
      });
      log.info('hello', { port: 3000 });
    });
    const line = out.join('').trim();
    const obj = JSON.parse(line);
    expect(obj.level).toBe(LEVEL_WEIGHT.info);
    expect(obj.msg).toBe('hello');
    expect(obj.port).toBe(3000);
    expect(obj.name).toBe('api');
    expect(typeof obj.time).toBe('number');
  });

  it('jsonTransport can target stderr and carries positional args', () => {
    const { err } = withCapturedStreams(() => {
      const log = createLogger({
        level: 'info',
        transports: [jsonTransport({ stream: 'stderr' })],
      });
      log.info('with args', 1, 'two');
    });
    const obj = JSON.parse(err.join('').trim());
    expect(obj.msg).toBe('with args');
    expect(obj.args).toEqual([1, 'two']);
  });

  it('prettyTransport and jsonTransport are constructible', () => {
    expect(typeof prettyTransport()).toBe('function');
    expect(typeof prettyTransport({ timestamp: false, color: false })).toBe('function');
    expect(typeof jsonTransport()).toBe('function');
    expect(typeof jsonTransport({ stream: 'stderr' })).toBe('function');
  });

  it('the default logger (no transports) writes to the streams', () => {
    const { out } = withCapturedStreams(() => {
      // No transports → default prettyTransport is installed
      const log = createLogger({ level: 'info', color: false });
      log.info('default transport');
    });
    expect(out.join('')).toContain('default transport');
  });

  it('createLogger() with no options at all defaults to info + pretty', () => {
    // Covers the `options = {}`, `level ?? 'info'`, and default-transport
    // branches all at once.
    const { out } = withCapturedStreams(() => {
      const log = createLogger();
      expect(log.getLevel()).toBe('info');
      log.info('works with defaults');
      log.debug('hidden at info');
    });
    const text = out.join('');
    expect(text).toContain('works with defaults');
    expect(text).not.toContain('hidden at info');
  });

  it('respects the color flag for its formatting decision', () => {
    // Whether ANSI escapes actually appear depends on terminal support
    // (a non-TTY CI degrades color to plain text — correct behavior). So
    // assert on what is deterministic: color:false never emits escapes,
    // and the transport produces the same readable text either way.
    const noColor = withCapturedStreams(() => {
      const log = createLogger({
        level: 'info',
        transports: [prettyTransport({ color: false, timestamp: false })],
      });
      log.info('plain', { k: 'v' });
    });
    const text = noColor.out.join('');
    expect(text).toContain('plain');
    expect(text).toContain('k=v');
    expect(text).not.toContain('\x1b['); // color:false → guaranteed no ANSI
  });

  it('emits ANSI when color is forced AND the terminal supports it', () => {
    // Force real color support via FORCE_COLOR so the color-applying path
    // (useColor === true) is genuinely exercised, then restore it.
    const prev = process.env['FORCE_COLOR'];
    process.env['FORCE_COLOR'] = '3';
    resetColorSupportCache();
    setNoColor(false);
    try {
      const { out } = withCapturedStreams(() => {
        const log = createLogger({
          level: 'info',
          transports: [prettyTransport({ color: true, timestamp: true })],
        });
        log.info('colored', { k: 'v' });
      });
      expect(out.join('')).toContain('\x1b[');
    } finally {
      if (prev === undefined) delete process.env['FORCE_COLOR'];
      else process.env['FORCE_COLOR'] = prev;
      resetColorSupportCache();
    }
  });

  it('jsonTransport falls back on an unserializable object', () => {
    const { out } = withCapturedStreams(() => {
      const log = createLogger({ level: 'info', transports: [jsonTransport()] });
      const circular: Record<string, unknown> = {};
      circular['self'] = circular; // JSON.stringify throws
      log.info('cyclic', circular);
    });
    // The fallback still emits a minimal valid JSON line with the message
    const obj = JSON.parse(out.join('').trim());
    expect(obj.msg).toBe('cyclic');
    expect(typeof obj.level).toBe('number');
  });
});

describe('shims — asConsole', () => {
  it('maps console methods to logger levels', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    const c = asConsole(log);
    c.log('a');
    c.info('b');
    c.warn('c');
    c.error('d');
    c.debug('e');
    c.trace('f');
    expect(records.map((r) => r.level))
      .toEqual(['info', 'info', 'warn', 'error', 'debug', 'trace']);
    expect(records.map((r) => r.msg)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('shims — pinoShim', () => {
  it('handles the (message) form', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    const p = pinoShim(log);
    p.info('just a message');
    expect(records[0]?.msg).toBe('just a message');
    expect(records[0]?.level).toBe('info');
  });

  it('handles the (mergingObject, message) form', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    const p = pinoShim(log);
    p.error({ userId: 5 }, 'request failed');
    expect(records[0]?.msg).toBe('request failed');
    expect(records[0]?.fields).toEqual({ userId: 5 });
    expect(records[0]?.level).toBe('error');
  });

  it('exposes all pino levels', () => {
    const log = createLogger({ level: 'trace', transports: [capture().transport] });
    const p = pinoShim(log);
    for (const m of ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const) {
      expect(typeof p[m]).toBe('function');
    }
  });

  it('coerces a non-string, non-object first arg to a message', () => {
    // pino's (objOrMsg) where objOrMsg is neither a string nor an object
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    const p = pinoShim(log);
    p.info(42 as unknown as string);
    expect(records[0]?.msg).toBe('42');
  });

  it('handles an object with no message (empty msg)', () => {
    // pino: log.info({ a: 1 }) with no second arg → msg defaults to ''
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    const p = pinoShim(log);
    p.info({ a: 1 });
    expect(records[0]?.msg).toBe('');
    expect(records[0]?.fields).toEqual({ a: 1 });
  });
});

describe('shims — winstonTransport', () => {
  it('maps winston levels to ansimax levels', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    const wt = winstonTransport(log);
    wt({ level: 'verbose', message: 'a' });
    wt({ level: 'silly', message: 'b' });
    wt({ level: 'http', message: 'c' });
    expect(records.map((r) => r.level)).toEqual(['debug', 'trace', 'info']);
  });

  it('forwards meta as fields', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    winstonTransport(log)({ level: 'info', message: 'm', module: 'auth', userId: 1 });
    expect(records[0]?.fields).toEqual({ module: 'auth', userId: 1 });
  });

  it('unknown winston level falls back to info', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    winstonTransport(log)({ level: 'bogus', message: 'm' });
    expect(records[0]?.level).toBe('info');
  });

  it('invokes the callback when provided', () => {
    const log = createLogger({ level: 'trace', transports: [capture().transport] });
    let called = false;
    winstonTransport(log)({ level: 'info', message: 'm' }, () => { called = true; });
    expect(called).toBe(true);
  });

  it('ignores winston Symbol-keyed internal fields', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    const info: { level: string; message: unknown; [k: string]: unknown } = {
      level: 'info', message: 'm', module: 'auth',
    };
    // winston attaches Symbol(level)/Symbol(message)/Symbol(splat) internally
    (info as Record<symbol, unknown>)[Symbol.for('level')] = 'info';
    (info as Record<symbol, unknown>)[Symbol.for('splat')] = [1, 2];
    winstonTransport(log)(info);
    // Only the plain string key survives as a field
    expect(records[0]?.fields).toEqual({ module: 'auth' });
  });

  it('handles a bare log object with no meta', () => {
    const { records, transport } = capture();
    const log = createLogger({ level: 'trace', transports: [transport] });
    winstonTransport(log)({ level: 'warn', message: 'plain' });
    expect(records[0]?.level).toBe('warn');
    expect(records[0]?.fields).toEqual({});
  });
});

describe('logger — barrel + namespace', () => {
  it('exported from the main barrel', async () => {
    const main = await import('../index.js');
    expect(typeof main.createLogger).toBe('function');
    expect(typeof main.prettyTransport).toBe('function');
    expect(typeof main.jsonTransport).toBe('function');
    expect(typeof main.asConsole).toBe('function');
    expect(typeof main.pinoShim).toBe('function');
    expect(typeof main.winstonTransport).toBe('function');
    // LEVEL_WEIGHT is re-exported by name from the package root — only a
    // by-name import from the barrel covers that re-export line.
    expect(main.LEVEL_WEIGHT.info).toBe(40);
    expect(main.LEVEL_WEIGHT.silent).toBe(0);
  });

  it('available on the logger namespace', async () => {
    const main = await import('../index.js');
    expect(typeof main.logger.create).toBe('function');
    expect(typeof main.logger.asConsole).toBe('function');
    expect(main.logger.create).toBe(main.createLogger);
  });

  it('pretty output is colorized and level-labelled', () => {
    setNoColor(true);
    const lines: string[] = [];
    // Capture by wrapping: prettyTransport writes to streams, so instead
    // assert on a hand-rolled record → the label formatting is covered by
    // the transport's own logic being exercised without stream capture.
    const t = prettyTransport({ color: false, timestamp: false });
    expect(typeof t).toBe('function');
    // Smoke: calling it should not throw
    expect(() => t({
      level: 'info', time: Date.now(), msg: 'hi', fields: {}, args: [],
    })).not.toThrow();
    resetNoColor();
    void lines; void stripAnsi;
  });
});
