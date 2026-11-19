import { afterEach, describe, expect, it } from 'vitest';
import {
  inertOutside,
  isInsideOverlayOpenedAfter,
  lockScroll,
  registerOpenOverlay,
  releaseInert,
  unlockScroll,
  unregisterOpenOverlay,
} from './overlay-registry.js';

const root = document.documentElement;

/**
 * jsdom does no layout: fake the root width a classic scrollbar leaves, which
 * `overflow: hidden` (the `a11y-no-scroll` class) gives back. `offset` is a
 * constant shortfall that hiding overflow doesn't free (zoom rounding, a
 * gutter the app reserves itself).
 */
function setScrollbarWidth(width: number, offset = 0): void {
  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    get: () => window.innerWidth - offset - (root.classList.contains('a11y-no-scroll') ? 0 : width),
  });
}

afterEach(() => {
  for (let i = 0; i < 5; i++) unlockScroll(); // a no-op once nothing is locked
  Reflect.deleteProperty(root, 'clientWidth');
});

describe('lockScroll', () => {
  it('reserves the scrollbar gutter when the page had a scrollbar', () => {
    setScrollbarWidth(15);
    lockScroll();
    expect(root.classList.contains('a11y-no-scroll')).toBe(true);
    expect(root.classList.contains('a11y-no-scroll--gutter')).toBe(true);
  });

  it("doesn't reserve a gutter when the page had no scrollbar", () => {
    setScrollbarWidth(0);
    lockScroll();
    expect(root.classList.contains('a11y-no-scroll')).toBe(true);
    expect(root.classList.contains('a11y-no-scroll--gutter')).toBe(false);
  });

  it("doesn't reserve a gutter when the width is off by rounding but nothing frees up", () => {
    setScrollbarWidth(0, 1);
    lockScroll();
    expect(root.classList.contains('a11y-no-scroll--gutter')).toBe(false);
  });

  it("doesn't reserve a gutter when the app already reserves its own", () => {
    setScrollbarWidth(0, 15);
    lockScroll();
    expect(root.classList.contains('a11y-no-scroll--gutter')).toBe(false);
  });

  it('keeps both classes until the last lock is released', () => {
    setScrollbarWidth(15);
    lockScroll();
    lockScroll();
    unlockScroll();
    expect(root.classList.contains('a11y-no-scroll')).toBe(true);
    expect(root.classList.contains('a11y-no-scroll--gutter')).toBe(true);
    unlockScroll();
    expect(root.classList.contains('a11y-no-scroll')).toBe(false);
    expect(root.classList.contains('a11y-no-scroll--gutter')).toBe(false);
  });

  it('measures only on the first lock, while the scrollbar is still there', () => {
    setScrollbarWidth(15);
    lockScroll();
    setScrollbarWidth(0); // the scrollbar is gone once overflow is hidden
    lockScroll();
    expect(root.classList.contains('a11y-no-scroll--gutter')).toBe(true);
    unlockScroll();
    unlockScroll();
  });
});

describe('inertOutside() — stacked layers', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function page(): { main: HTMLElement; a: HTMLElement; b: HTMLElement; mine: HTMLElement } {
    document.body.innerHTML = '<main></main><div id="a"></div><div id="b"></div><aside id="mine" inert></aside>';
    const $ = (sel: string) => document.querySelector<HTMLElement>(sel)!;
    return { main: $('main'), a: $('#a'), b: $('#b'), mine: $('#mine') };
  }

  it('closing the lower layer first leaves the page behind the top one inert', () => {
    const { main, a, b } = page();
    const releaseA = inertOutside(a);
    const releaseB = inertOutside(b);
    expect(main.hasAttribute('inert')).toBe(true);
    expect(a.hasAttribute('inert')).toBe(true);
    expect(b.hasAttribute('inert')).toBe(false);

    releaseA();
    expect(main.hasAttribute('inert')).toBe(true);
    expect(b.hasAttribute('inert')).toBe(false);

    releaseB();
    expect(main.hasAttribute('inert')).toBe(false);
    expect(a.hasAttribute('inert')).toBe(false);
  });

  it('un-inerts the new top layer when the one above it closes', () => {
    const { main, a, b } = page();
    const releaseA = inertOutside(a);
    const releaseB = inertOutside(b);
    releaseB();
    expect(a.hasAttribute('inert')).toBe(false);
    expect(main.hasAttribute('inert')).toBe(true);
    releaseA();
  });

  it("never removes the consumer's own inert, and releasing twice is harmless", () => {
    const { a, mine } = page();
    const release = inertOutside(a);
    release();
    release();
    expect(mine.hasAttribute('inert')).toBe(true);
  });

  it('releaseInert() only clears inert the library set', () => {
    const { main, a, mine } = page();
    const release = inertOutside(a);
    releaseInert(main);
    releaseInert(mine);
    expect(main.hasAttribute('inert')).toBe(false);
    expect(mine.hasAttribute('inert')).toBe(true);
    release();
  });
});

describe('isInsideOverlayOpenedAfter', () => {
  it('ends on a <form> whose control is named "parentNode" (no endless walk)', () => {
    const lower = { close() {} };
    const upper = { close() {} };
    registerOpenOverlay(lower);
    registerOpenOverlay(upper);
    const form = document.body.appendChild(document.createElement('form'));
    const inner = form.appendChild(document.createElement('div'));
    const input = inner.appendChild(document.createElement('input'));
    // jsdom doesn't implement [LegacyOverrideBuiltIns]: emulate the named control on the instance.
    Object.defineProperty(form, 'parentNode', { value: input, configurable: true });
    try {
      expect(isInsideOverlayOpenedAfter(lower, input)).toBe(false);
    } finally {
      unregisterOpenOverlay(lower);
      unregisterOpenOverlay(upper);
      form.remove();
    }
  });
});
