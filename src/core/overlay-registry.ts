import { doc, prop } from './safe-dom.js';

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
  /** Open modal layers (`inertOutside()` calls), bottom to top: only the top one decides what's inert. */
  inertLayers: InertLayer[];
  /** Elements whose `inert` attribute this library set — the only ones it ever removes it from. */
  inertedByLib: Set<Element>;
}

interface InertLayer {
  keep: Element;
  exempt?: (el: Element) => boolean;
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
const state: SharedState = (store[STATE_KEY] ??= {
  openOverlays: new Set(),
  scrollLocks: 0,
  portalOrigins: new Map(),
  inertLayers: [],
  inertedByLib: new Set(),
});
// A state object created by an older bundle on the same page predates these fields.
state.portalOrigins ??= new Map();
state.inertLayers ??= [];
state.inertedByLib ??= new Set();

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

/** Open overlays registered after `overlay` (the set keeps opening order). */
function openedAfter(overlay: Dismissible): Dismissible[] {
  const open = Array.from(state.openOverlays);
  const index = open.indexOf(overlay);
  return index === -1 ? [] : open.slice(index + 1);
}

/**
 * Whether another overlay was opened after `overlay` and is still open — so
 * a key press like Escape belongs to that one, the topmost, not to `overlay`.
 */
export function hasOverlayOpenedAfter(overlay: Dismissible): boolean {
  return openedAfter(overlay).length > 0;
}

/**
 * Whether `target` is inside an overlay opened after `overlay` (a dropdown in
 * a popover, a modal opened from it…). That overlay lives in its own chrome
 * on `<body>`, so a click in it is outside `overlay`'s DOM but not outside it
 * as far as the user is concerned.
 */
export function isInsideOverlayOpenedAfter(overlay: Dismissible, target: Node | null): boolean {
  const later = new Set<unknown>(openedAfter(overlay));
  if (later.size === 0) return false;
  for (let node: Node | null = target; node; node = prop(node, 'parentNode') ?? (node as ShadowRoot).host ?? null) {
    if (later.has(node)) return true;
  }
  return false;
}

export function dismissAllOverlays(): void {
  for (const overlay of Array.from(state.openOverlays)) overlay.close('dismiss-all');
}

/** Remembers where an overlay was authored before it moved itself to `<body>`. */
export function recordPortalOrigin(overlay: Element, origin: Node): void {
  state.portalOrigins.set(overlay, origin);
}

/** Where `overlay` was authored before it moved itself to `<body>`, if it did. */
export function getPortalOrigin(overlay: Element): Node | null {
  return state.portalOrigins.get(overlay) ?? null;
}

const PASSIVE_REGION_CLASS = 'a11y-passive-overlay-region';

/**
 * The stacking root (the direct child of `<body>`: a modal's backdrop, an
 * anchored overlay's wrapper, a snackbar region…) of the nearest overlay that
 * `target` sits inside — an open overlay other than `except`, or a passive
 * region. `null` when `target` isn't inside one. Overlays opened from inside
 * another one stack themselves just above this root's z-index.
 */
export function findOverlayChromeRoot(target: Node | null, except?: unknown): HTMLElement | null {
  const body = doc.body;
  let overlay: Element | null = null;
  for (let node: Node | null = target; node; node = prop(node, 'parentNode') ?? (node as ShadowRoot).host ?? null) {
    if (node === body) return null;
    if (node instanceof Element && node !== except && (state.openOverlays.has(node as unknown as Dismissible) || node.classList.contains(PASSIVE_REGION_CLASS))) {
      overlay = node;
      break;
    }
  }
  for (let node: Node | null = overlay; node; node = prop(node, 'parentNode') ?? (node as ShadowRoot).host ?? null) {
    const parent: Node | null = prop(node, 'parentNode');
    if (parent === body) return node as HTMLElement;
  }
  return null;
}

/** An element's computed z-index as a number, or `null` when it's `auto` (or not set). */
export function computedZIndex(el: Element): number | null {
  const z = Number.parseInt(getComputedStyle(el).zIndex, 10);
  return Number.isFinite(z) ? z : null;
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
  // An overlay authored inside another one (a tooltip in a modal) records that overlay as its
  // origin, which sits in <body>, not in `host`: keep going until no removed root contains one.
  const roots: Node[] = [host];
  let removed = 0;
  let found = true;
  while (found) {
    found = false;
    for (const [overlay, origin] of Array.from(state.portalOrigins)) {
      if (!roots.some((root) => root.contains(origin))) continue;
      overlay.remove(); // its disconnectedCallback tears it down and forgets it
      state.portalOrigins.delete(overlay);
      roots.push(overlay);
      removed++;
      found = true;
    }
  }
  return removed;
}

/**
 * Makes every child of `<body>` except `keep` (and those `exempt` keeps)
 * `inert`, so keyboard and assistive-tech users can't reach the page behind a
 * modal overlay — a dimmed backdrop only blocks the mouse, and `aria-modal`
 * alone still lets some screen readers wander out.
 *
 * Calls stack: each pushes a layer, and only the topmost open layer decides
 * what's inert, so closing a lower modal (or a modal under a blocking loader)
 * first leaves the page behind the top one inert. `inert` the consumer set
 * themselves is never removed. Returns a function that pops this layer.
 */
export function inertOutside(keep: Element, exempt?: (el: Element) => boolean): () => void {
  const layer: InertLayer = { keep, exempt };
  state.inertLayers.push(layer);
  syncInert();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = state.inertLayers.indexOf(layer);
    if (index !== -1) state.inertLayers.splice(index, 1);
    syncInert();
  };
}

/**
 * Removes the `inert` this library put on `el`, if any. Overlays call it as
 * they move into their open chrome: a closed overlay sits in `<body>`, so a
 * modal opened before it inerted it, and it would stay unusable when opened
 * from inside that modal.
 */
export function releaseInert(el: Element): void {
  if (state.inertedByLib.delete(el)) el.removeAttribute('inert');
}

const MODAL_LAYER_CLASS = 'a11y-modal-layer-open';
const MODAL_LAYER_Z = '--a11y-z-modal-layer';

function syncInert(): void {
  const top = state.inertLayers[state.inertLayers.length - 1];
  syncModalLayer(top);
  const wanted = new Set<Element>();
  if (top) {
    for (const child of Array.from(doc.body.children)) {
      if (child === top.keep || child.contains(top.keep) || top.exempt?.(child)) continue;
      wanted.add(child);
    }
  }
  for (const el of Array.from(state.inertedByLib)) {
    if (!wanted.has(el)) releaseInert(el);
  }
  for (const el of wanted) {
    if (el.hasAttribute('inert')) continue; // already inert, by us or by the consumer
    el.setAttribute('inert', '');
    state.inertedByLib.add(el);
  }
}

/**
 * While the topmost modal layer keeps passive regions (snackbar,
 * notification-banner) usable, exposes its z-index on `<html>` so their CSS
 * can stack them just above it instead of behind its backdrop. A layer that
 * inerts them too (a blocking loader) keeps them at their usual level.
 */
function syncModalLayer(top: InertLayer | undefined): void {
  const root = doc.documentElement;
  const z = top?.exempt ? computedZIndex(top.keep) : null;
  if (z === null) {
    root.classList.remove(MODAL_LAYER_CLASS);
    root.style.removeProperty(MODAL_LAYER_Z);
    return;
  }
  root.style.setProperty(MODAL_LAYER_Z, String(z));
  root.classList.add(MODAL_LAYER_CLASS);
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
  const root = doc.documentElement;
  const widthBefore = root.clientWidth;
  root.classList.add(NO_SCROLL_CLASS);
  if (root.clientWidth > widthBefore) root.classList.add(GUTTER_CLASS);
}

export function unlockScroll(): void {
  if (state.scrollLocks === 0) return;
  if (--state.scrollLocks === 0) doc.documentElement.classList.remove(NO_SCROLL_CLASS, GUTTER_CLASS);
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
