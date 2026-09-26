import { A11yElement } from '../../core/a11y-element.js';
import { getString } from '../../core/strings.js';
import { html, type Raw } from '../../core/template.js';

const CSS_VARS = {
  size: '--a11y-spinner-size',
  color: '--a11y-spinner-color',
  duration: '--a11y-spinner-duration',
  thickness: '--a11y-spinner-thickness',
} as const;

/**
 * A loading spinner. Zero JS required:
 * `<a11y-spinner label="Saving…" size="3rem"></a11y-spinner>`
 */
export class SpinnerElement extends A11yElement {
  static get observedAttributes(): string[] {
    return ['label', 'size', 'color', 'duration', 'thickness'];
  }

  get label(): string {
    return this.stringAttr('label', getString('loading'));
  }
  set label(value: string) {
    this.setAttribute('label', value);
  }

  get size(): string | undefined {
    return this.optionalStringAttr('size');
  }
  set size(value: string | undefined) {
    value ? this.setAttribute('size', value) : this.removeAttribute('size');
  }

  get color(): string | undefined {
    return this.optionalStringAttr('color');
  }
  set color(value: string | undefined) {
    value ? this.setAttribute('color', value) : this.removeAttribute('color');
  }

  get duration(): string | undefined {
    return this.optionalStringAttr('duration');
  }
  set duration(value: string | undefined) {
    value ? this.setAttribute('duration', value) : this.removeAttribute('duration');
  }

  get thickness(): string | undefined {
    return this.optionalStringAttr('thickness');
  }
  set thickness(value: string | undefined) {
    value ? this.setAttribute('thickness', value) : this.removeAttribute('thickness');
  }

  protected override onBeforeRender(): void {
    this.setAttribute('role', 'status');
    this.setAttribute('aria-label', this.label);
    this.classList.add('a11y-spinner');

    this.setCssVar(CSS_VARS.size, this.size);
    this.setCssVar(CSS_VARS.color, this.color);
    this.setCssVar(CSS_VARS.duration, this.duration);
    this.setCssVar(CSS_VARS.thickness, this.thickness);
  }

  protected override onStringsChange(): void {
    this.update();
  }

  protected override render(): Raw {
    return html`<span class="a11y-spinner__ring" aria-hidden="true"></span>`;
  }
}
