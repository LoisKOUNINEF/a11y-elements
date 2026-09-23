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
// Re-exported so zero-build `<script type="module">` users can reach it too.
export { dismissAllOverlays } from '../../core/overlay-registry.js';
