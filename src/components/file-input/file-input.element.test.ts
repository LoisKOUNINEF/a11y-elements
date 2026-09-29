import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import '../label/define.js';
import './define.js';
import { formatSize, parseSize, type FileInputElement } from './file-input.element.js';
import { resetStrings, setStrings } from '../../core/strings.js';

/*
 * jsdom has no DataTransfer, and its `input.files` setter only takes a real
 * FileList, which it can't construct. Stand-ins: a DataTransfer whose `files`
 * is a plain array, and a `files` accessor that stores whatever it's given.
 */
class FakeDataTransfer {
  private _files: File[] = [];
  types: string[] = ['Files'];
  dropEffect = 'none';
  items = { add: (file: File) => this._files.push(file) };
  get files(): File[] {
    return this._files;
  }
}

const filesOf = new WeakMap<HTMLInputElement, File[]>();
const nativeFiles = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'files')!;
const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!;

beforeAll(() => {
  (globalThis as any).DataTransfer = FakeDataTransfer;
  Object.defineProperty(HTMLInputElement.prototype, 'files', {
    configurable: true,
    get(this: HTMLInputElement) {
      return this.type === 'file' ? (filesOf.get(this) ?? []) : nativeFiles.get!.call(this);
    },
    set(this: HTMLInputElement, files: File[]) {
      filesOf.set(this, [...files]);
    },
  });
  // jsdom's `required` check on file inputs reads its own file list; make it read ours.
  Object.defineProperty(HTMLInputElement.prototype, 'value', {
    configurable: true,
    get(this: HTMLInputElement) {
      if (this.type !== 'file') return nativeValue.get!.call(this);
      const first = filesOf.get(this)?.[0];
      return first ? `C:\\fakepath\\${first.name}` : '';
    },
    set(this: HTMLInputElement, value: string) {
      if (this.type === 'file') filesOf.set(this, []);
      else nativeValue.set!.call(this, value);
    },
  });
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`);
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  delete (globalThis as any).DataTransfer;
  Object.defineProperty(HTMLInputElement.prototype, 'files', nativeFiles);
  Object.defineProperty(HTMLInputElement.prototype, 'value', nativeValue);
});

afterEach(() => {
  document.body.innerHTML = '';
  resetStrings();
  vi.clearAllMocks();
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const FIELD = `
  <a11y-label>Attachments</a11y-label>
  <input type="file" name="attachments" multiple>
  <a11y-hint>Up to 5 MB each.</a11y-hint>
  <a11y-error></a11y-error>
`;

function mount(innerHtml: string = FIELD, attrs = ''): { el: FileInputElement; form: HTMLFormElement; input: HTMLInputElement } {
  const form = document.createElement('form');
  form.innerHTML = `<a11y-file-input ${attrs}>${innerHtml}</a11y-file-input>`;
  document.body.appendChild(form);
  const el = form.querySelector('a11y-file-input')!;
  return { el, form, input: el.querySelector('input')! };
}

function file(name: string, size = 10, type = ''): File {
  const f = new File(['x'.repeat(size)], name, { type, lastModified: 1 });
  return f;
}

/** A pick from the browser's dialog: the input's files are replaced, then `input` and `change` fire. */
function pick(input: HTMLInputElement, files: File[]): void {
  input.files = files as unknown as FileList;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function dragEvent(type: string, target: Element, files: File[] = [], types = ['Files']): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const transfer = new FakeDataTransfer();
  transfer.types = types;
  for (const f of files) transfer.items.add(f);
  Object.defineProperty(event, 'dataTransfer', { value: transfer });
  target.dispatchEvent(event);
  return event;
}

function drop(el: Element, files: File[]): void {
  const zone = el.querySelector('.a11y-file-input__dropzone')!;
  dragEvent('dragenter', zone, files);
  dragEvent('dragover', zone, files);
  dragEvent('drop', zone, files);
}

const names = (el: FileInputElement) => el.getValue().map((f) => f.name);
const listed = (el: FileInputElement) => [...el.querySelectorAll('.a11y-file-input__name')].map((n) => n.textContent);
const status = (el: FileInputElement) => el.querySelector('.a11y-file-input__status')!.textContent;
const rejected = (el: FileInputElement) => [...el.querySelectorAll('.a11y-file-input__rejected li')].map((li) => li.textContent);
const removeButtons = (el: FileInputElement) => [...el.querySelectorAll<HTMLButtonElement>('.a11y-file-input__remove')];
const states = (el: FileInputElement) => [...((el as any).internals.states as Set<string>)];

describe('a11y-file-input', () => {
  it('is form-associated', () => {
    expect((customElements.get('a11y-file-input') as any).formAssociated).toBe(true);
  });

  it('links the label, hint and error, and adds a browse label to the input', () => {
    const { el, input } = mount();
    const fieldLabel = el.querySelector('label.a11y-label')!;
    const browse = el.querySelector<HTMLLabelElement>('.a11y-file-input__button')!;
    expect(fieldLabel.getAttribute('for')).toBe(input.id);
    expect(browse.htmlFor).toBe(input.id);
    expect(browse.textContent).toBe('Browse files');
    expect([...input.labels!]).toEqual([fieldLabel, browse]);
    expect(input.getAttribute('aria-describedby')).toBe(el.querySelector('a11y-hint')!.id);
  });

  it('never takes its own browse label for the field label', () => {
    const { input } = mount('<input type="file">');
    expect(input.hasAttribute('aria-labelledby')).toBe(false);
    expect(input.labels).toHaveLength(1);
  });

  it('places the drop zone after the input and the lists after every part', () => {
    const { el, input } = mount();
    expect(input.nextElementSibling?.className).toBe('a11y-file-input__dropzone');
    expect([...el.children].slice(-3).map((c) => c.className)).toEqual([
      'a11y-file-input__rejected',
      'a11y-file-input__list',
      'a11y-file-input__status',
    ]);
    expect(el.querySelector('.a11y-file-input__prompt')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelector('.a11y-file-input__status')!.getAttribute('role')).toBe('status');
  });

  it('appends picks with `multiple`, skipping duplicates, and writes them back to the input', () => {
    const { el, input } = mount();
    pick(input, [file('a.pdf'), file('b.pdf')]);
    pick(input, [file('b.pdf'), file('c.pdf')]);
    expect(names(el)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect([...input.files!].map((f) => f.name)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(listed(el)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(status(el)).toBe('c.pdf added');
  });

  it('replaces the file without `multiple`', () => {
    const { el, input } = mount('<input type="file">');
    pick(input, [file('a.pdf')]);
    pick(input, [file('b.pdf')]);
    expect(names(el)).toEqual(['b.pdf']);
  });

  it('keeps the selection when a pick is canceled (an empty pick)', () => {
    const { el, input } = mount();
    pick(input, [file('a.pdf')]);
    pick(input, []);
    expect(names(el)).toEqual(['a.pdf']);
  });

  it('calls onChange once per pick, with the merged files', () => {
    const { el, input } = mount();
    pick(input, [file('a.pdf')]);
    el.onChange = vi.fn();
    pick(input, [file('b.pdf')]);
    expect(el.onChange).toHaveBeenCalledTimes(1);
    expect((el.onChange as any).mock.calls[0][0].map((f: File) => f.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  describe('drag and drop', () => {
    it('adds dropped files, fires input/change, and announces them', () => {
      const { el, input } = mount();
      const changes = vi.fn();
      input.addEventListener('change', changes);
      el.onChange = vi.fn();
      drop(el, [file('a.pdf'), file('b.pdf')]);
      expect(names(el)).toEqual(['a.pdf', 'b.pdf']);
      expect(changes).toHaveBeenCalledTimes(1);
      expect(el.onChange).toHaveBeenCalledTimes(1);
      expect(status(el)).toBe('2 files added');
    });

    it('shows the drag-over state while files are over it, whatever child they cross', () => {
      const { el } = mount();
      const zone = el.querySelector('.a11y-file-input__dropzone')!;
      const button = el.querySelector('.a11y-file-input__button')!;
      expect(dragEvent('dragenter', zone).defaultPrevented).toBe(true);
      dragEvent('dragenter', button);
      dragEvent('dragleave', zone);
      expect(zone.hasAttribute('data-dragover')).toBe(true);
      expect(states(el)).toContain('dragover');
      dragEvent('dragleave', button);
      expect(zone.hasAttribute('data-dragover')).toBe(false);
      expect(states(el)).not.toContain('dragover');
    });

    it('leaves drags that carry no files alone', () => {
      const { el } = mount();
      const zone = el.querySelector('.a11y-file-input__dropzone')!;
      expect(dragEvent('dragenter', zone, [], ['text/plain']).defaultPrevented).toBe(false);
      expect(dragEvent('dragover', zone, [], ['text/plain']).defaultPrevented).toBe(false);
      expect(zone.hasAttribute('data-dragover')).toBe(false);
    });

    it('ignores drops while the input is disabled, including through a fieldset', () => {
      const { el, form } = mount();
      form.innerHTML = '';
      const fieldset = form.appendChild(document.createElement('fieldset'));
      fieldset.disabled = true;
      fieldset.appendChild(el);
      const zone = el.querySelector('.a11y-file-input__dropzone')!;
      expect(dragEvent('dragover', zone, [file('a.pdf')]).defaultPrevented).toBe(false);
      drop(el, [file('a.pdf')]);
      expect(names(el)).toEqual([]);
    });

    it('shows the error right away after a drop leaves the field invalid', () => {
      const { el, input } = mount(FIELD.replace('multiple', 'multiple required'), 'value-missing-message="Add a file"');
      drop(el, [file('a.gif', 10, 'image/gif')]);
      el.setAttribute('max-files', '0');
      drop(el, [file('b.pdf')]);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(el.querySelector('a11y-error')!.textContent).toBe('Add a file');
    });
  });

  describe('rules', () => {
    it('rejects files `accept` rules out — on drop too — and lists and announces why', () => {
      const { el } = mount(FIELD.replace('multiple', 'multiple accept=".pdf, image/*"'));
      drop(el, [file('a.pdf'), file('b.png', 10, 'image/png'), file('c.exe', 10, 'application/x-msdownload')]);
      expect(names(el)).toEqual(['a.pdf', 'b.png']);
      expect(rejected(el)).toEqual(['c.exe wasn’t added: this type of file isn’t allowed']);
      expect(status(el)).toBe('2 files added. c.exe wasn’t added: this type of file isn’t allowed');
    });

    it('rejects files over max-size and past max-files', () => {
      const { el } = mount(FIELD, 'max-size="1KB" max-files="2"');
      drop(el, [file('big.pdf', 2048), file('a.pdf'), file('b.pdf'), file('c.pdf')]);
      expect(names(el)).toEqual(['a.pdf', 'b.pdf']);
      expect(rejected(el)).toEqual([
        'big.pdf wasn’t added: it’s larger than 1 kB',
        'c.pdf wasn’t added: too many files (maximum 2)',
      ]);
    });

    it('uses the message attributes, then setStrings()', () => {
      const { el } = mount(FIELD, 'max-size="1KB" size-rejected-message="{name} is over {maxSize}"');
      setStrings({ fileCountRejected: '{name}: max {max}' });
      el.setAttribute('max-files', '1');
      drop(el, [file('big.pdf', 2048), file('a.pdf'), file('b.pdf')]);
      expect(rejected(el)).toEqual(['big.pdf is over 1 kB', 'b.pdf: max 1']);
    });

    it('keeps the current file when a single-file pick is rejected', () => {
      const { el, input } = mount('<input type="file" accept=".pdf">');
      pick(input, [file('a.pdf')]);
      pick(input, [file('b.png', 10, 'image/png')]);
      expect(names(el)).toEqual(['a.pdf']);
      expect([...input.files!].map((f) => f.name)).toEqual(['a.pdf']);
    });

    it('clears the rejections on the next change', () => {
      const { el, input } = mount(FIELD.replace('multiple', 'multiple accept=".pdf"'));
      drop(el, [file('a.png', 10, 'image/png')]);
      expect(rejected(el)).toHaveLength(1);
      pick(input, [file('a.pdf')]);
      expect(rejected(el)).toEqual([]);
      expect(el.querySelector<HTMLElement>('.a11y-file-input__rejected')!.hidden).toBe(true);
    });

    it('lets custom validators see the files', () => {
      const { el, input } = mount();
      el.validators = [(_value, control) => ((control as HTMLInputElement).files!.length < 2 ? 'Add two files' : null)];
      pick(input, [file('a.pdf')]);
      expect(el.checkValidity()).toBe(false);
      pick(input, [file('b.pdf')]);
      expect(el.checkValidity()).toBe(true);
    });
  });

  describe('removing', () => {
    it('names each remove button after its file, starting with the visible text', () => {
      const { el, input } = mount();
      pick(input, [file('a.pdf')]);
      const [button] = removeButtons(el);
      expect(button!.textContent).toBe('Remove');
      expect(button!.getAttribute('aria-label')).toBe('Remove a.pdf');
      expect(button!.type).toBe('button');
    });

    it('removes the file, announces it and moves focus to the next, then previous file, then the input', () => {
      const { el, input } = mount();
      pick(input, [file('a.pdf'), file('b.pdf'), file('c.pdf')]);
      const changes = vi.fn();
      input.addEventListener('change', changes);

      removeButtons(el)[1]!.click();
      expect(names(el)).toEqual(['a.pdf', 'c.pdf']);
      expect([...input.files!].map((f) => f.name)).toEqual(['a.pdf', 'c.pdf']);
      expect(status(el)).toBe('b.pdf removed');
      expect(changes).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(removeButtons(el)[1]); // c.pdf

      removeButtons(el)[1]!.click();
      expect(document.activeElement).toBe(removeButtons(el)[0]); // a.pdf

      removeButtons(el)[0]!.click();
      expect(document.activeElement).toBe(input);
      expect(el.querySelector<HTMLElement>('.a11y-file-input__list')!.hidden).toBe(true);
    });

    it('shows the required error right away when the last file is removed', () => {
      const { el, input } = mount(FIELD.replace('multiple', 'multiple required'));
      pick(input, [file('a.pdf')]);
      expect(input.hasAttribute('aria-invalid')).toBe(false);
      removeButtons(el)[0]!.click();
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(el.querySelector<HTMLElement>('a11y-error')!.hidden).toBe(false);
    });

    it('disables the remove buttons with the input', async () => {
      const { el, input } = mount();
      pick(input, [file('a.pdf')]);
      input.disabled = true;
      await flush();
      expect(removeButtons(el)[0]!.disabled).toBe(true);
    });
  });

  describe('previews', () => {
    it('shows image previews only with `previews`, with an empty alt', () => {
      const { el, input } = mount();
      pick(input, [file('a.png', 10, 'image/png'), file('b.pdf')]);
      expect(el.querySelector('img')).toBeNull();
      el.setAttribute('previews', '');
      const images = el.querySelectorAll('img.a11y-file-input__preview');
      expect(images).toHaveLength(1);
      expect(images[0]!.getAttribute('alt')).toBe('');
      expect(images[0]!.getAttribute('src')).toBe('blob:a.png');
    });

    it('revokes object URLs on removal and on disconnect', () => {
      const { el, input } = mount(FIELD, 'previews');
      pick(input, [file('a.png', 10, 'image/png'), file('b.png', 10, 'image/png')]);
      removeButtons(el)[0]!.click();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a.png');
      el.remove();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b.png');
    });
  });

  describe('API', () => {
    it('setValue, removeFile and clear are silent; addFiles acts like a drop', () => {
      const { el, input } = mount();
      const changes = vi.fn();
      input.addEventListener('change', changes);

      el.setValue([file('a.pdf'), file('b.pdf')]);
      el.removeFile(0);
      expect(names(el)).toEqual(['b.pdf']);
      el.clear();
      expect(names(el)).toEqual([]);
      expect(changes).not.toHaveBeenCalled();
      expect(status(el)).toBe('');

      el.addFiles([file('c.pdf')]);
      expect(names(el)).toEqual(['c.pdf']);
      expect(changes).toHaveBeenCalledTimes(1);
      expect(status(el)).toBe('c.pdf added');
    });

    it('setValue still applies the rules', () => {
      const { el } = mount(FIELD, 'max-files="1"');
      el.setValue([file('a.pdf'), file('b.pdf')]);
      expect(names(el)).toEqual(['a.pdf']);
      expect(rejected(el)).toEqual([]);
    });
  });

  it('empties the selection on form reset', async () => {
    const { el, input } = mount(FIELD.replace('multiple', 'multiple accept=".pdf"'));
    drop(el, [file('a.pdf'), file('b.png', 10, 'image/png')]);
    el.formResetCallback(); // what form.reset() calls; jsdom doesn't
    await flush();
    expect(names(el)).toEqual([]);
    expect(listed(el)).toEqual([]);
    expect(rejected(el)).toEqual([]);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('relabels its generated text from attributes and setStrings()', () => {
    const { el, input } = mount();
    pick(input, [file('a.pdf')]);
    setStrings({ browseFiles: 'Parcourir', dropFiles: 'ou déposez des fichiers', remove: 'Retirer', removeFile: 'Retirer {name}' });
    expect(el.querySelector('.a11y-file-input__button')!.textContent).toBe('Parcourir');
    expect(el.querySelector('.a11y-file-input__prompt')!.textContent).toBe('ou déposez des fichiers');
    expect(removeButtons(el)[0]!.getAttribute('aria-label')).toBe('Retirer a.pdf');
    el.setAttribute('browse-label', 'Choose photos');
    expect(el.querySelector('.a11y-file-input__button')!.textContent).toBe('Choose photos');
  });

  it('keeps working after being moved, without doubling listeners', () => {
    const { el, input } = mount(FIELD, 'previews');
    pick(input, [file('a.png', 10, 'image/png')]);
    for (let i = 0; i < 3; i++) document.body.appendChild(el);
    el.onChange = vi.fn();
    pick(input, [file('b.pdf')]);
    expect(el.onChange).toHaveBeenCalledTimes(1);
    expect(names(el)).toEqual(['a.png', 'b.pdf']);
    expect(el.querySelector('img')!.getAttribute('src')).toBe('blob:a.png');
  });

  it('settles: a sync produces no further mutations', async () => {
    const { el, input } = mount();
    pick(input, [file('a.pdf')]);
    await flush();
    const records: MutationRecord[] = [];
    const observer = new MutationObserver((r) => records.push(...r));
    observer.observe(el, { subtree: true, childList: true, attributes: true, characterData: true });
    el.setAttribute('max-size', '5MB');
    await flush();
    await flush();
    observer.disconnect();
    expect(records.filter((r) => r.attributeName !== 'max-size')).toEqual([]);
  });

  it('picks up parts added later, keeping its lists last', async () => {
    const { el } = mount('<input type="file">');
    const error = document.createElement('a11y-error');
    el.appendChild(error);
    await flush();
    expect(el.lastElementChild?.className).toBe('a11y-file-input__status');
    expect(error.nextElementSibling?.className).toBe('a11y-file-input__rejected');
  });
});

describe('sizes', () => {
  it('parses max-size in binary units, or ignores it', () => {
    expect(parseSize('500')).toBe(500);
    expect(parseSize('2KB')).toBe(2048);
    expect(parseSize('1.5 mb')).toBe(1.5 * 1024 * 1024);
    expect(parseSize('lots')).toBeNull();
    expect(parseSize(null)).toBeNull();
  });

  it('formats sizes in the largest fitting unit, localized', () => {
    expect(formatSize(512, 'en')).toBe('512 bytes');
    expect(formatSize(1, 'en')).toBe('1 byte');
    expect(formatSize(1536, 'en')).toBe('1.5 kB');
    expect(formatSize(5 * 1024 * 1024, 'fr')).toBe('5\u202fMo');
  });
});
