'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { CartItem } from '../../types/cart';
import { useStorefront } from '../../provider';
import { useHref } from '../../hooks/use-href';
import { useShopCart } from '../../hooks/use-shop-cart';
import { useCartPanelStore } from '../../stores/cart-panel-store';

export interface CartPanelControllerRenderProps {
  isOpen: boolean;
  items: CartItem[];
  total: number;
  currency: string;
  onClose: () => void;
  onCheckout: () => void;
  onViewCart: () => void;
  onBrowseCollections: () => void;
  onSetQuantity: (id: string, shopId: string, quantity: number) => void;
  onRemove: (id: string, shopId: string) => void;
}

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
  const { items, total, setQuantity, removeItem } = useShopCart(vendor.id);

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
    currency: vendor.currency ?? 'NGN',
    onClose: closePanel,
    onCheckout: () => navigate('/checkout'),
    onViewCart: () => navigate('/cart'),
    onBrowseCollections: () => navigate('/collections'),
    onSetQuantity: setQuantity,
    onRemove: removeItem,
  }) as JSX.Element;
}
