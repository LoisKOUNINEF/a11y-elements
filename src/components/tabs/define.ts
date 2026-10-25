import { defineElement } from '../../core/define-element.js';
import { TabsElement } from './tabs.element.js';

defineElement('a11y-tabs', TabsElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-tabs': TabsElement;
  }
}

export { TabsElement };
export * from '../../core/zero-build-exports.js';
