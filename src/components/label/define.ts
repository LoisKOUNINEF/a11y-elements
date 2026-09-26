import { LabelElement } from './label.element.js';

if (!customElements.get('a11y-label')) {
  customElements.define('a11y-label', LabelElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-label': LabelElement;
  }
}

export { LabelElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
