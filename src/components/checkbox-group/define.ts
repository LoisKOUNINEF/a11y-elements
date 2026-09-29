import { CheckboxGroupElement } from './checkbox-group.element.js';

if (!customElements.get('a11y-checkbox-group')) {
  customElements.define('a11y-checkbox-group', CheckboxGroupElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-checkbox-group': CheckboxGroupElement;
  }
}

export { CheckboxGroupElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
