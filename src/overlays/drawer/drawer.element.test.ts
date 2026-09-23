import { afterEach, describe, expect, it } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll');
});

function mount(): HTMLElement & { open: boolean } {
  const el = document.createElement('a11y-drawer') as HTMLElement & { open: boolean };
  el.innerHTML = '<h2>Filters</h2>';
  document.body.appendChild(el);
  return el;
}

describe('a11y-drawer', () => {
  it('defaults to the right edge', () => {
    const el = mount();
    el.open = true;
    expect(document.querySelector('.a11y-drawer-wrapper')!.classList.contains('a11y-drawer-wrapper--right')).toBe(true);
  });

  it('respects the edge attribute', () => {
    const el = mount();
    el.setAttribute('edge', 'left');
    el.open = true;
    expect(document.querySelector('.a11y-drawer-wrapper')!.classList.contains('a11y-drawer-wrapper--left')).toBe(true);
  });

  it('falls back to right for an invalid edge value', () => {
    const el = mount();
    el.setAttribute('edge', 'bogus');
    el.open = true;
    expect(document.querySelector('.a11y-drawer-wrapper')!.classList.contains('a11y-drawer-wrapper--right')).toBe(true);
  });

  it('always activates a focus trap, same as modal', () => {
    const el = mount();
    el.innerHTML = '<h2>Filters</h2><button>Apply</button>';
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('button'));
  });

  it('locks scroll and uses its own distinct backdrop/wrapper classes (not a11y-modal-overlay/modal-wrapper)', () => {
    const el = mount();
    el.open = true;
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(true);
    expect(document.querySelector('.a11y-modal-overlay')).toBeNull();
    expect(document.querySelector('.a11y-drawer-backdrop')).not.toBeNull();
  });
});
