import { AnchorElement } from './anchor.element.js';

if (!customElements.get('a11y-anchor')) {
  customElements.define('a11y-anchor', AnchorElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-anchor': AnchorElement;
  }
}

export { AnchorElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
