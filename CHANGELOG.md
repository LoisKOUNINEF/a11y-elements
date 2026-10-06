# Changelog

## 0.4.0

### Breaking changes

- The zero-build bundles in `dist/browser/` are no longer self-contained. Their common code (core) now lives in shared `chunk-*.js` files next to them, so a page loading several elements fetches it once (all browser JS drops from about 680 KB to about 180 KB). Each `define.js` keeps its URL and exports, but a `define.js` copied on its own no longer loads: serve the `dist/browser/` folder as is.

- `html` only trusts values made by `html`, `raw()`, `trustedRaw()`, `attr()` and `flag()`. A plain object with an `__html` key (e.g. parsed JSON passed as a snackbar or banner `message`) used to be inserted unescaped; it is now escaped like any other value. Wrap markup in `raw()` instead of a hand-made `{ __html }` object.

- `raw()` is sanitized. `<script>`, `<style>`, `<link>`, `<base>` and `<meta>`, event handler attributes (`onclick`, …), `srcdoc`, `javascript:` URLs (also written `java&#9;script:`), `data:` URLs in frames and SVG `<animate>`/`<set>` targeting a URL attribute are removed. Markup is parsed once and inserted as nodes, so the cleaned result is never parsed again (mutation XSS). Use the new `trustedRaw()` for the old, unsanitized behavior, and only for markup you wrote yourself.

- A value in tag position (`` html`<input ${x}>` ``) keeps only its safe attributes. Escaping left `onfocus=alert(1) autofocus` intact, so it added attributes. Use `attr()`/`flag()` there as before.

- `raw()` in an attribute value (`title="${raw(x)}"`) is escaped, so it can't close the quote.

### Changes

- New all-in-one entry: `import 'a11y-elements/all'`, or `dist/browser/all.js` without a build step, registers every element and re-exports every element class and helper.

- New `defineElement(tag, ctor)` in `a11y-elements/core`: registers a custom element unless the tag is already taken. Every built-in `define` entry uses it.

- The `<a11y-snackbar>` and `<a11y-notification-banner>` entries also export `dismissAllOverlays()`, like the other overlays.

- New `<a11y-floating>` overlay, pinned to a corner or edge of the viewport and visible by default. With `controls="<id>"` its button opens and closes another overlay (a drawer, modal, popover…) and keeps `aria-controls`, `aria-expanded` and `aria-haspopup` on the button. With `expandable` it's a launcher that expands its own non-modal panel. It also takes `dismissible`, `hide-on-scroll` (it stays focusable and comes back when focused) and `announce`. Several in one corner stack, offsets include the safe-area inset, and `dismissAllOverlays()` only collapses its panel.

- New `<a11y-card-link>` for cards that go to another page: one real `<a href>` inside stays the only tab stop and gives the card its name, and clicks on the rest of the card are forwarded to it. Cmd/Ctrl/Shift-click and middle-click open it in a new tab; clicks on other controls and text selection are left alone. Add `describe` to read a `data-card-description` element after the title. Use it instead of `<a11y-focusable>` for navigation cards, which announced them as buttons.

- `html` quotes unquoted attribute values: `` html`<div title=${x}>` `` renders `title="…"`, and inside a value already started (`class=a${x}`) whitespace, quotes and `=<>` are encoded, so a value can't add attributes.

- `<a11y-focusable>` and `<a11y-visually-hidden>` leave your content in place when they update, instead of setting it back through `innerHTML`. That second parse could turn sanitized markup live again (mutation XSS), and it dropped listeners and state on your children. `A11yElement.render()` can return `null` for the same behavior in subclasses.

- `A11yElement` and the snackbar, banner and blocking loader render through the new `renderInto(el, markup)` (`el.replaceChildren(toFragment(markup))`) instead of `innerHTML = String(markup)`. A `render()` returning a plain string still renders it as trusted markup. `String()`/`__html` of an `html` result still work, with `raw()` parts sanitized as strings; prefer `renderInto()`, which doesn't parse them twice.

- `notify()`, `showNotificationBanner()` and the elements' `notify()`/`show()` accept an `html`/`raw()` value as `message` in their types (they already rendered it).

- `html` caches where each `${}` lands per call site, and escapes in a single pass, so re-renders do less work.

- `formatString()` placeholders and `setStrings()` keys only match own keys: `{constructor}` stays as is, and `setStrings({ constructor: … })` is ignored.

## 0.3.0

### Changes

- New `<a11y-checkbox-group>`: a `<fieldset>` and `<legend>` around your checkboxes, the multi-select counterpart of `<a11y-radio-group>`.

Add `select-all` for a "Select all" checkbox that's checked, partly checked or unchecked to match the options, and checks or unchecks every enabled one. Its text can be translated with `select-all-label` or `setStrings({ selectAll })`.

- New `<a11y-file-input>`: a file picker around a real `<input type="file">`, with the same `<a11y-label>`, `<a11y-hint>` and `<a11y-error>` parts as `<a11y-input>`.

Files can be browsed for or dropped onto it, and are listed with a "Remove" button each. With `multiple`, picking again adds to the selection. `accept` (also on drop), `max-size` and `max-files` keep files out, and the ones left out are listed and announced. The selection is written back to the input, which submits it with the form. Optional image previews with `previews`.

Its strings can be translated with `setStrings()` (`browseFiles`, `dropFiles`, `remove`, `removeFile`, `fileAdded`, …).

- `<a11y-picture>` can build its `<picture>` for you: give it a `src` (the fallback) and `sources` (`"s.avif image/avif, s.webp image/webp"`) and the browser uses the first format it supports. `alt`, `caption`, `width`, `height`, `loading` and `sizes` are attributes too. From JavaScript, set `image = { sources, fallback, alt }` at once, or `sources` as `{ src, type, media, sizes }` objects for srcset descriptors and art direction. Pictures you write yourself work as before.

- `A11yFieldElement` takes a value type (`A11yFieldElement<V = string>`), with `readValue()` / `writeValue()` for subclasses whose value isn't the control's string.

## 0.2.0

### Breaking changes

- The `accessibility-components` folder is renamed to `components`. 

Update imports from `a11y-elements/accessibility-components/<name>` (and `/element`) to `a11y-elements/components/<name>`, and zero-build scripts from `dist/browser/accessibility-components/<name>/define.js` to `dist/browser/components/<name>/define.js`.

### Changes

- New `<a11y-input>`, `<a11y-textarea>` and `<a11y-label>`.

A field wraps a real `<input>` or `<textarea>` with optional `<a11y-label>`, `<a11y-hint>`, `<a11y-error>` and `<a11y-counter>` parts, and links them: the label with `for`, hints and the error with `aria-describedby`, and `aria-invalid` while an error is shown.

Errors show once a field is left after an edit, or when a submit attempt finds it invalid, then update as the user types. With an `<a11y-error>`, the message replaces the browser's bubble and the first invalid field is focused.

Native constraints do the validating. Custom `validators` and per-constraint messages (`value-missing-message`, `too-short-message`, …) come on top. The native control still submits the value; the host is form-associated and mirrors its validity, with `:state(user-invalid)`, `:state(touched)` and `:state(dirty)` for styling.

`<a11y-counter>` shows the length against `maxlength` and announces the characters left near the limit. Its strings can be translated with `setStrings()` (`characterCount`, `charactersRemaining`, `characterRemaining`).

- New `bindField()`, exported from `a11y-elements/core`: the same wiring and validation on your own markup, e.g. from a framework component.

- New `removeOverlaysWithin(host)`, exported from `a11y-elements/core` and from every overlay's `define.js`. 

Overlays move themselves to `<body>`, so they outlived the subtree they were authored in when a framework removed it. Call it on unmount to remove the overlays authored inside `host`.

- Built-in strings can now be translated: 

The new-tab suffix and jump announcement of `<a11y-anchor>`, the close button of dialogs, the dismiss button of `<a11y-notification-banner>`, and the `Loading` / `Progress` / `Avatar` fallback names. 

`setStrings()` (and `resetStrings()`), exported from `a11y-elements/core` and from every zero-build `define.js`, replaces them page-wide, and elements already on the page update right away. 

The new `new-tab-label` and `navigated-label` (`<a11y-anchor>`), `close-label` (`<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`) and `dismiss-label` (`<a11y-notification-banner>`) attributes override them for one element.

- `<a11y-snackbar>` and `<a11y-notification-banner>` now stack up to 3 items at once by default (was 1).

Further items are queued and shown as earlier ones are dismissed. 

The limit is set with the new `max-stack` attribute or `maxStack` property, or with the `maxStack` option, which snackbar's `notify()`  and banner's `show()` take. 

### Fixes

- Overlays opened by clicking their trigger now return focus to it when they close in Safari (and Firefox on macOS). 

Those browsers don't focus a clicked button, so focus used to fall back to `<body>`. 

This affects `<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`, `<a11y-popover>` when it traps focus, `<a11y-dropdown>`, `<a11y-context-menu>` and `<a11y-blocking-loader>`.

- Focus traps no longer stop on a button, link or other control with a negative `tabindex`, and now include `<summary>`, `contenteditable` elements, `iframe` and media elements with controls.

- Properties set on an element before its bundle defines it are no longer lost. `open` and other accessors used to be shadowed, and `onClose` / `onChange` callbacks were reset to `undefined` on upgrade.

- `<a11y-avatar>` no longer shows the initials next to the image when both `src` and `initials` are set. The image renders alone, and the initials appear only if it fails to load.

- `<a11y-anchor>` now announces a same-page jump by the target's name (its `aria-label`, `aria-labelledby`, its own or first heading's text, then its `id`) instead of reading out the target's entire content.

- `<a11y-anchor>` no longer removes a `tabindex` the target already had. The temporary `tabindex="-1"` is replaced by the original value on blur.

- `<a11y-anchor>` scrolls instantly instead of smoothly when the user prefers reduced motion.

- Inline CSS custom properties set on an element (e.g. `<a11y-spinner style="--a11y-spinner-color: …">`) are no longer removed when the matching attribute is absent.

An attribute such as `color`/`size` now overrides the inline value only while it is set, and removing it restores the inline value. 

This affects `<a11y-spinner>` (`size`, `color`, `duration`, `thickness`), `<a11y-avatar>` (`size`) and `<a11y-skeleton>` (`width`, `height`).

- Focus-trapped overlays (`<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`) now close on Escape after a click on non-focusable content inside them. 

That click moved focus to `<body>`, out of reach of the trap's key handling, which also let Tab move focus out of the trap.
