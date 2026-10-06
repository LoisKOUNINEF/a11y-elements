import { defineElement } from '../../core/define-element.js';
import { AnchorElement } from './anchor.element.js';

defineElement('a11y-anchor', AnchorElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-anchor': AnchorElement;
  }
}

export { AnchorElement };
export * from '../../core/zero-build-exports.js';
