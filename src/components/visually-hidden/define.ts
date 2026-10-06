import { defineElement } from '../../core/define-element.js';
import { VisuallyHiddenElement } from './visually-hidden.element.js';

defineElement('a11y-visually-hidden', VisuallyHiddenElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-visually-hidden': VisuallyHiddenElement;
  }
}

export { VisuallyHiddenElement };
export * from '../../core/zero-build-exports.js';
