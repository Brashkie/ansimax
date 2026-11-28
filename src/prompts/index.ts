/**
 * ansimax/prompts — interactive form controls, Phase 11.
 *
 * Every prompt here returns a promise, takes its I/O as options, and resolves
 * {@link PROMPT_CANCELLED} on Ctrl+C rather than killing the process. They
 * share one session core (`./session.ts`) that owns raw mode, the key
 * listener and the teardown, so there is a single place where a terminal can
 * be left without its cursor — and a single place to fix it.
 *
 * @module
 * @since 1.10.0
 */

export { PROMPT_CANCELLED, PROMPT_BACK, wasCancelled, wasBack, runSession } from './session.js';
export type {
  PromptInput, PromptOutput, PromptBaseOptions, SessionSpec,
} from './session.js';

export { textPrompt, passwordPrompt, numberPrompt, passwordStrength } from './text.js';
export type {
  TextPromptOptions, PasswordPromptOptions, NumberPromptOptions,
  PasswordStrength, Validator,
} from './text.js';

export { confirmPrompt } from './confirm.js';
export type { ConfirmPromptOptions } from './confirm.js';

export { datePrompt, formatISODate, formatTime } from './date.js';
export type { DatePromptOptions } from './date.js';

export { filePrompt } from './file.js';
export type { FilePromptOptions, FileEntry, ReadDir } from './file.js';

export { formPrompt, wizardPrompt } from './form.js';
export type {
  FormPromptOptions, WizardPromptOptions, FormField, FormFieldSpec,
  FormAnswers, FieldValue, WizardStep,
} from './form.js';

import {
  textPrompt as _text, passwordPrompt as _password,
  numberPrompt as _number, passwordStrength as _strength,
} from './text.js';
import { confirmPrompt as _confirm } from './confirm.js';
import { datePrompt as _date, formatISODate as _isoDate, formatTime as _time } from './date.js';
import { filePrompt as _file } from './file.js';
import { formPrompt as _form, wizardPrompt as _wizard } from './form.js';
import {
  PROMPT_CANCELLED as _cancelled, PROMPT_BACK as _back,
  wasCancelled as _wasCancelled, wasBack as _wasBack,
} from './session.js';

/** Namespace form, for the default export. */
export const prompts = {
  text: _text,
  password: _password,
  number: _number,
  confirm: _confirm,
  date: _date,
  file: _file,
  form: _form,
  wizard: _wizard,
  strength: _strength,
  formatISODate: _isoDate,
  formatTime: _time,
  CANCELLED: _cancelled,
  BACK: _back,
  wasCancelled: _wasCancelled,
  wasBack: _wasBack,
};
