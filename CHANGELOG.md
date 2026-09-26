# Changelog

## Unreleased

### Changes

- `<a11y-snackbar>` and `<a11y-notification-banner>` now stack up to 3 items at once by default (was 1); further items are queued and shown as earlier ones are dismissed. The limit is set with the new `max-stack` attribute or `maxStack` property, or with the `maxStack` option, which `notify()` already took and the banner's `show()` now takes too. Raising the limit shows queued items right away. Set `max-stack="1"` to get the previous one-at-a-time behavior back.

### Fixes

- Inline CSS custom properties set on an element (e.g. `<a11y-spinner style="--a11y-spinner-color: …">`) are no longer removed when the matching attribute is absent. An attribute such as `color`/`size` now overrides the inline value only while it is set, and removing it restores the inline value. This affects `<a11y-spinner>` (`size`, `color`, `duration`, `thickness`), `<a11y-avatar>` (`size`) and `<a11y-skeleton>` (`width`, `height`).
- Focus-trapped overlays (`<a11y-modal>`, `<a11y-drawer>`, `<a11y-emergency-dialog>`, and `<a11y-popover>` when it traps focus via `interactive` or `trap-focus`) now close on Escape after a click on non-focusable content inside them. That click moved focus to `<body>`, out of reach of the trap's key handling, which also let Tab move focus out of the trap. With several traps open, only the topmost one handles a key press.
