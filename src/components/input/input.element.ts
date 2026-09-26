import { A11yFieldElement } from '../../core/a11y-field-element.js';

/**
 * A text field built from a real `<input>` and optional parts: an
 * `<a11y-label>`, any number of `<a11y-hint>`s, an `<a11y-error>` the
 * validation message is rendered into, and an `<a11y-counter>` (with
 * `maxlength`). See {@link A11yFieldElement} for how they're wired.
 *
 * ```html
 * <a11y-input type-mismatch-message="Enter an email like name@example.com">
 *   <a11y-label>Email</a11y-label>
 *   <input type="email" name="email" required>
 *   <a11y-hint>We never share it.</a11y-hint>
 *   <a11y-error></a11y-error>
 * </a11y-input>
 * ```
 *
 * Any text-like `type` works; checkbox, radio, range, color, file and hidden
 * inputs are left alone (use `<a11y-checkbox>`, `<a11y-radio-group>`, …).
 */
export class InputElement extends A11yFieldElement {
  protected readonly controlSelector =
    'input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"], [type="hidden"], [type="submit"], [type="reset"], [type="button"], [type="image"])';
}
