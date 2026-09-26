# Upcoming

Issues found while building the Nutin website's a11y-elements demo pages (`apps/website`, `/a11y`), against `a11y-elements@0.1.0` loaded through the zero-build CDN bundles.

## Bugs

### `<a11y-avatar>`: initials show next to the image

With both `src` and `initials` set, `render()` outputs the `<img>` **and** a `.a11y-avatar__fallback` span. `avatar.css` has no rule that hides or overlays that span, so inside the `inline-flex` host the image and the initials render side by side, each squeezed into half the circle.

```html
<a11y-avatar alt="Jane Doe" src="jane.jpg" initials="JD"></a11y-avatar>
```

The fallback only needs to be visible after the image fails, and on failure the element already re-renders to `.a11y-avatar__initials`. So either drop the span from the image branch, or hide it (`.a11y-avatar__img + .a11y-avatar__fallback { display: none }`, or position it under the image).

### `<a11y-anchor>`: the announcement reads the target's entire content

`_activateInternalAnchor()` announces `` `Navigated to ${target?.textContent || id}` ``. When the target is a section (the usual case for a jump link), the live region reads out the whole section, including every paragraph and control label, instead of its name. Prefer the target's accessible name: `aria-label`, then `aria-labelledby`, then its first heading's text, then `id`.

### `<a11y-anchor>`: removes the consumer's own `tabindex` from the target

The target gets `tabindex="-1"` so it can take focus, and a one-time `blur` listener then calls `removeAttribute('tabindex')` unconditionally. If the consumer had already set a `tabindex` on the target (e.g. `<section id="x" tabindex="-1">`), it's removed after the first jump. Record whether the attribute was present (and its value) before setting it, and restore that on blur.

### `<a11y-anchor>`: the smooth scroll ignores `prefers-reduced-motion`

`scrollIntoView({ behavior: 'smooth' })` is hard-coded. The README says the shipped styles respect `prefers-reduced-motion`, but that only covers the CSS; this JS scroll animates regardless. Use `behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'`.

## Hard-coded English strings

These strings end up in accessible names or announcements, and there's no attribute or option to translate them:

- `anchor.element.ts`: `NEW_TAB_SUFFIX = '(opens in new tab)'` and `` `Navigated to ${…}` ``
- `a11y-modal-overlay-element.ts`: the close button's `aria-label="Close dialog"`
- `spinner.element.ts` / `blocking-loader.element.ts`: the default `label` / `message` `'Loading'` (these can be overridden per instance, so they're less urgent)

## Integration pitfalls (worth documenting, or fixing)

### Portaled overlays outlive their host

Every overlay moves itself to `document.body` on connect, even while closed, and the passive regions (snackbar, notification banner) do the same. When a host framework later removes the subtree the overlay was authored in (SPA navigation, a component unmount), the overlay isn't in that subtree any more, so it stays in `<body>` for good. A later visit then adds a second copy with the same `id`. The Nutin demo works around this by keeping references to its overlays and calling `.remove()` on each when its component is destroyed; that works, and `disconnectedCallback` tears down cleanly. The README should say explicitly that consumers own that removal, or the library could offer a helper to scope overlays to a host.

### Upgrade timing vs. a host framework's hydration

Once a bundle is defined, assigning `innerHTML` that contains an overlay upgrades it synchronously, and it portals to `<body>` during that same assignment. A framework that hydrates the markup it just injected (translating `data-*` attributes, binding event handlers with `host.querySelectorAll(...)`) won't find anything inside the overlay, because the overlay is no longer under the host. On a first visit, when the bundle loads after render, it does find them. So the behavior depends on load order. The demo avoids it by interpolating overlay text directly and using event delegation on the overlay elements. Worth a note in the README next to the body-mounting explanation.

### Setting `.open` before the element is upgraded

`el.open = true` on a not-yet-upgraded element creates an own property that shadows the class accessor after upgrade, so the overlay never opens. It's standard custom-element behavior, but lazy-loaded bundles (the zero-build CDN path) make it likely. Recommend `el.setAttribute('open', '')` / `toggleAttribute('open')` in the docs, since those work before and after upgrade. Alternatively, the base class could pick up a pre-upgrade `open` property in `connectedCallback` (the usual `_upgradeProperty` pattern).
