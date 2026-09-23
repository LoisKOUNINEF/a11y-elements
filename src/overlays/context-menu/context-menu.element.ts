import { A11yMenuOverlayElement } from '../core/a11y-menu-overlay-element.js';

/**
 * A menu that opens at the mouse position on right-click (`contextmenu`) of
 * a trigger element, replacing the browser's native context menu there.
 *
 * ```html
 * <div id="canvas">Right-click me</div>
 * <a11y-context-menu trigger="canvas">
 *   <div role="menuitem">Copy</div>
 *   <div role="menuitem">Paste</div>
 * </a11y-context-menu>
 * ```
 */
export class ContextMenuElement extends A11yMenuOverlayElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'trigger'];
  }

  private _triggerEl: HTMLElement | null = null;
  private _boundTriggerEl: HTMLElement | null = null;
  private _boundContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
    this.setAnchorPoint(e.clientX, e.clientY);
    // Re-right-clicking while already open repositions in place rather than
    // no-op'ing (the `open` attribute wouldn't change, so attributeChangedCallback
    // wouldn't fire) — _show() itself already guards on an existing wrapper.
    if (this.open) this._show();
    else this.open = true;
  };

  /** The element whose `contextmenu` event opens this menu: an explicit `.triggerElement` property, or the `trigger="<id>"` attribute. */
  get triggerElement(): HTMLElement | null {
    if (this._triggerEl) return this._triggerEl;
    const id = this.getAttribute('trigger');
    return id ? document.getElementById(id) : null;
  }

  set triggerElement(el: HTMLElement | null) {
    this._triggerEl = el;
    this._bindTrigger();
  }

  protected override onConnect(): void {
    this._bindTrigger();
    // Trigger not parsed yet (menu authored before it, define script loaded synchronously).
    if (!this._boundTriggerEl) this.afterParse(() => this._bindTrigger());
  }

  protected override onDisconnect(): void {
    this._unbindTrigger();
  }

  protected override onAttributeChanged(name: string): void {
    super.onAttributeChanged(name);
    if (name === 'trigger') this._bindTrigger();
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    el.classList.add('a11y-context-menu-wrapper');
    return el;
  }

  protected override getContentClass(): string {
    return 'a11y-context-menu-content';
  }

  /** Detaches from the trigger entirely (unlike `close()`, which just hides the current menu — it can still reopen on the next right-click). */
  dispose(): void {
    this._unbindTrigger();
    this.close();
  }

  private _bindTrigger(): void {
    const trigger = this.triggerElement;
    if (this._boundTriggerEl === trigger) return;
    this._unbindTrigger();
    if (!trigger) return;
    trigger.addEventListener('contextmenu', this._boundContextMenu);
    this._boundTriggerEl = trigger;
  }

  private _unbindTrigger(): void {
    if (!this._boundTriggerEl) return;
    this._boundTriggerEl.removeEventListener('contextmenu', this._boundContextMenu);
    this._boundTriggerEl = null;
  }
}
