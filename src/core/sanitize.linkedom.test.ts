import { parseHTML } from 'linkedom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The sanitizer under linkedom, as SSR prerendering runs it: linkedom's
 * globals replace jsdom's, and the modules are imported fresh so nothing
 * from jsdom is captured. linkedom puts `children` on a mixin, has a stub
 * `Node.prototype.childNodes`, sets `nodeType`/`localName` on each node, and
 * serializes a `<template>`'s own children rather than its `content`.
 */

const GLOBALS = ['window', 'document', 'Node', 'Element', 'HTMLElement', 'DocumentFragment', 'HTMLTemplateElement', 'HTMLFormElement'];

let ssrDocument: Document;

async function load() {
  return import('./template.js');
}

beforeEach(() => {
  vi.resetModules();
  const ssr = parseHTML('<!doctype html><html><body></body></html>') as unknown as Record<string, unknown>;
  for (const name of GLOBALS) vi.stubGlobal(name, ssr[name]);
  ssrDocument = ssr.document as Document;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const PAYLOAD =
  '<p class="c" onclick="x()">hi <a href="javascript:alert(1)">l</a></p><script>bad()</script>' +
  '<form><input name="children"><img src=x onerror=y></form>' +
  '<template><i onclick=y>t</i><script>z</script></template>';
const CLEAN = '<p class="c">hi <a>l</a></p><form><input><img src="x"></form><template><i>t</i></template>';

describe('sanitizer under linkedom', () => {
  it('runs on a linkedom DOM (sanity check)', () => {
    expect(document).toBe(ssrDocument);
    expect(Object.getOwnPropertyDescriptor(Element.prototype, 'children')).toBeUndefined();
  });

  it('String(raw()) is sanitized', async () => {
    const { raw } = await load();
    expect(String(raw(PAYLOAD))).toBe(CLEAN);
    expect(raw('<script>x</script>').__html).toBe('');
  });

  it('rawNodes(raw()) keeps the content, sanitized', async () => {
    const { raw, rawNodes } = await load();
    const host = ssrDocument.createElement('div');
    host.append(...rawNodes(raw(PAYLOAD), host));
    expect(host.innerHTML).toBe(CLEAN);
  });

  it('parses in the context of the parent element', async () => {
    const { raw, rawNodes } = await load();
    const table = ssrDocument.createElement('table');
    const nodes = rawNodes(raw('<tr onclick="x"><td>a</td></tr>'), table);
    expect(nodes).toHaveLength(1);
    expect((nodes[0] as Element).outerHTML).toBe('<tr><td>a</td></tr>');
  });

  it('trustedRaw() keeps its markup and nodes', async () => {
    const { trustedRaw, rawNodes } = await load();
    const value = trustedRaw('<b onclick="x">a</b><i>b</i>');
    expect(String(value)).toBe('<b onclick="x">a</b><i>b</i>');
    expect(rawNodes(value, null)).toHaveLength(2);
  });
});
