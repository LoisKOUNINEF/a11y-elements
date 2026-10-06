import { defineElement } from '../../core/define-element.js';
import type { Raw } from '../../core/template.js';
import { SnackbarElement, type NotifyOptions } from './snackbar.element.js';

defineElement('a11y-snackbar', SnackbarElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-snackbar': SnackbarElement;
  }
}

export { SnackbarElement, type NotifyOptions };

let cachedRegion: SnackbarElement | null = null;

function getRegion(): SnackbarElement {
  const existing = document.querySelector<SnackbarElement>('a11y-snackbar');
  if (existing) return existing;
  if (!cachedRegion || !cachedRegion.isConnected) {
    cachedRegion = document.createElement('a11y-snackbar') as SnackbarElement;
    document.body.appendChild(cachedRegion);
  }
  return cachedRegion;
}

/**
 * Convenience: finds (or creates) an `<a11y-snackbar>` region and shows a
 * toast in it. Skip this entirely and call `.notify()` on your own
 * `<a11y-snackbar>` element directly if you want explicit control over
 * where it lives in the DOM.
 */
export function notify(message: string | Raw, options: NotifyOptions = {}): void {
  getRegion().notify(message, options);
}

export * from '../core/zero-build-exports.js';
