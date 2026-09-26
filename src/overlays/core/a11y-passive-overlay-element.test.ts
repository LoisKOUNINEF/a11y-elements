import { afterEach, describe, expect, it, vi } from 'vitest';
import { A11yPassiveOverlayElement, type PassiveOverlayItem } from './a11y-passive-overlay-element.js';

class TestPassive extends A11yPassiveOverlayElement {
  shown: PassiveOverlayItem[] = [];

  protected _showItem(item: PassiveOverlayItem): void {
    this.shown.push(item);
  }

  dismissOne(): void {
    this._onItemDismissed();
  }

  autoDismiss(el: HTMLElement, duration: number, onDone: () => void) {
    return this._autoDismiss(el, duration, onDone);
  }

  push(item: PassiveOverlayItem): void {
    this.enqueue(item);
  }
}
customElements.define('test-passive-overlay', TestPassive);

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(): TestPassive {
  const el = document.createElement('test-passive-overlay') as TestPassive;
  document.body.appendChild(el);
  return el;
}

describe('A11yPassiveOverlayElement', () => {
  it('sets aria-live region attributes and portals itself to document.body on connect', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const el = document.createElement('test-passive-overlay') as TestPassive;
    host.appendChild(el);

    expect(el.parentNode).toBe(document.body);
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.getAttribute('aria-atomic')).toBe('false');
    expect(el.getAttribute('aria-relevant')).toBe('additions removals');
    expect(el.classList.contains('a11y-passive-overlay-region')).toBe(true);
  });

  it('shows up to 3 items at once by default, queueing the rest', () => {
    const el = mount();
    expect(el.maxStack).toBe(3);
    ['a', 'b', 'c', 'd'].forEach((message) => el.push({ message }));
    expect(el.shown.map((i) => i.message)).toEqual(['a', 'b', 'c']);
  });

  it('queues items beyond maxStack instead of showing them immediately', () => {
    const el = mount();
    el.setAttribute('max-stack', '1');
    el.push({ message: 'a' });
    el.push({ message: 'b' });
    expect(el.shown).toEqual([{ message: 'a' }]); // only the first shown
  });

  it('shows queued items as soon as max-stack is raised', () => {
    const el = mount();
    el.maxStack = 1;
    el.push({ message: 'a' });
    el.push({ message: 'b' });
    el.push({ message: 'c' });
    el.setAttribute('max-stack', '3');
    expect(el.shown.map((i) => i.message)).toEqual(['a', 'b', 'c']);
  });

  it('changing max-stack never re-renders the region, so its children survive', () => {
    const el = mount();
    const child = document.createElement('div');
    el.appendChild(child);
    el.setAttribute('max-stack', '5');
    expect(child.parentNode).toBe(el);
  });

  it('promotes the next queued item when one is dismissed', () => {
    const el = mount();
    el.setMaxStack(1);
    el.push({ message: 'a' });
    el.push({ message: 'b' });
    el.dismissOne();
    expect(el.shown).toEqual([{ message: 'a' }, { message: 'b' }]);
  });

  it('setMaxStack raises the concurrency limit and clamps below 1', () => {
    const el = mount();
    el.setMaxStack(2);
    el.push({ message: 'a' });
    el.push({ message: 'b' });
    expect(el.shown).toHaveLength(2);

    // setMaxStack(0) clamps to 1, but activeCount is still 2 from before, so a
    // new item is queued (not shown) until something is dismissed to make room.
    el.setMaxStack(0);
    el.push({ message: 'c' });
    expect(el.shown).toHaveLength(2);
  });

  it('_autoDismiss removes the element and calls onDone after the given duration', () => {
    vi.useFakeTimers();
    const el = mount();
    const item = document.createElement('div');
    document.body.appendChild(item);
    const onDone = vi.fn();

    el.autoDismiss(item, 3000, onDone);
    vi.advanceTimersByTime(2999);
    expect(document.body.contains(item)).toBe(true);
    expect(onDone).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(document.body.contains(item)).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
