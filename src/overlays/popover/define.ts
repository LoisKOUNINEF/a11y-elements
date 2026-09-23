import { PopoverElement } from './popover.element.js';

if (!customElements.get('a11y-popover')) {
  customElements.define('a11y-popover', PopoverElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-popover': PopoverElement;
  }
}

export { PopoverElement };
// Re-exported so zero-build `<script type="module">` users can reach it too.
export { dismissAllOverlays } from '../../core/overlay-registry.js';
