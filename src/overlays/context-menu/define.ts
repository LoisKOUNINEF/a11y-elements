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
// Re-exported so zero-build `<script type="module">` users can reach it too.
export { dismissAllOverlays } from '../../core/overlay-registry.js';
