import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import type { CheckboxGroupElement } from './checkbox-group.element.js';
import { resetStrings, setStrings } from '../../core/strings.js';

afterEach(() => {
  document.body.innerHTML = '';
  resetStrings();
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const OPTIONS = `
  <label><input type="checkbox" name="toppings" value="cheese"> Cheese</label>
  <label><input type="checkbox" name="toppings" value="ham"> Ham</label>
  <label><input type="checkbox" name="toppings" value="olives"> Olives</label>
`;

function mount(innerHtml: string = OPTIONS, attrs: Record<string, string> = {}): CheckboxGroupElement {
  const el = document.createElement('a11y-checkbox-group') as CheckboxGroupElement;
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

function option(el: CheckboxGroupElement, value: string): HTMLInputElement {
  return el.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
}

function selectAllInput(el: CheckboxGroupElement): HTMLInputElement | null {
  return el.querySelector<HTMLInputElement>('.a11y-checkbox-group__select-all input');
}

/** A user toggle: flips `checked` and fires `change`, like a real click. */
function toggle(input: HTMLInputElement): void {
  input.click();
}

describe('a11y-checkbox-group', () => {
  it('wraps the options in a fieldset and styles them as checkboxes', () => {
    const el = mount();
    const fieldset = el.querySelector('fieldset.a11y-checkbox-group')!;
    expect(fieldset).not.toBeNull();
    const inputs = [...fieldset.querySelectorAll('input')];
    expect(inputs).toHaveLength(3);
    expect(inputs.every((i) => i.classList.contains('a11y-checkbox__input'))).toBe(true);
    expect([...fieldset.querySelectorAll('label')].every((l) => l.classList.contains('a11y-checkbox'))).toBe(true);
  });

  it('renders a legend, or falls back to aria-label', () => {
    const el = mount();
    el.setAttribute('aria-label', 'Toppings');
    const fieldset = el.querySelector('fieldset')!;
    expect(fieldset.getAttribute('aria-label')).toBe('Toppings');
    el.setAttribute('legend', 'Pick toppings');
    expect(fieldset.querySelector('legend')?.textContent).toBe('Pick toppings');
    expect(fieldset.hasAttribute('aria-label')).toBe(false);
  });

  it('propagates disabled to the fieldset', () => {
    const el = mount();
    el.setAttribute('disabled', '');
    expect((el.querySelector('fieldset') as HTMLFieldSetElement).disabled).toBe(true);
  });

  it('builds no select-all control without the select-all attribute', () => {
    const el = mount();
    expect(selectAllInput(el)).toBeNull();
  });

  it('adds and removes the select-all control with the attribute, right after the legend', () => {
    const el = mount(OPTIONS, { legend: 'Toppings', 'select-all': '' });
    const wrapper = el.querySelector('.a11y-checkbox-group__select-all')!;
    expect(wrapper.previousElementSibling?.tagName).toBe('LEGEND');
    expect(wrapper.textContent).toBe('Select all');
    el.removeAttribute('select-all');
    expect(selectAllInput(el)).toBeNull();
    el.setAttribute('select-all', '');
    expect(selectAllInput(el)).not.toBeNull();
  });

  it('never submits the select-all checkbox and leaves it out of getValue()', () => {
    const el = mount(OPTIONS, { 'select-all': '' });
    const selectAll = selectAllInput(el)!;
    expect(selectAll.hasAttribute('name')).toBe(false);
    toggle(selectAll);
    expect(el.getValue()).toEqual(['cheese', 'ham', 'olives']);
  });

  it('reflects the options: unchecked, indeterminate, then checked', () => {
    const el = mount(OPTIONS, { 'select-all': '' });
    const selectAll = selectAllInput(el)!;
    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(false);

    toggle(option(el, 'cheese'));
    expect(selectAll.checked).toBe(false);
    expect(selectAll.indeterminate).toBe(true);

    toggle(option(el, 'ham'));
    toggle(option(el, 'olives'));
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
  });

  it('checks every option from a partial selection, then unchecks them all', () => {
    const el = mount(OPTIONS, { 'select-all': '' });
    toggle(option(el, 'ham'));
    const selectAll = selectAllInput(el)!;

    toggle(selectAll);
    expect(el.getValue()).toEqual(['cheese', 'ham', 'olives']);
    expect(selectAll.checked).toBe(true);

    toggle(selectAll);
    expect(el.getValue()).toEqual([]);
    expect(selectAll.checked).toBe(false);
  });

  it('skips disabled options, which keep their own state', () => {
    const el = mount(
      `
      <label><input type="checkbox" value="cheese"> Cheese</label>
      <label><input type="checkbox" value="ham" disabled> Ham</label>
      <label><input type="checkbox" value="olives" disabled checked> Olives</label>
    `,
      { 'select-all': '' },
    );
    const selectAll = selectAllInput(el)!;
    toggle(selectAll);
    expect(el.getValue()).toEqual(['cheese', 'olives']);
    expect(selectAll.checked).toBe(true); // every *enabled* option is checked
    toggle(selectAll);
    expect(el.getValue()).toEqual(['olives']);
  });

  it('disables the select-all checkbox when no option is enabled', () => {
    const el = mount('<label><input type="checkbox" value="a" disabled> A</label>', { 'select-all': '' });
    expect(selectAllInput(el)!.disabled).toBe(true);
  });

  it('calls onChange once per select-all click, and fires input/change on each changed option', () => {
    const el = mount(OPTIONS, { 'select-all': '' });
    toggle(option(el, 'cheese'));
    const onChange = vi.fn();
    el.onChange = onChange;
    const changes: string[] = [];
    const inputs: string[] = [];
    for (const value of ['cheese', 'ham', 'olives']) {
      option(el, value).addEventListener('change', () => changes.push(value));
      option(el, value).addEventListener('input', () => inputs.push(value));
    }

    toggle(selectAllInput(el)!);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['cheese', 'ham', 'olives']);
    expect(changes).toEqual(['ham', 'olives']); // cheese was already checked
    expect(inputs).toEqual(['ham', 'olives']);
  });

  it('calls onChange with the checked values when a single option changes', () => {
    const el = mount();
    const onChange = vi.fn();
    el.onChange = onChange;
    toggle(option(el, 'ham'));
    expect(onChange).toHaveBeenCalledWith(['ham']);
  });

  it('relabels the select-all checkbox from select-all-label or setStrings({ selectAll })', () => {
    const el = mount(OPTIONS, { 'select-all': '' });
    const label = () => el.querySelector('.a11y-checkbox-group__select-all')!.textContent;
    setStrings({ selectAll: 'Tout sélectionner' });
    expect(label()).toBe('Tout sélectionner');
    el.setAttribute('select-all-label', 'All toppings');
    expect(label()).toBe('All toppings');
  });

  it('setValue / selectAll / unselectAll update the options and the select-all state, silently', () => {
    const el = mount(OPTIONS, { 'select-all': '' });
    const onChange = vi.fn();
    el.onChange = onChange;
    const selectAll = selectAllInput(el)!;

    el.setValue(['ham']);
    expect(el.getValue()).toEqual(['ham']);
    expect(selectAll.indeterminate).toBe(true);

    el.selectAll();
    expect(el.getValue()).toEqual(['cheese', 'ham', 'olives']);
    expect(selectAll.checked).toBe(true);

    el.unselectAll();
    expect(el.getValue()).toEqual([]);
    expect(selectAll.checked).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('picks up options added later', async () => {
    const el = mount(OPTIONS, { 'select-all': '' });
    el.selectAll();
    const extra = document.createElement('label');
    extra.innerHTML = '<input type="checkbox" value="basil"> Basil';
    el.querySelector('fieldset')!.appendChild(extra);
    await flush();
    expect(extra.classList.contains('a11y-checkbox')).toBe(true);
    expect(selectAllInput(el)!.indeterminate).toBe(true);
  });
});
