import { A11yElement } from '../../core/a11y-element.js';

/**
 * Content that's present for assistive tech but visually hidden — e.g. extra
 * context for a screen reader that sighted users don't need cluttering the UI.
 *
 * `<a11y-visually-hidden>Opens in a new tab</a11y-visually-hidden>`
 *
 * The old version nested an inner `<span>` purely so a template-directive
 * runtime (`data-i18n`/`data-pipe`) had something to target; with that
 * runtime dropped, the element's own light-DOM content — plain text or rich
 * markup the consumer already wrote — needs no wrapper at all.
 */
export class VisuallyHiddenElement extends A11yElement {
  protected override onBeforeRender(): void {
    this.classList.add('a11y-visually-hidden');
  }

  // Preserves whatever the consumer authored inside the tag; there's nothing
  // generated here, so this is a same-content round-trip rather than a real
  // template render.
  protected override render(): string {
    return this.innerHTML;
  }
}
