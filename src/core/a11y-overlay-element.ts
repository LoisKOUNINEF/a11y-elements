import { A11yElement } from './a11y-element.js';
import { registerOpenOverlay, unregisterOpenOverlay, emitOverlayOpen, emitOverlayClose } from './overlay-registry.js';

/**
 * Base for the overlay family (modal, drawer, popover, tooltip, snackbar,
 * blocking-loader, …). Declarative-first: the `open` attribute/property is
 * the primary interface — `<a11y-modal open>` behaves like native
 * `<dialog open>` — with `show()`/`close()` as thin convenience wrappers
 * around that same attribute, not a separate imperative lifecycle.
 *
 * Unlike `A11yElement`, this base does **not** drive `innerHTML` from a
 * `render()` string on every attribute change: many overlays (modal, popover,
 * tooltip) wrap real consumer-authored light-DOM children as their content,
 * and blowing away `innerHTML` would destroy that content. Instead, each
 * concrete overlay is fully responsible for its own DOM in `_show()`/`_hide()`
 * — some build/replace generated markup (blocking-loader), some wrap existing
 * children in backdrop/wrapper chrome (modal), some manage a list of
 * programmatically-created items (snackbar). `_onShown()`/`_onHidden()` are
 * the small pieces of behavior every overlay needs regardless: standardized
 * `a11y-overlay-open`/`a11y-overlay-close` events (the old code only fired
 * its equivalent inconsistently — 4 of 10 overlays) and registration with
 * the dismiss-all registry.
 *
 * Body-mounting: on connect, the element moves itself to be a direct child
 * of `document.body` if it isn't already — matching the old framework's
 * constructor-time force-mount — so a `position: fixed` backdrop/wrapper
 * isn't clipped or offset by an ancestor's `overflow`/`transform`. This
 * happens once, independent of `open`/`_show()`/`_hide()` churn.
 *
 * **Reparenting `this`** (modal/anchored overlays move `this` into
 * wrapper/backdrop chrome they build): moving an already-connected custom
 * element to a *different* parent — even one that's also already connected —
 * still fires `disconnectedCallback` then `connectedCallback` again (the DOM
 * spec's insertion algorithm removes-then-inserts when a node already has a
 * parent; this is not specific to jsdom). Left unguarded, that nested
 * `connectedCallback` calls `_show()` again while the outer `_show()` call
 * that triggered the move is still on the stack — infinite recursion (a real
 * bug this hit once). Subclasses must move `this` via `_moveSelfTo()` below,
 * never a raw `appendChild`/`insertBefore` — it suppresses exactly that
 * reentrant churn.
 */
export abstract class A11yOverlayElement extends A11yElement {
  static get observedAttributes(): string[] {
    return ['open'];
  }

  protected _isShowing = false;
  /**
   * True while `disconnectedCallback` tears down an overlay the consumer
   * removed from the document — `_hide()` implementations must then leave
   * `this` detached instead of moving it back to `document.body`.
   */
  protected _detaching = false;
  private _internalMove = false;

  get open(): boolean {
    return this.boolAttr('open');
  }

  set open(value: boolean) {
    this.setBoolAttr('open', value);
  }

  override connectedCallback(): void {
    if (this._internalMove) return; // reparented by our own _moveSelfTo() — not a real connect event
    this._connected = true;
    this._portalToBody();
    this.onConnect?.();
    if (!this.open) return;
    // `<a11y-modal open>` upgraded mid-parse (define script loaded
    // synchronously ahead of the markup) connects before its children are
    // parsed — defer the initial show until the document is, so `_show()`
    // sees the real content (heading, focusable elements).
    if (document.readyState === 'loading') this.afterParse(() => this._showIfStillOpen());
    else this._show();
  }

  override disconnectedCallback(): void {
    if (this._internalMove) return; // reparented by our own _moveSelfTo() — not a real disconnect event
    if (this._isShowing) {
      this._detaching = true;
      try {
        this._hide({ immediate: true });
      } finally {
        this._detaching = false;
      }
    }
    unregisterOpenOverlay(this);
    super.disconnectedCallback();
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this._connected) return;
    if (name !== 'open') {
      this.onAttributeChanged?.(name);
      return;
    }
    if (newValue !== null) this._show();
    else this._hide();
  }

  /**
   * Runs on every *real* connect (not the internal reparenting `_moveSelfTo()`
   * does) — the counterpart of `onDisconnect()`. Subclasses wire anchor/
   * trigger listeners here rather than overriding `connectedCallback`.
   */
  protected onConnect?(): void;

  /** Called for every observed attribute other than `open` that changes while connected. */
  protected onAttributeChanged?(name: string): void;

  /** Runs `callback` once the document has finished parsing (never, if it already has — call sites handle that case directly). */
  protected afterParse(callback: () => void): void {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  }

  private _showIfStillOpen(): void {
    if (this._connected && this.open && !this._isShowing) this._show();
  }

  /** Convenience wrapper — identical to `element.open = true`. */
  show(): void {
    this.open = true;
  }

  /** Convenience wrapper — identical to `element.open = false`. */
  close(): void {
    this.open = false;
  }

  private _portalToBody(): void {
    if (this.parentNode !== document.body) this._moveSelfTo(document.body);
  }

  /**
   * Moves `this` to be the last child of `newParent`, suppressing the
   * connected/disconnected lifecycle churn that a plain `appendChild` would
   * trigger (see the class doc). Use this — never a raw `appendChild`/
   * `insertBefore` on `this` — anywhere a subclass reparents itself while
   * building or tearing down wrapper/backdrop chrome.
   */
  protected _moveSelfTo(newParent: Node): void {
    this._internalMove = true;
    try {
      newParent.appendChild(this);
    } finally {
      this._internalMove = false;
    }
  }

  /** Build/animate in whatever DOM this overlay needs, then call `_onShown()`. */
  protected abstract _show(): void;

  /**
   * Tear down this overlay's DOM, then call `_onHidden()`. Implementations
   * should gate real removal on a `transitionend` event (not a timeout) to
   * match the CSS-driven animate-out contract, except when `immediate` is
   * set (used when the element is forcibly removed from the document while
   * still open — no animation to wait for).
   */
  protected abstract _hide(opts?: { immediate?: boolean }): void;

  protected _onShown(name: string = this.tagName.toLowerCase()): void {
    this._isShowing = true;
    registerOpenOverlay(this);
    emitOverlayOpen(name);
  }

  protected _onHidden(name: string = this.tagName.toLowerCase()): void {
    this._isShowing = false;
    unregisterOpenOverlay(this);
    emitOverlayClose(name);
  }

  /**
   * Unused by overlays — content is managed explicitly by each concrete
   * overlay in `_show()`/`_hide()`, never auto-replaced from a template
   * string, so that consumer-authored light-DOM children survive. Present
   * only to satisfy `A11yElement`'s abstract contract.
   */
  protected override render(): string {
    return '';
  }
}
