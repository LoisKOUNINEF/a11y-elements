import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './define.js';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function mount(innerHtml: string): HTMLElement {
  const el = document.createElement('a11y-anchor');
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('a11y-anchor — empty content', () => {
  it('does not throw and touches nothing when there is no <a> child', () => {
    expect(() => mount('')).not.toThrow();
    expect(() => mount('<span>no link here</span>')).not.toThrow();
  });
});

describe('a11y-anchor — external links', () => {
  it('adds rel="noopener noreferrer" and suffixes the accessible name', () => {
    const el = mount('<a href="https://example.com" target="_blank">External site</a>');
    const a = el.querySelector('a')!;
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('aria-label')).toBe('External site (opens in new tab)');
  });

  it('preserves an explicit aria-label as the base instead of textContent', () => {
    const el = mount('<a href="https://example.com" target="_blank" aria-label="Custom label">Click</a>');
    expect(el.querySelector('a')!.getAttribute('aria-label')).toBe('Custom label (opens in new tab)');
  });

  it('does not touch links without a target', () => {
    const el = mount('<a href="https://example.com">Plain link</a>');
    const a = el.querySelector('a')!;
    expect(a.hasAttribute('rel')).toBe(false);
    expect(a.hasAttribute('aria-label')).toBe(false);
  });

  it('never double-suffixes across repeated syncs (host has no attributes to change here, so trigger via a direct _sync-causing mutation)', async () => {
    const el = mount('<a href="https://example.com" target="_blank">External site</a>');
    const a = el.querySelector('a')!;
    // Any subtree mutation re-triggers _sync(); a harmless one is adding an unrelated attribute.
    a.setAttribute('data-x', '1');
    await flush();
    a.setAttribute('data-y', '2');
    await flush();
    expect(a.getAttribute('aria-label')).toBe('External site (opens in new tab)');
  });
});

describe('a11y-anchor — internal same-page anchors', () => {
  it('smooth-scrolls to the target on click and prevents the default jump', () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<div id="section-2">Section 2</div>');
    const el = mount('<a href="#section-2">Jump to section 2</a>');
    const a = el.querySelector('a')!;

    const evt = new MouseEvent('click', { cancelable: true, bubbles: true });
    a.dispatchEvent(evt);

    expect(evt.defaultPrevented).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    vi.runAllTimers(); // flush this test's own pending focus/announce timers before the next test starts
  });

  it('moves focus to the target ~100ms later, made focusable via tabindex=-1, and clears it on blur', () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<div id="section-2">Section 2</div>');
    const el = mount('<a href="#section-2">Jump</a>');
    el.querySelector('a')!.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));

    const target = document.getElementById('section-2')!;
    expect(target.hasAttribute('tabindex')).toBe(false);
    vi.advanceTimersByTime(100);
    expect(target.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(target);

    target.dispatchEvent(new FocusEvent('blur'));
    expect(target.hasAttribute('tabindex')).toBe(false);
  });

  it('announces navigation via a a11y-visually-hidden live region, then removes it after ~3s', () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<div id="section-2">Section 2</div>');
    const el = mount('<a href="#section-2">Jump</a>');
    el.querySelector('a')!.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));

    vi.advanceTimersByTime(100);
    const live = document.querySelector('[role="status"][aria-live="polite"]')!;
    expect(live).not.toBeNull();
    expect(live.className).toBe('a11y-visually-hidden');
    expect(live.textContent).toBe('Navigated to Section 2');

    vi.advanceTimersByTime(3000);
    expect(document.querySelector('[role="status"][aria-live="polite"]')).toBeNull();
  });

  it('Space also activates an internal anchor (native <a> only activates on Enter)', () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<div id="section-2">Section 2</div>');
    const el = mount('<a href="#section-2">Jump</a>');
    const a = el.querySelector('a')!;
    const evt = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true });
    a.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    vi.runAllTimers();
  });

  it('does not wire internal-anchor handling for external/absolute links', () => {
    const el = mount('<a href="https://example.com">External</a>');
    const a = el.querySelector('a')!;
    let preventedByComponent: boolean | undefined;
    const record = (e: Event): void => {
      preventedByComponent = e.defaultPrevented;
      e.preventDefault(); // jsdom can't navigate — keep it from trying
    };
    document.addEventListener('click', record);
    a.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    document.removeEventListener('click', record);
    expect(preventedByComponent).toBe(false);
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not double-wire across repeated syncs', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="section-2">Section 2</div>');
    const el = mount('<a href="#section-2">Jump</a>');
    const a = el.querySelector('a')!;

    a.setAttribute('data-x', '1');
    await flush();
    a.setAttribute('data-y', '2');
    await flush();

    vi.useFakeTimers(); // isolate this click's internal 100ms/3000ms timers from real time
    a.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.runAllTimers();
  });
});

describe('a11y-anchor — targets and reconnects', () => {
  it('only treats _blank / named targets as opening a new tab, not _self/_parent/_top', () => {
    const self = mount('<a href="https://example.com" target="_self">Home</a>').querySelector('a')!;
    expect(self.hasAttribute('aria-label')).toBe(false);
    expect(self.hasAttribute('rel')).toBe(false);

    const named = mount('<a href="https://example.com" target="docs">Docs</a>').querySelector('a')!;
    expect(named.getAttribute('aria-label')).toBe('Docs (opens in new tab)');
  });

  it('merges noopener/noreferrer into an existing rel instead of replacing it', () => {
    const a = mount('<a href="https://example.com" target="_blank" rel="nofollow">X</a>').querySelector('a')!;
    expect(a.getAttribute('rel')!.split(' ').sort()).toEqual(['nofollow', 'noopener', 'noreferrer']);
  });

  it('restores the original label when target is removed later', async () => {
    const a = mount('<a href="https://example.com" target="_blank" aria-label="Site">X</a>').querySelector('a')!;
    expect(a.getAttribute('aria-label')).toBe('Site (opens in new tab)');
    a.removeAttribute('target');
    await flush();
    expect(a.getAttribute('aria-label')).toBe('Site');
  });

  it('reads href at click time, so a link changed from #id to a URL is left to the browser', async () => {
    const a = mount('<a href="#section">Jump</a>').querySelector('a')!;
    a.setAttribute('href', 'https://example.com');
    await flush();
    let preventedByComponent: boolean | undefined;
    const record = (e: Event): void => {
      preventedByComponent = e.defaultPrevented;
      e.preventDefault(); // jsdom can't navigate — keep it from trying
    };
    document.addEventListener('click', record);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.removeEventListener('click', record);
    expect(preventedByComponent).toBe(false);
  });

  it('still intercepts same-page links after being reparented', () => {
    document.body.insertAdjacentHTML('beforeend', '<h2 id="section">Section</h2>');
    const el = mount('<a href="#section">Jump</a>');
    document.body.appendChild(document.createElement('nav')).appendChild(el);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    el.querySelector('a')!.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });
});
