import { FocusableElement } from './focusable.element.js';

if (!customElements.get('a11y-focusable')) {
  customElements.define('a11y-focusable', FocusableElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-focusable': FocusableElement;
  }
}

export { FocusableElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
