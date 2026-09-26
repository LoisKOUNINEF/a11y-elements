import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FocusTrapHelper, focusReturnTarget } from './focus-trap.js';

let container: HTMLElement;
let outside: HTMLButtonElement;

beforeEach(() => {
  outside = document.createElement('button');
  outside.textContent = 'outside';
  document.body.appendChild(outside);

  container = document.createElement('div');
  container.innerHTML = `
    <button id="first">First</button>
    <button id="middle">Middle</button>
    <button id="last">Last</button>
  `;
  document.body.appendChild(container);
});

afterEach(() => {
  document.body.innerHTML = '';
});

function tab(target: HTMLElement, shiftKey = false): void {
  const evt = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(evt);
}

function escape(target: HTMLElement): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

describe('FocusTrapHelper', () => {
  it('still handles Escape after focus falls back to <body> (click on non-focusable content inside)', () => {
    const onDeactivate = vi.fn();
    const trap = new FocusTrapHelper({ container, options: { onDeactivate } });
    trap.activate();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    escape(document.body);
    expect(onDeactivate).toHaveBeenCalledTimes(1);
    trap.deactivate();
  });

  it('keeps Tab inside the trap after focus falls back to <body>', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    (document.activeElement as HTMLElement).blur();
    tab(document.body);
    expect(document.activeElement).toBe(container.querySelector('#first'));
    trap.deactivate();
  });

  it('ignores key presses from elements outside its container', () => {
    const onDeactivate = vi.fn();
    const trap = new FocusTrapHelper({ container, options: { onDeactivate } });
    trap.activate();
    escape(outside);
    expect(onDeactivate).not.toHaveBeenCalled();
    trap.deactivate();
  });

  it('only the topmost of stacked traps handles a key press', () => {
    const onLower = vi.fn();
    const onUpper = vi.fn();
    const upperContainer = document.createElement('div');
    upperContainer.innerHTML = '<button>Upper</button>';
    document.body.appendChild(upperContainer);
    const lower = new FocusTrapHelper({ container, options: { onDeactivate: onLower } });
    const upper = new FocusTrapHelper({ container: upperContainer, options: { onDeactivate: onUpper } });
    lower.activate();
    upper.activate();

    escape(document.body);
    expect(onUpper).toHaveBeenCalledTimes(1);
    expect(onLower).not.toHaveBeenCalled();

    upper.deactivate();
    escape(document.body);
    expect(onLower).toHaveBeenCalledTimes(1);
    lower.deactivate();
  });

  it('focuses the first focusable element on activate', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    expect(document.activeElement).toBe(container.querySelector('#first'));
  });

  it('falls back to focusing the container itself when nothing inside is focusable', () => {
    const empty = document.createElement('div');
    document.body.appendChild(empty);
    const trap = new FocusTrapHelper({ container: empty });
    trap.activate();
    expect(document.activeElement).toBe(empty);
    expect(empty.getAttribute('tabindex')).toBe('-1');
  });

  it('wraps Tab from the last element back to the first', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    const last = container.querySelector<HTMLElement>('#last')!;
    last.focus();
    tab(container);
    expect(document.activeElement).toBe(container.querySelector('#first'));
  });

  it('wraps Shift+Tab from the first element back to the last', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    tab(container, true);
    expect(document.activeElement).toBe(container.querySelector('#last'));
  });

  it('moves focus to the next element when Tab is pressed on a middle element', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    const middle = container.querySelector<HTMLElement>('#middle')!;
    middle.focus();
    const evt = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    container.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container.querySelector('#last'));
  });

  it('moves focus to the previous element when Shift+Tab is pressed on a middle element', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    const middle = container.querySelector<HTMLElement>('#middle')!;
    middle.focus();
    tab(container, true);
    expect(document.activeElement).toBe(container.querySelector('#first'));
  });

  it('excludes disabled elements from the focusable set', () => {
    container.innerHTML = `
      <button id="first">First</button>
      <button id="disabled-btn" disabled>Disabled</button>
      <button id="last">Last</button>
    `;
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    tab(container);
    expect(document.activeElement).toBe(container.querySelector('#last'));
  });

  it('calls onDeactivate on Escape by default', () => {
    const onDeactivate = vi.fn();
    const trap = new FocusTrapHelper({ container, options: { onDeactivate } });
    trap.activate();
    escape(container);
    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('does not call onDeactivate on Escape when escapeDeactivates is false', () => {
    const onDeactivate = vi.fn();
    const trap = new FocusTrapHelper({ container, options: { onDeactivate, escapeDeactivates: false } });
    trap.activate();
    escape(container);
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it('restores focus to the previously active element on deactivate by default', () => {
    outside.focus();
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    trap.deactivate();
    expect(document.activeElement).toBe(outside);
  });

  it('does not restore focus when returnFocusOnDeactivate is false', () => {
    outside.focus();
    const trap = new FocusTrapHelper({ container, options: { returnFocusOnDeactivate: false } });
    trap.activate();
    trap.deactivate();
    expect(document.activeElement).not.toBe(outside);
  });

  it('is idempotent: activating twice or deactivating twice is a no-op the second time', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    const firstActive = document.activeElement;
    container.querySelector<HTMLElement>('#middle')!.focus();
    trap.activate(); // no-op, must not re-capture focus
    expect(document.activeElement).not.toBe(firstActive);
    trap.deactivate();
    trap.deactivate(); // no-op, must not throw
    expect(trap.getIsActive()).toBe(false);
  });

  it('does not touch `inert` anywhere by default (no hardcoded #app assumption)', () => {
    const appLike = document.createElement('div');
    appLike.id = 'app';
    document.body.appendChild(appLike);
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    // jsdom has no default `inert` reflection (reading an untouched element's
    // `.inert` is `undefined`, not `false`); what matters is the trap never
    // sets it, i.e. it stays falsy either way.
    expect(appLike.inert).toBeFalsy();
    trap.deactivate();
    expect(appLike.inert).toBeFalsy();
  });

  it('marks the configured inertTarget inert while active, via element or selector', () => {
    const shell = document.createElement('div');
    shell.id = 'a11y-shell';
    document.body.appendChild(shell);

    const byElement = new FocusTrapHelper({ container, options: { inertTarget: shell } });
    byElement.activate();
    expect(shell.inert).toBe(true);
    byElement.deactivate();
    expect(shell.inert).toBe(false);

    const bySelector = new FocusTrapHelper({ container, options: { inertTarget: '#a11y-shell' } });
    bySelector.activate();
    expect(shell.inert).toBe(true);
    bySelector.deactivate();
    expect(shell.inert).toBe(false);
  });

  it('updateFocusableElements re-queries so newly-added children participate in wrapping', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    const extra = document.createElement('button');
    extra.id = 'extra';
    container.appendChild(extra);
    trap.updateFocusableElements();
    extra.focus();
    tab(container);
    expect(document.activeElement).toBe(container.querySelector('#first'));
  });
});

describe('FocusTrapHelper — dynamic content', () => {
  it('reaches elements added after activation', () => {
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    const added = container.appendChild(document.createElement('button'));
    const last = container.querySelector<HTMLElement>('#last')!;
    last.focus();
    tab(container);
    expect(document.activeElement).toBe(added);
    trap.deactivate();
  });

  it('skips elements inside hidden or inert subtrees', () => {
    container.querySelector('#middle')!.setAttribute('hidden', '');
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    expect(document.activeElement!.id).toBe('first');
    tab(container);
    expect(document.activeElement!.id).toBe('last');
    trap.deactivate();
  });
});

describe('FocusTrapHelper — which elements are Tab stops', () => {
  it('skips native controls with a negative tabindex and includes <summary>, contenteditable and tabindex=0', () => {
    container.innerHTML = `
      <button id="a">A</button>
      <button id="neg" tabindex="-1">Negative</button>
      <a id="neg-link" href="#x" tabindex="-2">Negative link</a>
      <details><summary id="sum">More</summary><p>Body</p></details>
      <div id="edit" contenteditable>Editable</div>
      <div id="off" contenteditable="false">Not editable</div>
      <input id="hidden-input" type="hidden">
      <div id="zero" tabindex="0">Zero</div>
    `;
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    const order = [document.activeElement!.id];
    for (let i = 0; i < 4; i++) {
      tab(document.activeElement as HTMLElement);
      order.push(document.activeElement!.id);
    }
    expect(order).toEqual(['a', 'sum', 'edit', 'zero', 'a']);
    trap.deactivate();
  });
});

describe('focusReturnTarget — triggers the browser did not focus (Safari)', () => {
  const press = (el: Element): void => void el.dispatchEvent(new Event('pointerdown', { bubbles: true }));

  it('returns the focused element when there is one', () => {
    outside.focus();
    press(container.querySelector('#first')!);
    expect(focusReturnTarget()).toBe(outside);
  });

  it('falls back to the last pressed focusable element (or its focusable ancestor) when focus is on <body>', () => {
    const icon = document.createElement('span');
    outside.appendChild(icon);
    (document.activeElement as HTMLElement | null)?.blur();
    press(icon); // a click on an icon inside the button, which Safari leaves unfocused
    expect(document.activeElement).toBe(document.body);
    expect(focusReturnTarget()).toBe(outside);
  });

  it('ignores a pressed element that has since been removed', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    press(outside);
    outside.remove();
    expect(focusReturnTarget()).toBe(document.body);
  });

  it('a trap returns focus to a trigger that was pressed but never focused', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    press(outside);
    const trap = new FocusTrapHelper({ container });
    trap.activate();
    trap.deactivate();
    expect(document.activeElement).toBe(outside);
  });
});

