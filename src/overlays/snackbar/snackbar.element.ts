import {
  A11yPassiveOverlayElement,
  PASSIVE_OVERLAY_POSITIONS,
  type PassiveOverlayItem,
  type PassiveOverlayPosition,
} from '../core/a11y-passive-overlay-element.js';
import { getString } from '../../core/strings.js';
import { h, type Content } from '../../core/dom.js';
import { doc } from '../../core/safe-dom.js';

export type SnackbarType = 'info' | 'success' | 'error' | 'warning';

export interface NotifyOptions {
  type?: SnackbarType;
  /** Defaults to `--a11y-snackbar-position` from CSS, else `bottom`. */
  position?: PassiveOverlayPosition;
  duration?: number;
  actionText?: string;
  onAction?: () => void;
  /** Called once the toast is gone: × button, action button (after `onAction`), timeout or `dismissAll()`. */
  onClose?: () => void;
  /** Sets the concurrency limit for this and all future items — sticky on the shared region, same as the `max-stack` attribute. */
  maxStack?: number;
}

interface SnackbarItem extends PassiveOverlayItem {
  type?: SnackbarType;
  onClose?: () => void;
}

interface ActiveToast {
  el: HTMLElement;
  onClose?: () => void;
  cancelAutoDismiss: () => void;
}

/**
 * A toast notification region. Auto-dismisses after `duration`ms — default
 * 3000, or 10000 when the toast has an action button (time to reach it) —
 * paused while the toast is hovered or focused. Place one `<a11y-snackbar></a11y-snackbar>` anywhere in your page
 * (it portals itself to `document.body`), then call `.notify(message, options)`
 * on it — or skip placing one entirely and use the `notify()` convenience
 * export from this module, which finds-or-creates one automatically.
 *
 * Each toast shows at its `position` option, else at the position set in CSS
 * with `--a11y-snackbar-position` (`top`, `bottom`, `top-left`, `top-right`,
 * `bottom-left` or `bottom-right`; read when the toast is shown), else at the
 * bottom. Every toast has a round × close button in its top-right corner that
 * dismisses it early (without calling `onAction`). It's named by
 * `dismiss-label="…"`, else `setStrings({ dismiss })`. `onClose` runs
 * whenever a toast that was shown goes away, timeout included.
 *
 * While the region stays in the page, toasts finish their own timers
 * regardless of navigation (call `dismissAll()` to clear them). Removing the
 * region from the document drops its toasts, queued ones included, and
 * cancels their timers; re-adding it starts empty.
 */
export class SnackbarElement extends A11yPassiveOverlayElement<SnackbarItem> {
  /** One container per position, created on first use. */
  private _containers = new Map<PassiveOverlayPosition, HTMLElement>();
  private _active: ActiveToast[] = [];

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
    this._drainQueue();
  }

  private _container(position: PassiveOverlayPosition): HTMLElement {
    let container = this._containers.get(position);
    if (!container) {
      container = doc.createElement('div');
      // `__top` / `__bottom`: the class names of the two containers before corners existed.
      container.className = `a11y-snackbar-region__stack${position === 'top' || position === 'bottom' ? ` a11y-snackbar-region__${position}` : ''}`;
      container.dataset.position = position;
      this._containers.set(position, container);
      this.append(container);
    }
    return container;
  }

  /**
   * Removes every showing toast (calling its `onClose`) and drops queued
   * ones silently, without calling `onAction`.
   */
  dismissAll(): void {
    this._queue = [];
    this._cancelAutoDismissTimers();
    const toClose = this._active;
    this._active = [];
    this._activeCount = 0;
    toClose.forEach(({ el, onClose }) => {
      el.remove();
      onClose?.();
    });
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
      onClose: options.onClose,
    });
  }

  protected _showItem(item: SnackbarItem): void {
    const type = item.type ?? 'info';
    const position =
      (item.position && PASSIVE_OVERLAY_POSITIONS.includes(item.position) ? item.position : undefined) ??
      this._cssPosition('--a11y-snackbar-position', PASSIVE_OVERLAY_POSITIONS) ??
      'bottom';
    const duration = item.duration ?? (item.actionText ? 10_000 : 3000);
    const container = this._container(position);

    const el = doc.createElement('div');
    el.className = `a11y-snackbar a11y-snackbar--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.append(h('span', { class: 'a11y-snackbar__message' }, item.message));
    if (item.actionText) el.append(h('button', { type: 'button', class: 'a11y-snackbar__action' }, item.actionText));
    el.append(h('button', { type: 'button', class: 'a11y-snackbar__close', 'aria-label': this.dismissLabel }, '\u00d7'));

    container.appendChild(el);

    const entry: ActiveToast = { el, onClose: item.onClose, cancelAutoDismiss: () => {} };
    this._active.push(entry);

    /** Takes the toast off screen and counts it out; false if it was already gone (e.g. `dismissAll()` ran). */
    const remove = (): boolean => {
      if (!this._active.includes(entry)) return false;
      entry.cancelAutoDismiss();
      el.remove();
      this._active = this._active.filter((a) => a !== entry);
      // Counted out before the callbacks run: a `dismissAll()` from there resets the count itself.
      this._onItemDismissed();
      return true;
    };
    const dismiss = (): void => {
      if (remove()) item.onClose?.();
    };

    entry.cancelAutoDismiss = this._autoDismiss(el, duration, dismiss);

    el.querySelector<HTMLButtonElement>('.a11y-snackbar__action')?.addEventListener('click', () => {
      if (!remove()) return;
      item.onAction?.();
      item.onClose?.();
    });
    el.querySelector<HTMLButtonElement>('.a11y-snackbar__close')?.addEventListener('click', dismiss);
  }
}
