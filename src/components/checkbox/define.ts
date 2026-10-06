import { defineElement } from '../../core/define-element.js';
import { CheckboxElement } from './checkbox.element.js';

defineElement('a11y-checkbox', CheckboxElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-checkbox': CheckboxElement;
  }
}

export { CheckboxElement };
export * from '../../core/zero-build-exports.js';
