import { VisuallyHiddenElement } from './visually-hidden.element.js';

if (!customElements.get('a11y-visually-hidden')) {
  customElements.define('a11y-visually-hidden', VisuallyHiddenElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-visually-hidden': VisuallyHiddenElement;
  }
}

export { VisuallyHiddenElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
