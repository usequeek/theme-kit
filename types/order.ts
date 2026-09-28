export interface OrderListItem {
  id: string;
  order_no: string;
  status: string;
  is_completed?: boolean;
  total_price: number | string;
  grand_total?: number | string;
  items_count: number | null;
  payment_status: string;
  created_at: string;
  payment_method?: string;
  payment_link?: string | null;
  currency?: string;
  delivery_method?: string;
  /** @deprecated backend sends `delivery_method`; kept for type back-compat. */
  delivery_mode?: string;
  vendor?: { id: string; name: string; slug: string };
}

export interface OrderItem {
  id: string;
  quantity: number;
  title: string;
  total_price: number | string;
  unit_price: number | string;
  addons: Array<Record<string, unknown>>;
  product?: { id: string; thumbnail_image?: string | null } | null;
}

export interface OrderTimeline {
  time: string | null;
  title: string;
  description: string;
}

export interface AmountSummaryRow {
  key: string;
  label: string;
  type?: string;
  amount: number | string;
  is_total?: boolean;
}

export interface OrderDetail {
  id: string;
  order_no: string;
  status: string;
  is_completed?: boolean;
  status_label?: string;
  payment_status: string;
  payment_method?: string;
  total_price: number | string;
  grand_total?: number | string;
  payment_link: string | null;
  pay_link?: string | null;
  items: OrderItem[];
  timeline?: OrderTimeline[];
  stage?: number | null;
  amount_summary?: {
    title?: string;
    items: AmountSummaryRow[];
  };
  subtotal?: number;
  delivery_fee?: number;
  currency?: string;
  delivery_method?: string;
  /** @deprecated backend sends `delivery_method`; kept for type back-compat. */
  delivery_mode?: string;
  delivery_address?: string | null;
  vendor_note?: string | null;
  rider_note?: string | null;
  created_at?: string;
  vendor?: {
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    map_lat?: number | string | null;
    map_lng?: number | string | null;
  };
  pickup_address?: string | null;
  table?: { id: string; name: string; section?: string | null } | null;
}

/**
 * `GET store/orders` — the ONE storefront list envelope: the walk state rides
 * top-level. A page-mode reader (`?page=N`) labels the page it asked for and
 * loads the next while `has_more` is true; a cursor reader passes
 * `next_cursor` back as `starting_after`. No totals, page counts or page URLs
 * are sent; `meta` is context only (e.g. `currency`).
 */
export interface OrderListResponse {
  data: OrderListItem[];
  has_more: boolean;
  next_cursor: string | null;
  meta?: Record<string, unknown>;
}

export interface CheckoutPayload {
  delivery_mode: string;
  payment_method: string;
  cart_items: Array<{
    id: string;
    item_id: string;
    title: string;
    price: number;
    quantity: number;
    selectedAddons: Array<{ id: string; name: string; price: number }>;
  }>;
  delivery_address?: string;
  map_lat?: number;
  map_lng?: number;
  order_type?: 'instant' | 'schedule';
  schedule_date?: string;
  schedule_time?: string;
  vendor_note?: string;
  customer_phone?: string;
}
