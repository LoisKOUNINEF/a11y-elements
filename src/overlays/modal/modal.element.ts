import { A11yModalOverlayElement } from '../core/a11y-modal-overlay-element.js';

/**
 * A centered modal dialog. Consumer content is the light-DOM children.
 *
 * ```html
 * <a11y-modal dialog-label="settings">
 *   <h2>Settings</h2>
 *   <p>…</p>
 * </a11y-modal>
 * ```
 *
 * Toggle via the `open` attribute/property or `.show()`/`.close()`.
 *
 * Dropped from the old version: automatically capitalizing `viewName` and
 * setting `document.title` on open (via a since-removed pipe registry) —
 * that's a routing concern, not something a generic dialog primitive should
 * own. Use `onClose`/listen for `a11y-overlay-open` if you need it.
 */
export class ModalElement extends A11yModalOverlayElement {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'fullscreen'];
  }

  /** Called once this modal has finished closing (after its close transition). */
  declare onClose?: () => void;

  protected override createBackdrop(): HTMLElement {
    const el = super.createBackdrop();
    if (this.boolAttr('fullscreen')) el.classList.add('a11y-modal-overlay--fullscreen');
    return el;
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    if (this.boolAttr('fullscreen')) el.classList.add('a11y-modal-wrapper--fullscreen');
    return el;
  }

  protected override _onHidden(name?: string): void {
    super._onHidden(name);
    this.onClose?.();
  }
}
