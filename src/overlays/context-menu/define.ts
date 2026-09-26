import { ContextMenuElement } from './context-menu.element.js';

if (!customElements.get('a11y-context-menu')) {
  customElements.define('a11y-context-menu', ContextMenuElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-context-menu': ContextMenuElement;
  }
}

export { ContextMenuElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
export { dismissAllOverlays, removeOverlaysWithin } from '../../core/overlay-registry.js';
