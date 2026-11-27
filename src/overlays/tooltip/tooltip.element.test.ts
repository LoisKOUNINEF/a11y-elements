import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import { resetInputModality } from '../../core/input-modality.js';

let anchor: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  anchor = document.createElement('button');
  anchor.id = 'trigger';
  document.body.appendChild(anchor);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetInputModality();
  document.body.innerHTML = '';
});

/** A pointer event; jsdom has no `PointerEvent` constructor, so `pointerType` and coordinates are set by hand. */
function pointer(target: EventTarget, type: string, pointerType = 'mouse', x = 0, y = 0): Event {
  const e = new Event(type, { bubbles: type !== 'pointerenter' && type !== 'pointerleave', cancelable: true });
  Object.assign(e, { pointerType, clientX: x, clientY: y });
  target.dispatchEvent(e);
  return e;
}

/** Focuses `el` as the keyboard would: a Tab press, then the focus. */
function keyboardFocus(el: HTMLElement, key = 'Tab'): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  el.dispatchEvent(new FocusEvent('focus'));
}

function mount(): any {
  const el = document.createElement('a11y-tooltip') as any;
  el.setAttribute('anchor', 'trigger');
  el.textContent = 'Tooltip text';
  document.body.appendChild(el);
  return el;
}

describe('a11y-tooltip', () => {
  it('is role=tooltip and never focus-trapped', () => {
    const el = mount();
    el.open = true;
    expect(document.querySelector('.a11y-tooltip-wrapper')!.getAttribute('role')).toBe('tooltip');
  });

  it('shows after showDelay (default 300ms) on anchor mouse pointerenter', () => {
    const el = mount();
    pointer(anchor, 'pointerenter');
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(299);
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.open).toBe(true);
  });

  it('respects a custom show-delay/hide-delay attribute', () => {
    const el = mount();
    el.setAttribute('show-delay', '50');
    el.setAttribute('hide-delay', '20');
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(50);
    expect(el.open).toBe(true);

    pointer(anchor, 'pointerleave');
    vi.advanceTimersByTime(19);
    expect(el.open).toBe(true);
    vi.advanceTimersByTime(1);
    expect(el.open).toBe(false);
  });

  it('a fast mouse pointerenter -> pointerleave within showDelay never shows it at all', () => {
    const el = mount();
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(100);
    pointer(anchor, 'pointerleave');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('also shows/hides on keyboard focus/blur, not just mouse', () => {
    const el = mount();
    keyboardFocus(anchor);
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
    anchor.dispatchEvent(new FocusEvent('blur'));
    vi.advanceTimersByTime(100);
    expect(el.open).toBe(false);
  });

  it('close() hides but leaves the anchor listeners intact — it can reopen on the next hover', () => {
    const el = mount();
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);

    el.close();
    expect(el.open).toBe(false);

    pointer(anchor, 'pointerleave'); // reset state
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('dispose() detaches from the anchor permanently — no more reopening on hover', () => {
    const el = mount();
    el.dispose();
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });
});

describe('a11y-tooltip — anchor wiring and WCAG 1.4.13', () => {
  it('links the anchor via aria-describedby, preserving ids the consumer already set', () => {
    anchor.setAttribute('aria-describedby', 'hint');
    const el = mount();
    expect(el.id).toBeTruthy();
    expect(anchor.getAttribute('aria-describedby')!.split(' ')).toEqual(['hint', el.id]);

    el.remove();
    expect(anchor.getAttribute('aria-describedby')).toBe('hint');
  });

  it('rebinds when the anchor attribute changes', () => {
    const el = mount();
    const other = document.body.appendChild(document.createElement('button'));
    other.id = 'other';
    el.setAttribute('anchor', 'other');

    expect(anchor.hasAttribute('aria-describedby')).toBe(false);
    expect(other.getAttribute('aria-describedby')).toBe(el.id);
    pointer(other, 'pointerenter');
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('binds to an anchor set later via the anchorElement property', () => {
    const el = document.createElement('a11y-tooltip') as any;
    el.textContent = 'Late';
    document.body.appendChild(el); // no anchor yet
    el.anchorElement = anchor;
    keyboardFocus(anchor);
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('stays open while the pointer moves onto the tooltip itself', () => {
    const el = mount();
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(300);
    pointer(anchor, 'pointerleave');
    pointer(document.querySelector('.a11y-tooltip-wrapper')!, 'pointerenter');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(true);

    pointer(document.querySelector('.a11y-tooltip-wrapper')!, 'pointerleave');
    vi.advanceTimersByTime(100);
    expect(el.open).toBe(false);
  });
});

describe('a11y-tooltip — touch and clicks', () => {
  it('ignores touch and pen pointerenter (a tap emulates hover)', () => {
    const el = mount();
    pointer(anchor, 'pointerenter', 'touch');
    pointer(anchor, 'pointerenter', 'pen');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('ignores a focus that follows a click or tap', () => {
    const el = mount();
    keyboardFocus(anchor);
    vi.advanceTimersByTime(300);
    el.close();
    pointer(document.body, 'pointerdown', 'touch');
    anchor.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('shows on a focus that follows any key, even one whose default was prevented (Escape closing a modal)', () => {
    const el = mount();
    pointer(document.body, 'pointerdown');
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    escape.preventDefault();
    document.dispatchEvent(escape);
    anchor.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('a shortcut or lone modifier key after a click does not count as keyboard use', () => {
    const el = mount();
    pointer(document.body, 'pointerdown');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta', metaKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', shiftKey: true, bubbles: true }));
    anchor.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('before any input, follows :focus-visible (focus moved by script on load)', () => {
    const el = mount();
    anchor.dispatchEvent(new FocusEvent('focus')); // jsdom never matches :focus-visible
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);

    vi.spyOn(anchor, 'matches').mockImplementation((selector: string) => selector === ':focus-visible');
    anchor.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('before any input, shows on any focus when :focus-visible is unsupported', () => {
    const el = mount();
    vi.spyOn(anchor, 'matches').mockImplementation(() => {
      throw new SyntaxError('unsupported');
    });
    anchor.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('a tap (touch press shorter than the long press) never opens it, even with the focus that follows', () => {
    const el = mount();
    pointer(anchor, 'pointerenter', 'touch');
    pointer(anchor, 'pointerdown', 'touch');
    vi.advanceTimersByTime(100);
    pointer(anchor, 'pointerup', 'touch');
    pointer(anchor, 'pointerleave', 'touch');
    anchor.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(2000);
    expect(el.open).toBe(false);
  });

  it('a mouse press closes it, and hover only reopens it after the pointer leaves and comes back', () => {
    const el = mount();
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);

    pointer(anchor, 'pointerdown');
    expect(el.open).toBe(false);
    pointer(anchor, 'pointerenter'); // e.g. re-entering after a re-render, without leaving
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);

    pointer(anchor, 'pointerleave');
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('a mouse press cancels a pending show', () => {
    const el = mount();
    pointer(anchor, 'pointerenter');
    vi.advanceTimersByTime(200);
    pointer(anchor, 'pointerdown');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('a keyboard focus still shows it after a mouse press', () => {
    const el = mount();
    pointer(anchor, 'pointerdown');
    keyboardFocus(anchor);
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('a touch long press (500ms) shows it, and it stays after the finger lifts', () => {
    const el = mount();
    pointer(anchor, 'pointerdown', 'touch', 10, 10);
    vi.advanceTimersByTime(499);
    expect(el.open).toBe(false);
    vi.advanceTimersByTime(1);
    expect(el.open).toBe(true);
    pointer(anchor, 'pointerup', 'touch');
    pointer(anchor, 'pointerleave', 'touch');
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(true);
  });

  it('a pen long press shows it too', () => {
    const el = mount();
    pointer(anchor, 'pointerdown', 'pen');
    vi.advanceTimersByTime(500);
    expect(el.open).toBe(true);
  });

  it('lifting early, a cancel (scroll) or moving more than 10px cancels the long press; small jitter does not', () => {
    const el = mount();
    pointer(anchor, 'pointerdown', 'touch');
    pointer(anchor, 'pointerup', 'touch');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);

    pointer(anchor, 'pointerdown', 'touch');
    pointer(anchor, 'pointercancel', 'touch');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);

    pointer(anchor, 'pointerdown', 'touch', 0, 0);
    pointer(anchor, 'pointermove', 'touch', 0, 11);
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);

    pointer(anchor, 'pointerdown', 'touch', 0, 0);
    pointer(anchor, 'pointermove', 'touch', 6, 6);
    vi.advanceTimersByTime(500);
    expect(el.open).toBe(true);
  });

  it('a contextmenu during a pending long press (Android) opens it at once and suppresses the native menu', () => {
    const el = mount();
    pointer(anchor, 'pointerdown', 'touch');
    vi.advanceTimersByTime(300);
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(el.open).toBe(true);
  });

  it('leaves a contextmenu alone otherwise (desktop right-click)', () => {
    mount();
    pointer(anchor, 'pointerdown');
    const menu = new Event('contextmenu', { bubbles: true, cancelable: true });
    anchor.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
  });

  it('a long-pressed tooltip closes on a tap elsewhere, and on the next press on the anchor', () => {
    const el = mount();
    const other = document.body.appendChild(document.createElement('button'));
    pointer(anchor, 'pointerdown', 'touch');
    vi.advanceTimersByTime(500);
    vi.advanceTimersByTime(1); // the outside-click listener is attached on the next tick
    other.click();
    expect(el.open).toBe(false);

    pointer(anchor, 'pointerdown', 'touch');
    vi.advanceTimersByTime(500);
    pointer(anchor, 'pointerup', 'touch');
    expect(el.open).toBe(true);
    pointer(anchor, 'pointerdown', 'touch');
    expect(el.open).toBe(false);
    pointer(anchor, 'pointerup', 'touch'); // a tap: no reopening
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('ignores touch pointerleave from the tooltip itself (the finger lifting)', () => {
    const el = mount();
    pointer(anchor, 'pointerdown', 'touch');
    vi.advanceTimersByTime(500);
    pointer(document.querySelector('.a11y-tooltip-wrapper')!, 'pointerleave', 'touch');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(true);
  });

  it('dispose() also stops long presses', () => {
    const el = mount();
    pointer(anchor, 'pointerdown', 'touch');
    el.dispose();
    vi.advanceTimersByTime(1000);
    pointer(anchor, 'pointerdown', 'touch');
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });
});
