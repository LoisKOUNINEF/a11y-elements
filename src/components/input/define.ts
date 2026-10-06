import { defineElement } from '../../core/define-element.js';
import { InputElement } from './input.element.js';

defineElement('a11y-input', InputElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-input': InputElement;
  }
}

export { InputElement };
export { bindField } from '../../core/field.js';
export * from '../../core/zero-build-exports.js';
