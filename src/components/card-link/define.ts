import { CardLinkElement } from './card-link.element.js';

if (!customElements.get('a11y-card-link')) {
  customElements.define('a11y-card-link', CardLinkElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-card-link': CardLinkElement;
  }
}

export { CardLinkElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
