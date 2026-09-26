import { SpinnerElement } from './spinner.element.js';

if (!customElements.get('a11y-spinner')) {
  customElements.define('a11y-spinner', SpinnerElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-spinner': SpinnerElement;
  }
}

export { SpinnerElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
