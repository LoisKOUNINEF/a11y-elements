import { afterEach, describe, expect, it } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
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
