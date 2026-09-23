import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import type { SwitchElement } from './switch.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mount(innerHtml: string): SwitchElement {
  const el = document.createElement('a11y-switch') as SwitchElement;
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('a11y-switch', () => {
  it('wraps the input in a label.a11y-switch, adds a11y-switch__input class and role=switch', () => {
    const el = mount('<input type="checkbox">');
    const input = el.querySelector('input')!;
    expect(input.classList.contains('a11y-switch__input')).toBe(true);
    expect(input.getAttribute('role')).toBe('switch');
    expect(input.closest('label')?.className).toBe('a11y-switch');
  });

  it('renders a visible label span from the label attribute', () => {
    const el = mount('<input type="checkbox">');
    el.setAttribute('label', 'Enable notifications');
    expect(el.querySelector('.a11y-switch__label')?.textContent).toBe('Enable notifications');
  });

  it('getValue/setValue read and write the real input', () => {
    const el = mount('<input type="checkbox">');
    el.setValue(true);
    expect(el.getValue()).toBe(true);
    expect(el.querySelector('input')!.checked).toBe(true);
  });

  it('calls onChange on native change, and never double-wires across repeated syncs', async () => {
    const el = mount('<input type="checkbox">');
    const onChange = vi.fn();
    el.onChange = onChange;

    el.setAttribute('label', 'a');
    await flush();
    el.setAttribute('label', 'b');
    await flush();

    const input = el.querySelector('input')!;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('preserves live checked state across an unrelated host attribute change', async () => {
    const el = mount('<input type="checkbox">');
    const input = el.querySelector('input')!;
    input.checked = true;

    el.setAttribute('label', 'now with a label');
    await flush();

    expect(el.querySelector('input')).toBe(input);
    expect(el.querySelector('input')!.checked).toBe(true);
  });

  it('does not throw and stays inert when there is no <input> child', () => {
    const el = mount('');
    expect(() => el.setAttribute('label', 'x')).not.toThrow();
    expect(el.getValue()).toBe(false);
    expect(() => el.setValue(true)).not.toThrow();
    expect(el.querySelector('label.a11y-switch')).toBeNull();
  });
});
