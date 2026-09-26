import { ModalElement } from './modal.element.js';

if (!customElements.get('a11y-modal')) {
  customElements.define('a11y-modal', ModalElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-modal': ModalElement;
  }
}

export { ModalElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
export { dismissAllOverlays, removeOverlaysWithin } from '../../core/overlay-registry.js';
