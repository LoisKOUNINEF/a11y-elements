import { defineElement } from '../../core/define-element.js';
import { DropdownElement } from './dropdown.element.js';

defineElement('a11y-dropdown', DropdownElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-dropdown': DropdownElement;
  }
}

export { DropdownElement };
export * from '../core/zero-build-exports.js';
