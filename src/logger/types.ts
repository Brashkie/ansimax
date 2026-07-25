// ─────────────────────────────────────────────
//  ansimax/logger — Public types
//
//  v1.4.12 — A small structured logger with colored terminal output,
//  drop-in shims for console/pino/winston, and pluggable transports.
// ─────────────────────────────────────────────

/**
 * Log levels, ordered from most to least severe. A logger with a given
 * `level` emits every message at that level or more severe (lower index).
 *
 * `silent` is a sentinel meaning "emit nothing".
 */
export type LogLevel = 'silent' | 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/** Numeric severity — lower is more severe. `silent` sits above everything. */
export const LEVEL_WEIGHT: Record<LogLevel, number> = {
  silent: 0,
  fatal: 10,
  error: 20,
  warn: 30,
  info: 40,
  debug: 50,
  trace: 60,
};

/** Every emittable level (everything except the `silent` sentinel). */
export type EmitLevel = Exclude<LogLevel, 'silent'>;

/**
 * A structured log record handed to every transport. `msg` is the primary
 * message; `fields` holds any structured key/values; `args` holds extra
 * positional arguments (console-style).
 */
export interface LogRecord {
  level: EmitLevel;
  /** Epoch milliseconds when the record was created. */
  time: number;
  msg: string;
  /** Bound + per-call structured fields, merged. */
  fields: Record<string, unknown>;
  /** Extra positional args passed after the message. */
  args: unknown[];
  /** The logger's `name`, when set. */
  name?: string;
}

/**
 * A transport receives fully-formed records and writes them somewhere.
 * Return value is ignored; throwing is swallowed so one bad transport
 * cannot break logging.
 */
export type Transport = (record: LogRecord) => void;

export interface LoggerOptions {
  /** Minimum level to emit. Default `'info'`. */
  level?: LogLevel;
  /** Optional name, printed as a tag and attached to every record. */
  name?: string;
  /** Structured fields bound to every record from this logger. */
  fields?: Record<string, unknown>;
  /**
   * Include an ISO-ish timestamp in the pretty output. Default `true`.
   * Has no effect on JSON transports (which always include `time`).
   */
  timestamp?: boolean;
  /**
   * Force color on/off for the default pretty transport. When omitted,
   * follows ansimax's global color detection.
   */
  color?: boolean;
  /**
   * Transports to write to. When omitted, a single pretty terminal
   * transport is used (stderr for warn+, stdout otherwise).
   */
  transports?: Transport[];
}

/**
 * The logger surface. Level methods accept a message plus either extra
 * positional args (console-style) or a trailing fields object.
 */
export interface Logger {
  fatal(msg: unknown, ...args: unknown[]): void;
  error(msg: unknown, ...args: unknown[]): void;
  warn(msg: unknown, ...args: unknown[]): void;
  info(msg: unknown, ...args: unknown[]): void;
  debug(msg: unknown, ...args: unknown[]): void;
  trace(msg: unknown, ...args: unknown[]): void;
  /** Generic form: `log('info', 'msg')`. */
  log(level: EmitLevel, msg: unknown, ...args: unknown[]): void;
  /**
   * Return a child logger with additional bound fields (and optional name).
   *
   * The child takes a **snapshot** of the parent's level at creation time —
   * a later `parent.setLevel(...)` does not retroactively change existing
   * children (same as pino). Call `child.setLevel(...)` to adjust a child
   * independently. Transports are shared with the parent.
   */
  child(fields: Record<string, unknown>, name?: string): Logger;
  /** Get or set the active level. */
  getLevel(): LogLevel;
  setLevel(level: LogLevel): void;
  /** True when a message at `level` would be emitted. */
  isLevelEnabled(level: EmitLevel): boolean;
}
