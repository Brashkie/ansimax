/**
 * ansimax/prompts/confirm — yes/no dialogs, Phase 11.
 *
 * @module
 * @since 1.10.0
 */

import { sgr, FG, STYLE, reset } from '../utils/ansi.js';
import { runSession } from './session.js';
import type { PROMPT_CANCELLED, PROMPT_BACK, PromptBaseOptions } from './session.js';

/** Options for {@link confirmPrompt}. */
export interface ConfirmPromptOptions extends PromptBaseOptions {
  /** The question. */
  message?: string;
  /** Which answer Enter takes. Default `true`. */
  initial?: boolean;
  /** Word for the affirmative. Default `'Yes'`. */
  yes?: string;
  /** Word for the negative. Default `'No'`. */
  no?: string;
  /**
   * Require the arrow keys and Enter rather than accepting `y`/`n` as
   * immediate answers. Default `false`; worth turning on for anything
   * destructive, where a stray keystroke should not be the whole decision.
   */
  deliberate?: boolean;
}

const GREY = 90;

/**
 * Ask a yes/no question.
 *
 * `y` and `n` answer immediately, Left/Right/Tab move between the two, and
 * Enter takes whichever is highlighted — the default to start with, drawn in
 * bold so it is obvious what Enter will do. `deliberate: true` drops the
 * single-key shortcuts.
 *
 * @example
 * ```js
 * import { confirmPrompt, wasCancelled } from 'ansimax';
 *
 * const ok = await confirmPrompt({
 *   message: 'Delete 42 files?',
 *   initial: false,
 *   deliberate: true,
 * });
 * if (ok === true) remove();
 * ```
 *
 * @since 1.10.0
 */
export const confirmPrompt = (
  opts: ConfirmPromptOptions = {},
): Promise<boolean | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const message = typeof opts.message === 'string' ? opts.message : '';
  const yesWord = typeof opts.yes === 'string' && opts.yes.length > 0 ? opts.yes : 'Yes';
  const noWord = typeof opts.no === 'string' && opts.no.length > 0 ? opts.no : 'No';
  const initial = opts.initial !== false;
  let choice = initial;

  const render = (): string[] => {
    const mark = (label: string, active: boolean): string =>
      active
        ? `${sgr(FG.cyan)}▸${reset()} ${sgr(STYLE.bold, FG.cyan)}${label}${reset()}`
        : `  ${sgr(GREY)}${label}${reset()}`;
    return [
      `${sgr(FG.cyan, STYLE.bold)}?${reset()} ${sgr(STYLE.bold)}${message}${reset()}` +
        `   ${mark(yesWord, choice)}   ${mark(noWord, !choice)}`,
    ];
  };

  return runSession<boolean>({
    input: opts.input,
    output: opts.output,
    keep: opts.keep,
    back: opts.back,
    nonTTY: () => initial,
    render,
    onKey: (key) => {
      if (key.name === 'return') return { done: true, value: choice };
      if (!opts.deliberate) {
        // Accept the first letter of either word as well as y/n, so a
        // localized prompt still answers to its own labels.
        const typed = key.name.toLowerCase();
        if (typed === 'y' || typed === yesWord[0]?.toLowerCase()) return { done: true, value: true };
        if (typed === 'n' || typed === noWord[0]?.toLowerCase()) return { done: true, value: false };
      }
      if (
        key.name === 'left' || key.name === 'right' ||
        key.name === 'tab' || key.name === 'space' ||
        key.name === 'h' || key.name === 'l'
      ) {
        choice = !choice;
        return { done: false };
      }
      return { done: false };
    },
  });
};
