import { A11yElement } from './a11y-element.js';

/**
 * Base for form-control-like elements (checkbox, switch, select, radio-group).
 *
 * These all wrap a *real* native control (`<input>`, `<select>`, a set of
 * radio `<input>`s) in actual light DOM, so that control already participates
 * in an ancestor `<form>`'s submission for free — `ElementInternals` here is
 * additive polish (validity API, form-associated custom-element semantics),
 * not load-bearing for basic forms to work.
 */
export abstract class A11yFormElement extends A11yElement {
  static formAssociated = true;

  protected internals: ElementInternals = this.attachInternals();

  /** Reads the control's current value from the rendered DOM. */
  abstract getValue(): unknown;

  /** Writes a value into the rendered DOM's control. */
  abstract setValue(value: unknown): void;

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }

  get validity(): ValidityState {
    return this.internals.validity;
  }

  get willValidate(): boolean {
    return this.internals.willValidate;
  }

  checkValidity(): boolean {
    return this.internals.checkValidity();
  }

  reportValidity(): boolean {
    return this.internals.reportValidity();
  }
}
