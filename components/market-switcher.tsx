'use client';

import { useContext, type JSX, type ReactNode } from 'react';
import { StorefrontContext, useThemeStrings } from '../provider';
import { useMarkets, type MarketsState } from '../hooks/use-markets';
import type { StoreMarket } from '../utils/market';
import './language-switcher.css';

/** Props for `MarketSwitcher`. */
export interface MarketSwitcherProps {
  /** Extra class on the root, to position or restyle the control. */
  className?: string;
  /**
   * Take over the presentation. Called with the markets, the chosen one and
   * `select`; whatever it returns renders instead of the default control.
   * Still renders nothing on a store with no published market.
   */
  children?: (state: MarketsState & { label: string; labelFor: (market: StoreMarket | null) => string; displayName: (market: StoreMarket | null) => string }) => ReactNode;
}

/**
 * The storefront's market control: the store's own currency plus each published
 * market, one native select. Renders nothing outside a storefront or on a store
 * with no published market, so it is safe to place unconditionally. Choosing an
 * option reloads the page with every price in that currency; the choice is
 * explicit and remembered for the store (nothing is guessed from the shopper's
 * location). It reuses the language control's `qn-lang` look and tokens, so it
 * mirrors in right-to-left storefronts.
 *
 * A theme that places this sets `marketSwitcher: 'theme'` in its manifest, so
 * the storefront does not also render its own floating control.
 */
export function MarketSwitcher(props: MarketSwitcherProps): JSX.Element | null {
  const inStorefront = useContext(StorefrontContext) !== null;
  if (!inStorefront) return null;
  return <MarketSwitcherInner {...props} />;
}

function MarketSwitcherInner({ className, children }: MarketSwitcherProps): JSX.Element | null {
  const t = useThemeStrings();
  const state = useMarkets();
  const { markets, hasMarkets, active, shopCurrency, select } = state;

  if (!hasMarkets) return null;

  const label = t('market.label');
  // The store's own currency is its bare ISO code: a localized currency name can differ between the server's ICU and
  // the browser's, and a select whose text differs between the two does not hydrate cleanly.
  const displayName = (market: StoreMarket | null): string => (market ? `${market.name} · ${market.currency}` : shopCurrency);
  const labelFor = (market: StoreMarket | null): string => t('market.named', { name: displayName(market) });

  if (children) return <>{children({ ...state, label, labelFor, displayName })}</>;

  const rootClass = ['qn-lang', 'qn-lang--select', 'qn-market', className].filter(Boolean).join(' ');

  return (
    <div className={rootClass} role="group" aria-label={label} data-qn-market-switcher="" data-variant="select">
      <svg className="qn-lang__icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="9" />
        <path d="M14.5 9.2c-.4-.8-1.4-1.2-2.5-1.2-1.4 0-2.4.7-2.4 1.8 0 2.4 5 1.1 5 3.6 0 1.1-1.1 1.8-2.6 1.8-1.2 0-2.2-.5-2.6-1.4M12 6.5V8m0 8v1.5" />
      </svg>
      <span className="qn-lang__field">
        <select
          className="qn-lang__select"
          aria-label={labelFor(active)}
          value={active ? String(active.id) : ''}
          onChange={(event) => select(event.target.value === '' ? null : Number(event.target.value))}
        >
          <option value="">{displayName(null)}</option>
          {markets.map((market) => (
            <option key={market.id} value={String(market.id)}>
              {displayName(market)}
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
