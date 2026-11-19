import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncClass, syncText } from '../../core/dom-sync.js';
import type { ValueElement } from '../../core/value-element.js';
import { doc } from '../../core/safe-dom.js';

/**
 * Enhances a real `<input type="checkbox">` authored by the consumer with a
 * wrapping `<label>` (for native click-the-label-to-toggle + implicit
 * accessible naming — a custom element can't itself *be* a `<label>`) and a
 * visible label span.
 *
 * ```html
 * <a11y-checkbox label="Accept terms">
 *   <input type="checkbox" name="terms" required>
 * </a11y-checkbox>
 * ```
 *
 * The input is never regenerated — id/name/value/checked/disabled/required
 * are plain native HTML attributes the consumer already controls directly,
 * so there's nothing to keep in sync and no risk of an unrelated re-render
 * wiping out a user's live checked state. `indeterminate` (no HTML attribute
 * equivalent) and `onChange` are the two things this element adds.
 *
 * Every DOM write in `_sync()` goes through the guarded `dom-sync` helpers:
 * `setAttribute`/`classList.add`/`textContent =` all queue a mutation record
 * even when the value is unchanged, and `_sync()` itself runs inside a
 * `MutationObserver` callback watching this subtree — an unguarded write
 * would retrigger the observer forever.
 */
export class CheckboxElement extends A11yWrapperElement implements ValueElement<boolean> {
  static get observedAttributes(): string[] {
    return ['label', 'indeterminate'];
  }


  /** Called with the input's current `checked` state on every native `change` event. */
  declare onChange?: (checked: boolean) => void;

  getValue(): boolean {
    return this._input()?.checked ?? false;
  }

  setValue(checked: boolean): void {
    const input = this._input();
    if (input) input.checked = checked;
  }

  /** The `indeterminate` attribute as last applied, per input: it's only written when it changes. */
  private _appliedIndeterminate = new WeakMap<HTMLInputElement, boolean>();

  private _input(): HTMLInputElement | null {
    return this.querySelector('input[type="checkbox"]');
  }

  protected override _sync(): void {
    const input = this._input();
    if (!input) return;

    const wrapper = this._ensureWrapper(input);
    syncClass(input, 'a11y-checkbox__input', true);
    // Only when the attribute changes: a click clears `indeterminate` natively, and the consumer may set
    // the property directly — an unrelated re-sync (label, disabled…) must not put the attribute's back.
    const indeterminate = this.boolAttr('indeterminate');
    if ((this._appliedIndeterminate.get(input) ?? false) !== indeterminate) input.indeterminate = indeterminate;
    this._appliedIndeterminate.set(input, indeterminate);
    this._syncLabel(wrapper);

    this.wireOnce(input, () => this.listen(input, 'change', () => this.onChange?.(input.checked)));
  }

  private _ensureWrapper(input: HTMLInputElement): HTMLLabelElement {
    const existing = input.closest<HTMLLabelElement>('label.a11y-checkbox');
    if (existing && existing.parentElement === this) return existing;

    const wrapper = doc.createElement('label');
    wrapper.className = 'a11y-checkbox';
    input.replaceWith(wrapper);
    wrapper.appendChild(input);
    return wrapper;
  }

  private _syncLabel(wrapper: HTMLLabelElement): void {
    const text = this.optionalStringAttr('label');
    let span = wrapper.querySelector<HTMLElement>('.a11y-checkbox__label');
    if (!text) {
      span?.remove();
      return;
    }
    if (!span) {
      span = doc.createElement('span');
      span.className = 'a11y-checkbox__label';
      wrapper.appendChild(span);
    }
    syncText(span, text);
  }
}
