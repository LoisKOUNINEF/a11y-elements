/**
 * Pre-trusted HTML: opts out of auto-escaping when interpolated into an
 * `html` tagged template, and stringifies back to that exact markup when
 * assigned to `innerHTML` or concatenated. `html\`...\`` itself returns one
 * of these, which is what makes nesting `html` calls inside another `html`
 * call safe by construction — the inner result is never re-escaped, no
 * caller discipline (remembering to wrap it) required.
 */
export interface Raw {
  readonly __html: string;
  toString(): string;
}

/** Wraps a string as pre-trusted HTML. Use only for markup you built yourself — never for raw user input. */
export function raw(value: string): Raw {
  return { __html: value, toString: () => value };
}

function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && '__html' in value;
}

function escape(value: unknown): string {
  if (value == null || value === false) return '';
  if (isRaw(value)) return value.__html;
  if (Array.isArray(value)) return value.map(escape).join('');
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Tagged template for building element markup. Literal template parts are
 * trusted structure; every interpolated value is HTML-escaped by default
 * (falsy values render as nothing, so `${cond && '<span>…</span>'}`-style
 * conditionals work without a directive attribute). Returns a `Raw`, so
 * nesting `html\`...\`` inside another `html\`...\`` template composes
 * safely without needing an explicit `raw()` wrapper.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  return raw(strings.reduce((out, part, i) => out + part + escape(values[i]), ''));
}

/**
 * A `name="value"` HTML attribute, with a leading space, escaped — or
 * nothing at all when `value` is `null`/`undefined`/`false`/`''`. Meant for
 * building conditional attribute lists inline:
 * `` html`<input${attr('id', id)}${flag('disabled', disabled)}>` ``
 */
export function attr(name: string, value: unknown): Raw {
  if (value == null || value === false || value === '') return raw('');
  return raw(` ${name}="${escape(value)}"`);
}

/** A bare boolean attribute (e.g. `disabled`, `checked`), with a leading space, present only when `condition` is true. */
export function flag(name: string, condition: boolean | undefined): Raw {
  return raw(condition ? ` ${name}` : '');
}
