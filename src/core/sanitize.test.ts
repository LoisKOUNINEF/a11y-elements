import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseInContext, parseSanitized, sanitizeMarkup } from './sanitize.js';
import { rawNodes, trustedRaw } from './template.js';

describe('sanitizeMarkup()', () => {
  it('removes script, style, link, base and meta elements, including SVG ones', () => {
    expect(sanitizeMarkup('<script>x</script><style>p{}</style><link rel=x><base href=/><meta http-equiv=refresh>ok')).toBe('ok');
    expect(sanitizeMarkup('<svg><script>x</script></svg>')).toBe('<svg></svg>');
  });

  it('removes event handlers and srcdoc, keeping other attributes', () => {
    expect(sanitizeMarkup('<b class="c" OnClick="x">t</b>')).toBe('<b class="c">t</b>');
    expect(sanitizeMarkup('<iframe srcdoc="&lt;script&gt;x&lt;/script&gt;"></iframe>')).toBe('<iframe></iframe>');
  });

  it('removes javascript: URLs, even obfuscated with whitespace or control characters', () => {
    expect(sanitizeMarkup('<a href="javascript:x">a</a>')).toBe('<a>a</a>');
    expect(sanitizeMarkup('<a href="  JaVa&#9;Script:x">a</a>')).toBe('<a>a</a>');
    expect(sanitizeMarkup('<a href="\u0001javascript:x">a</a>')).toBe('<a>a</a>');
    expect(sanitizeMarkup('<form action="javascript:x"><button formaction="javascript:x"></button></form>')).toBe(
      '<form><button></button></form>',
    );
    expect(sanitizeMarkup('<a href="/ok">a</a>')).toBe('<a href="/ok">a</a>');
  });

  it('removes data: sources from frames only', () => {
    expect(sanitizeMarkup('<object data="data:text/html,x"></object>')).toBe('<object></object>');
    expect(sanitizeMarkup('<img src="data:image/png;base64,x">')).toBe('<img src="data:image/png;base64,x">');
  });

  it('removes SVG animate/set elements that target a URL attribute', () => {
    expect(sanitizeMarkup('<svg><set attributeName="xlink:href" to="javascript:x"/><animate attributeName="r"/></svg>')).toBe(
      '<svg><animate attributeName="r"></animate></svg>',
    );
  });

  it('sanitizes inside template contents', () => {
    expect(sanitizeMarkup('<template><img src=x onerror=x></template>')).toBe('<template><img src="x"></template>');
  });

  it('does not skip a sibling after removing an element', () => {
    expect(sanitizeMarkup('<script></script><script></script><b>x</b>')).toBe('<b>x</b>');
  });
});

describe('parseSanitized()', () => {
  it('parses in the parent context', () => {
    const tr = document.createElement('tr');
    const nodes = parseSanitized('<td onclick=x>1</td>', tr);
    expect(nodes.map((n) => (n as Element).outerHTML)).toEqual(['<td>1</td>']);
  });
});

describe('parseInContext()', () => {
  it('parses in the parent context without sanitizing', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const circle = parseInContext('<circle onclick="f()"/>', svg).firstChild as Element;
    expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circle.getAttribute('onclick')).toBe('f()');
  });
});

describe('DOM clobbering (form named properties)', () => {
  // jsdom doesn't implement `[LegacyOverrideBuiltIns]` on <form>: emulate it, so a
  // descendant named like a built-in shadows that built-in, as in real browsers.
  // Named properties are own properties of the form instance (never on a
  // prototype), so the emulation defines them on every <form> parsed by innerHTML.
  const CLOBBERED = ['children', 'attributes', 'localName', 'remove', 'removeAttribute', 'getAttribute', 'content', 'childNodes'];
  const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;

  function clobber(form: Element): void {
    for (const name of CLOBBERED) {
      Object.defineProperty(form, name, {
        configurable: true,
        get(this: Element) {
          const named = Element.prototype.querySelector.call(this, `[name="${name}"]`);
          if (named) return named;
          for (let proto = Object.getPrototypeOf(this); proto; proto = Object.getPrototypeOf(proto)) {
            const desc = Object.getOwnPropertyDescriptor(proto, name);
            if (desc) return desc.get ? desc.get.call(this) : desc.value;
          }
          return undefined;
        },
      });
    }
  }

  function clobberAll(root: Element | DocumentFragment): void {
    if (root instanceof HTMLFormElement) clobber(root);
    for (const el of Array.from((root instanceof DocumentFragment ? DocumentFragment.prototype : Element.prototype).querySelectorAll.call(root, '*'))) {
      if (el instanceof HTMLFormElement) clobber(el);
      if (el instanceof HTMLTemplateElement) clobberAll(el.content);
    }
  }

  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      ...innerHTML,
      set(this: Element, value: string) {
        innerHTML.set!.call(this, value);
        clobberAll(this instanceof HTMLTemplateElement ? this.content : this);
        if (this instanceof HTMLFormElement) clobber(this);
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(Element.prototype, 'innerHTML', innerHTML);
  });

  it('the emulation really clobbers (sanity check)', () => {
    const t = document.createElement('template');
    t.innerHTML = '<form><img name="children"></form>';
    expect((t.content.firstElementChild as HTMLFormElement).children).toBeInstanceOf(HTMLImageElement);
  });

  it.each([
    ['children', '<form><img name="children" src="x" onerror="x"></form>'],
    ['attributes', '<form onclick="x"><input name="attributes"></form>'],
    ['localName', '<form onclick="x"><input name="localName"><img src="x" onerror="x"></form>'],
    ['remove', '<form><input name="remove"><script>x</script></form><script>x</script>'],
    ['removeAttribute', '<form onclick="x"><input name="removeAttribute"></form>'],
    ['content', '<form onclick="x"><input name="content"><img src="x" onerror="x"></form>'],
  ])('a descendant named "%s" cannot hide anything from the sanitizer', (_name, markup) => {
    const out = sanitizeMarkup(markup);
    expect(out).not.toMatch(/\son\w+=/i);
    expect(out).not.toMatch(/<script/i);
  });

  it('trustedRaw() returns the real child nodes of a clobbered form context', () => {
    const form = document.createElement('form');
    expect(rawNodes(trustedRaw('<input name="childNodes"><b>kept</b>'), form)).toHaveLength(2);
  });

  it('parseSanitized() returns the real child nodes of a clobbered form context', () => {
    const form = document.createElement('form');
    const nodes = parseSanitized('<input name="childNodes"><img src="x" onerror="x">', form);
    expect(nodes).toHaveLength(2);
    expect((nodes[1] as Element).hasAttribute('onerror')).toBe(false);
  });
});

describe('clobbering id/name (SANITIZE_DOM)', () => {
  it.each([
    ['<img name="createElement">', '<img>'],
    ['<form name="querySelector"></form>', '<form></form>'],
    ['<img id="body" name="activeElement">', '<img>'],
    ['<input name="action">', '<input>'],
    ['<input name="submit">', '<input>'],
    ['<form><input id="parentNode"></form>', '<form><input></form>'],
  ])('drops an id/name that shadows a document or form built-in: %s', (markup, expected) => {
    expect(sanitizeMarkup(markup)).toBe(expected);
  });

  it('keeps ordinary ids and names', () => {
    expect(sanitizeMarkup('<input name="email"><a id="main-content" name="q">x</a>')).toBe(
      '<input name="email"><a id="main-content" name="q">x</a>',
    );
  });

  it('leaves trustedRaw() names alone', () => {
    const nodes = rawNodes(trustedRaw('<img name="createElement">'), null);
    expect((nodes[0] as Element).getAttribute('name')).toBe('createElement');
  });

  it('parses in the context of a parent <form> whose control shadows nodeType', () => {
    const form = document.createElement('form');
    Object.defineProperty(form, 'nodeType', { value: document.createElement('input'), configurable: true });
    expect((parseInContext('<b>x</b>', form) as Element).localName).toBe('form');
  });
});
