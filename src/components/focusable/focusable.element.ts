import { A11yElement } from '../../core/a11y-element.js';

/**
 * Makes an otherwise-inert element (e.g. a styled `<div>`/`<span>` that
 * can't be a real `<button>` for some layout reason) behave like one:
 * `role="button"`, keyboard-focusable, and Enter/Space-activatable.
 *
 * Prefer a real `<button>` whenever you can — it gets all of this natively,
 * for free, with none of the edge cases custom interactive elements have to
 * re-implement by hand. This is the escape hatch for when you genuinely
 * can't.
 *
 * ```html
 * <a11y-focusable aria-label="Expand menu">
 *   <svg aria-hidden="true">…</svg> Menu
 * </a11y-focusable>
 * ```
 *
 * Enter/Space triggers a real synthetic `.click()` rather than a bespoke
 * "activate" event/callback — so consumers use the exact same `click`
 * listener (or even an inline `onclick="…"` HTML attribute) regardless of
 * whether the element was activated by mouse or keyboard, matching how a
 * real `<button>` behaves.
 */
export class FocusableElement extends A11yElement {
  static get observedAttributes(): string[] {
    return ['aria-label'];
  }

  private _warnedEmptyLabel = false;

  protected override onBeforeRender(): void {
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', '0');

    if (!this._warnedEmptyLabel && !this.getAttribute('aria-label') && !this.textContent?.trim()) {
      this._warnedEmptyLabel = true;
      console.warn('<a11y-focusable> has no accessible name — add an aria-label or visible text content.');
    }
  }

  // Content is whatever the consumer already put inside the tag — this is a
  // same-content round-trip, not a generated template (see VisuallyHiddenElement).
  protected override render(): string {
    return this.innerHTML;
  }

  protected override onAfterRender(): void {
    this.listen(this, 'keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.key !== 'Enter' && ke.key !== ' ') return;
      ke.preventDefault();
      this.click();
    });
  }
}
