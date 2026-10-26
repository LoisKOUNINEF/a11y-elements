import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr, syncClass } from '../../core/dom-sync.js';
import { nextId } from '../../core/ids.js';

type Orientation = 'horizontal' | 'vertical';

function isDisabled(tab: HTMLElement): boolean {
  return tab.hasAttribute('disabled') || tab.getAttribute('aria-disabled') === 'true';
}

/** The element `hash` (`#id`, possibly percent-encoded) points to, if any. */
function hashTarget(hash: string): HTMLElement | null {
  if (hash.length < 2) return null;
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    return null; // malformed escape sequence
  }
}

/**
 * Enhances real, consumer-authored tabs and panels into the WAI-ARIA Tabs
 * pattern, with automatic activation:
 *
 * - `role="tablist"` on the `[data-tablist]` child (labelled by `label`, with
 *   `aria-orientation`), `role="tab"` on each `[data-tab="name"]` inside it,
 *   `role="tabpanel"` on each matching `[data-panel="name"]`, wired together
 *   with `aria-controls`/`aria-labelledby` (ids generated when missing).
 * - Only the selected tab is in the Tab order (roving `tabindex`), the other
 *   panels are `hidden`. Arrow keys (Left/Right, or Up/Down when
 *   `orientation="vertical"`, mirrored in right-to-left text) move focus and
 *   selection, Home/End jump to the first/last tab. Disabled tabs
 *   (`disabled` or `aria-disabled="true"`) are skipped.
 * - A same-page link (`<a href="#id">`, a plain one or an `<a11y-anchor>`)
 *   whose target sits in a hidden panel selects that panel first, so the jump
 *   lands on a visible element. Same for `hashchange`, and for the page's
 *   initial hash, even when its target is added after this element connects
 *   (it is then scrolled into view, since the browser's own jump found nothing).
 *
 * Elements inside a nested `<a11y-tabs>` belong to that one.
 *
 * ```html
 * <a11y-tabs label="Projects" selected="apps">
 *   <div data-tablist>
 *     <button data-tab="tools">Tools</button>
 *     <button data-tab="apps">Apps</button>
 *   </div>
 *   <section data-panel="tools">…</section>
 *   <section data-panel="apps">…</section>
 * </a11y-tabs>
 * ```
 */
export class TabsElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['label', 'selected', 'orientation'];
  }

  /** Called when the user changes the selected tab (click, keyboard, link or hash), not by `select()`/`selected`. */
  declare onChange?: (name: string) => void;

  /** The initial `location.hash`, until its target shows up somewhere in the document. */
  private _pendingHash = '';

  get selected(): string {
    return this._current()?.dataset.tab ?? '';
  }

  set selected(name: string) {
    this.select(name);
  }

  /** Selects the tab named `name` (its `data-tab`). Ignores unknown and disabled tabs. */
  select(name: string): void {
    const tab = this._tabs().find((t) => t.dataset.tab === name);
    if (tab && !isDisabled(tab)) this.setAttribute('selected', name);
  }

  /** Selects the panel containing `target`, if it is one of this element's panels. Returns whether it did. */
  reveal(target: Element): boolean {
    const panel = this._panels().find((p) => p.contains(target));
    const name = panel?.dataset.panel;
    if (!name) return false;
    if (name !== this.selected) this._choose(name);
    return true;
  }

  override connectedCallback(): void {
    this._pendingHash = location.hash;
    super.connectedCallback();
  }

  private _owns(el: Element): boolean {
    return el.parentElement?.closest('a11y-tabs') === this;
  }

  private _tablist(): HTMLElement | null {
    return [...this.querySelectorAll<HTMLElement>('[data-tablist]')].find((el) => this._owns(el)) ?? null;
  }

  private _tabs(): HTMLElement[] {
    const list = this._tablist();
    if (!list) return [];
    return [...list.querySelectorAll<HTMLElement>('[data-tab]')].filter((el) => this._owns(el));
  }

  private _panels(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[data-panel]')].filter((el) => this._owns(el));
  }

  private _orientation(): Orientation {
    return this.getAttribute('orientation') === 'vertical' ? 'vertical' : 'horizontal';
  }

  /** The selected tab: the `selected` attribute's when usable, else the first enabled one. */
  private _current(): HTMLElement | undefined {
    const tabs = this._tabs();
    const name = this.getAttribute('selected');
    const named = tabs.find((t) => t.dataset.tab === name && !isDisabled(t));
    return named ?? tabs.find((t) => !isDisabled(t));
  }

  protected override _sync(): void {
    const list = this._tablist();
    if (!list) return;

    syncClass(list, 'a11y-tabs__list', true);
    syncAttr(list, 'role', 'tablist');
    syncAttr(list, 'aria-orientation', this._orientation());
    if (!list.hasAttribute('aria-labelledby')) syncAttr(list, 'aria-label', this.optionalStringAttr('label'));

    const current = this._current();
    const panels = this._panels();

    for (const tab of this._tabs()) {
      const name = tab.dataset.tab;
      const isCurrent = tab === current;
      const panel = panels.find((p) => p.dataset.panel === name);

      if (!tab.id) tab.id = nextId('a11y-tab');
      syncClass(tab, 'a11y-tabs__tab', true);
      syncAttr(tab, 'role', 'tab');
      if (tab instanceof HTMLButtonElement) syncAttr(tab, 'type', 'button');
      syncAttr(tab, 'aria-selected', String(isCurrent));
      syncAttr(tab, 'tabindex', isCurrent ? '0' : '-1');

      if (panel) {
        if (!panel.id) panel.id = nextId('a11y-tabpanel');
        syncAttr(tab, 'aria-controls', panel.id);
        syncClass(panel, 'a11y-tabs__panel', true);
        syncAttr(panel, 'role', 'tabpanel');
        syncAttr(panel, 'aria-labelledby', tab.id);
        if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '0');
        syncAttr(panel, 'hidden', isCurrent ? null : '');
      }

      this.wireOnce(tab, () =>
        this.listen(tab, 'click', () => {
          if (name && !isDisabled(tab)) this._choose(name);
        }),
      );
    }

    this.wireOnce(list, () => this.listen(list, 'keydown', (e) => this._onKeydown(e as KeyboardEvent)));
    this.wireOnce(document, () => {
      // Capture phase: runs before the link's own handler (or the browser's jump) looks for the target.
      this.listen(document, 'click', (e) => this._onLinkClick(e), true);
      this.listen(window, 'hashchange', () => {
        const target = hashTarget(location.hash);
        if (target) this.reveal(target);
      });
    });

    this._revealPendingHash();
  }

  private _revealPendingHash(): void {
    if (!this._pendingHash) return;
    const target = hashTarget(this._pendingHash);
    if (!target) return;
    this._pendingHash = '';
    if (this.reveal(target)) target.scrollIntoView();
  }

  private _onLinkClick(e: Event): void {
    const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
    const target = link && hashTarget(link.getAttribute('href') ?? '');
    if (target) this.reveal(target);
  }

  private _onKeydown(e: KeyboardEvent): void {
    const tabs = this._tabs().filter((t) => !isDisabled(t));
    const index = tabs.indexOf(e.target as HTMLElement);
    if (index === -1) return;

    const vertical = this._orientation() === 'vertical';
    const rtl = !vertical && getComputedStyle(this).direction === 'rtl';
    const prevKey = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
    const nextKey = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';

    let next: HTMLElement | undefined;
    if (e.key === prevKey) next = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (e.key === nextKey) next = tabs[(index + 1) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;

    e.preventDefault();
    if (next.dataset.tab) this._choose(next.dataset.tab);
    next.focus();
  }

  /** A user-driven selection: reflects it and reports it through `onChange`. */
  private _choose(name: string): void {
    if (name === this.selected) return;
    this.setAttribute('selected', name);
    this.onChange?.(name);
  }
}
