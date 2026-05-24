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
