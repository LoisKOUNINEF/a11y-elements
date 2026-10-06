import { defineElement } from '../../core/define-element.js';
import { PictureElement } from './picture.element.js';

defineElement('a11y-picture', PictureElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-picture': PictureElement;
  }
}

export { PictureElement };
export type { PictureImage, PictureSource } from './picture.element.js';
export * from '../../core/zero-build-exports.js';
