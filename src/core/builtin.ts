/**
 * Internal (not re-exported): the property descriptor `target` inherits for
 * `name`, read from its prototype chain and never from the instance itself,
 * so a `[LegacyOverrideBuiltIns]` named property (an exotic own property of a
 * `<form>` or `Document`) can't shadow it. The most-derived prototype wins, as
 * in a normal property read; resolved on each call, so it follows whichever
 * DOM is current (jsdom, linkedom, happy-dom).
 */
export function builtIn(target: object, name: PropertyKey): PropertyDescriptor | undefined {
  for (let proto = Object.getPrototypeOf(target); proto; proto = Object.getPrototypeOf(proto)) {
    const desc = Object.getOwnPropertyDescriptor(proto, name);
    if (desc) return desc;
  }
  return undefined;
}
