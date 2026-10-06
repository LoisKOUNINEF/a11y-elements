import { defineElement } from '../../core/define-element.js';
import { TextareaElement } from './textarea.element.js';

defineElement('a11y-textarea', TextareaElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-textarea': TextareaElement;
  }
}

export { TextareaElement };
export { bindField } from '../../core/field.js';
export * from '../../core/zero-build-exports.js';
