import { A11yMenuOverlayElement } from '../core/a11y-menu-overlay-element.js';

let idCounter = 0;

/**
 * A menu anchored to a trigger element (e.g. a "more actions" button).
 *
 * ```html
 * <button id="actions-btn">Actions</button>
 * <a11y-dropdown anchor="actions-btn">
 *   <div role="menuitem">Edit</div>
 *   <div role="menuitem">Delete</div>
 * </a11y-dropdown>
 * ```
 *
 * The anchor is the trigger: clicking it (or Enter/Space on a real
 * `<button>`) toggles the menu — no click handler to wire yourself — and it
 * gets `aria-haspopup="menu"`, `aria-controls`, and an `aria-expanded` kept
 * in sync with the menu's open state. The menu is labelled by the anchor.
 */
export class DropdownElement extends A11yMenuOverlayElement {
  private _trigger: HTMLElement | null = null;
  private _onTriggerClick = (): void => {
    this.open = !this.open;
  };

  protected override onConnect(): void {
    if (!this.id) this.id = `a11y-dropdown-${++idCounter}`;
    this._bindTrigger();
    // Anchor not parsed yet (dropdown authored before it, define script loaded synchronously).
    if (!this._trigger) this.afterParse(() => this._bindTrigger());
  }

  protected override onDisconnect(): void {
    this._unbindTrigger();
  }

  protected override onAnchorChanged(): void {
    super.onAnchorChanged();
    if (this._connected) this._bindTrigger();
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    el.classList.add('a11y-dropdown-wrapper');
    if (this._trigger?.id) el.setAttribute('aria-labelledby', this._trigger.id);
    return el;
  }

  protected override getContentClass(): string {
    return 'a11y-dropdown-content';
  }

  protected override _onShown(name?: string): void {
    super._onShown(name);
    this._trigger?.setAttribute('aria-expanded', 'true');
  }

  protected override _onHidden(name?: string): void {
    super._onHidden(name);
    this._trigger?.setAttribute('aria-expanded', 'false');
  }

  private _bindTrigger(): void {
    const anchor = this.anchorElement;
    if (anchor === this._trigger) return;
    this._unbindTrigger();
    if (!anchor) return;
    anchor.setAttribute('aria-haspopup', 'menu');
    anchor.setAttribute('aria-controls', this.id);
    anchor.setAttribute('aria-expanded', String(this._isShowing));
    anchor.addEventListener('click', this._onTriggerClick);
    this._trigger = anchor;
  }

  private _unbindTrigger(): void {
    const trigger = this._trigger;
    if (!trigger) return;
    trigger.removeEventListener('click', this._onTriggerClick);
    trigger.removeAttribute('aria-haspopup');
    trigger.removeAttribute('aria-controls');
    trigger.removeAttribute('aria-expanded');
    this._trigger = null;
  }
}
