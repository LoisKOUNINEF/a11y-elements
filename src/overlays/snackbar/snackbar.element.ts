import { A11yPassiveOverlayElement, type PassiveOverlayItem } from '../core/a11y-passive-overlay-element.js';
import { html } from '../../core/template.js';

export type SnackbarType = 'info' | 'success' | 'error' | 'warning';

export interface NotifyOptions {
  type?: SnackbarType;
  position?: 'top' | 'bottom';
  duration?: number;
  actionText?: string;
  onAction?: () => void;
  /** Sets the concurrency limit for this and all future items — sticky on the shared region, same as the `max-stack` attribute. */
  maxStack?: number;
}

interface SnackbarItem extends PassiveOverlayItem {
  type?: SnackbarType;
}

/**
 * A toast notification region. Auto-dismisses after `duration`ms — default
 * 3000, or 10000 when the toast has an action button (time to reach it) —
 * paused while the toast is hovered or focused. Place one `<a11y-snackbar></a11y-snackbar>` anywhere in your page
 * (it portals itself to `document.body`), then call `.notify(message, options)`
 * on it — or skip placing one entirely and use the `notify()` convenience
 * export from this module, which finds-or-creates one automatically.
 */
export class SnackbarElement extends A11yPassiveOverlayElement<SnackbarItem> {
  private _bottomContainer!: HTMLElement;
  private _topContainer!: HTMLElement;

  override connectedCallback(): void {
    super.connectedCallback();
    this.classList.add('a11y-snackbar-region');
    if (!this._bottomContainer) {
      this._bottomContainer = document.createElement('div');
      this._bottomContainer.className = 'a11y-snackbar-region__bottom';
      this._topContainer = document.createElement('div');
      this._topContainer.className = 'a11y-snackbar-region__top';
      this.append(this._bottomContainer, this._topContainer);
    }
  }

  notify(message: string, options: NotifyOptions = {}): void {
    if (options.maxStack) this.setMaxStack(options.maxStack);
    this.enqueue({
      message,
      type: options.type,
      position: options.position,
      duration: options.duration,
      actionText: options.actionText,
      onAction: options.onAction,
    });
  }

  protected _showItem(item: SnackbarItem): void {
    const type = item.type ?? 'info';
    const position = item.position ?? 'bottom';
    const duration = item.duration ?? (item.actionText ? 10_000 : 3000);
    const container = position === 'bottom' ? this._bottomContainer : this._topContainer;

    const el = document.createElement('div');
    el.className = `a11y-snackbar a11y-snackbar--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.innerHTML = String(html`
      <span>${item.message}</span>
      ${item.actionText ? html`<button type="button">${item.actionText}</button>` : ''}
    `);

    container.appendChild(el);

    const cancelAutoDismiss = this._autoDismiss(el, duration, () => this._onItemDismissed());

    el.querySelector<HTMLButtonElement>('button')?.addEventListener('click', () => {
      cancelAutoDismiss();
      el.remove();
      this._onItemDismissed();
      item.onAction?.();
    });
  }
}
