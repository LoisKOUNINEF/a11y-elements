import { STRINGS_CHANGE_EVENT } from './strings.js';
import type { Raw } from './template.js';

type Listener = [target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions | boolean];

/**
 * Base class for every element in this library. Light DOM only — elements
 * render real child markup styled by the consumer's own CSS, not a shadow
 * root.
 *
 * Lifecycle mirrors the old `onBeforeRender -> innerHTML = template ->
 * onAfterRender` pipeline this library used to run through a proprietary
 * framework, just mapped onto native custom-element callbacks:
 *
 *   connectedCallback        -> first update()
 *   attributeChangedCallback -> update() for any observed attribute change
 *   disconnectedCallback     -> remove all tracked listeners, then onDisconnect()
 *   setStrings()             -> onStringsChange(), for subclasses that define it
 *
 * Subclasses list attributes to watch via `static observedAttributes` and
 * implement `render()` to return the markup for `this.innerHTML`. Attribute/
 * property setters that need to reflect into the DOM should just mutate the
 * attribute — `attributeChangedCallback` re-renders synchronously while
 * connected, so state and DOM never drift out of sync across a render.
 */
export abstract class A11yElement extends HTMLElement {
  protected _connected = false;
  private _listeners: Listener[] = [];
  private _updating = false;
  /** CSS vars `setCssVar()` currently owns → the consumer's inline value it replaced ('' if none). */
  private _cssVarOwned = new Map<string, string>();
  /** The `document` listener `_watchStrings()` added, if any — outside `listen()`, whose listeners every render clears. */
  private _stringsListener: EventListener | null = null;

  connectedCallback(): void {
    this._initConnect();
    this._connected = true;
    this.update();
  }

  disconnectedCallback(): void {
    this._connected = false;
    this._cleanupListeners();
    if (this._stringsListener) document.removeEventListener(STRINGS_CHANGE_EVENT, this._stringsListener);
    this._stringsListener = null;
    this.onDisconnect?.();
  }

  /**
   * Connect-time setup shared by every base class. Every `connectedCallback`
   * override that doesn't call super must call this itself, before setting
   * `_connected` (so replayed setters only write attributes, and the normal
   * connect path then acts on them).
   */
  protected _initConnect(): void {
    this._upgradeProperties();
    this._watchStrings();
  }

  /**
   * A property set on the element before its class was defined (e.g.
   * `el.open = true` before a lazy-loaded bundle runs) is an own property
   * that shadows the class accessor. Replay each one through the setter.
   */
  private _upgradeProperties(): void {
    for (let proto = Object.getPrototypeOf(this); proto && proto !== HTMLElement.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (!Object.prototype.hasOwnProperty.call(this, name) || !Object.getOwnPropertyDescriptor(proto, name)?.set) continue;
        const self = this as unknown as Record<string, unknown>;
        const value = self[name];
        delete self[name];
        self[name] = value;
      }
    }
  }

  /** Subscribes `onStringsChange()` (when defined) to `setStrings()` until disconnect. */
  private _watchStrings(): void {
    if (!this.onStringsChange || this._stringsListener) return;
    this._stringsListener = () => {
      if (this._connected) this.onStringsChange?.();
    };
    document.addEventListener(STRINGS_CHANGE_EVENT, this._stringsListener);
  }

  attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this._connected) return;
    this.update();
  }

  protected update(): void {
    // Re-entrancy guard: a listener/hook that itself mutates an observed
    // attribute during render must not trigger a nested render.
    if (this._updating) return;
    this._updating = true;
    try {
      this._cleanupListeners();
      this.onBeforeRender?.();
      this.innerHTML = String(this.render());
      this.onAfterRender?.();
    } finally {
      this._updating = false;
    }
  }

  /** Returns the markup to set as `this.innerHTML` on every render — a plain string, or an `html\`...\`` result. */
  protected abstract render(): string | Raw;

  /** Runs before `render()`. Typical use: set root-level classes/ARIA/CSS custom properties. */
  protected onBeforeRender?(): void;

  /** Runs after `render()` replaces `innerHTML`. Typical use: query into fresh markup, wire listeners, set DOM-only properties. */
  protected onAfterRender?(): void;

  /** Runs once, after listener cleanup, when the element leaves the DOM. */
  protected onDisconnect?(): void;

  /** Runs after `setStrings()`/`resetStrings()` while connected. Define it to re-apply any built-in string this element shows. */
  protected onStringsChange?(): void;

  /**
   * Adds a listener and tracks it for automatic removal on the next render
   * and on disconnect — the direct replacement for the old framework's
   * `[el, type, handler]` cleanup-array convention.
   */
  protected listen(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void {
    target.addEventListener(type, handler, options);
    this._listeners.push([target, type, handler, options]);
  }

  private _cleanupListeners(): void {
    for (const [target, type, handler, options] of this._listeners) {
      target.removeEventListener(type, handler, options);
    }
    this._listeners = [];
  }

  /** Dispatches a bubbling CustomEvent from this element. */
  protected emit<T = unknown>(type: string, detail?: T): boolean {
    return this.dispatchEvent(new CustomEvent<T>(type, { bubbles: true, detail: detail as T }));
  }

  // --- small attribute-reflection helpers, shared across components ---

  protected stringAttr(name: string, fallback = ''): string {
    return this.getAttribute(name) ?? fallback;
  }

  protected optionalStringAttr(name: string): string | undefined {
    return this.getAttribute(name) ?? undefined;
  }

  protected boolAttr(name: string): boolean {
    return this.hasAttribute(name);
  }

  protected numberAttr(name: string, fallback: number): number {
    const value = this.getAttribute(name);
    if (value == null) return fallback;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  protected setBoolAttr(name: string, value: boolean): void {
    if (value) this.setAttribute(name, '');
    else this.removeAttribute(name);
  }

  /**
   * Sets a CSS custom property on this element while `value` is truthy. When
   * it isn't, only a property this method set itself is undone — restored to
   * the consumer's own inline value from before (or removed if there was
   * none) — so a consumer's `style="--a11y-…: …"` survives when the matching
   * attribute is absent.
   */
  protected setCssVar(name: string, value: string | null | undefined): void {
    if (value) {
      if (!this._cssVarOwned.has(name)) this._cssVarOwned.set(name, this.style.getPropertyValue(name));
      this.style.setProperty(name, value);
      return;
    }
    if (!this._cssVarOwned.has(name)) return;
    const previous = this._cssVarOwned.get(name)!;
    this._cssVarOwned.delete(name);
    if (previous) this.style.setProperty(name, previous);
    else this.style.removeProperty(name);
  }
}
