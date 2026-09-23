import { A11yElement } from './a11y-element.js';

/**
 * Base for elements that enhance real, consumer-authored light-DOM children
 * instead of generating their own markup from a template string — e.g. a
 * `<a11y-picture>` wrapping a real `<picture>`/`<img>`/`<figcaption>`, or
 * `<a11y-select>` wrapping a real `<select>`/`<option>`s.
 *
 * Unlike `A11yElement`, this never sets `innerHTML` from a `render()`
 * string — that would destroy the author's children — so it opts out of the
 * normal render pipeline and instead re-syncs (`_sync()`) from two sources:
 *
 * - **This element's own observed attributes** (e.g. `label`, `legend`),
 *   listed via `static observedAttributes` same as any other element —
 *   these re-sync *synchronously*, matching every other element in this
 *   library, so `el.setAttribute('label', 'x')` takes effect immediately.
 * - **Everything else** (children added/removed, an attribute changing on
 *   one of *those* children) — light DOM has no `slotchange`, so a
 *   `MutationObserver` is the equivalent, necessarily asynchronous (a real
 *   microtask/task delay after the mutation).
 *
 * `_sync()` runs inside that `MutationObserver` callback, so every DOM write
 * it makes must be guarded (see `core/dom-sync.ts`) — `setAttribute`/
 * `classList.add`/`textContent =` all queue a mutation record even when the
 * value is unchanged, and an unguarded write would retrigger the observer
 * forever.
 */
export abstract class A11yWrapperElement extends A11yElement {
  private _observer: MutationObserver | null = null;
  /** Nodes already given their listeners since the last connect — see `wireOnce()`. */
  private _wiredNodes = new WeakSet<Node>();

  override connectedCallback(): void {
    this._connected = true;
    this._sync();
    this._observer = new MutationObserver(() => this._sync());
    this._observer.observe(this, this.observerInit());
  }

  override disconnectedCallback(): void {
    this._observer?.disconnect();
    this._observer = null;
    super.disconnectedCallback(); // removes every `listen()` listener…
    this._wiredNodes = new WeakSet(); // …so the next connect must wire them again
  }

  override attributeChangedCallback(_name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this._connected) return;
    this._sync();
  }

  /**
   * Runs `wire` the first time `node` is seen since this element was last
   * connected. `_sync()` runs on every mutation, so listener setup must be
   * idempotent — but those listeners (added via `listen()`) are all removed
   * on disconnect, so the "already wired" memory must reset with them, or a
   * reparented element (disconnect + connect) would silently stop firing.
   */
  protected wireOnce(node: Node, wire: () => void): void {
    if (this._wiredNodes.has(node)) return;
    this._wiredNodes.add(node);
    wire();
  }

  /** What to watch for changes worth re-syncing on. Override for a narrower/wider scope. */
  protected observerInit(): MutationObserverInit {
    return { childList: true, subtree: true, attributes: true };
  }

  /** Re-derive this element's own attributes/classes from its current children. */
  protected abstract _sync(): void;

  /** Unused — content is the author's own children, never replaced. */
  protected override render(): string {
    return '';
  }
}
