import { A11yPassiveOverlayElement, type PassiveOverlayItem } from '../core/a11y-passive-overlay-element.js';
import { getString } from '../../core/strings.js';
import { h, type Content } from '../../core/dom.js';

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
 *
 * Every toast has a round × close button in its top-right corner that
 * dismisses it early (without calling `onAction`). It's named by
 * `dismiss-label="…"`, else `setStrings({ dismiss })`.
 *
 * While the region stays in the page, toasts finish their own timers
 * regardless of navigation (call `dismissAll()` to clear them). Removing the
 * region from the document drops its toasts, queued ones included, and
 * cancels their timers; re-adding it starts empty.
 */
export class SnackbarElement extends A11yPassiveOverlayElement<SnackbarItem> {
  private _bottomContainer!: HTMLElement;
  private _topContainer!: HTMLElement;

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'dismiss-label'];
  }

  /** The accessible name of each toast's close button. */
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
    for (const btn of this.querySelectorAll('.a11y-snackbar__close')) btn.setAttribute('aria-label', this.dismissLabel);
  }

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
    this._drainQueue();
  }

  /** Removes every showing toast and drops queued ones, without calling `onAction`. */
  dismissAll(): void {
    this._queue = [];
    this._cancelAutoDismissTimers();
    this.querySelectorAll('.a11y-snackbar').forEach((toast) => toast.remove());
    this._activeCount = 0;
  }

  protected override _onRemoved(): void {
    this.dismissAll();
  }

  notify(message: Content, options: NotifyOptions = {}): void {
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
    el.append(h('span', { class: 'a11y-snackbar__message' }, item.message));
    if (item.actionText) el.append(h('button', { type: 'button', class: 'a11y-snackbar__action' }, item.actionText));
    el.append(h('button', { type: 'button', class: 'a11y-snackbar__close', 'aria-label': this.dismissLabel }, '\u00d7'));

    container.appendChild(el);

    const cancelAutoDismiss = this._autoDismiss(el, duration, () => this._onItemDismissed());

    const dismiss = (): void => {
      cancelAutoDismiss();
      el.remove();
      this._onItemDismissed();
    };

    el.querySelector<HTMLButtonElement>('.a11y-snackbar__action')?.addEventListener('click', () => {
      dismiss();
      item.onAction?.();
    });
    el.querySelector<HTMLButtonElement>('.a11y-snackbar__close')?.addEventListener('click', dismiss);
  }
}
