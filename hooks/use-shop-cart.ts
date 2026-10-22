'use client';

import { useMemo } from 'react';
import { useCartStore } from '../stores/cart-store';
import { resolveCartPricing, type CartServerPricing } from '../utils/cart-pricing';
import { useCartServerPricing } from './use-cart-server-pricing';

/**
 * The cart lines for one shop, with the unit count and the total (in the
 * currency's major unit, before delivery and discounts). Pass the shop id from
 * `product.shop_id`; a missing id gives an empty cart.
 *
 * `total` is always the list total (`unit_price x quantity`). `pricing` is what
 * the server charges for these exact lines (quantity breaks and spend gates
 * included) when the host app provided it and it covers the lines on screen,
 * else `null`; when it is not `null`, print its amounts (decimal strings; format
 * them with `formatWireMoney`) instead of the list prices, and never compute a
 * discount yourself.
 *
 * @example
 * const { items, count, total, pricing } = useShopCart(product.shop_id);
 */
export function useShopCart(shopId: string | null | undefined): {
  items: ReturnType<typeof useCartStore.getState>['items'];
  count: number;
  total: number;
  /** The server's pricing for exactly these lines, or `null` (print list prices). */
  pricing: CartServerPricing | null;
  setQuantity: ReturnType<typeof useCartStore.getState>['setQuantity'];
  removeItem: ReturnType<typeof useCartStore.getState>['removeItem'];
  clearShopCart: ReturnType<typeof useCartStore.getState>['clearShopCart'];
} {
  const resolvedShopId = shopId ?? '';
  const allItems = useCartStore((state) => state.items);
  const items = useMemo(
    () => allItems.filter((entry) => entry.shop_id === resolvedShopId),
    [allItems, resolvedShopId],
  );
  const provided = useCartServerPricing();
  const pricing = useMemo(() => resolveCartPricing(provided, items), [provided, items]);
  const count = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const total = items.reduce((sum, entry) => sum + entry.unit_price * entry.quantity, 0);

  return {
    items,
    count,
    total,
    pricing,
    setQuantity: useCartStore((state) => state.setQuantity),
    removeItem: useCartStore((state) => state.removeItem),
    clearShopCart: useCartStore((state) => state.clearShopCart),
  };
}
