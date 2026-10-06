import { A11yElement } from '../../core/a11y-element.js';
import { FocusTrapHelper } from '../../core/focus-trap.js';
import {
  emitOverlayClose,
  emitOverlayOpen,
  forgetPortalOrigin,
  recordPortalOrigin,
  registerOpenOverlay,
  unregisterOpenOverlay,
} from '../../core/overlay-registry.js';
import { getString } from '../../core/strings.js';
import { whenTransitionDone } from '../../core/transition.js';
import type { PassiveOverlayPosition } from '../core/a11y-passive-overlay-element.js';

export type FloatingPosition = PassiveOverlayPosition;

const POSITIONS: readonly FloatingPosition[] = ['top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const DEFAULT_POSITION: FloatingPosition = 'bottom-right';
const DEFAULT_SCROLL_THRESHOLD = 16;
const TRIGGER_SELECTOR = '[data-floating-trigger]';

/** Tag → `aria-haspopup` value for the overlays a trigger can control. */
const HASPOPUP: Record<string, string> = {
  'a11y-modal': 'dialog',
  'a11y-drawer': 'dialog',
  'a11y-emergency-dialog': 'dialog',
  'a11y-dropdown': 'menu',
  'a11y-context-menu': 'menu',
};

/** The parts of an overlay a trigger drives — typed structurally so this module doesn't import every overlay. */
interface ControllableOverlay extends HTMLElement {
  open: boolean;
  anchorElement?: HTMLElement | null;
}

let idCounter = 0;

/**
 * Content pinned to a corner/edge of the viewport — a floating "Menu" button
 * that opens a drawer, an info bubble, a help launcher. Visible by default
 * (no `open` attribute); hide it with the native `hidden` attribute or
 * `dismiss()`. Unlike the other overlays it is *not* closed by
 * `dismissAllOverlays()` — only its expanded panel is collapsed.
 *
 * ```html
 * <!-- Controls mode: its button toggles another overlay -->
 * <a11y-floating controls="nav-drawer"><button>Menu</button></a11y-floating>
 * <a11y-drawer id="nav-drawer">…</a11y-drawer>
 *
 * <!-- Expandable mode: a launcher that expands its own panel -->
 * <a11y-floating expandable label="Help"><h2>Need help?</h2>…</a11y-floating>
 *
 * <!-- Info bubble -->
 * <a11y-floating position="bottom-left" label="What's new" dismissible><p>…</p></a11y-floating>
 * ```
 *
 * Stacking: every instance moves itself into a shared per-position container
 * on `<body>` (`.a11y-floating-stack[data-position]`), so several in one
 * corner stack instead of overlapping. The container is looked up in the DOM
 * rather than module state, so instances from separate standalone bundles
 * share it too. The parent it was authored in is recorded for
 * `removeOverlaysWithin()`.
 *
 * Reparenting `this` re-runs the connected/disconnected callbacks; moves go
 * through `_moveSelfTo()`, which suppresses that churn — see
 * `A11yOverlayElement`'s class doc.
 */
export class FloatingElement extends A11yElement {
  static get observedAttributes(): string[] {
    return [
      'position',
      'controls',
      'expandable',
      'expanded',
      'label',
      'panel-label',
      'close-label',
      'dismissible',
      'dismiss-label',
      'announce',
      'trap-focus',
      'hide-on-scroll',
    ];
  }

  declare onClose?: () => void;

  private _internalMove = false;
  private _stack: HTMLElement | null = null;
  private _ownsRole = false;

  // Controls mode
  private _controlsEl: HTMLElement | null = null;
  private _target: ControllableOverlay | null = null;
  private _trigger: HTMLElement | null = null;
  private _targetObserver: MutationObserver | null = null;
  /** True when this element set the target's `anchorElement` (and must clear it on unbind). */
  private _anchoredTarget = false;
  private _onTriggerClick = (): void => {
    if (this._target) this._target.open = !this._target.open;
  };

  // Expandable mode
  private _launcher: HTMLElement | null = null;
  private _generatedLauncher = false;
  private _panel: HTMLElement | null = null;
  private _panelClose: HTMLButtonElement | null = null;
  private _isExpanded = false;
  private _focusTrap: FocusTrapHelper | null = null;
  private _outsideClickTimer: ReturnType<typeof setTimeout> | null = null;
  private _cancelPanelHide: (() => void) | null = null;
  private _registryHandle = { close: (): void => this.collapse() };
  private _onLauncherClick = (): void => this.toggle();

  // Dismiss
  private _dismissButton: HTMLButtonElement | null = null;
  private _focusOrigin: HTMLElement | null = null;
  private _cancelDismissWait: (() => void) | null = null;

  // Hide on scroll
  private _lastScrollY = 0;
  private _scrollListening = false;

  get position(): FloatingPosition {
    const value = this.getAttribute('position') as FloatingPosition | null;
    return value && POSITIONS.includes(value) ? value : DEFAULT_POSITION;
  }

  set position(value: FloatingPosition) {
    this.setAttribute('position', value);
  }

  get expanded(): boolean {
    return this.boolAttr('expanded');
  }

  set expanded(value: boolean) {
    this.setBoolAttr('expanded', value);
  }

  /** The overlay this element's trigger toggles: an explicit `.controlsElement`, or the `controls="<id>"` attribute. */
  get controlsElement(): HTMLElement | null {
    if (this._controlsEl) return this._controlsEl;
    const id = this.getAttribute('controls');
    return id ? document.getElementById(id) : null;
  }

  set controlsElement(el: HTMLElement | null) {
    this._controlsEl = el;
    if (this._connected) this._syncMode();
  }

  /** Whether the panel is in expandable mode — `expandable` without a controlled overlay. */
  private get _isExpandable(): boolean {
    return this.boolAttr('expandable') && !this._controlsEl && !this.hasAttribute('controls');
  }

  override connectedCallback(): void {
    if (this._internalMove) return;
    this._initConnect();
    this._connected = true;
    const origin = this.parentNode;
    this._moveToStack();
    if (origin instanceof Element && origin !== this._stack) recordPortalOrigin(this, origin);

    this.listen(this, 'focusin', this._onFocusIn as EventListener);
    this._syncScrollListener();
    // Upgraded mid-parse (define script loaded synchronously ahead of the
    // markup): wait for the children — and a `controls` target authored
    // after this element — before wrapping/wiring them.
    if (document.readyState === 'loading') this._afterParse(() => this._setUp());
    else this._setUp();
  }

  private _setUp(): void {
    if (!this._connected) return;
    this._syncMode();
    this._syncDismissButton();
    this._syncRole();
  }

  override disconnectedCallback(): void {
    if (this._internalMove) return;
    this._cancelDismissWait?.();
    this._cancelDismissWait = null;
    this._collapseNow({ restoreFocus: false });
    this._unbindControls();
    this._stopScrollListener();
    forgetPortalOrigin(this);
    this._removeStackIfEmpty();
    this._stack = null;
    super.disconnectedCallback();
  }

  /** Never re-renders (that would wipe the consumer's content) — each attribute updates its own piece. */
  override attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this._connected) return;
    switch (name) {
      case 'position':
        this._moveToStack();
        break;
      case 'controls':
      case 'expandable':
        this._syncMode();
        this._syncRole();
        break;
      case 'expanded':
        if (this.expanded) this._expandNow();
        else this._collapseNow({ restoreFocus: true });
        break;
      case 'label':
      case 'panel-label':
        this._labelLauncherAndPanel();
        this._syncRole();
        break;
      case 'announce':
        this._syncRole();
        break;
      case 'close-label':
      case 'dismiss-label':
        this.onStringsChange();
        break;
      case 'dismissible':
        this._syncDismissButton();
        break;
      case 'trap-focus':
        break; // read on the next expand
      case 'hide-on-scroll':
        this._syncScrollListener();
        break;
    }
  }

  protected override onStringsChange(): void {
    this._panelClose?.setAttribute('aria-label', this.stringAttr('close-label', getString('closeDialog')));
    this._dismissButton?.setAttribute('aria-label', this.stringAttr('dismiss-label', getString('dismiss')));
  }

  /** Expands the panel (expandable mode) — identical to `element.expanded = true`. */
  expand(): void {
    this.expanded = true;
  }

  /** Collapses the panel — identical to `element.expanded = false`. */
  collapse(): void {
    this.expanded = false;
  }

  toggle(): void {
    this.expanded = !this.expanded;
  }

  /** Shows the element again after `dismiss()` — identical to `element.hidden = false`. */
  show(): void {
    this._cancelDismissWait?.();
    this._cancelDismissWait = null;
    this.classList.remove('a11y-is-dismissing');
    this.hidden = false;
  }

  /**
   * Animates the element out and sets `hidden`. Fires a cancelable
   * `a11y-floating-dismiss` event first; `preventDefault()` keeps it shown.
   */
  dismiss(): void {
    if (this.hidden || this._cancelDismissWait) return;
    const proceed = this.dispatchEvent(new CustomEvent('a11y-floating-dismiss', { bubbles: true, cancelable: true }));
    if (!proceed) return;

    this.collapse();
    const hadFocus = this.contains(document.activeElement);
    this.classList.add('a11y-is-dismissing');
    this._cancelDismissWait = whenTransitionDone(this, () => {
      this._cancelDismissWait = null;
      this.classList.remove('a11y-is-dismissing');
      this.hidden = true;
      if (hadFocus) this._returnFocusFromDismiss();
      this.onClose?.();
    });
  }

  /** Unused — the consumer's content is kept as is, never generated from a template. */
  protected override render(): string {
    return '';
  }

  // --- placement & stacking ---

  private _moveSelfTo(newParent: Node): void {
    this._internalMove = true;
    try {
      newParent.appendChild(this);
    } finally {
      this._internalMove = false;
    }
  }

  private _moveToStack(): void {
    const position = this.position;
    if (this._stack?.dataset.position === position && this.parentNode === this._stack) return;
    const previous = this._stack;
    let stack = Array.from(document.body.children).find(
      (el): el is HTMLElement => el.classList.contains('a11y-floating-stack') && (el as HTMLElement).dataset.position === position,
    );
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'a11y-floating-stack';
      stack.dataset.position = position;
      document.body.appendChild(stack);
    }
    this._stack = stack;
    this._moveSelfTo(stack);
    if (previous && previous !== stack && previous.childElementCount === 0) previous.remove();
  }

  private _removeStackIfEmpty(): void {
    if (this._stack && this._stack.childElementCount === 0) this._stack.remove();
  }

  private _afterParse(callback: () => void): void {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
  }

  // --- host role ---

  /**
   * `announce` → a polite `role="status"` live region; else, with `label`
   * and outside expandable mode, a named `role="region"` landmark. A `role`
   * the consumer authored is left alone.
   */
  private _syncRole(): void {
    if (this.hasAttribute('role') && !this._ownsRole) return;
    const label = this.stringAttr('label');
    let role: string | null = null;
    if (this.boolAttr('announce')) role = 'status';
    else if (label && !this._isExpandable) role = 'region';

    if (role) {
      this.setAttribute('role', role);
      if (label) this.setAttribute('aria-label', label);
      else this.removeAttribute('aria-label');
      this._ownsRole = true;
    } else if (this._ownsRole) {
      this.removeAttribute('role');
      this.removeAttribute('aria-label');
      this._ownsRole = false;
    }
  }

  // --- mode switching ---

  private _syncMode(): void {
    if (this._isExpandable) {
      this._unbindControls();
      this._buildPanel();
    } else {
      this._teardownPanel();
      this._syncControls();
    }
  }

  // --- controls mode ---

  private _syncControls(): void {
    const target = this.controlsElement as ControllableOverlay | null;
    const trigger =
      this.querySelector<HTMLElement>(TRIGGER_SELECTOR) ??
      this.querySelector<HTMLElement>('button:not(.a11y-floating-dismiss), [role="button"]');
    if (target === this._target && trigger === this._trigger) return;
    this._unbindControls();
    if (!target || !trigger) return;

    this._target = target;
    this._trigger = trigger;

    const tag = target.tagName.toLowerCase();
    // An anchored target without an anchor is anchored to the trigger, so it
    // has a position and its outside-click check ignores the trigger.
    if ('anchorElement' in target && !target.anchorElement) {
      target.anchorElement = trigger;
      this._anchoredTarget = true;
    }
    // A dropdown wires its own anchor as a toggling trigger — don't toggle twice.
    if (tag === 'a11y-dropdown' && target.anchorElement === trigger) return;

    if (!target.id) target.id = `a11y-floating-target-${++idCounter}`;
    trigger.setAttribute('aria-controls', target.id);
    const haspopup = HASPOPUP[tag] ?? (tag === 'a11y-popover' && target.hasAttribute('interactive') ? 'dialog' : null);
    if (haspopup) trigger.setAttribute('aria-haspopup', haspopup);
    this._syncTriggerExpanded();
    trigger.addEventListener('click', this._onTriggerClick);

    this._targetObserver = new MutationObserver(() => this._syncTriggerExpanded());
    this._targetObserver.observe(target, { attributes: true, attributeFilter: ['open'] });
  }

  private _syncTriggerExpanded(): void {
    if (this._trigger && this._target) this._trigger.setAttribute('aria-expanded', String(this._target.hasAttribute('open')));
  }

  private _unbindControls(): void {
    this._targetObserver?.disconnect();
    this._targetObserver = null;
    const trigger = this._trigger;
    if (trigger) {
      trigger.removeEventListener('click', this._onTriggerClick);
      trigger.removeAttribute('aria-controls');
      trigger.removeAttribute('aria-haspopup');
      trigger.removeAttribute('aria-expanded');
    }
    if (this._anchoredTarget && this._target) this._target.anchorElement = null;
    this._anchoredTarget = false;
    this._target = null;
    this._trigger = null;
  }

  // --- expandable mode ---

  private _buildPanel(): void {
    if (this._panel) return;

    const existing = this.querySelector<HTMLElement>(`:scope > ${TRIGGER_SELECTOR}`);
    const launcher = existing ?? document.createElement('button');
    if (!existing) {
      (launcher as HTMLButtonElement).type = 'button';
      launcher.className = 'a11y-floating-launcher';
      this._generatedLauncher = true;
    }

    const panel = document.createElement('div');
    panel.className = 'a11y-floating-panel';
    panel.id = `a11y-floating-panel-${++idCounter}`;
    panel.setAttribute('role', 'dialog');
    panel.hidden = true;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'a11y-floating-panel-close';
    close.textContent = '×';
    close.addEventListener('click', () => this.collapse());
    panel.appendChild(close);

    for (const node of Array.from(this.childNodes)) {
      if (node !== launcher && node !== this._dismissButton) panel.appendChild(node);
    }
    this.prepend(launcher, panel);

    launcher.setAttribute('aria-controls', panel.id);
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.addEventListener('click', this._onLauncherClick);

    this._launcher = launcher;
    this._panel = panel;
    this._panelClose = close;
    this._labelLauncherAndPanel();
    this.onStringsChange();
    if (this.expanded) this._expandNow();
  }

  private _teardownPanel(): void {
    const panel = this._panel;
    const launcher = this._launcher;
    if (!panel || !launcher) return;
    this._collapseNow({ restoreFocus: false });
    this._cancelPanelHide?.();
    this._cancelPanelHide = null;

    launcher.removeEventListener('click', this._onLauncherClick);
    if (this._generatedLauncher) launcher.remove();
    else {
      launcher.removeAttribute('aria-controls');
      launcher.removeAttribute('aria-haspopup');
      launcher.removeAttribute('aria-expanded');
    }
    this._panelClose?.remove();
    panel.replaceWith(...Array.from(panel.childNodes));

    this._launcher = null;
    this._generatedLauncher = false;
    this._panel = null;
    this._panelClose = null;
  }

  /**
   * Generated launcher text: `label`, else the panel heading's text. Panel
   * name: `panel-label`, else its first heading, else `label`.
   */
  private _labelLauncherAndPanel(): void {
    const panel = this._panel;
    if (!panel) return;
    const label = this.stringAttr('label');
    const heading = panel.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');

    if (this._generatedLauncher && this._launcher) {
      this._launcher.textContent = label || heading?.textContent?.trim() || '';
    }

    const panelLabel = this.stringAttr('panel-label');
    panel.removeAttribute('aria-label');
    panel.removeAttribute('aria-labelledby');
    if (panelLabel) panel.setAttribute('aria-label', panelLabel);
    else if (heading) {
      if (!heading.id) heading.id = `a11y-floating-title-${++idCounter}`;
      panel.setAttribute('aria-labelledby', heading.id);
    } else if (label) panel.setAttribute('aria-label', label);
  }

  private _expandNow(): void {
    const panel = this._panel;
    if (!panel || this._isExpanded) return;
    this._isExpanded = true;
    this._cancelPanelHide?.();
    this._cancelPanelHide = null;

    this.classList.remove('a11y-floating--scrolled-away');
    panel.hidden = false;
    requestAnimationFrame(() => {
      if (this._isExpanded) panel.classList.add('a11y-is-open');
    });
    this._launcher?.setAttribute('aria-expanded', 'true');

    if (this.boolAttr('trap-focus')) {
      this._focusTrap = new FocusTrapHelper({
        container: panel,
        options: { onDeactivate: () => this.collapse(), returnFocusOnDeactivate: false },
      });
      this._focusTrap.activate();
    } else {
      document.addEventListener('keydown', this._onKeyDown);
    }
    this._focusPanel();

    // Deferred so the click that expanded the panel doesn't collapse it.
    this._outsideClickTimer = setTimeout(() => {
      this._outsideClickTimer = null;
      document.addEventListener('click', this._onOutsideClick);
    }, 0);

    registerOpenOverlay(this._registryHandle);
    emitOverlayOpen('a11y-floating');
    this.emit('a11y-floating-expand');
  }

  private _collapseNow({ restoreFocus }: { restoreFocus: boolean }): void {
    const panel = this._panel;
    if (!panel || !this._isExpanded) return;
    this._isExpanded = false;
    if (this.expanded) this.setBoolAttr('expanded', false); // collapsed from outside the attribute (disconnect, mode switch)

    const hadFocus = panel.contains(document.activeElement);
    this._focusTrap?.deactivate();
    this._focusTrap = null;
    document.removeEventListener('keydown', this._onKeyDown);
    if (this._outsideClickTimer) clearTimeout(this._outsideClickTimer);
    this._outsideClickTimer = null;
    document.removeEventListener('click', this._onOutsideClick);

    this._launcher?.setAttribute('aria-expanded', 'false');
    if (restoreFocus && hadFocus) this._launcher?.focus();

    panel.classList.remove('a11y-is-open');
    this._cancelPanelHide = whenTransitionDone(panel, () => {
      this._cancelPanelHide = null;
      panel.hidden = true;
    });

    unregisterOpenOverlay(this._registryHandle);
    emitOverlayClose('a11y-floating');
    this.emit('a11y-floating-collapse');
    this.onClose?.();
  }

  /** First focusable content in the panel (its × last resort), else the panel itself. */
  private _focusPanel(): void {
    const panel = this._panel!;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'),
    );
    const target = focusable.find((el) => el !== this._panelClose) ?? this._panelClose;
    if (target) {
      target.focus();
      return;
    }
    panel.setAttribute('tabindex', '-1');
    panel.focus();
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    const active = document.activeElement;
    if (active && active !== document.body && !this.contains(active)) return; // Escape meant for something else
    this.collapse();
  };

  private _onOutsideClick = (e: MouseEvent): void => {
    if (!this.contains(e.target as Node)) this.collapse();
  };

  // --- dismiss ---

  private _syncDismissButton(): void {
    const wanted = this.boolAttr('dismissible');
    if (wanted && !this._dismissButton) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'a11y-floating-dismiss';
      btn.textContent = '×';
      btn.addEventListener('click', () => this.dismiss());
      this.appendChild(btn);
      this._dismissButton = btn;
      this.onStringsChange();
    } else if (!wanted && this._dismissButton) {
      this._dismissButton.remove();
      this._dismissButton = null;
    }
  }

  /** Back to where focus was before it entered this element — or nowhere, rather than onto something hidden. */
  private _returnFocusFromDismiss(): void {
    const origin = this._focusOrigin;
    this._focusOrigin = null;
    if (origin?.isConnected) origin.focus();
    else (document.activeElement as HTMLElement | null)?.blur?.();
  }

  private _onFocusIn = (e: FocusEvent): void => {
    // Focus must never land on something scrolled out of view (WCAG 2.4.11).
    this.classList.remove('a11y-floating--scrolled-away');
    const from = e.relatedTarget as HTMLElement | null;
    if (from && !this.contains(from)) this._focusOrigin = from;
  };

  // --- hide on scroll ---

  private _syncScrollListener(): void {
    if (this.boolAttr('hide-on-scroll')) {
      if (this._scrollListening) return;
      this._lastScrollY = window.scrollY;
      window.addEventListener('scroll', this._onScroll, { passive: true });
      this._scrollListening = true;
    } else {
      this._stopScrollListener();
    }
  }

  private _stopScrollListener(): void {
    if (!this._scrollListening) return;
    window.removeEventListener('scroll', this._onScroll);
    this._scrollListening = false;
    this.classList.remove('a11y-floating--scrolled-away');
  }

  private _onScroll = (): void => {
    const y = window.scrollY;
    const delta = y - this._lastScrollY;
    if (Math.abs(delta) < this.numberAttr('scroll-threshold', DEFAULT_SCROLL_THRESHOLD)) return;
    this._lastScrollY = y;
    const away = delta > 0 && y > 0 && !this._isExpanded && !this.contains(document.activeElement);
    this.classList.toggle('a11y-floating--scrolled-away', away);
  };
}
