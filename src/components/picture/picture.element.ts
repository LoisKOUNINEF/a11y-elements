import { A11yWrapperElement } from '../../core/a11y-wrapper-element.js';
import { syncAttr, syncClass } from '../../core/dom-sync.js';

/**
 * An accessible figure wrapper around a real `<picture>`/`<img>` (and an
 * optional `<figcaption>`) authored directly by the consumer — native HTML
 * already handles responsive source selection via real `<source>` children,
 * so this element's only job is accessibility: it toggles `aria-hidden`
 * automatically when the image is decorative (an empty `alt` and no
 * caption), the same rule the old framework-driven version used.
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
 */
export class PictureElement extends A11yWrapperElement {
  protected override observerInit(): MutationObserverInit {
    return { childList: true, subtree: true, attributes: true, attributeFilter: ['alt'] };
  }

  protected override _sync(): void {
    const img = this.querySelector('img');
    if (!img) return;

    // Guarded writes: this runs inside a MutationObserver callback watching
    // this subtree, and setAttribute/classList.add queue a mutation record
    // even when the value is unchanged — unguarded, that retriggers the
    // observer forever. The attributeFilter above already keeps this element's
    // own writes (role/class/aria-hidden) out of scope, but staying guarded
    // here too means that isn't load-bearing for correctness.
    syncClass(this, 'a11y-picture', true);
    syncAttr(this, 'role', 'figure');

    const caption = this.querySelector('figcaption');
    const hasCaption = !!caption?.textContent?.trim();
    const isDecorative = img.getAttribute('alt') === '' && !hasCaption;

    syncAttr(this, 'aria-hidden', isDecorative ? 'true' : null);
  }
}
