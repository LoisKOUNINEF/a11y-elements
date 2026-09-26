# Changelog

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
