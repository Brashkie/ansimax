// ─────────────────────────────────────────────
//  ansimax/logger — Structured logger + drop-in shims
//
//  v1.4.12 — Phase 4 closure. A dependency-free structured logger:
//    - createLogger()  → the main API (levels, child loggers, fields)
//    - prettyTransport → colored, human-readable terminal output
//    - jsonTransport   → one JSON object per line (pino-style)
//    - shims: asConsole() / pinoShim() / winstonTransport()
//
//  Everything reuses ansimax primitives (color, level icons) so log
//  output matches the rest of a CLI's styling.
// ─────────────────────────────────────────────

import { color, isNoColor } from '../colors/index.js';
import { writeErr, writeln } from '../utils/ansi.js';
import {
  LEVEL_WEIGHT,
  type LogLevel,
  type EmitLevel,
  type LogRecord,
  type Transport,
  type Logger,
  type LoggerOptions,
} from './types.js';

export type {
  LogLevel, EmitLevel, LogRecord, Transport, Logger, LoggerOptions,
} from './types.js';
export { LEVEL_WEIGHT } from './types.js';

// ─────────────────────────────────────────────
//  Per-level presentation
// ─────────────────────────────────────────────

interface LevelStyle {
  label: string;
  hex: string;
  /** stderr for warn and more severe, stdout otherwise. */
  toStderr: boolean;
}

const LEVEL_STYLE: Record<EmitLevel, LevelStyle> = {
  fatal: { label: 'FATAL', hex: '#ff5555', toStderr: true },
  error: { label: 'ERROR', hex: '#ff5555', toStderr: true },
  warn:  { label: 'WARN',  hex: '#f1fa8c', toStderr: true },
  info:  { label: 'INFO',  hex: '#8be9fd', toStderr: false },
  debug: { label: 'DEBUG', hex: '#bd93f9', toStderr: false },
  trace: { label: 'TRACE', hex: '#6272a4', toStderr: false },
};

// ─────────────────────────────────────────────
//  Formatting helpers
// ─────────────────────────────────────────────

/** Two-digit zero-pad. */
const _pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** `HH:MM:SS` local time from epoch ms. */
const _formatTime = (ms: number): string => {
  const d = new Date(ms);
  return `${_pad2(d.getHours())}:${_pad2(d.getMinutes())}:${_pad2(d.getSeconds())}`;
};

/** Render a fields object as `key=value` pairs, JSON-encoding non-scalars. */
const _formatFields = (fields: Record<string, unknown>): string => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return '';
  const parts: string[] = [];
  for (const k of keys) {
    const v = fields[k];
    let str: string;
    if (v == null) str = String(v);
    else if (typeof v === 'string') str = v.includes(' ') ? JSON.stringify(v) : v;
    else if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
      str = String(v);
    } else {
      try { str = JSON.stringify(v); } catch { str = String(v); }
    }
    parts.push(`${k}=${str}`);
  }
  return parts.join(' ');
};

/** Coerce any message value to a string the way console would. */
const _stringify = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  if (value == null) return String(value);
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
};

// ─────────────────────────────────────────────
//  Built-in transports
// ─────────────────────────────────────────────

/**
 * Human-readable colored transport. warn/error/fatal go to stderr, the
 * rest to stdout, matching conventional CLI behavior.
 *
 * @param opts.timestamp include `HH:MM:SS` (default true)
 * @param opts.color     force color on/off; defaults to global detection
 * @since 1.4.12
 */
export const prettyTransport = (
  opts: { timestamp?: boolean; color?: boolean } = {},
): Transport => {
  const showTime = opts.timestamp !== false;
  return (rec: LogRecord): void => {
    const style = LEVEL_STYLE[rec.level];
    const useColor = opts.color ?? !isNoColor();

    const paint = (hex: string, text: string): string =>
      useColor ? color.hex(hex)(text) : text;
    const dim = (text: string): string => (useColor ? color.dim(text) : text);

    const segs: string[] = [];
    if (showTime) segs.push(dim(_formatTime(rec.time)));
    segs.push(paint(style.hex, style.label.padEnd(5)));
    if (rec.name) segs.push(dim(`(${rec.name})`));
    segs.push(rec.msg);

    const fieldStr = _formatFields(rec.fields);
    if (fieldStr) segs.push(dim(fieldStr));

    const line = segs.join(' ');
    if (style.toStderr) writeErr(line + '\n');
    else writeln(line);
  };
};

/**
 * One JSON object per line (pino-compatible shape: `level` as a number,
 * `time` as epoch ms, `msg`, plus flattened fields).
 *
 * @since 1.4.12
 */
export const jsonTransport = (
  opts: { stream?: 'stdout' | 'stderr' } = {},
): Transport => {
  const toErr = opts.stream === 'stderr';
  return (rec: LogRecord): void => {
    const obj: Record<string, unknown> = {
      level: LEVEL_WEIGHT[rec.level],
      time: rec.time,
      msg: rec.msg,
      ...rec.fields,
    };
    if (rec.name) obj['name'] = rec.name;
    if (rec.args.length > 0) obj['args'] = rec.args;
    let line: string;
    try { line = JSON.stringify(obj); }
    catch { line = JSON.stringify({ level: obj['level'], time: obj['time'], msg: rec.msg }); }
    if (toErr) writeErr(line + '\n');
    else writeln(line);
  };
};

// ─────────────────────────────────────────────
//  Logger factory
// ─────────────────────────────────────────────

/**
 * Split a level method's varargs into a fields object + positional args.
 * A trailing plain object (not an Error/array) is treated as structured
 * fields, mirroring pino's `log.info(obj, msg)` but message-first.
 */
const _extractFields = (
  args: unknown[],
): { fields: Record<string, unknown>; rest: unknown[] } => {
  if (args.length === 0) return { fields: {}, rest: [] };
  const last = args[args.length - 1];
  if (
    last != null && typeof last === 'object'
    && !Array.isArray(last) && !(last instanceof Error)
  ) {
    return { fields: last as Record<string, unknown>, rest: args.slice(0, -1) };
  }
  return { fields: {}, rest: args };
};

interface LoggerState {
  level: LogLevel;
  name?: string;
  boundFields: Record<string, unknown>;
  timestamp: boolean;
  transports: Transport[];
}

/**
 * Create a structured logger.
 *
 * @example
 * ```js
 * import { createLogger } from 'ansimax';
 *
 * const log = createLogger({ level: 'debug', name: 'api' });
 * log.info('server started', { port: 3000 });
 * log.error(new Error('boom'));
 *
 * const reqLog = log.child({ reqId: 'abc123' });
 * reqLog.debug('handling request');
 * ```
 *
 * @since 1.4.12
 */
export const createLogger = (options: LoggerOptions = {}): Logger => {
  const state: LoggerState = {
    level: options.level ?? 'info',
    name: options.name,
    boundFields: { ...(options.fields ?? {}) },
    timestamp: options.timestamp !== false,
    transports: options.transports && options.transports.length > 0
      ? options.transports
      : [prettyTransport({ timestamp: options.timestamp !== false, color: options.color })],
  };

  const emit = (level: EmitLevel, msg: unknown, args: unknown[]): void => {
    // Level gate. `silent` weight 0 blocks everything.
    if (LEVEL_WEIGHT[state.level] < LEVEL_WEIGHT[level]) return;

    const { fields, rest } = _extractFields(args);
    const record: LogRecord = {
      level,
      time: Date.now(),
      msg: _stringify(msg),
      fields: { ...state.boundFields, ...fields },
      args: rest,
      ...(state.name !== undefined ? { name: state.name } : {}),
    };

    for (const transport of state.transports) {
      // A broken transport must never break logging.
      try { transport(record); } catch { /* swallow */ }
    }
  };

  const logger: Logger = {
    fatal: (msg, ...args) => emit('fatal', msg, args),
    error: (msg, ...args) => emit('error', msg, args),
    warn:  (msg, ...args) => emit('warn', msg, args),
    info:  (msg, ...args) => emit('info', msg, args),
    debug: (msg, ...args) => emit('debug', msg, args),
    trace: (msg, ...args) => emit('trace', msg, args),
    log:   (level, msg, ...args) => emit(level, msg, args),

    child: (fields, name) => createLogger({
      level: state.level,
      name: name ?? state.name,
      fields: { ...state.boundFields, ...fields },
      timestamp: state.timestamp,
      transports: state.transports,
    }),

    getLevel: () => state.level,
    setLevel: (level) => { state.level = level; },
    isLevelEnabled: (level) => LEVEL_WEIGHT[state.level] >= LEVEL_WEIGHT[level],
  };

  return logger;
};

// ─────────────────────────────────────────────
//  Drop-in shims
// ─────────────────────────────────────────────

/**
 * Wrap a logger in a `console`-compatible object. `console.log` maps to
 * `info`, and `.warn`/`.error`/`.debug`/`.trace` map to the matching
 * levels — so existing `console.*` call sites keep working while gaining
 * colored, level-aware output.
 *
 * @example
 * ```js
 * const console2 = asConsole(createLogger({ level: 'debug' }));
 * console2.log('hello');       // → info
 * console2.error('uh oh');     // → error (stderr)
 * ```
 *
 * @since 1.4.12
 */
export const asConsole = (
  logger: Logger,
): {
  log: (...a: unknown[]) => void;
  info: (...a: unknown[]) => void;
  warn: (...a: unknown[]) => void;
  error: (...a: unknown[]) => void;
  debug: (...a: unknown[]) => void;
  trace: (...a: unknown[]) => void;
} => ({
  log:   (...a: unknown[]) => logger.info(a[0] as unknown, ...a.slice(1)),
  info:  (...a: unknown[]) => logger.info(a[0] as unknown, ...a.slice(1)),
  warn:  (...a: unknown[]) => logger.warn(a[0] as unknown, ...a.slice(1)),
  error: (...a: unknown[]) => logger.error(a[0] as unknown, ...a.slice(1)),
  debug: (...a: unknown[]) => logger.debug(a[0] as unknown, ...a.slice(1)),
  trace: (...a: unknown[]) => logger.trace(a[0] as unknown, ...a.slice(1)),
});

/**
 * A pino-style shim: same level methods (`fatal`…`trace`) with pino's
 * `(mergingObject, message)` calling convention, backed by an ansimax
 * logger. Handy when swapping pino for pretty terminal output in a CLI.
 *
 * @since 1.4.12
 */
export const pinoShim = (logger: Logger): {
  fatal: (objOrMsg: unknown, msg?: string) => void;
  error: (objOrMsg: unknown, msg?: string) => void;
  warn: (objOrMsg: unknown, msg?: string) => void;
  info: (objOrMsg: unknown, msg?: string) => void;
  debug: (objOrMsg: unknown, msg?: string) => void;
  trace: (objOrMsg: unknown, msg?: string) => void;
} => {
  const wrap = (level: EmitLevel) => (objOrMsg: unknown, msg?: string): void => {
    // pino: log.info({ a: 1 }, 'message')  OR  log.info('message')
    if (typeof objOrMsg === 'string') {
      logger.log(level, objOrMsg);
    } else if (objOrMsg != null && typeof objOrMsg === 'object') {
      logger.log(level, msg ?? '', objOrMsg as Record<string, unknown>);
    } else {
      logger.log(level, msg ?? String(objOrMsg));
    }
  };
  return {
    fatal: wrap('fatal'), error: wrap('error'), warn: wrap('warn'),
    info: wrap('info'), debug: wrap('debug'), trace: wrap('trace'),
  };
};

/** Winston npm log levels → ansimax levels. */
const WINSTON_LEVEL_MAP: Record<string, EmitLevel> = {
  error: 'error',
  warn: 'warn',
  info: 'info',
  http: 'info',
  verbose: 'debug',
  debug: 'debug',
  silly: 'trace',
};

/**
 * A winston-style transport function: accepts winston's `(info, callback)`
 * log objects (`{ level, message, ...meta }`) and forwards them to an
 * ansimax logger. Winston levels are mapped to the nearest ansimax level.
 *
 * ```js
 * // Roughly:
 * myWinstonLogger.add({ log: winstonTransport(createLogger()) });
 * ```
 *
 * @since 1.4.12
 */
export const winstonTransport = (
  logger: Logger,
): ((info: { level: string; message: unknown; [k: string]: unknown }, next?: () => void) => void) =>
  (info, next) => {
    const { level, message, ...meta } = info;
    const mapped = WINSTON_LEVEL_MAP[level] ?? 'info';
    // Strip winston's internal Symbol-keyed noise; keep plain string keys.
    const fields: Record<string, unknown> = {};
    for (const k of Object.keys(meta)) fields[k] = meta[k];
    if (Object.keys(fields).length > 0) logger.log(mapped, message, fields);
    else logger.log(mapped, message);
    if (typeof next === 'function') next();
  };
