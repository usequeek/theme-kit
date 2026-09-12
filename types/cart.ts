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
}
