import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr } from '../../core/dom-sync.js';

/**
 * A label that renders a real `<label class="a11y-label">` around its
 * content — a custom element can't itself *be* a `<label>`, and only a real
 * one gives click-to-focus and native accessible naming.
 *
 * Inside `<a11y-input>`/`<a11y-textarea>` it's linked to the control
 * automatically. On its own, `for` is forwarded to the inner `<label>`:
 *
 * ```html
 * <a11y-label for="search">Search</a11y-label>
 * <input id="search" type="search">
 * ```
 *
 * The required marker (`*`) is CSS only and hidden from assistive tech,
 * which already announces the control's native `required`. It shows inside
 * a field whose control is required, or with the `required` attribute here.
 */
export class LabelElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['for'];
  }

  /** Whether the inner label's `for` came from this element's own `for`, so removing that one clears it. */
  private _forwardedFor = false;

  /**
   * The real `<label>` this element renders, built on first access. A field
   * reads this while syncing, which can run before this element's own
   * `connectedCallback` (the field comes first in tree order), so it links
   * the real label straight away instead of on a later sync.
   */
  get label(): HTMLLabelElement {
    let label = this.querySelector<HTMLLabelElement>(':scope > label.a11y-label');
    if (!label) {
      label = document.createElement('label');
      label.className = 'a11y-label';
    }
    // Move the author's content (and anything added later) into the real label.
    for (const node of [...this.childNodes]) if (node !== label) label.appendChild(node);
    if (label.parentNode !== this) this.appendChild(label);
    return label;
  }

  protected override observerInit(): MutationObserverInit {
    return { childList: true };
  }

  protected override _sync(): void {
    const label = this.label;

    const forId = this.getAttribute('for');
    if (forId != null) {
      syncAttr(label, 'for', forId);
      this._forwardedFor = true;
    } else if (this._forwardedFor) {
      syncAttr(label, 'for', null);
      this._forwardedFor = false;
    }
  }
}
