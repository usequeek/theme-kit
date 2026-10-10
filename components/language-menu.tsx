'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import type { LocalesState } from '../hooks/use-locales';
import type { StoreLocale } from '../utils/locale-switch';
import { computePlacement, type MenuAlign, type MenuSide } from '../utils/menu-placement';
import './language-menu.css';

/** Below this width the menu is a bottom sheet. The same value is in language-menu.css. */
export const LANGUAGE_MENU_SHEET_QUERY = '(max-width: 639.98px)';

/** More languages than this: the root gets `data-many="true"` (a theme may use two columns). */
const MANY_LANGUAGES = 10;
const TYPEAHEAD_RESET_MS = 500;
const LOCK_CLASS = 'qn-lang-lock';

type Mode = 'popover' | 'sheet';
type Focus = 'selected' | 'last';

export interface LanguageMenuProps {
  state: LocalesState & { open: boolean; setOpen: (open: boolean) => void; label: string };
  rootClass: string;
  showCode: boolean;
  side: MenuSide;
  align: MenuAlign;
  /** The language's name as shown (native or English). */
  nameOf: (locale: StoreLocale) => string;
  /** "Language: <shown name>" — the trigger's accessible name. */
  triggerLabelFor: (locale: StoreLocale) => string;
}

function codeOf(locale: StoreLocale): string {
  return locale.locale.toUpperCase();
}

function isSheetViewport(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(LANGUAGE_MENU_SHEET_QUERY).matches
    : false;
}

function isRtl(element: Element): boolean {
  const attr = element.closest('[dir]')?.getAttribute('dir');
  if (attr === 'rtl' || attr === 'ltr') return attr === 'rtl';
  return getComputedStyle(element).direction === 'rtl';
}

function isPlainPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The `menu` variant of `LanguageSwitcher`: a disclosure button and a list of
 * language links — a popover on wide screens, a bottom sheet on narrow ones.
 * The items navigate, so they are plain links (`aria-current` marks the
 * current one), not listbox options. Arrow keys, Home/End and typeahead move
 * focus between the links; Enter follows the focused link natively.
 *
 * The wide/narrow LAYOUT is CSS only (one media query), so the markup is the
 * same in both and server and client agree. JavaScript asks the media query
 * only while the menu is opening or open: to lock page scroll behind a sheet
 * and to run collision handling for a popover.
 */
export function LanguageMenu({
  state,
  rootClass,
  showCode,
  side,
  align,
  nameOf,
  triggerLabelFor,
}: LanguageMenuProps): JSX.Element {
  const { locales, active, hrefFor, switchTo, open, setOpen, label } = state;
  const uid = useId();
  const popoverId = `${uid}-popover`;
  const titleId = `${uid}-title`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const pendingFocus = useRef<Focus>('selected');
  const typeahead = useRef({ text: '', timer: 0 });

  const [mode, setMode] = useState<Mode>('popover');
  const [placement, setPlacement] = useState<{ side: MenuSide; align: MenuAlign; shift: number; available: number | null }>({
    side,
    align,
    shift: 0,
    available: null,
  });
  const activeIndex = Math.max(0, locales.findIndex((locale) => locale.locale === active.locale));
  const [rovingIndex, setRovingIndex] = useState(activeIndex);

  const placed = open && mode === 'popover' ? placement : { side, align, shift: 0, available: null };

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [setOpen],
  );

  const openMenu = useCallback(
    (focus: Focus) => {
      pendingFocus.current = focus;
      setMode(isSheetViewport() ? 'sheet' : 'popover');
      setRovingIndex(focus === 'last' ? locales.length - 1 : activeIndex);
      setOpen(true);
    },
    [setOpen, locales.length, activeIndex],
  );

  const focusOption = useCallback(
    (index: number) => {
      const count = locales.length;
      if (count === 0) return;
      const next = (index + count) % count;
      setRovingIndex(next);
      optionRefs.current[next]?.focus();
    },
    [locales.length],
  );

  const select = useCallback(
    (locale: StoreLocale) => {
      close(true);
      if (locale.locale !== active.locale) switchTo(locale);
    },
    [close, active.locale, switchTo],
  );

  // Focus moves into the list on open.
  useEffect(() => {
    if (!open) return;
    const index = pendingFocus.current === 'last' ? locales.length - 1 : activeIndex;
    const option = optionRefs.current[index];
    option?.focus();
    option?.scrollIntoView?.({ block: 'nearest' });
    // Only when the menu opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Collision handling for the popover (plain measurements, no portal).
  useLayoutEffect(() => {
    if (!open || mode !== 'popover') return;
    const root = rootRef.current;
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!root || !trigger || !popover) return;

    const run = () => {
      const t = trigger.getBoundingClientRect();
      const p = popover.getBoundingClientRect();
      const next = computePlacement({
        trigger: { top: t.top, right: t.right, bottom: t.bottom, left: t.left },
        popover: { width: p.width, height: p.height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        side,
        align,
        dir: isRtl(root) ? 'rtl' : 'ltr',
      });
      setPlacement((prev) =>
        prev.side === next.side && prev.align === next.align && prev.shift === next.shift && prev.available === next.available
          ? prev
          : next,
      );
    };
    run();
    window.addEventListener('resize', run);
    return () => window.removeEventListener('resize', run);
  }, [open, mode, side, align, locales.length]);

  // Follow the viewport crossing the breakpoint while open.
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(LANGUAGE_MENU_SHEET_QUERY);
    const onChange = () => setMode(query.matches ? 'sheet' : 'popover');
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, [open]);

  // A sheet locks page scroll behind it.
  useEffect(() => {
    if (!open || mode !== 'sheet') return;
    document.body.classList.add(LOCK_CLASS);
    return () => document.body.classList.remove(LOCK_CLASS);
  }, [open, mode]);

  // Outside tap or click closes without taking focus.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) close(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const focus: Focus = event.key === 'ArrowUp' ? 'last' : 'selected';
    if (!open) return openMenu(focus);
    focusOption(focus === 'last' ? locales.length - 1 : activeIndex);
  };

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      return close(true);
    }
    if (event.key === 'Tab') return close(false);

    const target = event.target instanceof Element ? event.target.closest('a') : null;
    const index = target ? optionRefs.current.indexOf(target as HTMLAnchorElement) : -1;
    if (index < 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        return focusOption(index + 1);
      case 'ArrowUp':
        event.preventDefault();
        return focusOption(index - 1);
      case 'Home':
        event.preventDefault();
        return focusOption(0);
      case 'End':
        event.preventDefault();
        return focusOption(locales.length - 1);
      case ' ':
        event.preventDefault();
        return select(locales[index]!);
      default:
        break;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const buffer = typeahead.current;
      buffer.text += event.key.toLocaleLowerCase();
      window.clearTimeout(buffer.timer);
      buffer.timer = window.setTimeout(() => {
        buffer.text = '';
      }, TYPEAHEAD_RESET_MS);
      const found = locales.findIndex(
        (locale) =>
          nameOf(locale).toLocaleLowerCase().startsWith(buffer.text) ||
          locale.name.toLocaleLowerCase().startsWith(buffer.text) ||
          locale.locale.toLocaleLowerCase().startsWith(buffer.text),
      );
      if (found >= 0) focusOption(found);
    }
  };

  const dataState = open ? 'open' : 'closed';
  const popoverStyle: Record<string, string> = {};
  if (placed.shift) popoverStyle['--qn-lang-shift'] = `${placed.shift}px`;
  if (placed.available !== null) popoverStyle['--qn-lang-avail'] = `${placed.available}px`;

  return (
    <div
      ref={rootRef}
      className={rootClass}
      data-qn-language-switcher=""
      data-variant="menu"
      data-state={dataState}
      data-side={placed.side}
      data-align={placed.align}
      data-mode={open ? mode : undefined}
      data-count={locales.length}
      data-many={locales.length > MANY_LANGUAGES ? 'true' : undefined}
      data-show-code={showCode ? 'true' : undefined}
      onKeyDown={onRootKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className="qn-lang__trigger"
        data-part="trigger"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={triggerLabelFor(active)}
        onClick={() => (open ? close(false) : openMenu('selected'))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="qn-lang__trigger-label" data-part="trigger-label">
          {nameOf(active)}
        </span>
        <span className="qn-lang__trigger-code" data-part="trigger-code">
          {codeOf(active)}
        </span>
        <svg className="qn-lang__chevron" data-part="chevron" aria-hidden="true" viewBox="0 0 10 10" focusable="false">
          <path d="M1 3.5 5 7.5 9 3.5" />
        </svg>
      </button>
      <div className="qn-lang__scrim" data-part="scrim" aria-hidden="true" hidden={!open} onClick={() => close(false)} />
      <div
        ref={popoverRef}
        id={popoverId}
        className="qn-lang__popover"
        data-part="popover"
        data-state={dataState}
        hidden={!open}
        style={popoverStyle}
      >
        <div className="qn-lang__handle" data-part="handle" aria-hidden="true" />
        <div id={titleId} className="qn-lang__title" data-part="title">
          {label}
        </div>
        <ul className="qn-lang__options" data-part="list" aria-labelledby={titleId}>
          {locales.map((locale, index) => {
            const current = locale.locale === active.locale;
            return (
              <li key={locale.locale} className="qn-lang__item" data-part="item">
                <a
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  className="qn-lang__option"
                  data-part="option"
                  data-current={current ? 'true' : undefined}
                  href={hrefFor(locale)}
                  lang={locale.html_lang}
                  hrefLang={locale.hreflang}
                  aria-current={current ? 'true' : undefined}
                  tabIndex={index === rovingIndex ? 0 : -1}
                  onFocus={() => setRovingIndex(index)}
                  onClick={(event) => {
                    // Modified clicks keep the browser default (new tab, copy link).
                    if (event.defaultPrevented || !isPlainPrimaryClick(event)) return;
                    event.preventDefault();
                    select(locale);
                  }}
                >
                  <span className="qn-lang__name" data-part="name">
                    <bdi lang={locale.html_lang} dir={locale.dir === 'rtl' ? 'rtl' : undefined}>
                      {nameOf(locale)}
                    </bdi>
                  </span>
                  <span className="qn-lang__code" data-part="code">
                    {codeOf(locale)}
                  </span>
                  <span className="qn-lang__mark" data-part="mark" aria-hidden="true">
                    <svg viewBox="0 0 16 16" focusable="false">
                      <path d="m3 8.5 3.2 3.2L13 5" />
                    </svg>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
