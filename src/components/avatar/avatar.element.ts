import { A11yElement } from '../../core/a11y-element.js';
import { getString } from '../../core/strings.js';
import { h, setAttrs } from '../../core/dom.js';

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
  /** Created once and patched on every render, so a render that keeps the same `src` never reloads the image. */
  private _img = h('img', { class: 'a11y-avatar__img', loading: 'lazy', decoding: 'async' });
  private _initials = h('span', { class: 'a11y-avatar__initials', 'aria-hidden': 'true' });

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
      this.setAttribute('aria-label', this.alt || this.optionalStringAttr('initials') || getString('avatar'));
    }
  }

  /** The built-in name is only used without an image. */
  protected override onStringsChange(): void {
    if (!this._showsImg()) this.update();
  }

  protected override render(): Node {
    if (this._showsImg()) {
      // No initials alongside the image: if it fails, onAfterRender re-renders to the initials branch.
      setAttrs(this._img, { src: this.optionalStringAttr('src')!, alt: this.alt });
      return this._img;
    }

    this._initials.textContent = this.optionalStringAttr('initials') ?? '';
    return this._initials;
  }

  protected override onAfterRender(): void {
    if (!this._showsImg()) return;
    const img = this._img;

    // A fresh render always starts with _imgFailed reset, so a new `src`
    // gets a clean attempt. On failure, flip the flag and do a real
    // re-render (rather than hand-patching a few attributes) so the
    // initials-fallback / role / aria-label all end up consistent.
    this.listen(img, 'error', () => {
      this._imgFailed = true;
      // Setting the same `src` again on a later render then starts a new load, as a fresh <img> would.
      img.removeAttribute('src');
      this.update();
    });
  }
}
