'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartAddon, CartItem } from '../types/cart';
import type { Product, ProductVariant } from '../types/product';
import { toast } from './toast-store';
import { normalizeCurrencyCode, PLATFORM_DEFAULT_CURRENCY, roundAmount } from '../utils/format';
import { trackStorefrontEvent } from '../apps/storefront-events';
import { getActivePlatform, platformScopedStorage } from '../sdk/platform';
import { productRequiresVariant } from '../utils/match-variant';
import { readLineText } from './line-text-store';
import { isBlankText } from '../utils/blank-text';

interface CartState {
  items: CartItem[];
  /** Set once per vendor mount by the storefront host. The store has no
   *  React context, so this is how it learns the active vendor's currency
   *  for analytics event values. The initial value is the platform default as
   *  a last resort only; the host overwrites it with the vendor's currency on
   *  mount. List-level `meta.currency` is never a source. */
  currency: string;
  setCurrency: (currency: string) => void;
  addProduct: (product: Product, quantity?: number, variant?: ProductVariant | null) => void;
  addItemWithAddons: (product: Product, quantity: number, addons: CartAddon[], variant?: ProductVariant | null) => void;
  removeItem: (id: string, shopId: string) => void;
  setQuantity: (id: string, shopId: string, quantity: number) => void;
  clearShopCart: (shopId: string) => void;
  /** Replaces a shop's items with the server-persisted cart — only called when
   *  the local cart for that shop is empty (by the storefront host), so this
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
export function makeItemId(
  productId: string,
  addons: CartAddon[],
  variantId?: string | null,
  properties?: Record<string, unknown> | null,
): string {
  const base = variantId ? `${productId}::${variantId}` : productId;
  const withAddons = addons.length === 0 ? base : `${base}-${addons.map((addon) => addon.item_id).sort().join(',')}`;
  const suffix = propertiesSuffix(properties);

  return suffix === '' ? withAddons : `${withAddons}${suffix}`;
}

/** FNV-1a (32 bit) over the UTF-8 bytes of `text`, as 8 hex digits. */
function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;

  for (const byte of new TextEncoder().encode(text)) {
    hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}

/**
 * `~p-` plus 12 hex digits over the canonical JSON (keys sorted) of the
 * non-blank string values, or an empty string when there are none, so a line
 * without text keeps the id it has always had. Callers pass labelled keys only.
 */
function propertiesSuffix(properties?: Record<string, unknown> | null): string {
  if (!properties) {
    return '';
  }

  const canonical: Record<string, string> = {};

  for (const key of Object.keys(properties).sort()) {
    const value = properties[key];

    if (typeof value === 'string' && !isBlankText(value)) {
      canonical[key] = value;
    }
  }

  if (Object.keys(canonical).length === 0) {
    return '';
  }

  const json = JSON.stringify(canonical);

  return `~p-${(fnv1a(json, 0x811c9dc5) + fnv1a(json, 0x9e3779b9)).slice(0, 12)}`;
}

/**
 * The cart store. Prefer the `useCart()` and `useShopCart()` hooks; read this
 * directly only from non-React code (`useCartStore.getState()`). Lines persist
 * in `localStorage` under a per-channel key.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      currency: PLATFORM_DEFAULT_CURRENCY,
      setCurrency: (currency) => set({ currency: normalizeCurrencyCode(currency) }),
      addProduct: (product, quantity = 1, variant = null) => {
        get().addItemWithAddons(product, quantity, [], variant);
      },
      addItemWithAddons: (product, quantity = 1, addons = [], variant = null) => {
        // A variant-enabled product has no valid "no selection" line: the cart
        // save fails server-side, so persisting one only moves the failure to
        // checkout. Themes gate
        // their add button too, but a theme is presentation — correctness
        // cannot depend on every theme getting it right.
        if (!variant && productRequiresVariant(product)) {
          toast({
            title: 'Select options',
            description: `Choose an option for ${product.title} before adding it to your cart.`,
          });
          console.error('[cart] refused a variant-enabled product added with no variant:', product.id);
          return;
        }

        // Text an app asked for on this product. A product with nothing
        // registered reads as empty, which is the behaviour of a kit without line text.
        const lineText = readLineText(product.shop_id, product.id);

        if (lineText.missingRequired.length > 0) {
          const missing = lineText.missingRequired[0];

          toast({ title: `Add your ${missing.label} before adding to cart` });
          console.error('[cart] refused a product added without its required line text:', product.id, missing.key);
          return;
        }

        const hasLineText = Object.keys(lineText.properties).length > 0;
        const itemId = makeItemId(product.id, addons, variant?.id, hasLineText ? lineText.properties : null);
        const addonTotal = addons.reduce((sum, addon) => sum + addon.price, 0);
        // A variant's own price/stock override the base product's — the same
        // precedence the quick-add flow uses.
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
        const addedQuantity = Math.max(1, quantity);

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
                ...(hasLineText ? { properties: lineText.properties, property_labels: lineText.labels } : {}),
              },
            ],
          };
        });

        trackStorefrontEvent('product_added_to_cart', {
          currency: get().currency,
          value: roundAmount(unitPrice * addedQuantity),
          items: [{ item_id: product.id, item_name: product.title, price: unitPrice, quantity: addedQuantity }],
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
