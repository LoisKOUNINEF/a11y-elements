import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(innerHtml = 'Menu'): HTMLElement {
  const el = document.createElement('a11y-focusable');
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('a11y-focusable', () => {
  it('applies role=button and tabindex=0', () => {
    const el = mount();
    expect(el.getAttribute('role')).toBe('button');
    expect(el.getAttribute('tabindex')).toBe('0');
  });

  it('preserves its own light-DOM content', () => {
    const el = mount('<svg aria-hidden="true"></svg> Menu');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.textContent?.trim()).toBe('Menu');
  });

  it('reflects an aria-label attribute (read natively, not managed by the element)', () => {
    const el = mount();
    el.setAttribute('aria-label', 'Expand menu');
    expect(el.getAttribute('aria-label')).toBe('Expand menu');
  });

  it('Enter triggers a real click event', () => {
    const el = mount();
    const spy = vi.fn();
    el.addEventListener('click', spy);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Space triggers a real click event and prevents the page from scrolling', () => {
    const el = mount();
    const spy = vi.fn();
    el.addEventListener('click', spy);
    const evt = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    el.dispatchEvent(evt);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(evt.defaultPrevented).toBe(true);
  });

  it('other keys do not trigger a click', () => {
    const el = mount();
    const spy = vi.fn();
    el.addEventListener('click', spy);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('a real mouse click also fires exactly once (no double-firing from the keydown handler)', () => {
    const el = mount();
    const spy = vi.fn();
    el.addEventListener('click', spy);
    el.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not accumulate duplicate listeners across re-renders (aria-label changes)', () => {
    const el = mount();
    el.setAttribute('aria-label', 'a');
    el.setAttribute('aria-label', 'b');
    const spy = vi.fn();
    el.addEventListener('click', spy);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('warns once (not repeatedly) when there is no accessible name', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount('');
    expect(warn).toHaveBeenCalledTimes(1);

    // Further re-renders (still no accessible name) must not warn again.
    el.setAttribute('aria-label', 'x');
    el.removeAttribute('aria-label');
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('does not warn when there is visible text content or an aria-label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mount('Menu'); // has text content

    const labeled = document.createElement('a11y-focusable');
    labeled.setAttribute('aria-label', 'Expand menu'); // set before connecting, so it's never label-less
    document.body.appendChild(labeled);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
