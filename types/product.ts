import type { ImageVariants } from './media';

export type ProductKind = 'physical' | 'service' | 'digital';
export type ProductStatus = 'active' | 'inactive';

export interface ProductPriceRange {
  min_amount: number;
  max_amount: number;
}

export interface ProductPricing {
  base_amount: number;
  sale_amount: number;
  compare_at_amount: number;
  discount_amount: number;
  discount_percent: number;
  is_price_from: boolean;
  tax_inclusive: boolean;
  price_range: ProductPriceRange;
}

export interface ProductShop {
  id: string;
  name: string | null;
  slug: string | null;
  logo: string | null;
  rating: number;
  rating_count: number;
}

/**
 * One entry of the ordered `images` list (backend
 * `CustomerProductMedia::orderedImages()`): primary first,
 * `{id, url, alt, variants}`. The listing payload caps the list
 * (`media.listing.images_limit`); detail/PDP carries the full list.
 */
export interface ProductImage {
  id: string | number;
  url: string;
  alt?: string;
  variants?: ImageVariants | null;
}

export interface ProductMedia {
  thumbnail: string | null;
  image: string | null;
  original?: string | null;
  /** The ONE ordered product-image list, primary first. Emitted by the
   *  backend on kit-consumed list/detail (preloaded) payloads and built by
   *  the normalizer from `images` only — readers must treat it as always
   *  available and never build a second ordering. */
  images?: ProductImage[];
  primary_variant_image?: string | null;
  video_url?: string | null;
  /** Falls back to `image` server-side when the vendor hasn't set an explicit
   *  poster (ProductResource::resolveVideoPosterUrl) — always a usable value
   *  whenever video_url is set. */
  video_poster_url?: string | null;
  /** Srcset tier map for `image` (ProductResource::buildBaseMediaPayload /
   *  buildDetailMediaPayload — present on BOTH list and detail responses).
   *  null when the primary image isn't Media-backed. */
  image_variants?: ImageVariants | null;
  /** Sibling to `primary_variant_image`, same contract. */
  primary_variant_image_variants?: ImageVariants | null;
}

export interface ProductInventory {
  in_stock: boolean;
  tracking: boolean;
  quantity: number;
}

export interface ProductReviewSummary {
  rating: number;
  review_count: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface ProductOptionValue {
  value: string;
  label: string;
  color_code: string | null;
  /** Representative image for this option value (e.g. the "Denim" swatch's variant photo) —
   *  used when there's no color_code to render as a swatch (standard e-commerce pattern:
   *  color if color, else image if image, else text). */
  image: string | null;
}

export interface ProductOption {
  name: string;
  type: string | null;
  values: ProductOptionValue[];
}

export interface ProductVariantOptionValue {
  option_name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  sku: string | null;
  /** Printed barcode / GTIN (EAN-13/8, UPC-A/E) for in-store scan-to-cart. */
  barcode: string | null;
  title: string | null;
  option_values: ProductVariantOptionValue[];
  pricing: {
    base_amount: number;
    sale_amount: number;
    compare_at_amount: number;
    discount_amount: number;
    discount_percent: number;
  };
  inventory: {
    in_stock: boolean;
    tracking: boolean;
    quantity: number;
  };
  media: ProductMedia;
  weight: string | null;
  position: number | null;
  is_active: boolean;
}

export interface ProductAddonItem {
  id: string;
  name: string;
  display_name: string | null;
  price: number;
  in_stock: boolean;
}

export interface ProductAddon {
  id: string;
  title: string;
  min: number;
  max: number;
  required: boolean;
  multiple_selection: boolean;
  /** Every item in the group is takeaway/delivery packaging rather than a real
   *  product choice. A required pack group is only genuinely required when the
   *  order leaves the premises — dine-in customers eat off a plate, so forcing
   *  one on them blocks checkout. Backend-derived; never re-derive it here. */
  is_pack_group?: boolean;
  items: ProductAddonItem[];
}

export interface ProductReview {
  id: string;
  title: string | null;
  description: string | null;
  rating: number;
  customer_name: string | null;
  created_at: string | null;
}

export interface ProductFlags {
  featured: boolean;
  is_marketplace: boolean;
  is_wholesale: boolean;
  is_new: boolean;
}

/** A scalar metafield value (single_line_text, boolean, date, url, …). */
export type MetafieldScalar = string | number | boolean;

/**
 * One metaobject entry linked through a `metaobject_reference` /
 * `list.metaobject_reference` metafield. Presented by the backend
 * (MetafieldPresenter) as the entry resource minus timestamps — a `draft`
 * entry, or one whose definition is not storefront-visible, is already
 * omitted on client surfaces, so the storefront renders whatever arrives.
 */
export interface MetaobjectEntry {
  p_id: number;
  type: string;
  handle: string;
  display_name: string;
  /** Flat entry values (definitions never nest references). */
  fields: Record<string, MetafieldScalar | MetafieldScalar[]>;
}

/** A presented product metafield value: scalar, scalar list, or linked entry/entries. */
export type MetafieldValue =
  | MetafieldScalar
  | MetafieldScalar[]
  | MetaobjectEntry
  | MetaobjectEntry[];

export interface Product {
  shop_id: string;
  id: string;
  p_id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  description: string | null;
  kind: ProductKind;
  status: ProductStatus;
  /** Printed barcode / GTIN for products without variants. Variant-level
   *  barcodes live on `variants[].barcode`. Powers QR in-store scan-to-cart. */
  barcode: string | null;
  currency: string;
  pricing: ProductPricing;
  shop: ProductShop;
  media: ProductMedia;
  inventory: ProductInventory;
  variants_count: number;
  review_summary: ProductReviewSummary;
  flags: ProductFlags;
  categories: ProductCategory[];
  options: ProductOption[];
  variants: ProductVariant[];
  addons: ProductAddon[];
  reviews: ProductReview[];
  /** Presented product metafields keyed by definition key (incl. linked
   *  metaobject entries). Absent when the backend sends none. */
  metafields?: Record<string, MetafieldValue>;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductListMeta {
  next_cursor?: string | null;
  has_more?: boolean;
}

export interface ApiResponse<T, M = Record<string, unknown>> {
  data: T;
  message?: string;
  meta?: M;
  /** Present on Laravel `simplePaginate()` resource responses (e.g. collection
   *  products) — that paginator never computes a total/last-page count (it's
   *  deliberately cheap on large catalogues), so `links.next`/`links.prev`
   *  (a URL or null) is the only reliable "is there another page" signal,
   *  not `meta.has_more` or a page count. */
  links?: {
    first?: string | null;
    last?: string | null;
    prev?: string | null;
    next?: string | null;
  };
}

export interface LegacyProductLike {
  id?: string;
  p_id?: number;
  title?: string;
  slug?: string;
  excerpt?: string | null;
  description?: string | null;
  compare_at_price?: number | null;
  rating?: number;
  review_count?: number;
  kind?: string;
  type?: string;
  status?: string;
  barcode?: string | null;
  currency?: string;
  price?: number;
  discount_price?: number;
  is_price_from?: boolean;
  shop_id?: string;
  vendor_id?: string;
  thumbnail?: string | null;
  image?: string | null;
  // Sibling top-level fields on the real backend payload (ProductResource::
  // buildBasePayload) — NOT nested under `media` server-side, unlike
  // image/thumbnail which are sent in both places.
  video_url?: string | null;
  video_poster_url?: string | null;
  stock?: number;
  in_stock?: boolean;
  inventory_tracking?: boolean;
  pricing?: Partial<ProductPricing>;
  inventory?: Partial<ProductInventory>;
  flags?: Partial<ProductFlags>;
  // A runtime legacy `gallery` key (still emitted by the backend detail
  // payload) arrives via the cast path only — never re-add it here, and
  // never derive `images` from it. Tests cast gallery-bearing literals.
  media?: Partial<ProductMedia>;
  categories?: Array<Partial<ProductCategory>>;
  options?: Array<{
    name?: string;
    type?: string | null;
    values?: Array<string | Partial<ProductOptionValue>>;
    values_detailed?: Array<Partial<ProductOptionValue>>;
  }>;
  variants?: Array<
    Omit<Partial<ProductVariant>, 'option_values'> & {
      // Partial<ProductVariant>'s own option_values is a plain array; a raw/legacy payload can
      // also send it as a {optionName: value} map (normalizeVariantOptionValues handles both) —
      // intersecting the two types directly collapses to an unsatisfiable type, hence the Omit.
      option_values?: ProductVariantOptionValue[] | Record<string, string>;
      // The backend sends a variant's own price/stock as FLAT fields (see
      // ProductResource::resolveShopVariants), never nested under pricing/inventory —
      // those nested keys only exist if some other caller pre-shapes the payload.
      price?: number;
      discount_price?: number;
      compare_at_price?: number | null;
      discount_amount?: number;
      has_discount?: boolean;
      in_stock?: boolean;
      stock?: number;
      track_inventory?: boolean;
    }
  >;
  addons?: ProductAddon[];
  reviews?: ProductReview[];
  /** Raw presented metafields — passed through verbatim by the normalizer. */
  metafields?: Record<string, unknown>;
  review_summary?: Partial<ProductReviewSummary>;
  created_at?: string | null;
  updated_at?: string | null;
  shop?: Partial<ProductShop>;
  vendor?: Partial<ProductShop>;
}
