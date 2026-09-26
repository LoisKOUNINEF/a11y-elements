type KeyboardEventHandler = (event: KeyboardEvent) => void;

/** Everything that can be a Tab stop; `isTabbable()` then drops what's hidden or has a negative `tabindex`. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not(:disabled)',
  'input:not(:disabled):not([type="hidden"])',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'details > summary:first-of-type',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ');

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
  // A negative tabindex takes even a native control out of the Tab order.
  if (Number(el.getAttribute('tabindex')) < 0) return false;
  if (el.closest('[hidden], [inert]')) return false;
  if (typeof el.checkVisibility === 'function') return el.checkVisibility({ visibilityProperty: true });
  return true;
}

interface PointerState {
  /** The focusable element (or its closest focusable ancestor) the pointer last pressed. */
  lastPressed: HTMLElement | null;
  listening: boolean;
}

/**
 * Safari (and Firefox on macOS) don't focus a button or link on click, so an
 * overlay opened from a click sees `document.activeElement === <body>` and
 * would have nowhere to return focus. One capture-phase `pointerdown`
 * listener, shared page-wide like the trap stack below, remembers the
 * focusable element that was pressed instead.
 */
const POINTER_KEY = Symbol.for('a11y-elements/last-pressed');
const pointerStore = globalThis as unknown as Record<symbol, PointerState | undefined>;
const pointerState: PointerState = (pointerStore[POINTER_KEY] ??= { lastPressed: null, listening: false });
if (!pointerState.listening && typeof document !== 'undefined') {
  pointerState.listening = true;
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      pointerState.lastPressed = target?.closest<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
    },
    true,
  );
}

/**
 * Where focus should go back to when an overlay that's opening now closes:
 * the focused element, or — when that's just `<body>` because the browser
 * didn't focus a clicked trigger — the element that was last pressed.
 */
export function focusReturnTarget(): HTMLElement | null {
  const active = document.activeElement as HTMLElement | null;
  if (active && active !== document.body && active !== document.documentElement) return active;
  const pressed = pointerState.lastPressed;
  return pressed?.isConnected ? pressed : active;
}

/**
 * Page-wide stack of active traps, on `globalThis` for the same reason as
 * `overlay-registry.ts`' state: each standalone browser bundle inlines its
 * own copy of this module. Only the top trap handles keys, so stacked
 * overlays (a modal opened from a modal) don't both react to one Escape.
 */
const STACK_KEY = Symbol.for('a11y-elements/focus-trap-stack');
const stackStore = globalThis as unknown as Record<symbol, FocusTrapHelper[] | undefined>;
const activeTraps: FocusTrapHelper[] = (stackStore[STACK_KEY] ??= []);

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

    this._previousActiveElement = focusReturnTarget();
    this._focusableElements = this._getFocusableElements();

    if (this._focusableElements.length > 0) {
      this._firstFocusableElement = this._focusableElements[0] ?? null;
      this._firstFocusableElement?.focus();
    } else {
      this._container.setAttribute('tabindex', '-1');
      this._container.focus();
      this._firstFocusableElement = this._container;
    }

    // On `document`, not the container: clicking non-focusable content inside
    // the trap (text, padding) moves focus to <body>, and a container
    // listener would then never see Escape/Tab again.
    document.addEventListener('keydown', this._boundKeyDown);
    activeTraps.push(this);

    this._inertTarget = this._resolveInertTarget();
    if (this._inertTarget) this._inertTarget.inert = true;

    this._isActive = true;
  }

  public deactivate(): void {
    if (!this._isActive) return;

    document.removeEventListener('keydown', this._boundKeyDown);
    const index = activeTraps.indexOf(this);
    if (index !== -1) activeTraps.splice(index, 1);

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

  /**
   * Whether this trap should handle `event`: it must be the topmost trap, and
   * the key press must come from inside it — or from <body>/<html>, where
   * focus lands after a click on non-focusable content inside the trap. A key
   * press from elsewhere (e.g. a non-trapping dropdown opened above a modal)
   * is left alone.
   */
  private _ownsEvent(event: KeyboardEvent): boolean {
    if (activeTraps[activeTraps.length - 1] !== this) return false;
    const target = event.target as Node | null;
    return (
      !target ||
      target === document ||
      target === document.body ||
      target === document.documentElement ||
      this._container.contains(target)
    );
  }

  private _handleKeyDown(event: KeyboardEvent): void {
    if (!this._ownsEvent(event)) return;
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
