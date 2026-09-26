import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import { resetStrings, setStrings } from '../../core/strings.js';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  // jsdom doesn't implement scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
    document.body.insertAdjacentHTML('beforeend', '<h2 id="section-2">Section 2</h2>');
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

describe('a11y-anchor — announcement names the target, not its whole content', () => {
  function announce(targetHtml: string, id = 'target'): string {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', targetHtml);
    const el = mount(`<a href="#${id}">Jump</a>`);
    el.querySelector('a')!.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    vi.advanceTimersByTime(100);
    const text = document.querySelector('[role="status"]')!.textContent!;
    vi.runAllTimers();
    return text;
  }

  it('prefers aria-label', () => {
    expect(announce('<section id="target" aria-label="Pricing"><h2>Plans</h2><p>Body</p></section>')).toBe(
      'Navigated to Pricing',
    );
  });

  it('resolves aria-labelledby', () => {
    expect(
      announce('<span id="l1">Team</span><span id="l2">plans</span><section id="target" aria-labelledby="l1 l2"><p>Body</p></section>'),
    ).toBe('Navigated to Team plans');
  });

  it('uses the first heading of a section, not its paragraphs or control labels', () => {
    expect(announce('<section id="target"><h2> Pricing </h2><p>Long text</p><button>Buy</button></section>')).toBe(
      'Navigated to Pricing',
    );
  });

  it('falls back to the id when the target has no label or heading', () => {
    expect(announce('<div id="target">Some content</div>')).toBe('Navigated to target');
  });
});

describe("a11y-anchor — keeps the target's own tabindex", () => {
  function jump(el: HTMLElement): void {
    el.querySelector('a')!.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    vi.advanceTimersByTime(100);
  }

  it('keeps a pre-existing tabindex="-1" after blur', () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<section id="s" tabindex="-1"><h2>S</h2></section>');
    const el = mount('<a href="#s">Jump</a>');
    jump(el);
    const target = document.getElementById('s')!;
    target.dispatchEvent(new FocusEvent('blur'));
    expect(target.getAttribute('tabindex')).toBe('-1');
    vi.runAllTimers();
  });

  it('restores a pre-existing tabindex="0" on blur', () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<section id="s" tabindex="0"><h2>S</h2></section>');
    const el = mount('<a href="#s">Jump</a>');
    jump(el);
    const target = document.getElementById('s')!;
    expect(target.getAttribute('tabindex')).toBe('-1');
    target.dispatchEvent(new FocusEvent('blur'));
    expect(target.getAttribute('tabindex')).toBe('0');
    vi.runAllTimers();
  });

  it('restores the original value when jumping twice before a blur', () => {
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<section id="s" tabindex="0"><h2>S</h2></section>');
    const el = mount('<a href="#s">Jump</a>');
    jump(el);
    jump(el);
    const target = document.getElementById('s')!;
    target.dispatchEvent(new FocusEvent('blur'));
    expect(target.getAttribute('tabindex')).toBe('0');
    target.setAttribute('tabindex', '3');
    target.dispatchEvent(new FocusEvent('blur')); // the single restore listener is already spent
    expect(target.getAttribute('tabindex')).toBe('3');
    vi.runAllTimers();
  });
});

describe('a11y-anchor — prefers-reduced-motion', () => {
  function clickWithMotionPreference(reduce: boolean): void {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce') }));
    vi.useFakeTimers();
    document.body.insertAdjacentHTML('beforeend', '<h2 id="s">S</h2>');
    mount('<a href="#s">Jump</a>')
      .querySelector('a')!
      .dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    vi.runAllTimers();
  }

  it('scrolls instantly when reduced motion is requested', () => {
    clickWithMotionPreference(true);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto' });
  });

  it('smooth-scrolls when there is no reduced-motion preference', () => {
    clickWithMotionPreference(false);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });
});

describe('a11y-anchor — translated strings', () => {
  afterEach(() => resetStrings());

  function announce(el: HTMLElement): string {
    vi.useFakeTimers();
    el.querySelector('a')!.dispatchEvent(new MouseEvent('click', { cancelable: true, bubbles: true }));
    vi.advanceTimersByTime(100);
    const text = document.querySelector('[role="status"]')!.textContent!;
    vi.runAllTimers();
    return text;
  }

  it('uses setStrings({ opensInNewTab }), relabelling mounted links', () => {
    const a = mount('<a href="https://example.com" target="_blank">Site</a>').querySelector('a')!;
    setStrings({ opensInNewTab: '(nouvel onglet)' });
    expect(a.getAttribute('aria-label')).toBe('Site (nouvel onglet)');
  });

  it('lets new-tab-label win over setStrings, and follows it when it changes', () => {
    const el = mount('<a href="https://example.com" target="_blank">Site</a>');
    el.setAttribute('new-tab-label', '(neuer Tab)');
    setStrings({ opensInNewTab: '(nouvel onglet)' });
    const a = el.querySelector('a')!;
    expect(a.getAttribute('aria-label')).toBe('Site (neuer Tab)');
    el.removeAttribute('new-tab-label');
    expect(a.getAttribute('aria-label')).toBe('Site (nouvel onglet)');
  });

  it('formats setStrings({ navigatedTo }) with the target name', () => {
    document.body.insertAdjacentHTML('beforeend', '<h2 id="s">Tarifs</h2>');
    setStrings({ navigatedTo: 'Aller à {name}' });
    expect(announce(mount('<a href="#s">Jump</a>'))).toBe('Aller à Tarifs');
  });

  it('lets navigated-label win over setStrings', () => {
    document.body.insertAdjacentHTML('beforeend', '<h2 id="s">Preise</h2>');
    setStrings({ navigatedTo: 'Aller à {name}' });
    const el = mount('<a href="#s">Jump</a>');
    el.setAttribute('navigated-label', 'Gehe zu {name}');
    expect(announce(el)).toBe('Gehe zu Preise');
  });
});
