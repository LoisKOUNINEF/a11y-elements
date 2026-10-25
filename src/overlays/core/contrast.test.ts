import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The shipped status colors are drawn under text (snackbar, notification
 * banner), so each background/text pair must pass WCAG AA for normal text.
 * Read straight from the stylesheets, so a changed default can't slip past.
 */

const STATUS_TYPES = ['success', 'error', 'info', 'warning'] as const;
const AA_NORMAL_TEXT = 4.5;

const here = dirname(fileURLToPath(import.meta.url));

function readCss(relativePath: string): string {
  return readFileSync(join(here, relativePath), 'utf8');
}

/** Every `--a11y-*: value;` declaration in `css`, last one winning. */
function customProperties(css: string): Map<string, string> {
  const props = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/(--a11y-[\w-]+)\s*:\s*([^;]+);/g)) props.set(name!, value!.trim());
  return props;
}

/** Follows `var(--x)` / `var(--x, fallback)` through `props` to a literal color. */
function resolve(value: string, props: Map<string, string>): string {
  const ref = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (!ref) return value;
  const next = props.get(ref[1]!) ?? ref[2];
  if (next === undefined) throw new Error(`Unresolved ${ref[1]}`);
  return resolve(next.trim(), props);
}

type Rgb = [number, number, number];

const NAMED: Record<string, Rgb> = { white: [255, 255, 255], black: [0, 0, 0] };

function parseColor(value: string): Rgb {
  if (value in NAMED) return NAMED[value]!;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`Unsupported color: ${value}`);
}

function luminance([r, g, b]: Rgb): number {
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(parseColor(a)), luminance(parseColor(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('white', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
    expect(contrastRatio('rgb(76 175 80)', 'white')).toBeCloseTo(2.78, 2);
  });
});

describe('status colors (overlay-variables.css)', () => {
  const props = customProperties(readCss('./overlay-variables.css'));

  it.each(STATUS_TYPES)('%s text passes AA on its background', (type) => {
    const background = resolve(`var(--a11y-color-${type})`, props);
    const text = resolve(`var(--a11y-color-text-on-${type})`, props);
    expect(contrastRatio(background, text)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it('gives warning its own color, not the error one', () => {
    expect(resolve('var(--a11y-color-warning)', props)).not.toBe(resolve('var(--a11y-color-error)', props));
  });

  it.each(['../snackbar/snackbar.css', '../notification-banner/notification-banner.css', '../emergency-dialog/emergency-dialog.css'])(
    '%s falls back to the same defaults',
    (path) => {
      const css = readCss(path);
      for (const [, name, fallback] of css.matchAll(/var\((--a11y-color-[\w-]+),\s*(#[0-9a-f]+|white)\)/gi)) {
        expect(fallback, name).toBe(resolve(`var(${name})`, props));
      }
    },
  );
});

/** Text (or icon) color → the background it's drawn on, by semantic token. */
const SEMANTIC_PAIRS: Array<[text: string, background: string]> = [
  ['text-default', 'surface'],
  ['text-default', 'surface-muted'],
  ['text-muted', 'surface'],
  ['primary', 'surface'], // file-input links, the checkbox mark (surface on primary)
  ['danger', 'surface'], // error messages, required markers
  ['surface', 'text-muted'], // menu item and modal button hover
];

describe('semantic colors', () => {
  /** Every literal fallback of each `var(--a11y-color-<token>, #…)` in the shipped stylesheets. */
  const lightDefaults = new Map<string, Set<string>>();
  for (const file of readdirSync(join(here, '../..'), { recursive: true }) as string[]) {
    if (!file.endsWith('.css') || file.endsWith('a11y-dark.css')) continue;
    const css = readCss(join('../..', file));
    for (const [, token, fallback] of css.matchAll(/var\(--a11y-color-([\w-]+),\s*(#[0-9a-f]{6})\)/gi)) {
      if (!lightDefaults.has(token!)) lightDefaults.set(token!, new Set());
      lightDefaults.get(token!)!.add(fallback!.toLowerCase());
    }
  }

  it.each(SEMANTIC_PAIRS)('light defaults: %s on %s passes AA', (text, background) => {
    for (const fg of lightDefaults.get(text)!) {
      for (const bg of lightDefaults.get(background)!) {
        expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    }
  });

  const dark = readCss('../../a11y-dark.css');
  const [mediaBlock, attributeBlock] = [...dark.matchAll(/:root[^{]*\{([^}]*)\}/g)].map((m) => customProperties(m[1]!));

  it('a11y-dark.css sets the same values for prefers-color-scheme and data-theme="dark"', () => {
    expect(mediaBlock!.size).toBeGreaterThan(0);
    expect([...mediaBlock!]).toEqual([...attributeBlock!]);
  });

  it('a11y-dark.css defines every semantic token the stylesheets use', () => {
    for (const token of lightDefaults.keys()) {
      if (/^(success|error|info|warning|text-on-)/.test(token)) continue;
      expect(mediaBlock!.has(`--a11y-color-${token}`), token).toBe(true);
    }
  });

  it.each(SEMANTIC_PAIRS)('a11y-dark.css: %s on %s passes AA', (text, background) => {
    const color = (token: string): string => mediaBlock!.get(`--a11y-color-${token}`)!;
    expect(contrastRatio(color(text), color(background))).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
