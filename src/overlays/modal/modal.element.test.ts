import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import { resetStrings, setStrings } from '../../core/strings.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll');
});

function mount(innerHtml = '<h2>Settings</h2><p>Body</p>'): HTMLElement {
  const el = document.createElement('a11y-modal');
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('a11y-modal', () => {
  it('opens declaratively via the open attribute', () => {
    const el = document.createElement('a11y-modal');
    el.innerHTML = '<h2>Title</h2>';
    el.setAttribute('open', '');
    document.body.appendChild(el);
    expect(document.querySelector('.a11y-modal-overlay')).not.toBeNull();
  });

  it('applies a11y-modal-wrapper--fullscreen when the fullscreen attribute is set', () => {
    const el = mount();
    el.setAttribute('fullscreen', '');
    (el as any).open = true;
    expect(document.querySelector('.a11y-modal-wrapper')!.classList.contains('a11y-modal-wrapper--fullscreen')).toBe(true);
    expect(document.querySelector('.a11y-modal-overlay')!.classList.contains('a11y-modal-overlay--fullscreen')).toBe(true);
  });

  it('calls onClose after the close transition completes, not immediately on close()', () => {
    const el = mount() as HTMLElement & { open: boolean; onClose?: () => void };
    const onClose = vi.fn();
    el.onClose = onClose;
    el.open = true;
    (document.querySelector('.a11y-modal-wrapper') as HTMLElement).style.transitionDuration = '0.3s';
    el.open = false;
    expect(onClose).not.toHaveBeenCalled();

    document.querySelector('.a11y-modal-wrapper')!.dispatchEvent(new Event('transitionend'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('emits the standardized a11y-overlay-open/close events', () => {
    const el = mount() as HTMLElement & { open: boolean };
    const openSpy = vi.fn();
    const closeSpy = vi.fn();
    document.addEventListener('a11y-overlay-open', openSpy);
    document.addEventListener('a11y-overlay-close', closeSpy);

    el.open = true;
    expect(openSpy).toHaveBeenCalledTimes(1);
    el.open = false; // no CSS transition in jsdom: closes immediately
    expect(closeSpy).toHaveBeenCalledTimes(1);

    document.removeEventListener('a11y-overlay-open', openSpy);
    document.removeEventListener('a11y-overlay-close', closeSpy);
  });
});

describe('a11y-modal — translated close button', () => {
  afterEach(() => resetStrings());

  const closeLabel = (): string | null => document.querySelector('.a11y-modal-close-button')!.getAttribute('aria-label');

  it('defaults to "Close dialog"', () => {
    (mount() as any).open = true;
    expect(closeLabel()).toBe('Close dialog');
  });

  it('uses setStrings({ closeDialog }), relabelling an open modal', () => {
    (mount() as any).open = true;
    setStrings({ closeDialog: 'Fermer' });
    expect(closeLabel()).toBe('Fermer');
  });

  it('lets close-label win over setStrings, and follows it when it changes', () => {
    const el = mount();
    el.setAttribute('close-label', 'Schließen');
    (el as any).open = true;
    setStrings({ closeDialog: 'Fermer' });
    expect(closeLabel()).toBe('Schließen');
    el.setAttribute('close-label', 'Chiudi');
    expect(closeLabel()).toBe('Chiudi');
    el.removeAttribute('close-label');
    expect(closeLabel()).toBe('Fermer');
  });
});

describe('a11y-modal initial focus', () => {
  const body = '<h2>Delete?</h2><input id="name"><button class="cancel">Cancel</button><button>Delete</button>';

  it('focuses the × close button by default', () => {
    const el = mount(body) as HTMLElement & { open: boolean };
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('.a11y-modal-close-button'));
  });

  it('focuses the element whose id is initial-focus', () => {
    const el = mount(body) as HTMLElement & { open: boolean };
    el.setAttribute('initial-focus', 'name');
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('#name'));
  });

  it('accepts a selector', () => {
    const el = mount(body) as HTMLElement & { open: boolean };
    el.setAttribute('initial-focus', '.cancel');
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('.cancel'));
  });

  it('honours a descendant with autofocus', () => {
    const el = mount(body.replace('<button class="cancel">', '<button class="cancel" autofocus>')) as HTMLElement & {
      open: boolean;
    };
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('.cancel'));
  });

  it('falls back to the first focusable element when the target is missing, invalid or disabled', () => {
    for (const ref of ['missing', '[[', '#off']) {
      const el = mount(`${body}<button id="off" disabled>Off</button>`) as HTMLElement & { open: boolean };
      el.setAttribute('initial-focus', ref);
      el.open = true;
      expect(document.activeElement, ref).toBe(el.querySelector('.a11y-modal-close-button'));
      el.remove();
    }
  });

  it("ignores an id that's outside the modal", () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="outside">Outside</button>');
    const el = mount(body) as HTMLElement & { open: boolean };
    el.setAttribute('initial-focus', 'outside');
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('.a11y-modal-close-button'));
  });
});

describe('a11y-modal close reason', () => {
  function openModal(): HTMLElement & { open: boolean; onClose?: (reason: string) => void } {
    const el = mount('<h2>Title</h2><button>OK</button>') as HTMLElement & {
      open: boolean;
      onClose?: (reason: string) => void;
    };
    el.open = true;
    return el;
  }

  function lastCloseDetail(spy: ReturnType<typeof vi.fn>): { name: string; element: Element; reason: string } {
    return (spy.mock.calls.at(-1)![0] as CustomEvent).detail;
  }

  it.each([
    ['escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))],
    ['backdrop', () => document.querySelector<HTMLElement>('.a11y-modal-overlay')!.click()],
    ['close-button', () => document.querySelector<HTMLElement>('.a11y-modal-close-button')!.click()],
  ])('reports %s to onClose and the close event', (reason, act) => {
    const el = openModal();
    const onClose = vi.fn();
    const closeSpy = vi.fn();
    el.onClose = onClose;
    el.addEventListener('a11y-overlay-close', closeSpy);

    act();
    expect(onClose).toHaveBeenCalledWith(reason);
    expect(lastCloseDetail(closeSpy)).toEqual({ name: 'a11y-modal', element: el, reason });
  });

  it('reports api for open = false', () => {
    const el = openModal();
    const onClose = vi.fn();
    el.onClose = onClose;
    el.open = false;
    expect(onClose).toHaveBeenCalledWith('api');
  });
});
