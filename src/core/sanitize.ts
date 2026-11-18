/**
 * DOM-based sanitizer behind `raw()`: markup is parsed once in the inert
 * document behind a `<template>` (nothing loads or runs there), cleaned as
 * nodes, and those nodes are what gets inserted — never re-serialized and
 * parsed again, which is where mutation XSS turns inert text back into
 * elements.
 */

/** Compared against `localName`, so SVG/MathML elements of the same name are caught too. style/link restyle the page, base moves every relative URL, meta can refresh/navigate. */
const STRIPPED_TAGS = new Set(['script', 'style', 'link', 'base', 'meta']);

/** A `data:` document in a frame runs its own scripts (opaque origin). */
const FRAME_TAGS = new Set(['iframe', 'object', 'embed', 'frame']);
const FRAME_URL_ATTRS = new Set(['src', 'data']);
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'background', 'xlink:href']);

/** SVG `<animate>`/`<set>` can rewrite an attribute after sanitization: those targeting a URL attribute are dropped. */
const ATTR_ANIMATION_TAGS = new Set(['animate', 'set']);

const SCRIPT_URL = /^javascript:/i;

/*
 * Clobbering-proof DOM access. A `<form>` is `[LegacyOverrideBuiltIns]`: a
 * descendant named `children`, `attributes`, `localName`, `remove`, … shadows
 * that property on the form itself, so reading `form.children` straight off
 * the element can return an attacker's `<img>` and make the walk skip it.
 * Every read below goes through the prototype's own getter/method instead.
 */
function getter<T>(proto: object, name: string): (node: unknown) => T {
  const get = Object.getOwnPropertyDescriptor(proto, name)!.get!;
  return (node) => get.call(node) as T;
}
const elementChildren = getter<HTMLCollection>(Element.prototype, 'children');
const fragmentChildren = getter<HTMLCollection>(DocumentFragment.prototype, 'children');
const elementAttributes = getter<NamedNodeMap>(Element.prototype, 'attributes');
const elementLocalName = getter<string>(Element.prototype, 'localName');
const elementNamespace = getter<string | null>(Element.prototype, 'namespaceURI');
const nodeChildNodes = getter<NodeListOf<ChildNode>>(Node.prototype, 'childNodes');
const templateContentOf = getter<DocumentFragment>(HTMLTemplateElement.prototype, 'content');
const { getAttribute, removeAttribute, remove } = Element.prototype;

function childrenOf(root: ParentNode): Element[] {
  return Array.from(root instanceof DocumentFragment ? fragmentChildren(root) : elementChildren(root));
}
const SCRIPT_OR_DATA_URL = /^(javascript|data):/i;

/** Parses `source` as markup and returns it sanitized, as a string. Only for `String()` fallbacks: rendering inserts the nodes from `parseSanitized()` instead. */
export function sanitizeMarkup(source: string): string {
  const holder = document.createElement('template');
  holder.innerHTML = source;
  sanitizeNode(holder.content);
  return holder.innerHTML;
}

/**
 * Parses `source` with an element like `parent` as context (so `<tr>`, SVG
 * or MathML content parses as it will once inserted under it), sanitizes it,
 * and returns the resulting nodes.
 */
export function parseSanitized(source: string, parent: Node | null): Node[] {
  const root = parseInContext(source, parent);
  sanitizeNode(root);
  return Array.from(nodeChildNodes(root));
}

/** Parses `source` as markup with an element like `parent` as context, unsanitized: the holder of the parsed nodes. */
export function parseInContext(source: string, parent: Node | null): ParentNode {
  const holder = document.createElement('template');
  const parentEl = parent && parent.nodeType === Node.ELEMENT_NODE ? (parent as Element) : null;
  if (parentEl && !templateContent(parentEl)) {
    const context = holder.content.ownerDocument.createElementNS(elementNamespace(parentEl), elementLocalName(parentEl));
    context.innerHTML = source;
    return context;
  }
  holder.innerHTML = source;
  return holder.content;
}

function isAllowedAttribute(name: string, value: string): boolean {
  // srcdoc is parsed as a same-origin document: escaped markup in it is decoded and runs.
  if (name.startsWith('on') || name === 'srcdoc') return false;
  return !(URL_ATTRS.has(name) && isDangerousUrl(value, SCRIPT_URL));
}

const HTML_NS = 'http://www.w3.org/1999/xhtml';

/** Only an HTML `<template>` has a content fragment; `<svg><template>` is a plain element. */
function templateContent(el: Element): DocumentFragment | null {
  return elementLocalName(el) === 'template' && elementNamespace(el) === HTML_NS ? templateContentOf(el) : null;
}

function sanitizeNode(root: ParentNode): void {
  // Snapshot before mutating: removing from a live collection while iterating it skips the next sibling.
  for (const el of childrenOf(root)) {
    const tag = elementLocalName(el).toLowerCase();
    if (STRIPPED_TAGS.has(tag) || animatesUrlAttribute(el, tag)) {
      remove.call(el);
      continue;
    }
    for (const attr of Array.from(elementAttributes(el))) {
      const name = attr.name.toLowerCase();
      if (
        !isAllowedAttribute(name, attr.value) ||
        (FRAME_TAGS.has(tag) && FRAME_URL_ATTRS.has(name) && isDangerousUrl(attr.value, SCRIPT_OR_DATA_URL))
      ) {
        removeAttribute.call(el, attr.name);
      }
    }
    sanitizeNode(templateContent(el) ?? el);
  }
}

function animatesUrlAttribute(el: Element, tag: string): boolean {
  if (!ATTR_ANIMATION_TAGS.has(tag)) return false;
  const target = (getAttribute.call(el, 'attributeName') ?? '').trim().toLowerCase();
  return URL_ATTRS.has(target) || URL_ATTRS.has(target.replace(/^xlink:/, ''));
}

function isDangerousUrl(value: string, schemes: RegExp): boolean {
  // Browsers strip ASCII tab/newline/CR from a URL (and trim leading C0
  // control/space) before sniffing the scheme, so "java\tscript:" still runs
  // as javascript: — normalize the same way before checking it.
  return schemes.test(value.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+/, ''));
}
