// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/shop', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

import { LanguageSwitcher, type LanguageSwitcherProps } from '../components/language-switcher';
import { StorefrontProvider } from '../provider';
import type { StoreLocaleInput } from '../utils/locale-switch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (locale: string, name: string, native: string, extra: Partial<StoreLocaleInput> = {}): StoreLocaleInput => ({
  locale,
  name,
  native_name: native,
  is_primary: locale === 'en',
  is_default: locale === 'en',
  path_prefix: locale === 'en' ? '' : locale.toLowerCase(),
  hreflang: locale,
  html_lang: locale,
  dir: 'ltr',
  ...extra,
});

const LOCALES: StoreLocaleInput[] = [
  row('en', 'English', 'English'),
  row('fr', 'French', 'Français'),
  row('de', 'German', 'Deutsch'),
  row('ar', 'Arabic', 'العربية', { dir: 'rtl' }),
];

const TWENTY: StoreLocaleInput[] = [
  row('en', 'English', 'English'),
  ...Array.from({ length: 19 }, (_, i) => row(`x${String.fromCharCode(97 + i)}`, `Lang ${i}`, `Lang ${i}`)),
];

function Provider({ locales = LOCALES, locale = null, children }: { locales?: StoreLocaleInput[]; locale?: string | null; children: ReactNode }) {
  return (
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never}
      config={{} as never}
      menus={[]}
      basePath={locale && locale !== 'en' ? `/${locale}` : ''}
      locale={locale}
      locales={locales}
    >
      {children}
    </StorefrontProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

function mount(props: LanguageSwitcherProps = {}, options: { locales?: StoreLocaleInput[]; locale?: string | null } = {}): void {
  act(() => {
    root.render(
      <Provider {...options}>
        <button id="before">before</button>
        <LanguageSwitcher variant="menu" {...props} />
        <button id="after">after</button>
      </Provider>,
    );
  });
}

const q = <T extends Element = HTMLElement>(sel: string) => container.querySelector(sel) as T;
const trigger = () => q<HTMLButtonElement>('[data-part="trigger"]');
const popover = () => q<HTMLElement>('[data-part="popover"]');
const links = () => [...container.querySelectorAll<HTMLAnchorElement>('[data-part="option"]')];
const rootEl = () => q('[data-qn-language-switcher]');

function key(target: Element, k: string, init: KeyboardEventInit = {}): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  });
}
function click(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}
function openMenu(): void {
  click(trigger());
}

/** matchMedia mock: `sheet` toggles whether the narrow-screen query matches. */
function mockMatchMedia(initialSheet: boolean) {
  const listeners = new Set<() => void>();
  const state = { sheet: initialSheet };
  window.matchMedia = ((query: string) => ({
    media: query,
    get matches() {
      return query.includes('max-width') ? state.sheet : false;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  })) as never;
  return {
    set(sheet: boolean) {
      state.sheet = sheet;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
}

beforeEach(() => {
  nav.pathname = '/shop';
  nav.push.mockClear();
  window.history.replaceState(null, '', '/shop');
  delete (window as { matchMedia?: unknown }).matchMedia;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  document.body.className = '';
});

describe('menu: markup and aria', () => {
  it('renders a disclosure button and a closed list of real links', () => {
    mount();
    expect(trigger().tagName).toBe('BUTTON');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger().getAttribute('aria-label')).toBe('Language: English');
    expect(trigger().getAttribute('aria-controls')).toBe(popover().id);
    expect(popover().hidden).toBe(true);
    expect(rootEl().getAttribute('data-state')).toBe('closed');
    expect(links().map((a) => a.getAttribute('href'))).toEqual(['/shop', '/fr/shop', '/de/shop', '/ar/shop']);
    expect(links().map((a) => a.getAttribute('lang'))).toEqual(['en', 'fr', 'de', 'ar']);
  });

  it('uses link semantics, not listbox semantics, and marks exactly one link current', () => {
    mount({}, { locale: 'fr' });
    openMenu();
    expect(container.querySelector('[role="listbox"], [role="option"], [aria-selected]')).toBeNull();
    expect(
      links()
        .filter((a) => a.getAttribute('aria-current') === 'true')
        .map((a) => a.querySelector('[data-part="name"]')!.textContent),
    ).toEqual(['Français']);
    const list = q('[data-part="list"]');
    expect(list.tagName).toBe('UL');
    expect(list.getAttribute('aria-labelledby')).toBe(q('[data-part="title"]').id);
    expect(q('[data-part="title"]').textContent).toBe('Language');
    expect(trigger().getAttribute('aria-label')).toBe('Language: Français');
  });

  it('renders every documented part', () => {
    mount();
    for (const part of ['trigger', 'trigger-label', 'trigger-code', 'chevron', 'scrim', 'popover', 'handle', 'title', 'list', 'item', 'option', 'name', 'code', 'mark']) {
      expect(container.querySelector(`[data-part="${part}"]`), part).not.toBeNull();
    }
  });

  it('exposes state and placement as data attributes', () => {
    mount({ side: 'top', align: 'start', showCode: true });
    expect(rootEl().getAttribute('data-side')).toBe('top');
    expect(rootEl().getAttribute('data-align')).toBe('start');
    expect(rootEl().getAttribute('data-show-code')).toBe('true');
    expect(rootEl().getAttribute('data-count')).toBe('4');
    expect(rootEl().hasAttribute('data-many')).toBe(false);
    expect(rootEl().hasAttribute('data-mode')).toBe(false);
    expect(rootEl().className).toBe('qn-lang qn-lang--menu');
  });

  it('honours className, showNativeName and showCode', () => {
    mount({ className: 'in-header', showNativeName: false });
    expect(rootEl().className).toBe('qn-lang qn-lang--menu in-header');
    expect(links().map((a) => a.querySelector('[data-part="name"]')!.textContent)).toEqual(['English', 'French', 'German', 'Arabic']);
    expect(q('[data-part="trigger-label"]').textContent).toBe('English');
    expect(q('[data-part="trigger-code"]').textContent).toBe('EN');
    expect(links()[1]!.querySelector('[data-part="code"]')!.textContent).toBe('FR');
  });

  it('marks right-to-left names with their direction', () => {
    mount();
    const ar = links()[3]!.querySelector('bdi')!;
    expect(ar.getAttribute('dir')).toBe('rtl');
    expect(ar.getAttribute('lang')).toBe('ar');
    expect(links()[0]!.querySelector('bdi')!.hasAttribute('dir')).toBe(false);
  });

  it('renders nothing for one language, and on the server too', () => {
    mount({}, { locales: [LOCALES[0]!] });
    expect(container.querySelector('[data-qn-language-switcher], [data-part]')).toBeNull();
    const html = renderToStaticMarkup(
      <Provider locales={[LOCALES[0]!]}>
        <LanguageSwitcher variant="menu" />
      </Provider>,
    );
    expect(html).not.toContain('qn-lang');
  });

  it('server markup: closed, hidden popover, links with hrefs, no query string', () => {
    window.history.replaceState(null, '', '/shop?sort=new');
    const html = renderToStaticMarkup(
      <Provider>
        <LanguageSwitcher variant="menu" />
      </Provider>,
    );
    expect(html).toContain('data-state="closed"');
    expect(html).toMatch(/data-part="popover"[^>]*hidden/);
    expect(html).toContain('href="/fr/shop"');
    expect(html).not.toContain('sort=new');
    expect(html).not.toContain('data-mode');
    expect(html).toContain('aria-expanded="false"');
  });

  it('has no focusable control in an aria-hidden subtree, open or closed', () => {
    const offenders = () =>
      [...container.querySelectorAll('[aria-hidden="true"]')].flatMap((el) =>
        [...el.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')].concat(
          el.matches('a[href], button, input, select, textarea, [tabindex]') ? [el] : [],
        ),
      );
    mount();
    expect(offenders()).toEqual([]);
    openMenu();
    expect(offenders()).toEqual([]);
  });

  it('works with 20 languages: every link, many-flag, scrollable list', () => {
    mount({}, { locales: TWENTY });
    expect(links()).toHaveLength(20);
    expect(rootEl().getAttribute('data-many')).toBe('true');
    expect(rootEl().getAttribute('data-count')).toBe('20');
    openMenu();
    key(links()[0]!, 'End');
    expect(document.activeElement).toBe(links()[19]);
  });
});

describe('menu: opening, closing and focus', () => {
  it('opens on click, focuses the current link, closes on a second click', () => {
    mount({}, { locale: 'de' });
    openMenu();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(rootEl().getAttribute('data-state')).toBe('open');
    expect(popover().hidden).toBe(false);
    expect(document.activeElement).toBe(links()[2]);
    click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(popover().hidden).toBe(true);
  });

  it('ArrowDown and ArrowUp on the trigger open at the current and last link', () => {
    mount();
    key(trigger(), 'ArrowDown');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(links()[0]);
    key(links()[0]!, 'Escape');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    key(trigger(), 'ArrowUp');
    expect(document.activeElement).toBe(links()[3]);
  });

  it('Enter and Space on the trigger open it (native button click)', () => {
    mount();
    // A <button> turns Enter/Space into a click; jsdom does not, so dispatch the click.
    click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('arrow keys move between links and wrap; Home and End jump', () => {
    mount();
    openMenu();
    key(links()[0]!, 'ArrowDown');
    expect(document.activeElement).toBe(links()[1]);
    key(links()[1]!, 'ArrowDown');
    key(links()[2]!, 'ArrowDown');
    expect(document.activeElement).toBe(links()[3]);
    key(links()[3]!, 'ArrowDown');
    expect(document.activeElement).toBe(links()[0]);
    key(links()[0]!, 'ArrowUp');
    expect(document.activeElement).toBe(links()[3]);
    key(links()[3]!, 'Home');
    expect(document.activeElement).toBe(links()[0]);
    key(links()[0]!, 'End');
    expect(document.activeElement).toBe(links()[3]);
  });

  it('uses a roving tabindex: only the focused link is in the tab order', () => {
    mount();
    openMenu();
    expect(links().map((a) => a.tabIndex)).toEqual([0, -1, -1, -1]);
    key(links()[0]!, 'ArrowDown');
    expect(links().map((a) => a.tabIndex)).toEqual([-1, 0, -1, -1]);
  });

  it('typeahead matches names and codes and resets after 500ms', () => {
    vi.useFakeTimers();
    mount();
    openMenu();
    key(links()[0]!, 'd');
    expect(document.activeElement).toBe(links()[2]); // Deutsch
    key(links()[2]!, 'x'); // "dx": no match, stays
    expect(document.activeElement).toBe(links()[2]);
    act(() => vi.advanceTimersByTime(600));
    key(links()[2]!, 'f');
    expect(document.activeElement).toBe(links()[1]); // Français
    act(() => vi.advanceTimersByTime(600));
    key(links()[1]!, 'a');
    key(links()[0]!, 'r');
    expect(document.activeElement).toBe(links()[3]); // "ar": the Arabic name/code
  });

  it('Escape closes from a link or the trigger and returns focus to the trigger', () => {
    mount();
    openMenu();
    key(links()[0]!, 'Escape');
    expect(popover().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
    openMenu();
    act(() => trigger().focus());
    key(trigger(), 'Escape');
    expect(popover().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it('Tab closes the menu without stealing focus', () => {
    mount();
    openMenu();
    key(links()[0]!, 'Tab');
    expect(popover().hidden).toBe(true);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('an outside pointerdown closes; one inside does not; focus is left where it went', () => {
    mount();
    openMenu();
    act(() => {
      popover().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(popover().hidden).toBe(false);
    const after = q<HTMLButtonElement>('#after');
    act(() => {
      after.focus();
      after.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    });
    expect(popover().hidden).toBe(true);
    expect(document.activeElement).toBe(after);
  });

  it('a scrim tap closes the menu', () => {
    mount();
    openMenu();
    click(q('[data-part="scrim"]'));
    expect(popover().hidden).toBe(true);
    expect(q<HTMLElement>('[data-part="scrim"]').hidden).toBe(true);
  });
});

describe('menu: choosing a language', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/shop?sort=new');
  });

  it('a plain click navigates with the live URL, closes and refocuses the trigger', () => {
    mount();
    openMenu();
    const event = click(links()[1]!);
    expect(event.defaultPrevented).toBe(true);
    expect(nav.push).toHaveBeenCalledWith('/fr/shop?sort=new');
    expect(popover().hidden).toBe(true);
    expect(document.activeElement).toBe(trigger());
  });

  it('Enter follows the focused link (native click) and Space activates it', () => {
    mount();
    openMenu();
    // Enter on a link is a native click.
    click(links()[2]!);
    expect(nav.push).toHaveBeenLastCalledWith('/de/shop?sort=new');
    openMenu();
    key(links()[3]!, ' ');
    expect(nav.push).toHaveBeenLastCalledWith('/ar/shop?sort=new');
    expect(popover().hidden).toBe(true);
  });

  it('choosing the current language just closes', () => {
    mount();
    openMenu();
    click(links()[0]!);
    expect(nav.push).not.toHaveBeenCalled();
    expect(popover().hidden).toBe(true);
  });

  it('modified clicks keep the browser default (new tab, copy link)', () => {
    mount();
    openMenu();
    const swallow = (e: Event) => e.preventDefault(); // jsdom cannot navigate
    document.addEventListener('click', swallow);
    click(links()[1]!, { metaKey: true });
    click(links()[1]!, { ctrlKey: true });
    click(links()[1]!, { button: 1 });
    document.removeEventListener('click', swallow);
    expect(nav.push).not.toHaveBeenCalled();
    expect(popover().hidden).toBe(false);
  });
});

describe('menu: sheet or popover', () => {
  it('is a popover by default: no scroll lock, data-mode=popover', () => {
    mockMatchMedia(false);
    mount();
    openMenu();
    expect(rootEl().getAttribute('data-mode')).toBe('popover');
    expect(document.body.classList.contains('qn-lang-lock')).toBe(false);
  });

  it('is a sheet below the breakpoint: scroll lock while open, released on close', () => {
    mockMatchMedia(true);
    mount();
    openMenu();
    expect(rootEl().getAttribute('data-mode')).toBe('sheet');
    expect(document.body.classList.contains('qn-lang-lock')).toBe(true);
    key(links()[0]!, 'Escape');
    expect(document.body.classList.contains('qn-lang-lock')).toBe(false);
    expect(rootEl().hasAttribute('data-mode')).toBe(false);
  });

  it('closing by selection and by unmounting releases the scroll lock', () => {
    mockMatchMedia(true);
    mount();
    openMenu();
    click(links()[1]!);
    expect(document.body.classList.contains('qn-lang-lock')).toBe(false);
    openMenu();
    expect(document.body.classList.contains('qn-lang-lock')).toBe(true);
    act(() => root.render(<p>gone</p>));
    expect(document.body.classList.contains('qn-lang-lock')).toBe(false);
  });

  it('follows the viewport crossing the breakpoint while open', () => {
    const media = mockMatchMedia(false);
    mount();
    openMenu();
    expect(rootEl().getAttribute('data-mode')).toBe('popover');
    media.set(true);
    expect(rootEl().getAttribute('data-mode')).toBe('sheet');
    expect(document.body.classList.contains('qn-lang-lock')).toBe(true);
    media.set(false);
    expect(document.body.classList.contains('qn-lang-lock')).toBe(false);
  });

  it('the sheet shows the same markup as the popover (layout is CSS only)', () => {
    mockMatchMedia(true);
    mount();
    const closed = container.innerHTML;
    mockMatchMedia(false);
    mount();
    expect(container.innerHTML).toBe(closed);
  });
});

describe('menu: placement', () => {
  function stubRects(trigger: DOMRect, pop: { width: number; height: number }) {
    return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('[data-part="trigger"]')) return trigger;
      if (this.matches('[data-part="popover"]')) {
        return { ...pop, top: 0, left: 0, right: pop.width, bottom: pop.height, x: 0, y: 0, toJSON() {} } as DOMRect;
      }
      return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} } as DOMRect;
    });
  }
  const rect = (left: number, top: number, w = 100, h = 44) =>
    ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON() {} }) as DOMRect;

  afterEach(() => vi.restoreAllMocks());

  it('keeps the preferred side when it fits', () => {
    stubRects(rect(800, 10), { width: 240, height: 200 });
    mount();
    openMenu();
    expect(rootEl().getAttribute('data-side')).toBe('bottom');
    expect(rootEl().getAttribute('data-align')).toBe('end');
    expect(popover().style.getPropertyValue('--qn-lang-shift')).toBe('');
  });

  it('flips up near the bottom of the viewport and caps the height', () => {
    stubRects(rect(800, 700), { width: 240, height: 300 });
    mount();
    openMenu();
    expect(rootEl().getAttribute('data-side')).toBe('top');
    expect(popover().style.getPropertyValue('--qn-lang-avail')).toBe(`${700 - 8 - 8}px`);
  });

  it('a footer menu with side="top" opens up, and flips down with no room above', () => {
    stubRects(rect(800, 700), { width: 240, height: 300 });
    mount({ side: 'top' });
    openMenu();
    expect(rootEl().getAttribute('data-side')).toBe('top');
    key(links()[0]!, 'Escape');
    vi.restoreAllMocks();
    stubRects(rect(800, 10), { width: 240, height: 300 });
    openMenu();
    expect(rootEl().getAttribute('data-side')).toBe('bottom');
  });

  it('flips the alignment when the end edge would leave the viewport', () => {
    stubRects(rect(20, 10), { width: 240, height: 200 });
    mount();
    openMenu();
    expect(rootEl().getAttribute('data-align')).toBe('start');
  });

  it('reads the page direction for right-to-left storefronts', () => {
    document.documentElement.setAttribute('dir', 'rtl');
    try {
      stubRects(rect(20, 10), { width: 240, height: 200 });
      mount();
      openMenu();
      // In rtl `end` is the left edge, so a trigger near the left edge keeps `end`.
      expect(rootEl().getAttribute('data-align')).toBe('end');
    } finally {
      document.documentElement.removeAttribute('dir');
    }
  });
});

describe('menu: render-prop and defaults', () => {
  it('the render-prop receives open and setOpen', () => {
    let seen: { open: boolean; setOpen: (v: boolean) => void } | null = null;
    mount({
      variant: 'select',
      children: (state) => {
        seen = { open: state.open, setOpen: state.setOpen };
        return <p data-testid="custom">{String(state.open)}</p>;
      },
    });
    expect(q('[data-testid="custom"]').textContent).toBe('false');
    act(() => seen!.setOpen(true));
    expect(q('[data-testid="custom"]').textContent).toBe('true');
  });

  it('select stays the default variant, unchanged', () => {
    act(() =>
      root.render(
        <Provider>
          <LanguageSwitcher />
        </Provider>,
      ),
    );
    expect(container.querySelector('select')).not.toBeNull();
    expect(container.querySelector('[data-variant="menu"]')).toBeNull();
  });
});

describe('menu: stylesheet', () => {
  const css = readFileSync(join(__dirname, '..', 'components', 'language-menu.css'), 'utf8');
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('uses logical properties only', () => {
    expect(code).not.toMatch(/(^|[\s{;])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/m);
    expect(code).not.toMatch(/text-align:\s*(left|right)/);
  });

  it('every variable is --qn-* and has a fallback', () => {
    const names = [...code.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!);
    expect(names.filter((n) => !n.startsWith('--qn-'))).toEqual([]);
    expect(code).not.toMatch(/var\(--qn-[a-z0-9-]+\)/);
  });

  it('declares the sheet breakpoint and respects reduced motion', () => {
    expect(code).toContain('@media (max-width: 639.98px)');
    expect(code).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*80ms/);
    expect(code).toMatch(/@media \(prefers-reduced-motion: no-preference\)/);
  });

  it('the sheet breakpoint in CSS and in JS agree', async () => {
    const { LANGUAGE_MENU_SHEET_QUERY } = await import('../components/language-menu');
    expect(code).toContain(`@media ${LANGUAGE_MENU_SHEET_QUERY}`);
  });

  it('documents every part the markup renders', () => {
    mount();
    for (const part of [...container.querySelectorAll('[data-part]')].map((el) => el.getAttribute('data-part')!)) {
      expect(css, part).toContain(`data-part="${part}"`);
    }
  });
});
