/**
 * The library's built-in, user-facing strings — text that ends up in
 * accessible names and announcements — so a consumer can translate them.
 *
 * Precedence, per element: an instance attribute (e.g. `close-label`) wins,
 * then whatever `setStrings()` set, then these English defaults.
 */
export interface A11yStrings {
  /** Appended to a new-tab link's accessible name by `<a11y-anchor>`. */
  opensInNewTab: string;
  /** `<a11y-anchor>`'s same-page jump announcement; `{name}` is the target's name. */
  navigatedTo: string;
  /** The close button of `<a11y-modal>`, `<a11y-drawer>` and `<a11y-emergency-dialog>`. */
  closeDialog: string;
  /** The close button of each `<a11y-notification-banner>` item. */
  dismiss: string;
  /** Default label of `<a11y-spinner>` and `<a11y-blocking-loader>`. */
  loading: string;
  /** Default accessible name of `<a11y-progress>`. */
  progress: string;
  /** Last-resort accessible name of `<a11y-avatar>`. */
  avatar: string;
}

export const DEFAULT_STRINGS: Readonly<A11yStrings> = Object.freeze({
  opensInNewTab: '(opens in new tab)',
  navigatedTo: 'Navigated to {name}',
  closeDialog: 'Close dialog',
  dismiss: 'Dismiss',
  loading: 'Loading',
  progress: 'Progress',
  avatar: 'Avatar',
});

/** Dispatched on `document` whenever `setStrings()`/`resetStrings()` runs, so mounted elements can relabel themselves. */
export const STRINGS_CHANGE_EVENT = 'a11y-strings-change';

/**
 * Page-wide, on `globalThis` for the same reason as the overlay registry:
 * each standalone `dist/browser/**\/define.js` bundle inlines its own copy of
 * this module, and `setStrings()` called through one bundle must reach the
 * elements every other bundle defined.
 */
const STRINGS_KEY = Symbol.for('a11y-elements/strings');
const store = globalThis as unknown as Record<symbol, A11yStrings | undefined>;
const strings: A11yStrings = (store[STRINGS_KEY] ??= { ...DEFAULT_STRINGS });

/** Overrides some or all built-in strings, page-wide. Elements already on the page update right away. */
export function setStrings(partial: Partial<A11yStrings>): void {
  for (const [key, value] of Object.entries(partial) as [keyof A11yStrings, string | undefined][]) {
    if (key in DEFAULT_STRINGS && typeof value === 'string') strings[key] = value;
  }
  document.dispatchEvent(new Event(STRINGS_CHANGE_EVENT));
}

/** Restores every built-in string to its English default. */
export function resetStrings(): void {
  Object.assign(strings, DEFAULT_STRINGS);
  document.dispatchEvent(new Event(STRINGS_CHANGE_EVENT));
}

export function getString(key: keyof A11yStrings): string {
  return strings[key];
}

/** Replaces each `{key}` placeholder with `values[key]`; placeholders without a value are left as is. */
export function formatString(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key]! : match));
}
