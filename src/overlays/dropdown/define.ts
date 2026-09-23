import { DropdownElement } from './dropdown.element.js';

if (!customElements.get('a11y-dropdown')) {
  customElements.define('a11y-dropdown', DropdownElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-dropdown': DropdownElement;
  }
}

export { DropdownElement };
// Re-exported so zero-build `<script type="module">` users can reach it too.
export { dismissAllOverlays } from '../../core/overlay-registry.js';
