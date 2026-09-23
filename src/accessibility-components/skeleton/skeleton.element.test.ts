import { afterEach, describe, expect, it } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('a11y-skeleton');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

describe('a11y-skeleton', () => {
  it('defaults to the rect variant, aria-hidden, and no lines', () => {
    const el = mount();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.classList.contains('a11y-skeleton')).toBe(true);
    expect(el.classList.contains('a11y-skeleton--rect')).toBe(true);
    expect(el.querySelectorAll('.a11y-skeleton__line')).toHaveLength(0);
  });

  it('sets width/height CSS custom properties only when given', () => {
    const el = mount({ width: '10rem', height: '2rem' });
    expect(el.style.getPropertyValue('--a11y-skeleton-width')).toBe('10rem');
    expect(el.style.getPropertyValue('--a11y-skeleton-height')).toBe('2rem');

    const bare = mount();
    expect(bare.style.getPropertyValue('--a11y-skeleton-width')).toBe('');
  });

  it('renders no lines for a single-line text variant (or any non-multiline variant)', () => {
    const el = mount({ variant: 'text' });
    expect(el.classList.contains('a11y-skeleton--multiline')).toBe(false);
    expect(el.querySelectorAll('.a11y-skeleton__line')).toHaveLength(0);
  });

  it('renders one .a11y-skeleton__line per line and adds a11y-skeleton--multiline when text + lines > 1', () => {
    const el = mount({ variant: 'text', lines: '3' });
    expect(el.classList.contains('a11y-skeleton--multiline')).toBe(true);
    expect(el.querySelectorAll('.a11y-skeleton__line')).toHaveLength(3);
  });

  it('ignores lines > 1 for non-text variants (no multiline class, no line spans)', () => {
    const el = mount({ variant: 'circle', lines: '3' });
    expect(el.classList.contains('a11y-skeleton--multiline')).toBe(false);
    expect(el.querySelectorAll('.a11y-skeleton__line')).toHaveLength(0);
  });

  it('falls back to rect for an invalid variant attribute', () => {
    const el = mount({ variant: 'bogus' });
    expect(el.classList.contains('a11y-skeleton--rect')).toBe(true);
  });

  it('removes the previous variant class when variant changes', () => {
    const el = mount(); // rect
    el.setAttribute('variant', 'circle');
    expect(el.classList.contains('a11y-skeleton--circle')).toBe(true);
    expect(el.classList.contains('a11y-skeleton--rect')).toBe(false);
  });
});
