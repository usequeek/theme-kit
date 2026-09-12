import type { ProductAddon } from '../types/product';
import type { CartAddon } from '../types/cart';

/**
 * Every PDP `pages/product.tsx` tracks addon picks as a `Set<"addonId:itemId">`
 * (see each theme's `toggleAddon`). This turns that selection into the
 * `CartAddon[]` shape `addItemWithAddons` actually persists — the piece every
 * theme's PDP was missing, so a customer's addon/pack picks were silently
 * dropped on add-to-cart regardless of what the UI showed them selecting.
 */
export function resolveSelectedAddons(addons: ProductAddon[], selected: Set<string>): CartAddon[] {
  const result: CartAddon[] = [];
  for (const addon of addons) {
    for (const item of addon.items) {
      if (selected.has(`${addon.id}:${item.id}`)) {
        result.push({ addon_id: addon.id, item_id: item.id, name: item.display_name ?? item.name, price: item.price });
      }
    }
  }
  return result;
}

/** True once every required addon group's minimum is met by `selected`. */
export function requiredAddonsSatisfied(addons: ProductAddon[], selected: Set<string>): boolean {
  return addons
    .filter((addon) => addon.required)
    .every((addon) => {
      const count = addon.items.filter((item) => selected.has(`${addon.id}:${item.id}`)).length;
      return count >= Math.max(1, addon.min || 1);
    });
}
