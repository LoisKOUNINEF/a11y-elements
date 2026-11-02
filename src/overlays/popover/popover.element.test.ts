import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './define.js';

let anchor: HTMLButtonElement;

beforeEach(() => {
  anchor = document.createElement('button');
  anchor.id = 'trigger';
  document.body.appendChild(anchor);
});

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(): HTMLElement & { open: boolean } {
  const el = document.createElement('a11y-popover') as HTMLElement & { open: boolean };
  el.setAttribute('anchor', 'trigger');
  el.textContent = 'content';
  document.body.appendChild(el);
  return el;
}

describe('a11y-popover', () => {
  it('is role=region and not focus-trapped by default', () => {
    const el = mount();
    el.open = true;
    expect(document.querySelector('.a11y-popover-wrapper')!.getAttribute('role')).toBe('region');
    // no focus trap: Escape closes directly, since wantsFocusTrap() is false
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.open).toBe(false);
  });

  it('interactive=true makes it role=dialog and focus-trapped', () => {
    const el = mount();
    el.setAttribute('interactive', '');
    el.innerHTML = '<button>OK</button>';
    el.open = true;
    expect(document.querySelector('.a11y-popover-wrapper')!.getAttribute('role')).toBe('dialog');
    expect(document.activeElement).toBe(el.querySelector('button'));
  });

  it('an explicit trap-focus="false" overrides interactive=true (no focus trap, Escape closes directly)', () => {
    const el = mount();
    el.setAttribute('interactive', '');
    el.setAttribute('trap-focus', 'false');
    el.innerHTML = '<button>OK</button>';
    el.open = true;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.open).toBe(false); // only happens via the non-trapped document-level Escape listener
  });

  it('a bare trap-focus attribute forces the trap on even without interactive', () => {
    const el = mount();
    el.setAttribute('trap-focus', '');
    el.innerHTML = '<button>OK</button>';
    el.open = true;
    expect(document.activeElement).toBe(el.querySelector('button'));
  });

  it('calls onClose after the close transition completes', () => {
    const el = mount();
    const onClose = vi.fn();
    (el as any).onClose = onClose;
    el.open = true;
    (document.querySelector('.a11y-anchored-overlay-wrapper') as HTMLElement).style.transitionDuration = '0.3s';
    el.open = false;
    expect(onClose).not.toHaveBeenCalled();
    document.querySelector('.a11y-anchored-overlay-wrapper')!.dispatchEvent(new Event('transitionend'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('a11y-popover — accessible name', () => {
  const wrapper = () => document.querySelector('.a11y-popover-wrapper')!;

  it('is named by its anchor by default', () => {
    const el = mount();
    el.open = true;
    expect(wrapper().getAttribute('aria-labelledby')).toBe('trigger');
  });

  it('prefers its first heading', () => {
    const el = mount();
    el.innerHTML = '<h3 id="pop-title">Details</h3><p>…</p>';
    el.open = true;
    expect(wrapper().getAttribute('aria-labelledby')).toBe('pop-title');
  });

  it('prefers label over both, also when set while open', () => {
    const el = mount();
    el.open = true;
    el.setAttribute('label', 'More info');
    expect(wrapper().getAttribute('aria-label')).toBe('More info');
    expect(wrapper().hasAttribute('aria-labelledby')).toBe(false);
  });
});
