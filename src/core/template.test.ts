import { describe, expect, it } from 'vitest';
import { isRaw, raw, rawNodes, trustedRaw } from './template.js';

const html = (nodes: Node[]): string => {
  const div = document.createElement('div');
  div.append(...nodes);
  return div.innerHTML;
};

describe('raw()', () => {
  it('parses to sanitized nodes: no scripts, handlers, srcdoc or script URLs', () => {
    const nodes = rawNodes(raw('<b onclick="x">ok</b><script>x()</script><img src=x onerror=x><a href=" java\tscript:x">l</a><iframe srcdoc="x"></iframe>'), null);
    expect(html(nodes)).toBe('<b>ok</b><img src="x"><a>l</a><iframe></iframe>');
  });

  it('removes data: frame sources and SVG animations of URL attributes', () => {
    const div = document.createElement('div');
    div.append(...rawNodes(raw('<iframe src="data:text/html,x"></iframe><img src="data:image/png;base64,x"><svg><a><animate attributeName="href" to="javascript:x"/></a></svg>'), div));
    expect(div.querySelector('iframe')!.hasAttribute('src')).toBe(false);
    expect(div.querySelector('img')!.getAttribute('src')).toBe('data:image/png;base64,x');
    expect(div.querySelector('animate')).toBeNull();
  });

  it('parses in the context of the parent it goes into', () => {
    const tbody = document.createElement('tbody');
    expect(html(rawNodes(raw('<tr><td>1</td></tr>'), tbody))).toBe('<tr><td>1</td></tr>');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expect((rawNodes(raw('<circle r="1"/>'), svg)[0] as Element).namespaceURI).toBe('http://www.w3.org/2000/svg');
  });

  it('gives sanitized markup as a string too', () => {
    expect(String(raw('<img src=x onerror=alert(1)>'))).toBe('<img src="x">');
    expect(raw('<script>x</script>y').__html).toBe('y');
  });

  it('treats null/undefined as empty', () => {
    expect(String(raw(undefined as unknown as string))).toBe('');
  });
});

describe('trustedRaw()', () => {
  it('parses to nodes as is, in the parent context', () => {
    expect(html(rawNodes(trustedRaw('<b onclick="f()">x</b>'), null))).toBe('<b onclick="f()">x</b>');
    expect(String(trustedRaw('<b onclick="f()">x</b>'))).toBe('<b onclick="f()">x</b>');
    const tbody = document.createElement('tbody');
    expect(html(rawNodes(trustedRaw('<tr><td>1</td></tr>'), tbody))).toBe('<tr><td>1</td></tr>');
  });
});

describe('isRaw()', () => {
  it('recognizes raw() and trustedRaw(), not plain objects that look like them', () => {
    expect(isRaw(raw('x'))).toBe(true);
    expect(isRaw(trustedRaw('x'))).toBe(true);
    expect(isRaw(JSON.parse('{"__html":"<img src=x onerror=alert(1)>"}'))).toBe(false);
    expect(isRaw('x')).toBe(false);
    expect(isRaw(null)).toBe(false);
  });

  it('recognizes markup made by another bundle through the shared brand, and sanitizes an older one', () => {
    const older = { __html: '<em onclick="x">x</em>', toString: () => '<em>x</em>', [Symbol.for('a11y-elements/raw')]: true };
    expect(isRaw(older)).toBe(true);
    expect(html(rawNodes(older, null))).toBe('<em>x</em>');
  });
});
