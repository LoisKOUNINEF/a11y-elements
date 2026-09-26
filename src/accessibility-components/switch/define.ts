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
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
