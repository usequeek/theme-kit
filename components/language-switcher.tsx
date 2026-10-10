'use client';

import { useContext, useState, type JSX, type MouseEvent, type ReactNode } from 'react';
import { StorefrontContext, useThemeStrings } from '../provider';
import { Link } from '../navigation';
import { useLocales, type LocalesState } from '../hooks/use-locales';
import type { StoreLocale } from '../utils/locale-switch';
import type { MenuAlign, MenuSide } from '../utils/menu-placement';
import { LanguageMenu } from './language-menu';
import './language-switcher.css';

export interface LanguageSwitcherProps {
  /** Extra class on the root, to position or restyle the control. */
  className?: string;
  /**
   * `'menu'`: a trigger button and a list of language links — a popover on
   * wide screens, a bottom sheet on narrow ones; fully restylable through
   * documented parts and `--qn-lang-*` variables. `'select'` (default, legacy):
   * one native dropdown. `'inline-list'`: every language as a link, wrapping
   * onto new lines on narrow screens; suits a footer with up to four languages.
   */
  variant?: 'select' | 'inline-list' | 'menu';
  /** `menu` only: open below (`'bottom'`, default) or above (`'top'`, for footers) the trigger. Flips on its own when it does not fit. */
  side?: MenuSide;
  /** `menu` only: line the popover up with the trigger's inline `'end'` (default) or `'start'` edge. */
  align?: MenuAlign;
  /** Append the language code, e.g. `Français · FR`. Default false. */
  showCode?: boolean;
  /** Label each language in its own language (`Français`) rather than English (`French`). Default true. */
  showNativeName?: boolean;
  /**
   * Take over the presentation. Called with the languages, the active one
   * and `hrefFor` / `switchTo`; whatever it returns renders instead of the
   * default control. Still renders nothing on a single-language store.
   */
  children?: (state: LanguageSwitcherState) => ReactNode;
}

/** What the render-prop receives: the `useLocales()` state plus the translated labels. */
export interface LanguageSwitcherState extends LocalesState {
  /** "Language" — the group label. */
  label: string;
  /** Whether the `menu` variant is open. A custom UI may drive it with `setOpen`. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** "Language: French" — names the control and the current language. */
  labelFor: (locale: StoreLocale) => string;
  /** The text to show for one language, honouring `showNativeName` / `showCode`. */
  displayName: (locale: StoreLocale) => string;
}

/**
 * The storefront's language control, placed by the theme where it wants it
 * (a header, a footer, a menu). Renders nothing outside a storefront or when
 * the store has a single language, so it is safe to place unconditionally.
 *
 * Switching keeps the page, the query string and the hash. Labels come from
 * the theme strings (`language.label`, `language.named`) with English
 * defaults. Colours and radius come from the `--qn-*` tokens; the layout is
 * direction-agnostic, so it mirrors in right-to-left storefronts.
 *
 * A theme that places this sets `languageSwitcher: 'theme'` in its manifest,
 * so the storefront does not also render its own floating control.
 */
export function LanguageSwitcher(props: LanguageSwitcherProps): JSX.Element | null {
  const inStorefront = useContext(StorefrontContext) !== null;
  if (!inStorefront) return null;
  return <LanguageSwitcherInner {...props} />;
}

function LanguageSwitcherInner({
  className,
  variant = 'select',
  side = 'bottom',
  align = 'end',
  showCode = false,
  showNativeName = true,
  children,
}: LanguageSwitcherProps): JSX.Element | null {
  const t = useThemeStrings();
  const base = useLocales();
  const [open, setOpen] = useState(false);
  const { locales, active, hasMultiple, hrefFor, switchTo } = base;

  if (!hasMultiple) return null;

  const label = t('language.label');
  const labelFor = (locale: StoreLocale): string => t('language.named', { name: locale.name });
  const displayName = (locale: StoreLocale): string => {
    const name = showNativeName ? locale.native_name : locale.name;
    return showCode ? `${name} · ${locale.locale.toUpperCase()}` : name;
  };

  const state: LanguageSwitcherState = { ...base, label, open, setOpen, labelFor, displayName };

  if (children) return <>{children(state)}</>;

  const rootClass = ['qn-lang', `qn-lang--${variant}`, className].filter(Boolean).join(' ');

  if (variant === 'menu') {
    const nameOf = (locale: StoreLocale): string => (showNativeName ? locale.native_name : locale.name);
    return (
      <LanguageMenu
        state={state}
        rootClass={rootClass}
        showCode={showCode}
        side={side}
        align={align}
        nameOf={nameOf}
        triggerLabelFor={(locale) => t('language.named', { name: nameOf(locale) })}
      />
    );
  }

  if (variant === 'inline-list') {
    return (
      <nav className={rootClass} aria-label={label} data-qn-language-switcher="" data-variant="inline-list">
        <ul className="qn-lang__list">
          {locales.map((locale) => {
            const isActive = locale.locale === active.locale;
            return (
              <li key={locale.locale}>
                <Link
                  className="qn-lang__link"
                  href={hrefFor(locale)}
                  prefetch={false}
                  lang={locale.html_lang}
                  hrefLang={locale.hreflang}
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={isActive ? labelFor(locale) : undefined}
                  onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                    // Plain clicks go through `switchTo`, which reads the live
                    // query string; modified clicks keep the browser default.
                    if (event.defaultPrevented || event.button !== 0) return;
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                    event.preventDefault();
                    switchTo(locale);
                  }}
                >
                  {displayName(locale)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <div className={rootClass} role="group" aria-label={label} data-qn-language-switcher="" data-variant="select">
      <svg className="qn-lang__icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3c2.3 2.4 3.5 5.4 3.5 9s-1.2 6.6-3.5 9c-2.3-2.4-3.5-5.4-3.5-9S9.7 5.4 12 3Z" />
      </svg>
      <span className="qn-lang__field">
        <select
          className="qn-lang__select"
          aria-label={labelFor(active)}
          value={active.locale}
          onChange={(event) => switchTo(event.target.value)}
        >
          {locales.map((locale) => (
            <option key={locale.locale} value={locale.locale} lang={locale.html_lang} dir={locale.dir}>
              {displayName(locale)}
            </option>
          ))}
        </select>
        <svg className="qn-lang__chevron" aria-hidden="true" viewBox="0 0 10 10" focusable="false">
          <path d="M1 3.5 5 7.5 9 3.5" />
        </svg>
      </span>
    </div>
  );
}
