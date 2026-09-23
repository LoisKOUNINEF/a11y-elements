import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import './define.js';

let anchor: HTMLButtonElement;

beforeEach(() => {
  anchor = document.createElement('button');
  anchor.id = 'trigger';
  document.body.appendChild(anchor);
});

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(): HTMLElement & { open: boolean } {
  const el = document.createElement('a11y-dropdown') as HTMLElement & { open: boolean };
  el.setAttribute('anchor', 'trigger');
  el.innerHTML = `
    <div role="menuitem">Edit</div>
    <div role="menuitem">Delete</div>
  `;
  document.body.appendChild(el);
  return el;
}

describe('a11y-dropdown', () => {
  it('opens anchored to the given element with dropdown chrome', () => {
    const el = mount();
    el.open = true;
    const wrapper = document.querySelector('.a11y-dropdown-wrapper')!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.getAttribute('role')).toBe('menu');
  });

  it('inherits full menu keyboard behavior from A11yMenuOverlayElement', () => {
    const el = mount();
    el.open = true;
    const [edit, del] = [...el.querySelectorAll('[role="menuitem"]')] as HTMLElement[];
    expect(document.activeElement).toBe(edit);

    document.querySelector('.a11y-dropdown-wrapper')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(del);
  });
});

describe('a11y-dropdown — trigger wiring', () => {
  it('sets aria-haspopup/aria-controls on the anchor and keeps aria-expanded in sync', () => {
    const el = mount() as HTMLElement & { open: boolean };
    expect(anchor.getAttribute('aria-haspopup')).toBe('menu');
    expect(anchor.getAttribute('aria-controls')).toBe(el.id);
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
    el.open = true;
    expect(anchor.getAttribute('aria-expanded')).toBe('true');
    el.open = false;
    expect(anchor.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggles open on anchor click', () => {
    const el = mount();
    anchor.click();
    expect(el.open).toBe(true);
    anchor.click();
    expect(el.open).toBe(false);
  });

  it('labels the menu with the anchor', () => {
    const el = mount();
    el.open = true;
    expect(document.querySelector('.a11y-dropdown-wrapper')!.getAttribute('aria-labelledby')).toBe('trigger');
  });

  it('returns focus to the trigger when closed with Escape or by activating an item', () => {
    const el = mount();
    anchor.focus();
    anchor.click();
    expect(document.activeElement).not.toBe(anchor);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(anchor);

    anchor.click();
    (el.querySelector('[role="menuitem"]') as HTMLElement).click();
    expect(el.open).toBe(false);
    expect(document.activeElement).toBe(anchor);
  });

  it('cleans its ARIA off the anchor when removed', () => {
    const el = mount();
    el.remove();
    expect(anchor.hasAttribute('aria-haspopup')).toBe(false);
    expect(anchor.hasAttribute('aria-expanded')).toBe(false);
  });
});
