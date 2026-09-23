import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig } from 'tsup';

/**
 * tsup flattens array entries to their basename, which would collide since
 * every component has its own `define.ts` — map each one to an output path
 * that mirrors its source location instead (e.g.
 * `accessibility-components/spinner/define.ts` -> `dist/browser/accessibility-components/spinner/define.js`).
 */
function findDefineEntries(root: string): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const file of readdirSync(root, { recursive: true }) as string[]) {
    if (file.endsWith('define.ts')) {
      const key = relative(root, join(root, file)).replace(/\.ts$/, '');
      entries[key] = join(root, file);
    }
  }
  return entries;
}

// Browser bundle: one self-contained ESM file per publicly-registrable element
// (its `define.ts` companion), for zero-build `<script type="module">` usage..
const browserConfig = defineConfig({
  entry: findDefineEntries('src'),
  outDir: 'dist/browser',
  format: ['esm'],
  platform: 'browser',
  target: 'es2022',
  splitting: false,
  bundle: true,
  sourcemap: true,
  clean: true,
  dts: false,
  outExtension: () => ({ js: '.js' }),
});

// CSS bundle: resolves src/a11y.css's `@import` chain (the barrel of every
// component/overlay stylesheet) into a single dist/a11y.css, replacing the
// old `sass` CLI compile — no Sass dependency, plain CSS + custom properties.
const cssConfig = defineConfig({
  entry: { a11y: 'src/a11y.css' },
  outDir: 'dist',
  clean: false,
  sourcemap: false,
});

export default [browserConfig, cssConfig];
