'use client';

import type { JSX } from 'react';
import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { CartItem } from '../../types/cart';
import { useStorefront } from '../../provider';
import { useHref } from '../../hooks/use-href';
import { useShopCart } from '../../hooks/use-shop-cart';
import { useCartPanelStore } from '../../stores/cart-panel-store';
import { normalizeCurrencyCode } from '../../utils/format';
import type { CartServerPricing } from '../../utils/cart-pricing';

/** What {@link CartPanelController} hands to your render function: the panel state, this shop's lines, and the actions that change them. */
export interface CartPanelControllerRenderProps {
  isOpen: boolean;
  items: CartItem[];
  total: number;
  /** What the server charges for these lines (decimal strings; print them with `formatWireMoney`), or `null`/absent: print list prices. Never compute a discount. The controller always passes it; it is optional in the type so a hand-built props object (a test, a story) stays valid. */
  pricing?: CartServerPricing | null;
  currency: string;
  onClose: () => void;
  onCheckout: () => void;
  onViewCart: () => void;
  onBrowseCollections: () => void;
  onSetQuantity: (id: string, shopId: string, quantity: number) => void;
  onRemove: (id: string, shopId: string) => void;
}

/**
 * Headless controller for a cart panel (drawer). It owns open and close state,
 * the Escape key, scroll locking and navigation to checkout; you own the markup.
 * Open it from anywhere with `useCartPanelStore.getState().open()`.
 *
 * @example
 * <CartPanelController>
 *   {({ isOpen, items, total, onClose, onCheckout }) =>
 *     isOpen ? <MyDrawer items={items} total={total} onClose={onClose} onCheckout={onCheckout} /> : <></>
 *   }
 * </CartPanelController>
 */
export function CartPanelController({
  children,
}: {
  children: (props: CartPanelControllerRenderProps) => ReactNode;
}): JSX.Element {
  const { vendor } = useStorefront();
  const href = useHref();
  const router = useRouter();
  const isOpen = useCartPanelStore((state) => state.isOpen);
  const closePanel = useCartPanelStore((state) => state.close);
  const { items, total, pricing, setQuantity, removeItem } = useShopCart(vendor.id);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePanel();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, closePanel]);

  const navigate = (path: string) => {
    closePanel();
    router.push(href(path));
  };

  return children({
    isOpen,
    items,
    total,
    pricing,
    // Store-wide display uses the vendor's currency; item rows carry their own.
    // List-level meta.currency is never read (platform default, wrong per store).
    currency: normalizeCurrencyCode(vendor.currency),
    onClose: closePanel,
    onCheckout: () => navigate('/checkout'),
    onViewCart: () => navigate('/cart'),
    onBrowseCollections: () => navigate('/collections'),
    onSetQuantity: setQuantity,
    onRemove: removeItem,
  }) as JSX.Element;
}
