import { defineElement } from '../../core/define-element.js';
import { CheckboxGroupElement } from './checkbox-group.element.js';

defineElement('a11y-checkbox-group', CheckboxGroupElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-checkbox-group': CheckboxGroupElement;
  }
}

export { CheckboxGroupElement };
export * from '../../core/zero-build-exports.js';
