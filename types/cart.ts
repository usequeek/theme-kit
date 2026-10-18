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
  unit_price: number;
  quantity: number;
  addons: CartAddon[];
  variant_id?: string | null;
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
