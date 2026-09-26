import { CheckboxElement } from './checkbox.element.js';

if (!customElements.get('a11y-checkbox')) {
  customElements.define('a11y-checkbox', CheckboxElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-checkbox': CheckboxElement;
  }
}

export { CheckboxElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
