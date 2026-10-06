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
const SCRIPT_OR_DATA_URL = /^(javascript|data):/i;
const ATTR_NAME = /^[a-z_:][-a-z0-9_:.]*$/;

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
  const holder = document.createElement('template');
  const parentEl = parent && parent.nodeType === Node.ELEMENT_NODE ? (parent as Element) : null;
  let root: ParentNode = holder.content;
  if (parentEl && !templateContent(parentEl)) {
    const context = holder.content.ownerDocument.createElementNS(parentEl.namespaceURI, parentEl.localName);
    context.innerHTML = source;
    root = context;
  } else {
    holder.innerHTML = source;
  }
  sanitizeNode(root);
  return Array.from(root.childNodes);
}

/**
 * Untrusted text in tag position (`<input ${x}>`): parsed as attributes and
 * rebuilt from the safe ones — no event handlers, `srcdoc`, script URLs or
 * invalid names. Escaping alone would leave `onfocus=alert(1)` intact.
 */
export function sanitizeAttributes(source: string): string {
  // Fast path for the common case: one bare attribute name (`disabled`).
  if (source === '' || (ATTR_NAME.test(source.toLowerCase()) && isAllowedAttribute(source.toLowerCase(), ''))) return source;
  const holder = document.createElement('template');
  holder.innerHTML = `<span ${source}></span>`;
  // An unterminated quote makes the parser drop the whole tag: nothing to keep.
  const el = holder.content.firstElementChild;
  if (!el) return '';
  return Array.from(el.attributes)
    .filter((a) => ATTR_NAME.test(a.name.toLowerCase()) && isAllowedAttribute(a.name.toLowerCase(), a.value))
    .map((a) => `${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join(' ');
}

function isAllowedAttribute(name: string, value: string): boolean {
  // srcdoc is parsed as a same-origin document: escaped markup in it is decoded and runs.
  if (name.startsWith('on') || name === 'srcdoc') return false;
  return !(URL_ATTRS.has(name) && isDangerousUrl(value, SCRIPT_URL));
}

/** Only an HTML `<template>` has a content fragment; `<svg><template>` is a plain element. */
function templateContent(el: Element): DocumentFragment | null {
  const content = (el as HTMLTemplateElement).content;
  return content && typeof content.querySelectorAll === 'function' ? content : null;
}

function sanitizeNode(root: ParentNode): void {
  // Snapshot before mutating: removing from a live collection while iterating it skips the next sibling.
  for (const el of Array.from(root.children)) {
    const tag = el.localName.toLowerCase();
    if (STRIPPED_TAGS.has(tag) || animatesUrlAttribute(el, tag)) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (
        !isAllowedAttribute(name, attr.value) ||
        (FRAME_TAGS.has(tag) && FRAME_URL_ATTRS.has(name) && isDangerousUrl(attr.value, SCRIPT_OR_DATA_URL))
      ) {
        el.removeAttribute(attr.name);
      }
    }
    sanitizeNode(templateContent(el) ?? el);
  }
}

function animatesUrlAttribute(el: Element, tag: string): boolean {
  if (!ATTR_ANIMATION_TAGS.has(tag)) return false;
  const target = (el.getAttribute('attributeName') ?? '').trim().toLowerCase();
  return URL_ATTRS.has(target) || URL_ATTRS.has(target.replace(/^xlink:/, ''));
}

function isDangerousUrl(value: string, schemes: RegExp): boolean {
  // Browsers strip ASCII tab/newline/CR from a URL (and trim leading C0
  // control/space) before sniffing the scheme, so "java\tscript:" still runs
  // as javascript: — normalize the same way before checking it.
  return schemes.test(value.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+/, ''));
}
