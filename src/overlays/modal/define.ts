import { defineElement } from '../../core/define-element.js';
import { ModalElement } from './modal.element.js';

defineElement('a11y-modal', ModalElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-modal': ModalElement;
  }
}

export { ModalElement };
export * from '../core/zero-build-exports.js';
