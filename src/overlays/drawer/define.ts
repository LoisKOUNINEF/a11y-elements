import { DrawerElement } from './drawer.element.js';

if (!customElements.get('a11y-drawer')) {
  customElements.define('a11y-drawer', DrawerElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-drawer': DrawerElement;
  }
}

export { DrawerElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
export { dismissAllOverlays, removeOverlaysWithin } from '../../core/overlay-registry.js';
