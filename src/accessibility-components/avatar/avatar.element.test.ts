import { afterEach, describe, expect, it } from 'vitest';
import './define.js';
import { resetStrings, setStrings } from '../../core/strings.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('a11y-avatar');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

describe('a11y-avatar', () => {
  it('renders an img with the given src/alt when src is provided', () => {
    const el = mount({ alt: 'Jane Doe', src: 'jane.jpg' });
    const img = el.querySelector<HTMLImageElement>('.a11y-avatar__img');
    expect(img?.getAttribute('src')).toBe('jane.jpg');
    expect(img?.getAttribute('alt')).toBe('Jane Doe');
    expect(el.hasAttribute('role')).toBe(false);
  });

  it('renders initials with role=img/aria-label when there is no src', () => {
    const el = mount({ alt: 'Jane Doe', initials: 'JD' });
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Jane Doe');
    expect(el.querySelector('.a11y-avatar__initials')?.textContent).toBe('JD');
    expect(el.querySelector('.a11y-avatar__initials')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults to circle shape and switches to square', () => {
    const el = mount({ alt: 'x' });
    expect(el.classList.contains('a11y-avatar--circle')).toBe(true);
    el.setAttribute('shape', 'square');
    expect(el.classList.contains('a11y-avatar--square')).toBe(true);
    expect(el.classList.contains('a11y-avatar--circle')).toBe(false);
  });

  it('sets --a11y-avatar-size only when the size attribute is given', () => {
    const el = mount({ alt: 'x', size: '4rem' });
    expect(el.style.getPropertyValue('--a11y-avatar-size')).toBe('4rem');
  });

  it('renders only the img (no initials next to it) when both src and initials are given', () => {
    const el = mount({ alt: 'Jane Doe', src: 'jane.jpg', initials: 'JD' });
    expect(el.children).toHaveLength(1);
    expect(el.querySelector('.a11y-avatar__img')).not.toBeNull();
    expect(el.querySelector('.a11y-avatar__fallback')).toBeNull();
    expect(el.querySelector('.a11y-avatar__initials')).toBeNull();
  });

  it('falls back to initials and takes over role/aria-label when the image fails to load', () => {
    const el = mount({ alt: 'Jane Doe', src: 'broken.jpg', initials: 'JD' });
    const img = el.querySelector<HTMLImageElement>('.a11y-avatar__img')!;
    img.dispatchEvent(new Event('error'));

    expect(el.querySelector('.a11y-avatar__img')).toBeNull();
    expect(el.querySelector('.a11y-avatar__initials')?.textContent).toBe('JD');
    expect(el.getAttribute('role')).toBe('img');
    expect(el.getAttribute('aria-label')).toBe('Jane Doe');
  });

  it('gives a new src attribute a fresh attempt after a previous image failure', () => {
    const el = mount({ alt: 'Jane Doe', src: 'broken.jpg', initials: 'JD' });
    el.querySelector<HTMLImageElement>('.a11y-avatar__img')!.dispatchEvent(new Event('error'));
    expect(el.querySelector('.a11y-avatar__img')).toBeNull();

    el.setAttribute('src', 'fixed.jpg');
    const img = el.querySelector<HTMLImageElement>('.a11y-avatar__img');
    expect(img?.getAttribute('src')).toBe('fixed.jpg');
    expect(el.hasAttribute('role')).toBe(false);
  });

  it('does not throw when the image fails and there are no initials to fall back to', () => {
    const el = mount({ alt: 'Jane Doe', src: 'broken.jpg' });
    const img = el.querySelector<HTMLImageElement>('.a11y-avatar__img')!;
    expect(() => img.dispatchEvent(new Event('error'))).not.toThrow();
  });

  it('falls back to initials, then a generic "Avatar" label, when alt is unset', () => {
    const withInitials = mount({ initials: 'JD' });
    expect(withInitials.getAttribute('aria-label')).toBe('JD');

    const withNeither = mount();
    expect(withNeither.getAttribute('aria-label')).toBe('Avatar');
  });
});

describe('a11y-avatar — translated fallback name', () => {
  afterEach(() => resetStrings());

  it('defaults to "Avatar"', () => {
    expect(mount().getAttribute('aria-label')).toBe('Avatar');
  });

  it('uses setStrings({ avatar }) for new and already-mounted avatars', () => {
    const mounted = mount();
    setStrings({ avatar: 'Photo de profil' });
    expect(mounted.getAttribute('aria-label')).toBe('Photo de profil');
    expect(mount().getAttribute('aria-label')).toBe('Photo de profil');
  });

  it('lets alt/initials win over setStrings', () => {
    setStrings({ avatar: 'Photo de profil' });
    expect(mount({ initials: 'JD' }).getAttribute('aria-label')).toBe('JD');
  });

  it('does not re-render (and reload) a showing image', () => {
    const el = mount({ alt: 'Jane', src: 'jane.jpg' });
    const img = el.querySelector('img');
    setStrings({ avatar: 'Photo de profil' });
    expect(el.querySelector('img')).toBe(img);
  });
});
