import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import type { SelectElement } from './select.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mount(innerHtml: string): SelectElement {
  const el = document.createElement('a11y-select') as SelectElement;
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

const OPTIONS = '<option value="us">United States</option><option value="ca">Canada</option>';

describe('a11y-select', () => {
  it('wraps a real <select> in a label.a11y-select and adds a11y-select__control class', () => {
    const el = mount(`<select name="country">${OPTIONS}</select>`);
    const select = el.querySelector('select')!;
    expect(select.classList.contains('a11y-select__control')).toBe(true);
    expect(select.closest('label')?.className).toBe('a11y-select');
    expect(select.querySelectorAll('option')).toHaveLength(2);
  });

  it('renders the label before the control (matches old rendered order)', () => {
    const el = mount(`<select>${OPTIONS}</select>`);
    el.setAttribute('label', 'Country');
    const wrapper = el.querySelector('label.a11y-select')!;
    expect(wrapper.firstElementChild?.className).toBe('a11y-select__label');
    expect(wrapper.firstElementChild?.textContent).toBe('Country');
  });

  it('renders no label span when the label attribute is absent', () => {
    const el = mount(`<select>${OPTIONS}</select>`);
    expect(el.querySelector('.a11y-select__label')).toBeNull();
  });

  it('getValue/setValue read and write the real select', () => {
    const el = mount(`<select>${OPTIONS}</select>`);
    expect(el.getValue()).toBe('us'); // first option is selected by default per native <select>
    el.setValue('ca');
    expect(el.querySelector('select')!.value).toBe('ca');
    expect(el.getValue()).toBe('ca');
  });

  it('calls onChange on native change, and never double-wires across repeated syncs', async () => {
    const el = mount(`<select>${OPTIONS}</select>`);
    const onChange = vi.fn();
    el.onChange = onChange;

    el.setAttribute('label', 'a');
    await flush();
    el.setAttribute('label', 'b');
    await flush();

    const select = el.querySelector('select')!;
    select.value = 'ca';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('ca');
  });

  it('preserves the live selected option across an unrelated host attribute change', async () => {
    const el = mount(`<select>${OPTIONS}</select>`);
    const select = el.querySelector('select')!;
    select.value = 'ca';

    el.setAttribute('label', 'now with a label');
    await flush();

    expect(el.querySelector('select')).toBe(select);
    expect(el.querySelector('select')!.value).toBe('ca');
  });

  it('does not throw and stays inert when there is no <select> child', () => {
    const el = mount('');
    expect(() => el.setAttribute('label', 'x')).not.toThrow();
    expect(el.getValue()).toBe('');
    expect(() => el.setValue('ca')).not.toThrow();
    expect(el.querySelector('label.a11y-select')).toBeNull();
  });
});
