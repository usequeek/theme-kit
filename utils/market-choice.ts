import { dropPersistedShopLines } from '../stores/cart-store';
import { marketCookieWrite, readMarketFromCookieString, type StoreMarket } from './market';

/**
 * Browser-only: records the shopper's market for this store and reloads.
 *
 * A market changes every price on the page, the cart and the checkout, and the
 * server render reads the same cookie, so the one correct way to apply it is a
 * full load: no price from the previous currency survives in a client cache,
 * a store or an already rendered page. The store's cart lines are dropped from
 * the persisted cart first, because a line keeps the unit price it was added at
 * (see `dropPersistedShopLines`); the server cart re-prices them on the reload.
 *
 * `null` returns the shopper to the store's own currency.
 */
export function chooseMarket(vendorSlug: string, vendorId: string, marketId: number | null): void {
  if (typeof window === 'undefined') return;

  document.cookie = marketCookieWrite(vendorSlug, marketId);
  dropPersistedShopLines(vendorId);
  window.location.reload();
}

/**
 * Clears a choice the store no longer offers (its market was unpublished or
 * deleted), once. Runs only when the host resolved the store's market list
 * (a failed read passes none, and a shopper's choice is never dropped on a blip).
 */
export function reconcileMarketChoice(vendorSlug: string, vendorId: string, published: readonly StoreMarket[] | null): void {
  if (typeof window === 'undefined' || published === null || !vendorSlug) return;

  const chosen = readMarketFromCookieString(document.cookie, vendorSlug);
  if (chosen === null || published.some((market) => market.id === chosen)) return;

  document.cookie = marketCookieWrite(vendorSlug, null);
  dropPersistedShopLines(vendorId);
  window.location.reload();
}
