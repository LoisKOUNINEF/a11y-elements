import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import type { PictureElement } from './picture.element.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mount(innerHtml: string): HTMLElement {
  const el = document.createElement('a11y-picture');
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('a11y-picture', () => {
  it('sets role=figure and the a11y-picture class without touching authored children', () => {
    const el = mount('<picture><img src="a.jpg" alt="A cat"></picture>');
    expect(el.getAttribute('role')).toBe('figure');
    expect(el.classList.contains('a11y-picture')).toBe(true);
    expect(el.querySelector('img')?.getAttribute('src')).toBe('a.jpg');
  });

  it('is not aria-hidden when alt text is present', () => {
    const el = mount('<picture><img src="a.jpg" alt="A cat"></picture>');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('is aria-hidden when alt="" and there is no caption (purely decorative)', () => {
    const el = mount('<picture><img src="a.jpg" alt=""></picture>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('is not aria-hidden when alt="" but a caption gives it meaning', () => {
    const el = mount('<picture><img src="a.jpg" alt=""></picture><figcaption>A stray cat</figcaption>');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('treats a whitespace-only figcaption as no caption', () => {
    const el = mount('<picture><img src="a.jpg" alt=""></picture><figcaption>   </figcaption>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('reacts to the alt attribute changing after connect (light-DOM mutation, not an attribute of the custom element itself)', async () => {
    const el = mount('<picture><img src="a.jpg" alt="A cat"></picture>');
    expect(el.hasAttribute('aria-hidden')).toBe(false);

    el.querySelector('img')!.setAttribute('alt', '');
    await flush();
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('reacts to a figcaption being added later', async () => {
    const el = mount('<picture><img src="a.jpg" alt=""></picture>');
    expect(el.getAttribute('aria-hidden')).toBe('true');

    const caption = document.createElement('figcaption');
    caption.textContent = 'Added later';
    el.appendChild(caption);
    await flush();
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('works with a bare <img> with no wrapping <picture>', () => {
    const el = mount('<img src="a.jpg" alt="">');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not set role=figure or the a11y-picture class when there is no <img>', () => {
    const el = mount('');
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.classList.contains('a11y-picture')).toBe(false);
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });
});

describe('a11y-picture — generated from attributes and properties', () => {
  const base = './assets/images/other-things/s';

  function create(attrs: Record<string, string> = {}): PictureElement {
    const el = document.createElement('a11y-picture') as PictureElement;
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    document.body.appendChild(el);
    return el;
  }

  const sourcesOf = (el: Element) =>
    [...el.querySelectorAll('picture > source')].map((s) => ({
      srcset: s.getAttribute('srcset'),
      type: s.getAttribute('type'),
      media: s.getAttribute('media'),
      sizes: s.getAttribute('sizes'),
    }));

  it('builds a picture with one source per format, then the fallback img', () => {
    const el = create({ src: 's.jpg', alt: 'S illustration', sources: 's.avif image/avif, s.webp image/webp' });
    const picture = el.querySelector('picture')!;
    expect([...picture.children].map((c) => c.tagName)).toEqual(['SOURCE', 'SOURCE', 'IMG']);
    expect(sourcesOf(el)).toEqual([
      { srcset: 's.avif', type: 'image/avif', media: null, sizes: null },
      { srcset: 's.webp', type: 'image/webp', media: null, sizes: null },
    ]);
    const img = picture.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('s.jpg');
    expect(img.alt).toBe('S illustration');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(el.getAttribute('role')).toBe('figure');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
  });

  it('takes the whole image as one object', () => {
    const el = create();
    el.image = {
      sources: [
        { src: `${base}.avif`, type: 'image/avif' },
        { src: `${base}.webp`, type: 'image/webp' },
      ],
      fallback: `${base}.jpg`,
      alt: 's illustration',
    };
    expect(sourcesOf(el).map((s) => [s.srcset, s.type])).toEqual([
      [`${base}.avif`, 'image/avif'],
      [`${base}.webp`, 'image/webp'],
    ]);
    expect(el.querySelector('img')!.getAttribute('src')).toBe(`${base}.jpg`);
    expect(el.querySelector('img')!.alt).toBe('s illustration');
  });

  it('takes the object before the element is defined or connected', () => {
    const el = document.createElement('a11y-picture') as PictureElement;
    el.image = { sources: [{ src: 's.webp', type: 'image/webp' }], fallback: 's.jpg', alt: 'S' };
    document.body.appendChild(el);
    expect(sourcesOf(el).map((s) => s.srcset)).toEqual(['s.webp']);
    expect(el.querySelector('img')!.getAttribute('src')).toBe('s.jpg');
  });

  it('supports srcset descriptors, media and sizes through the sources property', () => {
    const el = create({ src: 's.jpg', alt: 'S', sizes: '50vw' });
    el.sources = [
      { src: 'wide.avif 1x, wide@2x.avif 2x', type: 'image/avif', media: '(min-width: 800px)', sizes: '100vw' },
      { src: 's.avif', type: 'image/avif' },
    ];
    expect(sourcesOf(el)).toEqual([
      { srcset: 'wide.avif 1x, wide@2x.avif 2x', type: 'image/avif', media: '(min-width: 800px)', sizes: '100vw' },
      { srcset: 's.avif', type: 'image/avif', media: null, sizes: null },
    ]);
    expect(el.querySelector('img')!.getAttribute('sizes')).toBe('50vw');
  });

  it('lets the property override the attribute until the attribute changes', () => {
    const el = create({ src: 's.jpg', alt: 'S', sources: 'a.avif image/avif' });
    el.sources = [{ src: 'b.webp', type: 'image/webp' }];
    expect(sourcesOf(el).map((s) => s.srcset)).toEqual(['b.webp']);
    el.setAttribute('sources', 'c.avif image/avif');
    expect(sourcesOf(el).map((s) => s.srcset)).toEqual(['c.avif']);
    expect(el.sources).toEqual([{ src: 'c.avif', type: 'image/avif' }]);
  });

  it('adds, updates and removes sources, keeping unchanged ones', () => {
    const el = create({ src: 's.jpg', alt: 'S', sources: 's.avif image/avif' });
    const first = el.querySelector('source');
    el.setAttribute('sources', 's.avif image/avif, s.webp image/webp');
    expect(el.querySelector('source')).toBe(first);
    expect(sourcesOf(el)).toHaveLength(2);
    el.setAttribute('sources', 't.webp image/webp');
    expect(sourcesOf(el).map((s) => [s.srcset, s.type])).toEqual([['t.webp', 'image/webp']]);
    el.removeAttribute('sources');
    expect(el.querySelectorAll('source')).toHaveLength(0);
    expect(el.querySelector('picture > img')).not.toBeNull();
  });

  it('removes the generated markup when src goes away', () => {
    const el = create({ src: 's.jpg', alt: 'S', caption: 'A caption' });
    el.removeAttribute('src');
    expect(el.querySelector('picture')).toBeNull();
    expect(el.querySelector('figcaption')).toBeNull();
  });

  it('renders the caption as a figcaption, which keeps an alt="" image exposed', () => {
    const el = create({ src: 's.jpg', alt: '' });
    expect(el.getAttribute('aria-hidden')).toBe('true');
    el.caption = 'A stray cat';
    const caption = el.querySelector('figcaption')!;
    expect(caption.textContent).toBe('A stray cat');
    expect(caption.previousElementSibling?.tagName).toBe('PICTURE');
    expect(el.hasAttribute('aria-hidden')).toBe(false);
    el.caption = '';
    expect(el.querySelector('figcaption')).toBeNull();
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('passes width, height, loading and sizes to the img', () => {
    const el = create();
    el.image = { fallback: 's.jpg', alt: 'S', width: 640, height: 480, loading: 'eager' };
    const img = el.querySelector('img')!;
    expect(img.getAttribute('width')).toBe('640');
    expect(img.getAttribute('height')).toBe('480');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(el.width).toBe(640);
    el.image = { fallback: 's.jpg', alt: 'S' };
    expect(img.hasAttribute('width')).toBe(false);
    expect(img.getAttribute('loading')).toBe('lazy');
  });

  it('treats a missing alt as decorative, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = create({ src: 's.jpg' });
    el.setAttribute('width', '10');
    expect(el.querySelector('img')!.getAttribute('alt')).toBe('');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('skips a malformed sources entry, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = create({ src: 's.jpg', alt: 'S', sources: 's.avif, s.webp image/webp' });
    el.setAttribute('width', '10');
    expect(sourcesOf(el).map((s) => s.srcset)).toEqual(['s.webp']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('ignores authored children in generated mode', () => {
    const el = document.createElement('a11y-picture') as PictureElement;
    el.setAttribute('src', 's.jpg');
    el.setAttribute('alt', '');
    el.innerHTML = '<img src="other.jpg" alt="Other"><figcaption>Authored</figcaption>';
    document.body.appendChild(el);
    expect(el.firstElementChild?.tagName).toBe('PICTURE');
    expect(el.getAttribute('aria-hidden')).toBe('true'); // from the generated img, not the authored one
  });

  it('settles: a sync produces no further mutations', async () => {
    const el = create({ src: 's.jpg', alt: 'S', caption: 'C', sources: 's.avif image/avif, s.webp image/webp' });
    await flush();
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((r) => records.push(...r));
    observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    el.setAttribute('loading', 'lazy');
    await flush();
    await flush();
    observer.disconnect();
    expect(records.filter((r) => r.target !== el || r.attributeName !== 'loading')).toEqual([]);
  });
});
