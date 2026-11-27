import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import { notify } from './define.js';
import { raw } from '../../core/template.js';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('a11y-snackbar element', () => {
  it('escapes a plain-string message and sanitizes a raw() one', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('<b>text</b>');
    el.notify(raw('<b onclick="x">bold</b><img src=x onerror=alert(1)>'));

    const [plain, rich] = el.querySelectorAll('.a11y-snackbar__message');
    expect(plain.innerHTML).toBe('&lt;b&gt;text&lt;/b&gt;');
    expect(rich.innerHTML).toBe('<b>bold</b><img src="x">');
  });

  it('inserts a Node message as is', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    const link = document.createElement('a');
    link.href = '/files';
    el.notify(link);
    expect(el.querySelector('.a11y-snackbar__message').firstChild).toBe(link);
  });

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

  it('stacks up to 3 toasts by default and queues the 4th until one is dismissed', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('First');
    el.notify('Second');
    el.notify('Third');
    el.notify('Fourth', { duration: 5000 });

    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(3);
    vi.advanceTimersByTime(3000);
    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(1);
    expect(el.querySelector('.a11y-snackbar')!.textContent).toContain('Fourth');
  });

  it('max-stack="1" shows one toast at a time', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    el.setAttribute('max-stack', '1');
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

    const btn = el.querySelector('.a11y-snackbar__action')!;
    btn.click();
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.a11y-snackbar')).toBeNull();

    // The cleared auto-dismiss timer must not fire a second (phantom) dismissal later.
    vi.advanceTimersByTime(5000);
  });

  it('the × close button dismisses without calling onAction, and the next queued toast shows exactly once', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    el.setAttribute('max-stack', '1');
    document.body.appendChild(el);
    const onAction = vi.fn();
    el.notify('First', { actionText: 'Undo', onAction, duration: 5000 });
    el.notify('Second', { duration: 5000 });
    el.notify('Third', { duration: 5000 });

    el.querySelector('.a11y-snackbar__close')!.click();
    expect(onAction).not.toHaveBeenCalled();
    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(1);
    expect(el.querySelector('.a11y-snackbar')!.textContent).toContain('Second');

    // The first toast's cancelled timer must not dismiss again and pull Third in early.
    vi.advanceTimersByTime(4999);
    expect(el.querySelector('.a11y-snackbar')!.textContent).toContain('Second');
  });

  it('names the close button "Dismiss" by default, and dismiss-label relabels toasts already showing', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('Saved');
    const close = el.querySelector('.a11y-snackbar__close')!;
    expect(close.getAttribute('type')).toBe('button');
    expect(close.getAttribute('aria-label')).toBe('Dismiss');

    el.setAttribute('dismiss-label', 'Fermer');
    expect(close.getAttribute('aria-label')).toBe('Fermer');
    el.notify('Encore');
    expect(el.querySelectorAll('.a11y-snackbar__close')[1].getAttribute('aria-label')).toBe('Fermer');
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

  it.each([Infinity, 2 ** 31])('duration %d keeps the toast until dismissed (no overflow to 0)', (duration) => {
    vi.useFakeTimers();
    notify('Sticky', { duration });
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(document.querySelector('.a11y-snackbar')).not.toBeNull();
    document.querySelector<HTMLButtonElement>('.a11y-snackbar__close')!.click();
    expect(document.querySelector('.a11y-snackbar')).toBeNull();
  });

  it('the action button always dismisses, even without onAction', () => {
    notify('Heads up', { actionText: 'OK' });
    document.querySelector<HTMLButtonElement>('.a11y-snackbar__action')!.click();
    expect(document.querySelector('.a11y-snackbar')).toBeNull();
  });
});

describe('a11y-snackbar — teardown', () => {
  const flushMicrotasks = (): Promise<void> => Promise.resolve();

  it('cancels pending auto-dismiss timers and drops toasts when the region is removed', async () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    el.setAttribute('max-stack', '1');
    document.body.appendChild(el);
    el.notify('Showing');
    el.notify('Queued');
    const onDismissed = vi.spyOn(el, '_onItemDismissed');

    el.remove();
    await flushMicrotasks();
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20_000);
    expect(onDismissed).not.toHaveBeenCalled();

    // Re-adding starts clean: nothing from before comes back, new toasts show.
    document.body.appendChild(el);
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
    el.notify('Fresh');
    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(1);
    expect(el.querySelector('.a11y-snackbar')!.textContent).toContain('Fresh');
  });

  it('drops a toast enqueued synchronously after removal (e.g. from a teardown callback) without starting a timer', async () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.remove();
    el.notify('Too late');
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    await flushMicrotasks();
    document.body.appendChild(el);
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
  });

  it('keeps its toasts and timers when merely moved (disconnect + reconnect in the same task)', async () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('Still here', { duration: 3000 });
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(el); // portals itself straight back to <body>
    await flushMicrotasks();
    expect(el.parentNode).toBe(document.body);
    expect(el.querySelector('.a11y-snackbar')).not.toBeNull();
    vi.advanceTimersByTime(3000);
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
  });

  it('dismissAll() removes showing toasts, drops queued ones, cancels timers, and skips onAction', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    el.setAttribute('max-stack', '2');
    document.body.appendChild(el);
    const onAction = vi.fn();
    el.notify('a', { actionText: 'Undo', onAction });
    el.notify('b');
    el.notify('c');
    el.dismissAll();
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(onAction).not.toHaveBeenCalled();

    el.notify('d');
    el.notify('e');
    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(2); // count reset: both fit in max-stack 2
  });
});

describe('a11y-snackbar — position', () => {
  const positionOf = (el: HTMLElement, text: string): string | undefined => {
    const toast = Array.from(el.querySelectorAll<HTMLElement>('.a11y-snackbar')).find((t) => t.textContent!.includes(text));
    return toast?.closest<HTMLElement>('.a11y-snackbar-region__stack')?.dataset.position;
  };

  it.each(['top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] as const)(
    'shows a toast in the %s container with the position option',
    (position) => {
      const el = document.createElement('a11y-snackbar') as any;
      document.body.appendChild(el);
      el.notify('Saved', { position });
      expect(positionOf(el, 'Saved')).toBe(position);
    },
  );

  it('reuses one container per position, keeping the legacy __top / __bottom classes on the centered ones', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.notify('a', { position: 'top-right' });
    el.notify('b', { position: 'top-right' });
    el.notify('c', { position: 'top' });
    expect(el.querySelectorAll('.a11y-snackbar-region__stack[data-position="top-right"]')).toHaveLength(1);
    expect(el.querySelector('[data-position="top-right"]')!.children).toHaveLength(2);
    expect(el.querySelector('[data-position="top"]')!.classList.contains('a11y-snackbar-region__top')).toBe(true);
    expect(el.querySelector('[data-position="top-right"]')!.className).toBe('a11y-snackbar-region__stack');
  });

  it('defaults to --a11y-snackbar-position, read when each toast is shown; the option wins', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.style.setProperty('--a11y-snackbar-position', ' top-left ');
    el.notify('a');
    el.notify('b', { position: 'bottom-right' });
    el.style.setProperty('--a11y-snackbar-position', '"bottom-left"');
    el.notify('c');
    expect(positionOf(el, 'a')).toBe('top-left');
    expect(positionOf(el, 'b')).toBe('bottom-right');
    expect(positionOf(el, 'c')).toBe('bottom-left');
  });

  it('falls back to bottom for an unknown CSS or option value', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    el.style.setProperty('--a11y-snackbar-position', 'middle');
    el.notify('a');
    el.notify('b', { position: 'center' });
    expect(positionOf(el, 'a')).toBe('bottom');
    expect(positionOf(el, 'b')).toBe('bottom');
  });
});

describe('a11y-snackbar — onClose', () => {
  it('runs on the × button, once', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    const onClose = vi.fn();
    el.notify('a', { onClose });
    const close = el.querySelector('.a11y-snackbar__close') as HTMLButtonElement;
    close.click();
    close.click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs after onAction on the action button, with the toast already gone', () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    const calls: string[] = [];
    el.notify('a', {
      actionText: 'Undo',
      onAction: () => calls.push(`action:${el.querySelectorAll('.a11y-snackbar').length}`),
      onClose: () => calls.push('close'),
    });
    (el.querySelector('.a11y-snackbar__action') as HTMLButtonElement).click();
    expect(calls).toEqual(['action:0', 'close']);
  });

  it('runs when the toast times out', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    const onClose = vi.fn();
    el.notify('a', { duration: 1000, onClose });
    vi.advanceTimersByTime(999);
    expect(onClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(el.querySelector('.a11y-snackbar')).toBeNull();
  });

  it('dismissAll() runs it for toasts on screen, not for queued ones, and never later from their timers', () => {
    vi.useFakeTimers();
    const el = document.createElement('a11y-snackbar') as any;
    el.setAttribute('max-stack', '1');
    document.body.appendChild(el);
    const shown = vi.fn();
    const queued = vi.fn();
    el.notify('a', { onClose: shown });
    el.notify('b', { onClose: queued });
    el.dismissAll();
    vi.runAllTimers();
    expect(shown).toHaveBeenCalledTimes(1);
    expect(queued).not.toHaveBeenCalled();
  });

  it('runs when the region is removed from the document', async () => {
    const el = document.createElement('a11y-snackbar') as any;
    document.body.appendChild(el);
    const onClose = vi.fn();
    el.notify('a', { onClose });
    el.remove();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('an onClose that calls dismissAll() or notify() leaves the count consistent', () => {
    const el = document.createElement('a11y-snackbar') as any;
    el.setAttribute('max-stack', '2');
    document.body.appendChild(el);
    el.notify('a', { onClose: () => el.dismissAll() });
    el.notify('b');
    (el.querySelector('.a11y-snackbar__close') as HTMLButtonElement).click();
    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(0);

    el.notify('c', { onClose: () => el.notify('d') });
    el.notify('e');
    (el.querySelector('.a11y-snackbar__close') as HTMLButtonElement).click();
    expect(Array.from(el.querySelectorAll('.a11y-snackbar__message'), (m: Element) => m.textContent)).toEqual(['e', 'd']);
    el.notify('f');
    expect(el.querySelectorAll('.a11y-snackbar')).toHaveLength(2); // f queued behind max-stack 2
  });
});
