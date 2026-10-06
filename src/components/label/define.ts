import { defineElement } from '../../core/define-element.js';
import { LabelElement } from './label.element.js';

defineElement('a11y-label', LabelElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-label': LabelElement;
  }
}

export { LabelElement };
export * from '../../core/zero-build-exports.js';
