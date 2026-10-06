import { defineElement } from '../../core/define-element.js';
import { FileInputElement } from './file-input.element.js';

defineElement('a11y-file-input', FileInputElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-file-input': FileInputElement;
  }
}

export { FileInputElement };
export { bindField } from '../../core/field.js';
export * from '../../core/zero-build-exports.js';
