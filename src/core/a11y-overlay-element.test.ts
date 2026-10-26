import { afterEach, describe, expect, it, vi } from 'vitest';
import { A11yOverlayElement } from './a11y-overlay-element.js';
import { OVERLAY_CLOSE_EVENT, OVERLAY_OPEN_EVENT, dismissAllOverlays } from './overlay-registry.js';

class TestOverlay extends A11yOverlayElement {
  showCount = 0;
  hideCount = 0;
  lastHideImmediate: boolean | undefined;
  savedChildren: ChildNode[] = [];

  protected _show(): void {
    this.showCount++;
    this.classList.add('shown');
    this._onShown('test-overlay');
  }

  protected _hide(opts?: { immediate?: boolean }): void {
    this.hideCount++;
    this.lastHideImmediate = opts?.immediate;
    this.classList.remove('shown');
    this._onHidden('test-overlay');
  }
}

customElements.define('test-a11y-overlay', TestOverlay);

afterEach(() => {
  document.body.innerHTML = '';
});

describe('A11yOverlayElement', () => {
  it('portals itself to be a direct child of document.body on connect', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    host.appendChild(overlay);
    expect(overlay.parentNode).toBe(document.body);
  });

  it('does not call _show() on connect when the open attribute is absent', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.appendChild(overlay);
    expect(overlay.showCount).toBe(0);
  });

  it('calls _show() on connect when authored with the open attribute already set', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    overlay.setAttribute('open', '');
    document.body.appendChild(overlay);
    expect(overlay.showCount).toBe(1);
  });

  it('setting .open = true calls _show(), setting it false calls _hide()', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.appendChild(overlay);

    overlay.open = true;
    expect(overlay.showCount).toBe(1);
    expect(overlay.hasAttribute('open')).toBe(true);

    overlay.open = false;
    expect(overlay.hideCount).toBe(1);
    expect(overlay.hasAttribute('open')).toBe(false);
  });

  it('show()/close() are convenience wrappers around the same attribute', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.appendChild(overlay);

    overlay.show();
    expect(overlay.open).toBe(true);
    expect(overlay.showCount).toBe(1);

    overlay.close();
    expect(overlay.open).toBe(false);
    expect(overlay.hideCount).toBe(1);
  });

  it('setting open="" directly as an attribute (declarative HTML usage) also triggers _show()', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.appendChild(overlay);
    overlay.setAttribute('open', '');
    expect(overlay.showCount).toBe(1);
    overlay.removeAttribute('open');
    expect(overlay.hideCount).toBe(1);
  });

  it('emits standardized a11y-overlay-open/close events on document', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.appendChild(overlay);
    const openSpy = vi.fn();
    const closeSpy = vi.fn();
    document.addEventListener(OVERLAY_OPEN_EVENT, openSpy);
    document.addEventListener(OVERLAY_CLOSE_EVENT, closeSpy);

    overlay.open = true;
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect((openSpy.mock.calls[0]![0] as CustomEvent).detail).toEqual({ name: 'test-overlay', element: overlay });

    overlay.open = false;
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect((closeSpy.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      name: 'test-overlay',
      element: overlay,
      reason: 'api',
    });

    document.removeEventListener(OVERLAY_OPEN_EVENT, openSpy);
    document.removeEventListener(OVERLAY_CLOSE_EVENT, closeSpy);
  });

  it('dispatches the events on the overlay itself, bubbling', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.appendChild(overlay);
    const targets: EventTarget[] = [];
    overlay.addEventListener(OVERLAY_OPEN_EVENT, (e) => targets.push(e.target!));
    overlay.addEventListener(OVERLAY_CLOSE_EVENT, (e) => targets.push(e.target!));

    overlay.open = true;
    overlay.open = false;
    expect(targets).toEqual([overlay, overlay]);
  });

  describe('close reason', () => {
    function closeReasons(overlay: TestOverlay): Array<string | undefined> {
      const reasons: Array<string | undefined> = [];
      document.addEventListener(OVERLAY_CLOSE_EVENT, (e) => {
        if ((e as CustomEvent).detail.element === overlay) reasons.push((e as CustomEvent).detail.reason);
      });
      return reasons;
    }

    it('reports the reason given to close(), then resets to api', () => {
      const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
      document.body.appendChild(overlay);
      const reasons = closeReasons(overlay);

      overlay.open = true;
      overlay.close('escape');
      overlay.open = true;
      overlay.removeAttribute('open');
      expect(reasons).toEqual(['escape', 'api']);
    });

    it("doesn't let a close() on a closed overlay label the next close", () => {
      const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
      document.body.appendChild(overlay);
      const reasons = closeReasons(overlay);

      overlay.close('backdrop');
      overlay.open = true;
      overlay.open = false;
      expect(reasons).toEqual(['api']);
    });

    it('reports dismiss-all from dismissAllOverlays()', () => {
      const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
      document.body.appendChild(overlay);
      const reasons = closeReasons(overlay);

      overlay.open = true;
      dismissAllOverlays();
      expect(reasons).toEqual(['dismiss-all']);
    });

    it('reports removed, on document, when removed while open', () => {
      const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
      document.body.appendChild(overlay);
      const events: CustomEvent[] = [];
      document.addEventListener(OVERLAY_CLOSE_EVENT, (e) => events.push(e as CustomEvent));

      overlay.open = true;
      overlay.remove();
      expect(events.at(-1)!.detail).toEqual({ name: 'test-overlay', element: overlay, reason: 'removed' });
      expect(events.at(-1)!.target).toBe(document);
    });
  });

  it('dismissAllOverlays() closes every currently-open overlay instance', () => {
    const a = document.createElement('test-a11y-overlay') as TestOverlay;
    const b = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.append(a, b);
    a.open = true;
    b.open = true;

    dismissAllOverlays();

    expect(a.hideCount).toBe(1);
    expect(b.hideCount).toBe(1);
    expect(a.open).toBe(false);
    expect(b.open).toBe(false);
  });

  it('force-hides immediately (no transition wait) if removed from the DOM while open', () => {
    const overlay = document.createElement('test-a11y-overlay') as TestOverlay;
    document.body.appendChild(overlay);
    overlay.open = true;
    overlay.remove();
    expect(overlay.hideCount).toBe(1); // forced by disconnectedCallback, since _hide() was never called via the open attribute
    expect(overlay.lastHideImmediate).toBe(true);
  });
});

describe('overlay-registry — shared page-wide state', () => {
  it('keeps its state on globalThis, so separately-bundled copies of this module share one registry', () => {
    const state = (globalThis as unknown as Record<symbol, { openOverlays: Set<unknown> }>)[Symbol.for('a11y-elements/overlay-state')];
    expect(state).toBeDefined();
    const fake = { close: vi.fn() };
    state!.openOverlays.add(fake); // as another bundle's copy would
    dismissAllOverlays();
    expect(fake.close).toHaveBeenCalledTimes(1);
    state!.openOverlays.delete(fake);
  });
});
