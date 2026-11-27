import { A11yElement } from '../../core/a11y-element.js';
import { forgetPortalOrigin, recordPortalOrigin } from '../../core/overlay-registry.js';
import type { Content } from '../../core/dom.js';
import { doc } from '../../core/safe-dom.js';

const DEFAULT_MAX_STACK = 3;
/** setTimeout's limit: longer (or `Infinity`) delays overflow to 0 and fire at once. */
const MAX_TIMEOUT_MS = 2_147_483_647;

export type PassiveOverlayPosition = 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const PASSIVE_OVERLAY_POSITIONS: readonly PassiveOverlayPosition[] = ['top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

export interface PassiveOverlayItem {
  /** Text, nodes, or markup from `raw()`/`trustedRaw()`. */
  message: Content;
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
 * (bounded-concurrency FIFO: at most `max-stack` items — default 3 — shown
 * at once, the rest queued), not toggled as a whole.
 *
 * Items only show while the region is in the document: one enqueued while
 * it's detached waits in the queue. When the region is removed (and not
 * just moved: the check runs a microtask later), every pending auto-dismiss
 * timer is cancelled and `_onRemoved()` runs, so nothing keeps firing for a
 * page that's gone.
 */
export abstract class A11yPassiveOverlayElement<TItem extends PassiveOverlayItem = PassiveOverlayItem> extends A11yElement {
  static get observedAttributes(): string[] {
    return ['max-stack'];
  }

  protected _queue: TItem[] = [];
  protected _activeCount = 0;
  /** Cancel functions of every running `_autoDismiss()` countdown. */
  private _autoDismissCancels = new Set<() => void>();

  override connectedCallback(): void {
    this._initConnect();
    this._connected = true;
    const origin = this.parentNode;
    if (origin !== doc.body) {
      doc.body.appendChild(this);
      // Recorded only now: that move ran a nested disconnect, which forgets the origin.
      if (origin instanceof Element) recordPortalOrigin(this, origin);
    }
    this.setAttribute('aria-live', 'polite');
    this.setAttribute('aria-atomic', 'false');
    this.setAttribute('aria-relevant', 'additions removals');
    this.classList.add('a11y-passive-overlay-region');
  }

  override disconnectedCallback(): void {
    forgetPortalOrigin(this);
    super.disconnectedCallback();
    // A move (including our own portal to <body> above) disconnects and
    // reconnects synchronously; only tear down if we're still out afterwards.
    queueMicrotask(() => {
      if (!this.isConnected) this._onRemoved();
    });
  }

  /**
   * Runs once the region has been removed from the document (not just moved).
   * The base cancels every pending auto-dismiss timer; subclasses may also
   * drop their items.
   */
  protected _onRemoved(): void {
    this._cancelAutoDismissTimers();
  }

  /** Stops every pending `_autoDismiss()` countdown without dismissing anything. */
  protected _cancelAutoDismissTimers(): void {
    for (const cancel of Array.from(this._autoDismissCancels)) cancel();
  }

  /** Never re-renders (that would wipe the item containers) — a raised `max-stack` just shows queued items. */
  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    if (name === 'max-stack') this._drainQueue();
  }

  /** How many items may show at once (`max-stack` attribute, default 3); the rest wait in a FIFO queue. */
  get maxStack(): number {
    return Math.max(1, Math.floor(this.numberAttr('max-stack', DEFAULT_MAX_STACK)));
  }

  set maxStack(n: number) {
    this.setAttribute('max-stack', String(Math.max(1, n)));
  }

  /** Alias for `el.maxStack = n`. */
  setMaxStack(n: number): void {
    this.maxStack = n;
  }

  protected enqueue(item: TItem): void {
    this._queue.push(item);
    this._drainQueue();
  }

  protected _onItemDismissed(): void {
    this._activeCount--;
    this._drainQueue();
  }

  /** Shows queued items up to `maxStack` — only while connected (subclasses call this once their containers exist). */
  protected _drainQueue(): void {
    if (!this.isConnected) return;
    while (this._queue.length > 0 && this._activeCount < this.maxStack) {
      const next = this._queue.shift()!;
      this._activeCount++;
      this._showItem(next);
    }
  }

  protected abstract _showItem(item: TItem): void;

  /**
   * The default position set in CSS through `property` (e.g.
   * `:root { --a11y-snackbar-position: top-right; }`), read when an item is
   * shown, or `undefined` when it's unset or not one of `allowed`. Quotes and
   * surrounding spaces are ignored. Also `undefined` without
   * `getComputedStyle` (SSR DOMs).
   */
  protected _cssPosition<P extends PassiveOverlayPosition>(property: string, allowed: readonly P[]): P | undefined {
    if (typeof getComputedStyle !== 'function') return undefined;
    const value = getComputedStyle(this).getPropertyValue(property).trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    return (allowed as readonly string[]).includes(value) ? (value as P) : undefined;
  }

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
      if (remaining > MAX_TIMEOUT_MS) return; // `Infinity` or longer than a timer can wait: never auto-dismiss
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
      this._autoDismissCancels.delete(cancel);
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
    this._autoDismissCancels.add(cancel);
    run();
    return cancel;
  }

  /** Unused — items are appended/removed directly by `_showItem`, never generated from a template. */
  protected override render(): null {
    return null;
  }
}
