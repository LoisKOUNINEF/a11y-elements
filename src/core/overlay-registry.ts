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
const state: SharedState = (store[STATE_KEY] ??= { openOverlays: new Set(), scrollLocks: 0 });

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
