import { defineElement } from '../../core/define-element.js';
import { ContextMenuElement } from './context-menu.element.js';

defineElement('a11y-context-menu', ContextMenuElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-context-menu': ContextMenuElement;
  }
}

export { ContextMenuElement };
export * from '../core/zero-build-exports.js';
