import { afterEach, describe, expect, it } from 'vitest';
import { confirmDialog } from './define.js';
import { dismissAllOverlays } from '../../core/overlay-registry.js';
import { raw } from '../../core/template.js';
import { resetStrings, setStrings } from '../../core/strings.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll', 'a11y-no-scroll--gutter');
  resetStrings();
});

const button = (cls: string): HTMLButtonElement => document.querySelector<HTMLButtonElement>(`.a11y-confirm__${cls}`)!;

describe('confirmDialog', () => {
  it('shows the title and message in an open modal named after the title', () => {
    void confirmDialog({ title: 'Delete all notes?', message: 'This can’t be undone.' });
    const wrapper = document.querySelector('.a11y-modal-wrapper')!;
    const heading = wrapper.querySelector('h2')!;
    expect(heading.textContent).toBe('Delete all notes?');
    expect(wrapper.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(wrapper.querySelector('.a11y-confirm__message')!.textContent).toBe('This can’t be undone.');
  });

  it('escapes a plain message, keeps raw() markup and inserts a Node as is', () => {
    void confirmDialog({ title: 'A', message: '<b>x</b>' });
    expect(document.querySelector('.a11y-confirm__message b')).toBeNull();
    document.body.innerHTML = '';
    void confirmDialog({ title: 'B', message: raw('<b>x</b>') });
    expect(document.querySelector('.a11y-confirm__message b')).not.toBeNull();
    document.body.innerHTML = '';
    const em = document.createElement('em');
    void confirmDialog({ title: 'C', message: em });
    expect(document.querySelector('.a11y-confirm__message')!.firstChild).toBe(em);
  });

  it('starts focus on Cancel', () => {
    void confirmDialog({ title: 'Delete?' });
    expect(document.activeElement).toBe(button('cancel'));
  });

  it('resolves true on confirm, and removes the modal', async () => {
    const answer = confirmDialog({ title: 'Delete?' });
    button('confirm').click();
    await expect(answer).resolves.toBe(true);
    expect(document.querySelector('a11y-modal')).toBeNull();
  });

  it.each([
    ['Cancel', () => button('cancel').click()],
    ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
    ['the backdrop', () => document.querySelector<HTMLElement>('.a11y-modal-overlay')!.click()],
    ['×', () => document.querySelector<HTMLElement>('.a11y-modal-close-button')!.click()],
    ['dismissAllOverlays()', () => dismissAllOverlays()],
    ['removal', () => document.querySelector('a11y-modal')!.remove()],
  ])('resolves false on %s', async (_, act) => {
    const answer = confirmDialog({ title: 'Delete?' });
    act();
    await expect(answer).resolves.toBe(false);
    expect(document.querySelector('a11y-modal')).toBeNull();
  });

  it('uses the given labels, the danger class, then setStrings()', () => {
    void confirmDialog({ title: 'A', confirmLabel: 'Delete', cancelLabel: 'Keep', danger: true });
    expect(button('confirm').textContent).toBe('Delete');
    expect(button('confirm').classList.contains('a11y-confirm__confirm--danger')).toBe(true);
    expect(button('cancel').textContent).toBe('Keep');
    document.body.innerHTML = '';

    setStrings({ confirm: 'Oui', cancel: 'Non' });
    void confirmDialog({ title: 'B' });
    expect(button('confirm').textContent).toBe('Oui');
    expect(button('confirm').classList.contains('a11y-confirm__confirm--danger')).toBe(false);
    expect(button('cancel').textContent).toBe('Non');
  });
});
