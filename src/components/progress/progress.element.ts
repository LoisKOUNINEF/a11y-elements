import { A11yElement } from '../../core/a11y-element.js';
import { getString } from '../../core/strings.js';
import { html } from '../../core/template.js';

let uidCounter = 0;
const nextLabelId = (): string => `a11y-progress-label-${++uidCounter}`;

/**
 * A progress bar. `<a11y-progress value="50" max="100" label="Uploading…"></a11y-progress>`
 *
 * The old version rendered a real `<label>` wrapping the `<progress>`, relying
 * on HTML's implicit label-wraps-control naming. A custom element can't
 * itself *be* a `<label>`, so the same accessible-name relationship is
 * expressed explicitly instead, via `aria-labelledby` pointing at the visible
 * label text — an equally robust, arguably more explicit equivalent.
 */
export class ProgressElement extends A11yElement {
  static get observedAttributes(): string[] {
    return ['value', 'max', 'label', 'aria-label'];
  }

  private _labelId = nextLabelId();

  get value(): number | undefined {
    const v = this.getAttribute('value');
    return v == null ? undefined : Number(v);
  }
  set value(v: number | undefined) {
    v == null ? this.removeAttribute('value') : this.setAttribute('value', String(v));
  }

  get max(): number {
    return this.numberAttr('max', 100);
  }
  set max(v: number) {
    this.setAttribute('max', String(v));
  }

  protected override onBeforeRender(): void {
    this.classList.add('a11y-progress');
  }

  protected override onStringsChange(): void {
    this.update();
  }

  protected override render(): string {
    const { value, max } = this;
    const label = this.optionalStringAttr('label');
    const ariaLabel = this.optionalStringAttr('aria-label');

    const labelMarkup = label ? html`<span class="a11y-progress__label" id="${this._labelId}">${label}</span>` : '';
    const progressAttrs = html`class="a11y-progress__bar"${value !== undefined ? html` value="${value}"` : ''} max="${max}"${
      label ? html` aria-labelledby="${this._labelId}"` : ariaLabel ? html` aria-label="${ariaLabel}"` : html` aria-label="${getString('progress')}"`
    }`;

    return `${labelMarkup}<progress ${progressAttrs}></progress>`;
  }
}
