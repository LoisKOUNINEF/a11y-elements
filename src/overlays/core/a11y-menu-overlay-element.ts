import { A11yAnchoredOverlayElement } from './a11y-anchored-overlay-element.js';

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
    if (!this._returnFocusTo) this._returnFocusTo = document.activeElement as HTMLElement | null;
    this._unbindMenuKeyboardHandling(); // re-shown while open: drop the previous wrapper's handlers
    super._show();
    this._initRovingTabindex();
    this._bindMenuKeyboardHandling();
    this._focusFirstEnabledItem();
  }

  protected override _hide(opts?: { immediate?: boolean }): void {
    const focusWasInside = !!this._wrapper?.contains(document.activeElement);
    this._unbindMenuKeyboardHandling(); // before moving focus, so our own focusout handler doesn't fire
    const returnTo = this._returnFocusTo;
    this._returnFocusTo = null;
    if (focusWasInside && returnTo?.isConnected && !this._detaching) returnTo.focus();
    super._hide(opts);
  }

  private _items(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }

  private _enabledItems(): HTMLElement[] {
    return this._items().filter((el) => el.getAttribute('aria-disabled') !== 'true');
  }

  private _initRovingTabindex(): void {
    this._items().forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'));
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
    items.forEach((el) => el.setAttribute('tabindex', '-1'));
    const target = items[index];
    if (!target) return;
    target.setAttribute('tabindex', '0');
    target.focus();
  }

  private _bindMenuKeyboardHandling(): void {
    if (!this._wrapper) return;
    const wrapper = this._wrapper;

    this._boundMenuKeyDown = (e: KeyboardEvent): void => {
      const items = this._enabledItems();
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this._focusItemAt(items, (currentIndex + 1) % items.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this._focusItemAt(items, (currentIndex - 1 + items.length) % items.length);
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
      if (related && !wrapper.contains(related)) this.close();
    };

    this._boundClick = (e: MouseEvent): void => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('[role="menuitem"]');
      if (item && item.getAttribute('aria-disabled') !== 'true') this.close();
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
