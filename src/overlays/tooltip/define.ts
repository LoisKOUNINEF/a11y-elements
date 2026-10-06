import { defineElement } from '../../core/define-element.js';
import { TooltipElement } from './tooltip.element.js';

defineElement('a11y-tooltip', TooltipElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-tooltip': TooltipElement;
  }
}

export { TooltipElement };
export * from '../core/zero-build-exports.js';
