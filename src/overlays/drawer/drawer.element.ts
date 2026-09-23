import { A11yModalOverlayElement } from '../core/a11y-modal-overlay-element.js';

export type DrawerEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * A panel that slides in from a screen edge. Same focus-trap/scroll-lock/
 * dismissible behavior as `<a11y-modal>`, different chrome and animation.
 *
 * ```html
 * <a11y-drawer edge="right"><h2>Filters</h2>…</a11y-drawer>
 * ```
 */
export class DrawerElement extends A11yModalOverlayElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'edge'];
  }

  onClose?: () => void;

  get edge(): DrawerEdge {
    const value = this.getAttribute('edge');
    return value === 'left' || value === 'top' || value === 'bottom' ? value : 'right';
  }

  protected override createBackdrop(): HTMLElement {
    const el = super.createBackdrop();
    el.className = 'a11y-drawer-backdrop';
    return el;
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    el.className = `a11y-drawer-wrapper a11y-drawer-wrapper--${this.edge}`;
    return el;
  }

  protected override getContentClass(): string {
    return 'a11y-drawer-content';
  }

  protected override _onHidden(name?: string): void {
    super._onHidden(name);
    this.onClose?.();
  }
}
