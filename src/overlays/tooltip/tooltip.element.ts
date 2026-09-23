import { A11yAnchoredOverlayElement } from '../core/a11y-anchored-overlay-element.js';

let idCounter = 0;

/**
 * A hover/focus-triggered tooltip anchored to a trigger element. Never
 * traps focus — shows after `show-delay`ms of hover/focus, hides after
 * `hide-delay`ms once the pointer/focus leaves, debounced so a quick pass
 * doesn't flash it. The anchor gets `aria-describedby` pointing at this
 * element, so screen readers announce the tooltip text with it. Moving the
 * pointer onto the tooltip itself keeps it open, and Escape dismisses it
 * (WCAG 1.4.13: hoverable + dismissible).
 *
 * ```html
 * <button id="save-btn">Save</button>
 * <a11y-tooltip anchor="save-btn">Saves your changes</a11y-tooltip>
 * ```
 */
export class TooltipElement extends A11yAnchoredOverlayElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'show-delay', 'hide-delay'];
  }

  private _showTimer: ReturnType<typeof setTimeout> | null = null;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;
  private _boundAnchorEl: HTMLElement | null = null;
  private _boundShow = (): void => this._scheduleShow();
  private _boundHide = (): void => this._scheduleHide();

  get showDelay(): number {
    return this.numberAttr('show-delay', 300);
  }

  get hideDelay(): number {
    return this.numberAttr('hide-delay', 100);
  }

  protected override wantsFocusTrap(): boolean {
    return false;
  }

  protected override onConnect(): void {
    if (!this.id) this.id = `a11y-tooltip-${++idCounter}`;
    this._bindAnchorListeners();
    // Anchor not parsed yet (tooltip authored before it, define script loaded synchronously).
    if (!this._boundAnchorEl) this.afterParse(() => this._bindAnchorListeners());
  }

  protected override onDisconnect(): void {
    this._unbindAnchorListeners();
    this._clearTimers();
  }

  protected override onAnchorChanged(): void {
    super.onAnchorChanged();
    if (this._connected) this._bindAnchorListeners();
  }

  protected override _show(): void {
    super._show();
    const wrapper = this._wrapper;
    if (!wrapper) return;
    wrapper.addEventListener('mouseenter', () => this._clearTimers());
    wrapper.addEventListener('mouseleave', this._boundHide);
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    el.classList.add('a11y-tooltip-wrapper');
    el.setAttribute('role', 'tooltip');
    return el;
  }

  protected override getContentClass(): string {
    return 'a11y-tooltip-content';
  }

  /** Detaches from the anchor entirely (unlike `close()`, which just hides the current tooltip — it can still reopen on the next hover). */
  dispose(): void {
    this._unbindAnchorListeners();
    this._clearTimers();
    this.close();
  }

  private _bindAnchorListeners(): void {
    const anchor = this.anchorElement;
    if (anchor === this._boundAnchorEl) return;
    this._unbindAnchorListeners();
    if (!anchor) return;
    anchor.addEventListener('mouseenter', this._boundShow);
    anchor.addEventListener('focus', this._boundShow);
    anchor.addEventListener('mouseleave', this._boundHide);
    anchor.addEventListener('blur', this._boundHide);
    this._setDescribedBy(anchor, true);
    this._boundAnchorEl = anchor;
  }

  private _unbindAnchorListeners(): void {
    const anchor = this._boundAnchorEl;
    if (!anchor) return;
    anchor.removeEventListener('mouseenter', this._boundShow);
    anchor.removeEventListener('focus', this._boundShow);
    anchor.removeEventListener('mouseleave', this._boundHide);
    anchor.removeEventListener('blur', this._boundHide);
    this._setDescribedBy(anchor, false);
    this._boundAnchorEl = null;
  }

  /** Adds/removes this tooltip's id in the anchor's `aria-describedby` token list, preserving any ids the consumer set. */
  private _setDescribedBy(anchor: HTMLElement, present: boolean): void {
    const ids = (anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id && id !== this.id);
    if (present) ids.push(this.id);
    if (ids.length) anchor.setAttribute('aria-describedby', ids.join(' '));
    else anchor.removeAttribute('aria-describedby');
  }

  private _scheduleShow(): void {
    this._clearTimers();
    this._showTimer = setTimeout(() => {
      this.open = true;
    }, this.showDelay);
  }

  private _scheduleHide(): void {
    this._clearTimers();
    this._hideTimer = setTimeout(() => {
      this.open = false;
    }, this.hideDelay);
  }

  private _clearTimers(): void {
    if (this._showTimer) {
      clearTimeout(this._showTimer);
      this._showTimer = null;
    }
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
  }
}
