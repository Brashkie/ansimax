/**
 * ansimax/prompts/file — a filesystem navigator, Phase 11.
 *
 * The directory listing is **injectable**. A prompt that reached for
 * `node:fs` itself would be untestable without touching a real disk and
 * unusable anywhere that is not Node — and the thing being browsed is not
 * always a filesystem: an archive, an S3 bucket and a remote host are all
 * trees of named entries. So the prompt takes `readDir` and, only if it is
 * absent, falls back to `node:fs` through a lazy require that is allowed to
 * fail.
 *
 * @module
 * @since 1.10.0
 */

import { sgr, FG, STYLE, reset } from '../utils/ansi.js';
import { fuzzySearch } from '../fuzzy/index.js';
import { runSession } from './session.js';
import type { PROMPT_CANCELLED, PROMPT_BACK, PromptBaseOptions } from './session.js';

/** One entry in a directory listing. */
export interface FileEntry {
  /** The entry's own name, with no path. */
  name: string;
  /** Whether it can be descended into. */
  directory: boolean;
  /** Size in bytes, if known. Shown beside the name. */
  size?: number;
}

/** Reads one directory. May throw; the prompt shows the message. */
export type ReadDir = (path: string) => readonly FileEntry[];

/** Options for {@link filePrompt}. */
export interface FilePromptOptions extends PromptBaseOptions {
  /** The question. */
  message?: string;
  /** Where to start. Default `'.'`. */
  cwd?: string;
  /**
   * How to list a directory. Without it the prompt tries `node:fs`, and
   * reports a plain error if that is not available.
   */
  readDir?: ReadDir;
  /**
   * Path separator. Defaults to the platform's (a backslash on Windows) when
   * the built-in `node:fs` lister is used, and to `'/'` when a custom
   * `readDir` is given — a tree that is not a filesystem has its own.
   */
  separator?: string;
  /** Pick a directory rather than a file. Default `false`. */
  directories?: boolean;
  /** Keep only the files whose name matches. Directories always show. */
  filter?: (entry: FileEntry) => boolean;
  /** Show entries whose name starts with a dot. Default `false`. */
  hidden?: boolean;
  /** Rows of the listing to show at once. Default `10`. */
  pageSize?: number;
  /** Reject a choice and say why. */
  validate?: (path: string) => true | string | null | undefined;
}

const GREY = 90;
const PARENT = '..';

/**
 * The default lister, over `node:fs`.
 *
 * Loaded lazily and inside a try/catch, so importing this module never
 * requires a filesystem to exist. A browser bundle that never calls
 * {@link filePrompt} without its own `readDir` pays nothing for this.
 */
const nodeReadDir = (path: string): readonly FileEntry[] => {
  // `require` is declared in src/node-globals.d.ts; the guard is for the ESM
  // build, where it does not exist at runtime.
  const req = typeof require === 'function' ? require : null;
  /* istanbul ignore next — only fires in a pure-ESM runtime, which the CJS
     test build is not. */
  if (!req) {
    throw new Error('ANSIMAX_FILE_NO_FS: pass readDir — node:fs is not reachable here');
  }
  const fs = req('node:fs') as {
    readdirSync: (p: string, o: { withFileTypes: true }) => Array<{
      name: string;
      isDirectory: () => boolean;
    }>;
    statSync: (p: string) => { size: number };
  };
  return fs.readdirSync(path, { withFileTypes: true }).map((entry) => {
    const directory = entry.isDirectory();
    let size: number | undefined;
    if (!directory) {
      try {
        size = fs.statSync(`${path}${platformSeparator()}${entry.name}`).size;
      } catch {
        // A broken symlink or a file that vanished between listing and
        // stat-ing: the entry is still worth showing, just without a size.
      }
    }
    return size === undefined ? { name: entry.name, directory } : { name: entry.name, directory, size };
  });
};

/**
 * `'\\'` on Windows, `'/'` everywhere else — read from `node:path`, which is
 * the only authority on it, and cached because it cannot change at runtime.
 */
let PLATFORM_SEP: string | null = null;
const platformSeparator = (): string => {
  if (PLATFORM_SEP !== null) return PLATFORM_SEP;
  const req = typeof require === 'function' ? require : null;
  /* istanbul ignore next — the `!req` arm only fires in a pure-ESM runtime,
     and the catch needs node:path itself to be missing. */
  try {
    const sep = req ? (req('node:path') as { sep?: unknown }).sep : '/';
    PLATFORM_SEP = typeof sep === 'string' && sep.length > 0 ? sep : '/';
  } catch {
    PLATFORM_SEP = '/';
  }
  return PLATFORM_SEP;
};

/** `1.2 MB`, in the units a person reads. */
const humanSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
};

/** Join without doubling or dropping the separator. */
const joinPath = (base: string, name: string, sep: string): string => {
  if (base.length === 0 || base === '.') return name;
  return base.endsWith(sep) ? `${base}${name}` : `${base}${sep}${name}`;
};

/** One level up, or `null` at the top. */
const parentPath = (path: string, sep: string): string | null => {
  if (path.length === 0 || path === '.') return null;
  const trimmed = path.endsWith(sep) && path.length > 1 ? path.slice(0, -1) : path;
  const at = trimmed.lastIndexOf(sep);
  // A name with no separator in it sits in the current directory — except a
  // drive root like `C:`, which is a top, not a relative name. Without this a
  // Windows navigator offers `..` from `C:\` and lands in the process cwd.
  if (at < 0) return trimmed.endsWith(':') ? null : '.';
  // A path like `/usr` leaves `/`, not an empty string.
  const up = at === 0 ? sep : trimmed.slice(0, at);
  // `/` is its own last separator, so without this the root is its own parent:
  // the listing shows `..`, and following it reloads `/` forever.
  return up === trimmed ? null : up;
};

/**
 * Browse a tree and pick a file or a directory.
 *
 * Up and Down move, Enter descends into a directory or picks a file, Left and
 * Backspace go up a level, and typing filters the listing fuzzily. With
 * `directories: true`, Enter on a directory picks it and Right descends
 * instead.
 *
 * @example
 * ```js
 * import { filePrompt, wasCancelled } from 'ansimax';
 *
 * const chosen = await filePrompt({
 *   message: 'Which config?',
 *   cwd: './src',
 *   filter: (e) => e.name.endsWith('.json'),
 * });
 * ```
 *
 * @since 1.10.0
 */
export const filePrompt = (
  opts: FilePromptOptions = {},
): Promise<string | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const message = typeof opts.message === 'string' ? opts.message : '';
  const readDir = typeof opts.readDir === 'function' ? opts.readDir : nodeReadDir;
  // With a custom lister the tree need not be a filesystem — an archive, a
  // bucket, a remote host — so '/' is the right default there. But when the
  // `node:fs` lister is doing the walking, the platform's own separator is,
  // or a Windows user gets `C:\Users\me/Documents/notes.txt` on screen.
  const sep = typeof opts.separator === 'string' && opts.separator.length > 0
    ? opts.separator
    : readDir === nodeReadDir
      ? platformSeparator()
      : '/';
  const pickDirectories = opts.directories === true;
  const showHidden = opts.hidden === true;
  const pageSize = Math.max(1, Math.trunc(opts.pageSize ?? 10) || 10);

  let path = typeof opts.cwd === 'string' && opts.cwd.length > 0 ? opts.cwd : '.';
  let entries: FileEntry[] = [];
  let listError: string | null = null;
  let error: string | null = null;
  let query = '';
  let picked = 0;
  let offset = 0;

  /** Entries after hidden/filter/query, with `..` in front where it applies. */
  const visible = (): FileEntry[] => {
    let list = entries.filter((e) => showHidden || !e.name.startsWith('.'));
    if (opts.filter) {
      // Directories are navigation, not candidates, so a filter meant for
      // files must not hide the way through the tree.
      list = list.filter((e) => {
        if (e.directory) return true;
        try {
          return opts.filter?.(e) !== false;
        } catch {
          return false;
        }
      });
    }
    list.sort((a, b) =>
      a.directory === b.directory ? a.name.localeCompare(b.name) : a.directory ? -1 : 1,
    );
    if (query.length > 0) {
      const maxErrors = Math.min(2, Math.floor([...query].length / 4));
      const hits = fuzzySearch(query, list, { key: (e) => e.name, maxErrors, limit: 200 });
      list = hits.map((h) => h.value);
    }
    // `..` is navigation, not a match: while a query is active it would sit
    // at the top of the list unmatched *and* selected, so typing a filter and
    // pressing Enter would go up a level instead of into what was found.
    if (query.length > 0) return list;
    const up = parentPath(path, sep);
    return up === null ? list : [{ name: PARENT, directory: true }, ...list];
  };

  const load = (): void => {
    try {
      const listed = readDir(path);
      entries = Array.isArray(listed)
        ? listed.filter((e) => e && typeof e.name === 'string').map((e) => ({
            name: e.name,
            directory: e.directory === true,
            ...(typeof e.size === 'number' ? { size: e.size } : {}),
          }))
        : [];
      listError = null;
    } catch (err) {
      entries = [];
      listError = err instanceof Error ? err.message : String(err);
    }
    picked = 0;
    offset = 0;
  };
  load();

  const render = (): string[] => {
    const list = visible();
    // Keep the cursor inside the window, scrolling by the minimum needed.
    if (picked < offset) offset = picked;
    if (picked >= offset + pageSize) offset = picked - pageSize + 1;

    const lines: string[] = [
      `${sgr(FG.cyan, STYLE.bold)}?${reset()} ${sgr(STYLE.bold)}${message}${reset()}` +
        `  ${sgr(GREY)}${path}${reset()}${query ? `  ${sgr(FG.cyan)}/${query}${reset()}` : ''}`,
    ];

    if (listError) {
      lines.push(`  ${sgr(FG.red)}✗ ${listError}${reset()}`);
      return lines;
    }
    if (list.length === 0) {
      lines.push(`  ${sgr(GREY)}(nothing here)${reset()}`);
      return lines;
    }

    const window = list.slice(offset, offset + pageSize);
    window.forEach((entry, i) => {
      const index = offset + i;
      const active = index === picked;
      const icon = entry.directory ? '📁' : '  ';
      const name = entry.directory && entry.name !== PARENT ? `${entry.name}${sep}` : entry.name;
      const size = entry.size !== undefined && !entry.directory
        ? ` ${sgr(GREY)}${humanSize(entry.size)}${reset()}`
        : '';
      lines.push(
        active
          ? `${sgr(FG.cyan)}▶${reset()} ${icon} ${sgr(STYLE.bold)}${name}${reset()}${size}`
          : `  ${icon} ${name}${size}`,
      );
    });

    if (list.length > pageSize) {
      lines.push(`  ${sgr(GREY)}${picked + 1}/${list.length}${reset()}`);
    }
    if (error) lines.push(`  ${sgr(FG.red)}✗ ${error}${reset()}`);
    return lines;
  };

  const goTo = (next: string): void => {
    path = next;
    query = '';
    error = null;
    load();
  };

  const accept = (full: string): { done: true; value: string } | { done: false } => {
    let verdict: true | string | null | undefined;
    try {
      verdict = opts.validate?.(full);
    } catch (err) {
      verdict = err instanceof Error ? err.message : String(err);
    }
    if (typeof verdict === 'string' && verdict.length > 0) {
      error = verdict;
      return { done: false };
    }
    return { done: true, value: full };
  };

  return runSession<string>({
    input: opts.input,
    output: opts.output,
    keep: opts.keep,
    back: opts.back,
    nonTTY: () => path,
    render,
    onKey: (key) => {
      const list = visible();
      const current = list[picked];

      if (key.name === 'up') {
        picked = list.length === 0 ? 0 : (picked - 1 + list.length) % list.length;
        return { done: false };
      }
      if (key.name === 'down') {
        picked = list.length === 0 ? 0 : (picked + 1) % list.length;
        return { done: false };
      }
      if (key.name === 'pageup') {
        picked = Math.max(0, picked - pageSize);
        return { done: false };
      }
      if (key.name === 'pagedown') {
        picked = Math.min(Math.max(0, list.length - 1), picked + pageSize);
        return { done: false };
      }
      if (key.name === 'home') {
        picked = 0;
        return { done: false };
      }
      if (key.name === 'end') {
        picked = Math.max(0, list.length - 1);
        return { done: false };
      }

      if (key.name === 'left' || (key.name === 'backspace' && query.length === 0)) {
        const up = parentPath(path, sep);
        if (up !== null) goTo(up);
        return { done: false };
      }

      if (key.name === 'backspace') {
        query = [...query].slice(0, -1).join('');
        picked = 0;
        return { done: false };
      }

      if (key.name === 'escape') {
        query = '';
        picked = 0;
        return { done: false };
      }

      if (key.name === 'right' && current?.directory) {
        goTo(current.name === PARENT
          ? (parentPath(path, sep) ?? path)
          : joinPath(path, current.name, sep));
        return { done: false };
      }

      if (key.name === 'return') {
        if (!current) {
          // Nothing listed: picking the directory itself is the only sensible
          // answer, and only when directories are what we are after.
          return pickDirectories ? accept(path) : { done: false };
        }
        if (current.name === PARENT) {
          const up = parentPath(path, sep);
          if (up !== null) goTo(up);
          return { done: false };
        }
        const full = joinPath(path, current.name, sep);
        if (current.directory) {
          if (pickDirectories) return accept(full);
          goTo(full);
          return { done: false };
        }
        if (pickDirectories) {
          error = 'pick a directory, not a file';
          return { done: false };
        }
        return accept(full);
      }

      // Anything printable filters the listing.
      if (!key.ctrl && !key.meta && [...key.name].length === 1 && key.name >= ' ') {
        query += key.name;
        picked = 0;
        return { done: false };
      }
      if (key.name === 'space') {
        query += ' ';
        picked = 0;
        return { done: false };
      }
      return { done: false };
    },
  });
};
