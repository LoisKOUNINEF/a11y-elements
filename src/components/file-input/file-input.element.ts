import { A11yFieldElement } from '../../core/a11y-field-element.js';
import { syncAttr, syncText } from '../../core/dom-sync.js';
import type { FieldControl } from '../../core/field.js';
import { nextId } from '../../core/ids.js';
import { formatString, getString } from '../../core/strings.js';

/** Marks the markup this element builds, so the field never takes it for a consumer part. */
const GENERATED = 'data-a11y-generated';

const SIZE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
const SIZE_FACTORS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/**
 * A file picker built from a real `<input type="file">`, with the same
 * optional parts as `<a11y-input>` (`<a11y-label>`, `<a11y-hint>`,
 * `<a11y-error>`). Files can be browsed for or dragged onto the element.
 *
 * ```html
 * <a11y-file-input max-size="5MB" max-files="3" previews>
 *   <a11y-label>Attachments</a11y-label>
 *   <input type="file" name="attachments" multiple accept=".pdf,image/*" required>
 *   <a11y-hint>PDF or images, up to 5 MB each.</a11y-hint>
 *   <a11y-error></a11y-error>
 * </a11y-file-input>
 * ```
 *
 * The native input stays the focusable control: it's only visually hidden,
 * so it keeps its role, `required`, validity and the field's ARIA. It's
 * joined by generated markup:
 *
 * - a drop zone holding a `<label for>` styled as a "Browse files" button,
 *   which opens the picker natively and adds its text to the input's
 *   accessible name (so voice control users can say it);
 * - the list of selected files, each with a "Remove" button named after
 *   its file;
 * - a list of the files that weren't added, and why;
 * - a polite status region announcing what was added, removed or rejected.
 *
 * Dragging is only a shortcut: everything works from the keyboard. With
 * `multiple`, browsing or dropping again adds to the selection instead of
 * replacing it. Files that fail `accept`, `max-size` or `max-files` are never
 * added (the browser doesn't check `accept` on drop), so those rules can't
 * make the field invalid; `required` and `validators` still can.
 *
 * The selection is written back to `input.files`, so the input submits it
 * with the form like any file input.
 */
export class FileInputElement extends A11yFieldElement<File[]> {
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'max-size', 'max-files', 'previews', 'browse-label', 'drop-label'];
  }

  protected readonly controlSelector = 'input[type="file"]';

  private _files: File[] = [];
  /** The control `_files` was last read from — a new one brings its own files. */
  private _filesControl: HTMLInputElement | null = null;
  private _previewUrls = new Map<File, string>();
  /** Set while this element fires `input`/`change` itself, so it doesn't take them for a new pick. */
  private _committing = false;
  /** `dragenter`s minus `dragleave`s, since both fire again for every child crossed. */
  private _dragDepth = 0;
  /** Key for the host's own listeners in `wireOnce()`, which the field base already uses for the host. */
  private readonly _hostKey = document.createComment('');

  /** Adds files as a drop would: checked against the rules, announced, and followed by `input`/`change` events. */
  addFiles(files: Iterable<File>): void {
    const control = this._fileControl();
    if (control) this._addFromUser(control, [...files], true);
  }

  /** Removes a file, by reference or index. Silent, like `setValue()`: no events, no announcement. */
  removeFile(file: File | number): void {
    const index = typeof file === 'number' ? file : this._files.indexOf(file);
    const control = this._fileControl();
    if (!control || index < 0 || index >= this._files.length) return;
    this._files.splice(index, 1);
    this._afterSilentChange(control);
  }

  /** Removes every file. Silent, like `setValue()`. */
  clear(): void {
    const control = this._fileControl();
    if (!control) return;
    this._files = [];
    this._afterSilentChange(control);
  }

  override formResetCallback(): void {
    super.formResetCallback();
    // The form empties `input.files` itself; only this element's copy is left.
    this._files = [];
    this._renderList();
    this._renderRejected([]);
    const status = this._generated('status');
    if (status) syncText(status, '');
  }

  protected override readValue(): File[] {
    return [...this._files];
  }

  /** Replaces the selection. Files the rules rule out are dropped, silently. */
  protected override writeValue(control: FieldControl, files: File[]): void {
    this._files = this._intake(control as HTMLInputElement, files, []).files;
    this._commit(control as HTMLInputElement);
    this._renderList();
    this._renderRejected([]);
  }

  protected override onDisconnect(): void {
    this._setDragover(false);
    for (const url of this._previewUrls.values()) URL.revokeObjectURL(url);
    this._previewUrls.clear();
    // Previews are rebuilt on reconnect.
    this._filesControl = null;
  }

  protected override onStringsChange(): void {
    this._sync(); // relabels the drop zone and re-links the field
    this._renderList();
  }

  protected override _sync(): void {
    const control = this._fileControl();
    if (control) {
      this._syncUi(control);
      if (this._filesControl !== control) {
        this._filesControl = control;
        this._files = [...(control.files ?? [])];
        this._renderList();
      }
      const list = this._generated('list');
      if (list && this.boolAttr('previews') !== list.hasAttribute('data-previews')) this._renderList();
      const disabled = control.matches(':disabled');
      for (const button of this._removeButtons()) syncAttr(button, 'disabled', disabled ? '' : null);
    }

    this.wireOnce(this._hostKey, () => {
      // Capture: runs before the field base's `onChange`/`onInput`, which then see the merged selection.
      this.listen(this, 'input', (event) => this._onNativePick(event), true);
      this.listen(this, 'change', (event) => this._onNativePick(event), true);
      this.listen(this, 'dragenter', (event) => this._onDrag(event as DragEvent));
      this.listen(this, 'dragover', (event) => this._onDrag(event as DragEvent));
      this.listen(this, 'dragleave', (event) => this._onDrag(event as DragEvent));
      this.listen(this, 'drop', (event) => this._onDrag(event as DragEvent));
      this.listen(this, 'click', (event) => this._onClick(event));
    });

    super._sync();
  }

  private _fileControl(): HTMLInputElement | null {
    return this._control() as HTMLInputElement | null;
  }

  private _generated(name: 'dropzone' | 'rejected' | 'list' | 'status'): HTMLElement | null {
    return this.querySelector<HTMLElement>(`:scope > .a11y-file-input__${name}`);
  }

  private _removeButtons(): HTMLButtonElement[] {
    const list = this._generated('list');
    return list ? [...list.querySelectorAll<HTMLButtonElement>('.a11y-file-input__remove')] : [];
  }

  /** Builds the drop zone (right after the input) and the lists and status (last), moving them only when misplaced. */
  private _syncUi(control: HTMLInputElement): void {
    if (!control.id) control.id = nextId('a11y-field');

    let dropzone = this._generated('dropzone');
    if (!dropzone) {
      dropzone = document.createElement('div');
      dropzone.className = 'a11y-file-input__dropzone';
      dropzone.setAttribute(GENERATED, '');
      const button = document.createElement('label');
      button.className = 'a11y-file-input__button';
      const prompt = document.createElement('span');
      prompt.className = 'a11y-file-input__prompt';
      // A pointer-only instruction: keyboard and screen reader users browse instead.
      prompt.setAttribute('aria-hidden', 'true');
      dropzone.append(button, prompt);
    }
    if (control.nextElementSibling !== dropzone) control.after(dropzone);
    const button = dropzone.querySelector<HTMLLabelElement>('.a11y-file-input__button')!;
    syncAttr(button, 'for', control.id);
    syncText(button, this.stringAttr('browse-label', getString('browseFiles')));
    syncText(dropzone.querySelector('.a11y-file-input__prompt')!, this.stringAttr('drop-label', getString('dropFiles')));

    // After the consumer's parts, so the rejections sit right below the error.
    const tail = (['rejected', 'list', 'status'] as const).map((name) => {
      const existing = this._generated(name);
      if (existing) return existing;
      const el = document.createElement(name === 'status' ? 'div' : 'ul');
      el.className = `a11y-file-input__${name}`;
      el.setAttribute(GENERATED, '');
      if (name === 'status') el.setAttribute('role', 'status');
      else el.hidden = true;
      return el;
    });
    const children = [...this.children];
    if (tail.some((el, i) => children[children.length - tail.length + i] !== el)) this.append(...tail);
    syncAttr(tail[1]!, 'aria-label', getString('selectedFiles'));
  }

  /** A pick from the browser's dialog: merge it into the selection before anyone else reads the input. */
  private _onNativePick(event: Event): void {
    const control = this._fileControl();
    if (this._committing || !control || event.target !== control) return;
    const picked = [...(control.files ?? [])];
    // `input` and `change` both fire for one pick: the second finds it already merged.
    if (sameFiles(picked, this._files)) return;
    this._addFromUser(control, picked, false);
  }

  private _onDrag(event: DragEvent): void {
    if (![...(event.dataTransfer?.types ?? [])].includes('Files')) return;
    const control = this._fileControl();
    const enabled = !!control && !control.matches(':disabled');

    switch (event.type) {
      case 'dragenter':
        if (!enabled) return;
        event.preventDefault();
        this._dragDepth++;
        this._setDragover(true);
        break;
      case 'dragover':
        if (!enabled) return;
        event.preventDefault(); // allows the drop
        event.dataTransfer!.dropEffect = 'copy';
        break;
      case 'dragleave':
        this._dragDepth = Math.max(0, this._dragDepth - 1);
        if (this._dragDepth === 0) this._setDragover(false);
        break;
      case 'drop':
        event.preventDefault(); // never let the browser open the file instead
        this._dragDepth = 0;
        this._setDragover(false);
        if (enabled) this._addFromUser(control, [...(event.dataTransfer?.files ?? [])], true);
        break;
    }
  }

  private _onClick(event: Event): void {
    const button = (event.target as Element).closest?.('.a11y-file-input__remove');
    const control = this._fileControl();
    if (!button || !control || !this._generated('list')?.contains(button)) return;
    const index = this._removeButtons().indexOf(button as HTMLButtonElement);
    const [removed] = this._files.splice(index, 1);
    if (!removed) return;

    this._commit(control);
    this._renderList();
    this._renderRejected([]);
    this._announce([formatString(getString('fileRemoved'), { name: removed.name })]);
    this._dispatch(control);
    this.binding?.show();

    // Never drop focus to <body>: the next file, else the previous one, else the input.
    const buttons = this._removeButtons();
    (buttons[index] ?? buttons[index - 1] ?? control).focus();
  }

  /** Adds files the user picked or dropped, then lists, announces and (for drops) fires `input`/`change`. */
  private _addFromUser(control: HTMLInputElement, incoming: File[], dispatch: boolean): void {
    const { files, added, rejected } = this._intake(control, incoming, this._files);
    this._files = files;
    this._commit(control);
    this._renderList();
    this._renderRejected(rejected);

    const messages: string[] = [];
    if (added.length === 1) messages.push(formatString(getString('fileAdded'), { name: added[0]!.name }));
    else if (added.length > 1) messages.push(formatString(getString('filesAdded'), { count: String(added.length) }));
    this._announce([...messages, ...rejected]);

    if (dispatch) {
      this._dispatch(control);
      this.binding?.show();
    }
  }

  /**
   * Checks `incoming` against `accept`, `max-size` and `max-files`. With
   * `multiple`, new files join `current` (skipping ones already there);
   * without, the first acceptable one replaces it — and if none is, `current`
   * stays.
   */
  private _intake(control: HTMLInputElement, incoming: File[], current: File[]): { files: File[]; added: File[]; rejected: string[] } {
    const multiple = control.multiple;
    const maxFiles = multiple ? this.numberAttr('max-files', Infinity) : 1;
    const maxSize = parseSize(this.getAttribute('max-size'));
    const values = {
      max: String(maxFiles),
      maxSize: maxSize == null ? '' : formatSize(maxSize, this._lang()),
    };
    const files = multiple ? [...current] : [];
    const added: File[] = [];
    const rejected: string[] = [];
    const reject = (key: 'fileTypeRejected' | 'fileSizeRejected' | 'fileCountRejected', attribute: string, file: File) =>
      rejected.push(formatString(this.stringAttr(attribute, getString(key)), { ...values, name: file.name }));

    for (const file of incoming) {
      if (files.some((kept) => sameFile(kept, file))) continue;
      if (!matchesAccept(file, control.accept)) reject('fileTypeRejected', 'type-rejected-message', file);
      else if (maxSize != null && file.size > maxSize) reject('fileSizeRejected', 'size-rejected-message', file);
      else if (files.length >= maxFiles) reject('fileCountRejected', 'count-rejected-message', file);
      else {
        files.push(file);
        added.push(file);
      }
    }
    return { files: multiple || added.length ? files : [...current], added, rejected };
  }

  private _afterSilentChange(control: HTMLInputElement): void {
    this._commit(control);
    this._renderList();
    this._renderRejected([]);
    this.binding?.validate();
  }

  /** Writes the selection to `input.files`, so the form submits it and `required` sees it. */
  private _commit(control: HTMLInputElement): void {
    if (typeof DataTransfer === 'undefined') return;
    const transfer = new DataTransfer();
    for (const file of this._files) transfer.items.add(file);
    control.files = transfer.files;
  }

  private _dispatch(control: HTMLInputElement): void {
    this._committing = true;
    try {
      control.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      control.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      this._committing = false;
    }
  }

  private _renderList(): void {
    const list = this._generated('list');
    if (!list) return;
    const previews = this.boolAttr('previews');
    const disabled = !!this._fileControl()?.matches(':disabled');
    const lang = this._lang();

    for (const [file, url] of this._previewUrls) {
      if (previews && this._files.includes(file)) continue;
      URL.revokeObjectURL(url);
      this._previewUrls.delete(file);
    }

    list.replaceChildren(
      ...this._files.map((file) => {
        const item = document.createElement('li');
        item.className = 'a11y-file-input__item';
        if (previews && file.type.startsWith('image/')) {
          let url = this._previewUrls.get(file);
          if (!url) {
            url = URL.createObjectURL(file);
            this._previewUrls.set(file, url);
          }
          const img = document.createElement('img');
          img.className = 'a11y-file-input__preview';
          img.alt = ''; // the name next to it already says what it is
          img.src = url;
          item.append(img);
        }
        const name = document.createElement('span');
        name.className = 'a11y-file-input__name';
        name.textContent = file.name;
        const size = document.createElement('span');
        size.className = 'a11y-file-input__size';
        size.textContent = formatSize(file.size, lang);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'a11y-file-input__remove';
        remove.textContent = getString('remove');
        // Starts with the visible text, so voice control's "click Remove" still matches.
        remove.setAttribute('aria-label', formatString(getString('removeFile'), { name: file.name }));
        remove.disabled = disabled;
        item.append(name, size, remove);
        return item;
      }),
    );
    syncAttr(list, 'data-previews', previews ? '' : null);
    syncAttr(list, 'hidden', this._files.length ? null : '');
  }

  private _renderRejected(messages: string[]): void {
    const list = this._generated('rejected');
    if (!list) return;
    if (messages.length || list.childElementCount) {
      list.replaceChildren(
        ...messages.map((message) => {
          const item = document.createElement('li');
          item.textContent = message;
          return item;
        }),
      );
    }
    syncAttr(list, 'hidden', messages.length ? null : '');
  }

  private _announce(messages: string[]): void {
    const status = this._generated('status');
    if (status && messages.length) status.textContent = messages.join('. ');
  }

  private _setDragover(on: boolean): void {
    const dropzone = this._generated('dropzone');
    if (dropzone) syncAttr(dropzone, 'data-dragover', on ? '' : null);
    if (!on) this._dragDepth = 0;
    try {
      if (on) this.internals.states?.add('dragover');
      else this.internals.states?.delete('dragover');
    } catch {
      // Older Chromium only accepted `--dashed` state names.
    }
  }

  private _lang(): string | undefined {
    return this.closest('[lang]')?.getAttribute('lang') || undefined;
  }
}

function sameFile(a: File, b: File): boolean {
  return a === b || (a.name === b.name && a.size === b.size && a.lastModified === b.lastModified && a.type === b.type);
}

function sameFiles(a: File[], b: File[]): boolean {
  return a.length === b.length && a.every((file, i) => sameFile(file, b[i]!));
}

/** The `accept` attribute's rules: `.ext`, `type/*` or an exact MIME type. Empty accepts everything. */
function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);
  if (!rules.length) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

/** `5MB`, `500 KB`, `1.5gb` or plain bytes (binary units) → bytes; anything else → no limit. */
export function parseSize(value: string | null): number | null {
  const match = value?.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) return null;
  return Math.round(Number(match[1]) * SIZE_FACTORS[(match[2] ?? 'b').toLowerCase()]!);
}

/** A size in the largest fitting unit, localized with `Intl` (`1.5 MB`, `1,5 Mo`, …). */
export function formatSize(bytes: number, lang?: string): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const options: Intl.NumberFormatOptions = {
    style: 'unit',
    unit: SIZE_UNITS[unit],
    unitDisplay: unit === 0 ? 'long' : 'short', // "3 bytes", but "1.5 MB"
    maximumFractionDigits: unit === 0 ? 0 : 1,
  };
  try {
    return new Intl.NumberFormat(lang, options).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, options).format(value); // an invalid `lang`
  }
}
