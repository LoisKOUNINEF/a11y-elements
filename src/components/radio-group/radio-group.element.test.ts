import { afterEach, describe, expect, it, vi } from 'vitest';
import './define.js';
import type { RadioGroupElement } from './radio-group.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const OPTIONS = `
  <label><input type="radio" name="plan" value="basic"> Basic</label>
  <label><input type="radio" name="plan" value="pro"> Pro</label>
`;

function mount(innerHtml: string = OPTIONS): RadioGroupElement {
  const el = document.createElement('a11y-radio-group') as RadioGroupElement;
  el.innerHTML = innerHtml;
  document.body.appendChild(el);
  return el;
}

describe('a11y-radio-group', () => {
  it('wraps the consumer-authored options in a fieldset.a11y-radio-group', () => {
    const el = mount();
    const fieldset = el.querySelector('fieldset.a11y-radio-group')!;
    expect(fieldset).not.toBeNull();
    expect(fieldset.querySelectorAll('input[type="radio"]')).toHaveLength(2);
  });

  it('adds the a11y-radio__input class to every radio without touching name/value/etc.', () => {
    const el = mount();
    const inputs = [...el.querySelectorAll('input[type="radio"]')];
    expect(inputs.every((i) => i.classList.contains('a11y-radio__input'))).toBe(true);
    expect(inputs.map((i) => (i as HTMLInputElement).value)).toEqual(['basic', 'pro']);
    expect(inputs.every((i) => (i as HTMLInputElement).name === 'plan')).toBe(true);
  });

  it('renders a legend and removes any aria-label (legend already names the fieldset natively)', () => {
    const el = mount();
    el.setAttribute('aria-label', 'ignored once legend is set');
    el.setAttribute('legend', 'Choose a plan');
    const fieldset = el.querySelector('fieldset')!;
    expect(fieldset.querySelector('legend')?.textContent).toBe('Choose a plan');
    expect(fieldset.hasAttribute('aria-label')).toBe(false);
  });

  it('falls back to aria-label on the fieldset when there is no legend', () => {
    const el = mount();
    el.setAttribute('aria-label', 'Choose a plan');
    const fieldset = el.querySelector('fieldset')!;
    expect(fieldset.querySelector('legend')).toBeNull();
    expect(fieldset.getAttribute('aria-label')).toBe('Choose a plan');
  });

  it('propagates disabled to the fieldset, which natively disables every descendant control', () => {
    const el = mount();
    el.setAttribute('disabled', '');
    const fieldset = el.querySelector('fieldset')! as HTMLFieldSetElement;
    expect(fieldset.disabled).toBe(true);
  });

  it('getValue returns the checked option value, empty string when none checked', () => {
    const el = mount();
    expect(el.getValue()).toBe('');
    el.querySelectorAll('input')[1]!.checked = true;
    expect(el.getValue()).toBe('pro');
  });

  it('setValue checks the matching option by value', () => {
    const el = mount();
    el.setValue('pro');
    expect(el.querySelectorAll('input')[1]!.checked).toBe(true);
    expect(el.querySelectorAll('input')[0]!.checked).toBe(false);
  });

  it('calls onChange with the newly-checked value via delegated change, only for actually-checked radios', () => {
    const el = mount();
    const onChange = vi.fn();
    el.onChange = onChange;
    const [basic, pro] = [...el.querySelectorAll<HTMLInputElement>('input')];

    pro!.checked = true;
    pro!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('pro');

    // An unchecked radio's change event (shouldn't normally fire, but guard anyway) is ignored.
    basic!.checked = false;
    basic!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('preserves the live checked selection across an unrelated host attribute change', async () => {
    const el = mount();
    const pro = el.querySelectorAll<HTMLInputElement>('input')[1]!;
    pro.checked = true;

    el.setAttribute('legend', 'now with a legend');
    await flush();

    expect(el.querySelectorAll('input')[1]).toBe(pro);
    expect(pro.checked).toBe(true);
  });

  it('does not create a fieldset and stays inert when there are no radio inputs', () => {
    const el = mount('');
    expect(() => el.setAttribute('legend', 'x')).not.toThrow();
    expect(el.querySelector('fieldset.a11y-radio-group')).toBeNull();
    expect(el.getValue()).toBe('');
    expect(() => el.setValue('pro')).not.toThrow();
  });

  it('does not double-wrap or double-wire across repeated syncs', async () => {
    const el = mount();
    const onChange = vi.fn();
    el.onChange = onChange;

    el.setAttribute('legend', 'a');
    await flush();
    el.setAttribute('legend', 'b');
    await flush();

    expect(el.querySelectorAll('fieldset.a11y-radio-group')).toHaveLength(1);

    const pro = el.querySelectorAll<HTMLInputElement>('input')[1]!;
    pro.checked = true;
    pro.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
