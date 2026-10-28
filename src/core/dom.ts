import { isRaw, rawNodes, type Raw } from './template.js';

/** Content for an element: a string is text, a `Raw` is markup (see `raw()`), a `Node` goes in as is. */
export type Content = string | number | Node | Raw;

/** A `h()` child or `appendContent()` item: `null`/`undefined`/`false` add nothing, so `cond && h(…)` works inline. */
export type Child = Content | null | undefined | false;

/** An attribute value: `true` sets it bare (`disabled`), `null`/`undefined`/`false` leave it out, anything else is stringified. */
export type AttrValue = string | number | boolean | null | undefined;

/**
 * Appends `children` to `parent`, in order. Strings and numbers become text
 * nodes (never parsed), a `Raw` is parsed with `parent` as context.
 */
export function appendContent(parent: ParentNode & Node, ...children: Child[]): void {
  for (const child of children) {
    if (child == null || child === false) continue;
    if (isRaw(child)) parent.append(...rawNodes(child, parent));
    else if (typeof child === 'object' && 'nodeType' in child) parent.append(child);
    else parent.append(String(child));
  }
}

/**
 * Creates an element node by node — the safe counterpart of building markup
 * as a string: values are set with `setAttribute()` and inserted as text, so
 * nothing in them is ever parsed as HTML.
 *
 * `` h('button', { type: 'button', class: 'x', disabled: busy }, label) ``
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, AttrValue> | null,
  ...children: Child[]
): HTMLElementTagNameMap[K];
export function h(tag: string, attrs?: Record<string, AttrValue> | null, ...children: Child[]): HTMLElement;
export function h(tag: string, attrs?: Record<string, AttrValue> | null, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  setAttrs(el, attrs);
  appendContent(el, ...children);
  return el;
}

/** Sets each attribute of `attrs` on `el` — `true` bare — and removes those that are `null`/`undefined`/`false`. */
export function setAttrs(el: Element, attrs?: Record<string, AttrValue> | null): void {
  if (!attrs) return;
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) el.removeAttribute(name);
    else el.setAttribute(name, value === true ? '' : String(value));
  }
}
