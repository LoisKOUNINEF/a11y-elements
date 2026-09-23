import { describe, expect, it } from 'vitest';
import { attr, flag, html, raw } from './template.js';

describe('html tagged template', () => {
  it('preserves literal template structure', () => {
    expect(String(html`<span class="x"></span>`)).toBe('<span class="x"></span>');
  });

  it('escapes interpolated values by default', () => {
    const evil = '<script>alert(1)</script>';
    expect(String(html`<p>${evil}</p>`)).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('escapes attribute-breaking characters', () => {
    expect(String(html`<div title="${'a" onmouseover="x'}"></div>`)).toBe(
      '<div title="a&quot; onmouseover=&quot;x"></div>',
    );
  });

  it('renders undefined/null/false interpolations as nothing, enabling conditional fragments', () => {
    const label: string | undefined = undefined;
    expect(String(html`<span>${label && `<b>${label}</b>`}</span>`)).toBe('<span></span>');
    expect(String(html`<span>${undefined}</span>`)).toBe('<span></span>');
    expect(String(html`<span>${null}</span>`)).toBe('<span></span>');
    expect(String(html`<span>${false}</span>`)).toBe('<span></span>');
  });

  it('renders numeric 0 as a real value, not suppressed like other falsy values', () => {
    // Matches the old framework's normalizeStrings behavior (coerced undefined/null
    // to '', but never touched real falsy values like 0) — Progress's `value: 0`
    // must render, not disappear.
    expect(String(html`<span>${0}</span>`)).toBe('<span>0</span>');
  });

  it('does not escape values wrapped in raw()', () => {
    const trusted = raw('<b>bold</b>');
    expect(String(html`<p>${trusted}</p>`)).toBe('<p><b>bold</b></p>');
  });

  it('composes a nested html() call directly, with no explicit raw() needed', () => {
    const inner = html`<em>hi</em>`;
    expect(String(html`<p>${inner}</p>`)).toBe('<p><em>hi</em></p>');
  });

  it('stringifies to its markup when assigned to innerHTML (implicit ToString coercion)', () => {
    const div = document.createElement('div');
    div.innerHTML = html`<span>${'hi'}</span>` as unknown as string;
    expect(div.querySelector('span')?.textContent).toBe('hi');
  });

  it('escapes each item in an interpolated array and joins them', () => {
    const items = ['<a>', '<b>'];
    expect(String(html`<ul>${items}</ul>`)).toBe('<ul>&lt;a&gt;&lt;b&gt;</ul>');
  });
});

describe('attr()', () => {
  it('renders a leading-space name="escaped value" attribute', () => {
    expect(String(attr('id', 'x'))).toBe(' id="x"');
    expect(String(attr('title', 'a"b'))).toBe(' title="a&quot;b"');
  });

  it('renders nothing for null/undefined/false/empty-string values', () => {
    expect(String(attr('id', null))).toBe('');
    expect(String(attr('id', undefined))).toBe('');
    expect(String(attr('id', false))).toBe('');
    expect(String(attr('id', ''))).toBe('');
  });

  it('renders numeric 0 as a real value', () => {
    expect(String(attr('value', 0))).toBe(' value="0"');
  });

  it('composes safely inside html`` without double-escaping', () => {
    const markup = String(html`<input${attr('id', 'x')}${attr('title', 'a"b')}>`);
    expect(markup).toBe('<input id="x" title="a&quot;b">');
  });
});

describe('flag()', () => {
  it('renders a leading-space bare attribute when true, nothing when false', () => {
    expect(String(flag('disabled', true))).toBe(' disabled');
    expect(String(flag('disabled', false))).toBe('');
    expect(String(flag('disabled', undefined))).toBe('');
  });

  it('composes safely inside html``', () => {
    expect(String(html`<input${flag('disabled', true)}${flag('required', false)}>`)).toBe('<input disabled>');
  });
});
