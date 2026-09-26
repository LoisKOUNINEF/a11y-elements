import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import type { CheckboxElement } from './checkbox.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mount(innerHtml: string): CheckboxElement {
  const el = document.createElement('a11y-checkbox') as CheckboxElement;
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('a11y-checkbox', () => {
  it('wraps a real <input type="checkbox"> in a label.a11y-checkbox with the a11y-checkbox__input class', () => {
    const el = mount('<input type="checkbox" name="terms">');
    const input = el.querySelector('input')!;
    expect(input.classList.contains('a11y-checkbox__input')).toBe(true);
    expect(input.closest('label')?.className).toBe('a11y-checkbox');
    expect(input.getAttribute('name')).toBe('terms'); // untouched, still the consumer's own attribute
  });

  it('never regenerates the input — native attributes work with zero enhancement', () => {
    const el = mount('<input type="checkbox" checked disabled required id="x" value="y">');
    const input = el.querySelector('input')!;
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(true);
    expect(input.required).toBe(true);
    expect(input.id).toBe('x');
    expect(input.value).toBe('y');
  });

  it('renders a visible label span from the label attribute', () => {
    const el = mount('<input type="checkbox">');
    el.setAttribute('label', 'Accept terms');
    expect(el.querySelector('.a11y-checkbox__label')?.textContent).toBe('Accept terms');
  });

  it('renders no label span when the label attribute is absent', () => {
    const el = mount('<input type="checkbox">');
    expect(el.querySelector('.a11y-checkbox__label')).toBeNull();
  });

  it('sets indeterminate from the attribute (no native HTML equivalent)', () => {
    const el = mount('<input type="checkbox">');
    el.setAttribute('indeterminate', '');
    expect(el.querySelector('input')!.indeterminate).toBe(true);
  });

  it('getValue/setValue read and write the real input', () => {
    const el = mount('<input type="checkbox">');
    expect(el.getValue()).toBe(false);
    el.setValue(true);
    expect(el.querySelector('input')!.checked).toBe(true);
    expect(el.getValue()).toBe(true);
  });

  it('calls onChange exactly once per native change event, with the current checked state', () => {
    const el = mount('<input type="checkbox">');
    const onChange = vi.fn();
    el.onChange = onChange;
    const input = el.querySelector('input')!;

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('the native change event bubbles out to the host element with zero custom code', () => {
    const el = mount('<input type="checkbox">');
    const spy = vi.fn();
    el.addEventListener('change', spy);
    el.querySelector('input')!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('preserves live checked state across an unrelated host attribute change (no regenerate-and-wipe bug)', async () => {
    const el = mount('<input type="checkbox">');
    const input = el.querySelector('input')!;
    input.checked = true; // simulate the user clicking it — live state, no attribute involved

    el.setAttribute('label', 'now with a label'); // unrelated re-sync trigger
    await flush();

    expect(el.querySelector('input')!.checked).toBe(true); // still checked, same input instance
    expect(el.querySelector('input')).toBe(input); // never regenerated
  });

  it('does not throw and stays inert when there is no <input> child', () => {
    const el = mount('');
    expect(() => el.setAttribute('label', 'x')).not.toThrow();
    expect(el.getValue()).toBe(false);
    expect(() => el.setValue(true)).not.toThrow();
    expect(el.querySelector('label.a11y-checkbox')).toBeNull();
  });

  it('does not double-wrap or double-wire the listener across repeated syncs', async () => {
    const el = mount('<input type="checkbox">');
    const onChange = vi.fn();
    el.onChange = onChange;

    el.setAttribute('label', 'a');
    await flush();
    el.setAttribute('label', 'b');
    await flush();

    expect(el.querySelectorAll('label.a11y-checkbox')).toHaveLength(1);

    el.querySelector('input')!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('a11y-checkbox — reparenting', () => {
  it('keeps calling onChange after being moved to a new parent (disconnect + reconnect)', () => {
    const el = mount('<input type="checkbox">');
    const onChange = vi.fn();
    el.onChange = onChange;
    document.body.appendChild(document.createElement('section')).appendChild(el);

    el.querySelector('input')!.click();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not double-fire after several reconnects', () => {
    const el = mount('<input type="checkbox">');
    const onChange = vi.fn();
    el.onChange = onChange;
    for (let i = 0; i < 3; i++) document.body.appendChild(el);

    el.querySelector('input')!.click();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
