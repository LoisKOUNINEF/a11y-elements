import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr, syncClass, syncText } from '../../core/dom-sync.js';

/** Marks the markup this element builds itself (in generated mode), so it never mixes it up with the consumer's. */
const GENERATED = 'data-a11y-generated';

/** One `<source>` of a generated `<picture>`. */
export interface PictureSource {
  /** A URL, or a full srcset (`s.avif 1x, s@2x.avif 2x`). */
  src: string;
  /** The MIME type (`image/avif`), so the browser skips formats it can't decode. */
  type?: string;
  media?: string;
  sizes?: string;
}

/** Everything a generated picture needs, in one object — see `PictureElement.image`. */
export interface PictureImage {
  /** Tried in order: put the most efficient format first. */
  sources?: PictureSource[];
  /** The `<img>` src, used when no source's type is supported. */
  fallback: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
}

/**
 * An accessible figure around a picture: `role="figure"`, and hidden from
 * assistive tech (`aria-hidden`) when the image is decorative — an empty
 * `alt` and no caption.
 *
 * The picture is either authored by the consumer — native HTML already
 * handles format and responsive selection through real `<source>` children:
 *
 * ```html
 * <a11y-picture>
 *   <picture>
 *     <source srcset="hero.webp" type="image/webp">
 *     <img src="hero.jpg" alt="Sunset over the Rockies" loading="lazy" decoding="async">
 *   </picture>
 *   <figcaption>Sunset over the Rockies</figcaption>
 * </a11y-picture>
 * ```
 *
 * …or generated from attributes/properties, as soon as there's a `src` (the
 * fallback image). The browser uses the first source whose `type` it
 * supports, else the fallback:
 *
 * ```html
 * <a11y-picture src="s.jpg" alt="S illustration" sources="s.avif image/avif, s.webp image/webp"></a11y-picture>
 * ```
 *
 * ```js
 * el.image = { sources: [{ src: 's.avif', type: 'image/avif' }], fallback: 's.jpg', alt: 'S illustration' };
 * ```
 *
 * Use one or the other: in generated mode, authored children are ignored.
 */
export class PictureElement extends A11yWrapperElement {
  static get observedAttributes(): string[] {
    return ['src', 'alt', 'sources', 'caption', 'width', 'height', 'loading', 'sizes'];
  }

  /** Sources set as a property; `null` falls back to the `sources` attribute. */
  private _sources: PictureSource[] | null = null;
  /** The `sources` attribute value last parsed, and the result — parsed (and warned about) once per value. */
  private _parsed: [value: string | null, sources: PictureSource[]] = [null, []];
  private _warnedAlt = false;

  /** The fallback image. Setting it switches to generated mode. */
  get src(): string {
    return this.stringAttr('src');
  }

  set src(value: string) {
    this._setOptionalAttr('src', value);
  }

  get alt(): string {
    return this.stringAttr('alt');
  }

  set alt(value: string) {
    // `''` is meaningful (decorative), so only null/undefined remove it.
    if (value == null) this.removeAttribute('alt');
    else this.setAttribute('alt', value);
  }

  get caption(): string {
    return this.stringAttr('caption');
  }

  set caption(value: string) {
    this._setOptionalAttr('caption', value);
  }

  get width(): number | undefined {
    return this._optionalNumber('width');
  }

  set width(value: number | undefined) {
    this._setOptionalAttr('width', value);
  }

  get height(): number | undefined {
    return this._optionalNumber('height');
  }

  set height(value: number | undefined) {
    this._setOptionalAttr('height', value);
  }

  get loading(): 'lazy' | 'eager' {
    return this.getAttribute('loading') === 'eager' ? 'eager' : 'lazy';
  }

  set loading(value: 'lazy' | 'eager') {
    this._setOptionalAttr('loading', value);
  }

  /** Set as a property, or parsed from the `sources` attribute (`url type` pairs, comma-separated). */
  get sources(): PictureSource[] {
    if (this._sources) return this._sources;
    const value = this.getAttribute('sources');
    if (this._parsed[0] !== value) this._parsed = [value, parseSources(value)];
    return this._parsed[1];
  }

  /** Overrides the `sources` attribute until it changes. Needed for srcset descriptors, `media` or `sizes`. */
  set sources(value: PictureSource[]) {
    this._sources = value ? value.map((source) => ({ ...source })) : null;
    if (this._connected) this._sync();
  }

  /** Sets the whole picture at once — sources, fallback, alt and the optional fields — in one sync. */
  set image(image: PictureImage) {
    this._sources = (image.sources ?? []).map((source) => ({ ...source }));
    const connected = this._connected;
    this._connected = false; // one sync at the end, not one per attribute
    try {
      this.src = image.fallback;
      this.alt = image.alt;
      this.caption = image.caption ?? '';
      this.width = image.width;
      this.height = image.height;
      this.loading = image.loading ?? 'lazy';
    } finally {
      this._connected = connected;
    }
    if (connected) this._sync();
  }

  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'sources' && oldValue !== newValue) this._sources = null; // the attribute set last wins
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  protected override observerInit(): MutationObserverInit {
    return { childList: true, subtree: true, attributes: true, attributeFilter: ['alt'] };
  }

  protected override _sync(): void {
    const generated = this.hasAttribute('src');
    if (generated) this._syncGenerated();
    else this._removeGenerated();

    const img = generated
      ? this.querySelector<HTMLImageElement>(`:scope > picture[${GENERATED}] > img`)
      : this.querySelector('img');
    if (!img) return;

    // Guarded writes: this runs inside a MutationObserver callback watching
    // this subtree, and setAttribute/classList.add queue a mutation record
    // even when the value is unchanged — unguarded, that retriggers the
    // observer forever. The attributeFilter above already keeps this element's
    // own writes (role/class/aria-hidden) out of scope, but staying guarded
    // here too means that isn't load-bearing for correctness.
    syncClass(this, 'a11y-picture', true);
    syncAttr(this, 'role', 'figure');

    const caption = generated ? this.querySelector(`:scope > figcaption[${GENERATED}]`) : this.querySelector('figcaption');
    const hasCaption = !!caption?.textContent?.trim();
    const isDecorative = img.getAttribute('alt') === '' && !hasCaption;

    syncAttr(this, 'aria-hidden', isDecorative ? 'true' : null);
  }

  /** Builds `<picture>` (sources, then the fallback `<img>`) and the caption from this element's attributes/properties. */
  private _syncGenerated(): void {
    let picture = this.querySelector<HTMLPictureElement>(`:scope > picture[${GENERATED}]`);
    if (!picture) {
      picture = document.createElement('picture');
      picture.setAttribute(GENERATED, '');
      picture.append(document.createElement('img'));
      this.prepend(picture);
    }
    const img = picture.querySelector<HTMLImageElement>(':scope > img')!;

    const sources = this.sources.filter((source) => source.src);
    let elements = [...picture.querySelectorAll<HTMLSourceElement>(':scope > source')];
    // Add or remove only the difference, so unchanged sources aren't reloaded.
    while (elements.length < sources.length) {
      const source = document.createElement('source');
      img.before(source);
      elements.push(source);
    }
    for (const extra of elements.splice(sources.length)) extra.remove();
    sources.forEach((source, i) => {
      const el = elements[i]!;
      syncAttr(el, 'srcset', source.src);
      syncAttr(el, 'type', source.type || null);
      syncAttr(el, 'media', source.media || null);
      syncAttr(el, 'sizes', source.sizes || null);
    });

    // Sizes first: the browser picks from srcset/src with them already known.
    syncAttr(img, 'sizes', this.getAttribute('sizes'));
    syncAttr(img, 'width', this.getAttribute('width'));
    syncAttr(img, 'height', this.getAttribute('height'));
    syncAttr(img, 'loading', this.loading);
    syncAttr(img, 'decoding', 'async');
    syncAttr(img, 'alt', this.getAttribute('alt') ?? '');
    syncAttr(img, 'src', this.src);
    if (!this.hasAttribute('alt') && !this._warnedAlt) {
      this._warnedAlt = true;
      console.warn('<a11y-picture> has no alt — describe the image, or set alt="" if it is decorative.');
    }

    let caption = this.querySelector<HTMLElement>(`:scope > figcaption[${GENERATED}]`);
    const text = this.caption.trim();
    if (!text) {
      caption?.remove();
      return;
    }
    if (!caption) {
      caption = document.createElement('figcaption');
      caption.setAttribute(GENERATED, '');
    }
    if (caption.previousElementSibling !== picture) picture.after(caption);
    syncText(caption, text);
  }

  private _removeGenerated(): void {
    for (const el of this.querySelectorAll(`:scope > [${GENERATED}]`)) el.remove();
  }

  private _setOptionalAttr(name: string, value: string | number | null | undefined): void {
    if (value == null || value === '') this.removeAttribute(name);
    else this.setAttribute(name, String(value));
  }

  private _optionalNumber(name: string): number | undefined {
    const value = Number(this.getAttribute(name) ?? NaN);
    return Number.isNaN(value) ? undefined : value;
  }
}

/** `"s.avif image/avif, s.webp image/webp"` → sources. Entries that aren't `url type` are skipped, with a warning. */
function parseSources(value: string | null): PictureSource[] {
  if (!value) return [];
  const sources: PictureSource[] = [];
  for (const entry of value.split(',').map((part) => part.trim()).filter(Boolean)) {
    const match = entry.match(/^(\S+)\s+([\w-]+\/[\w.+-]+)$/);
    if (match) sources.push({ src: match[1]!, type: match[2]! });
    else console.warn(`<a11y-picture> ignored the source "${entry}": write "url type", e.g. "hero.avif image/avif".`);
  }
  return sources;
}
