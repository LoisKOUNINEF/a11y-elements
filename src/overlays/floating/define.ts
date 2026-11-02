import { defineElement } from '../../core/define-element.js';
import { FloatingElement, type FloatingCloseReason, type FloatingPosition } from './floating.element.js';

defineElement('a11y-floating', FloatingElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-floating': FloatingElement;
  }
}

export { FloatingElement, type FloatingCloseReason, type FloatingPosition };
export * from '../core/zero-build-exports.js';
