import { afterEach, describe, expect, it } from 'vitest';
import { lockScroll, unlockScroll } from './overlay-registry.js';

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
