import { afterEach, describe, expect, it } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a11y-visually-hidden', () => {
  it('applies the a11y-visually-hidden class and preserves plain text content', () => {
    const el = document.createElement('a11y-visually-hidden');
    el.textContent = 'Opens in a new tab';
    document.body.appendChild(el);

    expect(el.classList.contains('a11y-visually-hidden')).toBe(true);
    expect(el.textContent).toBe('Opens in a new tab');
  });

  it('preserves rich markup content, not just plain text', () => {
    const el = document.createElement('a11y-visually-hidden');
    el.innerHTML = 'Rating: <strong>4 out of 5</strong>';
    document.body.appendChild(el);

    expect(el.querySelector('strong')?.textContent).toBe('4 out of 5');
  });

  it('works with no content at all', () => {
    const el = document.createElement('a11y-visually-hidden');
    expect(() => document.body.appendChild(el)).not.toThrow();
    expect(el.classList.contains('a11y-visually-hidden')).toBe(true);
  });
});
