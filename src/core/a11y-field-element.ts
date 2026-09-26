import { A11yWrapperElement } from './a11y-wrapper-element.js';
import {
  bindField,
  type FieldBinding,
  type FieldConstraint,
  type FieldControl,
  type FieldMessages,
  type FieldParts,
  type FieldState,
  type FieldValidator,
} from './field.js';

/** `value-missing-message` → `valueMissing`, and so on for every native constraint. */
const MESSAGE_ATTRIBUTES: Record<string, FieldConstraint> = {
  'value-missing-message': 'valueMissing',
  'type-mismatch-message': 'typeMismatch',
  'bad-input-message': 'badInput',
  'pattern-mismatch-message': 'patternMismatch',
  'too-short-message': 'tooShort',
  'too-long-message': 'tooLong',
  'range-underflow-message': 'rangeUnderflow',
  'range-overflow-message': 'rangeOverflow',
  'step-mismatch-message': 'stepMismatch',
};

const STATES = ['touched', 'dirty', 'user-invalid'] as const;

/**
 * Base for text fields (`<a11y-input>`, `<a11y-textarea>`): wraps a real,
 * consumer-authored control plus optional part children, and hands them to
 * `bindField()` (see `field.ts`), which does the linking and validation.
 *
 * ```html
 * <a11y-input>
 *   <a11y-label>Email</a11y-label>
 *   <input type="email" name="email" required>
 *   <a11y-hint>We never share it.</a11y-hint>
 *   <a11y-error></a11y-error>
 * </a11y-input>
 * ```
 *
 * The native control stays the one that submits (it keeps its `name`) and
 * validates, so the form works before this script loads and nothing is
 * submitted twice. `ElementInternals` makes the host itself a form-associated
 * mirror of it:
 *
 * - `setValidity()` copies the control's validity, anchored to the control,
 *   so `el.validity`, `:invalid` on the host and `form.elements` agree.
 * - Custom states `:state(touched)`, `:state(dirty)` and
 *   `:state(user-invalid)` expose `bindField()`'s state to CSS.
 * - `formResetCallback()` returns the field to pristine on form reset.
 *
 * Both are feature-detected; where unsupported, style `[aria-invalid="true"]`
 * on the control instead.
 */
export abstract class A11yFieldElement extends A11yWrapperElement {
  static formAssociated = true;

  static get observedAttributes(): string[] {
    return Object.keys(MESSAGE_ATTRIBUTES);
  }

  protected internals: ElementInternals = this.attachInternals();
  private _binding: FieldBinding | null = null;
  private _validators: FieldValidator[] = [];

  /** Selects the wrapped native control among this element's descendants. */
  protected abstract readonly controlSelector: string;

  /** Called with the control's value on every native `change` event. */
  declare onChange?: (value: string) => void;

  /** Called with the control's value on every native `input` event. */
  declare onInput?: (value: string) => void;

  /** Custom rules, run in order after the native constraints pass; the first message returned is the error. */
  get validators(): FieldValidator[] {
    return this._validators;
  }

  set validators(validators: FieldValidator[]) {
    this._validators = validators;
    this._binding?.setOptions({ validators });
  }

  getValue(): string {
    return this._control()?.value ?? '';
  }

  /** Sets the value and re-validates. Doesn't mark the field dirty: only the user does. */
  setValue(value: string): void {
    const control = this._control();
    if (!control) return;
    control.value = value;
    this._binding?.validate();
  }

  get form(): HTMLFormElement | null {
    return this._control()?.form ?? null;
  }

  get validity(): ValidityState | undefined {
    return this._control()?.validity;
  }

  get validationMessage(): string {
    return this._binding?.state.message ?? '';
  }

  get willValidate(): boolean {
    return this._control()?.willValidate ?? false;
  }

  /** Validates without showing anything or firing `invalid`. */
  checkValidity(): boolean {
    return this._binding?.validate().valid ?? true;
  }

  /** Shows the error (inline when there's an `<a11y-error>`, else the browser's bubble) and focuses an invalid control. */
  reportValidity(): boolean {
    const binding = this._binding;
    if (!binding) return true;
    const { valid } = binding.show();
    if (valid) return true;
    if (this._part('a11y-error')) binding.control.focus();
    else binding.control.reportValidity();
    return false;
  }

  formResetCallback(): void {
    // Runs before the native control's own value reset (the host comes first in tree order).
    setTimeout(() => this._binding?.reset());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._binding?.destroy();
    this._binding = null;
  }

  private _control(): FieldControl | null {
    return this.querySelector<FieldControl>(this.controlSelector);
  }

  /** The first part with this tag that belongs to this field, not to a nested one. */
  private _part(tag: string): HTMLElement | null {
    return this._parts(tag)[0] ?? null;
  }

  private _parts(tag: string): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>(tag)].filter((el) => el.parentElement?.closest('a11y-input, a11y-textarea') === this);
  }

  private _fieldParts(control: FieldControl): FieldParts {
    return {
      control,
      label: this._label(),
      hints: this._parts('a11y-hint'),
      error: this._part('a11y-error'),
      counter: this._part('a11y-counter'),
    };
  }

  /**
   * `<a11y-label>` renders a real `<label>`, linked with native `for`. Its
   * `label` getter builds it on demand, even before that element's own
   * connect, so the link doesn't wait for another sync. Duck-typed: the label
   * may come from another bundle. Until `<a11y-label>` is defined, the host
   * itself is linked with `aria-labelledby`.
   */
  private _label(): HTMLElement | null {
    const part = this._part('a11y-label') as (HTMLElement & { label?: HTMLLabelElement }) | null;
    if (part) return part.label instanceof HTMLLabelElement ? part.label : part;
    return this._parts('label')[0] ?? null;
  }

  private _messages(): FieldMessages {
    const messages: FieldMessages = {};
    for (const [attribute, constraint] of Object.entries(MESSAGE_ATTRIBUTES)) {
      const value = this.getAttribute(attribute);
      if (value) messages[constraint] = value;
    }
    return messages;
  }

  protected override _sync(): void {
    const control = this._control();
    if (this._binding && this._binding.control !== control) {
      this._binding.destroy();
      this._binding = null;
    }
    if (!control) return;

    const parts = this._fieldParts(control);
    if (this._binding) {
      this._binding.setOptions({ messages: this._messages() });
      this._binding.sync(parts);
    } else {
      this._binding = bindField(parts, {
        validators: this._validators,
        messages: this._messages(),
        onStateChange: (state) => this._mirror(control, state),
      });
    }

    this.wireOnce(control, () => {
      this.listen(control, 'change', () => this.onChange?.(control.value));
      this.listen(control, 'input', () => this.onInput?.(control.value));
    });
    this.wireOnce(this, () =>
      // The mirrored validity makes the host fire its own `invalid` on submit, which would show a second bubble.
      this.listen(this, 'invalid', (event) => {
        if (this._part('a11y-error')) event.preventDefault();
      }),
    );
  }

  private _mirror(control: FieldControl, state: FieldState): void {
    const { internals } = this;
    if (typeof internals.setValidity === 'function') {
      if (state.valid) internals.setValidity({});
      else internals.setValidity(validityFlags(control.validity), state.message || control.validationMessage || ' ', control);
    }
    const states = internals.states;
    if (!states) return;
    const on = { touched: state.touched, dirty: state.dirty, 'user-invalid': state.showError };
    for (const name of STATES) {
      try {
        if (on[name]) states.add(name);
        else states.delete(name);
      } catch {
        // Older Chromium only accepted `--dashed` state names.
      }
    }
  }

  protected override onStringsChange(): void {
    const control = this._control();
    if (control && this._binding) this._binding.sync(this._fieldParts(control));
  }
}

function validityFlags(validity: ValidityState): ValidityStateFlags {
  const flags: ValidityStateFlags = {};
  for (const key of [...Object.values(MESSAGE_ATTRIBUTES), 'customError'] as (keyof ValidityStateFlags)[]) {
    if (validity[key]) flags[key] = true;
  }
  return flags;
}
