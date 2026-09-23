import { BlockingLoaderElement } from './blocking-loader.element.js';
// Ensures <a11y-spinner> is registered too, since blocking-loader composes one internally.
import '../../accessibility-components/spinner/define.js';

if (!customElements.get('a11y-blocking-loader')) {
  customElements.define('a11y-blocking-loader', BlockingLoaderElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-blocking-loader': BlockingLoaderElement;
  }
}

export { BlockingLoaderElement };
// Re-exported so zero-build `<script type="module">` users can reach it too.
export { dismissAllOverlays } from '../../core/overlay-registry.js';
