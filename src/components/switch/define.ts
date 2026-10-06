import { defineElement } from '../../core/define-element.js';
import { SwitchElement } from './switch.element.js';

defineElement('a11y-switch', SwitchElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-switch': SwitchElement;
  }
}

export { SwitchElement };
export * from '../../core/zero-build-exports.js';
