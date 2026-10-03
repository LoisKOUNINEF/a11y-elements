/**
 * Pre-trusted HTML: opts out of auto-escaping when interpolated into an
 * `html` tagged template, and stringifies back to that exact markup when
 * assigned to `innerHTML` or concatenated. `html\`...\`` itself returns one
 * of these, which is what makes nesting `html` calls inside another `html`
 * call safe by construction — the inner result is never re-escaped, no
 * caller discipline (remembering to wrap it) required.
 *
 * Only values made by `raw()`/`html`/`attr()`/`flag()` count: a plain object
 * with an `__html` key (e.g. parsed JSON) is escaped like any other value.
 */
export interface Raw {
  readonly __html: string;
  toString(): string;
}

/**
 * Brands values made by `raw()`. `Symbol.for`, not a module-local symbol:
 * each standalone `dist/browser/**\/define.js` bundle inlines its own copy of
 * this module, and markup built through one bundle must stay trusted in another.
 */
const RAW = Symbol.for('a11y-elements/raw');

/** Wraps a string as pre-trusted HTML. Use only for markup you built yourself — never for raw user input. */
export function raw(value: string): Raw {
  return { __html: value, toString: () => value, [RAW]: true } as Raw;
}

function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[RAW] === true;
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

/** Where an interpolation lands, tracked over the literal parts only. Only unquoted attribute values need special handling. */
type Context = 'text' | 'tag' | 'attr-start' | 'attr-unquoted' | 'attr-quoted';

function scan(context: Context, chunk: string, quote: string): [Context, string] {
  for (const ch of chunk) {
    if (context === 'text') {
      if (ch === '<') context = 'tag';
    } else if (context === 'tag') {
      if (ch === '>') context = 'text';
      else if (ch === '=') context = 'attr-start';
    } else if (context === 'attr-start') {
      if (ch === '"' || ch === "'") [context, quote] = ['attr-quoted', ch];
      else if (ch === '>') context = 'text';
      else if (!/\s/.test(ch)) context = 'attr-unquoted';
    } else if (context === 'attr-unquoted') {
      if (ch === '>') context = 'text';
      else if (/\s/.test(ch)) context = 'tag';
    } else if (ch === quote) {
      context = 'tag';
    }
  }
  return [context, quote];
}

/**
 * Tagged template for building element markup. Literal template parts are
 * trusted structure; every interpolated value is HTML-escaped by default
 * (falsy values render as nothing, so `${cond && '<span>…</span>'}`-style
 * conditionals work without a directive attribute). Returns a `Raw`, so
 * nesting `html\`...\`` inside another `html\`...\`` template composes
 * safely without needing an explicit `raw()` wrapper.
 *
 * An unquoted attribute value (`title=${x}`) is quoted, and inside one already
 * started (`class=a${x}`) whitespace, quotes and `=<>` are encoded, so a value
 * can never add attributes of its own.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  let out = strings[0]!;
  let [context, quote] = scan('text', out, '');
  for (let i = 0; i < values.length; i++) {
    const piece = escape(values[i]);
    if (context === 'attr-start') {
      out += `"${piece.replace(/"/g, '&quot;')}"`;
      context = 'tag';
    } else if (context === 'attr-unquoted') {
      out += piece.replace(/[\s"'`=<>]/g, (c) => `&#${c.charCodeAt(0)};`);
    } else {
      out += piece;
    }
    const next = strings[i + 1]!;
    out += next;
    [context, quote] = scan(context, next, quote);
  }
  return raw(out);
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
