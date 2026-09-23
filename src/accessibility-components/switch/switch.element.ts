import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr, syncClass, syncText } from '../../core/dom-sync.js';

/**
 * Enhances a real `<input type="checkbox">` with `role="switch"` and a
 * wrapping `<label>`, matching {@link CheckboxElement}'s design exactly
 * minus `indeterminate` (switches don't have one).
 *
 * ```html
 * <a11y-switch label="Enable notifications">
 *   <input type="checkbox">
 * </a11y-switch>
 * ```
 */
export class SwitchElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['label'];
  }


  onChange?: (checked: boolean) => void;

  getValue(): boolean {
    return this._input()?.checked ?? false;
  }

  setValue(checked: boolean): void {
    const input = this._input();
    if (input) input.checked = checked;
  }

  private _input(): HTMLInputElement | null {
    return this.querySelector('input[type="checkbox"]');
  }

  protected override _sync(): void {
    const input = this._input();
    if (!input) return;

    const wrapper = this._ensureWrapper(input);
    syncClass(input, 'a11y-switch__input', true);
    syncAttr(input, 'role', 'switch');
    this._syncLabel(wrapper);

    this.wireOnce(input, () => this.listen(input, 'change', () => this.onChange?.(input.checked)));
  }

  private _ensureWrapper(input: HTMLInputElement): HTMLLabelElement {
    const existing = input.closest<HTMLLabelElement>('label.a11y-switch');
    if (existing && existing.parentElement === this) return existing;

    const wrapper = document.createElement('label');
    wrapper.className = 'a11y-switch';
    input.replaceWith(wrapper);
    wrapper.appendChild(input);
    return wrapper;
  }

  private _syncLabel(wrapper: HTMLLabelElement): void {
    const text = this.optionalStringAttr('label');
    let span = wrapper.querySelector<HTMLElement>('.a11y-switch__label');
    if (!text) {
      span?.remove();
      return;
    }
    if (!span) {
      span = document.createElement('span');
      span.className = 'a11y-switch__label';
      wrapper.appendChild(span);
    }
    syncText(span, text);
  }
}
