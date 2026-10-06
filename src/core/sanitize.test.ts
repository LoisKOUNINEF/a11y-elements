import { describe, expect, it } from 'vitest';
import { parseSanitized, sanitizeAttributes, sanitizeMarkup } from './sanitize.js';

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

describe('sanitizeAttributes()', () => {
  it('keeps bare names as is', () => {
    expect(sanitizeAttributes('disabled')).toBe('disabled');
    expect(sanitizeAttributes('')).toBe('');
  });

  it('drops handlers, srcdoc, script URLs and invalid names', () => {
    expect(sanitizeAttributes('onclick')).toBe('');
    expect(sanitizeAttributes('id="a" onclick="x" srcdoc="y" href="javascript:z"')).toBe('id="a"');
    expect(sanitizeAttributes('title="a&quot;b"')).toBe('title="a&quot;b"');
  });

  it('keeps nothing from an unterminated quote', () => {
    expect(sanitizeAttributes('title="x><img src=x onerror=y>')).toBe('');
  });
});
