import { SpinnerElement } from './spinner.element.js';

if (!customElements.get('a11y-spinner')) {
  customElements.define('a11y-spinner', SpinnerElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-spinner': SpinnerElement;
  }
}

export { SpinnerElement };
