import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindField, type FieldBinding, type FieldOptions, type FieldParts } from './field.js';
import { resetStrings, setStrings } from './strings.js';

let binding: FieldBinding | null = null;

afterEach(() => {
  binding?.destroy();
  binding = null;
  document.body.innerHTML = '';
  resetStrings();
  vi.useRealTimers();
});

function setup(html: string, options?: FieldOptions, pick?: (root: HTMLElement) => Partial<FieldParts>) {
  const root = document.createElement('form');
  root.innerHTML = html;
  document.body.appendChild(root);
  const control = root.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
  const parts: FieldParts = {
    control,
    label: root.querySelector<HTMLElement>('label, .label'),
    hints: [...root.querySelectorAll<HTMLElement>('.hint')],
    error: root.querySelector<HTMLElement>('.error'),
    counter: root.querySelector<HTMLElement>('.counter'),
    ...pick?.(root),
  };
  binding = bindField(parts, options);
  return { form: root as HTMLFormElement, control, parts, binding };
}

function type(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  control.value = value;
  control.dispatchEvent(new Event('input', { bubbles: true }));
}

const blur = (control: HTMLElement) => control.dispatchEvent(new Event('blur'));

describe('bindField — linking', () => {
  it('gives the control an id and points a real <label> at it with for', () => {
    const { control, parts } = setup('<label>Email</label><input>');
    expect(control.id).toMatch(/^a11y-field-\d+$/);
    expect((parts.label as HTMLLabelElement).htmlFor).toBe(control.id);
  });

  it('keeps ids and a for the consumer already set', () => {
    const { control, parts } = setup('<label for="elsewhere">Email</label><input id="mine">');
    expect(control.id).toBe('mine');
    expect((parts.label as HTMLLabelElement).htmlFor).toBe('elsewhere');
  });

  it('links a non-<label> label through aria-labelledby, alongside the consumer’s ids', () => {
    const { control, parts } = setup('<span class="label">Email</span><input aria-labelledby="extra">');
    expect(control.getAttribute('aria-labelledby')).toBe(`extra ${parts.label!.id}`);
  });

  it('describes the control by its hints, keeping the consumer’s own tokens first', () => {
    const { control, parts } = setup('<input aria-describedby="mine"><p class="hint">A</p><p class="hint" id="b">B</p>');
    expect(control.getAttribute('aria-describedby')).toBe(`mine ${parts.hints![0]!.id} b`);
  });

  it('drops the ids of parts that were removed on sync', () => {
    const { control, parts, binding } = setup('<input><p class="hint">A</p>');
    binding.sync({ ...parts, hints: [] });
    expect(control.hasAttribute('aria-describedby')).toBe(false);
  });

  it('destroy removes the ARIA it added and stops listening', () => {
    const { control, parts, binding } = setup('<label>L</label><input required><p class="hint">A</p><p class="error"></p>');
    binding.show();
    binding.destroy();
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(control.hasAttribute('aria-describedby')).toBe(false);
    expect((parts.label as HTMLLabelElement).htmlFor).toBe('');
    type(control, '');
    blur(control);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('bindField — error timing', () => {
  it('flags nothing before the user leaves the field', () => {
    const { control, parts } = setup('<input required><p class="error"></p>');
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(parts.error!.hidden).toBe(true);
    type(control, 'a');
    type(control, '');
    expect(control.hasAttribute('aria-invalid')).toBe(false);
  });

  it('does not flag a field that was only tabbed through', () => {
    const { control } = setup('<input required><p class="error"></p>');
    blur(control);
    expect(control.hasAttribute('aria-invalid')).toBe(false);
  });

  it('shows the error on blur after an edit, then updates it live', () => {
    const { control, parts } = setup('<input required><p class="error"></p>', { messages: { valueMissing: 'Required' } });
    type(control, 'x');
    type(control, '');
    blur(control);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    expect(parts.error!.hidden).toBe(false);
    expect(parts.error!.textContent).toBe('Required');
    expect(control.getAttribute('aria-describedby')).toBe(parts.error!.id);

    type(control, 'fixed');
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(parts.error!.hidden).toBe(true);
    expect(control.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows errors on a submit attempt, cancels the bubble and focuses the first invalid control', () => {
    const { form, control, parts } = setup('<input required><p class="error"></p>', { messages: { valueMissing: 'Required' } });
    const invalid = vi.fn((e: Event) => e.defaultPrevented);
    control.addEventListener('invalid', invalid);
    expect(form.checkValidity()).toBe(false);
    expect(invalid).toHaveReturnedWith(true);
    expect(parts.error!.textContent).toBe('Required');
    expect(document.activeElement).toBe(control);
  });

  it('only focuses the first invalid control of the form', () => {
    const root = document.createElement('form');
    root.innerHTML = '<input id="a" required><p class="error"></p><input id="b" required><p class="error"></p>';
    document.body.appendChild(root);
    const [a, b] = [...root.querySelectorAll('input')];
    const [ea, eb] = [...root.querySelectorAll<HTMLElement>('.error')];
    const bindings = [bindField({ control: a!, error: ea }), bindField({ control: b!, error: eb })];
    root.checkValidity();
    expect(document.activeElement).toBe(a);
    bindings.forEach((x) => x.destroy());
  });

  it('leaves the native bubble alone without an error part', () => {
    const { control } = setup('<input required>');
    const invalid = vi.fn((e: Event) => e.defaultPrevented);
    control.addEventListener('invalid', invalid);
    control.checkValidity();
    expect(invalid).toHaveReturnedWith(false);
    expect(control.getAttribute('aria-invalid')).toBe('true');
  });

  it('reset() and a form reset return it to pristine', async () => {
    const { form, control, binding } = setup('<input required><p class="error"></p>');
    binding.show();
    binding.reset();
    expect(control.hasAttribute('aria-invalid')).toBe(false);
    expect(binding.state).toMatchObject({ touched: false, dirty: false, showError: false });

    type(control, 'x');
    type(control, '');
    blur(control);
    form.reset();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(binding.state).toMatchObject({ touched: false, dirty: false, showError: false });
    expect(control.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('bindField — validation', () => {
  it('runs validators after the native constraints, and blocks the form through setCustomValidity', () => {
    const noAdmin = vi.fn((value: string) => (value === 'admin' ? 'Pick another name' : null));
    const { form, control, binding } = setup('<input required><p class="error"></p>', { validators: [noAdmin] });
    expect(binding.state.valid).toBe(false);
    expect(noAdmin).not.toHaveBeenCalled(); // native valueMissing wins

    type(control, 'admin');
    expect(binding.state).toMatchObject({ valid: false, message: 'Pick another name' });
    expect(control.validity.customError).toBe(true);
    expect(form.checkValidity()).toBe(false);

    type(control, 'jane');
    expect(binding.state.valid).toBe(true);
    expect(form.checkValidity()).toBe(true);
  });

  it('uses the first failing validator’s message', () => {
    const { control, binding } = setup('<input>', { validators: [() => null, () => 'second', () => 'third'] });
    type(control, 'x');
    expect(binding.state.message).toBe('second');
  });

  it('overrides messages per constraint, with attribute placeholders', () => {
    const { control, binding } = setup('<input minlength="3" maxlength="10">', {
      messages: { tooShort: 'At least {minlength} characters (max {maxlength})' },
    });
    // jsdom only computes tooShort for user edits; fake it the way a browser would report it.
    vi.spyOn(control, 'validity', 'get').mockReturnValue({ ...control.validity, tooShort: true, valid: false });
    binding.validate();
    expect(binding.state.message).toBe('At least 3 characters (max 10)');
  });

  it('falls back to the browser’s message', () => {
    const { binding, control } = setup('<input required>');
    expect(binding.state.message).toBe(control.validationMessage);
  });

  it('treats a disabled control as valid', () => {
    const { binding } = setup('<input required disabled>');
    expect(binding.state.valid).toBe(true);
  });

  it('setOptions re-validates', () => {
    const { binding } = setup('<input>');
    binding.setOptions({ validators: [() => 'no'] });
    expect(binding.state).toMatchObject({ valid: false, message: 'no' });
  });

  it('reports every state change through onStateChange', () => {
    const onStateChange = vi.fn();
    const { control } = setup('<input required>', { onStateChange });
    type(control, 'x');
    expect(onStateChange).toHaveBeenLastCalledWith({ valid: true, message: '', touched: false, dirty: true, showError: false });
  });
});

describe('bindField — counter', () => {
  it('shows the length against maxlength, hidden from assistive tech', () => {
    const { control, parts } = setup('<textarea maxlength="50"></textarea><p class="counter"></p>');
    type(control, 'hello');
    const text = parts.counter!.querySelector('.a11y-counter__text')!;
    expect(text.textContent).toBe('5 / 50');
    expect(text.getAttribute('aria-hidden')).toBe('true');
  });

  it('hides itself without maxlength', () => {
    const { parts } = setup('<textarea></textarea><p class="counter"></p>');
    expect(parts.counter!.hidden).toBe(true);
  });

  it('announces the characters left only near the limit, once typing pauses', () => {
    vi.useFakeTimers();
    const { control, parts } = setup('<textarea maxlength="30"></textarea><p class="counter"></p>', { counterThreshold: 10 });
    const status = parts.counter!.querySelector('.a11y-counter__status')!;
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(control.getAttribute('aria-describedby')).toBe(status.id);

    type(control, 'x'.repeat(10));
    vi.advanceTimersByTime(1000);
    expect(status.textContent).toBe('');

    type(control, 'x'.repeat(22));
    type(control, 'x'.repeat(25));
    vi.advanceTimersByTime(400);
    expect(status.textContent).toBe('');
    vi.advanceTimersByTime(200);
    expect(status.textContent).toBe('5 characters remaining');

    type(control, 'x'.repeat(29));
    vi.advanceTimersByTime(600);
    expect(status.textContent).toBe('1 character remaining');

    type(control, 'x');
    expect(status.textContent).toBe('');
  });

  it('uses translated strings', () => {
    setStrings({ characterCount: '{count} sur {max}' });
    const { control, parts } = setup('<textarea maxlength="9"></textarea><p class="counter"></p>');
    type(control, 'ab');
    expect(parts.counter!.textContent).toContain('2 sur 9');
  });
});
