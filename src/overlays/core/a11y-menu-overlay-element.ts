import { focusFromKeyboard, focusReturnTarget, retargetFocusReturn } from '../../core/focus-trap.js';
import { A11yAnchoredOverlayElement } from './a11y-anchored-overlay-element.js';
import { doc } from '../../core/safe-dom.js';

/**
 * Base for menu-shaped anchored overlays (dropdown, context menu): roving
 * tabindex over `[role="menuitem"]` children instead of a focus trap, with
 * Arrow/Home/End navigation and Enter/Space activating the focused item.
 *
 * Items are the consumer's own light-DOM children — no `MenuItem[]`/
 * `onSelect` config to keep in sync. Each item is a real element the
 * consumer can attach their own `click` listener to directly; Enter/Space
 * on the focused item triggers a real synthetic `.click()` on it (same
 * "keyboard activation = real click" pattern as `FocusableElement`), and
 * this element auto-closes after any enabled item is clicked, by mouse or
 * keyboard — the one piece of behavior that's still the menu's own to own.
 *
 * Listener (un)binding is manual, not via `this.listen()`: the wrapper is a
 * fresh element built by `_show()` on every open, and `this.listen()`'s
 * cleanup only runs on disconnect — across many open/close cycles that would
 * accumulate dead entries. Binding/unbinding explicitly in `_show()`/`_hide()`
 * (matching `A11yAnchoredOverlayElement`'s own dismiss/reposition listeners)
 * keeps each cycle self-contained.
 *
 * Focus returns to whatever was focused when the menu opened (normally its
 * trigger) when it closes while focus is still inside it — Escape, item
 * activation — but not when focus already moved elsewhere (Tab away, a
 * click on another control).
 */
export abstract class A11yMenuOverlayElement extends A11yAnchoredOverlayElement {
  private _boundMenuKeyDown: ((e: KeyboardEvent) => void) | null = null;
  private _boundFocusOut: ((e: FocusEvent) => void) | null = null;
  private _boundClick: ((e: MouseEvent) => void) | null = null;
  private _returnFocusTo: HTMLElement | null = null;

  /** Menus always use roving tabindex, never a focus trap. */
  protected override wantsFocusTrap(): boolean {
    return false;
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    el.setAttribute('role', 'menu');
    return el;
  }

  protected override _show(): void {
    // Captured once per open cycle (a re-show while already open keeps the original).
    if (!this._returnFocusTo) this._returnFocusTo = focusReturnTarget();
    this._unbindMenuKeyboardHandling(); // re-shown while open: drop the previous wrapper's handlers
    super._show();
    this._initRovingTabindex();
    this._bindMenuKeyboardHandling();
    this._focusFirstEnabledItem();
  }

  protected override _hide(opts?: { immediate?: boolean }): void {
    const focusWasInside = !!this._wrapper?.contains(doc.activeElement);
    this._unbindMenuKeyboardHandling(); // before moving focus, so our own focusout handler doesn't fire
    const returnTo = this._returnFocusTo;
    this._returnFocusTo = null;
    if (focusWasInside && returnTo?.isConnected && !this._detaching) returnTo.focus();
    // Focus is in something opened from this menu (a modal from an item): when that closes,
    // it should come back to this menu's trigger, not to the item, hidden by then.
    else if (!focusWasInside && returnTo?.isConnected && this._wrapper) retargetFocusReturn(this._wrapper, returnTo);
    super._hide(opts);
  }

  private _items(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  /** `aria-disabled="true"`, or natively `disabled` (which can't take focus at all). */
  private _isEnabled(el: HTMLElement): boolean {
    return el.getAttribute('aria-disabled') !== 'true' && !el.matches(':disabled');
  }

  private _enabledItems(): HTMLElement[] {
    return this._items().filter((el) => this._isEnabled(el));
  }

  private _initRovingTabindex(): void {
    const first = this._enabledItems()[0];
    this._items().forEach((el) => el.setAttribute('tabindex', el === first ? '0' : '-1'));
  }

  /**
   * The next enabled item after (`step` 1) or before (`step` -1) the focused
   * one, wrapping — counted among all items, so it works from a disabled item
   * the pointer focused too. With focus on no item: the first / the last.
   */
  private _adjacentEnabledItem(step: 1 | -1): HTMLElement | undefined {
    const all = this._items();
    const enabled = this._enabledItems();
    const from = all.indexOf(doc.activeElement as HTMLElement);
    if (from === -1) return step === 1 ? enabled[0] : enabled[enabled.length - 1];
    for (let i = 1; i <= all.length; i++) {
      const candidate = all[(from + step * i + all.length * i) % all.length]!;
      if (enabled.includes(candidate)) return candidate;
    }
    return undefined;
  }

  private _focusFirstEnabledItem(): void {
    const target = this._enabledItems()[0];
    if (target) {
      target.focus();
      return;
    }
    // Nothing to roving-tabindex onto — fall back to focusing the menu
    // wrapper itself so focus doesn't stay stranded on whatever triggered
    // the menu, mirroring FocusTrapHelper's empty-container fallback.
    if (this._wrapper) {
      this._wrapper.setAttribute('tabindex', '-1');
      this._wrapper.focus();
    }
  }

  private _focusItemAt(items: HTMLElement[], index: number): void {
    this._focusItem(items[index]);
  }

  private _focusItem(target: HTMLElement | undefined): void {
    if (!target) return;
    // Every item, disabled ones included: only the focused item may be the Tab stop.
    this._items().forEach((el) => el.setAttribute('tabindex', '-1'));
    target.setAttribute('tabindex', '0');
    focusFromKeyboard(target);
  }

  private _bindMenuKeyboardHandling(): void {
    if (!this._wrapper) return;
    const wrapper = this._wrapper;

    this._boundMenuKeyDown = (e: KeyboardEvent): void => {
      const items = this._enabledItems();
      if (items.length === 0) return;
      const currentIndex = items.indexOf(doc.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this._focusItem(this._adjacentEnabledItem(1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._focusItem(this._adjacentEnabledItem(-1));
          break;
        case 'Home':
          e.preventDefault();
          this._focusItemAt(items, 0);
          break;
        case 'End':
          e.preventDefault();
          this._focusItemAt(items, items.length - 1);
          break;
        case 'Enter':
        case ' ':
          if (currentIndex >= 0) {
            e.preventDefault();
            items[currentIndex]!.click();
          }
          break;
      }
    };

    this._boundFocusOut = (e: FocusEvent): void => {
      const related = e.relatedTarget as Node | null;
      if (related && !wrapper.contains(related)) this.close('focus-out');
    };

    this._boundClick = (e: MouseEvent): void => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('[role="menuitem"]');
      if (item && item.getAttribute('aria-disabled') !== 'true') this.close('item');
    };

    wrapper.addEventListener('keydown', this._boundMenuKeyDown);
    wrapper.addEventListener('focusout', this._boundFocusOut);
    wrapper.addEventListener('click', this._boundClick);
  }

  private _unbindMenuKeyboardHandling(): void {
    if (this._wrapper && this._boundMenuKeyDown) this._wrapper.removeEventListener('keydown', this._boundMenuKeyDown);
    if (this._wrapper && this._boundFocusOut) this._wrapper.removeEventListener('focusout', this._boundFocusOut);
    if (this._wrapper && this._boundClick) this._wrapper.removeEventListener('click', this._boundClick);
    this._boundMenuKeyDown = null;
    this._boundFocusOut = null;
    this._boundClick = null;
  }
}
