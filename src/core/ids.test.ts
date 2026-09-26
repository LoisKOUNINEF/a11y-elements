import { afterEach, describe, expect, it } from 'vitest';
import { nextId } from './ids.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('nextId', () => {
  it('returns a new id on every call', () => {
    expect(nextId('x')).not.toBe(nextId('x'));
  });

  it('skips ids already used in the document', () => {
    const counter = (globalThis as any)[Symbol.for('a11y-elements/ids')];
    document.body.innerHTML = `<p id="x-${counter.count + 1}"></p>`;
    expect(nextId('x')).toBe(`x-${counter.count}`);
    expect(document.getElementById(`x-${counter.count}`)).toBeNull();
  });
});
