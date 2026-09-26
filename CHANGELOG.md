# Changelog

## Unreleased

### Changes

- Built-in strings can now be translated: the new-tab suffix and jump announcement of `<a11y-anchor>`, the close button of dialogs, the dismiss button of `<a11y-notification-banner>`, and the `Loading` / `Progress` / `Avatar` fallback names. `setStrings()` (and `resetStrings()`), exported from `a11y-elements/core` and from every zero-build `define.js`, replaces them page-wide, and elements already on the page update right away. The new `new-tab-label` and `navigated-label` (`<a11y-anchor>`), `close-label` (`<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`) and `dismiss-label` (`<a11y-notification-banner>`) attributes override them for one element.
- `<a11y-snackbar>` and `<a11y-notification-banner>` now stack up to 3 items at once by default (was 1); further items are queued and shown as earlier ones are dismissed. The limit is set with the new `max-stack` attribute or `maxStack` property, or with the `maxStack` option, which `notify()` already took and the banner's `show()` now takes too. Raising the limit shows queued items right away. Set `max-stack="1"` to get the previous one-at-a-time behavior back.

### Fixes

- `<a11y-avatar>` no longer shows the initials next to the image when both `src` and `initials` are set. The image renders alone, and the initials appear only if it fails to load.
- `<a11y-anchor>` now announces a same-page jump by the target's name (its `aria-label`, `aria-labelledby`, its own or first heading's text, then its `id`) instead of reading out the target's entire content.
- `<a11y-anchor>` no longer removes a `tabindex` the target already had. The temporary `tabindex="-1"` is replaced by the original value on blur.
- `<a11y-anchor>` scrolls instantly instead of smoothly when the user prefers reduced motion.
- Inline CSS custom properties set on an element (e.g. `<a11y-spinner style="--a11y-spinner-color: …">`) are no longer removed when the matching attribute is absent. An attribute such as `color`/`size` now overrides the inline value only while it is set, and removing it restores the inline value. This affects `<a11y-spinner>` (`size`, `color`, `duration`, `thickness`), `<a11y-avatar>` (`size`) and `<a11y-skeleton>` (`width`, `height`).
- Focus-trapped overlays (`<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`, and `<a11y-popover>` when it traps focus via `interactive` or `trap-focus`) now close on Escape after a click on non-focusable content inside them. That click moved focus to `<body>`, out of reach of the trap's key handling, which also let Tab move focus out of the trap. With several traps open, only the topmost one handles a key press.
