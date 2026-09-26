import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr } from '../../core/dom-sync.js';
import { formatString, getString } from '../../core/strings.js';

/** Whether a link `target` opens a new browsing context — `_blank` or a named window, not `_self`/`_parent`/`_top`. */
function opensNewContext(target: string | null): boolean {
  return !!target && (target === '_blank' || !target.startsWith('_'));
}

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

/** The target's name for the navigation announcement — its label or heading, never its whole content. */
function targetName(target: HTMLElement | null, id: string): string {
  const label = target?.getAttribute('aria-label')?.trim();
  if (label) return label;

  const labelledBy = (target?.getAttribute('aria-labelledby') ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((ref) => document.getElementById(ref)?.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
  if (labelledBy) return labelledBy;

  const heading = target?.matches(HEADING_SELECTOR) ? target : target?.querySelector(HEADING_SELECTOR);
  return heading?.textContent?.trim() || id;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Targets currently made focusable by a jump, mapped to their own `tabindex` (`null` = none) to restore on blur. */
const pendingTabindexRestores = new WeakMap<HTMLElement, string | null>();

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
 *   focus happened to be. This smooth-scrolls to the target (instantly under
 *   `prefers-reduced-motion: reduce`), moves focus to it (temporarily made
 *   focusable via `tabindex="-1"`, its own `tabindex` restored on blur), and
 *   announces the navigation — by the target's label or heading — through a
 *   live region for screen-reader users. Space also activates (native anchors
 *   only activate on Enter).
 *
 * Both built-in strings can be translated: `new-tab-label="…"` /
 * `navigated-label="… {name}"` on this element, else `setStrings({
 * opensInNewTab, navigatedTo })`.
 *
 * ```html
 * <a11y-anchor><a href="#section-2">Jump to section 2</a></a11y-anchor>
 * <a11y-anchor><a href="https://example.com" target="_blank">External site</a></a11y-anchor>
 * ```
 */
export class AnchorElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['new-tab-label', 'navigated-label'];
  }

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
      const suffix = this.getAttribute('new-tab-label') ?? getString('opensInNewTab');
      syncAttr(anchor, 'aria-label', `${base} ${suffix}`.trim());
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

  protected override onStringsChange(): void {
    this._sync();
  }

  private _activateInternalAnchor(id: string): void {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

    setTimeout(() => {
      if (!target) return;
      // A jump before the previous one's blur must not record our own -1 as the original.
      if (!pendingTabindexRestores.has(target)) {
        pendingTabindexRestores.set(target, target.getAttribute('tabindex'));
        target.addEventListener(
          'blur',
          () => {
            syncAttr(target, 'tabindex', pendingTabindexRestores.get(target) ?? null);
            pendingTabindexRestores.delete(target);
          },
          { once: true },
        );
      }
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }, 100);

    const template = this.getAttribute('navigated-label') ?? getString('navigatedTo');
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'a11y-visually-hidden';
    document.body.appendChild(announcement);
    // Delay content so AT registers the live region before it receives text.
    setTimeout(() => {
      announcement.textContent = formatString(template, { name: targetName(target, id) });
      setTimeout(() => announcement.remove(), 3000);
    }, 100);
  }
}
