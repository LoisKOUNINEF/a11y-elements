import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import { showNotificationBanner } from './define.js';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('a11y-notification-banner element', () => {
  it('shows a banner with role=status in the top container by default', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    document.body.appendChild(el);
    el.show('Heads up');

    const banner = el.querySelector('.a11y-notification-banner')!;
    expect(banner.getAttribute('role')).toBe('status');
    expect(el.querySelector('.a11y-notification-banner-region__top')!.contains(banner)).toBe(true);
  });

  it('error type gets role=alert/aria-live=assertive', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    document.body.appendChild(el);
    el.show('Critical error', { type: 'error' });
    const banner = el.querySelector('.a11y-notification-banner')!;
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.getAttribute('aria-live')).toBe('assertive');
  });

  it('never auto-dismisses, even after a very long time', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-notification-banner') as any;
    document.body.appendChild(el);
    el.show('Persistent');
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(el.querySelector('.a11y-notification-banner')).not.toBeNull();
  });

  it('the close button dismisses it and calls onClose', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    document.body.appendChild(el);
    const onClose = vi.fn();
    el.show('Dismiss me', { onClose });

    (el.querySelector('.a11y-notification-banner__close') as HTMLButtonElement).click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.a11y-notification-banner')).toBeNull();
  });

  it('the action button calls onAction AND also dismisses (unlike snackbar, whose action click does not trigger onClose separately)', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    document.body.appendChild(el);
    const onAction = vi.fn();
    const onClose = vi.fn();
    el.show('Take action', { actionText: 'Retry', onAction, onClose });

    (el.querySelector('.a11y-notification-banner__action') as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.a11y-notification-banner')).toBeNull();
  });

  it('stacks up to 3 banners by default, queueing the rest', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    document.body.appendChild(el);
    ['1', '2', '3', '4'].forEach((m) => el.show(m));
    expect(el.querySelectorAll('.a11y-notification-banner')).toHaveLength(3);
  });

  it('show({ maxStack }) sets the limit on the region', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    document.body.appendChild(el);
    ['1', '2', '3', '4'].forEach((m) => el.show(m, { maxStack: 4 }));
    expect(el.querySelectorAll('.a11y-notification-banner')).toHaveLength(4);
    expect(el.getAttribute('max-stack')).toBe('4');
  });

  it('promotes a queued banner once the active one is dismissed (max-stack="1")', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    el.setAttribute('max-stack', '1');
    document.body.appendChild(el);
    el.show('First');
    el.show('Second');
    expect(el.querySelectorAll('.a11y-notification-banner')).toHaveLength(1);

    (el.querySelector('.a11y-notification-banner__close') as HTMLButtonElement).click();
    expect(el.querySelectorAll('.a11y-notification-banner')).toHaveLength(1);
    expect(el.querySelector('.a11y-notification-banner')!.textContent).toContain('Second');
  });

  it('dismissAll() clears the queue silently and force-closes active banners with onClose', () => {
    const el = document.createElement('a11y-notification-banner') as any;
    el.setAttribute('max-stack', '1');
    document.body.appendChild(el);
    const onCloseActive = vi.fn();
    const onCloseQueued = vi.fn();
    el.show('Active', { onClose: onCloseActive });
    el.show('Queued', { onClose: onCloseQueued });

    el.dismissAll();

    expect(el.querySelectorAll('.a11y-notification-banner')).toHaveLength(0);
    expect(onCloseActive).toHaveBeenCalledTimes(1);
    expect(onCloseQueued).not.toHaveBeenCalled(); // never shown, dropped silently
  });
});

describe('showNotificationBanner() convenience function', () => {
  it('finds-or-creates a region with zero HTML setup', () => {
    expect(document.querySelector('a11y-notification-banner')).toBeNull();
    showNotificationBanner('Zero-config banner');
    expect(document.querySelector('a11y-notification-banner')).not.toBeNull();
  });
});
