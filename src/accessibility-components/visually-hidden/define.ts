import { VisuallyHiddenElement } from './visually-hidden.element.js';

if (!customElements.get('a11y-visually-hidden')) {
  customElements.define('a11y-visually-hidden', VisuallyHiddenElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-visually-hidden': VisuallyHiddenElement;
  }
}

export { VisuallyHiddenElement };
