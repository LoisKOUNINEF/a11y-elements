import { A11yModalOverlayElement } from '../core/a11y-modal-overlay-element.js';
import type { IFocusTrapOptions } from '../../core/focus-trap.js';

/**
 * A modal that cannot be dismissed except programmatically — no close
 * button, no backdrop-click-to-close, no Escape. For things the user must
 * consciously resolve (e.g. "your session is about to expire").
 *
 * `dismissible`/`non-dismissible` has no effect here — both getters are
 * hardcoded, not read from an attribute, so this safety property can't be
 * relaxed by setting an attribute on the element.
 *
 * ```html
 * <a11y-emergency-dialog><h2>Session expiring</h2>…</a11y-emergency-dialog>
 * ```
 */
export class EmergencyDialogElement extends A11yModalOverlayElement {
  declare onClose?: () => void;

  override get dismissible(): boolean {
    return false;
  }

  protected override focusTrapOptions(): IFocusTrapOptions {
    return { ...super.focusTrapOptions(), escapeDeactivates: false };
  }

  protected override createBackdrop(): HTMLElement {
    const el = super.createBackdrop();
    el.classList.add('a11y-emergency-dialog-overlay');
    return el;
  }

  protected override createWrapper(): HTMLElement {
    const el = super.createWrapper();
    el.classList.add('a11y-emergency-dialog-wrapper');
    return el;
  }

  protected override _onHidden(name?: string): void {
    super._onHidden(name);
    this.onClose?.();
  }
}
