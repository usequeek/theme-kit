export type MenuItemType =
  | 'page'
  | 'collection'
  | 'collections'
  | 'shop'
  | 'blog'
  | 'post'
  | 'gallery'
  | 'url'
  | 'group';

export interface MenuItem {
  label: string;
  type: MenuItemType;
  ref?: string | null;
  /** `anchor`: for a `page` item, scroll straight to that section (its `anchor_id`) instead of just the top. */
  meta?: (Record<string, unknown> & { anchor?: string | null }) | null;
  children?: MenuItem[];
}

export interface Menu {
  id: string;
  location: string;
  items: MenuItem[];
  created_at?: string | null;
  updated_at?: string | null;
}
