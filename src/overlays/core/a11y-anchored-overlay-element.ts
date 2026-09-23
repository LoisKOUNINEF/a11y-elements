import { A11yOverlayElement } from '../../core/a11y-overlay-element.js';
import { FocusTrapHelper, type IFocusTrapOptions } from '../../core/focus-trap.js';
import { whenTransitionDone } from '../../core/transition.js';

export type AnchoredSide = 'top' | 'bottom' | 'left' | 'right';
export type AnchoredAlign = 'start' | 'end';
export type AnchoredPlacement = AnchoredSide | `${AnchoredSide}-${AnchoredAlign}`;

/**
 * Base for overlays positioned relative to an anchor element or point
 * (popover, tooltip, dropdown, and — via `A11yMenuOverlayElement` —
 * dropdown-menu/context-menu). `this` (the custom element, holding the
 * consumer's own light-DOM content) is moved into a `wrapper` div appended
 * to `document.body` on show, and moved back out before the wrapper is torn
 * down on hide — the same portal dance `A11yOverlayElement` documents,
 * scoped to this overlay family's extra positioning chrome.
 *
 * The flip/clamp positioning math and the deferred-outside-click dismissal
 * are ported near-verbatim from the old framework version — both were
 * already framework-free hand-rolled DOM/geometry code with nothing to do
 * with the old base classes.
 */
export abstract class A11yAnchoredOverlayElement extends A11yOverlayElement {
  static override get observedAttributes(): string[] {
    return ['open', 'anchor', 'placement', 'offset'];
  }

  protected _wrapper: HTMLElement | null = null;
  private _anchorEl: HTMLElement | null = null;
  private _anchorRect: DOMRect | null = null;
  private _focusTrap: FocusTrapHelper | null = null;
  private _boundOutsideClick: ((e: MouseEvent) => void) | null = null;
  private _outsideClickTimer: ReturnType<typeof setTimeout> | null = null;
  private _boundKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _boundReposition: (() => void) | null = null;
  private _resizeObserver: ResizeObserver | null = null;
  private _pendingHide: (() => void) | null = null;
  private _cancelHideWait: (() => void) | null = null;

  /** The element to anchor to: an explicit `.anchorElement` property, or the `anchor="<id>"` attribute. */
  get anchorElement(): HTMLElement | null {
    if (this._anchorEl) return this._anchorEl;
    const id = this.getAttribute('anchor');
    return id ? document.getElementById(id) : null;
  }

  set anchorElement(el: HTMLElement | null) {
    this._anchorEl = el;
    this._anchorRect = null;
    this.onAnchorChanged();
  }

  /**
   * Called whenever the anchor may have changed (`anchor` attribute,
   * `.anchorElement` property). Subclasses that wire listeners/ARIA onto the
   * anchor re-bind here — call `super.onAnchorChanged()`.
   */
  protected onAnchorChanged(): void {
    if (this._wrapper) this.updatePosition();
  }

  protected override onAttributeChanged(name: string): void {
    if (name === 'anchor') this.onAnchorChanged();
    else if (this._wrapper) this.updatePosition(); // placement / offset
  }

  /** Anchors to a fixed viewport point instead of an element (used by context menus). */
  protected setAnchorPoint(x: number, y: number): void {
    this._anchorEl = null;
    this._anchorRect = new DOMRect(x, y, 0, 0);
  }

  get placement(): AnchoredPlacement {
    return (this.getAttribute('placement') as AnchoredPlacement | null) ?? 'bottom';
  }

  get offset(): number {
    return this.numberAttr('offset', 8);
  }

  /** Override to force focus-trapping on/off/conditional (menus always force it off; popovers derive it from `interactive`). */
  protected wantsFocusTrap(): boolean {
    return this.boolAttr('trap-focus');
  }

  protected createWrapper(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'a11y-anchored-overlay-wrapper';
    return el;
  }

  protected getContentClass(): string {
    return 'a11y-anchored-overlay-content';
  }

  protected override _show(): void {
    // Reopened mid-close: complete that close first (see A11yModalOverlayElement).
    this._flushPendingHide();
    // Re-shown while already open (e.g. a context menu re-right-clicked
    // elsewhere): drop the current chrome and its listeners, then rebuild.
    if (this._wrapper) this._teardownChrome();

    const wrapper = this.createWrapper();
    document.body.appendChild(wrapper);
    this.classList.add(this.getContentClass());
    this._moveSelfTo(wrapper); // see A11yOverlayElement's class doc on why this isn't a raw appendChild
    this._wrapper = wrapper;

    this.updatePosition();
    this._bindDismissListeners(wrapper);
    this._bindRepositionListeners(wrapper);

    if (this.wantsFocusTrap()) {
      this._focusTrap = new FocusTrapHelper({ container: wrapper, options: this._focusTrapOptions() });
      this._focusTrap.activate();
    }

    requestAnimationFrame(() => wrapper.classList.add('a11y-is-open'));
    if (!this._isShowing) this._onShown();
  }

  protected override _hide(opts?: { immediate?: boolean }): void {
    this._unbindActiveListeners();

    const wrapper = this._wrapper;
    if (!wrapper) {
      if (this._pendingHide) {
        if (opts?.immediate) this._flushPendingHide();
      } else if (this._isShowing) {
        this._onHidden();
      }
      return;
    }
    this._wrapper = null;

    const finish = (): void => {
      this._pendingHide = null;
      this._cancelHideWait = null;
      this.classList.remove(this.getContentClass());
      // Detach from the wrapper before it's removed — unless the consumer is
      // removing this element from the document, which must stay removed.
      if (!this._detaching) this._moveSelfTo(document.body);
      wrapper.remove();
      this._onHidden();
    };
    this._pendingHide = finish;

    if (opts?.immediate) {
      finish();
      return;
    }
    wrapper.classList.remove('a11y-is-open');
    this._cancelHideWait = whenTransitionDone(wrapper, finish);
  }

  private _flushPendingHide(): void {
    const finish = this._pendingHide;
    if (!finish) return;
    this._cancelHideWait?.();
    finish();
  }

  private _unbindActiveListeners(): void {
    this._focusTrap?.deactivate();
    this._focusTrap = null;
    this._unbindDismissListeners();
    this._unbindRepositionListeners();
  }

  private _teardownChrome(): void {
    this._unbindActiveListeners();
    this._moveSelfTo(document.body);
    this._wrapper?.remove();
    this._wrapper = null;
  }

  protected _focusTrapOptions(): IFocusTrapOptions {
    return { onDeactivate: () => this.close() };
  }

  updatePosition(): void {
    const anchorRect = this._getAnchorRect();
    if (!anchorRect || !this._wrapper) return;

    const wrapperRect = this._wrapper.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    const { placement, top, left } = this._computePosition(anchorRect, wrapperRect, viewportWidth, viewportHeight);

    this._wrapper.setAttribute('data-placement', placement);
    this._wrapper.style.top = `${top}px`;
    this._wrapper.style.left = `${left}px`;
  }

  private _getAnchorRect(): DOMRect | null {
    if (this.anchorElement) return this.anchorElement.getBoundingClientRect();
    return this._anchorRect;
  }

  private _computePosition(
    anchorRect: DOMRect,
    wrapperRect: DOMRect,
    viewportWidth: number,
    viewportHeight: number,
  ): { placement: string; top: number; left: number } {
    const offset = this.offset;
    const [side, align] = this.placement.split('-') as [AnchoredSide, AnchoredAlign | undefined];

    const opposite: Record<AnchoredSide, AnchoredSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

    const fits = (s: AnchoredSide): boolean => {
      switch (s) {
        case 'top':
          return anchorRect.top - offset - wrapperRect.height >= 0;
        case 'bottom':
          return anchorRect.bottom + offset + wrapperRect.height <= viewportHeight;
        case 'left':
          return anchorRect.left - offset - wrapperRect.width >= 0;
        case 'right':
          return anchorRect.right + offset + wrapperRect.width <= viewportWidth;
      }
    };

    const resolvedSide = !fits(side) && fits(opposite[side]) ? opposite[side] : side;

    let top: number;
    let left: number;

    if (resolvedSide === 'top' || resolvedSide === 'bottom') {
      top = resolvedSide === 'top' ? anchorRect.top - offset - wrapperRect.height : anchorRect.bottom + offset;
      left = this._alignCrossAxis(align, anchorRect.left, anchorRect.right, wrapperRect.width);
      left = this._clamp(left, offset, viewportWidth - wrapperRect.width - offset);
    } else {
      left = resolvedSide === 'left' ? anchorRect.left - offset - wrapperRect.width : anchorRect.right + offset;
      top = this._alignCrossAxis(align, anchorRect.top, anchorRect.bottom, wrapperRect.height);
      top = this._clamp(top, offset, viewportHeight - wrapperRect.height - offset);
    }

    const placement = align ? `${resolvedSide}-${align}` : resolvedSide;
    return { placement, top, left };
  }

  private _alignCrossAxis(align: AnchoredAlign | undefined, anchorStart: number, anchorEnd: number, wrapperSize: number): number {
    if (align === 'start') return anchorStart;
    if (align === 'end') return anchorEnd - wrapperSize;
    return anchorStart + (anchorEnd - anchorStart) / 2 - wrapperSize / 2;
  }

  private _clamp(value: number, min: number, max: number): number {
    if (max < min) return min;
    return Math.min(Math.max(value, min), max);
  }

  private _bindDismissListeners(wrapper: HTMLElement): void {
    this._boundOutsideClick = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (wrapper.contains(target) || this.anchorElement?.contains(target)) return;
      this.close();
    };
    // Deferred so the same click/tap that opened the overlay doesn't immediately close it.
    this._outsideClickTimer = setTimeout(() => {
      document.addEventListener('click', this._boundOutsideClick!);
    }, 0);

    if (!this.wantsFocusTrap()) {
      this._boundKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') this.close();
      };
      document.addEventListener('keydown', this._boundKeyDown);
    }
  }

  private _unbindDismissListeners(): void {
    if (this._outsideClickTimer) {
      clearTimeout(this._outsideClickTimer);
      this._outsideClickTimer = null;
    }
    if (this._boundOutsideClick) {
      document.removeEventListener('click', this._boundOutsideClick);
      this._boundOutsideClick = null;
    }
    if (this._boundKeyDown) {
      document.removeEventListener('keydown', this._boundKeyDown);
      this._boundKeyDown = null;
    }
  }

  private _bindRepositionListeners(wrapper: HTMLElement): void {
    this._boundReposition = () => this.updatePosition();
    window.addEventListener('scroll', this._boundReposition, true);
    window.addEventListener('resize', this._boundReposition);

    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(this._boundReposition);
      if (this.anchorElement) this._resizeObserver.observe(this.anchorElement);
      this._resizeObserver.observe(wrapper);
    }
  }

  private _unbindRepositionListeners(): void {
    if (this._boundReposition) {
      window.removeEventListener('scroll', this._boundReposition, true);
      window.removeEventListener('resize', this._boundReposition);
      this._boundReposition = null;
    }
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }
}
