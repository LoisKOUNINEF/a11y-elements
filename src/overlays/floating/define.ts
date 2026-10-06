import { defineElement } from '../../core/define-element.js';
import { FloatingElement } from './floating.element.js';

defineElement('a11y-floating', FloatingElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-floating': FloatingElement;
  }
}

export { FloatingElement };
export * from '../core/zero-build-exports.js';
