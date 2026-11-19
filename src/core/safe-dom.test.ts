/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { call, doc, prop } from './safe-dom.js';

/**
 * jsdom doesn't implement `[LegacyOverrideBuiltIns]`: emulate a named control
 * (or a named page element, for `document`) with an own property on the
 * instance, which is where browsers resolve it too.
 */
function clobber<T extends object>(target: T, name: string, value: unknown, run: () => void): void {
  Object.defineProperty(target, name, { value, configurable: true });
  try {
    run();
  } finally {
    Reflect.deleteProperty(target, name);
  }
}

describe('prop() / call()', () => {
  it('read a <form> built-in, not the control shadowing it', () => {
    const parent = document.createElement('div');
    const form = document.createElement('form');
    const input = document.createElement('input');
    form.append(input);
    parent.append(form);
    clobber(form, 'parentNode', input, () => {
      expect(form.parentNode).toBe(input); // the emulation works
      expect(prop(form, 'parentNode')).toBe(parent);
    });
    clobber(form, 'closest', input, () => {
      expect(call(form, 'closest', 'div')).toBe(parent);
    });
  });

  it('read every other node normally, so instance stubs keep working', () => {
    const div = document.createElement('div');
    clobber(div, 'clientWidth', 42, () => {
      expect(prop(div, 'clientWidth')).toBe(42);
    });
    clobber(div, 'matches', () => 'stubbed', () => {
      expect(call(div, 'matches', 'x')).toBe('stubbed');
    });
  });
});

describe('doc', () => {
  const img = document.createElement('img');

  it.each(['body', 'activeElement', 'documentElement', 'readyState'] as const)('reads %s through the prototype', (name) => {
    const real = document[name];
    clobber(document, name, img, () => {
      expect(document[name]).toBe(img);
      expect(doc[name]).toBe(real);
    });
  });

  it('calls createElement, createComment, getElementById and querySelector through the prototype', () => {
    const el = document.body.appendChild(document.createElement('p'));
    el.id = 'safe-dom-target';
    try {
      for (const name of ['createElement', 'createComment', 'getElementById', 'querySelector']) {
        clobber(document, name, img, () => {
          expect(doc.createElement('span').localName).toBe('span');
          expect(doc.createComment('c').nodeType).toBe(Node.COMMENT_NODE);
          expect(doc.getElementById('safe-dom-target')).toBe(el);
          expect(doc.querySelector('#safe-dom-target')).toBe(el);
        });
      }
    } finally {
      el.remove();
    }
  });

  it('adds, dispatches and removes document listeners through the prototype', () => {
    let calls = 0;
    const listener = (): void => void calls++;
    for (const name of ['addEventListener', 'removeEventListener', 'dispatchEvent']) {
      clobber(document, name, img, () => {
        doc.addEventListener('safe-dom-test', listener);
        doc.dispatchEvent(new window.Event('safe-dom-test'));
        doc.removeEventListener('safe-dom-test', listener);
        doc.dispatchEvent(new window.Event('safe-dom-test'));
      });
    }
    expect(calls).toBe(3);
  });
});

describe('document reads in the library', () => {
  const sources = import.meta.glob<string>('../**/*.ts', { query: '?raw', import: 'default', eager: true });

  it('all go through `doc` (src/core/safe-dom.ts)', () => {
    const offenders: string[] = [];
    for (const [path, source] of Object.entries(sources)) {
      if (path.endsWith('.test.ts') || path.endsWith('/safe-dom.ts')) continue;
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
      for (const match of code.matchAll(/\bdocument\.[a-zA-Z]+/g)) offenders.push(`${path}: ${match[0]}`);
    }
    expect(offenders).toEqual([]);
  });
});
