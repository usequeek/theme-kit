'use client';

import { useMemo } from 'react';
import { useCartStore } from '../stores/cart-store';

export function useShopCart(shopId: string | null | undefined): {
  items: ReturnType<typeof useCartStore.getState>['items'];
  count: number;
  total: number;
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
  const count = items.reduce((sum, entry) => sum + entry.quantity, 0);
  const total = items.reduce((sum, entry) => sum + entry.unit_price * entry.quantity, 0);

  return {
    items,
    count,
    total,
    setQuantity: useCartStore((state) => state.setQuantity),
    removeItem: useCartStore((state) => state.removeItem),
    clearShopCart: useCartStore((state) => state.clearShopCart),
  };
}
