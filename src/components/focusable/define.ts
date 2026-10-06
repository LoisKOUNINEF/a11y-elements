import { defineElement } from '../../core/define-element.js';
import { FocusableElement } from './focusable.element.js';

defineElement('a11y-focusable', FocusableElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-focusable': FocusableElement;
  }
}

export { FocusableElement };
export * from '../../core/zero-build-exports.js';
