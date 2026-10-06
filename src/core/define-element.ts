/**
 * Registers `ctor` as `tag` unless that tag is already taken — by an earlier
 * import of the same entry, or by another bundle on the page that shares this
 * element (a standalone `define.js` and the all-in-one entry, say).
 */
export function defineElement(tag: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
