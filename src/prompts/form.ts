/**
 * ansimax/prompts/form — multi-field forms and wizard flows, Phase 11.
 *
 * These compose the single prompts rather than reimplementing them: a form is
 * a list of fields run in order, a wizard is a list of steps that can be
 * walked backwards. Everything a field needs — its editing keys, its
 * validation, its non-TTY fallback — already works, and a composer that
 * re-drew a text box itself would have to get all of it right again.
 *
 * The one thing the composer owns is **going back**. A prompt resolves once;
 * stepping back means running it again with what was there before, which is
 * why every answer is kept rather than consumed.
 *
 * @module
 * @since 1.10.0
 */

import { sgr, FG, STYLE, reset } from '../utils/ansi.js';
import { textPrompt, passwordPrompt, numberPrompt } from './text.js';
import { confirmPrompt } from './confirm.js';
import { datePrompt } from './date.js';
import { filePrompt } from './file.js';
import { PROMPT_CANCELLED, PROMPT_BACK } from './session.js';
import type { PromptBaseOptions, PromptOutput } from './session.js';
import type { TextPromptOptions, PasswordPromptOptions, NumberPromptOptions } from './text.js';
import type { ConfirmPromptOptions } from './confirm.js';
import type { DatePromptOptions } from './date.js';
import type { FilePromptOptions } from './file.js';

/** Any answer a field can produce. */
export type FieldValue = string | number | boolean | Date;

/** One field of a form. `name` is the key its answer lands under. */
export type FormField =
  | ({ name: string; type: 'text' } & Omit<TextPromptOptions, 'input' | 'output'>)
  | ({ name: string; type: 'password' } & Omit<PasswordPromptOptions, 'input' | 'output'>)
  | ({ name: string; type: 'number' } & Omit<NumberPromptOptions, 'input' | 'output'>)
  | ({ name: string; type: 'confirm' } & Omit<ConfirmPromptOptions, 'input' | 'output'>)
  | ({ name: string; type: 'date' } & Omit<DatePromptOptions, 'input' | 'output'>)
  | ({ name: string; type: 'file' } & Omit<FilePromptOptions, 'input' | 'output'>);

/** A field, plus the conditions the composer applies to it. */
export interface FormFieldSpec {
  /** Skip this field unless the predicate accepts the answers so far. */
  when?: (answers: Record<string, FieldValue>) => boolean;
}

/** Options for {@link formPrompt}. */
export interface FormPromptOptions extends PromptBaseOptions {
  /** Printed once, above the first field. */
  title?: string;
  /**
   * Draw `3/7` before each field. Default `true` for three or more fields —
   * a two-field form does not need a progress counter.
   */
  progress?: boolean;
  /**
   * Offer Shift+Tab on every field but the first, to step back to the
   * previous one. Default `true`. Each field keeps its answer, so stepping
   * back and forward again does not lose what was typed.
   */
  back?: boolean;
}

/** What {@link formPrompt} resolves with. */
export type FormAnswers = Record<string, FieldValue>;

/** One step of a wizard: a title and the fields it asks for. */
export interface WizardStep {
  /** Shown as the step's heading. */
  title: string;
  /** The fields this step collects. */
  fields: Array<FormField & FormFieldSpec>;
  /** Skip the step unless the predicate accepts the answers so far. */
  when?: (answers: FormAnswers) => boolean;
}

/** Options for {@link wizardPrompt}. */
export interface WizardPromptOptions extends PromptBaseOptions {
  /** Printed above every step. */
  title?: string;
  /** Draw a progress bar across the steps. Default `true`. */
  progress?: boolean;
}

const GREY = 90;

const writeTo = (out: PromptOutput | undefined, text: string): void => {
  const target = out ?? { write: (s: string) => process.stdout.write(s) };
  try {
    target.write(text);
  } catch {
    /* stream closed — nothing useful left to do */
  }
};

/** Run one field, seeded with whatever it answered last time. */
const runField = async (
  field: FormField & FormFieldSpec,
  previous: FieldValue | undefined,
  io: Pick<PromptBaseOptions, 'input' | 'output'>,
  messagePrefix: string,
  allowBack: boolean,
): Promise<FieldValue | typeof PROMPT_CANCELLED | typeof PROMPT_BACK> => {
  const shared = { ...io, keep: false, back: allowBack };
  const message = `${messagePrefix}${field.message ?? field.name}`;

  switch (field.type) {
    case 'text': {
      const initial = typeof previous === 'string' ? previous : field.initial;
      const result = await textPrompt({ ...field, message, initial, ...shared });
      return result;
    }
    case 'password': {
      // A password is never pre-filled: showing it back, even masked, invites
      // the user to press Enter on something they cannot see.
      const result = await passwordPrompt({ ...field, message, ...shared });
      return result;
    }
    case 'number': {
      const initial = typeof previous === 'number' ? previous : field.initial;
      const result = await numberPrompt({ ...field, message, initial, ...shared });
      return result;
    }
    case 'confirm': {
      const initial = typeof previous === 'boolean' ? previous : field.initial;
      const result = await confirmPrompt({ ...field, message, initial, ...shared });
      return result;
    }
    case 'date': {
      const initial = previous instanceof Date ? previous : field.initial;
      const result = await datePrompt({ ...field, message, initial, ...shared });
      return result;
    }
    case 'file': {
      const result = await filePrompt({ ...field, message, ...shared });
      return result;
    }
    /* istanbul ignore next — defensive: the union is exhaustive */
    default:
      return PROMPT_CANCELLED;
  }
};

/**
 * Ask a list of fields in order, and hand back their answers.
 *
 * Each answer lands under the field's `name`. A field with `when` is skipped
 * unless its predicate accepts the answers collected so far, which is how a
 * form asks a follow-up question only when it is relevant. Cancelling any
 * field cancels the whole form — a half-filled form is not an answer.
 *
 * @example
 * ```js
 * import { formPrompt, wasCancelled } from 'ansimax';
 *
 * const answers = await formPrompt([
 *   { name: 'name', type: 'text', message: 'Project name', allowEmpty: false },
 *   { name: 'private', type: 'confirm', message: 'Private?', initial: false },
 *   { name: 'org', type: 'text', message: 'Organisation',
 *     when: (a) => a.private === true },
 *   { name: 'port', type: 'number', message: 'Port', min: 1024, max: 65535 },
 * ], { title: 'New project' });
 *
 * if (!wasCancelled(answers)) console.log(answers.name, answers.port);
 * ```
 *
 * @since 1.10.0
 */
export const formPrompt = async (
  fields: ReadonlyArray<FormField & FormFieldSpec>,
  opts: FormPromptOptions = {},
): Promise<FormAnswers | typeof PROMPT_CANCELLED> => {
  const list = (Array.isArray(fields) ? fields : []).filter(
    (f) => f && typeof f.name === 'string' && typeof f.type === 'string',
  );
  if (list.length === 0) return {};

  const showProgress = opts.progress ?? list.length >= 3;
  const answers: FormAnswers = {};

  if (typeof opts.title === 'string' && opts.title.length > 0) {
    writeTo(opts.output, `${sgr(STYLE.bold)}${opts.title}${reset()}\n`);
  }

  // Which fields have actually been asked, so going back lands on the last
  // one shown rather than one that `when` skipped.
  const asked: number[] = [];
  let at = 0;

  while (at < list.length) {
    const field = list[at] as FormField & FormFieldSpec;
    if (field.when) {
      let include = true;
      try {
        include = field.when(answers) !== false;
      } catch {
        include = false;
      }
      if (!include) {
        // A field that no longer applies must not leave a stale answer behind.
        delete answers[field.name];
        at++;
        continue;
      }
    }

    const prefix = showProgress
      ? `${sgr(GREY)}${asked.length + 1}/${list.length}${reset()} `
      : '';
    // Shift+Tab is only offered once there is somewhere to go back to.
    const canGoBack = opts.back !== false && asked.length > 0;
    const result = await runField(field, answers[field.name], opts, prefix, canGoBack);

    if (result === PROMPT_CANCELLED) return PROMPT_CANCELLED;
    if (result === PROMPT_BACK) {
      // Land on the last field actually shown, not the previous index — a
      // field that `when` skipped is not somewhere the user can go.
      const back = asked.pop();
      /* istanbul ignore next — unreachable: Shift+Tab is only offered to a
         field when `asked` is non-empty, so there is always somewhere to go. */
      if (back === undefined) continue;
      at = back;
      writeTo(opts.output, `${sgr(GREY)}↑ back${reset()}\n`);
      continue;
    }

    answers[field.name] = result as FieldValue;
    writeTo(opts.output, summaryLine(field, result as FieldValue));
    asked.push(at);
    at++;
  }

  return answers;
};

/** One `✔ label value` line, printed as each field is answered. */
const summaryLine = (field: FormField & FormFieldSpec, value: FieldValue): string => {
  const label = field.message ?? field.name;
  let shown: string;
  if (field.type === 'password') shown = '••••••••';
  else if (value instanceof Date) shown = value.toISOString().slice(0, 16).replace('T', ' ');
  else if (typeof value === 'boolean') shown = value ? 'yes' : 'no';
  else shown = String(value);
  return `${sgr(FG.green)}✔${reset()} ${sgr(GREY)}${label}${reset()} ${shown}\n`;
};

/**
 * Run a multi-step form.
 *
 * Each step collects its own fields; between steps the answers accumulate, so
 * a later step's `when` can depend on an earlier one. A progress bar shows
 * how far along the flow is. Cancelling cancels the whole wizard.
 *
 * @example
 * ```js
 * import { wizardPrompt } from 'ansimax';
 *
 * const answers = await wizardPrompt([
 *   { title: 'Identity', fields: [
 *     { name: 'name', type: 'text', message: 'Your name', allowEmpty: false },
 *     { name: 'email', type: 'text', message: 'Email' },
 *   ] },
 *   { title: 'Deployment', fields: [
 *     { name: 'deploy', type: 'confirm', message: 'Deploy on push?' },
 *     { name: 'target', type: 'text', message: 'Target host',
 *       when: (a) => a.deploy === true },
 *   ] },
 * ], { title: 'Setup' });
 * ```
 *
 * @since 1.10.0
 */
export const wizardPrompt = async (
  steps: readonly WizardStep[],
  opts: WizardPromptOptions = {},
): Promise<FormAnswers | typeof PROMPT_CANCELLED> => {
  const list = (Array.isArray(steps) ? steps : []).filter(
    (s) => s && typeof s.title === 'string' && Array.isArray(s.fields),
  );
  if (list.length === 0) return {};

  const showProgress = opts.progress !== false;
  const answers: FormAnswers = {};

  if (typeof opts.title === 'string' && opts.title.length > 0) {
    writeTo(opts.output, `${sgr(STYLE.bold)}${opts.title}${reset()}\n`);
  }

  let done = 0;
  for (const step of list) {
    if (step.when) {
      let include = true;
      try {
        include = step.when(answers) !== false;
      } catch {
        include = false;
      }
      if (!include) continue;
    }

    if (showProgress) {
      writeTo(opts.output, `${progressBar(done, list.length)} ${sgr(STYLE.bold)}${step.title}${reset()}\n`);
    } else {
      writeTo(opts.output, `${sgr(STYLE.bold)}${step.title}${reset()}\n`);
    }

    const result = await formPrompt(step.fields, {
      input: opts.input,
      output: opts.output,
      progress: false,
    });
    if (result === PROMPT_CANCELLED) return PROMPT_CANCELLED;
    Object.assign(answers, result);
    done++;
  }

  if (showProgress) writeTo(opts.output, `${progressBar(done, list.length)}\n`);
  return answers;
};

/** `████░░░░ 2/4`, the one indicator a multi-step flow needs. */
const progressBar = (done: number, total: number): string => {
  const width = 8;
  const safeTotal = Math.max(1, total);
  const filled = Math.round((Math.min(done, safeTotal) / safeTotal) * width);
  return `${sgr(FG.cyan)}${'█'.repeat(filled)}${sgr(GREY)}${'░'.repeat(width - filled)}${reset()} ` +
    `${sgr(GREY)}${Math.min(done, safeTotal)}/${safeTotal}${reset()}`;
};
