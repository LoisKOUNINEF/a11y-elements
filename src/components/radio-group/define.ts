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
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
