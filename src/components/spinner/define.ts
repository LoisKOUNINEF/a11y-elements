import { defineElement } from '../../core/define-element.js';
import { SpinnerElement } from './spinner.element.js';

defineElement('a11y-spinner', SpinnerElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-spinner': SpinnerElement;
  }
}

export { SpinnerElement };
export * from '../../core/zero-build-exports.js';
