# a11y-elements

Framework-agnostic accessibility Custom Elements (Web Components). A behavior layer, not a themed UI kit. 

Every element is Light DOM only (no Shadow DOM), so you always style real markup with your own CSS.

See a [demo of the elements](https://nutin.org/a11y-elements/elements) - See a [demo of the overlays](https://nutin.org/a11y-elements/overlays)

## Usage

### Zero-build 

Load a component's browser bundle directly, no bundler required:

```html
<link rel="stylesheet" href="node_modules/a11y-elements/dist/a11y.css" />
<script type="module" src="node_modules/a11y-elements/dist/browser/components/spinner/define.js"></script>

<a11y-spinner></a11y-spinner>
```

* Each component has its own `define.js` under `dist/browser/**`. Load only the ones you use.
* They share their common code through `chunk-*.js` files in `dist/browser/`, so the browser fetches it once however many you load. Serve them from the package's `dist/browser/` folder as is: a `define.js` copied on its own won't load.
* `dist/browser/all.js` registers every element at once and exports everything the individual bundles do.
* Page-wide state is shared between bundles, so mixing several on one page is safe. 
* Overlay bundles also export `dismissAllOverlays()`:

```html
<script type="module">
  import { dismissAllOverlays } from './node_modules/a11y-elements/dist/browser/overlays/modal/define.js';
  window.addEventListener('popstate', dismissAllOverlays); // e.g. close every open overlay on navigation
</script>
```

### Bundler / ESM

Import via the package's `exports` map, which exposes real per-component ESM output and `.d.ts` types:

```js
import 'a11y-elements/a11y.css';
import 'a11y-elements/components/checkbox';
import 'a11y-elements/overlays/modal';
import { A11yElement } from 'a11y-elements/core';
```

* There's no default export: `import 'a11y-elements'` alone will fail. 
* Import the component you want: `/element` gets you the class itself when you need it
* `import 'a11y-elements/all'` registers every element at once, and exports every element class plus `setStrings()`, `dismissAllOverlays()`, `notify()` and the other helpers the individual entries export.
* See [Elements](#elements) for every component.

Importing a component's subpath also adds its tag to TypeScript's `HTMLElementTagNameMap`, so exact-tag lookups such as `document.createElement('a11y-checkbox')` or `document.querySelector('a11y-checkbox')` come back typed as `CheckboxElement` without a cast.

### Translating built-in strings

A few English strings end up in accessible names and announcements. Replace them page-wide with `setStrings()`, exported from `a11y-elements/core` and from every zero-build `define.js`:

```js
import { setStrings } from 'a11y-elements/core';
// or: import { setStrings } from './node_modules/a11y-elements/dist/browser/overlays/modal/define.js';

setStrings({
  closeDialog: 'Fermer la boîte de dialogue',
  opensInNewTab: '(nouvel onglet)',
  navigatedTo: 'Aller à {name}',
});
```

| Key | Default | Used by | Per-instance override |
| --- | --- | --- | --- |
| `opensInNewTab` | `(opens in new tab)` | `<a11y-anchor>` new-tab links | `new-tab-label` |
| `navigatedTo` | `Navigated to {name}` | `<a11y-anchor>` jump announcement (`{name}` is the target's name) | `navigated-label` |
| `closeDialog` | `Close dialog` | the × button of `<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`, an expandable `<a11y-floating>`'s panel | `close-label` |
| `dismiss` | `Dismiss` | the × button of each `<a11y-notification-banner>` item and of a `dismissible` `<a11y-floating>` | `dismiss-label` |
| `loading` | `Loading` | `<a11y-spinner>`, `<a11y-blocking-loader>` | `label` / `message` |
| `progress` | `Progress` | `<a11y-progress>` without a label | `label` / `aria-label` |
| `avatar` | `Avatar` | `<a11y-avatar>` with no `alt` or `initials` | `alt` / `initials` |
| `characterCount` | `{count} / {max}` | the visible text of an `<a11y-counter>` | — |
| `charactersRemaining` | `{count} characters remaining` | what an `<a11y-counter>` announces near the limit | — |
| `characterRemaining` | `{count} character remaining` | the same, with one character left | — |
| `selectAll` | `Select all` | the generated checkbox of `<a11y-checkbox-group select-all>` | `select-all-label` |
| `browseFiles` | `Browse files` | the browse button of `<a11y-file-input>` | `browse-label` |
| `dropFiles` | `or drop files here` | the drag & drop prompt of `<a11y-file-input>` | `drop-label` |
| `selectedFiles` | `Selected files` | the name of `<a11y-file-input>`'s file list | — |
| `remove` / `removeFile` | `Remove` / `Remove {name}` | the visible text / accessible name of each remove button of `<a11y-file-input>` | — |
| `fileAdded` / `filesAdded` | `{name} added` / `{count} files added` | what `<a11y-file-input>` announces after a pick or a drop | — |
| `fileRemoved` | `{name} removed` | what `<a11y-file-input>` announces after a removal | — |
| `fileTypeRejected` | `{name} wasn’t added: this type of file isn’t allowed` | a file `accept` rules out | `type-rejected-message` |
| `fileSizeRejected` | `{name} wasn’t added: it’s larger than {maxSize}` | a file over `max-size` | `size-rejected-message` |
| `fileCountRejected` | `{name} wasn’t added: too many files (maximum {max})` | a file past `max-files` | `count-rejected-message` |

* An instance attribute wins over `setStrings()`, which wins over the default. Keys you leave out keep their current value.
* Elements already on the page update right away, so calling it again on a language switch is enough.
* `resetStrings()` restores the English defaults.

## Elements

Each section shows an example, the element's own attributes/properties/methods, and its CSS variables (collapsed). 

Behavior shared by overlays is described once, in [Common to all overlays](#common-to-all-overlays).

**Accessibility components:** [`<a11y-anchor>`](#a11y-anchor) · [`<a11y-avatar>`](#a11y-avatar) · [`<a11y-card-link>`](#a11y-card-link) · [`<a11y-checkbox>`](#a11y-checkbox) · [`<a11y-checkbox-group>`](#a11y-checkbox-group) · [`<a11y-file-input>`](#a11y-file-input) · [`<a11y-focusable>`](#a11y-focusable) · [`<a11y-input>`](#a11y-input) · [`<a11y-label>`](#a11y-label) · [`<a11y-picture>`](#a11y-picture) · [`<a11y-progress>`](#a11y-progress) · [`<a11y-radio-group>`](#a11y-radio-group) · [`<a11y-select>`](#a11y-select) · [`<a11y-skeleton>`](#a11y-skeleton) · [`<a11y-spinner>`](#a11y-spinner) · [`<a11y-switch>`](#a11y-switch) · [`<a11y-textarea>`](#a11y-textarea) · [`<a11y-visually-hidden>`](#a11y-visually-hidden)

**Overlays:** [`<a11y-blocking-loader>`](#a11y-blocking-loader) · [`<a11y-context-menu>`](#a11y-context-menu) · [`<a11y-drawer>`](#a11y-drawer) · [`<a11y-dropdown>`](#a11y-dropdown) · [`<a11y-emergency-dialog>`](#a11y-emergency-dialog) · [`<a11y-floating>`](#a11y-floating) · [`<a11y-modal>`](#a11y-modal) · [`<a11y-notification-banner>`](#a11y-notification-banner) · [`<a11y-popover>`](#a11y-popover) · [`<a11y-snackbar>`](#a11y-snackbar) · [`<a11y-tooltip>`](#a11y-tooltip)

Import paths follow the folder names: `a11y-elements/components/<name>` or `a11y-elements/overlays/<name>` (add `/element` for the class), and `dist/browser/<group>/<name>/define.js` for zero-build.

Attributes that set a CSS variable (spinner `size`/`color`/…, avatar `size`, skeleton `width`/`height`) win over your own inline value for that variable only while they're set. See [Scope to one instance](#scope-to-one-instance).

### Accessibility components

#### `a11y-anchor`

Enhances a real `<a href>`:

* **Same-page links** (`href="#id"`) smooth-scroll to the target (instantly under `prefers-reduced-motion: reduce`), move focus to it, and announce the navigation to screen readers by the target's `aria-label`, `aria-labelledby` or heading, falling back to its `id`. The target is made focusable with `tabindex="-1"` while focused; a `tabindex` it already had is restored on blur. Space activates too.
* **New-tab links** (`target="_blank"` or a named target) get `rel="noopener noreferrer"` and "(opens in new tab)" appended to their accessible name.

Both strings can be [translated](#translating-built-in-strings).

```html
<a11y-anchor><a href="#section-2">Jump to section 2</a></a11y-anchor>
<a11y-anchor><a href="https://example.com" target="_blank">External site</a></a11y-anchor>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `new-tab-label` | attribute | `(opens in new tab)` | Suffix added to new-tab links' accessible name. |
| `navigated-label` | attribute | `Navigated to {name}` | Jump announcement; `{name}` is replaced by the target's name. |

No CSS variables of its own: style the `<a>` directly.

#### `a11y-avatar`

An avatar image with an initials fallback. When the image is missing or fails to load, the initials show instead and the element gets `role="img"` with an `aria-label`.

```html
<a11y-avatar alt="Jane Doe" src="jane.jpg" initials="JD" size="3rem"></a11y-avatar>
<a11y-avatar alt="John Roe" initials="JR" shape="square"></a11y-avatar>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `src` | attribute | — | Image URL. |
| `alt` | attribute / property | `''` | Image alt text; also the accessible name of the initials fallback (then `initials`, then `Avatar`). |
| `initials` | attribute | — | Text shown when there's no image, or it fails to load. |
| `size` | attribute | — | Sets `--a11y-avatar-size`. |
| `shape` | attribute / property | `circle` | `circle` or `square`. |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-avatar-border-radius-circle` | `9999px` |
| `--a11y-avatar-border-radius-square` | `4px` |
| `--a11y-avatar-color-surface` | `#f3f4f6` |
| `--a11y-avatar-color-text-muted` | `#6b7280` |
| `--a11y-avatar-font-family` | `Arial, sans-serif` |
| `--a11y-avatar-font-size-ratio` | `0.38` |
| `--a11y-avatar-font-weight` | `600` |
| `--a11y-avatar-initials-letter-spacing` | `0.05em` |
| `--a11y-avatar-size` | `2.5rem` |

</details>

#### `a11y-card-link`

Makes a whole card go to one page through a real `<a href>` inside it (usually around the title). The link stays the card's only tab stop and its accessible name, so screen readers announce a link named by the title, Enter follows it, Space scrolls the page, and middle-click, "Open in new tab" and "Copy link address" work on it.

A click anywhere else on the card is forwarded to the link with a real `click()`, so your own click handlers on the link (an SPA router's) run for it too. Clicks aren't forwarded when they land on another control in the card (a button, a second link, an input…), when the user was selecting text, or when something already called `preventDefault()`. Cmd/Ctrl/Shift-click and middle-click on the card open the link in a new tab.

The card gets no `role` or `tabindex`. Use it for cards that navigate; for cards that perform an action, use a `<button>` or [`<a11y-focusable>`](#a11y-focusable).

```html
<a11y-card-link describe>
  <div class="card">
    <svg aria-hidden="true">…</svg>
    <h3><a href="/articles/why-nutin">Why Nutin?</a></h3>
    <p data-card-description>The idea behind the framework…</p>
  </div>
</a11y-card-link>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `describe` | attribute (boolean) | — | Adds the `data-card-description` element to the link's `aria-describedby` (giving it an id if it has none), so it's read after the title. |
| `data-card-link` | attribute, on an `<a href>` inside | — | The link to use when the card has several. Otherwise the first `<a href>` is used. Without one, a console warning is logged. |
| `data-card-description` | attribute, on an element inside | — | The description `describe` points to. |
| `link` | property (read-only) | — | The link the card navigates through. |

The whole card is outlined while its link has keyboard focus (`:has(:focus-visible)`). In browsers without `:has()`, the link keeps its own focus ring.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-card-link-focus-outline-color` | `#2563eb` |
| `--a11y-card-link-focus-outline-offset` | `2px` |
| `--a11y-card-link-focus-outline-width` | `2px` |

</details>

#### `a11y-checkbox`

Wraps a real `<input type="checkbox">` in a `<label>` with a visible label text. The input stays yours: `name`, `checked`, `disabled`, `required` are plain HTML attributes on it.

```html
<a11y-checkbox id="terms" label="Accept terms">
    <input type="checkbox" name="terms" required>
</a11y-checkbox>
```

```ts
import 'a11y-elements/components/checkbox';
import type { CheckboxElement } from 'a11y-elements/components/checkbox/element';

const checkbox = document.getElementById('terms') as CheckboxElement;
checkbox.onChange = (checked) => console.log('accepted:', checked);
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `label` | attribute | — | Visible label text. |
| `indeterminate` | attribute | absent | Sets the input's `indeterminate` state (it has no HTML attribute of its own). |
| `onChange` | callback | — | `(checked: boolean) => void`, called on every `change`. |
| `getValue()` / `setValue(checked)` | method | — | Reads / sets `checked`. |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-checkbox-border-radius` | `2px` |
| `--a11y-checkbox-checkmark-background-size` | `75%` |
| `--a11y-checkbox-color-background` | `#ffffff` |
| `--a11y-checkbox-color-border` | `#d1d5db` |
| `--a11y-checkbox-color-border-strong` | `#9ca3af` |
| `--a11y-checkbox-color-disabled-bg` | `#e5e7eb` |
| `--a11y-checkbox-color-primary` | `#2563eb` |
| `--a11y-checkbox-color-text` | `#111827` |
| `--a11y-checkbox-disabled-opacity` | `0.6` |
| `--a11y-checkbox-focus-outline-offset` | `2px` |
| `--a11y-checkbox-focus-outline-width` | `2px` |
| `--a11y-checkbox-gap` | `0.5rem` |
| `--a11y-checkbox-input-border-width` | `2px` |
| `--a11y-checkbox-input-size` | `1.125rem` |
| `--a11y-checkbox-label-font-size` | `1rem` |
| `--a11y-checkbox-label-line-height` | `1.4` |
| `--a11y-checkbox-transition-duration` | `0.2s` |

</details>

#### `a11y-checkbox-group`

Wraps your checkboxes in a `<fieldset>` with a `<legend>`, styled like `<a11y-checkbox>`. Add `select-all` for a "Select all" checkbox: it's checked when every option is, partly checked when some are, and checks or unchecks them all. It has no `name`, so it's never submitted, and disabled options keep their own state.

```html
<a11y-checkbox-group id="toppings" legend="Toppings" select-all>
    <label><input type="checkbox" name="toppings" value="cheese"> Cheese</label>
    <label><input type="checkbox" name="toppings" value="ham"> Ham</label>
</a11y-checkbox-group>
```

```ts
import 'a11y-elements/components/checkbox-group';
import type { CheckboxGroupElement } from 'a11y-elements/components/checkbox-group/element';

const group = document.getElementById('toppings') as CheckboxGroupElement;
group.onChange = (values) => console.log('toppings:', values);
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `legend` | attribute | — | Visible group label. |
| `aria-label` | attribute | — | Group name when there's no `legend`. |
| `disabled` | attribute | absent | Disables every option (through the fieldset). |
| `select-all` | attribute | absent | Adds the "Select all" checkbox after the legend. |
| `select-all-label` | attribute | `Select all` | Its text; also `setStrings({ selectAll })`. |
| `onChange` | callback | — | `(values: string[]) => void`, called once per user action, a "Select all" click included. |
| `getValue()` / `setValue(values)` | method | — | Reads the checked values / checks exactly those values. |
| `selectAll()` / `unselectAll()` | method | — | Checks / unchecks every enabled option. Like `setValue()`, fires no events. |

A "Select all" click fires `input` and `change` on every option it changes.

Options use the `--a11y-checkbox-*` variables above.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-checkbox-group-color-text-muted` | `#6b7280` |
| `--a11y-checkbox-group-disabled-opacity` | `0.6` |
| `--a11y-checkbox-group-legend-font-size` | `0.875rem` |
| `--a11y-checkbox-group-legend-margin-bottom` | `0.5rem` |
| `--a11y-checkbox-group-options-gap` | `0.5rem` |
| `--a11y-checkbox-group-select-all-border` | `1px solid #e5e7eb` |
| `--a11y-checkbox-group-select-all-padding-bottom` | `0.5rem` |

</details>

#### `a11y-file-input`

A file picker built from a real `<input type="file">`, with the same parts as [`a11y-input`](#a11y-input). Files can be browsed for or dropped onto the element. It only picks files: the input keeps its `name` and submits them with the form, or you read `getValue()` and upload them yourself.

```html
<a11y-file-input max-size="5MB" max-files="3" previews value-missing-message="Add at least one file">
  <a11y-label>Attachments</a11y-label>
  <input type="file" name="attachments" multiple accept=".pdf,image/*" required>
  <a11y-hint>PDF or images, up to 5 MB each.</a11y-hint>
  <a11y-error></a11y-error>
</a11y-file-input>
```

It adds, after the input, a drop zone with a "Browse files" button, then (after your parts) the list of selected files, the list of files that weren't added, and a status region for announcements.

**Accessibility.**

* The native input is visually hidden, not removed. It's still the control that gets focus, is announced as a file button, carries `required`, and gets the field's `aria-describedby` and `aria-invalid`. The focus ring shows on "Browse files".
* "Browse files" is a real `<label>` for the input, so it opens the picker without script, and its text is part of the input's accessible name (voice control users can say "click Browse files").
* Dragging is a shortcut, never the only way: everything works from the keyboard. The drop prompt is hidden from assistive tech.
* Each file has a "Remove" button named "Remove report.pdf". After a removal, focus moves to the next file's button, else the previous one, else the input.
* What was added, removed or not added is announced politely. Files that weren't added are also listed on screen with the reason, until the next change.
* Errors show with the same timing as `<a11y-input>`, plus right after a drop or a removal: removing the last file of a `required` field shows the error at once.

**Rules.** `accept` (checked on drop too, which the browser doesn't do), `max-size` and `max-files` are checked as files come in. A file that fails one is not added, so these rules never make the field invalid. `required` and `validators` still do: validators get the input as their second argument, so they can read `control.files`.

With `multiple`, browsing or dropping again adds to the selection (duplicates are skipped) instead of replacing it. Without it, the new file replaces the current one, unless it's rejected.

Style the drag-over state with `a11y-file-input:state(dragover)` or `.a11y-file-input__dropzone[data-dragover]`. The `:state(touched)`, `:state(dirty)` and `:state(user-invalid)` states work as on `<a11y-input>`.

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `max-size` | attribute | — | Largest file accepted: `500KB`, `5MB`, `1GB` or bytes (1 KB = 1024 bytes). |
| `max-files` | attribute | — | Most files the selection can hold, with `multiple`. |
| `previews` | attribute | `false` | Shows a thumbnail next to image files. |
| `browse-label` / `drop-label` | attribute | see [strings](#translating-built-in-strings) | Text of the browse button / of the drop prompt. |
| `type-rejected-message` / `size-rejected-message` / `count-rejected-message` | attribute | see [strings](#translating-built-in-strings) | Why a file wasn't added. `{name}`, `{maxSize}` and `{max}` are filled in. |
| `value-missing-message`, … | attribute | browser's | As on [`a11y-input`](#a11y-input). |
| `validators` | property | `[]` | As on `a11y-input`; the second argument is the input. |
| `onChange` / `onInput` | callback | — | `(files: File[]) => void`, called once per pick, drop or removal. |
| `getValue()` | method | — | The selected files. |
| `setValue(files)` | method | — | Replaces the selection, silently: no events, no announcement. The rules still apply. |
| `addFiles(files)` | method | — | Adds files as a drop would: checked, announced, then `input` and `change` fire. Handy for a paste handler. |
| `removeFile(fileOrIndex)` / `clear()` | method | — | Removes one file / all of them, silently. |
| `checkValidity()` / `reportValidity()` | method | — | As on `a11y-input`. |

Sizes are formatted with `Intl` in the language of the closest `lang` attribute (`1.5 MB`, `1,5 Mo`, …).

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-file-input-button-border-radius` | `4px` |
| `--a11y-file-input-button-font-weight` | `600` |
| `--a11y-file-input-button-padding-x` | `1rem` |
| `--a11y-file-input-button-padding-y` | `0.5rem` |
| `--a11y-file-input-color-background` | `#ffffff` |
| `--a11y-file-input-color-border` | `#d1d5db` |
| `--a11y-file-input-color-disabled-bg` | `#e5e7eb` |
| `--a11y-file-input-color-disabled-text` | `#9ca3af` |
| `--a11y-file-input-color-dragover-bg` | `#eff6ff` |
| `--a11y-file-input-color-error` | `#b91c1c` |
| `--a11y-file-input-color-primary` | `#2563eb` |
| `--a11y-file-input-color-text` | `#111827` |
| `--a11y-file-input-color-text-muted` | `#6b7280` |
| `--a11y-file-input-dropzone-border-radius` | `8px` |
| `--a11y-file-input-dropzone-border-width` | `2px` |
| `--a11y-file-input-dropzone-gap` | `0.5rem` |
| `--a11y-file-input-dropzone-padding` | `1.5rem 1rem` |
| `--a11y-file-input-focus-outline-offset` | `2px` |
| `--a11y-file-input-focus-outline-width` | `2px` |
| `--a11y-file-input-gap` | `0.25rem` |
| `--a11y-file-input-item-border-radius` | `4px` |
| `--a11y-file-input-item-gap` | `0.75rem` |
| `--a11y-file-input-item-padding` | `0.5rem 0.75rem` |
| `--a11y-file-input-list-gap` | `0.5rem` |
| `--a11y-file-input-list-margin-top` | `0.25rem` |
| `--a11y-file-input-preview-border-radius` | `4px` |
| `--a11y-file-input-preview-size` | `2.5rem` |
| `--a11y-file-input-transition-duration` | `0.2s` |

The hint and error use the [shared field variables](#a11y-input).

</details>

#### `a11y-focusable`

Makes a non-button element behave like a button: `role="button"`, `tabindex="0"`, and Enter/Space fire a real `click`, so one `click` listener covers mouse and keyboard. Prefer a real `<button>` whenever you can.

It's for **actions**. Cards that go to another page should use [`<a11y-card-link>`](#a11y-card-link) or a plain `<a href>`: a button role, Space activation and no `href` mislead screen-reader users and break "Open in new tab".

```html
<a11y-focusable aria-label="Expand menu">
    <svg aria-hidden="true">…</svg> Menu
</a11y-focusable>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `aria-label` | attribute | — | Accessible name. Without it (or visible text), a console warning is logged. |

No CSS variables.

#### `a11y-input`

A text field built from a real `<input>` and optional parts, wired together for you:

* `<a11y-label>`: the visible label, linked with `for`. See [`a11y-label`](#a11y-label).
* `<a11y-hint>`: help text, any number of them, added to the input's `aria-describedby`.
* `<a11y-error>`: where the validation message is shown. It's hidden, and left out of `aria-describedby`, until there's an error to show.
* `<a11y-counter>`: a length counter, see [`a11y-textarea`](#a11y-textarea).

```html
<form>
  <a11y-input type-mismatch-message="Enter an email like name@example.com">
    <a11y-label>Email</a11y-label>
    <input type="email" name="email" required>
    <a11y-hint>We never share it.</a11y-hint>
    <a11y-error></a11y-error>
  </a11y-input>
</form>
```

The input stays yours and is never regenerated. 

It keeps its `name` and submits its own value, so the form works before the script loads, and native constraints (`required`, `type`, `pattern`, `minlength`, `min`, …) do the validating. 

Ids you set are kept; missing ones are generated.

- **When errors show.** 

Like `:user-invalid`, a field isn't flagged while it's first being filled in. 

Its error shows when it's left after an edit, or when a submit attempt finds it invalid. 

From then on it updates as the user types, and a form reset hides it again. 

While shown, the input has `aria-invalid="true"` and the message is in its `aria-describedby`.

- **Submitting.** 

With an `<a11y-error>`, the message is shown there instead of in the browser's bubble, and the form's first invalid field is focused. Without one, the browser's bubble is left alone.

- **Why the submit button stays enabled.** 

Nothing here disables your submit button while fields are invalid, and doing it yourself is best avoided. 

A disabled button doesn't say what's wrong, leaves the Tab order (screen reader and keyboard users may not find it at all), is often too faint to read, and makes a form look invalid before anything has been typed. 

Instead, let the submit happen: it's blocked, each error shows next to its field, and focus moves to the first invalid one. 

Disabling the button *while a submission is in flight*, to prevent double submits, is a different matter and is fine as long as the busy state is announced.

**Empty fields.** Validation follows the browser's rules, which have two consequences:

* Every constraint except `required` skips an empty value. `minlength`, `pattern`, `type="email"`, `min`, … all pass on `""`, so a field without `required` is valid when empty: the form submits and no error shows. Add `required` (and `value-missing-message`) when the field must be filled.
* `minlength` / `maxlength` only flag a value the user typed. A value set from code (`control.value`, `setValue()`) passes them until it's edited.

`validators` do run on an empty value. To keep an optional field optional, return `null` for `""`.

**Custom rules.** `validators` run in order once the native constraints pass; the first message returned is the error. It goes through `setCustomValidity()`, so it blocks submission like a native one. Set `validators` instead of calling `setCustomValidity()` yourself, which the next validation would clear.

```ts
import 'a11y-elements/components/input';
import type { InputElement } from 'a11y-elements/components/input/element';

const username = document.getElementById('username') as InputElement;
username.validators = [(value) => (takenNames.has(value) ? 'That name is taken' : null)];
```

**The host is form-associated.** It mirrors the input through `ElementInternals`: its validity follows the input's (anchored to it), and it exposes custom states for styling:

```css
a11y-input:state(user-invalid) { background: #fef2f2; } /* the error is shown */
a11y-input:state(touched) { … }                        /* left at least once */
a11y-input:state(dirty) { … }                          /* edited at least once */
```

Where `:state()` isn't supported, style `input[aria-invalid="true"]` instead.

Checkbox, radio, range, color, file, hidden and button inputs are left alone: use `<a11y-checkbox>`, `<a11y-checkbox-group>`, `<a11y-radio-group>`, … for those.

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `value-missing-message` | attribute | browser's | Message when `required` isn't met. |
| `type-mismatch-message` | attribute | browser's | Message when the value doesn't match `type` (`email`, `url`). |
| `pattern-mismatch-message` | attribute | browser's | Message when the value doesn't match `pattern`. |
| `too-short-message` / `too-long-message` | attribute | browser's | Messages for `minlength` / `maxlength`. |
| `range-underflow-message` / `range-overflow-message` | attribute | browser's | Messages for `min` / `max`. |
| `step-mismatch-message` / `bad-input-message` | attribute | browser's | Messages for `step`, and for input the browser can't parse (e.g. text in a number field). |
| `validators` | property | `[]` | `((value, control) => string \| null)[]`, run after the native constraints. |
| `onInput` / `onChange` | callback | — | `(value: string) => void`, called on every `input` / `change`. |
| `getValue()` / `setValue(value)` | method | — | Reads / sets the value. `setValue` re-validates without marking the field as edited. |
| `checkValidity()` | method | — | Returns whether the field is valid, without showing anything. |
| `reportValidity()` | method | — | Shows the error and focuses the input when it's invalid. |
| `validity` / `validationMessage` / `willValidate` / `form` | property | — | Same as on the input; `validationMessage` includes your overrides. |

Message attributes can use `{min}`, `{max}`, `{minlength}` and `{maxlength}`, filled from the input's attributes: `too-short-message="At least {minlength} characters"`.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-input-color-background` | `#ffffff` |
| `--a11y-input-color-border` | `#d1d5db` |
| `--a11y-input-color-border-strong` | `#9ca3af` |
| `--a11y-input-color-disabled-bg` | `#e5e7eb` |
| `--a11y-input-color-disabled-text` | `#9ca3af` |
| `--a11y-input-color-error` | `#b91c1c` |
| `--a11y-input-color-primary` | `#2563eb` |
| `--a11y-input-color-text` | `#111827` |
| `--a11y-input-control-border-radius` | `4px` |
| `--a11y-input-control-border-width` | `1px` |
| `--a11y-input-control-font-family` | `inherit` |
| `--a11y-input-control-font-size` | `1rem` |
| `--a11y-input-control-line-height` | `1.4` |
| `--a11y-input-control-padding-x` | `0.75rem` |
| `--a11y-input-control-padding-y` | `0.5rem` |
| `--a11y-input-focus-outline-offset` | `2px` |
| `--a11y-input-focus-outline-width` | `2px` |
| `--a11y-input-gap` | `0.25rem` |
| `--a11y-input-transition-duration` | `0.2s` |

Shared by the parts of every field:

| Variable | Default |
| --- | --- |
| `--a11y-field-color-error` | `#b91c1c` |
| `--a11y-field-color-text-muted` | `#6b7280` |
| `--a11y-field-error-font-weight` | `600` |
| `--a11y-field-part-font-size` | `0.875rem` |
| `--a11y-field-part-line-height` | `1.4` |

</details>

##### Building your own field: `bindField()`

The same wiring, without the custom elements: `bindField()` takes the control and its parts as any elements you like, for example from a framework component. It's exported from `a11y-elements/core`, and from the input and textarea `define.js` bundles.

```ts
import { bindField } from 'a11y-elements/core';

const field = bindField(
  { control: input, label: labelEl, hints: [hintEl], error: errorEl, counter: counterEl },
  {
    validators: [(value) => (value.includes(' ') ? 'No spaces' : null)],
    messages: { valueMissing: 'Required', tooShort: 'At least {minlength} characters' },
    onStateChange: ({ valid, message, touched, dirty, showError }) => { /* mirror it in your state */ },
  },
);

field.sync({ control: input, label: labelEl, hints: [], error: errorEl }); // after parts change
field.show();    // show the error now, as a submit attempt would
field.reset();   // back to pristine (also happens on its own on form reset)
field.destroy(); // on unmount: removes its listeners and the ARIA it added
```

A real `<label>` is linked with `for`; any other element with `aria-labelledby`. Tokens you put in `aria-describedby` / `aria-labelledby` yourself are kept.

#### `a11y-label`

Renders a real `<label class="a11y-label">` around its content. A custom element can't itself be a `<label>`, and only a real one gives click-to-focus and native naming. Inside `<a11y-input>` / `<a11y-textarea>` it's linked automatically; on its own, `for` is forwarded:

```html
<a11y-label for="search">Search</a11y-label>
<input id="search" type="search">
```

A `*` marks a required field. It's CSS only and hidden from screen readers, which already announce the control's `required`.

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `for` | attribute | — | Id of the control to label, when used outside a field. |
| `required` | attribute | absent | Shows the required marker outside a field (inside one, it follows the control's `required`). |
| `label` | property | — | The rendered `<label>` element. |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-label-color-required` | `#b91c1c` |
| `--a11y-label-color-text` | `#111827` |
| `--a11y-label-font-size` | `0.875rem` |
| `--a11y-label-font-weight` | `600` |
| `--a11y-label-line-height` | `1.4` |
| `--a11y-label-required-gap` | `0.25em` |
| `--a11y-label-required-marker` | `"*"` |

</details>

#### `a11y-picture`

Wraps a `<picture>`/`<img>` and optional `<figcaption>`, yours or generated from attributes, as `role="figure"`. An image with `alt=""` and no caption is treated as decorative and hidden from assistive tech (`aria-hidden="true"`).

```html
<a11y-picture>
    <picture>
        <source srcset="hero.webp" type="image/webp">
        <img src="hero.jpg" alt="Sunset over the Rockies" loading="lazy" decoding="async">
    </picture>
    <figcaption>Sunset over the Rockies</figcaption>
</a11y-picture>
```

**Several formats.** Instead of writing the markup, give the element a `src` (the fallback image) and it builds the `<picture>` itself: one `<source>` per format, then the `<img>`, plus a `<figcaption>` for `caption`. The browser uses the first source whose `type` it supports, else the fallback, so list the most efficient format first. A source without a `type` is always used, so give each one its type.

```html
<a11y-picture
    src="s.jpg"
    alt="S illustration"
    sources="s.avif image/avif, s.webp image/webp"
    caption="An illustration of S">
</a11y-picture>
```

The same from JavaScript, in one object:

```js
const base = './assets/images/s';
document.querySelector('a11y-picture').image = {
  sources: [
    { src: `${base}.avif`, type: 'image/avif' },
    { src: `${base}.webp`, type: 'image/webp' },
  ],
  fallback: `${base}.jpg`,
  alt: 'S illustration',
};
```

* The `sources` attribute takes `url type` pairs. For srcset descriptors (`s.avif 1x, s@2x.avif 2x`), `media` or `sizes`, set the `sources` property in JavaScript.
* Use one way or the other: with a `src`, children you wrote are ignored.
* The same accessibility rule applies: with `alt=""` and no caption, the figure is hidden. Without any `alt`, the image is treated as decorative and a console warning asks for one.

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `src` | attribute / property | — | The fallback image. Setting it switches to a generated picture. |
| `alt` | attribute / property | — | The image's text alternative; `""` for a decorative image. |
| `sources` | attribute | — | `url type` pairs, comma-separated: `"s.avif image/avif, s.webp image/webp"`. |
| `sources` | property | — | `{ src, type?, media?, sizes? }[]`; `src` can be a full srcset. Wins over the attribute until the attribute changes. |
| `caption` | attribute / property | — | Text of a generated `<figcaption>`. |
| `width` / `height` | attribute / property | — | The image's intrinsic size, to avoid layout shift. |
| `loading` | attribute / property | `lazy` | `lazy` or `eager`. The image is always `decoding="async"`. |
| `sizes` | attribute | — | `sizes` of the `<img>`. |
| `image` | property | — | Sets it all at once: `{ sources?, fallback, alt, caption?, width?, height?, loading? }`. |

The `PictureSource` and `PictureImage` types are exported with the element.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-picture-caption-font-size` | `0.875rem` |
| `--a11y-picture-caption-line-height` | `1.4` |
| `--a11y-picture-caption-margin-top` | `0.25rem` |
| `--a11y-picture-color-text-muted` | `#6b7280` |

</details>

#### `a11y-progress`

A labelled progress bar around a native `<progress>`. Without `value`, it shows an indeterminate animation.

```html
<a11y-progress value="50" max="100" label="Uploading…"></a11y-progress>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `value` | attribute / property | — | Current value; absent means indeterminate. |
| `max` | attribute / property | `100` | Maximum value. |
| `label` | attribute | — | Visible label, used as the accessible name. |
| `aria-label` | attribute | `Progress` | Accessible name when there's no visible `label`. The default can be [translated](#translating-built-in-strings). |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-progress-bar-border-radius` | `9999px` |
| `--a11y-progress-bar-height` | `0.5rem` |
| `--a11y-progress-bar-transition-duration` | `0.3s` |
| `--a11y-progress-color-primary` | `#2563eb` |
| `--a11y-progress-color-surface` | `#f3f4f6` |
| `--a11y-progress-color-text-muted` | `#6b7280` |
| `--a11y-progress-gap` | `0.25rem` |
| `--a11y-progress-indeterminate-duration` | `1.5s` |
| `--a11y-progress-label-font-size` | `0.875rem` |
| `--a11y-progress-label-font-weight` | `500` |

</details>

#### `a11y-radio-group`

Wraps your radios in a `<fieldset>` with a `<legend>`. Give every radio the same `name`; that's what makes them one native group.

```html
<a11y-radio-group legend="Choose a plan">
    <label><input type="radio" name="plan" value="basic"> Basic</label>
    <label><input type="radio" name="plan" value="pro"> Pro</label>
</a11y-radio-group>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `legend` | attribute | — | Visible group label. |
| `aria-label` | attribute | — | Group name when there's no `legend`. |
| `disabled` | attribute | absent | Disables every option (through the fieldset). |
| `onChange` | callback | — | `(value: string) => void`, called when an option is checked. |
| `getValue()` / `setValue(value)` | method | — | Reads the checked value / checks the option with that value. |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-radio-group-checked-inner-ring` | `0.2rem` |
| `--a11y-radio-group-checked-outer-ring` | `0.5rem` |
| `--a11y-radio-group-color-background` | `#ffffff` |
| `--a11y-radio-group-color-border` | `#d1d5db` |
| `--a11y-radio-group-color-border-strong` | `#9ca3af` |
| `--a11y-radio-group-color-disabled-bg` | `#e5e7eb` |
| `--a11y-radio-group-color-primary` | `#2563eb` |
| `--a11y-radio-group-color-text` | `#111827` |
| `--a11y-radio-group-color-text-muted` | `#6b7280` |
| `--a11y-radio-group-disabled-opacity` | `0.6` |
| `--a11y-radio-group-focus-outline-offset` | `2px` |
| `--a11y-radio-group-focus-outline-width` | `2px` |
| `--a11y-radio-group-input-border-width` | `2px` |
| `--a11y-radio-group-input-size` | `1.125rem` |
| `--a11y-radio-group-input-transition-duration` | `0.2s` |
| `--a11y-radio-group-label-font-size` | `1rem` |
| `--a11y-radio-group-label-line-height` | `1.4` |
| `--a11y-radio-group-legend-font-size` | `0.875rem` |
| `--a11y-radio-group-legend-margin-bottom` | `0.5rem` |
| `--a11y-radio-group-option-gap` | `0.5rem` |
| `--a11y-radio-group-options-gap` | `0.5rem` |

</details>

#### `a11y-select`

Wraps a real `<select>` in a `<label>` with a visible label text. Options and keyboard handling stay native.

```html
<a11y-select label="Country">
    <select name="country">
        <option value="us">United States</option>
        <option value="ca">Canada</option>
    </select>
</a11y-select>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `label` | attribute | — | Visible label text. |
| `onChange` | callback | — | `(value: string) => void`, called on every `change`. |
| `getValue()` / `setValue(value)` | method | — | Reads / sets the selected value. |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-select-color-border` | `#d1d5db` |
| `--a11y-select-color-border-strong` | `#9ca3af` |
| `--a11y-select-color-disabled-bg` | `#e5e7eb` |
| `--a11y-select-color-disabled-text` | `#9ca3af` |
| `--a11y-select-color-primary` | `#2563eb` |
| `--a11y-select-color-surface` | `#f3f4f6` |
| `--a11y-select-color-text` | `#111827` |
| `--a11y-select-color-text-muted` | `#6b7280` |
| `--a11y-select-control-border-radius` | `4px` |
| `--a11y-select-control-border-width` | `1px` |
| `--a11y-select-control-font-family` | `Arial, sans-serif` |
| `--a11y-select-control-font-size` | `1rem` |
| `--a11y-select-control-line-height` | `1.4` |
| `--a11y-select-control-padding-x` | `1rem` |
| `--a11y-select-control-padding-y` | `0.5rem` |
| `--a11y-select-control-transition-duration` | `0.2s` |
| `--a11y-select-focus-outline-offset` | `2px` |
| `--a11y-select-focus-outline-width` | `2px` |
| `--a11y-select-gap` | `0.25rem` |
| `--a11y-select-label-font-size` | `0.875rem` |
| `--a11y-select-label-font-weight` | `600` |

</details>

#### `a11y-skeleton`

A loading placeholder, hidden from assistive tech.

```html
<a11y-skeleton variant="text" lines="3"></a11y-skeleton>
<a11y-skeleton variant="circle" width="3rem"></a11y-skeleton>
<a11y-skeleton width="100%" height="10rem"></a11y-skeleton>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `variant` | attribute / property | `rect` | `rect`, `circle` or `text`. |
| `lines` | attribute / property | `1` | Number of lines, for `variant="text"`. |
| `width` | attribute | — | Sets `--a11y-skeleton-width`. |
| `height` | attribute | — | Sets `--a11y-skeleton-height`. |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-skeleton-border-radius` | `4px` |
| `--a11y-skeleton-circle-default-size` | `2.5rem` |
| `--a11y-skeleton-color-surface` | `#f3f4f6` |
| `--a11y-skeleton-default-height` | `1em` |
| `--a11y-skeleton-height` | `1em` (`--a11y-skeleton-default-height`); circle: same as width |
| `--a11y-skeleton-last-line-width` | `70%` |
| `--a11y-skeleton-line-border-radius` | `2px` |
| `--a11y-skeleton-multiline-gap` | `0.5rem` |
| `--a11y-skeleton-pulse-duration` | `1.5s` |
| `--a11y-skeleton-pulse-min-opacity` | `0.45` |
| `--a11y-skeleton-stagger-delay` | `0.1s` |
| `--a11y-skeleton-text-border-radius` | `2px` |
| `--a11y-skeleton-width` | `100%`; circle: `2.5rem` (`--a11y-skeleton-circle-default-size`) |

</details>

#### `a11y-spinner`

A loading spinner with `role="status"`. No JS needed beyond the define.

```html
<a11y-spinner label="Saving…" size="3rem" color="#16a34a"></a11y-spinner>
<a11y-spinner class="a11y-spinner--lg"></a11y-spinner>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `label` | attribute / property | `Loading` | Accessible name. The default can be [translated](#translating-built-in-strings). |
| `size` | attribute / property | — | Sets `--a11y-spinner-size`. |
| `color` | attribute / property | — | Sets `--a11y-spinner-color`. |
| `duration` | attribute / property | — | Sets `--a11y-spinner-duration`. |
| `thickness` | attribute / property | — | Sets `--a11y-spinner-thickness`. |

Size presets: add `a11y-spinner--sm`, `a11y-spinner--lg` or `a11y-spinner--xl` to `class`.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-spinner-border-radius` | `50%` |
| `--a11y-spinner-color` | `#2563eb` |
| `--a11y-spinner-duration` | `1s` |
| `--a11y-spinner-size` | `2rem` |
| `--a11y-spinner-size-lg` | `3rem` |
| `--a11y-spinner-size-sm` | `1rem` |
| `--a11y-spinner-size-xl` | `4rem` |
| `--a11y-spinner-thickness` | `3px` |
| `--a11y-spinner-thickness-lg` | `4px` |
| `--a11y-spinner-thickness-sm` | `2px` |
| `--a11y-spinner-thickness-xl` | `5px` |

</details>

#### `a11y-switch`

Like `<a11y-checkbox>`, but the input gets `role="switch"`.

```html
<a11y-switch label="Enable notifications">
    <input type="checkbox" name="notifications">
</a11y-switch>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `label` | attribute | — | Visible label text. |
| `onChange` | callback | — | `(checked: boolean) => void`, called on every `change`. |
| `getValue()` / `setValue(checked)` | method | — | Reads / sets `checked`. |

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-switch-border-radius` | `9999px` |
| `--a11y-switch-color-background` | `#ffffff` |
| `--a11y-switch-color-border-strong` | `#9ca3af` |
| `--a11y-switch-color-disabled-bg` | `#e5e7eb` |
| `--a11y-switch-color-disabled-text` | `#9ca3af` |
| `--a11y-switch-color-primary` | `#2563eb` |
| `--a11y-switch-color-text` | `#111827` |
| `--a11y-switch-disabled-opacity` | `0.6` |
| `--a11y-switch-focus-outline-offset` | `2px` |
| `--a11y-switch-focus-outline-width` | `2px` |
| `--a11y-switch-gap` | `0.5rem` |
| `--a11y-switch-label-font-size` | `1rem` |
| `--a11y-switch-label-line-height` | `1.4` |
| `--a11y-switch-thumb-offset` | `calc((var(--a11y-switch-track-height, 1.5rem) - var(--a11y-switch-thumb-size, 1.125rem)) / 2)` |
| `--a11y-switch-thumb-shadow-blur` | `3px` |
| `--a11y-switch-thumb-shadow-color` | `rgba(0 0 0 / 25%)` |
| `--a11y-switch-thumb-shadow-offset-y` | `1px` |
| `--a11y-switch-thumb-size` | `1.125rem` |
| `--a11y-switch-track-height` | `1.5rem` |
| `--a11y-switch-track-width` | `2.75rem` |
| `--a11y-switch-transition-duration` | `0.2s` |

</details>

#### `a11y-textarea`

`<a11y-input>` for a real `<textarea>`: same parts, attributes, properties, validation and states.

An `<a11y-counter>` shows the length against `maxlength` (`12 / 200`; hidden without `maxlength`). Screen readers don't hear it on every keystroke: once 20 characters or fewer are left, "5 characters remaining" is announced when typing pauses, and read with the field's description.

```html
<a11y-textarea value-missing-message="Tell us a bit more">
  <a11y-label>Bio</a11y-label>
  <textarea name="bio" required maxlength="200"></textarea>
  <a11y-counter></a11y-counter>
  <a11y-error></a11y-error>
</a11y-textarea>
```

The counter's strings can be [translated](#translating-built-in-strings).

<details>
<summary>CSS variables</summary>

The same as [`a11y-input`](#a11y-input), prefixed `--a11y-textarea-` instead of `--a11y-input-`, plus:

| Variable | Default |
| --- | --- |
| `--a11y-textarea-min-height` | `6rem` |
| `--a11y-textarea-resize` | `vertical` |

</details>

#### `a11y-visually-hidden`

Content for screen readers only, hidden visually.

```html
<button>
    <svg aria-hidden="true">…</svg>
    <a11y-visually-hidden>Delete item</a11y-visually-hidden>
</button>
```

No attributes or CSS variables. The class `a11y-visually-hidden` is also usable on its own.

### Overlays

#### Common to all overlays

* **Open/close** with the `open` attribute or property, or `show()` / `close()`.
* **Before the element is defined** (lazy-loaded bundles), setting `.open = true`, `onClose` or any other property works: it's applied once the element upgrades. `setAttribute('open', '')` works too.
* **Events:** `a11y-overlay-open` and `a11y-overlay-close` fire on `document`, with `event.detail.name` set to the tag name.
* **`dismissAllOverlays()`** closes every open overlay (e.g. on navigation). It's exported from `a11y-elements/core` and from every overlay's `define.js`.
* **Except `<a11y-floating>`**, which is visible by default and has no `open`: `dismissAllOverlays()` only collapses its expanded panel. See [`a11y-floating`](#a11y-floating).
* **Body mounting:** every overlay (including the snackbar and notification-banner regions) moves itself to `<body>` when connected, so a `position: fixed` layer isn't clipped by an ancestor. See [Overlays in a framework](#overlays-in-a-framework) below.

##### Overlays in a framework

###### Removing them is up to you. 

An overlay authored inside a component isn't inside that component's DOM any more, so when your framework removes the component's subtree (an unmount, a SPA navigation), the overlay stays in `<body>`, and the next render adds a second copy with the same `id`. Call `removeOverlaysWithin(host)` on unmount. It removes every overlay authored inside `host`, even after `host` has left the document, and returns how many it removed. It's exported from `a11y-elements/core` and from every overlay's `define.js`.

```js
import { removeOverlaysWithin } from 'a11y-elements/core';
// or: import { removeOverlaysWithin } from './node_modules/a11y-elements/dist/browser/overlays/modal/define.js';

onUnmount(() => removeOverlaysWithin(hostElement)); // your framework's unmount hook
```

Nothing is removed automatically, so subtrees your framework detaches and reattaches later (keep-alive caches, keyed moves) keep their overlays.

##### Don't reach overlay content through the host. 

If the overlay's bundle is already loaded, `host.innerHTML = '…<a11y-modal>…'` upgrades the overlay and moves it to `<body>` during that same assignment, so a later `host.querySelectorAll(...)` finds nothing inside it. 

If the bundle loads after rendering, the same query does find it, so the result depends on load order. 

**Instead:**

* get the overlay by `id` (`document.getElementById`) and query inside it;
* bind events on the overlay element itself, or delegate from it;
* put final text into the markup before injecting it, rather than in a pass after rendering.

<a id="dialogs"></a>

##### Dialogs (`<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`)

They also share:

* A focus trap (Tab stays inside, focus returns to the trigger on close) and a page scroll lock (`html.a11y-no-scroll`).
* Escape, a click on the backdrop, or the × close button close it, unless it's `non-dismissible`.
* The dialog is named after its first heading (`aria-labelledby`), or `dialog-label`.

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `non-dismissible` | attribute | absent | No close button, no Escape, no backdrop click: close it from code. |
| `dialog-label` | attribute | — | Accessible name (`aria-label`) when there's no heading. |
| `close-label` | attribute | `Close dialog` | Accessible name of the × close button. See [Translating built-in strings](#translating-built-in-strings). |
| `dismissible` | property (read-only) | `true` | Inverse of `non-dismissible`. |
| `onClose` | callback | — | Called once the close transition has finished. |

<a id="anchored-overlays"></a>

##### Anchored overlays (`<a11y-popover>`, `<a11y-tooltip>`, `<a11y-dropdown>`, `<a11y-context-menu>`)

They are positioned next to an anchor. They flip to the opposite side when there isn't room, and close on a click outside or Escape.

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `anchor` | attribute | — | `id` of the anchor element. |
| `anchorElement` | property | — | The anchor element itself (takes precedence over `anchor`). |
| `placement` | attribute | `bottom` | `top`, `bottom`, `left` or `right`, optionally with `-start` / `-end` (e.g. `bottom-start`). |
| `offset` | attribute | `8` | Gap to the anchor, in px. |
| `updatePosition()` | method | — | Recomputes the position (it already follows scroll, resize and size changes). |

<a id="menus"></a>

##### Menus (`<a11y-dropdown>`, `<a11y-context-menu>`)

Items are your own children with `role="menuitem"`. Arrow keys, Home and End move between them, and Enter/Space fire a real `click`. The menu closes after an item is clicked or when focus leaves it. Mark an item `aria-disabled="true"` to skip it.

<details>
<summary>CSS variables shared by anchored overlays and menus</summary>

| Variable | Default |
| --- | --- |
| `--a11y-anchored-overlay-initial-scale` | `0.97` |
| `--a11y-anchored-overlay-transition-duration` | `0.15s` |
| `--a11y-menu-item-color-background` | `#ffffff` |
| `--a11y-menu-item-color-secondary-hover` | `#4b5563` |
| `--a11y-menu-item-color-text` | `#111827` |
| `--a11y-menu-item-disabled-opacity` | `0.5` |
| `--a11y-menu-item-padding` | `0.5rem 1rem` |

</details>

#### `a11y-blocking-loader`

A full-screen loading overlay that can't be dismissed. While open, the rest of the page is `inert` and focus moves onto the loader; both are restored on close. Contains an `<a11y-spinner>` (registered automatically).

```html
<a11y-blocking-loader id="saving" message="Saving your changes…"></a11y-blocking-loader>
```

```js
const loader = document.getElementById('saving');
loader.show();
await save();
loader.close();
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `message` | attribute | — | Visible message, also the spinner's label (`Loading` without it, [translatable](#translating-built-in-strings)). |

See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-blocking-loader-color-overlay` | `rgba(0, 0, 0, 0.5)` |
| `--a11y-blocking-loader-color-text` | `#111827` |
| `--a11y-blocking-loader-gap` | `1rem` |
| `--a11y-blocking-loader-message-font-size` | `1rem` |
| `--a11y-blocking-loader-message-font-weight` | `600` |

</details>

#### `a11y-context-menu`

A menu that opens at the pointer on right-click of a trigger element, replacing the browser's own menu there. See [Menus](#menus) and [Anchored overlays](#anchored-overlays).

```html
<div id="canvas">Right-click me</div>
<a11y-context-menu trigger="canvas">
    <div role="menuitem">Copy</div>
    <div role="menuitem">Paste</div>
</a11y-context-menu>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `trigger` | attribute | — | `id` of the element to right-click. |
| `triggerElement` | property | — | The trigger element itself (takes precedence over `trigger`). |
| `dispose()` | method | — | Detaches from the trigger for good (`close()` only hides the current menu). |

Also takes the shared [anchored-overlay](#anchored-overlays) options `placement` and `offset`, measured from the pointer, and `updatePosition()`; not `anchor` / `anchorElement`, since it opens where the `trigger` is right-clicked. Items follow the [menu](#menus) keyboard behavior. See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-context-menu-border-radius` | `0.5rem` |
| `--a11y-context-menu-color-background` | `#ffffff` |
| `--a11y-context-menu-color-text` | `#111827` |
| `--a11y-context-menu-content-padding` | `0.25rem 0` |
| `--a11y-context-menu-min-width` | `160px` |
| `--a11y-context-menu-shadow-blur` | `10px` |
| `--a11y-context-menu-shadow-fade` | `85%` |
| `--a11y-context-menu-shadow-offset-y` | `2px` |

</details>

#### `a11y-drawer`

A panel that slides in from a screen edge. Behaves like `<a11y-modal>` (see [Dialogs](#dialogs)).

```html
<a11y-drawer id="filters" edge="left">
    <h2>Filters</h2>
    …
</a11y-drawer>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `edge` | attribute / property (read-only) | `right` | `left`, `right`, `top` or `bottom`. Read when the drawer opens. |

Also takes the shared [dialog](#dialogs) options: `non-dismissible`, `dialog-label`, `close-label`, `dismissible` and `onClose`. See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`.

<details>
<summary>CSS variables</summary>

The close button uses the modal's `--a11y-modal-close-button-size` and `--a11y-modal-color-secondary(-hover)`.

| Variable | Default |
| --- | --- |
| `--a11y-drawer-color-background` | `#ffffff` |
| `--a11y-drawer-color-overlay` | `rgba(0, 0, 0, 0.5)` |
| `--a11y-drawer-color-text` | `#111827` |
| `--a11y-drawer-content-padding` | `1.5rem` |
| `--a11y-drawer-height` | `min(480px, 90vh)` |
| `--a11y-drawer-shadow-blur` | `10px` |
| `--a11y-drawer-shadow-fade` | `80%` |
| `--a11y-drawer-shadow-offset-y` | `2px` |
| `--a11y-drawer-transition-duration` | `0.3s` |
| `--a11y-drawer-width` | `min(400px, 90vw)` |

</details>

#### `a11y-dropdown`

A menu attached to a trigger button. The anchor is the trigger: clicking it toggles the menu, and it gets `aria-haspopup`, `aria-controls` and `aria-expanded`. See [Anchored overlays](#anchored-overlays) and [Menus](#menus).

```html
<button id="actions-btn">Actions</button>
<a11y-dropdown anchor="actions-btn" placement="bottom-start">
    <div role="menuitem">Edit</div>
    <div role="menuitem" aria-disabled="true">Share</div>
    <div role="menuitem">Delete</div>
</a11y-dropdown>
```

No attributes of its own. It takes the shared [anchored-overlay](#anchored-overlays) options: `anchor` / `anchorElement`, `placement`, `offset` and `updatePosition()`, so e.g. `placement="top-end" offset="4"` opens it above the trigger, right-aligned, 4px away. Items follow the [menu](#menus) keyboard behavior. See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-dropdown-border-radius` | `0.5rem` |
| `--a11y-dropdown-color-background` | `#ffffff` |
| `--a11y-dropdown-color-text` | `#111827` |
| `--a11y-dropdown-content-padding` | `0.25rem 0` |
| `--a11y-dropdown-min-width` | `160px` |
| `--a11y-dropdown-shadow-blur` | `10px` |
| `--a11y-dropdown-shadow-fade` | `85%` |
| `--a11y-dropdown-shadow-offset-y` | `2px` |

</details>

#### `a11y-emergency-dialog`

A modal the user can't dismiss: no close button, no Escape, no backdrop click, whatever its attributes say. For things that must be resolved on purpose, e.g. "your session is about to expire". Close it from code.

```html
<a11y-emergency-dialog id="session">
    <h2>Session expiring</h2>
    <p>You'll be signed out in 2 minutes.</p>
    <div class="a11y-modal-buttons">
        <button id="stay">Stay signed in</button>
    </div>
</a11y-emergency-dialog>
```

```js
document.getElementById('stay').addEventListener('click', () => {
    document.getElementById('session').close();
});
```

From the shared [dialog](#dialogs) options, only `dialog-label` and `onClose` apply. See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`. It uses the modal's CSS variables, plus:

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-emergency-dialog-accent-width` | `4px` |

</details>

#### `a11y-floating`

Content pinned to a corner or edge of the viewport: a floating button that opens a drawer, an info bubble, a help launcher. It's visible by default: there's no `open` attribute. Hide it with `hidden` or `dismiss()`. Several in the same position stack instead of overlapping.

It works in one of two modes:

* **Controls mode:** with `controls="<id>"`, its trigger opens and closes that overlay. The trigger is a `[data-floating-trigger]` child, else the first button. It gets `aria-controls`, an `aria-expanded` kept in sync with the overlay however it closes, and `aria-haspopup` (`dialog` for a modal, drawer, emergency dialog or `interactive` popover; `menu` for a dropdown or context menu). A popover or dropdown with no anchor is anchored to the trigger.
* **Expandable mode:** with `expandable`, its content goes into a panel (`role="dialog"`, not modal) that a launcher button expands. The launcher is a `[data-floating-trigger]` child, else a generated button showing `label`. Expanding moves focus to the panel's first control. Escape, a click outside, the panel's × or the launcher collapse it, and focus returns to the launcher. The panel is named by `panel-label`, else its first heading, else `label`.

```html
<!-- Opens a drawer -->
<a11y-floating controls="nav-drawer"><button>Menu</button></a11y-floating>
<a11y-drawer id="nav-drawer"><h2>Navigation</h2>…</a11y-drawer>

<!-- Info bubble -->
<a11y-floating position="bottom-left" label="What's new" dismissible hide-on-scroll>
    <p>Dark mode is here.</p>
</a11y-floating>

<!-- Help panel -->
<a11y-floating expandable label="Help">
    <h2>Need help?</h2>
    <a href="/faq">Read the FAQ</a>
</a11y-floating>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `position` | attribute / property | `bottom-right` | `top`, `bottom`, `top-left`, `top-right`, `bottom-left` or `bottom-right`. |
| `controls` | attribute | — | Id of the overlay its trigger toggles. |
| `controlsElement` | property | — | The same, as an element. |
| `expandable` | attribute | absent | Expandable mode. Ignored with `controls`. |
| `expanded` | attribute / property | absent | Whether the panel is expanded. `expand()`, `collapse()` and `toggle()` set it. |
| `label` | attribute | — | Text of the generated launcher. Outside expandable mode, makes the element a `role="region"` landmark with this name. |
| `panel-label` | attribute | first heading | Accessible name of the panel. |
| `close-label` | attribute | `Close dialog` | Accessible name of the panel's × button. See [Translating built-in strings](#translating-built-in-strings). |
| `trap-focus` | attribute | absent | Traps focus in the expanded panel. |
| `dismissible` | attribute | absent | Adds a × button that calls `dismiss()`. |
| `dismiss-label` | attribute | `Dismiss` | Accessible name of that button. See [Translating built-in strings](#translating-built-in-strings). |
| `announce` | attribute | absent | Makes the element a polite `role="status"` live region, so content shown with `show()` is announced. |
| `hide-on-scroll` | attribute | absent | Slides it out of view while the page scrolls down and back on scroll up. It stays in the Tab order and comes back when focused. |
| `scroll-threshold` | attribute | `16` | Pixels of scrolling before `hide-on-scroll` reacts. |
| `dismiss()` | method | — | Fires a cancelable `a11y-floating-dismiss` event, then animates out and sets `hidden`. Focus goes back to where it was before it entered. |
| `show()` | method | — | Shows it again (`hidden = false`). |
| `onClose` | callback | — | Called when the panel collapses or the element is dismissed. |

Events on the element: `a11y-floating-expand`, `a11y-floating-collapse`, `a11y-floating-dismiss` (cancelable). The panel also fires `a11y-overlay-open` / `a11y-overlay-close` on `document`, and `dismissAllOverlays()` collapses it but leaves the element showing. Like every overlay it moves itself out of where it was authored (into `.a11y-floating-stack[data-position]` on `<body>`); see [Overlays in a framework](#overlays-in-a-framework) for `removeOverlaysWithin()`. Being last in `<body>`, it comes last in the Tab order.

Classes: `.a11y-floating-launcher`, `.a11y-floating-panel`, `.a11y-floating-panel-close`, `.a11y-floating-dismiss`. The element itself has no background, so style your bubble's content directly.

<details>
<summary>CSS variables</summary>

Offsets add the device's safe-area inset (`env(safe-area-inset-*)`). The stacking order comes from `--a11y-z-floating-button` (see [Shared tokens](#shared-tokens)).

| Variable | Default |
| --- | --- |
| `--a11y-floating-close-font-size` | `1.25rem` |
| `--a11y-floating-content-gap` | `0.5rem` |
| `--a11y-floating-gap` | `0.75rem` |
| `--a11y-floating-launcher-border-radius` | `999px` |
| `--a11y-floating-launcher-color-background` | `#111827` |
| `--a11y-floating-launcher-color-text` | `#ffffff` |
| `--a11y-floating-launcher-padding` | `0 1rem` |
| `--a11y-floating-launcher-size` | `3rem` |
| `--a11y-floating-max-width` | `calc(100vw - 2rem)` |
| `--a11y-floating-offset` | `1rem` |
| `--a11y-floating-offset-x` / `--a11y-floating-offset-y` | `--a11y-floating-offset` |
| `--a11y-floating-panel-border-radius` | `0.5rem` |
| `--a11y-floating-panel-color-background` | `#ffffff` |
| `--a11y-floating-panel-color-text` | `#111827` |
| `--a11y-floating-panel-initial-scale` | `0.97` |
| `--a11y-floating-panel-max-height` | `min(480px, 70vh)` |
| `--a11y-floating-panel-offset` | `0.5rem` |
| `--a11y-floating-panel-padding` | `1rem` |
| `--a11y-floating-panel-shadow-blur` | `10px` |
| `--a11y-floating-panel-shadow-fade` | `80%` |
| `--a11y-floating-panel-shadow-offset-y` | `2px` |
| `--a11y-floating-panel-width` | `min(320px, calc(100vw - 2rem))` |
| `--a11y-floating-transition-duration` | `0.2s` |

</details>

#### `a11y-modal`

A centered dialog. Your content is its children. See [Dialogs](#dialogs).

```html
<button id="open-settings">Open settings</button>
<a11y-modal id="settings">
    <h2>Settings</h2>
    <p>Press Escape, click the backdrop, or the close button to dismiss.</p>
    <div class="a11y-modal-buttons">
        <button type="button">Save</button>
    </div>
</a11y-modal>
```

```js
import 'a11y-elements/overlays/modal';

document.getElementById('open-settings').addEventListener('click', () => {
    document.getElementById('settings').open = true;
});
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `fullscreen` | attribute | absent | Fills the viewport, without the backdrop gutter. Read when the modal opens. |

Also takes the shared [dialog](#dialogs) options: `non-dismissible`, `dialog-label`, `close-label`, `dismissible` and `onClose`. See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`.

`.a11y-modal-buttons` is an optional footer-row class for your own buttons.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-modal-border-radius` | `1rem` |
| `--a11y-modal-close-button-size` | `1.5rem` |
| `--a11y-modal-color-background` | `#ffffff` |
| `--a11y-modal-color-overlay` | `rgba(0, 0, 0, 0.5)` |
| `--a11y-modal-color-secondary` | `#6b7280` |
| `--a11y-modal-color-secondary-hover` | `#4b5563` |
| `--a11y-modal-color-text` | `#111827` |
| `--a11y-modal-content-padding` | `1.5rem` |
| `--a11y-modal-footer-button-padding` | `0.5rem 1rem` |
| `--a11y-modal-footer-gap` | `1rem` |
| `--a11y-modal-footer-margin-top` | `1.5rem` |
| `--a11y-modal-initial-scale` | `0.95` |
| `--a11y-modal-overlay-padding` | `clamp(1rem, 10vmin, 6rem)` |
| `--a11y-modal-shadow-blur` | `2px` |
| `--a11y-modal-shadow-fade` | `80%` |
| `--a11y-modal-shadow-offset-y` | `2px` |
| `--a11y-modal-transition-duration` | `0.3s` |

</details>

#### `a11y-notification-banner`

Full-width banners that stay until the user dismisses them (or you call `dismissAll()`). Place one region in the page, or skip it and use `showNotificationBanner()`, which finds or creates one.

```html
<a11y-notification-banner id="banners" max-stack="2"></a11y-notification-banner>
```

```js
import { showNotificationBanner } from 'a11y-elements/overlays/notification-banner';

showNotificationBanner('Your trial ends in 3 days.', {
    type: 'info',
    actionText: 'Upgrade',
    onAction: () => location.assign('/billing'),
});

// e.g. clear them on navigation
window.addEventListener('popstate', () => document.getElementById('banners').dismissAll());
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `max-stack` | attribute | `3` | How many banners show at once; the rest wait in a queue and show as earlier ones are dismissed. |
| `dismiss-label` | attribute | `Dismiss` | Accessible name of each banner's × button. See [Translating built-in strings](#translating-built-in-strings). |
| `maxStack` | property | `3` | Same as `max-stack`. `setMaxStack(n)` is an alias. |
| `show(message, options)` | method | — | Shows a banner (or queues it). |
| `dismissAll()` | method | — | Closes every banner (calling their `onClose`) and drops the queued ones silently. |

It's a page region, not an open/close overlay: it fires no open/close events and `dismissAllOverlays()` leaves it alone. Like every overlay it moves itself to `<body>`; see [Overlays in a framework](#overlays-in-a-framework) for `removeOverlaysWithin()`.

`show()` / `showNotificationBanner()` options:

| Option | Default | Description |
| --- | --- | --- |
| `type` | `info` | `info`, `success` or `error` (`error` uses `role="alert"`). |
| `position` | `top` | `top` or `bottom`. |
| `actionText` / `onAction` | — | Adds an action button; clicking it runs `onAction` and dismisses the banner. |
| `onClose` | — | Called when the banner is dismissed. |
| `maxStack` | — | Sets `max-stack` on the region (sticky for later banners). |

Classes: `.a11y-notification-banner--info` / `--success` / `--error`, `__message`, `__action`, `__close`.

<details>
<summary>CSS variables</summary>

Colors come from the shared `--a11y-color-*` tokens (see [Shared tokens](#shared-tokens)).

| Variable | Default |
| --- | --- |
| `--a11y-notification-banner-actions-gap` | `0.75rem` |
| `--a11y-notification-banner-animation-duration` | `0.3s` |
| `--a11y-notification-banner-close-font-size` | `1.25rem` |
| `--a11y-notification-banner-gap` | `1rem` |
| `--a11y-notification-banner-padding` | `0.75rem 1.5rem` |

</details>

#### `a11y-popover`

Content attached to an anchor, opened from code. With `interactive` it's a `role="dialog"` that traps focus; without it, a `role="region"`. See [Anchored overlays](#anchored-overlays).

```html
<button id="info-btn">Info</button>
<a11y-popover id="info" anchor="info-btn" placement="right" interactive>
    <p>More details, with a <a href="/help">link</a>.</p>
</a11y-popover>
```

```js
document.getElementById('info-btn').addEventListener('click', () => {
    document.getElementById('info').toggleAttribute('open');
});
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `interactive` | attribute | absent | `role="dialog"` and a focus trap. |
| `trap-focus` | attribute | follows `interactive` | Force the focus trap on (`trap-focus`) or off (`trap-focus="false"`). |
| `onClose` | callback | — | Called once it has closed. |

Also takes the shared [anchored-overlay](#anchored-overlays) options: `anchor` / `anchorElement`, `placement`, `offset` and `updatePosition()`. See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-popover-border-radius` | `0.5rem` |
| `--a11y-popover-color-background` | `#ffffff` |
| `--a11y-popover-color-text` | `#111827` |
| `--a11y-popover-content-padding` | `1rem` |
| `--a11y-popover-max-width` | `320px` |
| `--a11y-popover-shadow-blur` | `10px` |
| `--a11y-popover-shadow-fade` | `85%` |
| `--a11y-popover-shadow-offset-y` | `2px` |

</details>

#### `a11y-snackbar`

Toast notifications that dismiss themselves: after 3 s by default, or 10 s when the toast has an action button. The countdown pauses while the toast is hovered or focused. Place one region in the page, or skip it and use `notify()`, which finds or creates one.

```html
<a11y-snackbar max-stack="5"></a11y-snackbar>
```

```js
import { notify } from 'a11y-elements/overlays/snackbar';
import { raw } from 'a11y-elements/core';

notify('Saved');
notify('Upload failed', { type: 'error', actionText: 'Retry', onAction: retryUpload });
notify('Copied to clipboard', { position: 'top', duration: 1500 });
notify(raw('Saved. <a href="/files">View files</a>')); // markup: sanitized, see below
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `max-stack` | attribute | `3` | How many toasts show at once; the rest wait in a queue and show as earlier ones are dismissed. |
| `maxStack` | property | `3` | Same as `max-stack`. `setMaxStack(n)` is an alias. |
| `notify(message, options)` | method | — | Shows a toast (or queues it). |

It's a page region, not an open/close overlay: it fires no open/close events and `dismissAllOverlays()` leaves it alone. Like every overlay it moves itself to `<body>`; see [Overlays in a framework](#overlays-in-a-framework) for `removeOverlaysWithin()`.

A `message` is text: a string is escaped. For markup, pass `raw(markup)` from `a11y-elements/core`. It's sanitized (no scripts, styles, event handlers or `javascript:` URLs), so it's safe with user data in it. `trustedRaw(markup)` skips that, for markup you wrote yourself. The same goes for `<a11y-notification-banner>`.

`notify()` options (method and convenience export):

| Option | Default | Description |
| --- | --- | --- |
| `type` | `info` | `info`, `success`, `warning` or `error` (`error` uses `role="alert"`). |
| `position` | `bottom` | `bottom` or `top`. |
| `duration` | `3000` (`10000` with an action) | Time on screen, in ms, not counting hover/focus. |
| `actionText` / `onAction` | — | Adds an action button; clicking it dismisses the toast and runs `onAction`. |
| `maxStack` | — | Sets `max-stack` on the region (sticky for later toasts). |

Classes: `.a11y-snackbar--info` / `--success` / `--warning` / `--error`.

<details>
<summary>CSS variables</summary>

Colors come from the shared `--a11y-color-*` tokens (see [Shared tokens](#shared-tokens)).

| Variable | Default |
| --- | --- |
| `--a11y-snackbar-animation-duration` | `0.3s` |
| `--a11y-snackbar-border-radius` | `0.5rem` |
| `--a11y-snackbar-container-width` | `350px` |
| `--a11y-snackbar-gap` | `1rem` |
| `--a11y-snackbar-offset` | `1rem` |
| `--a11y-snackbar-padding` | `0.75rem 1.5rem` |
| `--a11y-snackbar-shadow-blur` | `6px` |
| `--a11y-snackbar-shadow-color` | `rgba(0, 0, 0, 0.3)` |
| `--a11y-snackbar-shadow-offset-y` | `2px` |
| `--a11y-snackbar-stack-gap` | `0.5rem` |

</details>

#### `a11y-tooltip`

A short description shown on hover or focus of its anchor, which gets `aria-describedby`. It stays open while the pointer is over it, and Escape hides it. Never traps focus. See [Anchored overlays](#anchored-overlays).

```html
<button id="save-btn">Save</button>
<a11y-tooltip anchor="save-btn" placement="top" show-delay="500">Saves your changes</a11y-tooltip>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `show-delay` | attribute / property (read-only) | `300` | Delay before showing, in ms. |
| `hide-delay` | attribute / property (read-only) | `100` | Delay before hiding once pointer/focus leaves, in ms. |
| `dispose()` | method | — | Detaches from the anchor for good (`close()` only hides it). |

Also takes the shared [anchored-overlay](#anchored-overlays) options: `anchor` / `anchorElement`, `placement`, `offset` and `updatePosition()`. See [Common to all overlays](#common-to-all-overlays) for `open`, `show()` / `close()`, the open/close events and `dismissAllOverlays()`.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-tooltip-border-radius` | `0.35rem` |
| `--a11y-tooltip-color-background` | `#ffffff` |
| `--a11y-tooltip-color-text` | `#111827` |
| `--a11y-tooltip-content-padding` | `0.35rem 0.6rem` |
| `--a11y-tooltip-font-size` | `0.85rem` |
| `--a11y-tooltip-max-width` | `240px` |

</details>

### Shared tokens

Status colors and the z-index scale, defined on `:root` (in `overlays/core/overlay-variables.css`). Override them globally, or override a component's own token instead.

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-color-success` | `rgb(76 175 80)` |
| `--a11y-color-error` | `rgb(244 67 54)` |
| `--a11y-color-info` | `rgb(33 150 243)` |
| `--a11y-color-warning` | `rgb(244 67 54)` |
| `--a11y-color-text` | `white` |
| `--a11y-z-base` | `0` |
| `--a11y-z-sticky-header` | `100` |
| `--a11y-z-sticky-footer` | `110` |
| `--a11y-z-floating-button` | `120` |
| `--a11y-z-sidebar` | `200` |
| `--a11y-z-mobile-nav` | `210` |
| `--a11y-z-dropdown` | `300` |
| `--a11y-z-popover` | `310` |
| `--a11y-z-tooltip` | `320` |
| `--a11y-z-context-menu` | `330` |
| `--a11y-z-snackbar` | `400` |
| `--a11y-z-toast` | `410` |
| `--a11y-z-notification-banner` | `420` |
| `--a11y-z-modal-backdrop` | `500` |
| `--a11y-z-modal` | `510` |
| `--a11y-z-drawer-backdrop` | `520` |
| `--a11y-z-drawer` | `530` |
| `--a11y-z-fullscreen-overlay` | `540` |
| `--a11y-z-blocking-loader` | `600` |
| `--a11y-z-emergency-dialog` | `610` |
| `--a11y-z-debug-panel` | `700` |
| `--a11y-z-inspector` | `710` |

</details>

## Customizing styles

### Important: default styles are never auto-injected

The `<link>`/CSS-import lines above are a required, one-time step. If you skip it, elements will still have the proper `class` attribute, but no styles will be injected.

This is intentional, not an oversight: Light DOM means you're meant to style real markup with your own CSS, and auto-injecting a stylesheet would take away control over cascade order and whether the defaults load at all.

Every visual value — color, size, spacing, radius, timing — is a plain CSS custom property named `--a11y-<component>-<token>`, with the shipped look as its fallback:

```css
/* from checkbox.css */
.a11y-checkbox__input {
    border-radius: var(--a11y-checkbox-border-radius, 2px);
    background-color: var(--a11y-checkbox-color-primary, #2563eb);
}
```

That means customizing is just CSS — no Sass, no build step, no dependency on this package's own tooling.

Every class this library adds is prefixed `a11y-` (e.g. `.a11y-modal-wrapper`, `.a11y-checkbox__input`, `html.a11y-no-scroll`), so it won't collide with your own class names. The shipped styles respect `prefers-reduced-motion`.

### Retheme globally

Override at `:root` (or `body`) and every instance of that component on the page picks it up:

```css
:root {
    --a11y-checkbox-color-primary: #16a34a;
}
```

### Scope to one instance

The same custom properties follow ordinary CSS cascade/inheritance, so you can target just one element instead. Two equivalent ways to do it:

```html
<!-- (a) inline style directly on the element you want to change -->
<a11y-spinner style="--a11y-spinner-color: #2563eb; --a11y-spinner-border-radius: 0;"></a11y-spinner>

<!-- (b) a scoped class + an ordinary page-authored rule -->
<a11y-spinner class="theme-danger"></a11y-spinner>
<style>
    .theme-danger {
        --a11y-spinner-color: #dc2626;
        --a11y-spinner-border-radius: 50%;
    }
</style>
```

Either way, only that element changes — every other `<a11y-spinner>` on the page keeps its default (or globally-rethemed) look.

Attributes that map to a custom property (`<a11y-spinner color="…" size="…">`, `<a11y-avatar size="…">`, `<a11y-skeleton width="…" height="…">`) take precedence over your inline value only while they're set; removing the attribute brings your inline value back.

The full list of tokens, with their defaults, is in the shipped `dist/a11y.css` — search it for `--a11y-<component>-`.

## License

MIT — see [`LICENSE.txt`](./LICENSE.txt).
