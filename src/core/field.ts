import { syncAttr, syncIdRef, syncText } from './dom-sync.js';
import { nextId } from './ids.js';
import { formatString, getString } from './strings.js';

/**
 * `bindField()` — the headless primitive behind `<a11y-input>` and
 * `<a11y-textarea>`, usable directly on any markup (e.g. from a framework
 * component) to get the same wiring without the custom elements.
 *
 * Given a native `<input>`/`<textarea>` and its optional parts (a label,
 * hints, an error container, a character counter), it:
 *
 * - **Links them:** ids where missing, the label's `for` (or
 *   `aria-labelledby` when the label isn't a real `<label>`), and
 *   `aria-describedby` → hints, then the error while it's shown, then the
 *   counter's announcement. Tokens the consumer put there themselves stay.
 * - **Validates:** native constraints first, then `validators` in order —
 *   the first message goes through `setCustomValidity()`, so a failing
 *   custom rule blocks form submission like a native one. Messages can be
 *   overridden per constraint (`valueMissing`, `tooShort`, …).
 * - **Times errors like `:user-invalid`:** nothing is flagged until the
 *   field is left after an edit, or a submit attempt (an `invalid` event)
 *   hits it. From then on the error updates live on every keystroke, until
 *   `reset()` or the form resets.
 * - **Replaces the browser's bubble** when there's an error part: the
 *   `invalid` event is canceled so the message shows inline instead, and
 *   the form's first invalid control is focused (which canceling would
 *   otherwise skip). Without an error part, the native bubble is untouched.
 *
 * Every DOM write is guarded (see `dom-sync.ts`), so `sync()` is safe to
 * call from a `MutationObserver` watching the field.
 *
 * `validate()` calls `setCustomValidity()` itself: use `validators` rather
 * than calling it on the control, which the next validation would clear.
 */

export type FieldControl = HTMLInputElement | HTMLTextAreaElement;

/** Returns an error message, or nothing when the value is valid. */
export type FieldValidator = (value: string, control: FieldControl) => string | null | undefined | void;

/** A native constraint a message can be overridden for. */
export type FieldConstraint = Exclude<keyof ValidityStateFlags, 'customError'>;

/** Per-constraint messages; `{min}`, `{max}`, `{minlength}`, `{maxlength}` are filled from the control's attributes. */
export type FieldMessages = Partial<Record<FieldConstraint, string>>;

export interface FieldParts {
  control: FieldControl;
  label?: HTMLElement | null;
  hints?: HTMLElement[];
  error?: HTMLElement | null;
  counter?: HTMLElement | null;
}

export interface FieldOptions {
  validators?: FieldValidator[];
  messages?: FieldMessages;
  /** The counter announces the characters left at or below this many. Default 20. */
  counterThreshold?: number;
  /** Called after every validation or render, e.g. to mirror the state elsewhere. */
  onStateChange?(state: FieldState): void;
}

export interface FieldState {
  valid: boolean;
  /** The current error message, `''` when valid. Set even while the error isn't shown. */
  message: string;
  /** The field was left (blurred) at least once. */
  touched: boolean;
  /** The user edited the value at least once. */
  dirty: boolean;
  /** The error is visible: `aria-invalid="true"` on the control, the message in the error part. */
  showError: boolean;
}

export interface FieldBinding {
  readonly control: FieldControl;
  readonly state: FieldState;
  /** Re-links after parts were added, removed or replaced. `parts.control` must be the bound control. */
  sync(parts: FieldParts): void;
  /** Re-runs validation without changing whether errors are shown. */
  validate(): FieldState;
  /** Re-runs validation and shows the error from now on, as a submit attempt would. */
  show(): FieldState;
  /** Back to pristine: not touched, not dirty, errors hidden. */
  reset(): void;
  setOptions(options: Partial<FieldOptions>): void;
  /** Removes every listener and the ARIA this binding added. Ids it generated stay. */
  destroy(): void;
}

/** Order the browser checks constraints in — the first failing one picks the message. */
const CONSTRAINTS: FieldConstraint[] = [
  'valueMissing',
  'typeMismatch',
  'badInput',
  'patternMismatch',
  'tooShort',
  'tooLong',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
];

const ANNOUNCE_DELAY = 500;

export function bindField(initialParts: FieldParts, initialOptions: FieldOptions = {}): FieldBinding {
  const control = initialParts.control;
  let parts = initialParts;
  let options: FieldOptions = { ...initialOptions };
  let touched = false;
  let dirty = false;
  /** Errors are visible from the first blur-after-edit or `invalid` event until reset. */
  let shown = false;
  let valid = true;
  let message = '';
  /** Ids this binding put in `aria-describedby` last time, so it can tell them from the consumer's. */
  let ownedDescribedBy: string[] = [];
  let ownedLabelledBy: string | null = null;
  let ownedLabelFor: HTMLLabelElement | null = null;
  let announceTimer: ReturnType<typeof setTimeout> | null = null;
  let resetTimer: ReturnType<typeof setTimeout> | null = null;
  const abort = new AbortController();
  const { signal } = abort;

  const state = (): FieldState => ({ valid, message, touched, dirty, showError: shown && !valid });

  function runValidation(): void {
    control.setCustomValidity('');
    let custom = '';
    if (control.validity.valid) {
      for (const validator of options.validators ?? []) {
        const result = validator(control.value, control);
        if (result) {
          custom = result;
          break;
        }
      }
    }
    control.setCustomValidity(custom);
    valid = !control.willValidate || control.validity.valid;
    message = valid ? '' : custom || messageFor(control, options.messages) || control.validationMessage;
  }

  function render(): void {
    const showError = shown && !valid;
    syncAttr(control, 'aria-invalid', showError ? 'true' : null);

    const { error } = parts;
    if (error) {
      ensureId(error, 'a11y-field-error');
      syncText(error, showError ? message : '');
      syncAttr(error, 'hidden', showError && message ? null : '');
    }

    const status = renderCounter();
    linkLabel();
    const describedBy = [
      ...(parts.hints ?? []).map((hint) => ensureId(hint, 'a11y-field-hint')),
      ...(error && showError && message ? [error.id] : []),
      ...(status ? [status.id] : []),
    ];
    const consumer = tokens(control.getAttribute('aria-describedby')).filter((id) => !ownedDescribedBy.includes(id));
    const next = [...consumer, ...describedBy];
    syncAttr(control, 'aria-describedby', next.length ? next.join(' ') : null);
    ownedDescribedBy = describedBy;

    options.onStateChange?.(state());
  }

  function linkLabel(): void {
    ensureId(control, 'a11y-field');
    const { label } = parts;
    const isLabel = label instanceof HTMLLabelElement;

    if (ownedLabelFor && ownedLabelFor !== label) {
      if (ownedLabelFor.htmlFor === control.id) syncAttr(ownedLabelFor, 'for', null);
      ownedLabelFor = null;
    }
    if (isLabel && !label.htmlFor) ownedLabelFor = label;
    if (isLabel && ownedLabelFor === label) syncAttr(label, 'for', control.id);

    const labelledBy = label && !isLabel ? ensureId(label, 'a11y-field-label') : null;
    if (ownedLabelledBy && ownedLabelledBy !== labelledBy) syncIdRef(control, 'aria-labelledby', ownedLabelledBy, false);
    if (labelledBy) syncIdRef(control, 'aria-labelledby', labelledBy, true);
    ownedLabelledBy = labelledBy;
  }

  /** Renders the counter's text and returns its announcement span, when it has one. */
  function renderCounter(): HTMLElement | null {
    const { counter } = parts;
    if (!counter) return null;
    const max = control.maxLength;
    syncAttr(counter, 'hidden', max >= 0 ? null : '');
    if (max < 0) return null;

    let text = counter.querySelector<HTMLElement>(':scope > .a11y-counter__text');
    let status = counter.querySelector<HTMLElement>(':scope > .a11y-counter__status');
    if (!text) {
      text = document.createElement('span');
      text.className = 'a11y-counter__text';
      text.setAttribute('aria-hidden', 'true');
      counter.prepend(text);
    }
    if (!status) {
      status = document.createElement('span');
      status.className = 'a11y-counter__status';
      status.setAttribute('aria-live', 'polite');
      counter.append(status);
    }
    ensureId(status, 'a11y-field-counter');
    syncText(text, formatString(getString('characterCount'), { count: String(control.value.length), max: String(max) }));
    if (remaining() > threshold()) syncText(status, '');
    return status;
  }

  const remaining = (): number => control.maxLength - control.value.length;
  const threshold = (): number => options.counterThreshold ?? 20;

  /** Announces the characters left once typing pauses, only near the limit — not on every keystroke. */
  function scheduleAnnouncement(): void {
    if (announceTimer) clearTimeout(announceTimer);
    announceTimer = null;
    if (!parts.counter || control.maxLength < 0 || remaining() > threshold()) return;
    announceTimer = setTimeout(() => {
      announceTimer = null;
      const status = parts.counter?.querySelector<HTMLElement>(':scope > .a11y-counter__status');
      if (status && remaining() <= threshold()) {
        const count = Math.max(0, remaining());
        syncText(status, formatString(getString(count === 1 ? 'characterRemaining' : 'charactersRemaining'), { count: String(count) }));
      }
    }, ANNOUNCE_DELAY);
  }

  function update(): FieldState {
    runValidation();
    render();
    return state();
  }

  /** Focuses `control` if it's its form's first invalid native control (what the canceled bubble would have done). */
  function focusIfFirstInvalid(): void {
    const form = control.form;
    const first = form
      ? [...form.elements].find(
          (el): el is FieldControl | HTMLSelectElement =>
            el.matches('input, select, textarea') &&
            (el as HTMLInputElement).willValidate &&
            !(el as HTMLInputElement).validity.valid,
        )
      : control;
    if (first === control && document.activeElement !== control) control.focus();
  }

  control.addEventListener(
    'input',
    () => {
      dirty = true;
      update(); // visible only once shown, but keeps the validity (and any mirror of it) current
      scheduleAnnouncement();
    },
    { signal },
  );

  control.addEventListener(
    'blur',
    () => {
      touched = true;
      if (dirty) shown = true;
      update();
    },
    { signal },
  );

  control.addEventListener(
    'invalid',
    (event) => {
      shown = true;
      update();
      if (parts.error) {
        event.preventDefault();
        focusIfFirstInvalid();
      }
    },
    { signal },
  );

  // The `reset` event fires before the form resets its controls' values.
  document.addEventListener(
    'reset',
    (event) => {
      if (event.target !== control.form) return;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetTimer = null;
        binding.reset();
      });
    },
    { signal, capture: true },
  );

  const binding: FieldBinding = {
    control,
    get state() {
      return state();
    },
    sync(next) {
      parts = next;
      update();
    },
    validate: update,
    show() {
      shown = true;
      return update();
    },
    reset() {
      touched = false;
      dirty = false;
      shown = false;
      if (announceTimer) clearTimeout(announceTimer);
      announceTimer = null;
      update();
    },
    setOptions(next) {
      options = { ...options, ...next };
      update();
    },
    destroy() {
      abort.abort();
      if (announceTimer) clearTimeout(announceTimer);
      if (resetTimer) clearTimeout(resetTimer);
      syncAttr(control, 'aria-invalid', null);
      for (const id of ownedDescribedBy) syncIdRef(control, 'aria-describedby', id, false);
      if (ownedLabelledBy) syncIdRef(control, 'aria-labelledby', ownedLabelledBy, false);
      if (ownedLabelFor?.htmlFor === control.id) syncAttr(ownedLabelFor, 'for', null);
      ownedDescribedBy = [];
      ownedLabelledBy = null;
      ownedLabelFor = null;
    },
  };

  update();
  return binding;
}

function messageFor(control: FieldControl, messages: FieldMessages = {}): string {
  const failed = CONSTRAINTS.find((constraint) => control.validity[constraint]);
  const template = failed && messages[failed];
  if (!template) return '';
  const values: Record<string, string> = {};
  for (const name of ['min', 'max', 'minlength', 'maxlength']) {
    const value = control.getAttribute(name);
    if (value != null) values[name] = value;
  }
  return formatString(template, values);
}

function ensureId(el: HTMLElement, prefix: string): string {
  if (!el.id) syncAttr(el, 'id', nextId(prefix));
  return el.id;
}

function tokens(value: string | null): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean);
}
