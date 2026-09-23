import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr, syncClass, syncText } from '../../core/dom-sync.js';

/**
 * Enhances a set of real, consumer-authored `<input type="radio">` options
 * (each already fully accessible on its own, typically inside its own
 * `<label>`) with a wrapping `<fieldset>`/`<legend>` and a delegated change
 * convenience. The consumer is responsible for giving every radio the same
 * `name` (that's what makes them a mutually-exclusive native group — nothing
 * for this element to inject) and any `disabled`/`required` they want.
 *
 * ```html
 * <a11y-radio-group legend="Choose a plan">
 *   <label><input type="radio" name="plan" value="basic"> Basic</label>
 *   <label><input type="radio" name="plan" value="pro"> Pro</label>
 * </a11y-radio-group>
 * ```
 */
export class RadioGroupElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['legend', 'aria-label', 'disabled'];
  }


  onChange?: (value: string) => void;

  getValue(): string {
    return this._fieldset()?.querySelector<HTMLInputElement>('.a11y-radio__input:checked')?.value ?? '';
  }

  /** Checks the option with this value; does not uncheck the others (native same-`name` grouping already does that). */
  setValue(value: string): void {
    const inputs = this._fieldset()?.querySelectorAll<HTMLInputElement>('.a11y-radio__input') ?? [];
    const match = [...inputs].find((input) => input.value === value);
    if (match) match.checked = true;
  }

  private _fieldset(): HTMLFieldSetElement | null {
    return this.querySelector('fieldset.a11y-radio-group');
  }

  protected override _sync(): void {
    if (!this.querySelector('input[type="radio"]')) return;

    const fieldset = this._ensureFieldset();
    for (const input of fieldset.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      syncClass(input, 'a11y-radio__input', true);
    }

    syncAttr(fieldset, 'disabled', this.boolAttr('disabled') ? '' : null);
    this._syncLegend(fieldset);

    this.wireOnce(fieldset, () =>
      this.listen(fieldset, 'change', (e) => {
        const target = e.target as HTMLInputElement;
        if (target.matches('input[type="radio"]') && target.checked) this.onChange?.(target.value);
      }),
    );
  }

  private _ensureFieldset(): HTMLFieldSetElement {
    const existing = this._fieldset();
    if (existing) return existing;

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'a11y-radio-group';
    // Move every existing child (the consumer's option markup) into it.
    while (this.firstChild) fieldset.appendChild(this.firstChild);
    this.appendChild(fieldset);
    return fieldset;
  }

  private _syncLegend(fieldset: HTMLFieldSetElement): void {
    const legendText = this.optionalStringAttr('legend');
    const ariaLabel = this.optionalStringAttr('aria-label');
    let legend = fieldset.querySelector<HTMLLegendElement>('.a11y-radio-group__legend');

    if (legendText) {
      if (!legend) {
        legend = document.createElement('legend');
        legend.className = 'a11y-radio-group__legend';
        fieldset.prepend(legend);
      }
      syncText(legend, legendText);
      syncAttr(fieldset, 'aria-label', null); // <legend> already provides an accessible name natively
    } else {
      legend?.remove();
      syncAttr(fieldset, 'aria-label', ariaLabel);
    }
  }
}
