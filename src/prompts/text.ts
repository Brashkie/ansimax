/**
 * ansimax/prompts/text — text, password and numeric input, Phase 11.
 *
 * All three are one editor with different clothes: the same cursor movement,
 * the same word-wise deletion, the same history. What differs is what gets
 * drawn (the characters, a mask, a validated number) and what counts as a
 * valid answer.
 *
 * @module
 * @since 1.10.0
 */

import { sgr, FG, STYLE, reset } from '../utils/ansi.js';
import { fuzzySearch } from '../fuzzy/index.js';
import { runSession } from './session.js';
import type { PROMPT_CANCELLED, PROMPT_BACK } from './session.js';
import type { PromptBaseOptions } from './session.js';
import type { KeyEvent } from '../input/index.js';

/** A validator: return `true` or `null` to accept, or a message to reject. */
export type Validator<T> = (value: T) => true | string | null | undefined;

/** Options for {@link textPrompt}. */
export interface TextPromptOptions extends PromptBaseOptions {
  /** The question. */
  message?: string;
  /** Pre-filled value, editable. */
  initial?: string;
  /** Shown in grey when the input is empty. Not a value. */
  placeholder?: string;
  /**
   * Completion candidates. Matching is fuzzy and typo-tolerant — it runs
   * through `fuzzySearch`, so `cfg` finds `config` and `comit` finds
   * `commit`. Tab accepts the highlighted suggestion.
   */
  suggestions?: readonly string[];
  /** How many suggestions to show at once. Default `5`. */
  maxSuggestions?: number;
  /**
   * Previous answers, oldest first. Up and Down walk them when the
   * suggestion list is closed.
   */
  history?: readonly string[];
  /** Reject an answer and show why. */
  validate?: Validator<string>;
  /** Accept an empty answer. Default `true` unless `validate` says otherwise. */
  allowEmpty?: boolean;
}

/** Options for {@link passwordPrompt}. */
export interface PasswordPromptOptions extends PromptBaseOptions {
  message?: string;
  /** Character drawn per typed character. Default `'•'`. Empty hides the length. */
  mask?: string;
  /** Draw a strength meter under the field. Default `true`. */
  meter?: boolean;
  /** Reject an answer and show why. */
  validate?: Validator<string>;
  /** Ask twice and require a match. Default `false`. */
  confirm?: boolean;
  /** The second prompt's message. Default `'Confirm'`. */
  confirmMessage?: string;
}

/** Options for {@link numberPrompt}. */
export interface NumberPromptOptions extends PromptBaseOptions {
  message?: string;
  /** Starting value. */
  initial?: number;
  /** Smallest accepted value, inclusive. */
  min?: number;
  /** Largest accepted value, inclusive. */
  max?: number;
  /** Reject anything that is not a multiple of this, counting from `min`. */
  step?: number;
  /** Accept only whole numbers. Default `false`. */
  integer?: boolean;
  /** How much Up/Down change the value by. Default `step`, else `1`. */
  nudge?: number;
  /** Reject an answer and show why. */
  validate?: Validator<number>;
}

/** What {@link passwordStrength} reports. */
export interface PasswordStrength {
  /** 0–4: the usual five buckets. */
  score: 0 | 1 | 2 | 3 | 4;
  /** A word for the score. */
  label: 'empty' | 'very weak' | 'weak' | 'fair' | 'strong' | 'very strong';
  /** Shannon entropy in bits, over the character classes actually used. */
  bits: number;
  /** What would most improve it, if anything. */
  hint: string | null;
}

const GREY = 90;

/** A mutable editing buffer: the text and where the caret sits in it. */
interface Editor {
  value: string;
  caret: number;
}

/**
 * Apply one key to the editor. Returns `true` if the buffer changed.
 *
 * Code points, not UTF-16 units: a caret that moves one unit at a time walks
 * into the middle of an emoji and the next render emits half a surrogate
 * pair. Everything here works on the code-point array.
 */
const editKey = (ed: Editor, key: KeyEvent): boolean => {
  const chars = [...ed.value];

  if (key.name === 'backspace') {
    if (ed.caret === 0) return false;
    chars.splice(ed.caret - 1, 1);
    ed.value = chars.join('');
    ed.caret--;
    return true;
  }
  if (key.name === 'delete') {
    if (ed.caret >= chars.length) return false;
    chars.splice(ed.caret, 1);
    ed.value = chars.join('');
    return true;
  }
  if (key.name === 'left') {
    ed.caret = Math.max(0, ed.caret - 1);
    return true;
  }
  if (key.name === 'right') {
    ed.caret = Math.min(chars.length, ed.caret + 1);
    return true;
  }
  if (key.name === 'home' || (key.ctrl && key.name === 'a')) {
    ed.caret = 0;
    return true;
  }
  if (key.name === 'end' || (key.ctrl && key.name === 'e')) {
    ed.caret = chars.length;
    return true;
  }
  if (key.ctrl && key.name === 'u') {
    // Kill to the start of the line, as a shell does.
    ed.value = chars.slice(ed.caret).join('');
    ed.caret = 0;
    return true;
  }
  if (key.ctrl && key.name === 'k') {
    ed.value = chars.slice(0, ed.caret).join('');
    return true;
  }
  if (key.ctrl && key.name === 'w') {
    // Kill the word behind the caret: the run of spaces, then the run of
    // non-spaces, which is what makes it feel right on a trailing space.
    let at = ed.caret;
    while (at > 0 && chars[at - 1] === ' ') at--;
    while (at > 0 && chars[at - 1] !== ' ') at--;
    chars.splice(at, ed.caret - at);
    ed.value = chars.join('');
    ed.caret = at;
    return true;
  }
  if (key.name === 'space') {
    chars.splice(ed.caret, 0, ' ');
    ed.value = chars.join('');
    ed.caret++;
    return true;
  }
  // A printable key is one code point with no modifier that changes it.
  if (!key.ctrl && !key.meta && [...key.name].length === 1 && key.name >= ' ') {
    chars.splice(ed.caret, 0, key.name);
    ed.value = chars.join('');
    ed.caret++;
    return true;
  }
  return false;
};

/** Draw the buffer with a visible caret, as reverse video on one cell. */
const withCaret = (text: string, caret: number, placeholder: string): string => {
  if (text.length === 0 && placeholder.length > 0) {
    return sgr(GREY) + placeholder + reset();
  }
  const chars = [...text];
  const before = chars.slice(0, caret).join('');
  const at = chars[caret] ?? ' ';
  const after = chars.slice(caret + 1).join('');
  return `${before}${sgr(STYLE.inverse)}${at}${reset()}${after}`;
};

const problem = (message: string): string => `${sgr(FG.red)}✗ ${message}${reset()}`;

const header = (message: string): string =>
  `${sgr(FG.cyan, STYLE.bold)}?${reset()} ${sgr(STYLE.bold)}${message}${reset()}`;

const runValidator = <T>(validate: Validator<T> | undefined, value: T): string | null => {
  if (!validate) return null;
  let verdict: true | string | null | undefined;
  try {
    verdict = validate(value);
  } catch (err) {
    // A validator that throws is a validator that rejected, with its own
    // message — better than taking the whole prompt down.
    return err instanceof Error ? err.message : String(err);
  }
  return typeof verdict === 'string' && verdict.length > 0 ? verdict : null;
};

/**
 * Ask for a line of text.
 *
 * Editing is what a shell gives you: arrows and Home/End, Ctrl+A/E to the
 * ends, Ctrl+U/K to kill to either end, Ctrl+W to kill a word. With
 * `suggestions`, Tab completes and Up/Down pick between fuzzy matches; with
 * `history`, Up/Down walk previous answers when no suggestions are showing.
 *
 * @example
 * ```js
 * import { textPrompt, wasCancelled } from 'ansimax';
 *
 * const branch = await textPrompt({
 *   message: 'Branch',
 *   suggestions: ['main', 'develop', 'release/1.10', 'feature/charts'],
 *   validate: (v) => (v.includes(' ') ? 'no spaces in a branch name' : true),
 * });
 * if (!wasCancelled(branch)) console.log(`checking out ${branch}`);
 * ```
 *
 * @since 1.10.0
 */
export const textPrompt = (
  opts: TextPromptOptions = {},
): Promise<string | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const message = typeof opts.message === 'string' ? opts.message : '';
  const placeholder = typeof opts.placeholder === 'string' ? opts.placeholder : '';
  const suggestions = (opts.suggestions ?? []).filter((s) => typeof s === 'string');
  const maxSuggestions = Math.max(1, Math.trunc(opts.maxSuggestions ?? 5) || 5);
  const history = (opts.history ?? []).filter((s) => typeof s === 'string');
  const allowEmpty = opts.allowEmpty !== false;

  const ed: Editor = { value: typeof opts.initial === 'string' ? opts.initial : '', caret: 0 };
  ed.caret = [...ed.value].length;

  let error: string | null = null;
  let picked = 0;
  // -1 means "not walking history"; otherwise an index from the end.
  let historyAt = -1;
  let matches: string[] = [];

  const recomputeMatches = (): void => {
    if (suggestions.length === 0 || ed.value.length === 0) {
      matches = suggestions.length > 0 && ed.value.length === 0
        ? suggestions.slice(0, maxSuggestions)
        : [];
    } else {
      // Typo tolerance has to grow with the query, and slower than feels
      // natural. This is an END-FREE search: the pattern is sought anywhere
      // inside the candidate, so a 3-character query with 2 errors allowed
      // matches almost anything — `fea` reaches `develop` through `vel` in
      // two substitutions. A quarter of the query's length keeps a short
      // query exact (substring matching, which is what a user expects from
      // three characters) and earns tolerance once there is enough of it to
      // disambiguate: `comit` finds `commit`, `confg` finds `config`.
      const maxErrors = Math.min(2, Math.floor([...ed.value].length / 4));
      matches = fuzzySearch(ed.value, suggestions, { limit: maxSuggestions, maxErrors })
        .map((m) => m.value);
    }
    if (picked >= matches.length) picked = 0;
  };
  recomputeMatches();

  const render = (): string[] => {
    const lines: string[] = [`${header(message)} ${withCaret(ed.value, ed.caret, placeholder)}`];
    if (error) lines.push(`  ${problem(error)}`);
    matches.forEach((match, i) => {
      const active = i === picked;
      lines.push(
        active
          ? `${sgr(FG.cyan)}▶${reset()} ${sgr(STYLE.bold)}${match}${reset()}`
          : `  ${sgr(GREY)}${match}${reset()}`,
      );
    });
    return lines;
  };

  return runSession<string>({
    input: opts.input,
    output: opts.output,
    keep: opts.keep,
    back: opts.back,
    nonTTY: () => ed.value,
    render,
    onKey: (key) => {
      if (key.name === 'return') {
        const value = ed.value;
        if (!allowEmpty && value.length === 0) {
          error = 'this field is required';
          return { done: false };
        }
        const complaint = runValidator(opts.validate, value);
        if (complaint) {
          error = complaint;
          return { done: false };
        }
        return { done: true, value };
      }

      if (key.name === 'tab' && matches.length > 0) {
        ed.value = matches[picked] as string;
        ed.caret = [...ed.value].length;
        error = null;
        recomputeMatches();
        return { done: false };
      }

      if (key.name === 'escape') {
        // Close the suggestion list without losing what was typed.
        matches = [];
        return { done: false };
      }

      if (key.name === 'up' || key.name === 'down') {
        if (matches.length > 0) {
          const delta = key.name === 'up' ? -1 : 1;
          picked = (picked + delta + matches.length) % matches.length;
          return { done: false };
        }
        if (history.length > 0) {
          if (key.name === 'up') {
            historyAt = historyAt < 0 ? history.length - 1 : Math.max(0, historyAt - 1);
            ed.value = history[historyAt] as string;
          } else if (historyAt >= 0) {
            historyAt++;
            if (historyAt >= history.length) {
              historyAt = -1;
              ed.value = '';
            } else {
              ed.value = history[historyAt] as string;
            }
          }
          ed.caret = [...ed.value].length;
          error = null;
          recomputeMatches();
          return { done: false };
        }
        return { done: false };
      }

      if (editKey(ed, key)) {
        error = null;
        historyAt = -1;
        recomputeMatches();
        return { done: false };
      }
      return { done: false };
    },
  });
};

// ─────────────────────────────────────────────
//  Password
// ─────────────────────────────────────────────

const CLASSES: Array<[RegExp, number, string]> = [
  [/[a-z]/, 26, 'lowercase'],
  [/[A-Z]/, 26, 'uppercase'],
  [/[0-9]/, 10, 'a digit'],
  [/[^A-Za-z0-9]/, 33, 'a symbol'],
];

/**
 * Score a password by the size of the space it was drawn from.
 *
 * Length times the log of the alphabet actually used — `log2(pool) * length`
 * — which is the standard estimate and the honest one to show a user: it says
 * "this is how many guesses it would take", not "this looks strong to me".
 * It cannot know that `Password1!` is in every word list, so the hint pushes
 * towards length, which is the thing that always helps.
 *
 * @example
 * ```js
 * import { passwordStrength } from 'ansimax';
 *
 * passwordStrength('hunter2').score;                 // → 1
 * passwordStrength('correct horse battery').score;   // → 4
 * ```
 *
 * @since 1.10.0
 */
export const passwordStrength = (password: string): PasswordStrength => {
  const text = typeof password === 'string' ? password : '';
  const length = [...text].length;
  if (length === 0) {
    return { score: 0, label: 'empty', bits: 0, hint: 'type something' };
  }

  let pool = 0;
  const missing: string[] = [];
  for (const [pattern, size, name] of CLASSES) {
    if (pattern.test(text)) pool += size;
    else missing.push(name);
  }
  // A password of one repeated character has far less entropy than its length
  // suggests, so the count of distinct characters caps the estimate.
  const distinct = new Set([...text]).size;
  const effective = Math.min(length, distinct * 2);
  const bits = Math.log2(Math.max(2, pool)) * effective;

  const score: 0 | 1 | 2 | 3 | 4 =
    bits >= 90 ? 4 : bits >= 60 ? 3 : bits >= 40 ? 2 : bits >= 24 ? 1 : 0;
  const label = (
    ['very weak', 'weak', 'fair', 'strong', 'very strong'] as const
  )[score] as PasswordStrength['label'];

  let hint: string | null = null;
  if (score < 4) {
    if (length < 12) hint = 'longer is the easiest win';
    else if (missing.length > 0) hint = `add ${missing[0]}`;
    else if (distinct * 2 < length) hint = 'too many repeated characters';
  }
  return { score, label, bits: Math.round(bits), hint };
};

const METER_COLORS = [FG.red, FG.red, FG.yellow, FG.green, FG.green] as const;

const strengthBar = (text: string): string => {
  const { score, label, hint } = passwordStrength(text);
  if (text.length === 0) return `  ${sgr(GREY)}░░░░${reset()}`;
  const filled = score + 1;
  const bar = '█'.repeat(filled) + '░'.repeat(Math.max(0, 4 - score));
  const color = METER_COLORS[score] as number;
  const tail = hint ? ` ${sgr(GREY)}— ${hint}${reset()}` : '';
  return `  ${sgr(color)}${bar}${reset()} ${sgr(GREY)}${label}${reset()}${tail}`;
};

/**
 * Ask for a password.
 *
 * The characters are masked, the length is not — a mask of `''` hides that
 * too. With `meter`, a strength bar sits under the field; with `confirm`, the
 * prompt runs twice and rejects a mismatch.
 *
 * @example
 * ```js
 * import { passwordPrompt } from 'ansimax';
 *
 * const secret = await passwordPrompt({
 *   message: 'New password',
 *   confirm: true,
 *   validate: (v) => (v.length < 12 ? 'at least 12 characters' : true),
 * });
 * ```
 *
 * @since 1.10.0
 */
export const passwordPrompt = async (
  opts: PasswordPromptOptions = {},
): Promise<string | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const first = await askPassword(opts, typeof opts.message === 'string' ? opts.message : 'Password');
  // Cancelled, stepped back, or no confirmation wanted: nothing more to ask.
  if (typeof first !== 'string' || opts.confirm !== true) return first;

  return askPassword(
    { ...opts, meter: false, validate: undefined },
    typeof opts.confirmMessage === 'string' ? opts.confirmMessage : 'Confirm',
    first,
  );
};

/** One pass of the password field. `mustMatch` turns it into a confirmation. */
const askPassword = (
  opts: PasswordPromptOptions,
  message: string,
  mustMatch?: string,
): Promise<string | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const mask = typeof opts.mask === 'string' ? opts.mask : '•';
  const showMeter = opts.meter !== false && mustMatch === undefined;
  const ed: Editor = { value: '', caret: 0 };
  let error: string | null = null;

  const render = (): string[] => {
    const shown = mask.length === 0 ? '' : mask.repeat([...ed.value].length);
    const lines = [`${header(message)} ${shown}${sgr(STYLE.inverse)} ${reset()}`];
    if (error) lines.push(`  ${problem(error)}`);
    if (showMeter) lines.push(strengthBar(ed.value));
    return lines;
  };

  return runSession<string>({
    input: opts.input,
    output: opts.output,
    keep: opts.keep,
    back: opts.back,
    nonTTY: () => '',
    render,
    onKey: (key) => {
      if (key.name === 'return') {
        if (mustMatch !== undefined && ed.value !== mustMatch) {
          error = 'the two entries do not match';
          ed.value = '';
          ed.caret = 0;
          return { done: false };
        }
        const complaint = runValidator(opts.validate, ed.value);
        if (complaint) {
          error = complaint;
          return { done: false };
        }
        return { done: true, value: ed.value };
      }
      if (editKey(ed, key)) {
        error = null;
        return { done: false };
      }
      return { done: false };
    },
  });
};

// ─────────────────────────────────────────────
//  Numeric
// ─────────────────────────────────────────────

/** Round `value` onto the `step` grid measured from `from`. */
const snap = (value: number, step: number, from: number): number => {
  const base = Number.isFinite(from) ? from : 0;
  const steps = Math.round((value - base) / step);
  // Floating-point steps accumulate error, so the result is rounded to the
  // precision the step itself implies rather than left at 0.30000000000000004.
  const raw = base + steps * step;
  const decimals = (String(step).split('.')[1] ?? '').length;
  return decimals > 0 ? Number(raw.toFixed(decimals)) : raw;
};

/**
 * Ask for a number.
 *
 * Only characters that can begin a number are accepted, so the field cannot
 * hold something unparseable. Up and Down nudge the value, `min`/`max` are
 * checked on submit and shown in the prompt, and `step` snaps the value onto
 * a grid measured from `min`.
 *
 * @example
 * ```js
 * import { numberPrompt } from 'ansimax';
 *
 * const port = await numberPrompt({
 *   message: 'Port',
 *   initial: 3000,
 *   min: 1024,
 *   max: 65535,
 *   integer: true,
 * });
 * ```
 *
 * @since 1.10.0
 */
export const numberPrompt = (
  opts: NumberPromptOptions = {},
): Promise<number | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const message = typeof opts.message === 'string' ? opts.message : '';
  const min = typeof opts.min === 'number' && Number.isFinite(opts.min) ? opts.min : null;
  const max = typeof opts.max === 'number' && Number.isFinite(opts.max) ? opts.max : null;
  const step = typeof opts.step === 'number' && Number.isFinite(opts.step) && opts.step > 0
    ? opts.step
    : null;
  const integer = opts.integer === true;
  const nudge = typeof opts.nudge === 'number' && Number.isFinite(opts.nudge) && opts.nudge > 0
    ? opts.nudge
    : (step ?? 1);

  const ed: Editor = { value: '', caret: 0 };
  if (typeof opts.initial === 'number' && Number.isFinite(opts.initial)) {
    ed.value = String(opts.initial);
    ed.caret = ed.value.length;
  }
  let error: string | null = null;

  const bounds = (): string => {
    if (min !== null && max !== null) return `${min}–${max}`;
    if (min !== null) return `≥ ${min}`;
    if (max !== null) return `≤ ${max}`;
    return '';
  };

  const render = (): string[] => {
    const hint = bounds();
    const suffix = hint ? ` ${sgr(GREY)}(${hint})${reset()}` : '';
    const lines = [`${header(message)} ${withCaret(ed.value, ed.caret, '')}${suffix}`];
    if (error) lines.push(`  ${problem(error)}`);
    return lines;
  };

  /** Validate the typed text, returning the number or the complaint. */
  const parse = (): { value: number } | { error: string } => {
    const text = ed.value.trim();
    if (text.length === 0) return { error: 'enter a number' };
    const value = Number(text);
    if (!Number.isFinite(value)) return { error: `${text} is not a number` };
    if (integer && !Number.isInteger(value)) return { error: 'a whole number, please' };
    if (min !== null && value < min) return { error: `at least ${min}` };
    if (max !== null && value > max) return { error: `at most ${max}` };
    if (step !== null) {
      const snapped = snap(value, step, min ?? 0);
      if (Math.abs(snapped - value) > 1e-9) return { error: `in steps of ${step}` };
    }
    const complaint = runValidator(opts.validate, value);
    if (complaint) return { error: complaint };
    return { value };
  };

  const bump = (delta: number): void => {
    // `Number('')` is 0, not NaN, so an empty field would nudge from zero and
    // then get clamped up to the minimum — one keypress short of where the
    // user expects to land.
    const text = ed.value.trim();
    const current = text.length === 0 ? Number.NaN : Number(text);
    const from = Number.isFinite(current) ? current : (min ?? 0) - delta;
    let next = from + delta;
    if (step !== null) next = snap(next, step, min ?? 0);
    if (min !== null && next < min) next = min;
    if (max !== null && next > max) next = max;
    // Keep the displayed value free of floating-point dust: 0.1 + 0.2 is a
    // number the user never typed.
    ed.value = String(Number(next.toFixed(10)));
    ed.caret = ed.value.length;
    error = null;
  };

  return runSession<number>({
    input: opts.input,
    output: opts.output,
    keep: opts.keep,
    back: opts.back,
    nonTTY: () => {
      const parsed = parse();
      return 'value' in parsed ? parsed.value : (min ?? 0);
    },
    render,
    onKey: (key) => {
      if (key.name === 'return') {
        const parsed = parse();
        if ('error' in parsed) {
          error = parsed.error;
          return { done: false };
        }
        return { done: true, value: parsed.value };
      }
      if (key.name === 'up') {
        bump(nudge);
        return { done: false };
      }
      if (key.name === 'down') {
        bump(-nudge);
        return { done: false };
      }
      // Only characters a number can be made of reach the buffer.
      const printable = !key.ctrl && !key.meta && [...key.name].length === 1;
      if (printable && !/[0-9.,+\-eE]/.test(key.name)) return { done: false };
      if (editKey(ed, key)) {
        error = null;
        return { done: false };
      }
      return { done: false };
    },
  });
};
