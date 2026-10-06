import { defineElement } from '../../core/define-element.js';
import { PopoverElement } from './popover.element.js';

defineElement('a11y-popover', PopoverElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-popover': PopoverElement;
  }
}

export { PopoverElement };
export * from '../core/zero-build-exports.js';
