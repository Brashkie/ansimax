// ─────────────────────────────────────────────
//  ansimax/ascii — Streaming render (async iterator)
//
//  v1.4.10 — Split out from index.ts. Yields a rendered banner row-by-row
//  or char-by-char, honoring an AbortSignal for cancellation.
// ─────────────────────────────────────────────

import { stageRender } from './render.js';
import { ensureString } from './fonts.js';
import type { StreamOptions } from './types.js';

export const stream = async function* (
  text: string,
  opts: StreamOptions = {},
): AsyncGenerator<string, void, unknown> {
  const safe = ensureString(text, 'stream(text)');
  const { font = 'big', letterSpacing, granularity = 'row', signal } = opts;

  if (!safe.length) return;

  // Pre-aborted signal — yield nothing
  if (signal?.aborted) return;

  const rendered = stageRender(safe, font, letterSpacing);

  if (granularity === 'char') {
    for (const ch of rendered) {
      if (signal?.aborted) return;
      yield ch;
    }
    return;
  }

  // 'row' granularity — yield each line including its trailing newline
  // (except the last line, which has no trailing newline)
  const lines = rendered.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (signal?.aborted) return;
    const line = lines[i] as string;
    yield i === lines.length - 1 ? line : line + '\n';
  }
};
