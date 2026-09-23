import { EmergencyDialogElement } from './emergency-dialog.element.js';

if (!customElements.get('a11y-emergency-dialog')) {
  customElements.define('a11y-emergency-dialog', EmergencyDialogElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-emergency-dialog': EmergencyDialogElement;
  }
}

export { EmergencyDialogElement };
// Re-exported so zero-build `<script type="module">` users can reach it too.
export { dismissAllOverlays } from '../../core/overlay-registry.js';
