import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr, syncClass, syncText } from '../../core/dom-sync.js';
import { getString } from '../../core/strings.js';

const SELECT_ALL_INPUT_CLASS = 'a11y-checkbox-group__select-all-input';

/**
 * Enhances a set of real, consumer-authored `<input type="checkbox">`
 * options (each typically inside its own `<label>`) with a wrapping
 * `<fieldset>`/`<legend>` — the multi-select counterpart of
 * `<a11y-radio-group>`. Options reuse `<a11y-checkbox>`'s styling
 * (`.a11y-checkbox` on the label, `.a11y-checkbox__input` on the input).
 *
 * `select-all` adds a generated "Select all" checkbox after the legend: it's
 * checked when every enabled option is, `indeterminate` when only some are,
 * and toggles every enabled option at once. It has no `name`, so it's never
 * submitted with the form. Disabled options keep their own state.
 *
 * ```html
 * <a11y-checkbox-group legend="Toppings" select-all>
 *   <label><input type="checkbox" name="toppings" value="cheese"> Cheese</label>
 *   <label><input type="checkbox" name="toppings" value="ham"> Ham</label>
 * </a11y-checkbox-group>
 * ```
 *
 * The select-all label: `select-all-label="…"`, else `setStrings({ selectAll })`.
 */
export class CheckboxGroupElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['legend', 'aria-label', 'disabled', 'select-all', 'select-all-label'];
  }

  /** Called with the checked values once per user action — including one select-all click that changes many options. */
  declare onChange?: (values: string[]) => void;

  /** True while select-all toggles options, so their `change` events don't each call `onChange`. */
  private _bulkUpdating = false;

  getValue(): string[] {
    return this._options()
      .filter((input) => input.checked)
      .map((input) => input.value);
  }

  /** Checks exactly the options whose value is in `values` and unchecks the rest. */
  setValue(values: string[]): void {
    for (const input of this._options()) input.checked = values.includes(input.value);
    this._syncSelectAll();
  }

  /** Checks every enabled option. Silent, like `setValue()`: no events, no `onChange`. */
  selectAll(): void {
    this._setAllEnabled(true);
  }

  /** Unchecks every enabled option. Silent, like `setValue()`: no events, no `onChange`. */
  unselectAll(): void {
    this._setAllEnabled(false);
  }

  private _fieldset(): HTMLFieldSetElement | null {
    return this.querySelector('fieldset.a11y-checkbox-group');
  }

  private _selectAllInput(): HTMLInputElement | null {
    return this._fieldset()?.querySelector<HTMLInputElement>(`.${SELECT_ALL_INPUT_CLASS}`) ?? null;
  }

  private _options(): HTMLInputElement[] {
    const fieldset = this._fieldset();
    if (!fieldset) return [];
    return [...fieldset.querySelectorAll<HTMLInputElement>(`input[type="checkbox"]:not(.${SELECT_ALL_INPUT_CLASS})`)];
  }

  private _enabledOptions(): HTMLInputElement[] {
    return this._options().filter((input) => !input.matches(':disabled'));
  }

  protected override onStringsChange(): void {
    this._sync();
  }

  protected override _sync(): void {
    if (!this.querySelector('input[type="checkbox"]')) return;

    const fieldset = this._ensureFieldset();
    for (const input of this._options()) {
      syncClass(input, 'a11y-checkbox__input', true);
      const label = input.closest('label');
      if (label && fieldset.contains(label)) syncClass(label, 'a11y-checkbox', true);
    }

    syncAttr(fieldset, 'disabled', this.boolAttr('disabled') ? '' : null);
    this._syncLegend(fieldset);
    this._syncSelectAllControl(fieldset);
    this._syncSelectAll();

    this.wireOnce(fieldset, () =>
      this.listen(fieldset, 'change', (e) => {
        const target = e.target as HTMLInputElement;
        if (!target.matches('input[type="checkbox"]')) return;
        if (target.classList.contains(SELECT_ALL_INPUT_CLASS)) {
          this._toggleAllFromUser(target.checked);
          return;
        }
        this._syncSelectAll();
        if (!this._bulkUpdating) this.onChange?.(this.getValue());
      }),
    );
  }

  private _ensureFieldset(): HTMLFieldSetElement {
    const existing = this._fieldset();
    if (existing) return existing;

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'a11y-checkbox-group';
    // Move every existing child (the consumer's option markup) into it.
    while (this.firstChild) fieldset.appendChild(this.firstChild);
    this.appendChild(fieldset);
    return fieldset;
  }

  private _syncLegend(fieldset: HTMLFieldSetElement): void {
    const legendText = this.optionalStringAttr('legend');
    const ariaLabel = this.optionalStringAttr('aria-label');
    let legend = fieldset.querySelector<HTMLLegendElement>('.a11y-checkbox-group__legend');

    if (legendText) {
      if (!legend) {
        legend = document.createElement('legend');
        legend.className = 'a11y-checkbox-group__legend';
        fieldset.prepend(legend);
      }
      syncText(legend, legendText);
      syncAttr(fieldset, 'aria-label', null); // <legend> already provides an accessible name natively
    } else {
      legend?.remove();
      syncAttr(fieldset, 'aria-label', ariaLabel);
    }
  }

  /** Builds/removes the select-all `<label>` and keeps it right after the legend (or first). */
  private _syncSelectAllControl(fieldset: HTMLFieldSetElement): void {
    let wrapper = fieldset.querySelector<HTMLLabelElement>('.a11y-checkbox-group__select-all');
    if (!this.boolAttr('select-all')) {
      wrapper?.remove();
      return;
    }

    if (!wrapper) {
      wrapper = document.createElement('label');
      wrapper.className = 'a11y-checkbox a11y-checkbox-group__select-all';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = `a11y-checkbox__input ${SELECT_ALL_INPUT_CLASS}`;
      const span = document.createElement('span');
      span.className = 'a11y-checkbox__label';
      wrapper.append(input, span);
    }

    const legend = fieldset.querySelector('.a11y-checkbox-group__legend');
    const expectedPrevious = legend ?? null;
    if (wrapper.parentElement !== fieldset || wrapper.previousElementSibling !== expectedPrevious) {
      if (legend) legend.after(wrapper);
      else fieldset.prepend(wrapper);
    }

    syncText(wrapper.querySelector('.a11y-checkbox__label')!, this.stringAttr('select-all-label', getString('selectAll')));
  }

  /** Mirrors the enabled options onto the select-all input: checked / indeterminate / unchecked. */
  private _syncSelectAll(): void {
    const selectAll = this._selectAllInput();
    if (!selectAll) return;
    const enabled = this._enabledOptions();
    const checkedCount = enabled.filter((input) => input.checked).length;
    // IDL-only properties (never reflected) — safe to write unguarded.
    selectAll.checked = enabled.length > 0 && checkedCount === enabled.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < enabled.length;
    selectAll.disabled = enabled.length === 0;
  }

  private _setAllEnabled(checked: boolean): HTMLInputElement[] {
    const changed = this._enabledOptions().filter((input) => input.checked !== checked);
    for (const input of changed) input.checked = checked;
    this._syncSelectAll();
    return changed;
  }

  /** A select-all click: toggles every enabled option, fires their native events, then `onChange` once. */
  private _toggleAllFromUser(checked: boolean): void {
    const changed = this._setAllEnabled(checked);
    this._bulkUpdating = true;
    try {
      for (const input of changed) {
        input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } finally {
      this._bulkUpdating = false;
    }
    if (changed.length > 0) this.onChange?.(this.getValue());
  }
}
