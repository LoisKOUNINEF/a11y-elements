import { SwitchElement } from './switch.element.js';

if (!customElements.get('a11y-switch')) {
  customElements.define('a11y-switch', SwitchElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-switch': SwitchElement;
  }
}

export { SwitchElement };
