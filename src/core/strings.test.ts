import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STRINGS, STRINGS_CHANGE_EVENT, formatString, getString, resetStrings, setStrings } from './strings.js';

afterEach(() => {
  resetStrings();
});

describe('strings', () => {
  it('starts with the English defaults', () => {
    for (const [key, value] of Object.entries(DEFAULT_STRINGS)) expect(getString(key as keyof typeof DEFAULT_STRINGS)).toBe(value);
  });

  it('setStrings merges, leaving other keys alone', () => {
    setStrings({ closeDialog: 'Fermer' });
    expect(getString('closeDialog')).toBe('Fermer');
    expect(getString('dismiss')).toBe('Dismiss');
  });

  it('ignores unknown keys and non-string values', () => {
    setStrings({ nope: 'x', dismiss: undefined } as never);
    expect(getString('dismiss')).toBe('Dismiss');
    expect('nope' in (globalThis as any)[Symbol.for('a11y-elements/strings')]).toBe(false);
  });

  it('resetStrings restores every default', () => {
    setStrings({ loading: 'Chargement', avatar: 'Avatar FR' });
    resetStrings();
    expect(getString('loading')).toBe('Loading');
    expect(getString('avatar')).toBe('Avatar');
  });

  it('dispatches the change event on document for setStrings and resetStrings', () => {
    const handler = vi.fn();
    document.addEventListener(STRINGS_CHANGE_EVENT, handler);
    setStrings({ loading: 'x' });
    resetStrings();
    document.removeEventListener(STRINGS_CHANGE_EVENT, handler);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('keeps its state on globalThis so separately bundled copies share it', () => {
    setStrings({ progress: 'Avancement' });
    expect((globalThis as any)[Symbol.for('a11y-elements/strings')].progress).toBe('Avancement');
  });

  it('formatString fills placeholders and leaves unknown ones as is', () => {
    expect(formatString('Aller à {name}', { name: 'Tarifs' })).toBe('Aller à Tarifs');
    expect(formatString('{name} / {other}', { name: 'A' })).toBe('A / {other}');
  });
});
