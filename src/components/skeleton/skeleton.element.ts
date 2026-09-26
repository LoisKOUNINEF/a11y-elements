import { A11yElement } from '../../core/a11y-element.js';
import { html, raw, type Raw } from '../../core/template.js';

export type SkeletonVariant = 'rect' | 'circle' | 'text';

/**
 * A loading placeholder shape. Zero JS required:
 * `<a11y-skeleton variant="text" lines="3"></a11y-skeleton>`
 */
export class SkeletonElement extends A11yElement {
  static get observedAttributes(): string[] {
    return ['variant', 'width', 'height', 'lines'];
  }

  get variant(): SkeletonVariant {
    const value = this.getAttribute('variant');
    return value === 'circle' || value === 'text' ? value : 'rect';
  }
  set variant(value: SkeletonVariant) {
    this.setAttribute('variant', value);
  }

  get lines(): number {
    return this.numberAttr('lines', 1);
  }
  set lines(value: number) {
    this.setAttribute('lines', String(value));
  }

  protected override onBeforeRender(): void {
    this.setAttribute('aria-hidden', 'true');
    this.classList.add('a11y-skeleton');
    this.classList.remove('a11y-skeleton--rect', 'a11y-skeleton--circle', 'a11y-skeleton--text');
    this.classList.add(`a11y-skeleton--${this.variant}`);
    this.setCssVar('--a11y-skeleton-width', this.optionalStringAttr('width'));
    this.setCssVar('--a11y-skeleton-height', this.optionalStringAttr('height'));
    this.classList.toggle('a11y-skeleton--multiline', this.variant === 'text' && this.lines > 1);
  }

  protected override render(): string | Raw {
    if (this.variant === 'text' && this.lines > 1) {
      return html`${Array.from({ length: this.lines }, () => raw('<span class="a11y-skeleton__line"></span>'))}`;
    }
    return '';
  }
}
