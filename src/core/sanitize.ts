import { builtIn } from './builtin.js';
import { doc } from './safe-dom.js';

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

/**
 * `document` and `<form>` are `[LegacyOverrideBuiltIns]` too: once inserted,
 * `<img name="createElement">` makes `document.createElement` that image, and
 * `<input name="action">` shadows its form's `action`. An `id`/`name` whose
 * value names a property of either (or of a named element already on the
 * page) is dropped — DOMPurify's `SANITIZE_DOM`. Markup you write yourself,
 * or pass to `trustedRaw()`, keeps its names.
 */
const CLOBBERING_ATTRS = new Set(['id', 'name']);
let probeForm: HTMLFormElement | undefined;

function clobbers(value: string): boolean {
  probeForm ??= doc.createElement('form');
  return value in document || value in probeForm;
}

/*
 * Clobbering-proof DOM access. A `<form>` is `[LegacyOverrideBuiltIns]`: a
 * descendant named `children`, `attributes`, `localName`, `remove`, … shadows
 * that property on the form itself, so reading `form.children` straight off
 * the element can return an attacker's `<img>` and make the walk skip it.
 * Every read below goes through the node's prototype chain instead (named
 * properties are own properties of the instance, never on a prototype).
 *
 * Resolved on each call, never captured at load: importing this module needs
 * no DOM, and non-spec DOMs used for SSR work too — linkedom puts `children`
 * on a mixin, has a stub `childNodes` on `Node.prototype` that subclasses
 * override, and sets `nodeType`/`localName` as data on each node.
 */
function read<T>(node: unknown, name: string): T {
  const desc = builtIn(node as object, name);
  if (desc) return (desc.get ? desc.get.call(node) : desc.value) as T;
  // No prototype has it (per-node data, as in linkedom). Never an own getter.
  return Object.getOwnPropertyDescriptor(node as object, name)?.value as T;
}

function invoke<T>(node: unknown, name: string, ...args: unknown[]): T {
  return (builtIn(node as object, name)!.value as (...a: unknown[]) => T).apply(node, args);
}

export const nodeChildNodes = (node: unknown): NodeListOf<ChildNode> => read(node, 'childNodes');
const nodeType = (node: unknown): number => read(node, 'nodeType');
const elementChildren = (node: unknown): HTMLCollection => read(node, 'children');
const elementAttributes = (el: Element): NamedNodeMap => read(el, 'attributes');
const elementLocalName = (el: Element): string => read(el, 'localName');
const elementNamespace = (el: Element): string | null => read(el, 'namespaceURI');
const templateContentOf = (el: Element): DocumentFragment => read(el, 'content');

const ELEMENT_NODE = 1;

function childrenOf(root: ParentNode): Element[] {
  return Array.from(elementChildren(root));
}
const SCRIPT_OR_DATA_URL = /^(javascript|data):/i;

/** Parses `source` as markup and returns it sanitized, as a string. Only for `String()` fallbacks: rendering inserts the nodes from `parseSanitized()` instead. */
export function sanitizeMarkup(source: string): string {
  const holder = doc.createElement('template');
  holder.innerHTML = source;
  sanitizeTemplate(holder);
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
  const holder = doc.createElement('template');
  const parentEl = parent && nodeType(parent) === ELEMENT_NODE ? (parent as Element) : null;
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

/**
 * A spec `<template>` keeps its parsed nodes in `content` and has no
 * children. linkedom keeps them as the template's children, which is what it
 * serializes, and fills `content` with a copy when it is first read: sanitize
 * both.
 */
function sanitizeTemplate(el: Element, content: DocumentFragment = templateContentOf(el)): void {
  sanitizeNode(content);
  sanitizeNode(el);
}

function sanitizeNode(root: ParentNode): void {
  // Snapshot before mutating: removing from a live collection while iterating it skips the next sibling.
  for (const el of childrenOf(root)) {
    const tag = elementLocalName(el).toLowerCase();
    if (STRIPPED_TAGS.has(tag) || animatesUrlAttribute(el, tag)) {
      invoke(el, 'remove');
      continue;
    }
    for (const attr of Array.from(elementAttributes(el))) {
      const name = attr.name.toLowerCase();
      if (
        !isAllowedAttribute(name, attr.value) ||
        (FRAME_TAGS.has(tag) && FRAME_URL_ATTRS.has(name) && isDangerousUrl(attr.value, SCRIPT_OR_DATA_URL)) ||
        (CLOBBERING_ATTRS.has(name) && clobbers(attr.value))
      ) {
        invoke(el, 'removeAttribute', attr.name);
      }
    }
    const content = templateContent(el);
    if (content) sanitizeTemplate(el, content);
    else sanitizeNode(el);
  }
}

function animatesUrlAttribute(el: Element, tag: string): boolean {
  if (!ATTR_ANIMATION_TAGS.has(tag)) return false;
  const target = (invoke<string | null>(el, 'getAttribute', 'attributeName') ?? '').trim().toLowerCase();
  return URL_ATTRS.has(target) || URL_ATTRS.has(target.replace(/^xlink:/, ''));
}

function isDangerousUrl(value: string, schemes: RegExp): boolean {
  // Browsers strip ASCII tab/newline/CR from a URL (and trim leading C0
  // control/space) before sniffing the scheme, so "java\tscript:" still runs
  // as javascript: — normalize the same way before checking it.
  return schemes.test(value.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+/, ''));
}
