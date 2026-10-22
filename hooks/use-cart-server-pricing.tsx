'use client';

import type { JSX, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import type { CartServerPricing } from '../utils/cart-pricing';

const CartServerPricingContext = createContext<CartServerPricing | null>(null);

/**
 * Where the host app hands the kit what the server charges for the cart on
 * screen. The storefront mounts it once, above every theme, with the pricing
 * it read from the server for the cart as it stands (or `null` when it has
 * none). A theme never mounts it; it reads the result through `useShopCart()`
 * or `CartPanelController`.
 */
export function CartServerPricingProvider({
  value,
  children,
}: {
  value: CartServerPricing | null;
  children: ReactNode;
}): JSX.Element {
  return <CartServerPricingContext.Provider value={value}>{children}</CartServerPricingContext.Provider>;
}

/**
 * The pricing the host provided, exactly as given, or `null` without a provider.
 * It is NOT checked against any cart lines: prefer `useShopCart(...).pricing`,
 * which only returns it when it covers the lines on screen.
 */
export function useCartServerPricing(): CartServerPricing | null {
  return useContext(CartServerPricingContext);
}
