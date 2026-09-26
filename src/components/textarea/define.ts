import { TextareaElement } from './textarea.element.js';

if (!customElements.get('a11y-textarea')) {
  customElements.define('a11y-textarea', TextareaElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-textarea': TextareaElement;
  }
}

export { TextareaElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { bindField } from '../../core/field.js';
export { resetStrings, setStrings } from '../../core/strings.js';
