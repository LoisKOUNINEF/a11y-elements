import { afterEach, describe, expect, it } from 'vitest';
import { syncAttr, syncClass, syncText } from './dom-sync.js';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('dom-sync guarded writes', () => {
  it('syncText/syncAttr/syncClass never mutate when the value is already correct (breaks MutationObserver feedback loops)', async () => {
    const el = document.createElement('span');
    el.textContent = 'hi';
    el.setAttribute('role', 'figure');
    el.classList.add('x');
    document.body.appendChild(el);

    let count = 0;
    const obs = new MutationObserver(() => {
      count++;
      syncText(el, 'hi');
      syncAttr(el, 'role', 'figure');
      syncClass(el, 'x', true);
    });
    obs.observe(el, { attributes: true, childList: true, subtree: true, characterData: true });

    // A single real change kicks off exactly one observer callback; the
    // guarded re-writes inside it must not cause a second one.
    el.setAttribute('data-trigger', '1');
    await flush();
    await flush();
    obs.disconnect();

    expect(count).toBe(1);
  });

  describe('syncText', () => {
    it('writes only when different', () => {
      const el = document.createElement('span');
      el.textContent = 'a';
      syncText(el, 'a');
      expect(el.childNodes).toHaveLength(1); // untouched, same text node
      syncText(el, 'b');
      expect(el.textContent).toBe('b');
    });
  });

  describe('syncAttr', () => {
    it('sets, updates, and removes based on value', () => {
      const el = document.createElement('div');
      syncAttr(el, 'aria-label', 'x');
      expect(el.getAttribute('aria-label')).toBe('x');
      syncAttr(el, 'aria-label', 'y');
      expect(el.getAttribute('aria-label')).toBe('y');
      syncAttr(el, 'aria-label', null);
      expect(el.hasAttribute('aria-label')).toBe(false);
      syncAttr(el, 'aria-label', undefined);
      expect(el.hasAttribute('aria-label')).toBe(false);
    });

    it('removing an already-absent attribute is a no-op call (no throw)', () => {
      const el = document.createElement('div');
      expect(() => syncAttr(el, 'aria-label', null)).not.toThrow();
    });
  });

  describe('syncClass', () => {
    it('adds/removes based on the present flag', () => {
      const el = document.createElement('div');
      syncClass(el, 'x', true);
      expect(el.classList.contains('x')).toBe(true);
      syncClass(el, 'x', false);
      expect(el.classList.contains('x')).toBe(false);
    });
  });
});
