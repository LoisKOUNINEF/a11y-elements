import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncClass, syncText } from '../../core/dom-sync.js';

/**
 * Enhances a real `<select>` (with real `<option>` children — the browser's
 * own native picker/keyboard handling needs no help) with a wrapping
 * `<label>` and visible label span.
 *
 * ```html
 * <a11y-select label="Country">
 *   <select name="country">
 *     <option value="us">United States</option>
 *     <option value="ca">Canada</option>
 *   </select>
 * </a11y-select>
 * ```
 */
export class SelectElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['label'];
  }


  onChange?: (value: string) => void;

  getValue(): string {
    return this._select()?.value ?? '';
  }

  setValue(value: string): void {
    const select = this._select();
    if (select) select.value = value;
  }

  private _select(): HTMLSelectElement | null {
    return this.querySelector('select');
  }

  protected override _sync(): void {
    const select = this._select();
    if (!select) return;

    const wrapper = this._ensureWrapper(select);
    syncClass(select, 'a11y-select__control', true);
    this._syncLabel(wrapper);

    this.wireOnce(select, () => this.listen(select, 'change', () => this.onChange?.(select.value)));
  }

  private _ensureWrapper(select: HTMLSelectElement): HTMLLabelElement {
    const existing = select.closest<HTMLLabelElement>('label.a11y-select');
    if (existing && existing.parentElement === this) return existing;

    const wrapper = document.createElement('label');
    wrapper.className = 'a11y-select';
    select.replaceWith(wrapper);
    wrapper.appendChild(select);
    return wrapper;
  }

  private _syncLabel(wrapper: HTMLLabelElement): void {
    const text = this.optionalStringAttr('label');
    let span = wrapper.querySelector<HTMLElement>('.a11y-select__label');
    if (!text) {
      span?.remove();
      return;
    }
    if (!span) {
      span = document.createElement('span');
      span.className = 'a11y-select__label';
      wrapper.prepend(span); // label text visually precedes the control
    }
    syncText(span, text);
  }
}
