import type { ImageVariants } from './media';

export interface CartAddon {
  addon_id: string;
  item_id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  shop_id: string;
  title: string;
  slug?: string | null;
  image: string | null;
  /**
   * The tier map of `image` (the API's `image_variants`), kept so a cart thumbnail renders a small WebP copy: the line's `image` is
   * the product's thumbnail, which the API sets to the full image unless the merchant chose another. Null when `image` is a separate,
   * explicit thumbnail file (already small) or is not Media-backed; absent on a line saved before the kit kept it.
   */
  image_variants?: ImageVariants | null;
  unit_price: number;
  quantity: number;
  addons: CartAddon[];
  variant_id?: string | null;
  /**
   * The product's and the variant's `p_id`, the ids a catalog feed uses, kept so the pixel
   * can send them. Absent on a line saved before they existed or read from a cart the API
   * answered without them: `catalogItemIdForCartLine` then falls back.
   */
  product_p_id?: number | null;
  variant_p_id?: number | null;
  /** e.g. "Denim" — the selected variant's display name, when this line has one. */
  variant_title?: string | null;
  /**
   * Text the shopper typed for an app-declared line field, `{ key: text }` with
   * keys in ascending order. Absent on a line with no such text.
   */
  properties?: Record<string, unknown>;
  /**
   * `{ key: label }` for the declared keys in `properties`. A key without a label
   * is never shown to the shopper. Kept on the line only; the kit never sends it
   * to a server.
   */
  property_labels?: Record<string, string>;
}
