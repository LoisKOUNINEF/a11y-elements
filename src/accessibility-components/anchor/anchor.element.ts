import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr } from '../../core/dom-sync.js';

const NEW_TAB_SUFFIX = '(opens in new tab)';

/** Whether a link `target` opens a new browsing context — `_blank` or a named window, not `_self`/`_parent`/`_top`. */
function opensNewContext(target: string | null): boolean {
  return !!target && (target === '_blank' || !target.startsWith('_'));
}

/**
 * Enhances a real, consumer-authored `<a href>`:
 *
 * - **New-context links** (`target="_blank"` or a named target — not
 *   `_self`/`_parent`/`_top`): adds `noopener noreferrer` to `rel`
 *   (security — an opened page can't reach back via `window.opener`) and
 *   appends "(opens in new tab)" to the accessible name, so it isn't a
 *   surprise to screen-reader/keyboard users.
 * - **Internal same-page anchors** (`href="#id"`): native browser jump-links
 *   are jarring for keyboard/AT users — no scroll animation, and focus isn't
 *   moved to the target, so subsequent Tab presses continue from wherever
 *   focus happened to be. This smooth-scrolls to the target, moves focus to
 *   it (temporarily made focusable via `tabindex="-1"`), and announces the
 *   navigation through a live region for screen-reader users. Space also
 *   activates (native anchors only activate on Enter).
 *
 * ```html
 * <a11y-anchor><a href="#section-2">Jump to section 2</a></a11y-anchor>
 * <a11y-anchor><a href="https://example.com" target="_blank">External site</a></a11y-anchor>
 * ```
 */
export class AnchorElement extends A11yWrapperElement {
  /** Each link's own `aria-label` before this element touched it, so the new-tab suffix is never applied twice and can be undone. */
  private _originalLabels = new WeakMap<HTMLAnchorElement, string | null>();

  protected override _sync(): void {
    const anchor = this.querySelector<HTMLAnchorElement>('a[href]');
    if (!anchor) return;

    if (!this._originalLabels.has(anchor)) this._originalLabels.set(anchor, anchor.getAttribute('aria-label'));
    const originalLabel = this._originalLabels.get(anchor) ?? null;

    if (opensNewContext(anchor.getAttribute('target'))) {
      const rel = new Set((anchor.getAttribute('rel') ?? '').split(/\s+/).filter(Boolean));
      rel.add('noopener').add('noreferrer');
      syncAttr(anchor, 'rel', [...rel].join(' '));
      const base = originalLabel || anchor.textContent?.trim() || anchor.getAttribute('href') || '';
      syncAttr(anchor, 'aria-label', `${base} ${NEW_TAB_SUFFIX}`.trim());
    } else {
      syncAttr(anchor, 'aria-label', originalLabel);
    }

    // `href` is read at activation time, not captured here, so a link
    // whose href changes later is handled according to its current value.
    this.wireOnce(anchor, () => {
      const activate = (e: Event): void => {
        const href = anchor.getAttribute('href') ?? '';
        if (!href.startsWith('#') || href.length < 2) return; // not a same-page anchor: native behavior
        e.preventDefault();
        this._activateInternalAnchor(decodeURIComponent(href.slice(1)));
      };
      this.listen(anchor, 'click', activate);
      this.listen(anchor, 'keydown', (e) => {
        if ((e as KeyboardEvent).key === ' ') activate(e);
      });
    });
  }

  private _activateInternalAnchor(id: string): void {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: 'smooth' });

    setTimeout(() => {
      target?.setAttribute('tabindex', '-1');
      target?.focus({ preventScroll: true });
      target?.addEventListener('blur', () => target?.removeAttribute('tabindex'), { once: true });
    }, 100);

    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'a11y-visually-hidden';
    document.body.appendChild(announcement);
    // Delay content so AT registers the live region before it receives text.
    setTimeout(() => {
      announcement.textContent = `Navigated to ${target?.textContent || id}`;
      setTimeout(() => announcement.remove(), 3000);
    }, 100);
  }
}
