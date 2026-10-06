import { defineElement } from '../../core/define-element.js';
import { RadioGroupElement } from './radio-group.element.js';

defineElement('a11y-radio-group', RadioGroupElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-radio-group': RadioGroupElement;
  }
}

export { RadioGroupElement };
export * from '../../core/zero-build-exports.js';
