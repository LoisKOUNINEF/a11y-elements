import { A11yFieldElement } from '../../core/a11y-field-element.js';

/**
 * A multi-line text field built from a real `<textarea>`, with the same
 * optional parts as `<a11y-input>`. An `<a11y-counter>` shows the length
 * against `maxlength`, and announces the characters left near the limit.
 *
 * ```html
 * <a11y-textarea value-missing-message="Tell us a bit more">
 *   <a11y-label>Bio</a11y-label>
 *   <textarea name="bio" required maxlength="200"></textarea>
 *   <a11y-counter></a11y-counter>
 *   <a11y-error></a11y-error>
 * </a11y-textarea>
 * ```
 */
export class TextareaElement extends A11yFieldElement {
  protected readonly controlSelector = 'textarea';
}
