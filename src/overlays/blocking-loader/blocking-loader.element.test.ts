import { afterEach, describe, expect, it } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll');
});

function mount(): HTMLElement & { open: boolean } {
  return document.createElement('a11y-blocking-loader') as HTMLElement & { open: boolean };
}

describe('a11y-blocking-loader', () => {
  it('sets role=alert, aria-live=assertive (no aria-busy, which would mute the alert), and locks scroll on open', () => {
    const el = mount();
    document.body.appendChild(el);
    el.open = true;

    expect(el.getAttribute('role')).toBe('alert');
    expect(el.hasAttribute('aria-busy')).toBe(false);
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(true);
  });

  it('composes a real <a11y-spinner> with a 3rem size', () => {
    const el = mount();
    document.body.appendChild(el);
    el.open = true;

    const spinner = el.querySelector('a11y-spinner');
    expect(spinner).not.toBeNull();
    expect(spinner!.getAttribute('size')).toBe('3rem');
  });

  it('uses the message attribute as both the spinner label and a visible message', () => {
    const el = mount();
    el.setAttribute('message', 'Saving your changes…');
    document.body.appendChild(el);
    el.open = true;

    expect(el.querySelector('a11y-spinner')!.getAttribute('label')).toBe('Saving your changes…');
    expect(el.querySelector('.a11y-blocking-loader-overlay__message')?.textContent).toBe('Saving your changes…');
  });

  it('defaults the spinner label to "Loading" and renders no message paragraph when none is given', () => {
    const el = mount();
    document.body.appendChild(el);
    el.open = true;

    expect(el.querySelector('a11y-spinner')!.getAttribute('label')).toBe('Loading');
    expect(el.querySelector('.a11y-blocking-loader-overlay__message')).toBeNull();
  });

  it('unlocks scroll and clears content on close, immediately (no dismiss affordance to gate on)', () => {
    const el = mount();
    document.body.appendChild(el);
    el.open = true;
    el.open = false;

    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(false);
    expect(el.innerHTML).toBe('');
  });

  it('emits the standardized overlay-open/close events', () => {
    const el = mount();
    document.body.appendChild(el);
    let opened = 0;
    let closed = 0;
    const onOpen = () => opened++;
    const onClose = () => closed++;
    document.addEventListener('a11y-overlay-open', onOpen);
    document.addEventListener('a11y-overlay-close', onClose);

    el.open = true;
    el.open = false;
    expect(opened).toBe(1);
    expect(closed).toBe(1);

    document.removeEventListener('a11y-overlay-open', onOpen);
    document.removeEventListener('a11y-overlay-close', onClose);
  });
});

describe('a11y-blocking-loader — blocking for keyboard/AT too', () => {
  it('makes the rest of the page inert and takes focus while shown, restoring both on close', () => {
    const page = document.body.appendChild(document.createElement('main'));
    const button = page.appendChild(document.createElement('button'));
    button.focus();
    const el = mount();
    document.body.appendChild(el);

    el.open = true;
    expect(page.hasAttribute('inert')).toBe(true);
    expect(el.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(el);

    el.open = false;
    expect(page.hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('removes its full-screen overlay class on close, so nothing keeps covering the page', () => {
    const el = mount();
    document.body.appendChild(el);
    el.open = true;
    el.open = false;
    expect(el.classList.contains('a11y-blocking-loader-overlay')).toBe(false);
    expect(el.hasAttribute('role')).toBe(false);
  });

  it('does not un-inert elements the consumer made inert themselves', () => {
    const own = document.body.appendChild(document.createElement('aside'));
    own.setAttribute('inert', '');
    const el = mount();
    document.body.appendChild(el);
    el.open = true;
    el.open = false;
    expect(own.hasAttribute('inert')).toBe(true);
  });

  it('re-renders the message when it changes while shown', () => {
    const el = mount();
    document.body.appendChild(el);
    el.open = true;
    el.setAttribute('message', 'Almost done');
    expect(el.querySelector('.a11y-blocking-loader-overlay__message')!.textContent).toBe('Almost done');
  });
});
