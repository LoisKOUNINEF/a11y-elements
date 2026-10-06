import { defineElement } from '../../core/define-element.js';
import { SelectElement } from './select.element.js';

defineElement('a11y-select', SelectElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-select': SelectElement;
  }
}

export { SelectElement };
export * from '../../core/zero-build-exports.js';
