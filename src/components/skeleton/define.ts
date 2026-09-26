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
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
