import { InputElement } from './input.element.js';

if (!customElements.get('a11y-input')) {
  customElements.define('a11y-input', InputElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-input': InputElement;
  }
}

export { InputElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { bindField } from '../../core/field.js';
export { resetStrings, setStrings } from '../../core/strings.js';
