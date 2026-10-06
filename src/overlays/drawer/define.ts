import { defineElement } from '../../core/define-element.js';
import { DrawerElement } from './drawer.element.js';

defineElement('a11y-drawer', DrawerElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-drawer': DrawerElement;
  }
}

export { DrawerElement };
export * from '../core/zero-build-exports.js';
