import { FocusableElement } from './focusable.element.js';

if (!customElements.get('a11y-focusable')) {
  customElements.define('a11y-focusable', FocusableElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-focusable': FocusableElement;
  }
}

export { FocusableElement };
