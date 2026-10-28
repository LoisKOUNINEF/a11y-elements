/**
 * Why an overlay closed: `'escape'`, a click on the `'backdrop'`, the ×
 * `'close-button'`, an `'outside-click'`, focus leaving a menu (`'focus-out'`),
 * a menu `'item'` being activated, `'dismiss-all'` (`dismissAllOverlays()`),
 * the element being `'removed'` from the document while open, or `'api'`:
 * `close()`, `open = false` or removing the `open` attribute.
 */
export type OverlayCloseReason =
  | 'escape'
  | 'backdrop'
  | 'close-button'
  | 'outside-click'
  | 'focus-out'
  | 'item'
  | 'api'
  | 'dismiss-all'
  | 'removed';

export interface OverlayOpenCloseDetail {
  /** The overlay's tag name. */
  name: string;
  /** The overlay element itself. */
  element?: Element;
  /** Only on `a11y-overlay-close`, for overlays opened with `open`. */
  reason?: OverlayCloseReason;
}

export interface OverlayEventExtra {
  element?: Element;
  reason?: OverlayCloseReason;
}

export const OVERLAY_OPEN_EVENT = 'a11y-overlay-open';
export const OVERLAY_CLOSE_EVENT = 'a11y-overlay-close';

interface Dismissible {
  close(reason?: OverlayCloseReason): void;
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
  for (const overlay of Array.from(state.openOverlays)) overlay.close('dismiss-all');
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
const GUTTER_CLASS = 'a11y-no-scroll--gutter';

/**
 * Reference-counted page scroll lock. Every scroll-locking overlay (modal,
 * drawer, emergency-dialog, blocking-loader) calls `lockScroll()` once on
 * show and `unlockScroll()` once when fully hidden, so closing one of two
 * stacked overlays doesn't unlock the page under the one still open.
 *
 * `overflow: hidden` removes a classic (non-overlay) scrollbar, which would
 * widen the page. The gutter class keeps that space reserved, but only when
 * hiding overflow actually widened the root: reserving it on a page without
 * a scrollbar would narrow the page instead. Comparing the root's width
 * before and after (rather than against `innerWidth`) isn't fooled by
 * fractional-zoom rounding or by a gutter the app already reserves.
 */
export function lockScroll(): void {
  if (state.scrollLocks++ !== 0) return;
  const root = document.documentElement;
  const widthBefore = root.clientWidth;
  root.classList.add(NO_SCROLL_CLASS);
  if (root.clientWidth > widthBefore) root.classList.add(GUTTER_CLASS);
}

export function unlockScroll(): void {
  if (state.scrollLocks === 0) return;
  if (--state.scrollLocks === 0) document.documentElement.classList.remove(NO_SCROLL_CLASS, GUTTER_CLASS);
}

/**
 * Standardized replacement for the old `Overlays.overlayOpened/overlayClosed`
 * singleton, which was only called by 4 of the 10 concrete overlays. Every
 * `A11yOverlayElement` dispatches these uniformly. They bubble from the
 * overlay element (so a listener on it, or on `document`, sees them), or fire
 * on `document` when there's no element or it has already left the document.
 */
function emitOverlayEvent(type: string, name: string, extra: OverlayEventExtra): boolean {
  const { element, reason } = extra;
  const detail: OverlayOpenCloseDetail = { name };
  if (element) detail.element = element;
  if (reason) detail.reason = reason;
  const target = element?.isConnected ? element : document;
  return target.dispatchEvent(new CustomEvent<OverlayOpenCloseDetail>(type, { bubbles: true, detail }));
}

export function emitOverlayOpen(name: string, extra: Omit<OverlayEventExtra, 'reason'> = {}): boolean {
  return emitOverlayEvent(OVERLAY_OPEN_EVENT, name, extra);
}

export function emitOverlayClose(name: string, extra: OverlayEventExtra = {}): boolean {
  return emitOverlayEvent(OVERLAY_CLOSE_EVENT, name, extra);
}
