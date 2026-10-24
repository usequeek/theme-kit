'use client';

import { useCallback, useContext, useMemo } from 'react';
import { StorefrontContext } from '../provider';
import { chooseMarket } from '../utils/market-choice';
import { normalizeCurrencyCode } from '../utils/format';
import type { StoreMarket } from '../utils/market';

export interface MarketsState {
  /** The store's published markets. Empty on a store that sells in its own currency only. */
  markets: StoreMarket[];
  /** More than zero published markets: whether a market choice makes sense at all. */
  hasMarkets: boolean;
  /** The market the shopper chose, or null for the store's own currency. */
  active: StoreMarket | null;
  /** The store's own currency (ISO 4217). */
  shopCurrency: string;
  /** The currency prices are shown and charged in: the active market's, else the store's own. */
  displayCurrency: string;
  /** Chooses a market (`null` = the store's own currency) and reloads the page in it. */
  select: (marketId: number | null) => void;
}

/**
 * The store's markets and the shopper's choice, for a theme that builds its own
 * currency control. Reads what the host passed to `StorefrontProvider`; outside a
 * provider, or on a store with no published market, it reports no markets and
 * the store's own currency. Most themes want `MarketSwitcher` instead.
 */
export function useMarkets(): MarketsState {
  const context = useContext(StorefrontContext);
  const markets = context?.markets;
  const activeMarketId = context?.activeMarketId ?? null;
  const vendorSlug = context?.vendor.slug ?? '';
  const vendorId = context?.vendor.id ?? '';
  const shopCurrency = normalizeCurrencyCode(context?.vendor.currency);

  const list = useMemo(() => markets ?? [], [markets]);
  const active = useMemo(() => list.find((m) => m.id === activeMarketId) ?? null, [list, activeMarketId]);
  const select = useCallback((marketId: number | null) => chooseMarket(vendorSlug, vendorId, marketId), [vendorSlug, vendorId]);

  return useMemo(
    () => ({ markets: list, hasMarkets: list.length > 0, active, shopCurrency, displayCurrency: active?.currency ?? shopCurrency, select }),
    [list, active, shopCurrency, select],
  );
}

/**
 * The ISO currency code store-wide amounts (cart totals, delivery, checkout) are
 * shown in: the shopper's market currency, else the store's own. A product price
 * reads its own `currency`, which the API already answers in the market currency.
 */
export function useDisplayCurrency(): string {
  return useMarkets().displayCurrency;
}
