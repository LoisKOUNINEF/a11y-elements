import { FileInputElement } from './file-input.element.js';

if (!customElements.get('a11y-file-input')) {
  customElements.define('a11y-file-input', FileInputElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-file-input': FileInputElement;
  }
}

export { FileInputElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { bindField } from '../../core/field.js';
export { resetStrings, setStrings } from '../../core/strings.js';
