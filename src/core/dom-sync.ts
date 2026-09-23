/**
 * Guarded DOM writes for use inside `A11yWrapperElement._sync()` methods (or
 * anywhere else re-syncing against a live MutationObserver).
 *
 * `setAttribute`/`removeAttribute`/`classList.add`/`classList.remove`/
 * `textContent =` all queue a mutation record unconditionally — even when
 * the value being written is identical to what's already there. Call one of
 * these unguarded inside a MutationObserver callback that's itself watching
 * the element being written to, and every "no-op" write retriggers the
 * observer, forever. These helpers check first, so a `_sync()` call that
 * changes nothing produces zero mutations and the observer loop terminates.
 */

export function syncText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

export function syncAttr(el: Element, name: string, value: string | null | undefined): void {
  if (value == null) {
    if (el.hasAttribute(name)) el.removeAttribute(name);
  } else if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value);
  }
}

export function syncClass(el: Element, name: string, present: boolean): void {
  if (el.classList.contains(name) !== present) el.classList.toggle(name, present);
}
