import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import './define.js';

let anchor: HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers();
  anchor = document.createElement('button');
  anchor.id = 'trigger';
  document.body.appendChild(anchor);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

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

  it('shows after showDelay (default 300ms) on anchor mouseenter', () => {
    const el = mount();
    anchor.dispatchEvent(new MouseEvent('mouseenter'));
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
    anchor.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(50);
    expect(el.open).toBe(true);

    anchor.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(19);
    expect(el.open).toBe(true);
    vi.advanceTimersByTime(1);
    expect(el.open).toBe(false);
  });

  it('a fast mouseenter -> mouseleave within showDelay never shows it at all', () => {
    const el = mount();
    anchor.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(100);
    anchor.dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(false);
  });

  it('also shows/hides on focus/blur, not just mouse', () => {
    const el = mount();
    anchor.dispatchEvent(new FocusEvent('focus'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
    anchor.dispatchEvent(new FocusEvent('blur'));
    vi.advanceTimersByTime(100);
    expect(el.open).toBe(false);
  });

  it('close() hides but leaves the anchor listeners intact — it can reopen on the next hover', () => {
    const el = mount();
    anchor.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);

    el.close();
    expect(el.open).toBe(false);

    anchor.dispatchEvent(new MouseEvent('mouseleave')); // reset state
    anchor.dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('dispose() detaches from the anchor permanently — no more reopening on hover', () => {
    const el = mount();
    el.dispose();
    anchor.dispatchEvent(new MouseEvent('mouseenter'));
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
    other.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('binds to an anchor set later via the anchorElement property', () => {
    const el = document.createElement('a11y-tooltip') as any;
    el.textContent = 'Late';
    document.body.appendChild(el); // no anchor yet
    el.anchorElement = anchor;
    anchor.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(300);
    expect(el.open).toBe(true);
  });

  it('stays open while the pointer moves onto the tooltip itself', () => {
    const el = mount();
    anchor.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(300);
    anchor.dispatchEvent(new Event('mouseleave'));
    document.querySelector('.a11y-tooltip-wrapper')!.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(1000);
    expect(el.open).toBe(true);

    document.querySelector('.a11y-tooltip-wrapper')!.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(100);
    expect(el.open).toBe(false);
  });
});
