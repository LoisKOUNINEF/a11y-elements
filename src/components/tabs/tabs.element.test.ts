import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import type { TabsElement } from './tabs.element.js';

afterEach(() => {
  document.body.innerHTML = '';
  history.replaceState(null, '', location.pathname);
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const MARKUP = `
  <div data-tablist>
    <button data-tab="one">One</button>
    <button data-tab="two">Two</button>
    <button data-tab="three">Three</button>
  </div>
  <section data-panel="one"><p id="in-one">1</p></section>
  <section data-panel="two"><p id="in-two">2</p></section>
  <section data-panel="three"><p id="in-three">3</p></section>`;

function mount(attrs: Record<string, string> = {}, innerHtml = MARKUP): TabsElement {
  const el = document.createElement('a11y-tabs') as TabsElement;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

const tab = (el: Element, name: string) => el.querySelector<HTMLElement>(`[data-tab="${name}"]`)!;
const panel = (el: Element, name: string) => el.querySelector<HTMLElement>(`[data-panel="${name}"]`)!;
const key = (target: Element, k: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));

describe('a11y-tabs', () => {
  it('sets the tablist/tab/tabpanel roles and links tabs and panels by id', () => {
    const el = mount({ label: 'Sections' });
    const list = el.querySelector('[data-tablist]')!;
    expect(list.getAttribute('role')).toBe('tablist');
    expect(list.getAttribute('aria-label')).toBe('Sections');
    expect(list.getAttribute('aria-orientation')).toBe('horizontal');

    const t = tab(el, 'two');
    const p = panel(el, 'two');
    expect(t.getAttribute('role')).toBe('tab');
    expect(t.getAttribute('type')).toBe('button');
    expect(p.getAttribute('role')).toBe('tabpanel');
    expect(t.getAttribute('aria-controls')).toBe(p.id);
    expect(p.getAttribute('aria-labelledby')).toBe(t.id);
    expect(p.getAttribute('tabindex')).toBe('0');
  });

  it('keeps ids and a panel tabindex the consumer set', () => {
    const el = mount({}, `
      <div data-tablist><button id="my-tab" data-tab="a">A</button></div>
      <div id="my-panel" data-panel="a" tabindex="-1"></div>`);
    expect(tab(el, 'a').id).toBe('my-tab');
    expect(panel(el, 'a').id).toBe('my-panel');
    expect(panel(el, 'a').getAttribute('tabindex')).toBe('-1');
  });

  it('selects the first tab by default and hides the other panels', () => {
    const el = mount();
    expect(el.selected).toBe('one');
    expect(tab(el, 'one').getAttribute('aria-selected')).toBe('true');
    expect(tab(el, 'one').getAttribute('tabindex')).toBe('0');
    expect(tab(el, 'two').getAttribute('aria-selected')).toBe('false');
    expect(tab(el, 'two').getAttribute('tabindex')).toBe('-1');
    expect(panel(el, 'one').hidden).toBe(false);
    expect(panel(el, 'two').hidden).toBe(true);
  });

  it('honours the selected attribute, and select()/the property update it without calling onChange', () => {
    const el = mount({ selected: 'two' });
    const onChange = vi.fn();
    el.onChange = onChange;
    expect(panel(el, 'two').hidden).toBe(false);

    el.select('three');
    expect(el.getAttribute('selected')).toBe('three');
    expect(panel(el, 'three').hidden).toBe(false);
    expect(panel(el, 'two').hidden).toBe(true);

    el.selected = 'one';
    expect(el.selected).toBe('one');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores unknown and disabled tabs', () => {
    const el = mount({ selected: 'nope' });
    expect(el.selected).toBe('one');
    tab(el, 'two').setAttribute('disabled', '');
    el.select('two');
    expect(el.selected).toBe('one');
  });

  it('selects on click and reports it through onChange once', async () => {
    const el = mount();
    const onChange = vi.fn();
    el.onChange = onChange;
    el.setAttribute('label', 'x'); // re-sync must not wire the tabs twice
    await flush();

    tab(el, 'two').click();
    expect(el.selected).toBe('two');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('two');
  });

  it('moves selection and focus with arrow keys, wrapping, and Home/End', () => {
    const el = mount();
    tab(el, 'one').focus();

    key(tab(el, 'one'), 'ArrowRight');
    expect(el.selected).toBe('two');
    expect(document.activeElement).toBe(tab(el, 'two'));

    key(tab(el, 'two'), 'End');
    expect(el.selected).toBe('three');
    key(tab(el, 'three'), 'ArrowRight');
    expect(el.selected).toBe('one');
    key(tab(el, 'one'), 'ArrowLeft');
    expect(el.selected).toBe('three');
    key(tab(el, 'three'), 'Home');
    expect(el.selected).toBe('one');
    expect(document.activeElement).toBe(tab(el, 'one'));
  });

  it('skips disabled tabs with the keyboard', () => {
    const el = mount();
    tab(el, 'two').setAttribute('aria-disabled', 'true');
    key(tab(el, 'one'), 'ArrowRight');
    expect(el.selected).toBe('three');
  });

  it('uses Up/Down when vertical', () => {
    const el = mount({ orientation: 'vertical' });
    expect(el.querySelector('[data-tablist]')!.getAttribute('aria-orientation')).toBe('vertical');
    key(tab(el, 'one'), 'ArrowRight');
    expect(el.selected).toBe('one');
    key(tab(el, 'one'), 'ArrowDown');
    expect(el.selected).toBe('two');
    key(tab(el, 'two'), 'ArrowUp');
    expect(el.selected).toBe('one');
  });

  it('reveal() selects the panel containing an element, and reports it', () => {
    const el = mount();
    const onChange = vi.fn();
    el.onChange = onChange;
    expect(el.reveal(document.getElementById('in-three')!)).toBe(true);
    expect(el.selected).toBe('three');
    expect(onChange).toHaveBeenCalledWith('three');

    const outside = document.createElement('p');
    document.body.appendChild(outside);
    expect(el.reveal(outside)).toBe(false);
  });

  it('selects the panel of a same-page link target before the link handles the click', () => {
    const el = mount();
    const link = document.createElement('a');
    link.href = '#in-two';
    let visibleOnClick: boolean | undefined;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      visibleOnClick = !panel(el, 'two').hidden;
    });
    document.body.appendChild(link);

    link.click();
    expect(visibleOnClick).toBe(true);
    expect(el.selected).toBe('two');
  });

  it('follows hashchange', () => {
    const el = mount();
    history.replaceState(null, '', '#in-three');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(el.selected).toBe('three');
  });

  it('reveals and scrolls to the initial hash target, even when it is added after connect', async () => {
    history.replaceState(null, '', '#late');
    const el = mount();
    expect(el.selected).toBe('one');

    const late = document.createElement('p');
    late.id = 'late';
    const scroll = vi.fn();
    late.scrollIntoView = scroll;
    panel(el, 'two').appendChild(late);
    await flush();

    expect(el.selected).toBe('two');
    expect(scroll).toHaveBeenCalledTimes(1);

    el.select('one'); // handled once only
    await flush();
    expect(el.selected).toBe('one');
  });

  it('leaves the tabs and panels of a nested a11y-tabs to it', () => {
    const el = mount({}, `
      <div data-tablist><button data-tab="outer">Outer</button></div>
      <div data-panel="outer">
        <a11y-tabs>
          <div data-tablist><button data-tab="inner">Inner</button></div>
          <div data-panel="inner"></div>
        </a11y-tabs>
      </div>`);
    const inner = el.querySelector('a11y-tabs') as TabsElement;
    expect(el.selected).toBe('outer');
    expect(inner.selected).toBe('inner');
    expect(tab(el, 'inner').getAttribute('aria-controls')).toBe(panel(el, 'inner').id);
  });

  it('stays inert without a tablist', () => {
    const el = mount({}, '<div data-panel="a"></div>');
    expect(el.selected).toBe('');
    expect(panel(el, 'a').hasAttribute('role')).toBe(false);
  });
});
