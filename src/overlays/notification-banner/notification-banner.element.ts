import { A11yPassiveOverlayElement, type PassiveOverlayItem } from '../core/a11y-passive-overlay-element.js';
import { getString } from '../../core/strings.js';
import { html } from '../../core/template.js';

export type NotificationBannerType = 'info' | 'success' | 'error';

export interface NotificationBannerOptions {
  type?: NotificationBannerType;
  position?: 'top' | 'bottom';
  actionText?: string;
  onAction?: () => void;
  onClose?: () => void;
  /** Sets the concurrency limit for this and all future items — sticky on the shared region, same as the `max-stack` attribute. */
  maxStack?: number;
}

interface NotificationBannerItem extends PassiveOverlayItem {
  type?: NotificationBannerType;
  onClose?: () => void;
}

/**
 * A persistent banner region (unlike `<a11y-snackbar>`, items never
 * auto-dismiss — they stay until the user dismisses them or `dismissAll()`
 * is called). Place one `<a11y-notification-banner>` in your page, then
 * call `.show(message, options)` on it — or use the `showNotificationBanner()`
 * convenience export, which finds-or-creates one automatically.
 *
 * `dismissAll()` is the framework-agnostic replacement for the old
 * `Lifecycle.onViewUnmount` auto-wiring (which assumed a specific SPA-router
 * service) — if you want banners cleared on navigation, call it yourself
 * from your own router's navigation hook. Unlike `<a11y-snackbar>` (which
 * deliberately finishes its own timer regardless of navigation), this
 * asymmetry is intentional, not an oversight — a banner is scoped to the
 * page that raised it, a toast isn't.
 *
 * Each item's close button is named by `dismiss-label="…"`, else
 * `setStrings({ dismiss })`.
 */
export class NotificationBannerElement extends A11yPassiveOverlayElement<NotificationBannerItem> {
  private _topContainer!: HTMLElement;
  private _bottomContainer!: HTMLElement;
  private _active: Array<{ el: HTMLElement; onClose?: () => void }> = [];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'dismiss-label'];
  }

  /** The accessible name of each item's close button. */
  get dismissLabel(): string {
    return this.stringAttr('dismiss-label', getString('dismiss'));
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (name === 'dismiss-label' && oldValue !== newValue) this._relabelDismissButtons();
  }

  protected override onStringsChange(): void {
    this._relabelDismissButtons();
  }

  private _relabelDismissButtons(): void {
    for (const { el } of this._active) {
      el.querySelector('.a11y-notification-banner__close')?.setAttribute('aria-label', this.dismissLabel);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('a11y-notification-banner-region');
    if (!this._topContainer) {
      this._topContainer = document.createElement('div');
      this._topContainer.className = 'a11y-notification-banner-region__top';
      this._bottomContainer = document.createElement('div');
      this._bottomContainer.className = 'a11y-notification-banner-region__bottom';
      this.append(this._topContainer, this._bottomContainer);
    }
  }

  show(message: string, options: NotificationBannerOptions = {}): void {
    if (options.maxStack) this.setMaxStack(options.maxStack);
    this.enqueue({
      message,
      type: options.type,
      position: options.position,
      actionText: options.actionText,
      onAction: options.onAction,
      onClose: options.onClose,
    });
  }

  /** Force-dismisses every showing/queued item. Queued items never shown are dropped silently (no onClose); active ones get their onClose called. */
  dismissAll(): void {
    this._queue = [];
    const toClose = this._active;
    this._active = [];
    this._activeCount = 0;
    toClose.forEach(({ el, onClose }) => {
      el.remove();
      onClose?.();
    });
  }

  protected _showItem(item: NotificationBannerItem): void {
    const type = item.type ?? 'info';
    const position = item.position ?? 'top';
    const container = position === 'top' ? this._topContainer : this._bottomContainer;

    const el = document.createElement('div');
    el.className = `a11y-notification-banner a11y-notification-banner--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.innerHTML = String(html`
      <span class="a11y-notification-banner__message">${item.message}</span>
      <span class="a11y-notification-banner__actions">
        ${item.actionText ? html`<button type="button" class="a11y-notification-banner__action">${item.actionText}</button>` : ''}
        <button type="button" class="a11y-notification-banner__close" aria-label="${this.dismissLabel}">&times;</button>
      </span>
    `);

    container.appendChild(el);

    const entry = { el, onClose: item.onClose };
    this._active.push(entry);

    const dismiss = (): void => {
      el.remove();
      this._active = this._active.filter((a) => a !== entry);
      item.onClose?.();
      this._onItemDismissed();
    };

    if (item.actionText && item.onAction) {
      const actionBtn = el.querySelector<HTMLButtonElement>('.a11y-notification-banner__action');
      actionBtn?.addEventListener('click', () => {
        item.onAction?.();
        dismiss();
      });
    }

    el.querySelector<HTMLButtonElement>('.a11y-notification-banner__close')?.addEventListener('click', dismiss);
  }
}
