type KeyboardEventHandler = (event: KeyboardEvent) => void;

const FOCUSABLE_SELECTOR =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

export interface IFocusTrapOptions {
  escapeDeactivates?: boolean;
  returnFocusOnDeactivate?: boolean;
  onDeactivate?: () => void;
  /**
   * An element (or selector resolving to one) to mark `inert` while the trap
   * is active, so assistive tech can't reach content behind the trap.
   * Defaults to `null` (no side effect) — the old implementation hardcoded
   * `document.querySelector('#app')`, which assumed every consumer had a
   * single a11y-shell element with that exact id. A library meant to be
   * dropped into arbitrary HTML can't assume that, so this is opt-in.
   */
  inertTarget?: HTMLElement | string | null;
}

export interface IFocusTrapHelperParams {
  container: HTMLElement;
  options?: IFocusTrapOptions;
}

/**
 * Whether a selector-matched element can actually take focus right now:
 * not inside a `hidden`/`inert` subtree, and (where the browser supports
 * `checkVisibility()`) actually rendered — `display: none`, `visibility:
 * hidden` or a collapsed `<details>` would otherwise become a Tab stop
 * that silently swallows the key press.
 */
function isTabbable(el: HTMLElement): boolean {
  if (el.closest('[hidden], [inert]')) return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
  return true;
}

export class FocusTrapHelper {
  private _container: HTMLElement;
  private _previousActiveElement: HTMLElement | null = null;
  private _focusableElements: HTMLElement[] | null = null;
  private _firstFocusableElement: HTMLElement | null = null;
  private _boundKeyDown: KeyboardEventHandler;
  private _options: IFocusTrapOptions;
  private _inertTarget: HTMLElement | null = null;
  private _isActive = false;

  constructor({ container, options = {} }: IFocusTrapHelperParams) {
    this._container = container;
    this._options = {
      escapeDeactivates: options.escapeDeactivates ?? true,
      returnFocusOnDeactivate: options.returnFocusOnDeactivate ?? true,
      onDeactivate: options.onDeactivate,
      inertTarget: options.inertTarget ?? null,
    };
    this._boundKeyDown = this._handleKeyDown.bind(this);
  }

  private _getFocusableElements(): HTMLElement[] {
    return Array.from(this._container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isTabbable);
  }

  private _resolveInertTarget(): HTMLElement | null {
    const target = this._options.inertTarget;
    if (!target) return null;
    return typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
  }

  public activate(): void {
    if (this._isActive) return;

    this._previousActiveElement = document.activeElement as HTMLElement;
    this._focusableElements = this._getFocusableElements();

    if (this._focusableElements.length > 0) {
      this._firstFocusableElement = this._focusableElements[0] ?? null;
      this._firstFocusableElement?.focus();
    } else {
      this._container.setAttribute('tabindex', '-1');
      this._container.focus();
      this._firstFocusableElement = this._container;
    }

    this._container.addEventListener('keydown', this._boundKeyDown);

    this._inertTarget = this._resolveInertTarget();
    if (this._inertTarget) this._inertTarget.inert = true;

    this._isActive = true;
  }

  public deactivate(): void {
    if (!this._isActive) return;

    this._container.removeEventListener('keydown', this._boundKeyDown);

    if (this._inertTarget) this._inertTarget.inert = false;
    this._inertTarget = null;

    if (this._container.getAttribute('tabindex') === '-1') {
      this._container.removeAttribute('tabindex');
    }

    if (this._options.returnFocusOnDeactivate && this._previousActiveElement?.focus) {
      this._previousActiveElement.focus();
    }

    this._focusableElements = null;
    this._firstFocusableElement = null;
    this._previousActiveElement = null;

    this._isActive = false;
  }

  public getIsActive(): boolean {
    return this._isActive;
  }

  public updateFocusableElements(): void {
    if (!this._isActive) return;

    this._focusableElements = this._getFocusableElements();

    if (this._focusableElements.length > 0) {
      this._firstFocusableElement = this._focusableElements[0] ?? null;
    }
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Tab':
        this._handleTabKey(event);
        break;
      case 'Escape':
        if (this._options.escapeDeactivates) {
          event.preventDefault();
          this._options.onDeactivate?.();
        }
        break;
    }
  }

  /**
   * Drives every Tab/Shift+Tab press manually instead of only intercepting
   * at the first/last boundary and otherwise trusting the browser's native
   * tab order to match `_focusableElements`' DOM order. Safari on macOS, by
   * default, excludes buttons/links from the native Tab order entirely (only
   * text inputs get native tab stops) — so a boundary-only trap can let
   * focus silently escape once native Tab skips past what this class thinks
   * is the last focusable element. Owning every Tab press removes that
   * dependency on any browser's native tab-stop behavior altogether.
   */
  private _handleTabKey(event: KeyboardEvent): void {
    // Re-queried on every press, so content added/removed/shown/hidden
    // inside the trap after activation is always reachable (and nothing
    // stale is).
    this.updateFocusableElements();
    if (!this._focusableElements || this._focusableElements.length === 0) {
      event.preventDefault(); // nothing to move to — keep focus on the container rather than letting it escape
      return;
    }

    event.preventDefault();

    const elements = this._focusableElements;
    const currentIndex = elements.indexOf(document.activeElement as HTMLElement);

    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? elements.length - 1
        : currentIndex - 1
      : currentIndex === -1 || currentIndex === elements.length - 1
        ? 0
        : currentIndex + 1;

    elements[nextIndex]?.focus();
  }
}
