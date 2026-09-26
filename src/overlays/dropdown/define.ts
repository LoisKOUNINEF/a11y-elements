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
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
export { dismissAllOverlays, removeOverlaysWithin } from '../../core/overlay-registry.js';
