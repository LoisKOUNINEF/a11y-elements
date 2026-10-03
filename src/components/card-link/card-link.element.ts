import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr, syncIdRef } from '../../core/dom-sync.js';
import { nextId } from '../../core/ids.js';

/** Descendants that handle their own clicks — a click on one of them is never forwarded to the card's link. */
const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, summary, label, [tabindex], [contenteditable]:not([contenteditable="false"])';

/** How far (px) the pointer may move between press and click before it counts as a drag/text selection. */
const DRAG_THRESHOLD = 5;

/**
 * Makes a whole card navigate through one real, consumer-authored `<a href>`
 * inside it (the "block link" pattern):
 *
 * - **The link stays the only tab stop and the accessible name** — the card
 *   gets no `role` or `tabindex`, so screen readers announce a link named by
 *   its title (not the whole card), Enter activates it natively and Space
 *   scrolls the page, as on any link. Middle-click, "Open in new tab", "Copy
 *   link address" and the links list all work on it.
 * - **A click on the rest of the card** is forwarded to the link with a real
 *   `.click()`, so the link's own click handlers (SPA routers) still run. It
 *   isn't forwarded when it lands on another interactive descendant, when
 *   the user was selecting text, or when something already called
 *   `preventDefault()`. Cmd/Ctrl/Shift-click and middle-click on the card
 *   open the link in a new tab.
 *
 * The link is the first `a[href]` inside, or the one marked
 * `data-card-link` when there are several. With `describe`, the element
 * marked `data-card-description` is added to the link's
 * `aria-describedby`, so it's read after the title.
 *
 * ```html
 * <a11y-card-link describe>
 *   <div class="card">
 *     <h3><a href="/articles/why">Why?</a></h3>
 *     <p data-card-description>The idea behind it…</p>
 *   </div>
 * </a11y-card-link>
 * ```
 */
export class CardLinkElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['describe'];
  }

  private _warnedNoLink = false;
  /** The `aria-describedby` reference this element added, so it can be taken back out. */
  private _described: { link: HTMLAnchorElement; id: string } | null = null;
  /** Where the last primary-button press happened, or `null` when the click has no matching press. */
  private _down: { x: number; y: number } | null = null;

  /** The link the card navigates through, looked up each time so a swapped link is followed. */
  get link(): HTMLAnchorElement | null {
    return (
      this.querySelector<HTMLAnchorElement>('a[href][data-card-link]') ?? this.querySelector<HTMLAnchorElement>('a[href]')
    );
  }

  protected override _sync(): void {
    const link = this.link;
    if (!link && !this._warnedNoLink) {
      this._warnedNoLink = true;
      console.warn('<a11y-card-link> has no <a href> inside — add a real link to the card (e.g. around its title).');
    }

    this._syncDescription(link);

    this.wireOnce(this, () => {
      this.listen(this, 'pointerdown', (e) => {
        const pe = e as PointerEvent;
        this._down = pe.button === 0 ? { x: pe.clientX, y: pe.clientY } : null;
      });
      this.listen(this, 'click', (e) => this._onClick(e as MouseEvent));
      this.listen(this, 'auxclick', (e) => this._onAuxClick(e as MouseEvent));
    });
  }

  private _syncDescription(link: HTMLAnchorElement | null): void {
    const description = this.hasAttribute('describe') ? this.querySelector<HTMLElement>('[data-card-description]') : null;
    if (description && !description.id) syncAttr(description, 'id', nextId('a11y-card-link-description'));
    const next = link && description ? { link, id: description.id } : null;

    const prev = this._described;
    if (prev && (prev.link !== next?.link || prev.id !== next.id)) {
      syncIdRef(prev.link, 'aria-describedby', prev.id, false);
    }
    if (next) syncIdRef(next.link, 'aria-describedby', next.id, true);
    this._described = next;
  }

  private _onClick(e: MouseEvent): void {
    const down = this._down;
    this._down = null;
    if (e.button !== 0) return;
    const link = this._forwardTarget(e, down);
    if (!link) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) {
      // A synthetic click doesn't carry modifier keys reliably across
      // browsers; this runs inside the user gesture, so popup blockers allow it.
      window.open(link.href, '_blank', 'noopener');
    } else {
      link.click();
    }
  }

  private _onAuxClick(e: MouseEvent): void {
    const down = this._down;
    this._down = null;
    if (e.button !== 1) return;
    const link = this._forwardTarget(e, down);
    if (!link) return;
    e.preventDefault(); // no autoscroll / paste-on-middle-click on top of the new tab
    window.open(link.href, '_blank', 'noopener');
  }

  /** The link to forward `e` to, or `null` when the click belongs to something else. */
  private _forwardTarget(e: MouseEvent, down: { x: number; y: number } | null): HTMLAnchorElement | null {
    if (e.defaultPrevented) return null;
    const link = this.link;
    if (!link) return null;

    // A click on the link itself (native) or another control (its own behavior).
    const target = e.target instanceof Element ? e.target : null;
    const interactive = target?.closest(INTERACTIVE_SELECTOR);
    if (interactive && this.contains(interactive)) return null;

    // The user was dragging/selecting, not clicking.
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_THRESHOLD) return null;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.anchorNode && this.contains(selection.anchorNode)) return null;

    return link;
  }
}
