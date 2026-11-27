import { doc } from './safe-dom.js';

export type InputModality = 'keyboard' | 'pointer';

interface ModalityState {
  /** The kind of input the user last used on the page, `null` before any. */
  last: InputModality | null;
  listening: boolean;
}

/**
 * Page-wide, on `globalThis` for the same reason as the overlay registry:
 * each standalone browser bundle inlines its own copy of this module, and
 * they must agree on what the user last did.
 */
const STATE_KEY = Symbol.for('a11y-elements/input-modality');
const store = globalThis as unknown as Record<symbol, ModalityState | undefined>;
const state: ModalityState = (store[STATE_KEY] ??= { last: null, listening: false });

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'Fn']);

/**
 * Starts tracking whether the last input was a keyboard or a pointer, with
 * capture-phase listeners on `document` installed once per page. Keys
 * pressed with Ctrl/Alt/Meta and lone modifier keys don't count (a shortcut
 * or a screenshot isn't keyboard navigation), like the browsers'
 * `:focus-visible` heuristic. A `preventDefault()`ed key still counts: an
 * Escape that closes a modal and sends focus back is keyboard navigation,
 * though Firefox then doesn't match `:focus-visible`.
 */
export function trackInputModality(): void {
  if (state.listening || typeof document === 'undefined') return;
  state.listening = true;
  doc.addEventListener(
    'keydown',
    (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || MODIFIER_KEYS.has(e.key)) return;
      state.last = 'keyboard';
    },
    true,
  );
  doc.addEventListener(
    'pointerdown',
    () => {
      state.last = 'pointer';
    },
    true,
  );
}

/** What the user last used, `null` before any input (or before `trackInputModality()`). */
export function lastInputModality(): InputModality | null {
  return state.last;
}

/**
 * Whether focus on `el` came from the keyboard: from the last input when
 * there was one, else (focus moved by script on load, `autofocus`) from the
 * browser's `:focus-visible`, and `true` where that selector is unsupported.
 */
export function isKeyboardFocus(el: Element): boolean {
  if (state.last) return state.last === 'keyboard';
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

/** Forgets the last input. Tests only. */
export function resetInputModality(): void {
  state.last = null;
}
