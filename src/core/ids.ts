/**
 * Page-wide id counter, on `globalThis` for the same reason as the strings
 * store: each standalone `dist/browser/**\/define.js` bundle inlines its own
 * copy of this module, and two bundles counting from 1 on their own would
 * hand out the same ids.
 */
const IDS_KEY = Symbol.for('a11y-elements/ids');
const store = globalThis as unknown as Record<symbol, { count: number } | undefined>;
const counter = (store[IDS_KEY] ??= { count: 0 });

/** Returns an id unique across every bundle on the page, e.g. `a11y-field-3`. Skips ids already taken in the document. */
export function nextId(prefix: string): string {
  let id: string;
  do id = `${prefix}-${++counter.count}`;
  while (typeof document !== 'undefined' && document.getElementById(id));
  return id;
}
