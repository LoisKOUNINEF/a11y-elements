import { afterEach, describe, expect, it } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll');
});

function mount(): HTMLElement & { open: boolean } {
  const el = document.createElement('a11y-emergency-dialog') as HTMLElement & { open: boolean };
  el.innerHTML = '<h2>Session expiring</h2>';
  document.body.appendChild(el);
  return el;
}

describe('a11y-emergency-dialog', () => {
  it('renders no close button', () => {
    const el = mount();
    el.open = true;
    expect(el.querySelector('.a11y-modal-close-button')).toBeNull();
  });

  it('does not close on backdrop click', () => {
    const el = mount();
    el.open = true;
    document.querySelector<HTMLElement>('.a11y-emergency-dialog-overlay')!.dispatchEvent(new MouseEvent('click'));
    expect(el.open).toBe(true);
  });

  it('does not close on Escape (focus trap has escapeDeactivates forced false)', () => {
    const el = mount();
    el.open = true;
    document.querySelector('.a11y-emergency-dialog-wrapper')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(el.open).toBe(true);
  });

  it('cannot be forced dismissible via the non-dismissible attribute (the getter is hardcoded)', () => {
    const el = mount();
    el.removeAttribute('non-dismissible'); // absent, which would mean dismissible=true anywhere else
    el.open = true;
    expect(el.querySelector('.a11y-modal-close-button')).toBeNull();
  });

  it('only closes programmatically', () => {
    const el = mount();
    el.open = true;
    el.open = false; // no CSS transition in jsdom: closes immediately
    expect(document.querySelector('.a11y-emergency-dialog-overlay')).toBeNull();
  });
});
