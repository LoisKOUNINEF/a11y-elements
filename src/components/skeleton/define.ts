import { defineElement } from '../../core/define-element.js';
import { SkeletonElement } from './skeleton.element.js';

defineElement('a11y-skeleton', SkeletonElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-skeleton': SkeletonElement;
  }
}

export { SkeletonElement };
export * from '../../core/zero-build-exports.js';
