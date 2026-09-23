import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import './define.js';

let trigger: HTMLDivElement;

beforeEach(() => {
  trigger = document.createElement('div');
  trigger.id = 'canvas';
  document.body.appendChild(trigger);
});

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(): any {
  const el = document.createElement('a11y-context-menu') as any;
  el.setAttribute('trigger', 'canvas');
  el.innerHTML = `
    <div role="menuitem">Copy</div>
    <div role="menuitem">Paste</div>
  `;
  document.body.appendChild(el);
  return el;
}

function contextMenuAt(x: number, y: number): MouseEvent {
  return new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y });
}

describe('a11y-context-menu', () => {
  it('opens at the click point on the trigger contextmenu event, preventing the native menu', () => {
    const el = mount();
    const evt = contextMenuAt(100, 200);
    trigger.dispatchEvent(evt);

    expect(evt.defaultPrevented).toBe(true);
    expect(el.open).toBe(true);
    expect(document.querySelector('.a11y-context-menu-wrapper')).not.toBeNull();
  });

  it('re-right-clicking while already open repositions in place rather than no-op-ing', () => {
    const el = mount();
    trigger.dispatchEvent(contextMenuAt(100, 200));
    expect(document.querySelectorAll('.a11y-context-menu-wrapper')).toHaveLength(1);

    trigger.dispatchEvent(contextMenuAt(300, 400));
    expect(el.open).toBe(true);
    expect(document.querySelectorAll('.a11y-context-menu-wrapper')).toHaveLength(1); // still exactly one, not stacked
  });

  it('dispose() unbinds the trigger — no more opening on right-click', () => {
    const el = mount();
    el.dispose();
    trigger.dispatchEvent(contextMenuAt(100, 200));
    expect(el.open).toBe(false);
  });

  it('supports the .triggerElement JS property as an alternative to the trigger attribute', () => {
    const el = document.createElement('a11y-context-menu') as any;
    el.innerHTML = '<div role="menuitem">Copy</div>';
    document.body.appendChild(el);
    const otherTrigger = document.createElement('div');
    document.body.appendChild(otherTrigger);

    el.triggerElement = otherTrigger;
    otherTrigger.dispatchEvent(contextMenuAt(10, 10));
    expect(el.open).toBe(true);
  });
});

describe('a11y-context-menu — trigger changes', () => {
  it('rebinds when the trigger attribute changes', () => {
    const el = mount();
    const other = document.body.appendChild(document.createElement('div'));
    other.id = 'other';
    el.setAttribute('trigger', 'other');

    trigger.dispatchEvent(contextMenuAt(10, 10));
    expect(el.open).toBe(false);
    other.dispatchEvent(contextMenuAt(10, 10));
    expect(el.open).toBe(true);
  });

  it('re-right-clicking while open leaves exactly one wrapper and one set of listeners', () => {
    const el = mount();
    trigger.dispatchEvent(contextMenuAt(10, 10));
    trigger.dispatchEvent(contextMenuAt(50, 50));
    expect(document.querySelectorAll('.a11y-context-menu-wrapper')).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el.open).toBe(false);
    expect(document.querySelectorAll('.a11y-context-menu-wrapper')).toHaveLength(0);
  });
});
