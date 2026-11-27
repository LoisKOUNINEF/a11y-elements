import { syncIdRef } from '../../core/dom-sync.js';
import { A11yAnchoredOverlayElement } from '../core/a11y-anchored-overlay-element.js';
import { nextId } from '../../core/ids.js';
import { isKeyboardFocus, trackInputModality } from '../../core/input-modality.js';

/** How long a touch or pen press must last to show the tooltip. */
const LONG_PRESS_MS = 500;
/** How far (px) the pointer may move during that press before it counts as a scroll or drag instead. */
const LONG_PRESS_MOVE_TOLERANCE = 10;

function isMouse(e: Event): boolean {
  return (e as PointerEvent).pointerType === 'mouse';
}

/**
 * A hover/focus-triggered tooltip anchored to a trigger element. Never
 * traps focus — shows after `show-delay`ms of mouse hover or keyboard focus
 * (focus after a key press, not after a click or tap; see `isKeyboardFocus()`), hides after `hide-delay`ms once the pointer/focus
 * leaves, debounced so a quick pass doesn't flash it. The anchor gets
 * `aria-describedby` pointing at this element, so screen readers announce
 * the tooltip text with it. Moving the pointer onto the tooltip itself keeps
 * it open, and Escape dismisses it (WCAG 1.4.13: hoverable + dismissible).
 *
 * Pressing the anchor closes it (and a mouse hover won't reopen it until the
 * pointer leaves). A tap neither hovers nor shows a focus ring, so it never
 * opens the tooltip; a touch or pen long press (500ms) does, until the next
 * tap elsewhere, the next press on the anchor, or Escape.
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
  private _longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private _longPressStart: { x: number; y: number } | null = null;
  /** Set by a mouse press on the anchor: hover doesn't reopen the tooltip until the pointer leaves. */
  private _suppressed = false;

  private _onPointerEnter = (e: Event): void => {
    if (isMouse(e) && !this._suppressed) this._scheduleShow();
  };
  private _onPointerLeave = (e: Event): void => {
    if (!isMouse(e)) return;
    this._suppressed = false;
    this._scheduleHide();
  };
  private _onFocus = (): void => {
    if (this._boundAnchorEl && isKeyboardFocus(this._boundAnchorEl)) this._scheduleShow();
  };
  private _onBlur = (): void => this._scheduleHide();
  private _onPointerDown = (e: Event): void => {
    this._clearTimers();
    if (this.open) this.open = false;
    if (isMouse(e)) {
      this._suppressed = true;
      return;
    }
    const { clientX, clientY } = e as PointerEvent;
    this._longPressStart = { x: clientX ?? 0, y: clientY ?? 0 };
    this._longPressTimer = setTimeout(() => {
      this._longPressTimer = null;
      this._longPressStart = null;
      this.open = true;
    }, LONG_PRESS_MS);
  };
  private _onPointerMove = (e: Event): void => {
    const start = this._longPressStart;
    if (!this._longPressTimer || !start) return;
    const { clientX, clientY } = e as PointerEvent;
    if (Math.hypot((clientX ?? 0) - start.x, (clientY ?? 0) - start.y) > LONG_PRESS_MOVE_TOLERANCE) this._cancelLongPress();
  };
  private _onPointerEnd = (): void => this._cancelLongPress();
  /**
   * Android fires `contextmenu` on a long press, and its text selection may
   * cancel the pointer right after: during a pending touch long press it opens
   * the tooltip at once instead of showing the native menu.
   */
  private _onContextMenu = (e: Event): void => {
    if (!this._longPressTimer) return;
    e.preventDefault();
    this._cancelLongPress();
    this.open = true;
  };
  private _onWrapperEnter = (e: Event): void => {
    if (isMouse(e)) this._clearTimers();
  };
  private _onWrapperLeave = (e: Event): void => {
    if (isMouse(e)) this._scheduleHide();
  };

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
    if (!this.id) this.id = nextId('a11y-tooltip');
    trackInputModality();
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
    wrapper.addEventListener('pointerenter', this._onWrapperEnter);
    wrapper.addEventListener('pointerleave', this._onWrapperLeave);
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
    for (const [type, listener] of this._anchorListeners()) anchor.addEventListener(type, listener);
    this._setDescribedBy(anchor, true);
    this._boundAnchorEl = anchor;
  }

  private _unbindAnchorListeners(): void {
    const anchor = this._boundAnchorEl;
    if (!anchor) return;
    for (const [type, listener] of this._anchorListeners()) anchor.removeEventListener(type, listener);
    this._suppressed = false;
    this._setDescribedBy(anchor, false);
    this._boundAnchorEl = null;
  }

  private _anchorListeners(): Array<[string, (e: Event) => void]> {
    return [
      ['pointerenter', this._onPointerEnter],
      ['pointerleave', this._onPointerLeave],
      ['focus', this._onFocus],
      ['blur', this._onBlur],
      ['pointerdown', this._onPointerDown],
      ['pointermove', this._onPointerMove],
      ['pointerup', this._onPointerEnd],
      ['pointercancel', this._onPointerEnd],
      ['contextmenu', this._onContextMenu],
    ];
  }

  /** Adds/removes this tooltip's id in the anchor's `aria-describedby` token list, preserving any ids the consumer set. */
  private _setDescribedBy(anchor: HTMLElement, present: boolean): void {
    syncIdRef(anchor, 'aria-describedby', this.id, present);
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
    this._cancelLongPress();
  }

  private _cancelLongPress(): void {
    if (this._longPressTimer) {
      clearTimeout(this._longPressTimer);
      this._longPressTimer = null;
    }
    this._longPressStart = null;
  }
}
