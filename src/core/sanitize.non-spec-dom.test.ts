import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * A DOM shaped like linkedom's (used for SSR prerendering), which doesn't put
 * accessors where the spec does:
 * - `children` lives only on a ParentNode mixin, above an Element prototype
 *   that doesn't have it;
 * - `Node.prototype.childNodes` is a stub returning nothing, overridden by
 *   subclasses;
 * - `nodeType` and `localName` are data set on each node.
 * Markup is parsed by jsdom, then copied into this fake tree.
 */

class FakeNode {
  parentNode: FakeParent | null = null;
  constructor(readonly nodeType: number) {}
  get childNodes(): FakeNode[] {
    return [];
  }
  remove(): void {
    const kids = this.parentNode?.kids;
    if (kids) kids.splice(kids.indexOf(this), 1);
    this.parentNode = null;
  }
}

class FakeParent extends FakeNode {
  kids: FakeNode[] = [];
  ownerDocument = fakeDocument;
  get children(): FakeElement[] {
    return this.kids.filter((k): k is FakeElement => k.nodeType === 1);
  }
  override get childNodes(): FakeNode[] {
    return this.kids.slice();
  }
  append(node: FakeNode): void {
    node.parentNode = this;
    this.kids.push(node);
  }
  get innerHTML(): string {
    return this.kids.map(serialize).join('');
  }
  set innerHTML(source: string) {
    const real = realDocument.createElement('template');
    real.innerHTML = source;
    this.kids = [];
    for (const child of Array.from(real.content.childNodes)) this.append(convert(child));
  }
}

class FakeElement extends FakeParent {
  readonly attrs: { name: string; value: string }[] = [];
  constructor(readonly localName: string, readonly namespaceURI: string | null) {
    super(1);
  }
  get attributes(): { name: string; value: string }[] {
    return this.attrs.slice();
  }
  getAttribute(name: string): string | null {
    return this.attrs.find((a) => a.name === name)?.value ?? null;
  }
  removeAttribute(name: string): void {
    const i = this.attrs.findIndex((a) => a.name === name);
    if (i >= 0) this.attrs.splice(i, 1);
  }
}

/** As linkedom's: parsed nodes are the template's own children (what it serializes); `content` is filled with a copy of them when first read. */
class FakeTemplate extends FakeElement {
  readonly fragment = new FakeParent(11);
  constructor() {
    super('template', 'http://www.w3.org/1999/xhtml');
  }
  get content(): FakeParent {
    if (this.kids.length && !this.fragment.kids.length) for (const kid of this.kids) this.fragment.append(clone(kid));
    return this.fragment;
  }
}

class FakeText extends FakeNode {
  constructor(readonly data: string) {
    super(3);
  }
}

// Per-node data, as linkedom sets them in its constructors: no prototype has them.
for (const proto of [FakeNode.prototype, FakeElement.prototype, FakeText.prototype]) {
  for (const name of ['nodeType', 'localName', 'namespaceURI', 'data']) {
    expect(Object.getOwnPropertyDescriptor(proto, name)).toBeUndefined();
  }
}

const realDocument = document;
const fakeDocument = {
  createElement: (tag: string) => (tag === 'template' ? new FakeTemplate() : new FakeElement(tag, 'http://www.w3.org/1999/xhtml')),
  createElementNS: (ns: string | null, tag: string) => new FakeElement(tag, ns),
};

function convert(node: Node): FakeNode {
  if (node instanceof Element) {
    const el = node instanceof HTMLTemplateElement ? new FakeTemplate() : new FakeElement(node.localName, node.namespaceURI);
    for (const attr of Array.from(node.attributes)) el.attrs.push({ name: attr.name, value: attr.value });
    const source = node instanceof HTMLTemplateElement ? node.content : node;
    for (const child of Array.from(source.childNodes)) el.append(convert(child));
    return el;
  }
  return new FakeText(node.textContent ?? '');
}

function clone(node: FakeNode): FakeNode {
  if (!(node instanceof FakeElement)) return new FakeText((node as FakeText).data);
  const copy = node instanceof FakeTemplate ? new FakeTemplate() : new FakeElement(node.localName, node.namespaceURI);
  copy.attrs.push(...node.attrs.map((a) => ({ ...a })));
  for (const kid of node.kids) copy.append(clone(kid));
  return copy;
}

function serialize(node: FakeNode): string {
  if (!(node instanceof FakeElement)) return (node as FakeText).data;
  const attrs = node.attrs.map((a) => ` ${a.name}="${a.value}"`).join('');
  return `<${node.localName}${attrs}>${node.innerHTML}</${node.localName}>`;
}

async function importWithFakeDocument() {
  vi.resetModules();
  vi.stubGlobal('document', fakeDocument);
  return import('./sanitize.js');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('sanitizer in a non-spec DOM (linkedom-like)', () => {
  it('the fake DOM has the non-spec shape (sanity check)', () => {
    const t = new FakeTemplate();
    t.innerHTML = '<b>a</b><i>b</i>';
    const nodeStub = Object.getOwnPropertyDescriptor(FakeNode.prototype, 'childNodes')!.get!;
    expect(nodeStub.call(t.content)).toHaveLength(0);
    expect(t.content.childNodes).toHaveLength(2);
    expect(Object.getOwnPropertyDescriptor(FakeElement.prototype, 'children')).toBeUndefined();
    t.content.children[0]!.remove();
    expect(t.innerHTML).toBe('<b>a</b><i>b</i>'); // content is a copy
  });

  it('sanitizeMarkup() keeps content and strips scripts and handlers', async () => {
    const { sanitizeMarkup } = await importWithFakeDocument();
    expect(sanitizeMarkup('<p class="c" onclick="x">hi <b>there</b></p><script>x</script><img src="x" onerror="x">')).toBe(
      '<p class="c">hi <b>there</b></p><img src="x"></img>',
    );
  });

  it('sanitizes nested elements and template contents', async () => {
    const { sanitizeMarkup } = await importWithFakeDocument();
    expect(sanitizeMarkup('<div><a href="javascript:x">a</a><template><img onerror="x"></template></div>')).toBe(
      '<div><a>a</a><template><img></img></template></div>',
    );
  });

  it('parseSanitized() returns the parsed nodes, sanitized', async () => {
    const { parseSanitized } = await importWithFakeDocument();
    const nodes = parseSanitized('<b>a</b>text<img src="x" onerror="x">', null) as unknown as FakeNode[];
    expect(nodes).toHaveLength(3);
    expect((nodes[2] as FakeElement).getAttribute('onerror')).toBeNull();
    expect((nodes[2] as FakeElement).getAttribute('src')).toBe('x');
  });

  it('parseSanitized() sanitizes what a nested template serializes', async () => {
    const { parseSanitized } = await importWithFakeDocument();
    const nodes = parseSanitized('<template><img src="x" onerror="x"><script>x</script></template>', null) as unknown as FakeNode[];
    expect(nodes.map(serialize).join('')).toBe('<template><img src="x"></img></template>');
  });

  it('parseSanitized() parses in the context of a parent element', async () => {
    const { parseSanitized } = await importWithFakeDocument();
    const parent = new FakeElement('div', 'http://www.w3.org/1999/xhtml');
    const nodes = parseSanitized('<b onclick="x">a</b>', parent as unknown as Node) as unknown as FakeElement[];
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.localName).toBe('b');
    expect(nodes[0]!.attrs).toEqual([]);
  });
});

describe('importing the sanitizer', () => {
  it('does not need DOM globals', async () => {
    vi.resetModules();
    for (const name of ['document', 'Node', 'Element', 'DocumentFragment', 'HTMLTemplateElement', 'HTMLFormElement']) {
      vi.stubGlobal(name, undefined);
    }
    await expect(import('./sanitize.js')).resolves.toHaveProperty('sanitizeMarkup');
  });
});
