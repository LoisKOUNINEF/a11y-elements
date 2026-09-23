# a11y-elements

Framework-agnostic accessibility Custom Elements (Web Components) — a behavior layer, not a themed UI kit. 

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
* See the examples below.

### Example: a form component with a change handler

```html
<a11y-checkbox id="terms" label="Accept terms">
    <input type="checkbox" name="terms">
</a11y-checkbox>
```

```ts
import 'a11y-elements/accessibility-components/checkbox';
import type { CheckboxElement } from 'a11y-elements/accessibility-components/checkbox/element';

const checkbox = document.getElementById('terms') as CheckboxElement;
checkbox.onChange = (checked) => console.log('accepted:', checked);
```

Importing a component's subpath also adds its tag to TypeScript's `HTMLElementTagNameMap`, so exact-tag lookups such as `document.createElement('a11y-checkbox')` or `document.querySelector('a11y-checkbox')` come back typed as `CheckboxElement` without a cast.

### Example: an overlay

```html
<button id="open-settings">Open settings</button>
<a11y-modal id="settings">
    <h2>Settings</h2>
    <p>Press Escape, click the backdrop, or the close button to dismiss.</p>
</a11y-modal>
```

```js
import 'a11y-elements/overlays/modal';

document.getElementById('open-settings').addEventListener('click', () => {
    document.getElementById('settings').open = true;
});
```

The dialog is named after its first heading (`aria-labelledby`). Without a heading, give it a name with `dialog-label="Settings"` (becomes `aria-label`).

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

The full list of tokens, with their defaults, is in the shipped `dist/a11y.css` — search it for `--a11y-<component>-`.

## License

MIT — see [`LICENSE.txt`](./LICENSE.txt).
