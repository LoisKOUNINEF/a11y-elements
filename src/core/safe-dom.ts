/**
 * Clobbering-proof DOM reads.
 *
 * `<form>` and `Document` are `[LegacyOverrideBuiltIns]`: a named descendant
 * shadows a built-in of the same name. `<form><input name="parentNode">`
 * makes `form.parentNode` return the input, and once `<img name="createElement">`
 * is in the page, `document.createElement` is that image. Markup inserted
 * with `raw()` (or a form whose field names come from data) can do this.
 *
 * `prop()`/`call()` read such a target's property through its prototype
 * chain instead; for every other node they read it normally, so stubs on an
 * instance (as in tests) keep working. `doc` is the page's `document` read
 * the same way. The lookup happens on each call, never captured once, so it
 * follows the current realm (jsdom tests, SSR shims).
 */

/** `Symbol.toStringTag` lives on the prototype, so a named control can't fake it; works across realms too. */
const OVERRIDES_BUILTINS = /^\[object (?:HTMLFormElement|(?:HTML|XML)?Document)\]$/;

function overridesBuiltIns(target: unknown): boolean {
  return OVERRIDES_BUILTINS.test(Object.prototype.toString.call(target));
}

function builtIn(target: object, name: PropertyKey): PropertyDescriptor | undefined {
  for (let proto = Object.getPrototypeOf(target); proto; proto = Object.getPrototypeOf(proto)) {
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc) return desc;
  }
  return undefined;
}

/** `target[name]`, never a named descendant shadowing it. */
export function prop<T extends object, K extends keyof T>(target: T, name: K): T[K] {
  if (!overridesBuiltIns(target)) return target[name];
  const desc = builtIn(target, name);
  return (desc?.get ? desc.get.call(target) : desc?.value) as T[K];
}

type Method<T, K extends keyof T> = T[K] extends (...args: infer A) => infer R ? (...args: A) => R : never;

/** `target[name](...args)`, never a named descendant shadowing the method. */
export function call<T extends object, K extends keyof T>(
  target: T,
  name: K,
  ...args: Parameters<Method<T, K>>
): ReturnType<Method<T, K>> {
  return (prop(target, name) as (...a: unknown[]) => ReturnType<Method<T, K>>).apply(target, args);
}

/** The page's `document`, every member read through `Document`'s prototype. */
export const doc = {
  get body(): HTMLElement {
    return prop(document, 'body');
  },
  get activeElement(): Element | null {
    return prop(document, 'activeElement');
  },
  get documentElement(): HTMLElement {
    return prop(document, 'documentElement');
  },
  get readyState(): DocumentReadyState {
    return prop(document, 'readyState');
  },
  createElement: ((tag: string, options?: ElementCreationOptions) =>
    call(document, 'createElement', tag, options)) as Document['createElement'],
  createComment: (data: string): Comment => call(document, 'createComment', data),
  getElementById: (id: string): HTMLElement | null => call(document, 'getElementById', id),
  querySelector: ((selectors: string) => call(document, 'querySelector', selectors)) as Document['querySelector'],
  addEventListener: ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) =>
    call(document, 'addEventListener', type, listener, options)) as Document['addEventListener'],
  removeEventListener: ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) =>
    call(document, 'removeEventListener', type, listener, options)) as Document['removeEventListener'],
  dispatchEvent: (event: Event): boolean => call(document, 'dispatchEvent', event),
};
