import { parseInContext, parseSanitized, sanitizeMarkup } from './sanitize.js';

/**
 * Markup to insert as HTML rather than as text: made by `raw()` (sanitized)
 * or `trustedRaw()` (as is). Anywhere this library takes content — a `h()`
 * child, a snackbar/banner/`confirmDialog()` message — a plain string is text
 * and a `Raw` is markup, parsed in the context of the element it goes into.
 *
 * Only values made by `raw()`/`trustedRaw()` count: a plain object with an
 * `__html` key (e.g. parsed JSON) is inserted as text like any other value.
 *
 * `__html` and `String()` give the markup as a string (sanitized for
 * `raw()`), which the browser parses a second time when it is assigned to
 * `innerHTML`; inserting it as content parses it only once.
 */
export interface Raw {
  readonly __html: string;
  toString(): string;
}

/**
 * Brands, through `Symbol.for` rather than module-local symbols: each
 * standalone `dist/browser/**\/define.js` bundle inlines its own copy of this
 * module, and markup made through one bundle must stay recognized in another.
 */
const RAW: unique symbol = Symbol.for('a11y-elements/raw');
/** The markup as given. */
const SOURCE: unique symbol = Symbol.for('a11y-elements/raw-source');
/** Set by `trustedRaw()`: insert unsanitized. */
const TRUSTED: unique symbol = Symbol.for('a11y-elements/raw-trusted');

class Markup implements Raw {
  readonly [RAW] = true;
  readonly [SOURCE]: string;
  readonly [TRUSTED]: boolean;

  constructor(source: string, trusted: boolean) {
    this[SOURCE] = source;
    this[TRUSTED] = trusted;
  }

  get __html(): string {
    return this.toString();
  }

  toString(): string {
    return this[TRUSTED] ? this[SOURCE] : sanitizeMarkup(this[SOURCE]);
  }
}

/**
 * Markup inserted sanitized: `<script>`, `<style>`, `<link>`, `<base>`,
 * `<meta>`, event handler attributes, `srcdoc`, `javascript:` URLs, `data:`
 * frame sources and SVG animations of URL attributes are removed.
 */
export function raw(value: string): Raw {
  return new Markup(value == null ? '' : String(value), false);
}

/** Markup inserted exactly as given, unsanitized. Only for markup you wrote yourself — never for anything user input can reach. */
export function trustedRaw(value: string): Raw {
  return new Markup(value == null ? '' : String(value), true);
}

export function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && (value as Record<symbol, unknown>)[RAW] === true;
}

/**
 * Parses `value` with `parent` as context and returns its nodes, sanitized
 * unless it came from `trustedRaw()`. Markup from an older bundle (no
 * `SOURCE`, e.g. an `html` result) is its `__html`, sanitized.
 */
export function rawNodes(value: Raw, parent: Node | null): Node[] {
  const brand = value as unknown as Record<symbol, unknown>;
  const source = brand[SOURCE];
  if (typeof source !== 'string') return parseSanitized(value.__html, parent);
  if (brand[TRUSTED] === true) return Array.from(parseInContext(source, parent).childNodes);
  return parseSanitized(source, parent);
}
