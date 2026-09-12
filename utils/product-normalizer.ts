import type {
  LegacyProductLike,
  Product,
  ProductCategory,
  ProductOption,
  ProductPricing,
  ProductVariantOptionValue,
} from '../types/product';

const KIND_SET = new Set(['physical', 'service', 'digital']);
const STATUS_SET = new Set(['active', 'inactive']);

function toNumber(value: unknown, fallback = 0): number {
  const next = typeof value === 'number' ? value : Number(value);

  return Number.isFinite(next) ? next : fallback;
}

function toBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 1 || value === '1' || value === 'true') {
    return true;
  }

  if (value === 0 || value === '0' || value === 'false') {
    return false;
  }

  return fallback;
}

/**
 * Same base/sale/compare-at shape as normalizePricing(), but a variant's own price lives on
 * FLAT fields (price/discount_price/compare_at_price/discount_amount — see
 * ProductResource::resolveShopVariants on the backend), never nested under a `pricing` key.
 * Reading `variant.pricing?.sale_amount` (as this used to) is always undefined, so every
 * variant silently fell back to the base product's price — picking Denim vs Taupe never
 * changed what was shown, even though the backend had already computed the right number.
 */
type RawVariant = NonNullable<LegacyProductLike['variants']>[number];

function normalizeVariantPricing(variant: RawVariant, raw: LegacyProductLike): ProductPricing {
  const hasFlatBase = typeof variant.price === 'number' || typeof variant.price === 'string';
  const productPricing = normalizePricing(raw);

  if (!hasFlatBase && !variant.pricing) {
    return productPricing;
  }

  const baseAmount = toNumber(variant.pricing?.base_amount, hasFlatBase ? toNumber(variant.price) : productPricing.base_amount);
  const saleAmount = toNumber(variant.pricing?.sale_amount, toNumber(variant.discount_price, baseAmount));
  const compareAtAmount = toNumber(variant.pricing?.compare_at_amount, toNumber(variant.compare_at_price, baseAmount));
  const discountAmount = toNumber(
    variant.pricing?.discount_amount,
    toNumber(variant.discount_amount, Math.max(compareAtAmount - saleAmount, 0)),
  );

  return {
    base_amount: baseAmount,
    sale_amount: saleAmount,
    compare_at_amount: compareAtAmount,
    discount_amount: discountAmount,
    discount_percent: toNumber(
      variant.pricing?.discount_percent,
      compareAtAmount > 0 ? Math.round((discountAmount / compareAtAmount) * 100) : 0,
    ),
    is_price_from: false,
    tax_inclusive: productPricing.tax_inclusive,
    price_range: {
      min_amount: saleAmount,
      max_amount: saleAmount,
    },
  };
}

function normalizePricing(raw: LegacyProductLike): ProductPricing {
  const legacyBase = toNumber(raw.price, 0);
  const legacySale = toNumber(raw.discount_price, legacyBase);
  const legacyCompareAt = toNumber(raw.compare_at_price, legacyBase);
  const source = raw.pricing ?? {};
  const baseAmount = toNumber(source.base_amount, legacyBase);
  const saleAmount = toNumber(source.sale_amount, legacySale);
  const compareAtAmount = toNumber(source.compare_at_amount, legacyCompareAt || baseAmount);
  const discountAmount = toNumber(source.discount_amount, Math.max(compareAtAmount - saleAmount, 0));

  return {
    base_amount: baseAmount,
    sale_amount: saleAmount,
    compare_at_amount: compareAtAmount,
    discount_amount: discountAmount,
    discount_percent: toNumber(
      source.discount_percent,
      compareAtAmount > 0 ? Math.round((discountAmount / compareAtAmount) * 100) : 0,
    ),
    is_price_from: toBool(source.is_price_from, toBool(raw.is_price_from, false)),
    tax_inclusive: toBool(source.tax_inclusive, false),
    price_range: {
      min_amount: toNumber(source.price_range?.min_amount, saleAmount),
      max_amount: toNumber(source.price_range?.max_amount, saleAmount),
    },
  };
}

function normalizeVariantOptionValues(
  value: ProductVariantOptionValue[] | Record<string, string> | undefined,
): ProductVariantOptionValue[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  return Object.entries(value).map(([optionName, optionValue]) => ({
    option_name: optionName,
    value: optionValue,
  }));
}

function normalizeOptions(raw: LegacyProductLike): ProductOption[] {
  if (!Array.isArray(raw.options)) {
    return [];
  }

  return raw.options.reduce<ProductOption[]>((rows, option) => {
    const name = typeof option.name === 'string' ? option.name.trim() : '';
    if (name === '') {
      return rows;
    }

    // values_detailed (objects carrying color_code/image) is the richer, authoritative source —
    // values (plain strings) is a fallback for a shape that never sends values_detailed. These
    // describe the SAME set of values, never both at once — concatenating them (as this used to)
    // double-counted every option value.
    const source = Array.isArray(option.values_detailed) && option.values_detailed.length > 0
      ? option.values_detailed
      : (Array.isArray(option.values) ? option.values : []);

    const values = source
      .map((entry) => {
        if (typeof entry === 'string') {
          return {
            value: entry,
            label: entry,
            color_code: null,
            image: null,
          };
        }

        const value = typeof entry.value === 'string' ? entry.value : '';
        if (value === '') {
          return null;
        }

        return {
          value,
          label: typeof entry.label === 'string' && entry.label !== '' ? entry.label : value,
          color_code: typeof entry.color_code === 'string' ? entry.color_code : null,
          image: typeof entry.image === 'string' ? entry.image : null,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    rows.push({
      name,
      type: option.type ?? null,
      values,
    });

    return rows;
  }, []);
}

function normalizeCategories(raw: LegacyProductLike): ProductCategory[] {
  if (!Array.isArray(raw.categories)) {
    return [];
  }

  return raw.categories.reduce<ProductCategory[]>((rows, category) => {
    const name = typeof category.name === 'string' ? category.name.trim() : '';
    if (name === '') {
      return rows;
    }

    rows.push({
      id: String(category.id ?? ''),
      name,
      slug: String(category.slug ?? ''),
    });

    return rows;
  }, []);
}

export function normalizeProduct(raw: LegacyProductLike): Product {
  const shopId = String(raw.shop_id ?? raw.vendor_id ?? raw.shop?.id ?? raw.vendor?.id ?? '');

  return {
    shop_id: shopId,
    id: String(raw.id ?? ''),
    p_id: toNumber(raw.p_id, 0),
    title: String(raw.title ?? ''),
    slug: String(raw.slug ?? ''),
    excerpt: raw.excerpt ?? null,
    description: raw.description ?? null,
    kind:
      typeof raw.kind === 'string' && KIND_SET.has(raw.kind)
        ? (raw.kind as Product['kind'])
        : 'physical',
    status:
      typeof raw.status === 'string' && STATUS_SET.has(raw.status)
        ? (raw.status as Product['status'])
        : 'active',
    barcode: typeof raw.barcode === 'string' && raw.barcode !== '' ? raw.barcode : null,
    currency: String(raw.currency ?? 'NGN'),
    pricing: normalizePricing(raw),
    shop: {
      id: String(raw.shop?.id ?? raw.vendor?.id ?? shopId),
      name: raw.shop?.name ?? raw.vendor?.name ?? null,
      slug: raw.shop?.slug ?? raw.vendor?.slug ?? null,
      logo: raw.shop?.logo ?? raw.vendor?.logo ?? null,
      rating: toNumber(raw.shop?.rating ?? raw.vendor?.rating, 0),
      rating_count: toNumber(raw.shop?.rating_count ?? raw.vendor?.rating_count, 0),
    },
    media: {
      thumbnail: raw.media?.thumbnail ?? raw.thumbnail ?? null,
      image: raw.media?.image ?? raw.image ?? null,
      original: raw.media?.original ?? null,
      primary_variant_image: raw.media?.primary_variant_image ?? null,
      // Srcset tier maps — MUST be carried through: this whitelist is the only
      // path products take into the app (use-products, use-product-sections,
      // use-related-products, use-shop, api/products, api/collections, qr/*),
      // so dropping them here makes <Image variants> dead at every call site.
      // `?? null` (not `?? undefined`) keeps "no map" and "backend sent null"
      // indistinguishable, which is exactly how consumers treat them.
      image_variants: raw.media?.image_variants ?? null,
      primary_variant_image_variants: raw.media?.primary_variant_image_variants ?? null,
      // Top-level fields on the real payload, not nested under media (see
      // LegacyProductLike's own note) — media?.video_url/video_poster_url
      // covers a preview/demo payload that happens to nest them there too.
      video_url: raw.media?.video_url ?? raw.video_url ?? null,
      video_poster_url: raw.media?.video_poster_url ?? raw.video_poster_url ?? null,
      // Pass-through: gallery items carry their own `variants` (ProductResource::
      // buildGalleryPayload) and are not field-whitelisted here.
      gallery: raw.media?.gallery ?? [],
    },
    inventory: {
      in_stock: toBool(raw.inventory?.in_stock, toBool(raw.in_stock, toNumber(raw.stock, 0) > 0)),
      tracking: toBool(raw.inventory?.tracking, toBool(raw.inventory_tracking, false)),
      quantity: toNumber(raw.inventory?.quantity, toNumber(raw.stock, 0)),
    },
    variants_count: Array.isArray(raw.variants) ? raw.variants.length : 0,
    review_summary: {
      rating: toNumber(raw.review_summary?.rating ?? raw.rating, 0),
      review_count: toNumber(raw.review_summary?.review_count ?? raw.review_count, 0),
    },
    flags: {
      featured: toBool(raw.flags?.featured, false),
      is_marketplace: toBool(raw.flags?.is_marketplace, true),
      is_wholesale: toBool(raw.flags?.is_wholesale, false),
      is_new: toBool(raw.flags?.is_new, false),
    },
    categories: normalizeCategories(raw),
    options: normalizeOptions(raw),
    variants: Array.isArray(raw.variants)
      ? raw.variants.map((variant, index) => ({
          id: String(variant.id ?? `variant-${index}`),
          sku: variant.sku ?? null,
          barcode: typeof variant.barcode === 'string' && variant.barcode !== '' ? variant.barcode : null,
          title: variant.title ?? null,
          option_values: normalizeVariantOptionValues(variant.option_values),
          pricing: normalizeVariantPricing(variant, raw),
          inventory: {
            // Same flat-vs-nested mismatch as pricing: the backend sends in_stock/stock/
            // track_inventory directly on the variant, never nested under `inventory`.
            in_stock: toBool(variant.inventory?.in_stock, toBool(variant.in_stock, true)),
            tracking: toBool(variant.inventory?.tracking, toBool(variant.track_inventory, false)),
            quantity: toNumber(variant.inventory?.quantity, toNumber(variant.stock, 0)),
          },
          media: variant.media ?? {
            thumbnail: raw.media?.thumbnail ?? null,
            image: raw.media?.image ?? null,
          },
          weight: variant.weight ?? null,
          position: variant.position ?? index,
          is_active: toBool(variant.is_active, true),
        }))
      : [],
    addons: raw.addons ?? [],
    reviews: raw.reviews ?? [],
    created_at: raw.created_at ?? null,
    updated_at: raw.updated_at ?? null,
  };
}

export function extractProducts(value: unknown): LegacyProductLike[] {
  if (!Array.isArray(value)) {
    if (value && typeof value === 'object') {
      const payload = value as Record<string, unknown>;
      if (Array.isArray(payload.data)) {
        return extractProducts(payload.data);
      }

      if (payload.data && typeof payload.data === 'object') {
        return [payload.data as LegacyProductLike];
      }
    }

    return [];
  }

  // Check if this is a grouped response: [{title, data: [products]}, ...]
  const first = value[0] as Record<string, unknown> | undefined;
  if (first && Array.isArray(first.data) && typeof first.title === 'string') {
    return (value as Array<{ data: LegacyProductLike[] }>).flatMap((group) => group.data ?? []);
  }

  return value as LegacyProductLike[];
}
