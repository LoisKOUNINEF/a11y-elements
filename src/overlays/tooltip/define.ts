import { TooltipElement } from './tooltip.element.js';

if (!customElements.get('a11y-tooltip')) {
  customElements.define('a11y-tooltip', TooltipElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-tooltip': TooltipElement;
  }
}

export { TooltipElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
export { dismissAllOverlays, removeOverlaysWithin } from '../../core/overlay-registry.js';
