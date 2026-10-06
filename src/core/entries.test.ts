/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';

/**
 * Locks in the public API of every `define.ts` entry (each one is also a
 * standalone `dist/browser/**\/define.js`): importing it registers its tag,
 * and it exports its element class plus the zero-build helpers.
 */
const entries = import.meta.glob<Record<string, unknown>>('../**/define.ts', { eager: true });

describe('define entries', () => {
  it('finds every entry', () => {
    expect(Object.keys(entries).length).toBeGreaterThanOrEqual(29);
  });

  for (const [path, mod] of Object.entries(entries)) {
    const name = path.split('/').at(-2)!;
    const tag = `a11y-${name}`;
    const isOverlay = path.includes('/overlays/');

    describe(path, () => {
      it(`registers <${tag}> and exports its class`, () => {
        const ctor = customElements.get(tag);
        expect(ctor).toBeDefined();
        expect(Object.values(mod)).toContain(ctor);
      });

      it('exports setStrings and resetStrings', () => {
        expect(typeof mod.setStrings).toBe('function');
        expect(typeof mod.resetStrings).toBe('function');
      });

      if (isOverlay) {
        it('exports removeOverlaysWithin', () => {
          expect(typeof mod.removeOverlaysWithin).toBe('function');
        });
      }
    });
  }
});
