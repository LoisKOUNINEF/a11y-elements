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
  /** Visible text of an `<a11y-counter>`; `{count}` is the current length, `{max}` the `maxlength`. */
  characterCount: string;
  /** What an `<a11y-counter>` announces near the limit; `{count}` is the number of characters left. */
  charactersRemaining: string;
  /** `charactersRemaining` when exactly one character is left. */
  characterRemaining: string;
  /** The generated "Select all" checkbox of `<a11y-checkbox-group select-all>`. */
  selectAll: string;
  /** The browse button of `<a11y-file-input>`. */
  browseFiles: string;
  /** The drag & drop prompt next to `<a11y-file-input>`'s browse button. */
  dropFiles: string;
  /** Accessible name of `<a11y-file-input>`'s list of selected files. */
  selectedFiles: string;
  /** Visible text of each remove button of `<a11y-file-input>`. */
  remove: string;
  /** Accessible name of each remove button of `<a11y-file-input>`; `{name}` is the file name. */
  removeFile: string;
  /** Announced when `<a11y-file-input>` adds one file; `{name}` is its name. */
  fileAdded: string;
  /** Announced when `<a11y-file-input>` adds several files; `{count}` is how many. */
  filesAdded: string;
  /** Announced when `<a11y-file-input>` removes a file; `{name}` is its name. */
  fileRemoved: string;
  /** Shown and announced for a file `accept` rules out; `{name}` is its name. */
  fileTypeRejected: string;
  /** Shown and announced for a file over `max-size`; `{name}`, `{maxSize}`. */
  fileSizeRejected: string;
  /** Shown and announced for a file past `max-files`; `{name}`, `{max}`. */
  fileCountRejected: string;
}

export const DEFAULT_STRINGS: Readonly<A11yStrings> = Object.freeze({
  opensInNewTab: '(opens in new tab)',
  navigatedTo: 'Navigated to {name}',
  closeDialog: 'Close dialog',
  dismiss: 'Dismiss',
  loading: 'Loading',
  progress: 'Progress',
  avatar: 'Avatar',
  characterCount: '{count} / {max}',
  charactersRemaining: '{count} characters remaining',
  characterRemaining: '{count} character remaining',
  selectAll: 'Select all',
  browseFiles: 'Browse files',
  dropFiles: 'or drop files here',
  selectedFiles: 'Selected files',
  remove: 'Remove',
  removeFile: 'Remove {name}',
  fileAdded: '{name} added',
  filesAdded: '{count} files added',
  fileRemoved: '{name} removed',
  fileTypeRejected: '{name} wasn’t added: this type of file isn’t allowed',
  fileSizeRejected: '{name} wasn’t added: it’s larger than {maxSize}',
  fileCountRejected: '{name} wasn’t added: too many files (maximum {max})',
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
// A store created by an older bundle on the same page predates newer keys.
for (const [key, value] of Object.entries(DEFAULT_STRINGS) as [keyof A11yStrings, string][]) strings[key] ??= value;

/** Overrides some or all built-in strings, page-wide. Elements already on the page update right away. */
export function setStrings(partial: Partial<A11yStrings>): void {
  for (const [key, value] of Object.entries(partial) as [keyof A11yStrings, string | undefined][]) {
    if (Object.hasOwn(DEFAULT_STRINGS, key) && typeof value === 'string') strings[key] = value;
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

/** Replaces each `{key}` placeholder with `values[key]`; placeholders without a value (own keys only, so `{constructor}` stays as is) are left as is. */
export function formatString(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (Object.hasOwn(values, key) ? values[key]! : match));
}
