import { parseSanitized, sanitizeAttributes, sanitizeMarkup } from './sanitize.js';

/**
 * Markup that opts out of auto-escaping when interpolated into an `html`
 * tagged template. `html\`...\`` itself returns one of these, which is what
 * makes nesting `html` calls inside another `html` call safe by
 * construction — the inner result is never re-escaped, no caller discipline
 * (remembering to wrap it) required.
 *
 * Only values made by `html`/`raw()`/`trustedRaw()`/`attr()`/`flag()` count:
 * a plain object with an `__html` key (e.g. parsed JSON) is escaped like any
 * other value.
 *
 * Render one with `renderInto()` (what every element in this library does):
 * the `raw()` parts inside are then sanitized as DOM nodes. `__html` and
 * `String()` give the same markup with those parts sanitized as strings,
 * which the browser parses a second time when it is assigned to `innerHTML`.
 */
export interface Raw {
  readonly __html: string;
  toString(): string;
}

/**
 * Brands, through `Symbol.for` rather than module-local symbols: each
 * standalone `dist/browser/**\/define.js` bundle inlines its own copy of this
 * module, and markup built through one bundle must stay recognized in another.
 */
const RAW: unique symbol = Symbol.for('a11y-elements/raw');
/** Markup with each `raw()` part replaced by a placeholder. */
const MARKUP: unique symbol = Symbol.for('a11y-elements/markup');
/** Placeholder token → unescaped `raw()` source, resolved as sanitized nodes at render. */
const RAWS: unique symbol = Symbol.for('a11y-elements/raws');
/** A `raw()` value's own source, for when it lands in tag or attribute-value position. */
const SOURCE: unique symbol = Symbol.for('a11y-elements/raw-source');

const PLACEHOLDER_ATTR = 'data-a11y-raw';
/** Per bundle, so placeholders made by two bundles on one page never collide. */
const TOKEN_PREFIX = Math.random().toString(36).slice(2, 8);
let tokenCounter = 0;

type Raws = Map<string, string>;

class Markup implements Raw {
  readonly [RAW] = true;
  readonly [MARKUP]: string;
  readonly [RAWS]: Raws | undefined;
  readonly [SOURCE]: string | undefined;

  constructor(markup: string, raws?: Raws, source?: string) {
    this[MARKUP] = markup;
    this[RAWS] = raws?.size ? raws : undefined;
    this[SOURCE] = source;
  }

  get __html(): string {
    return this.toString();
  }

  toString(): string {
    const raws = this[RAWS];
    if (!raws) return this[MARKUP];
    let out = this[MARKUP];
    raws.forEach((source, token) => {
      // The same raw() interpolated twice shares one token.
      out = out.split(placeholder(token)).join(sanitizeMarkup(source));
    });
    return out;
  }
}

function placeholder(token: string): string {
  return `<template ${PLACEHOLDER_ATTR}="${token}"></template>`;
}

/**
 * Inserts HTML unescaped, but sanitized at render: `<script>`, `<style>`,
 * `<link>`, `<base>`, `<meta>`, event handler attributes, `srcdoc`,
 * `javascript:` URLs, `data:` frame sources and SVG animations of URL
 * attributes are removed. Inside `html`, it is sanitized down to its safe
 * attributes in tag position (`<input ${raw('checked')}>`) and escaped in an
 * attribute value.
 */
export function raw(value: string): Raw {
  const source = value == null ? '' : String(value);
  const token = `${TOKEN_PREFIX}${++tokenCounter}`;
  return new Markup(placeholder(token), new Map([[token, source]]), source);
}

/** Inserts HTML exactly as given, unsanitized. Only for markup you wrote yourself — never for anything user input can reach. */
export function trustedRaw(value: string): Raw {
  return new Markup(value == null ? '' : String(value));
}

function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[RAW] === true;
}

/** Older bundles' `Raw`s have no `MARKUP`: their `__html` is the markup. */
function markupOf(value: Raw): string {
  const markup = (value as unknown as Record<symbol, unknown>)[MARKUP];
  return typeof markup === 'string' ? markup : value.__html;
}

function rawsOf(value: Raw): Raws | undefined {
  const raws = (value as unknown as Record<symbol, unknown>)[RAWS];
  return raws instanceof Map ? (raws as Raws) : undefined;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const NEEDS_ESCAPE = /[&<>"']/;
const ESCAPE_ALL = /[&<>"']/g;

function escapeText(text: string): string {
  return NEEDS_ESCAPE.test(text) ? text.replace(ESCAPE_ALL, (c) => ESCAPES[c]!) : text;
}

/** Where an interpolation lands, tracked over the literal parts only. */
type Context = 'text' | 'tag' | 'attr-start' | 'attr-unquoted' | 'attr-quoted';

function interpolate(value: unknown, context: Context, raws: Raws): string {
  if (value == null || value === false) return '';
  if (Array.isArray(value)) return value.map((item) => interpolate(item, context, raws)).join(context === 'tag' ? ' ' : '');
  if (isRaw(value)) {
    const nested = rawsOf(value);
    if (context === 'text') {
      nested?.forEach((source, token) => raws.set(token, source));
      return markupOf(value);
    }
    // Trusted markup goes in as is; a raw() part outside element position is
    // treated like text from then on: filtered in tag position, escaped in a value.
    if (!nested) return markupOf(value);
    const source = (value as unknown as Record<symbol, unknown>)[SOURCE];
    const text = typeof source === 'string' ? source : value.toString();
    return context === 'tag' ? sanitizeAttributes(text) : escapeText(text);
  }
  return context === 'tag' ? sanitizeAttributes(String(value)) : escapeText(String(value));
}

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
 * The context of each `${}`, per call site: it only depends on the literal
 * parts, and a template's strings array is the same object on every call
 * from one call site, so re-renders skip the scan.
 */
const contextCache = new WeakMap<TemplateStringsArray, Context[]>();

function contextsOf(strings: TemplateStringsArray): Context[] {
  let contexts = contextCache.get(strings);
  if (contexts) return contexts;
  contexts = [];
  let [context, quote] = scan('text', strings[0]!, '');
  for (let i = 1; i < strings.length; i++) {
    contexts.push(context);
    // A quoted unquoted value ends right after the interpolation.
    if (context === 'attr-start') context = 'tag';
    [context, quote] = scan(context, strings[i]!, quote);
  }
  contextCache.set(strings, contexts);
  return contexts;
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
 * can never add attributes of its own. A value in tag position
 * (`<input ${x}>`) keeps only its safe attributes.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Raw {
  const contexts = contextsOf(strings);
  const raws: Raws = new Map();
  let out = strings[0]!;
  for (let i = 0; i < values.length; i++) {
    const context = contexts[i]!;
    const piece = interpolate(values[i], context, raws);
    if (context === 'attr-start') {
      out += `"${piece.replace(/"/g, '&quot;')}"`;
    } else if (context === 'attr-unquoted') {
      out += piece.replace(/[\s"'`=<>]/g, (c) => `&#${c.charCodeAt(0)};`);
    } else {
      out += piece;
    }
    out += strings[i + 1]!;
  }
  return new Markup(out, raws);
}

/**
 * Parses `markup` once and returns its nodes, each `raw()` part parsed in
 * its real parent context and sanitized as nodes. A plain string is trusted
 * markup, as with `innerHTML`.
 */
export function toFragment(markup: string | Raw): DocumentFragment {
  const holder = document.createElement('template');
  const raws = isRaw(markup) ? rawsOf(markup) : undefined;
  holder.innerHTML = isRaw(markup) ? markupOf(markup) : String(markup);
  if (raws) resolveRaws(holder.content, raws);
  return holder.content;
}

/** Replaces `el`'s children with `markup` — the safe counterpart of `el.innerHTML = String(markup)`. */
export function renderInto(el: ParentNode, markup: string | Raw): void {
  el.replaceChildren(toFragment(markup));
}

function resolveRaws(root: ParentNode, raws: Raws): void {
  // Snapshot first: content put in place is never searched for placeholders again.
  for (const holder of collectPlaceholders(root)) {
    const source = raws.get(holder.getAttribute(PLACEHOLDER_ATTR) ?? '');
    if (source === undefined) holder.remove();
    else holder.replaceWith(...parseSanitized(source, holder.parentNode));
  }
}

function collectPlaceholders(root: ParentNode): Element[] {
  const found: Element[] = [];
  root.querySelectorAll('template').forEach((el) => {
    if (el.hasAttribute(PLACEHOLDER_ATTR)) found.push(el);
    const content = (el as HTMLTemplateElement).content;
    if (content && typeof content.querySelectorAll === 'function') found.push(...collectPlaceholders(content));
  });
  return found;
}

/**
 * A `name="value"` HTML attribute, with a leading space, escaped — or
 * nothing at all when `value` is `null`/`undefined`/`false`/`''`. Meant for
 * building conditional attribute lists inline:
 * `` html`<input${attr('id', id)}${flag('disabled', disabled)}>` ``
 */
export function attr(name: string, value: unknown): Raw {
  if (value == null || value === false || value === '') return trustedRaw('');
  return trustedRaw(` ${name}="${escapeText(String(value))}"`);
}

/** A bare boolean attribute (e.g. `disabled`, `checked`), with a leading space, present only when `condition` is true. */
export function flag(name: string, condition: boolean | undefined): Raw {
  return trustedRaw(condition ? ` ${name}` : '');
}
