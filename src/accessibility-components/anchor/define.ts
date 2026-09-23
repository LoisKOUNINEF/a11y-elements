import { AnchorElement } from './anchor.element.js';

if (!customElements.get('a11y-anchor')) {
  customElements.define('a11y-anchor', AnchorElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-anchor': AnchorElement;
  }
}

export { AnchorElement };
