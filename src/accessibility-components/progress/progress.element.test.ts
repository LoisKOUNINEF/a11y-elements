import { afterEach, describe, expect, it } from 'vitest';
import './define.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('a11y-progress');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

describe('a11y-progress', () => {
  it('applies the a11y-progress class to itself', () => {
    expect(mount().classList.contains('a11y-progress')).toBe(true);
  });

  it('renders no value attribute (indeterminate) when value is not given', () => {
    const bar = mount().querySelector('progress')!;
    expect(bar.hasAttribute('value')).toBe(false);
  });

  it('renders value="0" explicitly, not as indeterminate', () => {
    const bar = mount({ value: '0' }).querySelector('progress')!;
    expect(bar.getAttribute('value')).toBe('0');
  });

  it('defaults max to 100 and respects a custom max', () => {
    expect(mount().querySelector('progress')!.getAttribute('max')).toBe('100');
    expect(mount({ max: '50' }).querySelector('progress')!.getAttribute('max')).toBe('50');
  });

  it('renders a visible label and links it via aria-labelledby, not a wrapping <label>', () => {
    const el = mount({ label: 'Uploading…' });
    const labelSpan = el.querySelector('.a11y-progress__label')!;
    const bar = el.querySelector('progress')!;
    expect(labelSpan.textContent).toBe('Uploading…');
    expect(labelSpan.tagName).not.toBe('LABEL');
    expect(bar.getAttribute('aria-labelledby')).toBe(labelSpan.id);
  });

  it('falls back to aria-label on the bar when there is no visible label', () => {
    const el = mount({ 'aria-label': 'Upload progress' });
    expect(el.querySelector('.a11y-progress__label')).toBeNull();
    expect(el.querySelector('progress')!.getAttribute('aria-label')).toBe('Upload progress');
  });

  it('prefers the visible label over aria-label when both are given', () => {
    const el = mount({ label: 'Uploading…', 'aria-label': 'ignored' });
    const bar = el.querySelector('progress')!;
    expect(bar.hasAttribute('aria-labelledby')).toBe(true);
    expect(bar.hasAttribute('aria-label')).toBe(false);
  });

  it('falls back to a generic aria-label="Progress" when neither label nor aria-label is given', () => {
    const bar = mount().querySelector('progress')!;
    expect(bar.hasAttribute('aria-labelledby')).toBe(false);
    expect(bar.getAttribute('aria-label')).toBe('Progress');
  });
});
