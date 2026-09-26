import { A11yOverlayElement } from '../../core/a11y-overlay-element.js';
import { lockScroll, unlockScroll } from '../../core/overlay-registry.js';
import { getString } from '../../core/strings.js';
import { html } from '../../core/template.js';

/**
 * A full-screen, non-dismissible loading overlay — for blocking operations
 * where the user genuinely cannot interact with the page (no close button,
 * no backdrop click, no Escape — that's intentional, not a UI bug to fix).
 * While shown, every other child of `<body>` is made `inert` (so keyboard
 * and assistive-tech users can't reach the page it's blocking either — a
 * dimmed backdrop only blocks the mouse) and focus moves onto the loader;
 * both are restored on close.
 *
 * ```html
 * <a11y-blocking-loader message="Saving your changes…"></a11y-blocking-loader>
 * ```
 *
 * Composes a real `<a11y-spinner>` child directly — the framework-agnostic
 * replacement for the old `[data-component]`/`childConfigs()` composition
 * model, which needed a whole registry indirection just to mount a nested
 * component; here it's just `document.createElement`.
 */
export class BlockingLoaderElement extends A11yOverlayElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'message'];
  }

  get message(): string | undefined {
    return this.optionalStringAttr('message');
  }

  private _inerted: Element[] = [];
  private _returnFocusTo: HTMLElement | null = null;

  protected override onAttributeChanged(name: string): void {
    if (name === 'message' && this._isShowing) this._renderContent();
  }

  protected override onStringsChange(): void {
    if (this._isShowing) this._renderContent();
  }

  protected override _show(): void {
    if (this._isShowing) return;
    lockScroll();
    this.setAttribute('role', 'alert');
    this.setAttribute('aria-live', 'assertive');
    this.setAttribute('tabindex', '-1');
    this.classList.add('a11y-blocking-loader-overlay');
    this._renderContent();

    for (const child of Array.from(document.body.children)) {
      if (child === this || child.hasAttribute('inert')) continue;
      child.setAttribute('inert', '');
      this._inerted.push(child);
    }
    this._returnFocusTo = document.activeElement as HTMLElement | null;
    this.focus({ preventScroll: true });

    this._onShown();
  }

  protected override _hide(): void {
    if (!this._isShowing) return;
    unlockScroll();
    this.innerHTML = '';
    this.classList.remove('a11y-blocking-loader-overlay');
    this.removeAttribute('role');
    this.removeAttribute('aria-live');
    this.removeAttribute('tabindex');

    for (const el of this._inerted) el.removeAttribute('inert');
    this._inerted = [];
    const returnTo = this._returnFocusTo;
    this._returnFocusTo = null;
    if (returnTo?.isConnected && !this._detaching) returnTo.focus({ preventScroll: true });

    this._onHidden();
  }

  private _renderContent(): void {
    const message = this.message;
    this.innerHTML = String(html`<a11y-spinner size="3rem" label="${message ?? getString('loading')}"></a11y-spinner>${
      message ? html`<p class="a11y-blocking-loader-overlay__message">${message}</p>` : ''
    }`);
  }
}
