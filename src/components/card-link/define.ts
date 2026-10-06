import { defineElement } from '../../core/define-element.js';
import { CardLinkElement } from './card-link.element.js';

defineElement('a11y-card-link', CardLinkElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-card-link': CardLinkElement;
  }
}

export { CardLinkElement };
export * from '../../core/zero-build-exports.js';
