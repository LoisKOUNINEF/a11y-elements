import { afterEach, describe, expect, it, vi } from 'vitest';
import { A11yElement } from './a11y-element.js';

class TestElement extends A11yElement {
  static get observedAttributes(): string[] {
    return ['label', 'flag'];
  }

  beforeCount = 0;
  afterCount = 0;
  disconnectCount = 0;
  lastClickHandlerCallCount = 0;

  protected onBeforeRender(): void {
    this.beforeCount++;
    this.classList.add('test-root');
  }

  protected render(): string {
    return `<button class="inner">${this.stringAttr('label', 'default')}</button>`;
  }

  protected onAfterRender(): void {
    this.afterCount++;
    const btn = this.querySelector<HTMLButtonElement>('.inner');
    if (btn) this.listen(btn, 'click', () => { this.lastClickHandlerCallCount++; });
  }

  protected onDisconnect(): void {
    this.disconnectCount++;
  }

  fireTestEvent(detail: unknown) {
    return this.emit('test-event', detail);
  }

  testSetCssVar(name: string, value: string | null | undefined): void {
    this.setCssVar(name, value);
  }

  testBoolAttr(name: string): boolean {
    return this.boolAttr(name);
  }

  testSetBoolAttr(name: string, value: boolean): void {
    this.setBoolAttr(name, value);
  }
}

customElements.define('test-a11y-element', TestElement);

function mount(): TestElement {
  const el = document.createElement('test-a11y-element') as TestElement;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('A11yElement', () => {
  it('renders on connect: onBeforeRender -> render() -> innerHTML -> onAfterRender', () => {
    const el = mount();
    expect(el.beforeCount).toBe(1);
    expect(el.afterCount).toBe(1);
    expect(el.classList.contains('test-root')).toBe(true);
    expect(el.querySelector('.inner')?.textContent).toBe('default');
  });

  it('re-renders synchronously when an observed attribute changes while connected', () => {
    const el = mount();
    el.setAttribute('label', 'updated');
    expect(el.querySelector('.inner')?.textContent).toBe('updated');
    expect(el.beforeCount).toBe(2);
  });

  it('does not re-render for a non-observed attribute', () => {
    const el = mount();
    el.setAttribute('data-unrelated', 'x');
    expect(el.beforeCount).toBe(1);
  });

  it('does not re-render when an attribute is set to the same value twice in a row', () => {
    const el = mount();
    el.setAttribute('label', 'x'); // real change: null -> 'x'
    const countAfterRealChange = el.beforeCount;
    el.setAttribute('label', 'x'); // no-op: 'x' -> 'x'
    expect(el.beforeCount).toBe(countAfterRealChange);
  });

  it('listeners wired in onAfterRender fire exactly once per click and are not duplicated across re-renders', () => {
    const el = mount();
    const oldBtn = el.querySelector<HTMLButtonElement>('.inner')!;
    oldBtn.click();
    expect(el.lastClickHandlerCallCount).toBe(1);

    // Re-render replaces innerHTML; onAfterRender wires a fresh listener on the new button.
    el.setAttribute('flag', '');
    const newBtn = el.querySelector<HTMLButtonElement>('.inner')!;
    expect(newBtn).not.toBe(oldBtn);
    newBtn.click();
    expect(el.lastClickHandlerCallCount).toBe(2); // exactly one more, not zero (dead) or two (duplicated)

    // The old, detached button's listener must have been removed, not merely orphaned.
    oldBtn.click();
    expect(el.lastClickHandlerCallCount).toBe(2);
  });

  it('cleans up listeners and calls onDisconnect when removed from the DOM', () => {
    const el = mount();
    const btn = el.querySelector<HTMLButtonElement>('.inner')!;
    el.remove();
    expect(el.disconnectCount).toBe(1);
    btn.click();
    expect(el.lastClickHandlerCallCount).toBe(0);
  });

  it('does not react to attribute changes while disconnected', () => {
    const el = mount();
    el.remove();
    el.setAttribute('label', 'while-detached');
    expect(el.beforeCount).toBe(1);
  });

  it('emit() dispatches a bubbling CustomEvent with detail', () => {
    const el = mount();
    const spy = vi.fn();
    document.addEventListener('test-event', spy as EventListener);
    el.fireTestEvent({ ok: true });
    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0]![0] as CustomEvent;
    expect(evt.detail).toEqual({ ok: true });
    expect(evt.bubbles).toBe(true);
    document.removeEventListener('test-event', spy as EventListener);
  });

  it('attribute helpers read/write correctly', () => {
    const el = mount();
    expect(el.testBoolAttr('flag')).toBe(false);
    el.testSetBoolAttr('flag', true);
    expect(el.hasAttribute('flag')).toBe(true);
    el.testSetBoolAttr('flag', false);
    expect(el.hasAttribute('flag')).toBe(false);
  });

  it('setCssVar sets and removes a custom property based on truthiness', () => {
    const el = mount();
    el.testSetCssVar('--x', '10px');
    expect(el.style.getPropertyValue('--x')).toBe('10px');
    el.testSetCssVar('--x', undefined);
    expect(el.style.getPropertyValue('--x')).toBe('');
  });
});
