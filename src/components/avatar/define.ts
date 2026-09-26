import { AvatarElement } from './avatar.element.js';

if (!customElements.get('a11y-avatar')) {
  customElements.define('a11y-avatar', AvatarElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-avatar': AvatarElement;
  }
}

export { AvatarElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
