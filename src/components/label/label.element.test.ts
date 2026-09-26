import { afterEach, describe, expect, it } from 'vitest';
import './define.js';
import type { LabelElement } from './label.element.js';

afterEach(() => {
  document.body.innerHTML = '';
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function mount(html: string): LabelElement {
  document.body.innerHTML = html;
  return document.querySelector('a11y-label')!;
}

describe('a11y-label', () => {
  it('moves its content into a real <label class="a11y-label">', () => {
    const el = mount('<a11y-label>Search <em>all</em></a11y-label>');
    expect(el.children).toHaveLength(1);
    expect(el.label?.innerHTML).toBe('Search <em>all</em>');
  });

  it('forwards for, so a standalone label names its control', () => {
    mount('<a11y-label for="q">Search</a11y-label><input id="q">');
    const input = document.getElementById('q') as HTMLInputElement;
    expect(input.labels?.[0]?.textContent).toBe('Search');
  });

  it('follows changes to for, and clears it when removed', () => {
    const el = mount('<a11y-label for="a">Search</a11y-label>');
    el.setAttribute('for', 'b');
    expect(el.label?.htmlFor).toBe('b');
    el.removeAttribute('for');
    expect(el.label?.hasAttribute('for')).toBe(false);
  });

  it('moves content added later into the label', async () => {
    const el = mount('<a11y-label>Search</a11y-label>');
    el.append(' more');
    await flush();
    expect(el.childNodes).toHaveLength(1);
    expect(el.label?.textContent).toBe('Search more');
  });
});
