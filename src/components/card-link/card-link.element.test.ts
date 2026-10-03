import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const CARD = `
  <div class="card">
    <h3><a href="/articles/why">Why?</a></h3>
    <p data-card-description>The idea behind it.</p>
    <button type="button">Save</button>
  </div>`;

function mount(innerHtml = CARD, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('a11y-card-link');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

/** Counts clicks reaching `link`, keeping jsdom from trying to navigate. */
function spyOnLink(link: HTMLAnchorElement): ReturnType<typeof vi.fn> {
  const spy = vi.fn((e: Event) => e.preventDefault());
  link.addEventListener('click', spy);
  return spy;
}

function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  target.dispatchEvent(evt);
  return evt;
}

describe('a11y-card-link — forwarding surface clicks', () => {
  it('forwards a click on the card surface to the link exactly once', () => {
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    click(el.querySelector('p')!);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not forward a click on the link itself a second time', () => {
    const el = mount();
    const link = el.querySelector('a')!;
    const spy = spyOnLink(link);
    click(link);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not forward a click on a nested button', () => {
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    click(el.querySelector('button')!);
    expect(spy).not.toHaveBeenCalled();
  });

  it('prefers the link marked data-card-link over the first one', () => {
    const el = mount(`<div><a href="/author">Author</a><h3><a href="/post" data-card-link>Post</a></h3><p>Text</p></div>`);
    const [first, primary] = el.querySelectorAll('a');
    const firstSpy = spyOnLink(first);
    const primarySpy = spyOnLink(primary);
    click(el.querySelector('p')!);
    expect(primarySpy).toHaveBeenCalledTimes(1);
    expect(firstSpy).not.toHaveBeenCalled();
  });

  it('does not forward a click that was already prevented', () => {
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    const p = el.querySelector('p')!;
    p.addEventListener('click', (e) => e.preventDefault());
    click(p);
    expect(spy).not.toHaveBeenCalled();
  });

  it('follows a link swapped in after connecting', async () => {
    const el = mount();
    el.querySelector('h3')!.innerHTML = '<a href="/other">Other</a>';
    await flush();
    const spy = spyOnLink(el.querySelector('a')!);
    click(el.querySelector('p')!);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('still forwards exactly once after being reparented', () => {
    const el = mount();
    document.body.appendChild(document.createElement('section')).appendChild(el);
    const spy = spyOnLink(el.querySelector('a')!);
    click(el.querySelector('p')!);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('a11y-card-link — text selection', () => {
  it('does not navigate when text inside the card is selected', () => {
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    const p = el.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(p);
    window.getSelection()!.addRange(range);
    click(p);
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not navigate when the pointer moved between press and click', () => {
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    const p = el.querySelector('p')!;
    p.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    click(p, { clientX: 30, clientY: 10 });
    expect(spy).not.toHaveBeenCalled();
  });

  it('still navigates after a small pointer jitter', () => {
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    const p = el.querySelector('p')!;
    p.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
    click(p, { clientX: 12, clientY: 11 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('a11y-card-link — new-tab clicks', () => {
  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }])('opens a new tab on %o click', (mods) => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    click(el.querySelector('p')!, mods);
    expect(open).toHaveBeenCalledWith(`${location.origin}/articles/why`, '_blank', 'noopener');
    expect(spy).not.toHaveBeenCalled();
  });

  it('opens a new tab on a middle click of the surface', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const el = mount();
    const spy = spyOnLink(el.querySelector('a')!);
    const evt = new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 });
    el.querySelector('p')!.dispatchEvent(evt);
    expect(open).toHaveBeenCalledWith(`${location.origin}/articles/why`, '_blank', 'noopener');
    expect(evt.defaultPrevented).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it('leaves a middle click on the link itself to the browser', () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const el = mount();
    el.querySelector('a')!.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, cancelable: true, button: 1 }));
    expect(open).not.toHaveBeenCalled();
  });
});

describe('a11y-card-link — semantics', () => {
  it('adds no role or tabindex to the card', () => {
    const el = mount();
    expect(el.hasAttribute('role')).toBe(false);
    expect(el.hasAttribute('tabindex')).toBe(false);
  });

  it('warns once when there is no link, not on every re-sync', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = mount('<div><p>No link</p></div>');
    expect(warn).toHaveBeenCalledTimes(1);
    el.querySelector('p')!.textContent = 'Still no link';
    el.setAttribute('describe', '');
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not warn when there is a link', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('a11y-card-link — describe', () => {
  it('points the link at the description, giving it an id', () => {
    const el = mount(CARD, { describe: '' });
    const p = el.querySelector('p')!;
    expect(p.id).not.toBe('');
    expect(el.querySelector('a')!.getAttribute('aria-describedby')).toBe(p.id);
  });

  it("keeps the author's own description ids and the description's own id", () => {
    const el = mount(
      `<div><h3><a href="/x" aria-describedby="mine">X</a></h3><p id="desc" data-card-description>Text</p></div>`,
      { describe: '' },
    );
    expect(el.querySelector('a')!.getAttribute('aria-describedby')).toBe('mine desc');
  });

  it('takes its reference back out when describe is removed', () => {
    const el = mount(`<div><h3><a href="/x" aria-describedby="mine">X</a></h3><p data-card-description>Text</p></div>`, {
      describe: '',
    });
    el.removeAttribute('describe');
    expect(el.querySelector('a')!.getAttribute('aria-describedby')).toBe('mine');
  });

  it('does nothing without the describe attribute', () => {
    const el = mount();
    expect(el.querySelector('a')!.hasAttribute('aria-describedby')).toBe(false);
  });
});
