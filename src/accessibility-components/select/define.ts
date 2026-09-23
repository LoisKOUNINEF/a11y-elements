import { SelectElement } from './select.element.js';

if (!customElements.get('a11y-select')) {
  customElements.define('a11y-select', SelectElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-select': SelectElement;
  }
}

export { SelectElement };
