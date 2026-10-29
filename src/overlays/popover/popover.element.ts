import { A11yAnchoredOverlayElement } from '../core/a11y-anchored-overlay-element.js';
import type { OverlayCloseReason } from '../../core/overlay-registry.js';
import { nextId } from '../../core/ids.js';

/**
 * Content anchored to a trigger element. `interactive` controls both the
 * ARIA role (`dialog` vs `region`) and whether it traps focus by default —
 * an explicit `trap-focus`/`trap-focus="false"` attribute always wins over
 * that default.
 *
 * Its accessible name (a `region` or `dialog` needs one): `label="…"`, else
 * its first heading, else its anchor (`aria-labelledby`, ids generated when
 * missing).
 *
 * ```html
 * <button id="info-btn">Info</button>
 * <a11y-popover anchor="info-btn" interactive><p>…</p></a11y-popover>
 * ```
 */
export class PopoverElement extends A11yAnchoredOverlayElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'interactive', 'trap-focus', 'label'];
  }

  declare onClose?: (reason: OverlayCloseReason) => void;

  protected override wantsFocusTrap(): boolean {
    // A plain boolean attribute can only express "force true" via presence —
    // this needs tri-state (unset / force true / force false) to let an
    // explicit trap-focus="false" win over interactive, so it's read by value.
    const explicit = this.getAttribute('trap-focus');
    if (explicit !== null) return explicit !== 'false';
    return this.boolAttr('interactive');
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    el.classList.add('a11y-popover-wrapper');
    el.setAttribute('role', this.boolAttr('interactive') ? 'dialog' : 'region');
    this._labelWrapper(el);
    return el;
  }

  protected override onAttributeChanged(name: string): void {
    super.onAttributeChanged(name);
    if (name === 'label' && this._wrapper) this._labelWrapper(this._wrapper);
  }

  protected override onAnchorChanged(): void {
    super.onAnchorChanged();
    if (this._wrapper) this._labelWrapper(this._wrapper);
  }

  private _labelWrapper(wrapper: HTMLElement): void {
    wrapper.removeAttribute('aria-label');
    wrapper.removeAttribute('aria-labelledby');
    const label = this.stringAttr('label');
    if (label) {
      wrapper.setAttribute('aria-label', label);
      return;
    }
    const namer = this.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6') ?? this.anchorElement;
    if (!namer) return;
    if (!namer.id) namer.id = nextId(namer === this.anchorElement ? 'a11y-popover-anchor' : 'a11y-popover-title');
    wrapper.setAttribute('aria-labelledby', namer.id);
  }

  protected override getContentClass(): string {
    return 'a11y-popover-content';
  }

  protected override _onHidden(name?: string): void {
    const reason = this._closeReason;
    super._onHidden(name);
    this.onClose?.(reason);
  }
}
