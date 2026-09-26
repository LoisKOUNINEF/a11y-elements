import { A11yOverlayElement } from '../../core/a11y-overlay-element.js';
import { FocusTrapHelper, type IFocusTrapOptions } from '../../core/focus-trap.js';
import { lockScroll, unlockScroll } from '../../core/overlay-registry.js';
import { getString } from '../../core/strings.js';
import { whenTransitionDone } from '../../core/transition.js';

let titleIdCounter = 0;

/**
 * Base for centered/backdrop overlays that always trap focus and lock page
 * scroll: modal, drawer, emergency-dialog. `this` (holding the consumer's
 * own dialog content) is moved into a `.a11y-modal-content` wrapper inside a
 * `.a11y-modal-wrapper`/`.a11y-modal-overlay` backdrop pair on show, and moved back
 * out before that chrome is torn down on hide — same portal dance as
 * `A11yAnchoredOverlayElement`.
 *
 * `dismissible` defaults to true when absent, so it's expressed as the
 * inverse presence-attribute `non-dismissible` (booleans read more naturally
 * as "presence enables the thing"; `dismissible="false"` would be the odd
 * one out) — `EmergencyDialogElement` overrides the getter to force it, so
 * that safety property can't be relaxed via the attribute.
 *
 * Accessible name: `dialog-label="…"` (plain text, becomes `aria-label`)
 * when given; otherwise the first heading in the content, referenced via
 * `aria-labelledby` (its own `id` is kept, or a unique one is generated).
 *
 * The close button's name: `close-label="…"`, else `setStrings({ closeDialog })`.
 */
export abstract class A11yModalOverlayElement extends A11yOverlayElement {
  static override get observedAttributes(): string[] {
    return ['open', 'non-dismissible', 'dialog-label', 'close-label'];
  }

  protected _backdrop: HTMLElement | null = null;
  protected _wrapper: HTMLElement | null = null;
  private _focusTrap: FocusTrapHelper | null = null;
  private _closeButton: HTMLButtonElement | null = null;
  /** Completes a close whose transition is still running — see `_flushPendingHide()`. */
  private _pendingHide: (() => void) | null = null;
  private _cancelHideWait: (() => void) | null = null;

  get dismissible(): boolean {
    return !this.boolAttr('non-dismissible');
  }

  get dialogLabel(): string {
    return this.stringAttr('dialog-label');
  }

  /** The close button's accessible name. */
  get closeLabel(): string {
    return this.stringAttr('close-label', getString('closeDialog'));
  }

  protected override onAttributeChanged(name: string): void {
    if (name === 'close-label') this._relabelCloseButton();
  }

  protected override onStringsChange(): void {
    this._relabelCloseButton();
  }

  protected createBackdrop(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'a11y-modal-overlay';
    return el;
  }

  protected createWrapper(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'a11y-modal-wrapper';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    return el;
  }

  protected getContentClass(): string {
    return 'a11y-modal-content';
  }

  protected focusTrapOptions(): IFocusTrapOptions {
    return { onDeactivate: () => this.close() };
  }

  protected override _show(): void {
    // Reopened while the previous close transition is still running: finish
    // that close now, so its deferred teardown can't later pull `this` out
    // of the chrome built below.
    this._flushPendingHide();
    if (this._wrapper) return; // already showing

    lockScroll();

    if (this.dismissible) this._prependCloseButton();
    const { backdrop, wrapper } = this._buildDom();
    this._backdrop = backdrop;
    this._wrapper = wrapper;

    this._labelWrapper(wrapper);

    if (this.dismissible) {
      backdrop.addEventListener('click', (e: MouseEvent) => {
        if (e.target === backdrop) this.close();
      });
    }

    this._focusTrap = new FocusTrapHelper({ container: wrapper, options: this.focusTrapOptions() });
    this._focusTrap.activate();

    requestAnimationFrame(() => {
      backdrop.classList.add('a11y-is-open');
      wrapper.classList.add('a11y-is-open');
    });

    this._onShown();
  }

  protected override _hide(opts?: { immediate?: boolean }): void {
    const backdrop = this._backdrop;
    const wrapper = this._wrapper;
    if (!backdrop || !wrapper) {
      // Already closing (or closed): an immediate hide just completes it.
      if (opts?.immediate) this._flushPendingHide();
      return;
    }

    this._focusTrap?.deactivate();
    this._focusTrap = null;
    this._backdrop = null;
    this._wrapper = null;

    const finish = (): void => {
      this._pendingHide = null;
      this._cancelHideWait = null;
      unlockScroll();
      this._closeButton?.remove();
      this._closeButton = null;
      this.classList.remove(this.getContentClass());
      // Detach from the wrapper before it's removed — unless the consumer is
      // removing this element from the document, which must stay removed.
      if (!this._detaching) this._moveSelfTo(document.body);
      wrapper.remove();
      backdrop.remove();
      this._onHidden();
    };
    this._pendingHide = finish;

    if (opts?.immediate) {
      finish();
      return;
    }

    wrapper.classList.remove('a11y-is-open');
    backdrop.classList.remove('a11y-is-open');
    this._cancelHideWait = whenTransitionDone(wrapper, finish);
  }

  private _flushPendingHide(): void {
    const finish = this._pendingHide;
    if (!finish) return;
    this._cancelHideWait?.();
    finish();
  }

  private _prependCloseButton(): void {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'a11y-modal-close-button';
    btn.innerHTML = '&times;';
    btn.setAttribute('aria-label', this.closeLabel);
    btn.addEventListener('click', () => this.close());
    this.prepend(btn);
    this._closeButton = btn;
  }

  private _relabelCloseButton(): void {
    this._closeButton?.setAttribute('aria-label', this.closeLabel);
  }

  private _buildDom(): { backdrop: HTMLElement; wrapper: HTMLElement } {
    const backdrop = this.createBackdrop();
    const wrapper = this.createWrapper();
    backdrop.appendChild(wrapper);
    document.body.appendChild(backdrop);
    this.classList.add(this.getContentClass());
    this._moveSelfTo(wrapper); // see A11yOverlayElement's class doc on why this isn't a raw appendChild
    return { backdrop, wrapper };
  }

  private _labelWrapper(wrapper: HTMLElement): void {
    if (this.dialogLabel) {
      wrapper.setAttribute('aria-label', this.dialogLabel);
      return;
    }
    const heading = this.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
    if (!heading) return;
    if (!heading.id) heading.id = `a11y-dialog-title-${++titleIdCounter}`;
    wrapper.setAttribute('aria-labelledby', heading.id);
  }
}
