'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartAddon, CartItem } from '../types/cart';
import type { Product, ProductVariant } from '../types/product';
import { toast } from './toast-store';
import { pushAddToCart } from '../apps/analytics-events';
import { getActivePlatform, platformScopedStorage } from '../sdk/platform';
import { productRequiresVariant } from '../utils/match-variant';

interface CartState {
  items: CartItem[];
  /** Set once per vendor mount (see vendor-shell.tsx) — the store has no
   *  React context, so this is how it learns the active vendor's currency
   *  for GA4 event values. Defaults to the same 'NGN' fallback used
   *  everywhere else in the storefront (see checkout-controller.tsx). */
  currency: string;
  setCurrency: (currency: string) => void;
  addProduct: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  addItemWithAddons: (product: Product, quantity: number, addons: CartAddon[], variant?: ProductVariant | null) => void;
  removeItem: (id: string, shopId: string) => void;
  setQuantity: (id: string, shopId: string, quantity: number) => void;
  clearShopCart: (shopId: string) => void;
  /** Replaces a shop's items with the server-persisted cart — only called when
   *  the local cart for that shop is empty (see use-cart-sync.ts), so this
   *  never clobbers what the customer is actively looking at. */
  adoptServerItems: (shopId: string, items: CartItem[]) => void;
}

/**
 * `variantId` folds into the base id (not appended like addons) so a variant
 * line and its product's plain (no-variant) line can never collide even if
 * addons also match — two genuinely different purchasable things. Omitting it
 * entirely for a no-variant product keeps every already-persisted cart's ids
 * unchanged (existing localStorage carts, in-flight server carts) rather than
 * reshaping ids for products that were never affected by this gap.
 */
export function makeItemId(productId: string, addons: CartAddon[], variantId?: string | null): string {
  const base = variantId ? `${productId}::${variantId}` : productId;

  if (addons.length === 0) {
    return base;
  }

  return `${base}-${addons.map((addon) => addon.item_id).sort().join(',')}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      currency: 'NGN',
      setCurrency: (currency) => set({ currency }),
      addProduct: (product, quantity = 1, variant = null) => {
        get().addItemWithAddons(product, quantity, [], variant);
      },
      addItemWithAddons: (product, quantity = 1, addons = [], variant = null) => {
        // A variant-enabled product has no valid "no selection" line: the cart
        // save fails server-side (DiscountService's VariantSelectionException),
        // so persisting one only moves the failure to checkout. Themes gate
        // their add button too, but a theme is presentation — correctness
        // cannot depend on all seven, or on the next one, getting it right.
        if (!variant && productRequiresVariant(product)) {
          toast({
            title: 'Select options',
            description: `Choose an option for ${product.title} before adding it to your cart.`,
          });
          console.error('[cart] refused a variant-enabled product added with no variant:', product.id);
          return;
        }

        const itemId = makeItemId(product.id, addons, variant?.id);
        const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
        // A variant's own price/stock override the base product's — the same
        // precedence quick-add-page.tsx's matchedVariant already uses.
        const unitPrice = (variant?.pricing.sale_amount ?? product.pricing.sale_amount) + addonTotal;
        const itemImage = variant?.media.thumbnail ?? variant?.media.image ?? product.media.thumbnail ?? product.media.image ?? null;

        // Confirm the add with a global toast (works across every theme) —
        // except on QR, which has its own persistent cart bar (QrCartBar)
        // always visible on screen, so a toast on top of it is redundant
        // (and its "View cart" action has nothing QR-specific to open).
        if (getActivePlatform() !== 'instore_qr') {
          toast({
            title: 'Added to cart',
            description: variant?.title ? `${product.title} (${variant.title})` : product.title,
            image: itemImage,
            showCart: true,
          });
        }
        pushAddToCart(
          { item_id: product.id, item_name: product.title, price: unitPrice, quantity: Math.max(1, quantity) },
          get().currency,
        );

        set((state) => {
          const existing = state.items.findIndex(
            (entry) => entry.id === itemId && entry.shop_id === product.shop_id,
          );

          if (existing >= 0) {
            const items = [...state.items];
            const current = items[existing];
            items[existing] = {
              ...current,
              quantity: current.quantity + Math.max(1, quantity),
              unit_price: unitPrice,
            };

            return { items };
          }

          return {
            items: [
              ...state.items,
              {
                id: itemId,
                product_id: product.id,
                shop_id: product.shop_id,
                title: product.title,
                slug: product.slug,
                image: itemImage,
                unit_price: unitPrice,
                quantity: Math.max(1, quantity),
                addons,
                variant_id: variant?.id ?? null,
                variant_title: variant?.title ?? null,
              },
            ],
          };
        });
      },
      removeItem: (id, shopId) => {
        set((state) => ({
          items: state.items.filter((entry) => !(entry.id === id && entry.shop_id === shopId)),
        }));
      },
      setQuantity: (id, shopId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id, shopId);

          return;
        }

        set((state) => ({
          items: state.items.map((entry) => {
            if (entry.id === id && entry.shop_id === shopId) {
              return { ...entry, quantity };
            }

            return entry;
          }),
        }));
      },
      clearShopCart: (shopId) => {
        set((state) => ({
          items: state.items.filter((entry) => entry.shop_id !== shopId),
        }));
      },
      adoptServerItems: (shopId, items) => {
        set((state) => ({
          items: [...state.items.filter((entry) => entry.shop_id !== shopId), ...items],
        }));
      },
    }),
    {
      name: 'queek-storefront-cart',
      storage: createJSONStorage(platformScopedStorage),
    },
  ),
);
