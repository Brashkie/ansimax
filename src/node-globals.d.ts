// ─────────────────────────────────────────────
//  NODE GLOBALS  –  ambient declarations
//
//  Provides just enough typing for Ansimax's Node.js usage so that
//  `tsc --noEmit` passes before `npm install` has been run.
//  Once @types/node is installed (devDependency), tsconfig.vscode.json
//  and tsconfig.test.json use "types": ["node","jest"] which takes over.
// ─────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

declare namespace NodeJS {
  interface Process {
    stdout: {
      write(str: string): boolean;
      columns?: number;
      rows?: number;
      isTTY?: boolean;
      once(event: string, listener: (...args: any[]) => void): void;
      on(event: string, listener: (...args: any[]) => void): void;
    };
    platform: string;
    stdin: {
      isTTY?: boolean;
      setRawMode?(mode: boolean): void;
      resume(): void;
      pause(): void;
      on(event: string, listener: (...args: any[]) => void): void;
      removeListener(event: string, listener: (...args: any[]) => void): void;
      isPaused(): boolean;
    };
    stderr: {
      write(str: string): boolean;
      isTTY?: boolean;
    };
    env: Record<string, string | undefined>;
    platform: string;
    exit(code?: number): never;
    on(event: string, listener: (...args: any[]) => void): void;
    once(event: string, listener: (...args: any[]) => void): void;
    off(event: string, listener: (...args: any[]) => void): void;
    getMaxListeners?(): number;
    setMaxListeners?(n: number): void;
  }
}

declare var process: NodeJS.Process;

declare var console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
};

declare function setTimeout(callback: () => void, ms?: number): unknown;
declare function clearTimeout(id?: unknown): void;
declare function setInterval(callback: () => void, ms?: number): unknown;
declare function clearInterval(id?: unknown): void;

// AbortSignal / AbortController — web-standard globals available in Node >= 15
// Needed by animations/index.ts for the `signal?: AbortSignal` option.
declare class AbortSignal {
  readonly aborted: boolean;
  readonly reason?: unknown;
  onabort: ((this: AbortSignal, ev: Event) => any) | null;
  addEventListener(type: string, listener: (...args: any[]) => void, opts?: { once?: boolean; capture?: boolean }): void;
  removeEventListener(type: string, listener: (...args: any[]) => void, opts?: { capture?: boolean }): void;
  throwIfAborted(): void;
}

declare class AbortController {
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}

// node:os module — used in ansi.ts for Windows version detection
declare module 'node:os' {
  function release(): string;
  const _default: { release: typeof release };
  export default _default;
  export { release };
}

// ─────────────────────────────────────────────
//  v1.3.4 — AsyncIterator / AsyncIterable
//
//  Web-standard async iteration protocol. Available in Node.js >= 10,
//  but without these ambient declarations, code using `for await...of`
//  loops fails to type-check without @types/node installed.
// ─────────────────────────────────────────────

interface AsyncIteratorResult<T> {
  value: T;
  done: boolean;
}

interface AsyncIterator<T> {
  next(): Promise<AsyncIteratorResult<T>>;
  return?(value?: T): Promise<AsyncIteratorResult<T>>;
  throw?(e?: unknown): Promise<AsyncIteratorResult<T>>;
}

interface AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

interface AsyncGenerator<T = unknown, TReturn = unknown, TNext = unknown> extends AsyncIterator<T> {
  next(value?: TNext): Promise<AsyncIteratorResult<T>>;
  return(value: TReturn): Promise<AsyncIteratorResult<T>>;
  throw(e: unknown): Promise<AsyncIteratorResult<T>>;
  [Symbol.asyncIterator](): AsyncGenerator<T, TReturn, TNext>;
}

// Symbol.asyncIterator may not be declared depending on lib settings —
// keep the well-known symbol available as a fallback ambient declaration.
declare namespace Symbol {
  const asyncIterator: unique symbol;
}
