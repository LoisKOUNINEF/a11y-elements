export interface OverlayOpenCloseDetail {
  name: string;
}

export const OVERLAY_OPEN_EVENT = 'a11y-overlay-open';
export const OVERLAY_CLOSE_EVENT = 'a11y-overlay-close';

interface Dismissible {
  close(): void;
}

interface SharedState {
  openOverlays: Set<Dismissible>;
  scrollLocks: number;
  /** Each body-mounted overlay → the parent it was authored in, for `removeOverlaysWithin()`. */
  portalOrigins: Map<Element, Node>;
}

/**
 * Page-wide state, stored on `globalThis` rather than in module scope: each
 * standalone `dist/browser/**\/define.js` bundle inlines its own copy of this
 * module, so a module-scoped `Set` would give every bundle loaded on the
 * same page its own private registry (and its own scroll-lock count). A
 * `Symbol.for()` key is shared across all of them.
 */
const STATE_KEY = Symbol.for('a11y-elements/overlay-state');
const store = globalThis as unknown as Record<symbol, SharedState | undefined>;
const state: SharedState = (store[STATE_KEY] ??= { openOverlays: new Set(), scrollLocks: 0, portalOrigins: new Map() });
// A state object created by an older bundle on the same page predates this field.
state.portalOrigins ??= new Map();

/**
 * Tracks every currently-open overlay instance so a consumer's own SPA
 * router (or anything else) can force-dismiss all of them, e.g. on
 * navigation — the framework-agnostic replacement for the old
 * `Lifecycle.onViewUnmount` global hook, which only `notification-banner`
 * used and `snackbar` deliberately opted out of. That asymmetry is
 * preserved: nothing here calls `dismissAllOverlays()` automatically, a
 * consumer wires it into their own navigation event if they want it.
 */
export function registerOpenOverlay(overlay: Dismissible): void {
  state.openOverlays.add(overlay);
}

export function unregisterOpenOverlay(overlay: Dismissible): void {
  state.openOverlays.delete(overlay);
}

export function dismissAllOverlays(): void {
  for (const overlay of Array.from(state.openOverlays)) overlay.close();
}

/** Remembers where an overlay was authored before it moved itself to `<body>`. */
export function recordPortalOrigin(overlay: Element, origin: Node): void {
  state.portalOrigins.set(overlay, origin);
}

/** Drops the record once an overlay leaves the document for real, so it isn't kept alive. */
export function forgetPortalOrigin(overlay: Element): void {
  state.portalOrigins.delete(overlay);
}

/**
 * Overlays move themselves to `<body>`, so removing the subtree they were
 * authored in (a component unmount, an SPA navigation) leaves them behind.
 * Call this with that subtree's root to remove every overlay authored inside
 * it (or directly in it) — it works after `host` has left the document too.
 * Returns how many were removed.
 */
export function removeOverlaysWithin(host: Node): number {
  let removed = 0;
  for (const [overlay, origin] of Array.from(state.portalOrigins)) {
    if (!host.contains(origin)) continue;
    overlay.remove(); // its disconnectedCallback tears it down and forgets it
    state.portalOrigins.delete(overlay);
    removed++;
  }
  return removed;
}

const NO_SCROLL_CLASS = 'a11y-no-scroll';

/**
 * Reference-counted page scroll lock. Every scroll-locking overlay (modal,
 * drawer, emergency-dialog, blocking-loader) calls `lockScroll()` once on
 * show and `unlockScroll()` once when fully hidden, so closing one of two
 * stacked overlays doesn't unlock the page under the one still open.
 */
export function lockScroll(): void {
  if (state.scrollLocks++ === 0) document.documentElement.classList.add(NO_SCROLL_CLASS);
}

export function unlockScroll(): void {
  if (state.scrollLocks === 0) return;
  if (--state.scrollLocks === 0) document.documentElement.classList.remove(NO_SCROLL_CLASS);
}

/**
 * Standardized replacement for the old `Overlays.overlayOpened/overlayClosed`
 * singleton, which was only called by 4 of the 10 concrete overlays. Every
 * `A11yOverlayElement` now dispatches these uniformly on `document`.
 */
export function emitOverlayOpen(name: string): boolean {
  return document.dispatchEvent(
    new CustomEvent<OverlayOpenCloseDetail>(OVERLAY_OPEN_EVENT, { bubbles: true, detail: { name } }),
  );
}

export function emitOverlayClose(name: string): boolean {
  return document.dispatchEvent(
    new CustomEvent<OverlayOpenCloseDetail>(OVERLAY_CLOSE_EVENT, { bubbles: true, detail: { name } }),
  );
}
