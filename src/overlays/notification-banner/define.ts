import { defineElement } from '../../core/define-element.js';
import type { Raw } from '../../core/template.js';
import { NotificationBannerElement, type NotificationBannerOptions } from './notification-banner.element.js';

defineElement('a11y-notification-banner', NotificationBannerElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-notification-banner': NotificationBannerElement;
  }
}

export { NotificationBannerElement, type NotificationBannerOptions };

let cachedRegion: NotificationBannerElement | null = null;

function getRegion(): NotificationBannerElement {
  const existing = document.querySelector<NotificationBannerElement>('a11y-notification-banner');
  if (existing) return existing;
  if (!cachedRegion || !cachedRegion.isConnected) {
    cachedRegion = document.createElement('a11y-notification-banner') as NotificationBannerElement;
    document.body.appendChild(cachedRegion);
  }
  return cachedRegion;
}

/**
 * Convenience: finds (or creates) an `<a11y-notification-banner>` region and
 * shows a banner in it. Skip this entirely and call `.show()` on your own
 * `<a11y-notification-banner>` element directly if you want explicit control
 * over where it lives in the DOM.
 */
export function showNotificationBanner(message: string | Raw, options: NotificationBannerOptions = {}): void {
  getRegion().show(message, options);
}

export * from '../core/zero-build-exports.js';
