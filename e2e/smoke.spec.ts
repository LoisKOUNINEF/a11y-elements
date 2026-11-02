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
