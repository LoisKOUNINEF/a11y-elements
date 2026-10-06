import { defineElement } from '../../core/define-element.js';
import { EmergencyDialogElement } from './emergency-dialog.element.js';

defineElement('a11y-emergency-dialog', EmergencyDialogElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-emergency-dialog': EmergencyDialogElement;
  }
}

export { EmergencyDialogElement };
export * from '../core/zero-build-exports.js';
