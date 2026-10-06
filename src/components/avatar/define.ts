import { defineElement } from '../../core/define-element.js';
import { AvatarElement } from './avatar.element.js';

defineElement('a11y-avatar', AvatarElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-avatar': AvatarElement;
  }
}

export { AvatarElement };
export * from '../../core/zero-build-exports.js';
