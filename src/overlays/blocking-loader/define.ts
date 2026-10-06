import { defineElement } from '../../core/define-element.js';
import { BlockingLoaderElement } from './blocking-loader.element.js';
// Ensures <a11y-spinner> is registered too, since blocking-loader composes one internally.
import '../../components/spinner/define.js';

defineElement('a11y-blocking-loader', BlockingLoaderElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-blocking-loader': BlockingLoaderElement;
  }
}

export { BlockingLoaderElement };
export * from '../core/zero-build-exports.js';
