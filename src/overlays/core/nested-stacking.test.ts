import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../modal/define.js';
import '../drawer/define.js';
import '../tooltip/define.js';
import '../popover/define.js';
import '../dropdown/define.js';
import '../context-menu/define.js';
import '../snackbar/define.js';
import '../blocking-loader/define.js';
import { findOverlayChromeRoot } from '../../core/overlay-registry.js';

type Openable = HTMLElement & { open: boolean };

// jsdom doesn't load the package CSS: just the z-indexes the stacking code reads.
let style: HTMLStyleElement;
beforeEach(() => {
  style = document.createElement('style');
  style.textContent = `
    .a11y-modal-overlay { z-index: 510; }
    .a11y-drawer-backdrop { z-index: 520; }
    .a11y-popover-wrapper { z-index: 310; }
    .a11y-passive-overlay-region { z-index: 400; }
    .a11y-blocking-loader-overlay { z-index: 600; }`;
  document.head.appendChild(style);
});

afterEach(() => {
  for (const el of Array.from(document.querySelectorAll<Openable>('[open]'))) el.open = false;
  document.body.innerHTML = '';
  style.remove();
  document.documentElement.classList.remove('a11y-no-scroll');
});

const wrapperOf = (el: Element): HTMLElement => el.parentElement as HTMLElement;

function modalWith(html: string, tag = 'a11y-modal'): Openable {
  const modal = document.createElement(tag) as Openable;
  modal.innerHTML = `<h2>Title</h2>${html}`;
  document.body.appendChild(modal);
  modal.open = true;
  return modal;
}

describe('findOverlayChromeRoot', () => {
  it("returns an open modal's backdrop for a node inside it", () => {
    modalWith('<button id="inside">Save</button>');
    expect(findOverlayChromeRoot(document.getElementById('inside'))).toBe(document.querySelector('.a11y-modal-overlay'));
  });

  it('ignores the overlay passed as except', () => {
    const modal = modalWith('<button id="inside">Save</button>');
    expect(findOverlayChromeRoot(document.getElementById('inside'), modal)).toBeNull();
  });

  it('returns null outside any overlay, and for null', () => {
    document.body.innerHTML = '<main><button id="outside">Save</button></main>';
    expect(findOverlayChromeRoot(document.getElementById('outside'))).toBeNull();
    expect(findOverlayChromeRoot(null)).toBeNull();
  });
});

describe('anchored overlays opened inside another overlay', () => {
  it('a tooltip in a modal records the modal z-index as its parent', () => {
    modalWith('<button id="a">Save</button><a11y-tooltip id="t" anchor="a">Saves it</a11y-tooltip>');
    const tooltip = document.getElementById('t') as Openable;
    tooltip.open = true;
    const wrapper = wrapperOf(tooltip);
    expect(wrapper.classList.contains('a11y-is-nested')).toBe(true);
    expect(wrapper.style.getPropertyValue('--a11y-z-parent')).toBe('510');
  });

  it("a tooltip in a drawer uses the drawer's backdrop", () => {
    modalWith('<button id="a">Save</button><a11y-tooltip id="t" anchor="a">Saves it</a11y-tooltip>', 'a11y-drawer');
    const tooltip = document.getElementById('t') as Openable;
    tooltip.open = true;
    expect(wrapperOf(tooltip).style.getPropertyValue('--a11y-z-parent')).toBe('520');
  });

  it('a tooltip authored elsewhere but anchored inside a modal is nested too', () => {
    modalWith('<button id="a">Save</button>');
    const tooltip = document.createElement('a11y-tooltip') as Openable;
    tooltip.setAttribute('anchor', 'a');
    tooltip.textContent = 'Saves it';
    document.body.appendChild(tooltip);
    tooltip.open = true;
    expect(wrapperOf(tooltip).style.getPropertyValue('--a11y-z-parent')).toBe('510');
  });

  it('a dropdown in a popover stacks above the popover', () => {
    document.body.innerHTML = `
      <button id="p-trigger">Info</button>
      <a11y-popover id="p" anchor="p-trigger">
        <button id="d-trigger">Actions</button>
        <a11y-dropdown id="d" anchor="d-trigger"><button role="menuitem">Edit</button></a11y-dropdown>
      </a11y-popover>`;
    (document.getElementById('p') as Openable).open = true;
    const dropdown = document.getElementById('d') as Openable;
    dropdown.open = true;
    expect(wrapperOf(dropdown).style.getPropertyValue('--a11y-z-parent')).toBe('310');
  });

  it('a context menu uses its trigger', () => {
    modalWith('<div id="area">Right-click me</div><a11y-context-menu id="c" trigger="area"><button role="menuitem">Copy</button></a11y-context-menu>');
    const area = document.getElementById('area')!;
    area.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    const menu = document.getElementById('c') as Openable;
    expect(menu.open).toBe(true);
    expect(wrapperOf(menu).style.getPropertyValue('--a11y-z-parent')).toBe('510');
  });

  it('a tooltip outside any overlay is not nested', () => {
    document.body.innerHTML = '<button id="a">Save</button><a11y-tooltip id="t" anchor="a">Saves it</a11y-tooltip>';
    const tooltip = document.getElementById('t') as Openable;
    tooltip.open = true;
    const wrapper = wrapperOf(tooltip);
    expect(wrapper.classList.contains('a11y-is-nested')).toBe(false);
    expect(wrapper.style.getPropertyValue('--a11y-z-parent')).toBe('');
  });
});

describe('passive regions while a modal layer is open', () => {
  const root = document.documentElement;

  it("exposes the top modal's z-index on <html> while it's open", () => {
    const modal = modalWith('<p>Body</p>');
    expect(root.classList.contains('a11y-modal-layer-open')).toBe(true);
    expect(root.style.getPropertyValue('--a11y-z-modal-layer')).toBe('510');

    const drawer = modalWith('<p>Body</p>', 'a11y-drawer');
    expect(root.style.getPropertyValue('--a11y-z-modal-layer')).toBe('520');

    drawer.open = false;
    modal.open = false;
  });

  it('clears it once the modal closes', () => {
    const modal = modalWith('<p>Body</p>');
    modal.open = false;
    expect(root.classList.contains('a11y-modal-layer-open')).toBe(false);
    expect(root.style.getPropertyValue('--a11y-z-modal-layer')).toBe('');
  });

  it('clears it under a blocking loader, which inerts the regions too', () => {
    const modal = modalWith('<p>Body</p>');
    const loader = document.createElement('a11y-blocking-loader') as Openable;
    document.body.appendChild(loader);
    loader.open = true;
    expect(root.classList.contains('a11y-modal-layer-open')).toBe(false);

    loader.open = false;
    expect(root.classList.contains('a11y-modal-layer-open')).toBe(true);
    modal.open = false;
  });
});
