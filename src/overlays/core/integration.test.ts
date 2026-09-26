import { afterEach, describe, expect, it, vi } from 'vitest';
import '../modal/define.js';
import '../snackbar/define.js';
import { ModalElement } from '../modal/define.js';
import { SpinnerElement } from '../../accessibility-components/spinner/define.js';
import { CheckboxElement } from '../../accessibility-components/checkbox/define.js';
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
