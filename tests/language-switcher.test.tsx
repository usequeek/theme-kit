// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/', push: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

import { LanguageSwitcher } from '../components/language-switcher';
import { useLocales, type LocalesState } from '../hooks/use-locales';
import { StorefrontContext, StorefrontProvider } from '../provider';
import type { ThemeManifest } from '../types/theme';
import type { StoreLocaleInput } from '../utils/locale-switch';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LOCALES: StoreLocaleInput[] = [
  { locale: 'en', name: 'English', native_name: 'English', is_primary: true, is_default: true, path_prefix: '', hreflang: 'en', html_lang: 'en', dir: 'ltr' },
  { locale: 'fr', name: 'French', native_name: 'Français', is_primary: false, is_default: false, path_prefix: 'fr', hreflang: 'fr', html_lang: 'fr', dir: 'ltr' },
  { locale: 'ar', name: 'Arabic', native_name: 'العربية', is_primary: false, is_default: false, path_prefix: 'ar', hreflang: 'ar', html_lang: 'ar', dir: 'rtl' },
];

interface ProviderOptions {
  locales?: StoreLocaleInput[] | null;
  locale?: string | null;
  basePath?: string;
  strings?: Record<string, unknown> | null;
}

function Provider({ options = {}, children }: { options?: ProviderOptions; children: ReactNode }) {
  return (
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never}
      config={{} as never}
      menus={[]}
      basePath={options.basePath ?? ''}
      locale={options.locale ?? null}
      {...(options.locales !== undefined ? { locales: options.locales } : {})}
      {...(options.strings ? { strings: options.strings as never } : {})}
    >
      {children}
    </StorefrontProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

function mount(node: ReactNode, options?: ProviderOptions): void {
  act(() => {
    root.render(<Provider options={options}>{node}</Provider>);
  });
}

beforeEach(() => {
  nav.pathname = '/shop';
  nav.push.mockClear();
  window.history.replaceState(null, '', '/shop');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useLocales', () => {
  function capture(options?: ProviderOptions): { current: LocalesState } {
    const ref = {} as { current: LocalesState };
    function Probe() {
      ref.current = useLocales();
      return null;
    }
    mount(<Probe />, options);
    return ref;
  }

  it('reports a single-language state when no locales are passed', () => {
    const state = capture();
    expect(state.current.hasMultiple).toBe(false);
    expect(state.current.locales).toEqual([]);
    expect(state.current.active.locale).toBe('en');
    expect(state.current.defaultLocale.path_prefix).toBe('');
  });

  it('reports a single-language state for one locale', () => {
    const state = capture({ locales: [LOCALES[0]!] });
    expect(state.current.hasMultiple).toBe(false);
    expect(state.current.locales).toHaveLength(1);
  });

  it('does not throw outside a provider', () => {
    const ref = {} as { current: LocalesState };
    function Probe() {
      ref.current = useLocales();
      return null;
    }
    act(() => root.render(<Probe />));
    expect(ref.current.hasMultiple).toBe(false);
  });

  it('exposes locales, default and the active language from the request locale', () => {
    const state = capture({ locales: LOCALES, locale: 'fr', basePath: '/fr' });
    expect(state.current.hasMultiple).toBe(true);
    expect(state.current.locales.map((l) => l.locale)).toEqual(['en', 'fr', 'ar']);
    expect(state.current.defaultLocale.locale).toBe('en');
    expect(state.current.active.locale).toBe('fr');
  });

  it('builds hrefFor from the pathname and picks up the query and hash after mount', () => {
    nav.pathname = '/fr/shop';
    window.history.replaceState(null, '', '/fr/shop?sort=new#top');
    const state = capture({ locales: LOCALES, locale: 'fr', basePath: '/fr' });
    expect(state.current.hrefFor('en')).toBe('/shop?sort=new#top');
    expect(state.current.hrefFor('ar')).toBe('/ar/shop?sort=new#top');
    expect(state.current.hrefFor(state.current.locales[1]!)).toBe('/fr/shop?sort=new#top');
    // Unknown code: stays on the current page.
    expect(state.current.hrefFor('xx')).toBe('/fr/shop?sort=new#top');
  });

  it('switchTo pushes the live URL and ignores the active or an unknown language', () => {
    const state = capture({ locales: LOCALES });
    act(() => window.history.replaceState(null, '', '/shop?page=3'));
    act(() => state.current.switchTo('fr'));
    expect(nav.push).toHaveBeenCalledWith('/fr/shop?page=3');
    nav.push.mockClear();
    act(() => state.current.switchTo('en'));
    act(() => state.current.switchTo('xx'));
    expect(nav.push).not.toHaveBeenCalled();
  });
});

describe('LanguageSwitcher', () => {
  /** What the switcher put on the page: the provider's brand wrapper stays, its content must be empty. */
  const rendered = () => (container.querySelector('[data-brand-root]') ?? container).innerHTML;
  const selectOf = () => container.querySelector('select') as HTMLSelectElement;

  it('renders nothing with one language, none, or outside a storefront', () => {
    mount(<LanguageSwitcher />);
    expect(rendered()).toBe('');
    mount(<LanguageSwitcher />, { locales: [LOCALES[0]!] });
    expect(rendered()).toBe('');
    act(() => root.render(<LanguageSwitcher />));
    expect(rendered()).toBe('');
  });

  it('renders nothing on the server for a single language, and the control for several', () => {
    const html = (locales?: StoreLocaleInput[]) =>
      renderToStaticMarkup(
        <Provider options={{ locales }}>
          <LanguageSwitcher />
        </Provider>,
      );
    expect(html()).not.toContain('qn-lang');
    expect(html([LOCALES[0]!])).not.toContain('qn-lang');
    expect(html(LOCALES)).toContain('data-qn-language-switcher');
  });

  it('renders a labelled native select with every language and the active one selected', () => {
    mount(<LanguageSwitcher />, { locales: LOCALES, locale: 'fr', basePath: '/fr' });
    const group = container.querySelector('[data-qn-language-switcher]')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Language');
    expect(selectOf().getAttribute('aria-label')).toBe('Language: French');
    expect(selectOf().value).toBe('fr');
    const options = [...container.querySelectorAll('option')];
    expect(options.map((o) => o.textContent)).toEqual(['English', 'Français', 'العربية']);
    expect(options.map((o) => o.getAttribute('lang'))).toEqual(['en', 'fr', 'ar']);
    expect(options[2]!.getAttribute('dir')).toBe('rtl');
    expect(options[0]!.getAttribute('dir')).toBe('ltr');
  });

  it('navigates when the selection changes (keyboard or pointer)', () => {
    window.history.replaceState(null, '', '/shop?sort=new');
    mount(<LanguageSwitcher />, { locales: LOCALES });
    act(() => {
      selectOf().value = 'fr';
      selectOf().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(nav.push).toHaveBeenCalledWith('/fr/shop?sort=new');
  });

  it('goes back to the root path when the default language is chosen', () => {
    nav.pathname = '/ar/products/mug';
    mount(<LanguageSwitcher />, { locales: LOCALES, locale: 'ar', basePath: '/ar' });
    act(() => {
      selectOf().value = 'en';
      selectOf().dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(nav.push).toHaveBeenCalledWith('/products/mug');
  });

  it('honours showCode and showNativeName, and className', () => {
    mount(<LanguageSwitcher className="in-header" showCode showNativeName={false} />, { locales: LOCALES });
    expect([...container.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'English · EN',
      'French · FR',
      'Arabic · AR',
    ]);
    expect(container.querySelector('[data-qn-language-switcher]')!.className).toBe('qn-lang qn-lang--select in-header');
  });

  it('takes its labels from the theme strings', () => {
    mount(<LanguageSwitcher />, {
      locales: LOCALES,
      strings: { language: { label: 'Langue', named: 'Langue : {name}' } },
    });
    expect(container.querySelector('[role="group"]')!.getAttribute('aria-label')).toBe('Langue');
    expect(selectOf().getAttribute('aria-label')).toBe('Langue : English');
  });

  it('renders the inline list with links, the current language marked, and wraps in a nav', () => {
    window.history.replaceState(null, '', '/shop?sort=new');
    mount(<LanguageSwitcher variant="inline-list" />, { locales: LOCALES, locale: null });
    const nav_ = container.querySelector('nav')!;
    expect(nav_.getAttribute('aria-label')).toBe('Language');
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/shop?sort=new', '/fr/shop?sort=new', '/ar/shop?sort=new']);
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual(['true', null, null]);
    expect(links[0]!.getAttribute('aria-label')).toBe('Language: English');
    expect(links[1]!.getAttribute('lang')).toBe('fr');
    expect(links[1]!.getAttribute('hreflang')).toBe('fr');
  });

  it('inline-list: a plain click switches with the live URL, a modified click is left alone', () => {
    mount(<LanguageSwitcher variant="inline-list" />, { locales: LOCALES });
    const fr = [...container.querySelectorAll('a')][1]!;
    act(() => {
      fr.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(nav.push).toHaveBeenCalledWith('/fr/shop');
    nav.push.mockClear();
    // jsdom cannot navigate: swallow the default action it would otherwise try.
    const swallow = (event: Event) => event.preventDefault();
    document.addEventListener('click', swallow);
    const modified = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    act(() => {
      fr.dispatchEvent(modified);
    });
    document.removeEventListener('click', swallow);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('hands the state to a render-prop and renders only what it returns', () => {
    const seen: string[] = [];
    mount(
      <LanguageSwitcher>
        {(state) => (
          <ul data-testid="custom">
            {state.locales.map((l) => {
              seen.push(state.labelFor(l));
              return (
                <li key={l.locale}>
                  <button type="button" onClick={() => state.switchTo(l)}>
                    {state.displayName(l)}
                  </button>
                  <a href={state.hrefFor(l)}>{state.label}</a>
                </li>
              );
            })}
          </ul>
        )}
      </LanguageSwitcher>,
      { locales: LOCALES },
    );
    expect(container.querySelector('[data-qn-language-switcher]')).toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(seen).toEqual(['Language: English', 'Language: French', 'Language: Arabic']);
    act(() => {
      (container.querySelectorAll('button')[1] as HTMLButtonElement).click();
    });
    expect(nav.push).toHaveBeenCalledWith('/fr/shop');
  });

  it('the render-prop is not called for a single language', () => {
    const children = vi.fn(() => <p>custom</p>);
    mount(<LanguageSwitcher>{children}</LanguageSwitcher>, { locales: [LOCALES[0]!] });
    expect(children).not.toHaveBeenCalled();
    expect(rendered()).toBe('');
  });

  it('keeps the same markup on the server and on first client render (no hydration mismatch)', () => {
    window.history.replaceState(null, '', '/shop?sort=new');
    const tree = (
      <Provider options={{ locales: LOCALES }}>
        <LanguageSwitcher variant="inline-list" />
      </Provider>
    );
    const server = renderToStaticMarkup(tree);
    expect(server).toContain('href="/fr/shop"');
    expect(server).not.toContain('sort=new');
  });
});

describe('LanguageSwitcher styling', () => {
  const css = readFileSync(join(__dirname, '..', 'components', 'language-switcher.css'), 'utf8');

  it('uses logical properties only (right-to-left safe)', () => {
    expect(css).not.toMatch(/(^|[\s{;])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/m);
    expect(css).not.toMatch(/text-align:\s*(left|right)/);
  });

  it('styles only through --qn-* tokens, each with a fallback', () => {
    const tokens = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]!);
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.filter((t) => !t.startsWith('--qn-'))).toEqual([]);
    expect(css).not.toMatch(/var\(--qn-[a-z0-9-]+\)/);
  });
});

describe('provider', () => {
  it('leaves the context untouched when no locales are passed (backward compatible)', () => {
    let seen: unknown;
    function Probe() {
      seen = (globalThis as never as { __ctx?: unknown }).__ctx;
      return null;
    }
    act(() =>
      root.render(
        <StorefrontProvider vendor={{ slug: 'acme' } as never} config={{} as never} menus={[]}>
          <StorefrontContext.Consumer>
            {(value) => {
              (globalThis as never as { __ctx?: unknown }).__ctx = value;
              return <Probe />;
            }}
          </StorefrontContext.Consumer>
        </StorefrontProvider>,
      ),
    );
    expect((seen as { locales: unknown[] }).locales).toEqual([]);
    delete (globalThis as never as { __ctx?: unknown }).__ctx;
  });
});

describe('theme manifest', () => {
  it("declares the theme places the switcher with languageSwitcher: 'theme'", () => {
    const field: Pick<ThemeManifest, 'languageSwitcher'> = { languageSwitcher: 'theme' };
    const none: Pick<ThemeManifest, 'languageSwitcher'> = {};
    expect(field.languageSwitcher).toBe('theme');
    expect(none.languageSwitcher).toBeUndefined();
  });
});
