import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import '../drawer/define.js';
import '../popover/define.js';
import { dismissAllOverlays, removeOverlaysWithin } from '../../core/overlay-registry.js';
import { resetStrings, setStrings } from '../../core/strings.js';
import type { FloatingElement } from './floating.element.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll');
  resetStrings();
});

function mount(attrs: Record<string, string> = {}, content = '<button>Menu</button>'): FloatingElement {
  const el = document.createElement('a11y-floating');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.innerHTML = content;
  document.body.appendChild(el);
  return el;
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const stackOf = (el: HTMLElement): HTMLElement => el.parentElement!;

describe('a11y-floating — placement', () => {
  it('moves into a bottom-right stack by default', () => {
    const el = mount();
    expect(stackOf(el).classList.contains('a11y-floating-stack')).toBe(true);
    expect(stackOf(el).dataset.position).toBe('bottom-right');
    expect(el.position).toBe('bottom-right');
  });

  it('falls back to bottom-right for an invalid position', () => {
    const el = mount({ position: 'middle' });
    expect(stackOf(el).dataset.position).toBe('bottom-right');
  });

  it('shares one stack per position and removes it once empty', () => {
    const a = mount({ position: 'top-left' });
    const b = mount({ position: 'top-left' });
    expect(stackOf(a)).toBe(stackOf(b));
    expect(document.querySelectorAll('.a11y-floating-stack')).toHaveLength(1);
    a.remove();
    expect(document.querySelectorAll('.a11y-floating-stack')).toHaveLength(1);
    b.remove();
    expect(document.querySelectorAll('.a11y-floating-stack')).toHaveLength(0);
  });

  it('moves to another stack when position changes', () => {
    const el = mount();
    el.position = 'top';
    expect(stackOf(el).dataset.position).toBe('top');
    expect(document.querySelector('.a11y-floating-stack[data-position="bottom-right"]')).toBeNull();
  });

  it('is removed by removeOverlaysWithin() on the subtree it was authored in', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const el = document.createElement('a11y-floating');
    host.appendChild(el);
    expect(el.parentElement).not.toBe(host);
    host.remove();
    expect(removeOverlaysWithin(host)).toBe(1);
    expect(el.isConnected).toBe(false);
    expect(document.querySelector('.a11y-floating-stack')).toBeNull();
  });

  it('is not closed by dismissAllOverlays()', () => {
    const el = mount();
    dismissAllOverlays();
    expect(el.hidden).toBe(false);
    expect(el.isConnected).toBe(true);
  });
});

describe('a11y-floating — host role', () => {
  it('is a named region with a label', () => {
    const el = mount({ label: 'What’s new' }, '<p>Dark mode!</p>');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('What’s new');
  });

  it('is a status live region with announce', () => {
    const el = mount({ announce: '' }, '<p>Saved</p>');
    expect(el.getAttribute('role')).toBe('status');
  });

  it('leaves a role the consumer authored alone', () => {
    const el = mount({ role: 'complementary', label: 'Tips' });
    expect(el.getAttribute('role')).toBe('complementary');
  });
});

describe('a11y-floating — controls mode', () => {
  function mountDrawer(): HTMLElement & { open: boolean } {
    const drawer = document.createElement('a11y-drawer') as HTMLElement & { open: boolean };
    drawer.id = 'nav';
    drawer.innerHTML = '<h2>Nav</h2><button>Link</button>';
    document.body.appendChild(drawer);
    return drawer;
  }

  it('wires ARIA on the trigger and toggles the target', async () => {
    const drawer = mountDrawer();
    const el = mount({ controls: 'nav' });
    const trigger = el.querySelector('button')!;
    expect(trigger.getAttribute('aria-controls')).toBe('nav');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    trigger.click();
    expect(drawer.open).toBe(true);
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps aria-expanded in sync when the target closes itself', async () => {
    const drawer = mountDrawer();
    const el = mount({ controls: 'nav' });
    const trigger = el.querySelector('button')!;
    trigger.click();
    await flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(drawer.open).toBe(false);
    await flush();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('prefers a [data-floating-trigger] child', () => {
    mountDrawer();
    const el = mount({ controls: 'nav' }, '<button>Other</button><button data-floating-trigger>Menu</button>');
    expect(el.querySelector('[data-floating-trigger]')!.getAttribute('aria-controls')).toBe('nav');
  });

  it('removes trigger ARIA on disconnect', () => {
    mountDrawer();
    const el = mount({ controls: 'nav' });
    const trigger = el.querySelector('button')!;
    el.remove();
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
    expect(trigger.hasAttribute('aria-expanded')).toBe(false);
  });

  it('anchors an anchorless popover to the trigger', () => {
    const popover = document.createElement('a11y-popover') as HTMLElement & { anchorElement: HTMLElement | null };
    popover.id = 'info';
    popover.setAttribute('interactive', '');
    document.body.appendChild(popover);
    const el = mount({ controls: 'info' });
    const trigger = el.querySelector('button')!;
    expect(popover.anchorElement).toBe(trigger);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    el.remove();
    expect(popover.anchorElement).toBeNull();
  });
});

describe('a11y-floating — expandable mode', () => {
  function mountExpandable(attrs: Record<string, string> = {}): FloatingElement {
    return mount({ expandable: '', label: 'Help', ...attrs }, '<h2>Need help?</h2><a href="#faq">FAQ</a>');
  }

  it('generates a launcher and a hidden, named panel', () => {
    const el = mountExpandable();
    const launcher = el.querySelector<HTMLButtonElement>('.a11y-floating-launcher')!;
    const panel = el.querySelector<HTMLElement>('.a11y-floating-panel')!;
    expect(launcher.textContent).toBe('Help');
    expect(launcher.getAttribute('aria-controls')).toBe(panel.id);
    expect(launcher.getAttribute('aria-haspopup')).toBe('dialog');
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-labelledby')).toBe(el.querySelector('h2')!.id);
    expect(el.hasAttribute('role')).toBe(false);
  });

  it('expands, focuses the first content control, and collapses on Escape back to the launcher', () => {
    const el = mountExpandable();
    const launcher = el.querySelector<HTMLButtonElement>('.a11y-floating-launcher')!;
    const panel = el.querySelector<HTMLElement>('.a11y-floating-panel')!;
    const expand = vi.fn();
    el.addEventListener('a11y-floating-expand', expand);

    launcher.click();
    expect(el.expanded).toBe(true);
    expect(panel.hidden).toBe(false);
    expect(launcher.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(el.querySelector('a'));
    expect(expand).toHaveBeenCalledOnce();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.expanded).toBe(false);
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(launcher);
  });

  it('collapses on an outside click', async () => {
    const el = mountExpandable();
    el.expand();
    await flush();
    document.body.click();
    expect(el.expanded).toBe(false);
  });

  it('does not collapse on a click inside', async () => {
    const el = mountExpandable();
    el.expand();
    await flush();
    el.querySelector('h2')!.click();
    expect(el.expanded).toBe(true);
  });

  it('collapses via its close button', () => {
    const el = mountExpandable();
    el.expand();
    const close = el.querySelector<HTMLButtonElement>('.a11y-floating-panel-close')!;
    expect(close.getAttribute('aria-label')).toBe('Close dialog');
    close.click();
    expect(el.expanded).toBe(false);
  });

  it('is collapsed — not hidden — by dismissAllOverlays()', () => {
    const el = mountExpandable();
    el.expand();
    dismissAllOverlays();
    expect(el.expanded).toBe(false);
    expect(el.hidden).toBe(false);
  });

  it('uses a [data-floating-trigger] child as the launcher', () => {
    const el = mount({ expandable: '' }, '<button data-floating-trigger aria-label="Chat">💬</button><p>Hi</p>');
    const launcher = el.querySelector('[data-floating-trigger]')!;
    expect(el.querySelector('.a11y-floating-launcher')).toBeNull();
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.a11y-floating-panel')!.contains(el.querySelector('p'))).toBe(true);
  });

  it('starts expanded with the expanded attribute', () => {
    const el = mountExpandable({ expanded: '' });
    expect(el.querySelector<HTMLElement>('.a11y-floating-panel')!.hidden).toBe(false);
  });

  it('unwraps the panel when expandable is removed', () => {
    const el = mountExpandable();
    el.removeAttribute('expandable');
    expect(el.querySelector('.a11y-floating-panel')).toBeNull();
    expect(el.querySelector('.a11y-floating-launcher')).toBeNull();
    expect(el.querySelector('h2')!.parentElement).toBe(el);
  });
});

describe('a11y-floating — dismissible', () => {
  it('adds a translatable dismiss button', () => {
    const el = mount({ dismissible: '' }, '<p>Hi</p>');
    const btn = el.querySelector('.a11y-floating-dismiss')!;
    expect(btn.getAttribute('aria-label')).toBe('Dismiss');
    setStrings({ dismiss: 'Fermer' });
    expect(btn.getAttribute('aria-label')).toBe('Fermer');
    el.setAttribute('dismiss-label', 'Hide tip');
    expect(btn.getAttribute('aria-label')).toBe('Hide tip');
  });

  it('hides on dismiss and shows again with show()', () => {
    const el = mount({ dismissible: '' }, '<p>Hi</p>');
    const onClose = vi.fn();
    el.onClose = onClose;
    el.querySelector<HTMLButtonElement>('.a11y-floating-dismiss')!.click();
    expect(el.hidden).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    el.show();
    expect(el.hidden).toBe(false);
  });

  it('can be cancelled', () => {
    const el = mount({ dismissible: '' }, '<p>Hi</p>');
    el.addEventListener('a11y-floating-dismiss', (e) => e.preventDefault());
    el.dismiss();
    expect(el.hidden).toBe(false);
  });

  it('returns focus to where it came from', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const el = mount({ dismissible: '' }, '<p>Hi</p>');
    outside.focus();
    const btn = el.querySelector<HTMLButtonElement>('.a11y-floating-dismiss')!;
    btn.focus();
    btn.click();
    expect(document.activeElement).toBe(outside);
  });
});

describe('a11y-floating — hide-on-scroll', () => {
  function scrollTo(y: number): void {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  }

  afterEach(() => scrollTo(0));

  it('scrolls away on scroll down and comes back on scroll up', () => {
    const el = mount({ 'hide-on-scroll': '' });
    scrollTo(100);
    expect(el.classList.contains('a11y-floating--scrolled-away')).toBe(true);
    scrollTo(50);
    expect(el.classList.contains('a11y-floating--scrolled-away')).toBe(false);
  });

  it('ignores scrolls under the threshold', () => {
    const el = mount({ 'hide-on-scroll': '', 'scroll-threshold': '40' });
    scrollTo(20);
    expect(el.classList.contains('a11y-floating--scrolled-away')).toBe(false);
  });

  it('comes back when focused', () => {
    const el = mount({ 'hide-on-scroll': '' });
    scrollTo(100);
    el.querySelector('button')!.focus();
    expect(el.classList.contains('a11y-floating--scrolled-away')).toBe(false);
  });

  it('does not scroll away while focus is inside', () => {
    const el = mount({ 'hide-on-scroll': '' });
    el.querySelector('button')!.focus();
    scrollTo(100);
    expect(el.classList.contains('a11y-floating--scrolled-away')).toBe(false);
  });
});
