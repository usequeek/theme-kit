'use client';

import { useCartStore } from '../stores/cart-store';

export function useCart() {
  return {
    items: useCartStore((state) => state.items),
    addProduct: useCartStore((state) => state.addProduct),
    addItemWithAddons: useCartStore((state) => state.addItemWithAddons),
    setQuantity: useCartStore((state) => state.setQuantity),
    removeItem: useCartStore((state) => state.removeItem),
    clearShopCart: useCartStore((state) => state.clearShopCart),
  };
}
