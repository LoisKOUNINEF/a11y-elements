import { A11yElement } from '../../core/a11y-element.js';

export type PassiveOverlayPosition = 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface PassiveOverlayItem {
  message: string;
  position?: PassiveOverlayPosition;
  duration?: number;
  actionText?: string;
  onAction?: () => void;
}

/**
 * Base for "region" overlays (snackbar, notification-banner) that don't fit
 * the single open/close model `A11yOverlayElement` covers — a passive region
 * is a persistent live-region container the consumer places once in their
 * HTML, and items are shown/dismissed inside it continuously via `enqueue()`
 * (bounded-concurrency FIFO: at most `maxStack` items shown at once, the
 * rest queued), not toggled as a whole.
 */
export abstract class A11yPassiveOverlayElement<TItem extends PassiveOverlayItem = PassiveOverlayItem> extends A11yElement {
  protected _queue: TItem[] = [];
  protected _activeCount = 0;
  private _maxStack = 1;

  override connectedCallback(): void {
    this._connected = true;
    if (this.parentNode !== document.body) document.body.appendChild(this);
    this.setAttribute('aria-live', 'polite');
    this.setAttribute('aria-atomic', 'false');
    this.setAttribute('aria-relevant', 'additions removals');
    this.classList.add('a11y-passive-overlay-region');
  }

  setMaxStack(n: number): void {
    this._maxStack = Math.max(1, n);
  }

  protected enqueue(item: TItem): void {
    if (this._activeCount < this._maxStack) {
      this._activeCount++;
      this._showItem(item);
    } else {
      this._queue.push(item);
    }
  }

  protected _onItemDismissed(): void {
    this._activeCount--;
    if (this._queue.length > 0 && this._activeCount < this._maxStack) {
      const next = this._queue.shift()!;
      this._activeCount++;
      this._showItem(next);
    }
  }

  protected abstract _showItem(item: TItem): void;

  /**
   * Removes `element` and calls `onDone` after `duration`ms of it being
   * *unattended*: the countdown pauses while the pointer is over the item or
   * focus is inside it (e.g. on its action button), and resumes with the
   * remaining time once both leave (WCAG 2.2.1 — a user reading or reaching
   * for a toast mustn't have it vanish under them). Returns a function that
   * cancels the auto-dismiss entirely.
   */
  protected _autoDismiss(element: HTMLElement, duration: number, onDone: () => void): () => void {
    let remaining = duration;
    let startedAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hovered = false;
    let focused = false;

    const run = (): void => {
      startedAt = Date.now();
      timer = setTimeout(() => {
        cancel();
        element.remove();
        onDone();
      }, remaining);
    };
    const pause = (): void => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      remaining = Math.max(0, remaining - (Date.now() - startedAt));
    };
    const refresh = (): void => {
      if (hovered || focused) pause();
      else if (!timer) run();
    };
    const onEnter = (): void => { hovered = true; refresh(); };
    const onLeave = (): void => { hovered = false; refresh(); };
    const onFocusIn = (): void => { focused = true; refresh(); };
    const onFocusOut = (e: FocusEvent): void => {
      if (element.contains(e.relatedTarget as Node | null)) return;
      focused = false;
      refresh();
    };
    const cancel = (): void => {
      if (timer) clearTimeout(timer);
      timer = null;
      element.removeEventListener('mouseenter', onEnter);
      element.removeEventListener('mouseleave', onLeave);
      element.removeEventListener('focusin', onFocusIn);
      element.removeEventListener('focusout', onFocusOut);
    };

    element.addEventListener('mouseenter', onEnter);
    element.addEventListener('mouseleave', onLeave);
    element.addEventListener('focusin', onFocusIn);
    element.addEventListener('focusout', onFocusOut);
    run();
    return cancel;
  }

  /** Unused — items are appended/removed directly by `_showItem`, never generated from a template. */
  protected override render(): string {
    return '';
  }
}
