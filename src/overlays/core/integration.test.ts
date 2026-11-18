import { afterEach, describe, expect, it, vi } from 'vitest';
import '../modal/define.js';
import '../snackbar/define.js';
import '../dropdown/define.js';
import '../blocking-loader/define.js';
import '../tooltip/define.js';
import '../popover/define.js';
import { ModalElement } from '../modal/define.js';
import { SpinnerElement } from '../../components/spinner/define.js';
import { CheckboxElement } from '../../components/checkbox/define.js';
import { removeOverlaysWithin } from '../../core/overlay-registry.js';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll');
});

let tagCounter = 0;
/** Defines a fresh subclass under a new tag, so an element can be created before its class exists. */
function defineLate<T extends CustomElementConstructor>(base: T): string {
  const tag = `x-late-${++tagCounter}`;
  customElements.define(tag, class extends (base as any) {} as T);
  return tag;
}

describe('properties set before the element is defined', () => {
  it('an overlay opened with .open = true before upgrade opens once defined', () => {
    const tag = `x-late-${++tagCounter}`;
    const el = document.createElement(tag) as any;
    el.innerHTML = '<h2>Late</h2>';
    const onClose = vi.fn();
    el.open = true;
    el.onClose = onClose;
    document.body.appendChild(el);

    customElements.define(tag, class extends ModalElement {});

    expect(Object.prototype.hasOwnProperty.call(el, 'open')).toBe(false);
    expect(el.hasAttribute('open')).toBe(true);
    expect(document.querySelector('.a11y-modal-overlay')).not.toBeNull();

    el.open = false; // the accessor works again
    expect(el.hasAttribute('open')).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1); // the pre-upgrade callback survived the upgrade
  });

  it('a component property set before upgrade goes through its setter', () => {
    const tag = `x-late-${++tagCounter}`;
    const el = document.createElement(tag) as any;
    el.label = 'Saving';
    document.body.appendChild(el);

    customElements.define(tag, class extends SpinnerElement {});

    expect(Object.prototype.hasOwnProperty.call(el, 'label')).toBe(false);
    expect(el.getAttribute('aria-label')).toBe('Saving');
  });

  it('a pre-upgrade onChange callback is kept', () => {
    const tag = `x-late-${++tagCounter}`;
    const el = document.createElement(tag) as any;
    const onChange = vi.fn();
    el.onChange = onChange;
    customElements.define(tag, class extends CheckboxElement {});
    expect(el.onChange).toBe(onChange);
  });

  it('leaves elements created after definition alone', () => {
    const el = document.createElement(defineLate(SpinnerElement)) as any;
    document.body.appendChild(el);
    expect(el.getAttribute('aria-label')).toBe('Loading');
  });
});

describe('removeOverlaysWithin', () => {
  function host(): HTMLElement {
    const h = document.createElement('div');
    document.body.appendChild(h);
    return h;
  }

  it('removes exactly the overlays authored inside the host', () => {
    const h = host();
    h.innerHTML = '<section><a11y-modal id="m"><h2>M</h2></a11y-modal></section><a11y-snackbar id="s"></a11y-snackbar>';
    const other = host();
    other.innerHTML = '<a11y-modal id="keep"><h2>K</h2></a11y-modal>';
    expect(document.getElementById('m')!.parentNode).toBe(document.body); // portaled away from the host

    expect(removeOverlaysWithin(h)).toBe(2);
    expect(document.getElementById('m')).toBeNull();
    expect(document.getElementById('s')).toBeNull();
    expect(document.getElementById('keep')).not.toBeNull();
    expect(removeOverlaysWithin(h)).toBe(0);
  });

  it.each([false, true])('also removes overlays authored inside a removed overlay (modal open: %s)', (open) => {
    const h = host();
    h.innerHTML = '<a11y-modal id="m"><h2>M</h2><button id="b">b</button><a11y-tooltip id="t" anchor="b">Tip</a11y-tooltip></a11y-modal>';
    if (open) (document.getElementById('m') as HTMLElement & { open: boolean }).open = true;
    expect(removeOverlaysWithin(h)).toBe(2);
    expect(document.getElementById('m')).toBeNull();
    expect(document.getElementById('t')).toBeNull();
  });

  it('works after the host has left the document', () => {
    const h = host();
    h.innerHTML = '<a11y-modal id="m"><h2>M</h2></a11y-modal>';
    h.remove(); // e.g. the framework unmounted the component
    expect(document.getElementById('m')).not.toBeNull(); // the pitfall: the overlay outlived its host

    expect(removeOverlaysWithin(h)).toBe(1);
    expect(document.getElementById('m')).toBeNull();
  });

  it('tears down an open modal', () => {
    const h = host();
    h.innerHTML = '<a11y-modal id="m" open><h2>M</h2></a11y-modal>';
    expect(document.querySelector('.a11y-modal-overlay')).not.toBeNull();

    removeOverlaysWithin(h);
    expect(document.querySelector('.a11y-modal-overlay')).toBeNull();
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(false);
  });

  it('never removes an overlay appended straight to <body>', () => {
    const el = document.createElement('a11y-modal');
    document.body.appendChild(el);
    expect(removeOverlaysWithin(document.body)).toBe(0);
    expect(el.isConnected).toBe(true);
  });

  it('follows an overlay reconnected under another host', () => {
    const first = host();
    const second = host();
    const el = document.createElement('a11y-modal');
    first.appendChild(el);
    el.remove();
    second.appendChild(el);

    expect(removeOverlaysWithin(first)).toBe(0);
    expect(removeOverlaysWithin(second)).toBe(1);
  });
});

describe('focus returns to a clicked trigger that the browser did not focus (Safari)', () => {
  /** A click the way Safari delivers it on a button: pointerdown + click, but no focus. */
  function safariClick(el: HTMLElement): void {
    (document.activeElement as HTMLElement | null)?.blur();
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.activeElement).toBe(document.body);
    el.click();
  }

  it('modal', () => {
    document.body.innerHTML = '<button id="t">Open</button><a11y-modal id="m"><h2>M</h2><button>In</button></a11y-modal>';
    const trigger = document.getElementById('t')!;
    const modal = document.getElementById('m') as any;
    trigger.addEventListener('click', () => (modal.open = true));
    safariClick(trigger);
    expect(modal.contains(document.activeElement) || document.querySelector('.a11y-modal-wrapper')!.contains(document.activeElement)).toBe(true);
    modal.open = false;
    expect(document.activeElement).toBe(trigger);
  });

  it('dropdown', () => {
    document.body.innerHTML = '<button id="t">Actions</button><a11y-dropdown id="d" anchor="t"><div role="menuitem">Edit</div></a11y-dropdown>';
    const trigger = document.getElementById('t')!;
    safariClick(trigger);
    const menu = document.getElementById('d') as any;
    expect(menu.open).toBe(true);
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('blocking loader', () => {
    document.body.innerHTML = '<button id="t">Save</button><a11y-blocking-loader id="l"></a11y-blocking-loader>';
    const trigger = document.getElementById('t')!;
    const loader = document.getElementById('l') as any;
    trigger.addEventListener('click', () => (loader.open = true));
    safariClick(trigger);
    expect(document.activeElement).toBe(loader);
    loader.open = false;
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Escape with stacked overlays', () => {
  const escape = (target: EventTarget): boolean =>
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  it('closes a tooltip inside a modal, but not the modal', () => {
    const modal = document.createElement('a11y-modal') as ModalElement;
    modal.innerHTML = '<h2>Title</h2><button id="tip-anchor">Save</button><a11y-tooltip anchor="tip-anchor">Saves it</a11y-tooltip>';
    document.body.appendChild(modal);
    modal.open = true;
    const tooltip = document.querySelector('a11y-tooltip') as HTMLElement & { open: boolean };
    const button = document.getElementById('tip-anchor')!;
    button.focus();
    tooltip.open = true;

    escape(button);
    expect(tooltip.open).toBe(false);
    expect(modal.open).toBe(true);

    escape(button);
    expect(modal.open).toBe(false);
  });

  it('leaves the modal open when a widget inside it already handled Escape', () => {
    const modal = document.createElement('a11y-modal') as ModalElement;
    modal.innerHTML = '<h2>Title</h2><input>';
    document.body.appendChild(modal);
    modal.open = true;
    const input = modal.querySelector('input')!;
    input.addEventListener('keydown', (e) => e.preventDefault());
    escape(input);
    expect(modal.open).toBe(true);
  });
});

describe('nested anchored overlays', () => {
  type Openable = HTMLElement & { open: boolean };

  function popoverWithDropdown(interactive = false): { popover: Openable; dropdown: Openable } {
    document.body.innerHTML = `
      <button id="p-trigger">Info</button>
      <a11y-popover id="p" anchor="p-trigger"${interactive ? ' interactive' : ''}>
        <button id="d-trigger">Actions</button>
        <a11y-dropdown id="d" anchor="d-trigger"><button role="menuitem">Edit</button></a11y-dropdown>
      </a11y-popover>
      <input id="elsewhere">`;
    return { popover: document.getElementById('p') as Openable, dropdown: document.getElementById('d') as Openable };
  }

  it('a click inside a dropdown opened from a popover does not close the popover', () => {
    vi.useFakeTimers();
    try {
      const { popover, dropdown } = popoverWithDropdown();
      popover.open = true;
      vi.advanceTimersByTime(0); // outside-click listener is bound on the next tick
      dropdown.open = true;
      vi.advanceTimersByTime(0);
      dropdown.querySelector<HTMLElement>('[role="menuitem"]')!.click();
      expect(popover.open).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('Escape closes the most recently opened overlay first', () => {
    const { popover, dropdown } = popoverWithDropdown();
    popover.open = true;
    dropdown.open = true;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dropdown.open).toBe(false);
    expect(popover.open).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(popover.open).toBe(false);
  });

  it('an interactive popover leaves focus where an outside click put it', () => {
    vi.useFakeTimers();
    try {
      const { popover } = popoverWithDropdown(true);
      const trigger = document.getElementById('p-trigger')!;
      trigger.focus();
      popover.open = true;
      vi.advanceTimersByTime(0);
      expect(popover.contains(document.activeElement)).toBe(true);
      const input = document.getElementById('elsewhere') as HTMLInputElement;
      input.focus(); // what the mousedown does in a browser
      input.click();
      expect(popover.open).toBe(false);
      expect(document.activeElement).toBe(input);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('closing before the first frame', () => {
  it.each([
    ['a11y-modal', '.a11y-modal-wrapper'],
    ['a11y-popover', '.a11y-popover-wrapper'],
  ])('%s does not animate its closing chrome back in', (tag, wrapperSel) => {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => (frames.push(cb), frames.length));
    const style = document.createElement('style');
    style.textContent = `${wrapperSel} { transition-duration: 1s; }`;
    document.head.appendChild(style);
    try {
      document.body.innerHTML = `<button id="t">t</button><${tag} anchor="t"><h2>Hi</h2><button>x</button></${tag}>`;
      const el = document.querySelector(tag) as HTMLElement & { open: boolean };
      el.open = true;
      const wrapper = document.querySelector(wrapperSel)!;
      el.open = false; // still in its close transition
      frames.forEach((cb) => cb(0));
      expect(wrapper.classList.contains('a11y-is-open')).toBe(false);
    } finally {
      raf.mockRestore();
      style.remove();
    }
  });
});

describe('a modal opened from a menu item', () => {
  it("gives focus back to the menu's trigger when it closes, not to the hidden item", () => {
    document.body.innerHTML = `
      <button id="actions">Actions</button>
      <a11y-dropdown id="d" anchor="actions"><button role="menuitem" id="settings">Settings…</button></a11y-dropdown>
      <a11y-modal id="m"><h2>Settings</h2><button>OK</button></a11y-modal>`;
    const dropdown = document.getElementById('d') as HTMLElement & { open: boolean };
    const modal = document.getElementById('m') as HTMLElement & { open: boolean };
    const trigger = document.getElementById('actions')!;
    document.getElementById('settings')!.addEventListener('click', () => {
      modal.open = true;
    });
    trigger.focus();
    dropdown.open = true;
    expect(document.activeElement?.id).toBe('settings');
    document.getElementById('settings')!.click(); // opens the modal, then the menu closes ('item')
    expect(dropdown.open).toBe(false);
    expect(modal.contains(document.activeElement)).toBe(true);
    modal.open = false;
    expect(document.activeElement).toBe(trigger);
  });
});
