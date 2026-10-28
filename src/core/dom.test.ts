import { describe, expect, it } from 'vitest';
import { appendContent, h, setAttrs } from './dom.js';
import { raw, trustedRaw } from './template.js';

describe('h()', () => {
  it('creates the element with its attributes and children', () => {
    const el = h('button', { type: 'button', class: 'x' }, 'Save');
    expect(el).toBeInstanceOf(HTMLButtonElement);
    expect(el.outerHTML).toBe('<button type="button" class="x">Save</button>');
  });

  it('inserts strings as text, never as markup', () => {
    expect(h('p', null, '<img src=x onerror=alert(1)>').innerHTML).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('sets attribute values as is, so a value cannot add attributes', () => {
    const el = h('div', { title: 'a" onmouseover="x' });
    expect(el.getAttribute('title')).toBe('a" onmouseover="x');
    expect(el.hasAttribute('onmouseover')).toBe(false);
  });

  it('sets true bare, leaves out null/undefined/false, and keeps 0', () => {
    expect(h('input', { disabled: true, required: false, id: null, name: undefined, value: 0 }).outerHTML).toBe('<input disabled="" value="0">');
  });

  it('skips null/undefined/false children and keeps 0', () => {
    expect(h('span', null, null, undefined, false, 0, 'a').innerHTML).toBe('0a');
  });

  it('appends nodes and nested h() calls as is', () => {
    const inner = h('em', null, 'hi');
    const el = h('p', null, inner, document.createTextNode('!'));
    expect(el.firstChild).toBe(inner);
    expect(el.innerHTML).toBe('<em>hi</em>!');
  });

  it('parses raw() children sanitized and trustedRaw() as is, in the element as context', () => {
    expect(h('p', null, raw('<b onclick="x">ok</b><script>x()</script>')).innerHTML).toBe('<b>ok</b>');
    expect(h('p', null, trustedRaw('<b onclick="f()">x</b>')).innerHTML).toBe('<b onclick="f()">x</b>');
    expect(h('tbody', null, raw('<tr><td>1</td></tr>')).querySelector('tr > td')!.textContent).toBe('1');
  });

  it('inserts a plain object that only looks like raw() output as text', () => {
    const forged = JSON.parse('{"__html":"<img src=x onerror=alert(1)>"}');
    expect(h('p', null, forged).innerHTML).toBe('[object Object]');
  });
});

describe('setAttrs()', () => {
  it('sets, replaces and removes attributes', () => {
    const el = h('progress', { value: 1, max: 10, 'aria-label': 'x' });
    setAttrs(el, { value: 2, 'aria-label': null });
    expect(el.outerHTML).toBe('<progress value="2" max="10"></progress>');
  });
});

describe('appendContent()', () => {
  it('appends after the existing children, in order', () => {
    const el = h('div', null, 'a');
    appendContent(el, 'b', h('i'), raw('<b>c</b>'));
    expect(el.innerHTML).toBe('ab<i></i><b>c</b>');
  });
});
