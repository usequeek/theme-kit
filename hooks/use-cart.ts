'use client';

import { useCartStore } from '../stores/cart-store';

/**
 * The shopper's cart and the actions that change it. The cart is kept in the
 * browser (per sales channel) and survives a reload. `addProduct` refuses a
 * product that needs a variant when none is given and tells the shopper to
 * choose an option; otherwise it adds the line and shows an "Added to cart" toast.
 *
 * Use {@link useShopCart} for the lines and totals of a single shop.
 *
 * @example
 * const { items, addProduct, setQuantity } = useCart();
 * <button onClick={() => addProduct(product, 1, matchedVariant)}>Add to cart</button>
 */
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
