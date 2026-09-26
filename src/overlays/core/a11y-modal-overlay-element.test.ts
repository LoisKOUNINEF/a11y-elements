import { afterEach, describe, expect, it } from 'vitest';
import { A11yModalOverlayElement } from './a11y-modal-overlay-element.js';

class TestModal extends A11yModalOverlayElement {}
customElements.define('test-modal-overlay', TestModal);

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.classList.remove('a11y-no-scroll');
});

function mount(innerHtml = '<h2>Title</h2><p>Body</p>'): TestModal {
  const el = document.createElement('test-modal-overlay') as TestModal;
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('A11yModalOverlayElement', () => {
  it('closes on Escape after a click inside moved focus to <body>', () => {
    const el = mount();
    el.open = true;
    (document.activeElement as HTMLElement).blur();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(el.open).toBe(false);
  });

  it('builds a backdrop > wrapper[role=dialog][aria-modal] > content chrome around itself on open', () => {
    const el = mount();
    el.open = true;

    const backdrop = document.querySelector('.a11y-modal-overlay')!;
    const wrapper = backdrop.querySelector('.a11y-modal-wrapper')!;
    expect(wrapper.getAttribute('role')).toBe('dialog');
    expect(wrapper.getAttribute('aria-modal')).toBe('true');
    expect(wrapper.contains(el)).toBe(true);
    expect(el.classList.contains('a11y-modal-content')).toBe(true);
  });

  it('locks page scroll on open and unlocks it after close completes', () => {
    const el = mount();
    el.open = true;
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(true);

    (document.querySelector('.a11y-modal-wrapper') as HTMLElement).style.transitionDuration = '0.3s';
    el.open = false;
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(true);
    document.querySelector('.a11y-modal-wrapper')!.dispatchEvent(new Event('transitionend'));
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(false);
  });

  it('auto-labels the wrapper from a heading in its content', () => {
    const el = mount('<h2>My Dialog</h2>');
    el.open = true;
    const heading = el.querySelector('h2')!;
    const wrapper = document.querySelector('.a11y-modal-wrapper')!;
    expect(heading.id).toBeTruthy();
    expect(wrapper.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('uses dialog-label as the accessible name (aria-label), without touching any heading id', () => {
    const withHeading = mount('<h2>Title</h2>');
    withHeading.setAttribute('dialog-label', 'Account settings');
    withHeading.open = true;
    const wrapper = withHeading.closest('.a11y-modal-wrapper')!;
    expect(wrapper.getAttribute('aria-label')).toBe('Account settings');
    expect(wrapper.hasAttribute('aria-labelledby')).toBe(false);
    expect(withHeading.querySelector('h2')!.id).toBe('');

    const noHeading = mount('<p>No heading here</p>');
    noHeading.setAttribute('dialog-label', 'Settings');
    noHeading.open = true;
    expect(noHeading.closest('.a11y-modal-wrapper')!.getAttribute('aria-label')).toBe('Settings');
  });

  it('keeps an existing heading id, and generates unique ids otherwise', () => {
    const own = mount('<h2 id="my-title">Mine</h2>');
    own.open = true;
    expect(own.querySelector('h2')!.id).toBe('my-title');
    expect(own.closest('.a11y-modal-wrapper')!.getAttribute('aria-labelledby')).toBe('my-title');

    const a = mount('<h2>A</h2>');
    const b = mount('<h2>B</h2>');
    a.open = true;
    b.open = true;
    const [idA, idB] = [a.querySelector('h2')!.id, b.querySelector('h2')!.id];
    expect(idA).toBeTruthy();
    expect(idA).not.toBe(idB);
    expect(b.closest('.a11y-modal-wrapper')!.getAttribute('aria-labelledby')).toBe(idB);
  });

  it('prepends a close button by default, and clicking it closes the dialog', () => {
    const el = mount();
    el.open = true;
    const btn = el.querySelector<HTMLButtonElement>('.a11y-modal-close-button')!;
    expect(btn.getAttribute('aria-label')).toBe('Close dialog');
    btn.click();
    expect(el.open).toBe(false);
  });

  it('closes when clicking the backdrop itself, not the content', () => {
    const el = mount();
    el.open = true;
    const backdrop = document.querySelector<HTMLElement>('.a11y-modal-overlay')!;

    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(el.open).toBe(true); // click on content, not backdrop — must not close

    backdrop.dispatchEvent(new MouseEvent('click'));
    expect(el.open).toBe(false);
  });

  it('does not render a close button and does not close on backdrop click when non-dismissible', () => {
    const el = mount();
    el.setAttribute('non-dismissible', '');
    el.open = true;
    expect(el.querySelector('.a11y-modal-close-button')).toBeNull();

    document.querySelector<HTMLElement>('.a11y-modal-overlay')!.dispatchEvent(new MouseEvent('click'));
    expect(el.open).toBe(true);
  });

  it('activates a focus trap on open (first focusable content element receives focus)', () => {
    const el = mount('<h2>Title</h2><button>OK</button>');
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('button'));
  });

  it('falls back to focusing the wrapper when non-dismissible with zero content (no close button, nothing focusable)', () => {
    const el = mount('');
    el.setAttribute('non-dismissible', '');
    expect(() => (el.open = true)).not.toThrow();

    const wrapper = document.querySelector('.a11y-modal-wrapper')!;
    expect(document.activeElement).toBe(wrapper);
    expect(wrapper.getAttribute('tabindex')).toBe('-1');
  });

  it('is transition-gated on close: content stays mounted until transitionend, then portals back to body', () => {
    const el = mount();
    el.open = true;
    const wrapper = document.querySelector<HTMLElement>('.a11y-modal-wrapper')!;
    wrapper.style.transitionDuration = '0.3s'; // jsdom computes no CSS transitions

    el.open = false;
    expect(document.body.contains(wrapper)).toBe(true);
    expect(el.classList.contains('a11y-modal-content')).toBe(true);

    wrapper.dispatchEvent(new Event('transitionend'));
    expect(document.body.contains(wrapper)).toBe(false);
    expect(document.body.contains(el)).toBe(true);
    // Removed once fully hidden (not just added on show) so the CSS
    // default-hidden rule keyed on this class — see modal.css's `a11y-modal`
    // rule — actually re-hides the element once the close transition finishes.
    expect(el.classList.contains('a11y-modal-content')).toBe(false);
  });
});

describe('A11yModalOverlayElement — lifecycle regressions', () => {
  const animate = (): void => {
    document.querySelectorAll<HTMLElement>('.a11y-modal-wrapper').forEach((w) => (w.style.transitionDuration = '0.3s'));
  };

  it('never stacks close buttons across open/close cycles', () => {
    const el = mount();
    for (let i = 0; i < 3; i++) {
      el.open = true;
      el.open = false;
    }
    el.open = true;
    expect(el.querySelectorAll('.a11y-modal-close-button')).toHaveLength(1);
    el.open = false;
    expect(el.querySelectorAll('.a11y-modal-close-button')).toHaveLength(0);
  });

  it('reopening during the close transition completes that close first, leaving a working dialog', () => {
    const el = mount();
    el.open = true;
    animate();
    const oldWrapper = document.querySelector('.a11y-modal-wrapper')!;
    el.open = false; // close transition pending
    el.open = true; // reopened before it finished

    oldWrapper.dispatchEvent(new Event('transitionend')); // late event from the old chrome: must be a no-op
    const wrappers = document.querySelectorAll('.a11y-modal-wrapper');
    expect(wrappers).toHaveLength(1);
    expect(wrappers[0]!.contains(el)).toBe(true);
    expect(el.classList.contains('a11y-modal-content')).toBe(true);
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(true);
  });

  it('completes the close immediately when there is no CSS transition to wait for', () => {
    const el = mount();
    el.open = true;
    el.open = false; // jsdom: no stylesheet → no computed transition
    expect(document.querySelector('.a11y-modal-wrapper')).toBeNull();
    expect(el.parentElement).toBe(document.body);
  });

  it('ignores transitionend bubbling up from a descendant', () => {
    const el = mount('<h2>T</h2><button>Inner</button>');
    el.open = true;
    animate();
    el.open = false;
    el.querySelector('button')!.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(document.querySelector('.a11y-modal-wrapper')).not.toBeNull();
  });

  it('stays removed when the consumer removes it while open', () => {
    const el = mount();
    el.open = true;
    el.remove();
    expect(el.isConnected).toBe(false);
    expect(document.querySelector('.a11y-modal-overlay')).toBeNull();
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(false);
  });

  it('keeps the page scroll-locked until the last of two stacked modals closes', () => {
    const a = mount();
    const b = mount();
    a.open = true;
    b.open = true;
    b.open = false;
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(true);
    a.open = false;
    expect(document.documentElement.classList.contains('a11y-no-scroll')).toBe(false);
  });
});
