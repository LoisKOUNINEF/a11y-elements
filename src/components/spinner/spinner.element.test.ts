import { afterEach, describe, expect, it } from 'vitest';
import './define.js';
import { resetStrings, setStrings } from '../../core/strings.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function mount(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('a11y-spinner');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

describe('a11y-spinner', () => {
  it('renders role=status, the a11y-spinner class, and a a11y-spinner__ring span', () => {
    const el = mount();
    expect(el.getAttribute('role')).toBe('status');
    expect(el.classList.contains('a11y-spinner')).toBe(true);
    expect(el.querySelector('.a11y-spinner__ring')).not.toBeNull();
    expect(el.querySelector('.a11y-spinner__ring')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('defaults aria-label to "Loading"', () => {
    const el = mount();
    expect(el.getAttribute('aria-label')).toBe('Loading');
  });

  it('uses a custom label from the label attribute', () => {
    const el = mount({ label: 'Saving changes' });
    expect(el.getAttribute('aria-label')).toBe('Saving changes');
  });

  it('sets each CSS custom property only when its attribute is given', () => {
    const el = mount({ size: '2rem', color: 'red', duration: '1s', thickness: '3px' });
    expect(el.style.getPropertyValue('--a11y-spinner-size')).toBe('2rem');
    expect(el.style.getPropertyValue('--a11y-spinner-color')).toBe('red');
    expect(el.style.getPropertyValue('--a11y-spinner-duration')).toBe('1s');
    expect(el.style.getPropertyValue('--a11y-spinner-thickness')).toBe('3px');
  });

  it('sets no CSS custom properties when none are given', () => {
    const el = mount();
    expect(el.style.getPropertyValue('--a11y-spinner-size')).toBe('');
  });

  it('updates aria-label and CSS custom properties reactively when attributes change', () => {
    const el = mount();
    el.setAttribute('label', 'Loading more…');
    el.setAttribute('size', '4rem');
    expect(el.getAttribute('aria-label')).toBe('Loading more…');
    expect(el.style.getPropertyValue('--a11y-spinner-size')).toBe('4rem');
  });

  it('exposes JS property accessors that reflect to/from attributes', () => {
    const el = mount() as HTMLElement & {
      label: string;
      size?: string;
    };
    el.label = 'Via property';
    expect(el.getAttribute('label')).toBe('Via property');
    expect(el.getAttribute('aria-label')).toBe('Via property');

    el.size = '1rem';
    expect(el.getAttribute('size')).toBe('1rem');
    el.size = undefined;
    expect(el.hasAttribute('size')).toBe(false);
  });

  it('keeps a consumer inline CSS var when the matching attribute is absent', () => {
    const el = mount({ style: '--a11y-spinner-color: red;', size: '3rem' });
    expect(el.style.getPropertyValue('--a11y-spinner-color')).toBe('red');
    el.setAttribute('label', 'Re-render');
    expect(el.style.getPropertyValue('--a11y-spinner-color')).toBe('red');
  });

  it('an attribute overrides the consumer inline var while set, and restores it once removed', () => {
    const el = mount({ style: '--a11y-spinner-color: red;' });
    el.setAttribute('color', 'blue');
    expect(el.style.getPropertyValue('--a11y-spinner-color')).toBe('blue');
    el.removeAttribute('color');
    expect(el.style.getPropertyValue('--a11y-spinner-color')).toBe('red');
  });

  it('removes a var it set itself once the attribute is removed', () => {
    const el = mount({ color: 'blue' });
    el.removeAttribute('color');
    expect(el.style.getPropertyValue('--a11y-spinner-color')).toBe('');
  });

  it('keeps consumer classes across renders', () => {
    const el = mount({ class: 'my-spinner' });
    el.setAttribute('size', '2rem');
    expect(el.classList.contains('my-spinner')).toBe(true);
    expect(el.classList.contains('a11y-spinner')).toBe(true);
  });
});

describe('a11y-spinner — translated label', () => {
  afterEach(() => resetStrings());

  it('defaults to "Loading"', () => {
    expect(mount().getAttribute('aria-label')).toBe('Loading');
  });

  it('uses setStrings({ loading }) for new and already-mounted spinners', () => {
    const mounted = mount();
    setStrings({ loading: 'Chargement' });
    expect(mounted.getAttribute('aria-label')).toBe('Chargement');
    expect(mount().getAttribute('aria-label')).toBe('Chargement');
  });

  it('lets the label attribute win over setStrings', () => {
    const el = mount({ label: 'Saving' });
    setStrings({ loading: 'Chargement' });
    expect(el.getAttribute('aria-label')).toBe('Saving');
  });

  it('stops reacting once disconnected', () => {
    const el = mount();
    el.remove();
    setStrings({ loading: 'Chargement' });
    expect(el.getAttribute('aria-label')).toBe('Loading');
  });
});
