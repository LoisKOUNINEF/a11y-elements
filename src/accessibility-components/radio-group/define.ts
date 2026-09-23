import { RadioGroupElement } from './radio-group.element.js';

if (!customElements.get('a11y-radio-group')) {
  customElements.define('a11y-radio-group', RadioGroupElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-radio-group': RadioGroupElement;
  }
}

export { RadioGroupElement };
