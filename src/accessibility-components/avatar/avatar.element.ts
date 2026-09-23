import { A11yElement } from '../../core/a11y-element.js';
import { html, type Raw } from '../../core/template.js';

export type AvatarShape = 'circle' | 'square';

/**
 * A user avatar image with an initials fallback.
 * `<a11y-avatar alt="Jane Doe" src="jane.jpg" initials="JD"></a11y-avatar>`
 */
export class AvatarElement extends A11yElement {
  static get observedAttributes(): string[] {
    return ['alt', 'src', 'initials', 'size', 'shape'];
  }

  /** Set when the `src` image fails to load, until a new render (e.g. `src` changing) clears it. */
  private _imgFailed = false;

  get alt(): string {
    return this.stringAttr('alt');
  }
  set alt(value: string) {
    this.setAttribute('alt', value);
  }

  get shape(): AvatarShape {
    return this.getAttribute('shape') === 'square' ? 'square' : 'circle';
  }
  set shape(value: AvatarShape) {
    this.setAttribute('shape', value);
  }

  private _showsImg(): boolean {
    return !!this.optionalStringAttr('src') && !this._imgFailed;
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'src') this._imgFailed = false; // give a new src a fresh attempt
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  protected override onBeforeRender(): void {
    this.classList.add('a11y-avatar');
    this.classList.remove('a11y-avatar--circle', 'a11y-avatar--square');
    this.classList.add(`a11y-avatar--${this.shape}`);
    this.setCssVar('--a11y-avatar-size', this.optionalStringAttr('size'));

    // A real <img alt> already has an implicit accessible name; only take
    // over as role=img ourselves when there's no image actually showing.
    if (this._showsImg()) {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
    } else {
      this.setAttribute('role', 'img');
      this.setAttribute('aria-label', this.alt || this.optionalStringAttr('initials') || 'Avatar');
    }
  }

  protected override render(): Raw {
    const initials = this.optionalStringAttr('initials');

    if (this._showsImg()) {
      const src = this.optionalStringAttr('src')!;
      return html`<img class="a11y-avatar__img" src="${src}" alt="${this.alt}" loading="lazy" decoding="async">${
        initials ? html`<span class="a11y-avatar__fallback" aria-hidden="true">${initials}</span>` : ''
      }`;
    }

    return html`<span class="a11y-avatar__initials" aria-hidden="true">${initials}</span>`;
  }

  protected override onAfterRender(): void {
    if (!this._showsImg()) return;
    const img = this.querySelector<HTMLImageElement>('.a11y-avatar__img');
    if (!img) return;

    // A fresh render always starts with _imgFailed reset, so a new `src`
    // gets a clean attempt. On failure, flip the flag and do a real
    // re-render (rather than hand-patching a few attributes) so the
    // initials-fallback / role / aria-label all end up consistent.
    this.listen(img, 'error', () => {
      this._imgFailed = true;
      this.update();
    });
  }
}
