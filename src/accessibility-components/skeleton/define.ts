import { SkeletonElement } from './skeleton.element.js';

if (!customElements.get('a11y-skeleton')) {
  customElements.define('a11y-skeleton', SkeletonElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-skeleton': SkeletonElement;
  }
}

export { SkeletonElement };
