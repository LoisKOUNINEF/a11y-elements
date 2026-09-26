# Upcoming

Issues found while building the Nutin website's a11y-elements demo pages (`apps/website`, `/a11y`), against `a11y-elements@0.1.0` loaded through the zero-build CDN bundles.

## Integration pitfalls (worth documenting, or fixing)

### Portaled overlays outlive their host

Every overlay moves itself to `document.body` on connect, even while closed, and the passive regions (snackbar, notification banner) do the same. When a host framework later removes the subtree the overlay was authored in (SPA navigation, a component unmount), the overlay isn't in that subtree any more, so it stays in `<body>` for good. A later visit then adds a second copy with the same `id`. The Nutin demo works around this by keeping references to its overlays and calling `.remove()` on each when its component is destroyed; that works, and `disconnectedCallback` tears down cleanly. The README should say explicitly that consumers own that removal, or the library could offer a helper to scope overlays to a host.

### Upgrade timing vs. a host framework's hydration

Once a bundle is defined, assigning `innerHTML` that contains an overlay upgrades it synchronously, and it portals to `<body>` during that same assignment. A framework that hydrates the markup it just injected (translating `data-*` attributes, binding event handlers with `host.querySelectorAll(...)`) won't find anything inside the overlay, because the overlay is no longer under the host. On a first visit, when the bundle loads after render, it does find them. So the behavior depends on load order. The demo avoids it by interpolating overlay text directly and using event delegation on the overlay elements. Worth a note in the README next to the body-mounting explanation.

### Setting `.open` before the element is upgraded

`el.open = true` on a not-yet-upgraded element creates an own property that shadows the class accessor after upgrade, so the overlay never opens. It's standard custom-element behavior, but lazy-loaded bundles (the zero-build CDN path) make it likely. Recommend `el.setAttribute('open', '')` / `toggleAttribute('open')` in the docs, since those work before and after upgrade. Alternatively, the base class could pick up a pre-upgrade `open` property in `connectedCallback` (the usual `_upgradeProperty` pattern).
