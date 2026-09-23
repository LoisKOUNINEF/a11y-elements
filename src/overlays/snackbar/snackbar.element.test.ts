import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import { notify } from './define.js';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('a11y-snackbar element', () => {
  it('portals itself to document.body and sets aria-live/region attributes', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const el = document.createElement('a11y-snackbar') as any;
    host.appendChild(el);

    expect(el.parentNode).toBe(document.body);
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.classList.contains('a11y-passive-overlay-region')).toBe(true);
    expect(el.classList.contains('a11y-snackbar-region')).toBe(true);
  });

  it('shows a toast with role=status by default, in the bottom container', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('Saved');

    const toast = el.querySelector('.a11y-snackbar')!;
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.classList.contains('a11y-snackbar--info')).toBe(true);
    expect(toast.textContent).toContain('Saved');
    expect(el.querySelector('.a11y-snackbar-region__bottom')!.contains(toast)).toBe(true);
  });

  it('error type gets role=alert and aria-live=assertive', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('Something broke', { type: 'error' });

    const toast = el.querySelector('.a11y-snackbar')!;
    expect(toast.getAttribute('role')).toBe('alert');
    expect(toast.getAttribute('aria-live')).toBe('assertive');
  });

  it('auto-dismisses after duration (default 3000ms)', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('Saved');

    vi.advanceTimersByTime(2999);
    expect(el.querySelector('.a11y-snackbar')).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
  });

  it('queues a second toast beyond the default maxStack=1 until the first is dismissed', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('First');
    el.notify('Second');

    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(1);
    expect(el.querySelector('.a11y-snackbar')!.textContent).toContain('Second');
  });

  it('clicking the action button calls onAction, clears the pending auto-dismiss, and dismisses immediately', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    const onAction = vi.fn();
    el.notify('Undo?', { actionText: 'Undo', onAction, duration: 5000 });

    const btn = el.querySelector('button')!;
    btn.click();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.a11y-snackbar')).toBeNull();

    // The cleared auto-dismiss timer must not fire a second (phantom) dismissal later.
    vi.advanceTimersByTime(5000);
  });
});

describe('notify() convenience function', () => {
  it('finds-or-creates a region with zero HTML setup', () => {
    expect(document.querySelector('a11y-snackbar')).toBeNull();
    notify('Zero-config toast');
    const region = document.querySelector('a11y-snackbar')!;
    expect(region).not.toBeNull();
    expect(region.querySelector('.a11y-snackbar')?.textContent).toContain('Zero-config toast');
  });

  it('reuses an existing <a11y-snackbar> already in the page instead of creating another', () => {
    const el = document.createElement('a11y-snackbar');
    document.body.appendChild(el);
    notify('Uses the existing one');
    expect(document.querySelectorAll('a11y-snackbar')).toHaveLength(1);
  });

  it('maxStack is sticky on the shared region — omitting it later keeps the last value set', () => {
    notify('a', { maxStack: 2 });
    notify('b');
    expect(document.querySelectorAll('.a11y-snackbar')).toHaveLength(2); // both shown immediately, maxStack still 2
  });
});

describe('a11y-snackbar — timing (WCAG 2.2.1)', () => {
  it('pauses the auto-dismiss countdown while hovered and resumes with the remaining time', () => {
    vi.useFakeTimers();
    notify('Saved');
    const toast = document.querySelector<HTMLElement>('.a11y-snackbar')!;
    vi.advanceTimersByTime(2000);
    toast.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(10_000);
    expect(toast.isConnected).toBe(true);

    toast.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(999);
    expect(toast.isConnected).toBe(true);
    vi.advanceTimersByTime(1);
    expect(toast.isConnected).toBe(false);
  });

  it('pauses while focus is inside the toast', () => {
    vi.useFakeTimers();
    notify('Undo?', { actionText: 'Undo', onAction: () => {} });
    const toast = document.querySelector<HTMLElement>('.a11y-snackbar')!;
    toast.dispatchEvent(new FocusEvent('focusin'));
    vi.advanceTimersByTime(60_000);
    expect(toast.isConnected).toBe(true);
  });

  it('gives toasts with an action a longer default duration', () => {
    vi.useFakeTimers();
    notify('Undo?', { actionText: 'Undo', onAction: () => {} });
    vi.advanceTimersByTime(3000);
    expect(document.querySelector('.a11y-snackbar')).not.toBeNull();
    vi.advanceTimersByTime(7000);
    expect(document.querySelector('.a11y-snackbar')).toBeNull();
  });

  it('the action button always dismisses, even without onAction', () => {
    notify('Heads up', { actionText: 'OK' });
    document.querySelector<HTMLButtonElement>('.a11y-snackbar button')!.click();
    expect(document.querySelector('.a11y-snackbar')).toBeNull();
  });
});
