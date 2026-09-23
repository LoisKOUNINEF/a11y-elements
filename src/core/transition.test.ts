import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenTransitionDone } from './transition.js';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function box(transition = ''): HTMLElement {
  const el = document.createElement('div');
  if (transition) el.style.cssText = transition;
  document.body.appendChild(el);
  return el;
}

describe('whenTransitionDone', () => {
  it('calls done synchronously when the element has no transition', () => {
    const done = vi.fn();
    whenTransitionDone(box(), done);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('waits for a transitionend targeting the element itself, ignoring bubbled ones', () => {
    const el = box('transition-duration: 0.3s');
    const child = el.appendChild(document.createElement('span'));
    const done = vi.fn();
    whenTransitionDone(el, done);

    child.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(done).not.toHaveBeenCalled();
    el.dispatchEvent(new Event('transitionend'));
    el.dispatchEvent(new Event('transitionend'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timeout just past duration + delay if transitionend never arrives', () => {
    vi.useFakeTimers();
    const el = box('transition-duration: 200ms, 0.1s; transition-delay: 100ms');
    const done = vi.fn();
    whenTransitionDone(el, done);
    vi.advanceTimersByTime(349);
    expect(done).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('returns a cancel function that prevents done from ever running', () => {
    vi.useFakeTimers();
    const el = box('transition-duration: 0.3s');
    const done = vi.fn();
    const cancel = whenTransitionDone(el, done);
    cancel();
    el.dispatchEvent(new Event('transitionend'));
    vi.advanceTimersByTime(1000);
    expect(done).not.toHaveBeenCalled();
  });
});
