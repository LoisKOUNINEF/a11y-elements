# a11y-elements

Framework-agnostic accessibility Custom Elements (Web Components). A behavior layer, not a themed UI kit. 

Every element is Light DOM only (no Shadow DOM), so you always style real markup with your own CSS.

## Usage

### Zero-build 

Load a component's standalone browser bundle directly, no bundler required:

```html
<link rel="stylesheet" href="node_modules/a11y-elements/dist/a11y.css" />
<script type="module" src="node_modules/a11y-elements/dist/browser/accessibility-components/spinner/define.js"></script>

<a11y-spinner></a11y-spinner>
```

* Each component has its own `define.js` under `dist/browser/**`. 
* Every bundle is self-contained, so load only the ones you use.
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
import 'a11y-elements/accessibility-components/checkbox';
import 'a11y-elements/overlays/modal';
import { A11yElement } from 'a11y-elements/core';
```

* There's no default export: `import 'a11y-elements'` alone will fail. 
* Import the component you want: `/element` gets you the class itself when you need it
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
| `closeDialog` | `Close dialog` | the × button of `<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>` | `close-label` |
| `dismiss` | `Dismiss` | the × button of each `<a11y-notification-banner>` item | `dismiss-label` |
| `loading` | `Loading` | `<a11y-spinner>`, `<a11y-blocking-loader>` | `label` / `message` |
| `progress` | `Progress` | `<a11y-progress>` without a label | `label` / `aria-label` |
| `avatar` | `Avatar` | `<a11y-avatar>` with no `alt` or `initials` | `alt` / `initials` |

* An instance attribute wins over `setStrings()`, which wins over the default. Keys you leave out keep their current value.
* Elements already on the page update right away, so calling it again on a language switch is enough.
* `resetStrings()` restores the English defaults.

## Elements

Each section shows an example, the element's own attributes/properties/methods, and its CSS variables (collapsed). Behavior shared by a family of elements is described once, in [Common to all overlays](#common-to-all-overlays).

**Accessibility components:** [`<a11y-anchor>`](#a11y-anchor) · [`<a11y-avatar>`](#a11y-avatar) · [`<a11y-checkbox>`](#a11y-checkbox) · [`<a11y-focusable>`](#a11y-focusable) · [`<a11y-picture>`](#a11y-picture) · [`<a11y-progress>`](#a11y-progress) · [`<a11y-radio-group>`](#a11y-radio-group) · [`<a11y-select>`](#a11y-select) · [`<a11y-skeleton>`](#a11y-skeleton) · [`<a11y-spinner>`](#a11y-spinner) · [`<a11y-switch>`](#a11y-switch) · [`<a11y-visually-hidden>`](#a11y-visually-hidden)

**Overlays:** [`<a11y-blocking-loader>`](#a11y-blocking-loader) · [`<a11y-context-menu>`](#a11y-context-menu) · [`<a11y-drawer>`](#a11y-drawer) · [`<a11y-dropdown>`](#a11y-dropdown) · [`<a11y-emergency-dialog>`](#a11y-emergency-dialog) · [`<a11y-modal>`](#a11y-modal) · [`<a11y-notification-banner>`](#a11y-notification-banner) · [`<a11y-popover>`](#a11y-popover) · [`<a11y-snackbar>`](#a11y-snackbar) · [`<a11y-tooltip>`](#a11y-tooltip)

Import paths follow the folder names: `a11y-elements/accessibility-components/<name>` or `a11y-elements/overlays/<name>` (add `/element` for the class), and `dist/browser/<group>/<name>/define.js` for zero-build.

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

#### `a11y-checkbox`

Wraps a real `<input type="checkbox">` in a `<label>` with a visible label text. The input stays yours: `name`, `checked`, `disabled`, `required` are plain HTML attributes on it.

```html
<a11y-checkbox id="terms" label="Accept terms">
    <input type="checkbox" name="terms" required>
</a11y-checkbox>
```

```ts
import 'a11y-elements/accessibility-components/checkbox';
import type { CheckboxElement } from 'a11y-elements/accessibility-components/checkbox/element';

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

#### `a11y-focusable`

Makes a non-button element behave like a button: `role="button"`, `tabindex="0"`, and Enter/Space fire a real `click`, so one `click` listener covers mouse and keyboard. Prefer a real `<button>` whenever you can.

```html
<a11y-focusable aria-label="Expand menu">
    <svg aria-hidden="true">…</svg> Menu
</a11y-focusable>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `aria-label` | attribute | — | Accessible name. Without it (or visible text), a console warning is logged. |

No CSS variables.

#### `a11y-picture`

Wraps a real `<picture>`/`<img>` and optional `<figcaption>` as `role="figure"`. An image with `alt=""` and no caption is treated as decorative and hidden from assistive tech (`aria-hidden="true"`).

```html
<a11y-picture>
    <picture>
        <source srcset="hero.webp" type="image/webp">
        <img src="hero.jpg" alt="Sunset over the Rockies" loading="lazy" decoding="async">
    </picture>
    <figcaption>Sunset over the Rockies</figcaption>
</a11y-picture>
```

No attributes of its own.

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
* **Before the element is defined** (lazy-loaded bundles), use `setAttribute('open', '')` rather than `.open = true`: a property set before upgrade hides the element's own accessor.
* **Events:** `a11y-overlay-open` and `a11y-overlay-close` fire on `document`, with `event.detail.name` set to the tag name.
* **`dismissAllOverlays()`** closes every open overlay (e.g. on navigation). It's exported from `a11y-elements/core` and from every overlay's `define.js`.
* **Body mounting:** every overlay moves itself to `<body>` when connected, so a `position: fixed` layer isn't clipped by an ancestor. If your framework removes the subtree it was authored in, remove the overlay yourself too.

**Dialogs** (`<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`) also share:

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

**Anchored overlays** (`<a11y-popover>`, `<a11y-tooltip>`, `<a11y-dropdown>`, `<a11y-context-menu>`) are positioned next to an anchor. They flip to the opposite side when there isn't room, and close on a click outside or Escape.

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `anchor` | attribute | — | `id` of the anchor element. |
| `anchorElement` | property | — | The anchor element itself (takes precedence over `anchor`). |
| `placement` | attribute | `bottom` | `top`, `bottom`, `left` or `right`, optionally with `-start` / `-end` (e.g. `bottom-start`). |
| `offset` | attribute | `8` | Gap to the anchor, in px. |
| `updatePosition()` | method | — | Recomputes the position (it already follows scroll, resize and size changes). |

**Menus** (`<a11y-dropdown>`, `<a11y-context-menu>`): items are your own children with `role="menuitem"`. Arrow keys, Home and End move between them, and Enter/Space fire a real `click`. The menu closes after an item is clicked or when focus leaves it. Mark an item `aria-disabled="true"` to skip it.

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

A menu that opens at the pointer on right-click of a trigger element, replacing the browser's own menu there. See [Menus](#common-to-all-overlays).

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

A panel that slides in from a screen edge. Behaves like `<a11y-modal>` (see [Dialogs](#common-to-all-overlays)).

```html
<a11y-drawer id="filters" edge="left">
    <h2>Filters</h2>
    …
</a11y-drawer>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `edge` | attribute / property (read-only) | `right` | `left`, `right`, `top` or `bottom`. Read when the drawer opens. |

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

A menu attached to a trigger button. The anchor is the trigger: clicking it toggles the menu, and it gets `aria-haspopup`, `aria-controls` and `aria-expanded`. See [Anchored overlays and Menus](#common-to-all-overlays).

```html
<button id="actions-btn">Actions</button>
<a11y-dropdown anchor="actions-btn" placement="bottom-start">
    <div role="menuitem">Edit</div>
    <div role="menuitem" aria-disabled="true">Share</div>
    <div role="menuitem">Delete</div>
</a11y-dropdown>
```

No attributes of its own beyond the anchored ones.

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

Only `onClose` from the [Dialogs](#common-to-all-overlays) table applies. It uses the modal's CSS variables, plus:

<details>
<summary>CSS variables</summary>

| Variable | Default |
| --- | --- |
| `--a11y-emergency-dialog-accent-width` | `4px` |

</details>

#### `a11y-modal`

A centered dialog. Your content is its children. See [Dialogs](#common-to-all-overlays).

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

Content attached to an anchor, opened from code. With `interactive` it's a `role="dialog"` that traps focus; without it, a `role="region"`. See [Anchored overlays](#common-to-all-overlays).

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

notify('Saved');
notify('Upload failed', { type: 'error', actionText: 'Retry', onAction: retryUpload });
notify('Copied to clipboard', { position: 'top', duration: 1500 });
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `max-stack` | attribute | `3` | How many toasts show at once; the rest wait in a queue and show as earlier ones are dismissed. |
| `maxStack` | property | `3` | Same as `max-stack`. `setMaxStack(n)` is an alias. |
| `notify(message, options)` | method | — | Shows a toast (or queues it). |

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

A short description shown on hover or focus of its anchor, which gets `aria-describedby`. It stays open while the pointer is over it, and Escape hides it. Never traps focus. See [Anchored overlays](#common-to-all-overlays).

```html
<button id="save-btn">Save</button>
<a11y-tooltip anchor="save-btn" placement="top" show-delay="500">Saves your changes</a11y-tooltip>
```

| Name | Kind | Default | Description |
| --- | --- | --- | --- |
| `show-delay` | attribute / property (read-only) | `300` | Delay before showing, in ms. |
| `hide-delay` | attribute / property (read-only) | `100` | Delay before hiding once pointer/focus leaves, in ms. |
| `dispose()` | method | — | Detaches from the anchor for good (`close()` only hides it). |

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
