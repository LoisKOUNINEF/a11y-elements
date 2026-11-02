/**
 * The value contract shared by every element that holds a user-chosen value
 * — checkbox, switch, select, radio-group, checkbox-group and the fields
 * (`<a11y-input>`, `<a11y-textarea>`, `<a11y-file-input>`):
 *
 * - `getValue()` reads it from the wrapped native control(s);
 * - `setValue()` writes it silently: no events, no `onChange`, as when
 *   setting a native control's `value` from code;
 * - `onChange` is called with the new value when the user changes it.
 *
 * The native controls stay the source of truth: their own `change` events
 * and properties keep working, and only they submit with a form.
 */
export interface ValueElement<V> {
  getValue(): V;
  setValue(value: V): void;
  onChange?: (value: V) => void;
}
