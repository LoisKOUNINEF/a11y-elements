import { describe, expect, it } from 'vitest';
import { attr, flag, html, raw, renderInto, toFragment, trustedRaw } from './template.js';

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

  it('does not escape values wrapped in raw() or trustedRaw()', () => {
    expect(String(html`<p>${raw('<b>bold</b>')}</p>`)).toBe('<p><b>bold</b></p>');
    expect(String(html`<p>${trustedRaw('<b>bold</b>')}</p>`)).toBe('<p><b>bold</b></p>');
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

  it('escapes a plain object that only looks like raw() output, e.g. parsed JSON', () => {
    const forged = JSON.parse('{"__html":"<img src=x onerror=alert(1)>"}');
    expect(String(html`<p>${forged}</p>`)).toBe('<p>[object Object]</p>');
    expect(String(html`<p>${[forged]}</p>`)).toBe('<p>[object Object]</p>');
  });

  it('quotes an unquoted attribute value, so it cannot add attributes', () => {
    expect(String(html`<div title=${'a onmouseover=x'}></div>`)).toBe('<div title="a onmouseover=x"></div>');
    expect(String(html`<div title=${'a" b'}>`)).toBe('<div title="a&quot; b">');
  });

  it('encodes value-ending characters inside an unquoted attribute value already started', () => {
    expect(String(html`<div class=a${' onclick=x'}></div>`)).toBe('<div class=a&#32;onclick&#61;x></div>');
  });

  it('leaves quoted attribute values and text content as they were', () => {
    expect(String(html`<div title='${'a b'}' data-x="${'c=d'}">${'e=f g'}</div>`)).toBe(
      `<div title='a b' data-x="c=d">e=f g</div>`,
    );
  });
});

describe('html in tag position', () => {
  it('keeps the safe attributes of a plain value, dropping handlers', () => {
    expect(String(html`<input ${'disabled'}>`)).toBe('<input disabled>');
    expect(String(html`<input ${'onfocus=alert(1) autofocus'}>`)).toBe('<input autofocus="">');
    expect(String(html`<a ${'href="javascript:x" title="t"'}>`)).toBe('<a title="t">');
    expect(String(html`<input ${'srcdoc=x'}>`)).toBe('<input >');
  });

  it('filters raw() the same way, and escapes it in an attribute value', () => {
    expect(String(html`<a ${raw('aria-current="page" onclick="x"')}>`)).toBe('<a aria-current="page">');
    expect(String(html`<a title="${raw('" onclick="x')}">`)).toBe('<a title="&quot; onclick=&quot;x">');
    expect(String(html`<a title=${raw('a b')}>`)).toBe('<a title="a b">');
  });

  it('keeps trusted markup as is', () => {
    expect(String(html`<input ${trustedRaw('onfocus="f()"')}>`)).toBe('<input onfocus="f()">');
  });

  it('gives the same output for repeated calls from one call site (cached contexts)', () => {
    const render = (v: unknown) => String(html`<a title=${v} ${v}>${v}</a>`);
    expect(render('x')).toBe('<a title="x" x>x</a>');
    expect(render('y')).toBe('<a title="y" y>y</a>');
  });
});

describe('raw() at render', () => {
  function rendered(markup: Parameters<typeof renderInto>[1]): HTMLElement {
    const div = document.createElement('div');
    renderInto(div, markup);
    return div;
  }

  it('removes scripts, handlers, srcdoc and script URLs as nodes', () => {
    const div = rendered(html`<p>${raw('<b onclick="x">ok</b><script>x()</script><img src=x onerror=x><a href=" java\tscript:x">l</a><iframe srcdoc="x"></iframe>')}</p>`);
    expect(div.innerHTML).toBe('<p><b>ok</b><img src="x"><a>l</a><iframe></iframe></p>');
  });

  it('removes data: frame sources and SVG animations of URL attributes', () => {
    const div = rendered(raw('<iframe src="data:text/html,x"></iframe><img src="data:image/png;base64,x"><svg><a><animate attributeName="href" to="javascript:x"/></a></svg>'));
    expect(div.querySelector('iframe')!.hasAttribute('src')).toBe(false);
    expect(div.querySelector('img')!.getAttribute('src')).toBe('data:image/png;base64,x');
    expect(div.querySelector('animate')).toBeNull();
  });

  it('parses each raw() in its real parent context', () => {
    const table = rendered(html`<table><tbody>${raw('<tr><td>1</td></tr>')}</tbody></table>`);
    expect(table.querySelector('tbody > tr > td')!.textContent).toBe('1');
    const svg = rendered(html`<svg>${raw('<circle r="1"/>')}</svg>`);
    expect(svg.querySelector('circle')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('resolves raw() nested in html, arrays and template contents', () => {
    const items = ['<i>a</i>', '<i>b</i>'].map((m) => html`<li>${raw(m)}</li>`);
    const div = rendered(html`<ul>${items}</ul><template>${html`<p>${raw('<b onclick=x>t</b>')}</p>`}</template>`);
    expect(div.querySelector('ul')!.innerHTML).toBe('<li><i>a</i></li><li><i>b</i></li>');
    expect(div.querySelector('template')!.innerHTML).toBe('<p><b>t</b></p>');
  });

  it('resolves the same raw() interpolated twice', () => {
    const r = raw('<b>x</b>');
    expect(rendered(html`${r}${r}`).innerHTML).toBe('<b>x</b><b>x</b>');
    expect(String(html`${r}${r}`)).toBe('<b>x</b><b>x</b>');
  });

  it('sanitizes raw() in the String() fallback too', () => {
    expect(String(html`<p>${raw('<img src=x onerror=alert(1)>')}</p>`)).toBe('<p><img src="x"></p>');
    expect(raw('<script>x</script>y').__html).toBe('y');
  });

  it('leaves trustedRaw() and plain strings untouched', () => {
    expect(rendered(trustedRaw('<b onclick="f()">x</b>')).innerHTML).toBe('<b onclick="f()">x</b>');
    expect(rendered('<b onclick="f()">x</b>').innerHTML).toBe('<b onclick="f()">x</b>');
  });

  it('recognizes markup made by another bundle through the shared brand', () => {
    const foreign = { __html: '<em>x</em>', toString: () => '<em>x</em>', [Symbol.for('a11y-elements/raw')]: true };
    expect(String(html`<p>${foreign}</p>`)).toBe('<p><em>x</em></p>');
  });

  it('toFragment() returns the nodes without inserting them', () => {
    const fragment = toFragment(html`<p>${raw('<b>x</b>')}</p>`);
    expect(fragment.firstElementChild!.outerHTML).toBe('<p><b>x</b></p>');
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
