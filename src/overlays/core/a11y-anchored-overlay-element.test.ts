import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { A11yAnchoredOverlayElement } from './a11y-anchored-overlay-element.js';

class TestAnchored extends A11yAnchoredOverlayElement {}
customElements.define('test-anchored-overlay', TestAnchored);

let anchor: HTMLButtonElement;

function stubRect(el: Element, rect: Partial<DOMRect>): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...rect,
  } as DOMRect);
}

beforeEach(() => {
  anchor = document.createElement('button');
  anchor.id = 'trigger';
  document.body.appendChild(anchor);
  Object.defineProperty(document.documentElement, 'clientWidth', { value: 1000, configurable: true });
  Object.defineProperty(document.documentElement, 'clientHeight', { value: 800, configurable: true });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(): TestAnchored {
  const el = document.createElement('test-anchored-overlay') as TestAnchored;
  el.setAttribute('anchor', 'trigger');
  el.textContent = 'content';
  document.body.appendChild(el);
  return el;
}

describe('A11yAnchoredOverlayElement', () => {
  it('reads the anchor element from the anchor="<id>" attribute', () => {
    const el = mount();
    expect(el.anchorElement).toBe(anchor);
  });

  it('the .anchorElement property takes precedence over the attribute', () => {
    const el = mount();
    const other = document.createElement('div');
    document.body.appendChild(other);
    el.anchorElement = other;
    expect(el.anchorElement).toBe(other);
  });

  it('builds wrapper chrome around itself on open, with the content class applied', () => {
    stubRect(anchor, { top: 100, left: 100, right: 150, bottom: 130, width: 50, height: 30 });
    const el = mount();
    el.open = true;

    const wrapper = document.querySelector('.a11y-anchored-overlay-wrapper')!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.contains(el)).toBe(true);
    expect(el.classList.contains('a11y-anchored-overlay-content')).toBe(true);
  });

  it('positions the wrapper below the anchor by default (placement=bottom)', () => {
    stubRect(anchor, { top: 100, left: 100, right: 150, bottom: 130, width: 50, height: 30 });
    const el = mount();
    el.open = true;
    stubRect(el.closest('.a11y-anchored-overlay-wrapper')!, { width: 120, height: 40 });
    el.updatePosition();

    const wrapper = document.querySelector<HTMLElement>('.a11y-anchored-overlay-wrapper')!;
    expect(wrapper.getAttribute('data-placement')).toBe('bottom');
    expect(wrapper.style.top).toBe(`${130 + 8}px`); // anchor.bottom + default offset
  });

  it('flips to the opposite side when the preferred side does not fit but the opposite does', () => {
    // anchor near the very bottom of the viewport — 'bottom' placement can't fit, 'top' can.
    stubRect(anchor, { top: 780, left: 100, right: 150, bottom: 795, width: 50, height: 15 });
    const el = mount();
    el.setAttribute('placement', 'bottom');
    el.open = true;
    stubRect(el.closest('.a11y-anchored-overlay-wrapper')!, { width: 100, height: 50 });
    el.updatePosition();

    expect(document.querySelector('.a11y-anchored-overlay-wrapper')!.getAttribute('data-placement')).toBe('top');
  });

  it('closes on Escape when not trapping focus', () => {
    const el = mount();
    el.open = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.open).toBe(false);
  });

  it('closes on an outside click, deferred so the opening click does not immediately close it', async () => {
    const el = mount();
    el.open = true;

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.open).toBe(true); // same-tick click is ignored

    await new Promise((r) => setTimeout(r, 0));
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.open).toBe(false);
  });

  it('does not close on a click inside the wrapper or the anchor', async () => {
    const el = mount();
    el.open = true;
    await new Promise((r) => setTimeout(r, 0));

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.open).toBe(true);

    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.open).toBe(true);
  });

  it('portals itself back out and removes the wrapper after the transition ends', () => {
    const el = mount();
    el.open = true;
    const wrapper = document.querySelector<HTMLElement>('.a11y-anchored-overlay-wrapper')!;
    wrapper.style.transitionDuration = '0.15s'; // jsdom computes no CSS transitions

    el.open = false;
    expect(document.body.contains(wrapper)).toBe(true); // still gated on transitionend
    wrapper.dispatchEvent(new Event('transitionend'));

    expect(document.body.contains(wrapper)).toBe(false);
    expect(document.body.contains(el)).toBe(true);
    // Removed on hide (not just added on show) so the CSS default-hidden
    // rule keyed on this class — see popover.css et al. — actually re-hides
    // the element once the close transition finishes.
    expect(el.classList.contains('a11y-anchored-overlay-content')).toBe(false);
  });
});

describe('A11yAnchoredOverlayElement — lifecycle regressions', () => {
  it('reopening during the close transition leaves a working overlay', () => {
    const el = mount();
    el.open = true;
    const oldWrapper = document.querySelector<HTMLElement>('.a11y-anchored-overlay-wrapper')!;
    oldWrapper.style.transitionDuration = '0.15s';
    el.open = false;
    el.open = true;
    oldWrapper.dispatchEvent(new Event('transitionend'));

    const wrappers = document.querySelectorAll('.a11y-anchored-overlay-wrapper');
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]!.contains(el)).toBe(true);
  });

  it('stays removed when the consumer removes it while open', () => {
    const el = mount();
    el.open = true;
    el.remove();
    expect(el.isConnected).toBe(false);
    expect(document.querySelector('.a11y-anchored-overlay-wrapper')).toBeNull();
  });

  it('repositions when placement changes while open', () => {
    const el = mount();
    el.open = true;
    const spy = vi.spyOn(el, 'updatePosition');
    el.setAttribute('placement', 'top');
    expect(spy).toHaveBeenCalled();
  });
});
