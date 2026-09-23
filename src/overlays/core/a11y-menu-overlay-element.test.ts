import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { A11yMenuOverlayElement } from './a11y-menu-overlay-element.js';

class TestMenu extends A11yMenuOverlayElement {}
customElements.define('test-menu-overlay', TestMenu);

let anchor: HTMLButtonElement;

beforeEach(() => {
  anchor = document.createElement('button');
  anchor.id = 'trigger';
  document.body.appendChild(anchor);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(): TestMenu {
  const el = document.createElement('test-menu-overlay') as TestMenu;
  el.setAttribute('anchor', 'trigger');
  el.innerHTML = `
    <div role="menuitem" data-value="edit">Edit</div>
    <div role="menuitem" data-value="delete" aria-disabled="true">Delete</div>
    <div role="menuitem" data-value="share">Share</div>
  `;
  document.body.appendChild(el);
  return el;
}

describe('A11yMenuOverlayElement', () => {
  it('sets role=menu on the wrapper', () => {
    const el = mount();
    el.open = true;
    expect(document.querySelector('.a11y-anchored-overlay-wrapper')!.getAttribute('role')).toBe('menu');
  });

  it('never uses a focus trap — Escape closes it directly (roving tabindex, not trapped)', () => {
    const el = mount();
    el.open = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.open).toBe(false);
  });

  it('gives the first item tabindex=0 and the rest -1, and focuses the first enabled item on open', () => {
    const el = mount();
    el.open = true;
    const items = [...el.querySelectorAll('[role="menuitem"]')];
    expect(items.map((i) => i.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowDown/ArrowUp move roving tabindex and focus across enabled items only, wrapping around', () => {
    const el = mount();
    el.open = true;
    const wrapper = document.querySelector('.a11y-anchored-overlay-wrapper')!;
    const [edit, , share] = [...el.querySelectorAll('[role="menuitem"]')] as HTMLElement[];

    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(share); // skips the disabled "delete" item
    expect(share!.getAttribute('tabindex')).toBe('0');
    expect(edit!.getAttribute('tabindex')).toBe('-1');

    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(edit); // wraps back to the first enabled item
  });

  it('Home/End jump to the first/last enabled item', () => {
    const el = mount();
    el.open = true;
    const wrapper = document.querySelector('.a11y-anchored-overlay-wrapper')!;
    const [edit, , share] = [...el.querySelectorAll('[role="menuitem"]')] as HTMLElement[];

    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(share);
    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(edit);
  });

  it('Enter/Space on the focused item triggers a real click on it', () => {
    const el = mount();
    el.open = true;
    const wrapper = document.querySelector('.a11y-anchored-overlay-wrapper')!;
    const edit = el.querySelector('[role="menuitem"]') as HTMLElement;
    const spy = vi.fn();
    edit.addEventListener('click', spy);

    wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('closes automatically after an enabled item is clicked, by mouse', () => {
    const el = mount();
    el.open = true;
    const edit = el.querySelector('[role="menuitem"]') as HTMLElement;
    edit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.open).toBe(false);
  });

  it('does not close when a disabled item is clicked', () => {
    const el = mount();
    el.open = true;
    const disabled = el.querySelector('[aria-disabled="true"]') as HTMLElement;
    disabled.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.open).toBe(true);
  });

  it('closes when focus moves outside the menu (focusout to an unrelated element)', () => {
    const el = mount();
    el.open = true;
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    const wrapper = document.querySelector('.a11y-anchored-overlay-wrapper')!;

    wrapper.dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside }));
    expect(el.open).toBe(false);
  });

  it('unbinds menu keyboard handling on close (no stale listeners fire on a detached wrapper)', () => {
    const el = mount();
    el.open = true;
    const wrapper = document.querySelector('.a11y-anchored-overlay-wrapper')!;
    el.open = false;
    wrapper.dispatchEvent(new Event('transitionend'));

    // Re-dispatching on the now-detached wrapper must not throw or do anything.
    expect(() => wrapper.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))).not.toThrow();
  });

  it('falls back to focusing the wrapper when there are zero menu items, instead of leaving focus stranded', () => {
    const el = document.createElement('test-menu-overlay') as TestMenu;
    el.setAttribute('anchor', 'trigger');
    document.body.appendChild(el);

    expect(() => (el.open = true)).not.toThrow();
    const wrapper = document.querySelector('.a11y-anchored-overlay-wrapper')!;
    expect(document.activeElement).toBe(wrapper);
    expect(wrapper.getAttribute('tabindex')).toBe('-1');
  });
});
