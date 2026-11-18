function toMs(value: string): number {
  const n = parseFloat(value);
  if (Number.isNaN(n)) return 0;
  return value.trim().endsWith('ms') ? n : n * 1000;
}

/** The named property with the longest `duration + delay`, or `null` when it's `all`/unknown. */
function longestTransitionProperty(el: Element): string | null {
  const style = getComputedStyle(el);
  const properties = style.transitionProperty.split(',').map((p) => p.trim());
  const durations = style.transitionDuration.split(',').map(toMs);
  const delays = style.transitionDelay.split(',').map(toMs);
  let best: string | null = null;
  let bestMs = -1;
  // CSS repeats the shorter lists to match `transition-property`.
  properties.forEach((property, i) => {
    const total = (durations[i % durations.length] ?? 0) + (delays[i % delays.length] ?? 0);
    if (total > bestMs) {
      bestMs = total;
      best = property;
    }
  });
  return best && best !== 'all' && best !== 'none' ? best : null;
}

/** Longest `transition-duration + transition-delay` pair currently computed for `el`, in ms. */
function longestTransitionMs(el: Element): number {
  const style = getComputedStyle(el);
  const durations = style.transitionDuration.split(',').map(toMs);
  const delays = style.transitionDelay.split(',').map(toMs);
  return durations.reduce((max, d, i) => Math.max(max, d + (delays[i % delays.length] ?? 0)), 0);
}

/**
 * Calls `done` once `el`'s own close transition has finished, and returns a
 * function that cancels the wait (without calling `done`).
 *
 * A bare `transitionend` listener isn't enough on its own:
 * - it never fires when there's no transition at all — the default
 *   stylesheet not loaded, a `0s` duration, or a reduced-motion reset
 *   (`transition: none`) — which would leave the overlay stuck half-closed;
 * - it bubbles, so a descendant's unrelated transition (e.g. a hovered
 *   button's background fade) would end the wait early.
 *
 * - each transitioned property fires its own, so with `opacity .15s,
 *   transform .3s` the first one arrives halfway through.
 *
 * So: no computed transition → `done` runs synchronously; otherwise the
 * first `transitionend` targeting `el` itself for the longest-running
 * property (any, when that can't be told: `all`, or an event without a
 * `propertyName`), with a timeout fallback slightly past the computed
 * duration in case that event is never delivered (e.g. the longest property
 * didn't actually change).
 */
export function whenTransitionDone(el: Element, done: () => void): () => void {
  const ms = longestTransitionMs(el);
  if (ms <= 0) {
    done();
    return () => {};
  }

  const longest = longestTransitionProperty(el);
  let settled = false;
  const settle = (run: boolean): void => {
    if (settled) return;
    settled = true;
    el.removeEventListener('transitionend', onEnd);
    clearTimeout(timer);
    if (run) done();
  };
  const onEnd = (e: Event): void => {
    if (e.target !== el) return;
    // A shorter property's end (event from a real browser, which names the property): keep waiting.
    const property = (e as TransitionEvent).propertyName;
    if (longest && property && property !== longest) return;
    settle(true);
  };

  el.addEventListener('transitionend', onEnd);
  const timer = setTimeout(() => settle(true), ms + 50);
  return () => settle(false);
}
