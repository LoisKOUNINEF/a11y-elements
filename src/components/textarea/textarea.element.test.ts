import { afterEach, describe, expect, it, vi } from 'vitest';
import '../label/define.js';
import './define.js';
import type { TextareaElement } from './textarea.element.js';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function mount(innerHtml: string, attrs = ''): { el: TextareaElement; textarea: HTMLTextAreaElement } {
  const form = document.createElement('form');
  form.innerHTML = `<a11y-textarea ${attrs}>${innerHtml}</a11y-textarea>`;
  document.body.appendChild(form);
  const el = form.querySelector('a11y-textarea')!;
  return { el, textarea: el.querySelector('textarea')! };
}

describe('a11y-textarea', () => {
  it('wires a real <textarea> with its label and error', () => {
    const { el, textarea } = mount(
      '<a11y-label>Bio</a11y-label><textarea name="bio" required></textarea><a11y-error></a11y-error>',
      'value-missing-message="Tell us a bit more"',
    );
    expect(textarea.labels?.[0]?.textContent).toBe('Bio');
    expect(el.reportValidity()).toBe(false);
    expect(el.querySelector('a11y-error')!.textContent).toBe('Tell us a bit more');
    expect(textarea.getAttribute('aria-describedby')).toBe(el.querySelector('a11y-error')!.id);
  });

  it('renders the counter and announces the characters left near the limit', () => {
    vi.useFakeTimers();
    const { el, textarea } = mount('<textarea maxlength="25"></textarea><a11y-counter></a11y-counter>');
    const counter = el.querySelector('a11y-counter')!;
    expect(counter.querySelector('.a11y-counter__text')!.textContent).toBe('0 / 25');
    textarea.value = 'x'.repeat(10);
    textarea.dispatchEvent(new Event('input'));
    vi.advanceTimersByTime(600);
    expect(counter.querySelector('.a11y-counter__text')!.textContent).toBe('10 / 25');
    expect(counter.querySelector('.a11y-counter__status')!.textContent).toBe('15 characters remaining');
  });
});
