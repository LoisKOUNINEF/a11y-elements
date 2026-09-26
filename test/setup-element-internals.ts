/**
 * jsdom implements `attachInternals()` but none of its form-associated API.
 * This fills in the parts `A11yFieldElement` uses — `setValidity()` (with a
 * readable `validity`/`validationMessage`/`validationAnchor`) and `states` —
 * enough to assert what the element mirrors. It doesn't make the host take
 * part in form validation or submission.
 */
const proto = ElementInternals.prototype as ElementInternals & Record<string, unknown>;

if (!('setValidity' in proto)) {
  const validity = new WeakMap<ElementInternals, { flags: ValidityStateFlags; message: string; anchor?: HTMLElement }>();

  Object.defineProperties(proto, {
    setValidity: {
      value(this: ElementInternals, flags: ValidityStateFlags = {}, message = '', anchor?: HTMLElement) {
        const invalid = Object.values(flags).some(Boolean);
        if (invalid && !message) throw new TypeError('setValidity: a message is required when a flag is set');
        validity.set(this, { flags, message: invalid ? message : '', anchor });
      },
    },
    validity: {
      get(this: ElementInternals) {
        const flags = validity.get(this)?.flags ?? {};
        return { ...flags, valid: !Object.values(flags).some(Boolean) } as ValidityState;
      },
    },
    validationMessage: {
      get(this: ElementInternals) {
        return validity.get(this)?.message ?? '';
      },
    },
    validationAnchor: {
      get(this: ElementInternals) {
        return validity.get(this)?.anchor ?? null;
      },
    },
  });
}

if (!('states' in proto)) {
  const states = new WeakMap<ElementInternals, Set<string>>();
  Object.defineProperty(proto, 'states', {
    get(this: ElementInternals) {
      let set = states.get(this);
      if (!set) states.set(this, (set = new Set()));
      return set;
    },
  });
}
