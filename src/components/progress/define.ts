import { defineElement } from '../../core/define-element.js';
import { ProgressElement } from './progress.element.js';

defineElement('a11y-progress', ProgressElement);

declare global {
  interface HTMLElementTagNameMap {
    'a11y-progress': ProgressElement;
  }
}

export { ProgressElement };
export * from '../../core/zero-build-exports.js';
