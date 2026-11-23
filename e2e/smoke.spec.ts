import { expect, test, type Page } from '@playwright/test';

/** Loads the page with every element defined, then puts `html` in `<body>`. */
async function setUp(page: Page, html: string): Promise<void> {
  await page.goto('/e2e/page.html');
  await page.waitForFunction(() => !!customElements.get('a11y-modal'));
  await page.evaluate((markup) => {
    document.body.innerHTML = markup;
  }, html);
}

/** Whether focus is inside `selector`, looking through shadow roots. */
function focusInside(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const root = document.querySelector(sel);
    return !!active && !!root && (root.contains(active) || root.contains((active.getRootNode() as ShadowRoot).host ?? null));
  }, selector);
}

test.describe('checkbox-group', () => {
  test('select-all with every option disabled keeps the page responsive', async ({ page }) => {
    await setUp(
      page,
      `<a11y-checkbox-group legend="Toppings" select-all disabled>
        <label><input type="checkbox" value="a"> A</label>
        <label><input type="checkbox" value="b"> B</label>
      </a11y-checkbox-group>`,
    );
    // Any mutation re-syncs; before the fix this started an endless MutationObserver loop.
    await page.evaluate(() => document.querySelector('a11y-checkbox-group label')!.append(' more'));
    await expect(page.locator('.a11y-checkbox-group__select-all-input')).toBeDisabled();
    expect(await page.evaluate(() => 'still responsive')).toBe('still responsive');
  });
});

test.describe('dropdown', () => {
  test('the trigger opens and closes it with real clicks', async ({ page }) => {
    await setUp(
      page,
      `<button id="actions">Actions</button>
      <a11y-dropdown anchor="actions"><div role="menuitem">Edit</div><div role="menuitem">Delete</div></a11y-dropdown>`,
    );
    const trigger = page.locator('#actions');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();

    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('modal', () => {
  const html = `
    <main><button id="open">Open settings</button></main>
    <a11y-modal id="m"><h2>Settings</h2><input aria-label="Name"><button>Save</button></a11y-modal>`;

  test('traps Tab, inerts the page, and gives focus back on Escape', async ({ page }) => {
    await setUp(page, html);
    await page.evaluate(() => {
      document.getElementById('open')!.addEventListener('click', () => ((document.getElementById('m') as HTMLElement & { open: boolean }).open = true));
    });
    await page.locator('#open').click();

    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInside(page, '.a11y-modal-wrapper')).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');
    // WebKit doesn't focus a clicked button: the trap remembers the pressed one instead.
    await expect(page.locator('#open')).toBeFocused();
  });

  test('Escape on a tooltip inside it closes only the tooltip', async ({ page }) => {
    await setUp(
      page,
      `<a11y-modal id="m" open><h2>Settings</h2><button id="save">Save</button>
        <a11y-tooltip anchor="save" show-delay="0">Saves your changes</a11y-tooltip></a11y-modal>`,
    );
    await page.locator('#save').focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tooltip')).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  });

  test('a tooltip inside it is shown above it, not behind its backdrop', async ({ page }) => {
    await setUp(
      page,
      `<a11y-modal id="m" open><h2>Settings</h2><button id="save">Save</button>
        <a11y-tooltip anchor="save" show-delay="0">Saves your changes</a11y-tooltip></a11y-modal>`,
    );
    await page.locator('#save').focus();
    await expect(page.getByRole('tooltip')).toBeVisible();
    const { onTop, zIndex } = await page.evaluate(() => {
      const wrapper = document.querySelector('.a11y-tooltip-wrapper')!;
      const r = wrapper.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: !!hit && wrapper.contains(hit), zIndex: getComputedStyle(wrapper).zIndex };
    });
    expect(onTop).toBe(true);
    expect(zIndex).toBe('513');
  });

  test('a snackbar shown while it is open is above its backdrop', async ({ page }) => {
    await setUp(page, '<a11y-snackbar id="s"></a11y-snackbar><a11y-modal id="m" open><h2>Settings</h2><button>Save</button></a11y-modal>');
    await page.evaluate(() => (document.getElementById('s') as HTMLElement & { notify(m: string): void }).notify('Saved'));
    const toast = page.locator('.a11y-snackbar');
    await expect(toast).toBeVisible();
    const { onTop, zIndex } = await page.evaluate(() => {
      const el = document.querySelector('.a11y-snackbar')!;
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { onTop: !!hit && el.contains(hit), zIndex: getComputedStyle(document.getElementById('s')!).zIndex };
    });
    expect(onTop).toBe(true);
    expect(zIndex).toBe('515');
  });

  test('Tab reaches controls inside a web component', async ({ page }) => {
    await setUp(page, '<a11y-modal id="m"><h2>Settings</h2><x-field></x-field><button id="after">After</button></a11y-modal>');
    await page.evaluate(() => {
      customElements.define(
        'x-field',
        class extends HTMLElement {
          connectedCallback(): void {
            if (!this.shadowRoot) this.attachShadow({ mode: 'open' }).innerHTML = '<input aria-label="Inner">';
          }
        },
      );
      (document.getElementById('m') as HTMLElement & { open: boolean }).open = true;
    });
    // × close button first, then the web component's input, then "After".
    await expect(page.locator('.a11y-modal-close-button')).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.querySelector('x-field')!.shadowRoot!.activeElement?.getAttribute('aria-label'))).toBe('Inner');
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
  });
});

test.describe('tabs', () => {
  test('arrow keys move the selection and show its panel', async ({ page }) => {
    await setUp(
      page,
      `<a11y-tabs label="Projects">
        <div data-tablist><button data-tab="tools">Tools</button><button data-tab="apps">Apps</button></div>
        <section data-panel="tools">Tools panel</section>
        <section data-panel="apps">Apps panel</section>
      </a11y-tabs>`,
    );
    await page.getByRole('tab', { name: 'Tools' }).click();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Apps' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Apps' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Apps panel')).toBeVisible();
    await expect(page.getByText('Tools panel')).toBeHidden();
  });
});

test.describe('file-input', () => {
  test('a dropped file is listed, announced and submitted with the input', async ({ page }) => {
    await setUp(
      page,
      `<a11y-file-input>
        <a11y-label>Attachments</a11y-label>
        <input type="file" name="attachments" multiple>
      </a11y-file-input>`,
    );
    await page.evaluate(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
      const zone = document.querySelector('.a11y-file-input__dropzone')!;
      for (const type of ['dragenter', 'dragover', 'drop']) {
        zone.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
      }
    });
    await expect(page.locator('.a11y-file-input__name')).toHaveText('notes.txt');
    await expect(page.getByRole('status')).toHaveText('notes.txt added');
    expect(await page.evaluate(() => document.querySelector<HTMLInputElement>('input[type="file"]')!.files?.[0]?.name)).toBe('notes.txt');
  });
});

test.describe('raw() sanitizer', () => {
  // Form named properties shadow built-ins (`form.children`, `form.attributes`, …) in real
  // browsers only — jsdom doesn't implement them, so this has to run here.
  const payloads = [
    '<form><img name="children" src="x" onerror="window.__xss = 1"></form>',
    '<form onclick="window.__xss = 2"><input name="attributes"></form>',
    '<form onclick="window.__xss = 3"><input name="localName"><img src="x" onerror="window.__xss = 3"></form>',
    '<form onclick="window.__xss = 4"><input name="removeAttribute"></form>',
    '<form onclick="window.__xss = 5"><input name="content"><img src="x" onerror="window.__xss = 5"></form>',
  ];

  for (const payload of payloads) {
    test(`strips handlers despite DOM clobbering: ${payload}`, async ({ page }) => {
      await setUp(page, '');
      await page.evaluate(async (markup) => {
        const { notify } = (await import('/dist/browser/all.js')) as typeof import('../src/all.js');
        // raw() brands through Symbol.for, so the core module's raw() works with the bundle's notify().
        const { raw } = (await import('/dist/core/template.js')) as typeof import('../src/core/template.js');
        notify(raw(markup), { duration: 60_000 });
      }, payload);
      const toast = page.locator('.a11y-snackbar');
      await expect(toast).toHaveCount(1);
      await page.evaluate(() => document.querySelector<HTMLElement>('.a11y-snackbar form')?.click());
      await page.waitForTimeout(200); // let the broken <img> fire its error event
      expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
      expect(await toast.evaluate((el) => [...el.querySelectorAll('*')].some((n) => n.getAttributeNames().some((a) => a.startsWith('on'))))).toBe(false);
    });
  }
});

test.describe('stacked modal layers', () => {
  type Openable = HTMLElement & { open: boolean };
  const open = (page: Page, id: string, value = true) =>
    page.evaluate(([el, v]) => ((document.getElementById(el as string) as Openable).open = v as boolean), [id, value] as const);

  const html = `
    <main><button id="trigger">Open A</button></main>
    <a11y-modal id="a"><h2>A</h2><button id="open-b">Open B</button>
      <button id="more">More</button>
      <a11y-dropdown anchor="more"><button role="menuitem">Edit</button><button role="menuitem">Delete</button></a11y-dropdown>
    </a11y-modal>
    <a11y-modal id="b"><h2>B</h2><button id="in-b">In B</button></a11y-modal>
    <a11y-blocking-loader id="loader"></a11y-blocking-loader>`;

  test('a modal declared in the page and opened from another one is usable', async ({ page }) => {
    await setUp(page, html);
    await page.locator('#trigger').focus();
    await open(page, 'a');
    await expect(page.getByRole('dialog', { name: 'A' })).toBeVisible();
    await open(page, 'b');
    await expect(page.getByRole('dialog', { name: 'B' })).toBeVisible();
    expect(await page.evaluate(() => !!document.getElementById('in-b')!.closest('[inert]'))).toBe(false);
    expect(await focusInside(page, '#b')).toBe(true);
    // Inert content can't take focus (WebKit doesn't focus clicked buttons, so focus it directly).
    expect(await page.evaluate(() => (document.getElementById('in-b')!.focus(), document.activeElement?.id))).toBe('in-b');
  });

  test('a dropdown inside a modal can be used from the keyboard', async ({ page }) => {
    await setUp(page, html);
    await open(page, 'a');
    await page.locator('#more').click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
  });

  test('closing the lower modal first keeps the page inert and focus in the top one', async ({ page }) => {
    await setUp(page, html);
    await page.locator('#trigger').focus();
    await open(page, 'a');
    await open(page, 'b');
    await open(page, 'a', false);
    await expect(page.getByRole('dialog', { name: 'A' })).toBeHidden();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    expect(await focusInside(page, '#b')).toBe(true);

    await open(page, 'b', false);
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');
    await expect(page.locator('#trigger')).toBeFocused();
  });

  test('a blocking loader over a modal keeps blocking after the modal closes', async ({ page }) => {
    await setUp(page, html);
    await open(page, 'a');
    await open(page, 'loader');
    await expect(page.locator('#loader')).toBeFocused();
    await open(page, 'a', false);
    await expect(page.getByRole('dialog', { name: 'A' })).toBeHidden();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await expect(page.locator('#loader')).toBeFocused();
    await open(page, 'loader', false);
    await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  });
});

test.describe('modal opened from a menu item', () => {
  test("focus comes back to the dropdown's trigger, not the hidden item", async ({ page }) => {
    await setUp(
      page,
      `<button id="actions">Actions</button>
      <a11y-dropdown anchor="actions"><button role="menuitem" id="settings">Settings…</button></a11y-dropdown>
      <a11y-modal id="m"><h2>Settings</h2><button>OK</button></a11y-modal>`,
    );
    await page.evaluate(() => {
      document.getElementById('settings')!.addEventListener('click', () => ((document.getElementById('m') as HTMLElement & { open: boolean }).open = true));
    });
    await page.locator('#actions').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Settings…' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden();
    await expect(page.locator('#actions')).toBeFocused();
  });
});

test.describe('DOM clobbering', () => {
  // `document` and `<form>` are [LegacyOverrideBuiltIns]: a named element shadows their built-ins in
  // real browsers only (jsdom doesn't implement it). Markup injected directly, not through raw(), tests
  // that the library reads through the prototypes; the raw() tests check the sanitizer drops the names.
  type Openable = HTMLElement & { open: boolean };
  const DOCUMENT_CLOBBERS = `
    <img name="createElement"><img name="getElementById"><form name="querySelector"></form>
    <form name="body"></form><img name="activeElement"><img name="addEventListener">`;

  test('raw() drops ids and names that would shadow document or form built-ins', async ({ page }) => {
    await setUp(page, '<form name="login"></form>');
    const names = await page.evaluate(async () => {
      const { notify } = (await import('/dist/browser/all.js')) as typeof import('../src/all.js');
      const { raw } = (await import('/dist/core/template.js')) as typeof import('../src/core/template.js');
      notify(raw('<img name="createElement"><form id="body"><input name="action"><input name="email"></form><form name="login"></form>'), { duration: 60_000 });
      const message = document.querySelector('.a11y-snackbar__message')!;
      return [typeof document.createElement, ...[...message.querySelectorAll('*')].map((el) => `${el.localName}:${el.getAttribute('id') ?? ''}:${el.getAttribute('name') ?? ''}`)];
    });
    expect(names).toEqual(['function', 'img::', 'form::', 'input::', 'input::email', 'form::']);
  });

  // Playwright's own engines (locator actionability, getByRole) read these properties off the
  // instance too, so with clobbering markup on the page the checks below go through `evaluate()`,
  // the prototypes and mouse coordinates instead.
  const q = (page: Page, selector: string) =>
    page.evaluate((sel) => !!Document.prototype.querySelector.call(document, sel), selector);
  const clickAt = async (page: Page, selector: string) => {
    const box = await page.evaluate((sel) => {
      const r = Document.prototype.querySelector.call(document, sel)!.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, selector);
    await page.mouse.click(box.x, box.y);
  };

  test('document built-ins shadowed by named page elements do not break rendering, overlays or focus', async ({ page }) => {
    await setUp(page, `<main><button id="open">Open</button></main>${DOCUMENT_CLOBBERS}<a11y-modal id="m"><h2>Settings</h2><button>Save</button></a11y-modal>`);
    expect(await page.evaluate(() => [typeof document.createElement, (document.body as Element).localName])).toEqual(['object', 'form']);

    const rendered = await page.evaluate(async () => {
      const { notify } = (await import('/dist/browser/all.js')) as typeof import('../src/all.js');
      const { h } = (await import('/dist/core/dom.js')) as typeof import('../src/core/dom.js');
      notify('first', { duration: 60_000 });
      notify('second', { duration: 60_000 });
      return [h('b', null, 'x').outerHTML, Document.prototype.querySelectorAll.call(document, '.a11y-snackbar').length];
    });
    expect(rendered).toEqual(['<b>x</b>', 2]);

    await page.evaluate(() => {
      const byId = (id: string) => Document.prototype.getElementById.call(document, id)!;
      byId('open').onclick = () => ((byId('m') as Openable).open = true);
    });
    await clickAt(page, '#open');
    await expect.poll(() => q(page, 'body > .a11y-modal-overlay > .a11y-modal-wrapper[role="dialog"]')).toBe(true);
    // Portaled to the real <body>, not the <form name="body">, and the page behind it is inert.
    expect(await q(page, 'form[name="body"] .a11y-modal-overlay')).toBe(false);
    expect(await q(page, 'main[inert]')).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => q(page, 'main[inert]')).toBe(false);
    expect(await page.evaluate(() => (Object.getOwnPropertyDescriptor(Document.prototype, 'activeElement')!.get!.call(document) as Element).id)).toBe('open');
  });

  test('a click on a form whose control is named parentNode, with nested overlays open, does not freeze the page', async ({ page }) => {
    await setUp(
      page,
      `<button id="p-trigger">Info</button>
      <a11y-popover id="p" anchor="p-trigger">
        <button id="d-trigger">Actions</button>
        <a11y-dropdown id="d" anchor="d-trigger"><button role="menuitem">Edit</button></a11y-dropdown>
      </a11y-popover>
      <form style="position: fixed; right: 0; bottom: 0"><div><input id="field" name="parentNode" aria-label="Field"></div></form>`,
    );
    await page.evaluate(() => ((document.getElementById('p') as Openable).open = true));
    await page.waitForTimeout(50); // outside-click listeners are bound on the next tick
    await page.evaluate(() => ((document.getElementById('d') as Openable).open = true));
    await page.waitForTimeout(50);
    await clickAt(page, '#field');
    // Answering at all means the main thread isn't stuck; the outside click closed both overlays.
    expect(await page.evaluate(() => ['p', 'd'].map((id) => (document.getElementById(id) as Openable).open))).toEqual([false, false]);
  });

  test('a modal traps Tab around a focusable form whose controls shadow matches, closest and getAttribute', async ({ page }) => {
    await setUp(
      page,
      `<a11y-modal id="m"><h2>Settings</h2><button id="first">First</button>
        <form tabindex="0" aria-label="Form"><input name="matches" aria-label="A"><input name="closest" aria-label="B"><input name="getAttribute" aria-label="C"></form>
        <button id="last">Last</button></a11y-modal>`,
    );
    await page.evaluate(() => ((document.getElementById('m') as Openable).open = true));
    await expect.poll(() => q(page, '.a11y-modal-wrapper[role="dialog"]')).toBe(true);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInside(page, '.a11y-modal-wrapper')).toBe(true);
    }
  });
});
