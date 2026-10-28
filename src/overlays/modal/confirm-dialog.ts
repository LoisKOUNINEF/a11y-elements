import { getString } from '../../core/strings.js';
import { appendContent, h, type Content } from '../../core/dom.js';
import type { ModalElement } from './modal.element.js';

export interface ConfirmDialogOptions {
  /** The dialog's heading, which also names it. */
  title: string;
  /** Text under the heading: text, nodes, or markup through `raw()`. */
  message?: Content;
  /** Defaults to `setStrings({ confirm })` ("OK"). */
  confirmLabel?: string;
  /** Defaults to `setStrings({ cancel })` ("Cancel"). */
  cancelLabel?: string;
  /** Adds `a11y-confirm__confirm--danger` to the confirm button, for a destructive action. */
  danger?: boolean;
}

/**
 * Asks a yes/no question in a temporary `<a11y-modal>` and resolves `true`
 * only when the confirm button is pressed. Any other close (Cancel, Escape,
 * the backdrop, ×, `dismissAllOverlays()`) resolves `false`. Focus starts on
 * Cancel, so a stray Enter doesn't confirm a destructive action. The modal is
 * removed once it has closed.
 *
 * Not named `confirm()`: a forgotten import would silently call
 * `window.confirm()` instead.
 */
export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const { title, message, danger = false } = options;
  const confirmLabel = options.confirmLabel ?? getString('confirm');
  const cancelLabel = options.cancelLabel ?? getString('cancel');

  const modal = document.createElement('a11y-modal') as ModalElement;
  modal.classList.add('a11y-confirm');
  modal.setAttribute('initial-focus', '.a11y-confirm__cancel');
  appendContent(
    modal,
    h('h2', { class: 'a11y-confirm__title' }, title),
    message ? h('div', { class: 'a11y-confirm__message' }, message) : null,
    h(
      'div',
      { class: 'a11y-modal-buttons' },
      h('button', { type: 'button', class: 'a11y-confirm__cancel' }, cancelLabel),
      h('button', { type: 'button', class: danger ? 'a11y-confirm__confirm a11y-confirm__confirm--danger' : 'a11y-confirm__confirm' }, confirmLabel),
    ),
  );

  return new Promise((resolve) => {
    let confirmed = false;
    modal.addEventListener('click', (e) => {
      const button = (e.target as Element).closest('button');
      if (button?.classList.contains('a11y-confirm__confirm')) {
        confirmed = true;
        modal.close();
      } else if (button?.classList.contains('a11y-confirm__cancel')) {
        modal.close();
      }
    });
    modal.onClose = () => {
      modal.remove();
      resolve(confirmed);
    };
    document.body.appendChild(modal);
    modal.open = true;
  });
}
