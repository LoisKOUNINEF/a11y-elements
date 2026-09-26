import { ProgressElement } from './progress.element.js';

if (!customElements.get('a11y-progress')) {
  customElements.define('a11y-progress', ProgressElement);
}

declare global {
  interface HTMLElementTagNameMap {
    'a11y-progress': ProgressElement;
  }
}

export { ProgressElement };
// Re-exported so zero-build `<script type="module">` users can reach them too.
export { resetStrings, setStrings } from '../../core/strings.js';
