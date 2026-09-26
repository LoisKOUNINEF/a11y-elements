import { afterEach, describe, expect, it, vi } from 'vitest';
import '../label/define.js';
import './define.js';
import type { InputElement } from './input.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const FIELD = `
  <a11y-label>Email</a11y-label>
  <input type="email" name="email" required>
  <a11y-hint>We never share it.</a11y-hint>
  <a11y-error></a11y-error>
`;

function mount(innerHtml: string = FIELD, attrs = ''): { el: InputElement; form: HTMLFormElement; input: HTMLInputElement } {
  const form = document.createElement('form');
  form.innerHTML = `<a11y-input ${attrs}>${innerHtml}</a11y-input>`;
  document.body.appendChild(form);
  const el = form.querySelector('a11y-input')!;
  return { el, form, input: el.querySelector('input')! };
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

const states = (el: InputElement) => [...((el as any).internals.states as Set<string>)];

describe('a11y-input', () => {
  it('is form-associated', () => {
    expect((customElements.get('a11y-input') as any).formAssociated).toBe(true);
  });

  it('never regenerates the input — it keeps its name and submits itself', () => {
    const { form, input } = mount();
    type(input, 'a@b.co');
    expect(new FormData(form).getAll('email')).toEqual(['a@b.co']);
    expect(input.required).toBe(true);
  });

  it('links the label, hint and error to the input, synchronously', () => {
    const { el, input } = mount();
    const label = el.querySelector('label.a11y-label')!;
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.labels?.[0]).toBe(label);
    expect(input.hasAttribute('aria-labelledby')).toBe(false);
    expect(input.getAttribute('aria-describedby')).toBe(el.querySelector('a11y-hint')!.id);
    expect(el.querySelector('a11y-error')!.hidden).toBe(true);
  });

  it('mirrors the control’s validity on the host, anchored to the control', () => {
    const { el, input } = mount();
    const internals = (el as any).internals;
    expect(internals.validity.valueMissing).toBe(true);
    expect(internals.validationAnchor).toBe(input);
    type(input, 'a@b.co');
    expect(internals.validity.valid).toBe(true);
    expect(el.checkValidity()).toBe(true);
  });

  it('toggles the dirty, touched and user-invalid states', () => {
    const { el, input } = mount();
    expect(states(el)).toEqual([]);
    type(input, 'nope');
    expect(states(el)).toEqual(['dirty']);
    input.dispatchEvent(new Event('blur'));
    expect(states(el).sort()).toEqual(['dirty', 'touched', 'user-invalid']);
    type(input, 'a@b.co');
    expect(states(el)).not.toContain('user-invalid');
  });

  it('uses the per-constraint message attributes, and picks up changes to them', () => {
    const { el } = mount(FIELD, 'value-missing-message="Enter your email"');
    el.reportValidity();
    expect(el.querySelector('a11y-error')!.textContent).toBe('Enter your email');
    el.setAttribute('value-missing-message', 'Required');
    expect(el.querySelector('a11y-error')!.textContent).toBe('Required');
    expect(el.validationMessage).toBe('Required');
  });

  it('runs custom validators, including ones set before the element upgraded', () => {
    const form = document.createElement('form');
    const el = document.createElement('a11y-input') as InputElement;
    el.innerHTML = '<input name="user"><a11y-error></a11y-error>';
    form.appendChild(el);
    el.validators = [(value) => (value === 'admin' ? 'Taken' : null)];
    document.body.appendChild(form);
    el.setValue('admin');
    expect(el.checkValidity()).toBe(false);
    expect(form.checkValidity()).toBe(false);
    expect(el.querySelector('a11y-error')!.textContent).toBe('Taken');
  });

  it('checkValidity stays quiet; reportValidity shows the error and focuses the input', () => {
    const { el, input } = mount();
    expect(el.checkValidity()).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(el.reportValidity()).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
  });

  it('cancels the host’s own invalid event when an error part renders the message', () => {
    const { el } = mount();
    const event = new Event('invalid', { cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('getValue/setValue read and write the input without marking it dirty', () => {
    const { el, input } = mount();
    el.setValue('a@b.co');
    expect(input.value).toBe('a@b.co');
    expect(el.getValue()).toBe('a@b.co');
    expect(el.validity?.valid).toBe(true);
    expect(states(el)).not.toContain('dirty');
  });

  it('calls onInput and onChange with the value', () => {
    const { el, input } = mount();
    el.onInput = vi.fn();
    el.onChange = vi.fn();
    type(input, 'x');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(el.onInput).toHaveBeenCalledWith('x');
    expect(el.onChange).toHaveBeenCalledWith('x');
  });

  it('formResetCallback returns the field to pristine', async () => {
    const { el, input } = mount();
    el.reportValidity();
    el.formResetCallback();
    await flush();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(states(el)).toEqual([]);
  });

  it('re-links parts added later', async () => {
    const { el, input } = mount('<input>');
    const hint = document.createElement('a11y-hint');
    hint.textContent = 'Later';
    el.appendChild(hint);
    await flush();
    expect(input.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('rebinds when the input is replaced', async () => {
    const { el, input } = mount();
    const next = document.createElement('input');
    input.replaceWith(next);
    await flush();
    expect(el.querySelector('label.a11y-label')!.getAttribute('for')).toBe(next.id);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
  });

  it('settles: a sync produces no further mutations', async () => {
    const { el } = mount();
    await flush();
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((r) => records.push(...r));
    observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    el.setAttribute('too-long-message', 'x');
    await flush();
    await flush();
    observer.disconnect();
    expect(records.filter((r) => r.attributeName !== 'too-long-message')).toEqual([]);
  });

  it('links an <a11y-label> whose bundle hasn’t loaded with aria-labelledby, then switches to for', async () => {
    const pending = document.createElement('a11y-label');
    Object.defineProperty(pending, 'label', { value: undefined }); // what an un-upgraded element looks like to the field
    pending.textContent = 'Email';
    const { el, input } = mount('<input>');
    el.prepend(pending);
    await flush();
    expect(input.getAttribute('aria-labelledby')).toBe(pending.id);

    const real = document.createElement('a11y-label');
    real.textContent = 'Email';
    pending.replaceWith(real);
    await flush();
    expect(input.labels?.[0]?.textContent).toBe('Email');
    expect(input.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('ignores inputs that aren’t text fields', () => {
    const { el } = mount('<input type="checkbox">');
    expect(el.querySelector('input')!.hasAttribute('id')).toBe(false);
    expect(el.checkValidity()).toBe(true);
  });
});

describe('a11y-input — reparenting', () => {
  it('keeps validating after being moved (disconnect + reconnect)', () => {
    const { el, input } = mount();
    document.body.appendChild(document.createElement('section')).appendChild(el);
    type(input, 'x');
    input.dispatchEvent(new Event('blur'));
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('does not double-fire onInput after several reconnects', () => {
    const { el, input } = mount();
    el.onInput = vi.fn();
    for (let i = 0; i < 3; i++) document.body.appendChild(el);
    type(input, 'x');
    expect(el.onInput).toHaveBeenCalledTimes(1);
  });
});
