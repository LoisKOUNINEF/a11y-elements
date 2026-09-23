import { PictureElement } from './picture.element.js';

if (!customElements.get('a11y-picture')) {
  customElements.define('a11y-picture', PictureElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-picture': PictureElement;
  }
}

export { PictureElement };
