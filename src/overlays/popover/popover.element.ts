import { A11yAnchoredOverlayElement } from '../core/a11y-anchored-overlay-element.js';

/**
 * Content anchored to a trigger element. `interactive` controls both the
 * ARIA role (`dialog` vs `region`) and whether it traps focus by default —
 * an explicit `trap-focus`/`trap-focus="false"` attribute always wins over
 * that default.
 *
 * ```html
 * <button id="info-btn">Info</button>
 * <a11y-popover anchor="info-btn" interactive><p>…</p></a11y-popover>
 * ```
 */
export class PopoverElement extends A11yAnchoredOverlayElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'interactive', 'trap-focus'];
  }

  declare onClose?: () => void;

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
    return el;
  }

  protected override getContentClass(): string {
    return 'a11y-popover-content';
  }

  protected override _onHidden(name?: string): void {
    super._onHidden(name);
    this.onClose?.();
  }
}
