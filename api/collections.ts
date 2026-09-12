import { createServerStoreClient, getRequestOrigin } from '../sdk/server-store-client';
import { swallowNotFound } from '../sdk/client';
import type { Collection, Pagination } from '../types/page';
import type { ApiResponse } from '../types/product';
import { extractProducts, normalizeProduct } from '../utils/product-normalizer';

/** Matches `VendorCollectionProductsRequest`'s validated `sort` values exactly
 *  (queek_backend) — a value outside this list gets a 422 from the backend. */
export type CollectionSort = 'newest' | 'popular' | 'price_low' | 'price_high';

export interface FetchCollectionProductsOptions {
  page?: number;
  perPage?: number;
  sort?: CollectionSort;
  keyword?: string;
}

// SSR collection reads go through `/client/store/*` so ResolveClientContext forces
// X-Platform=storefront (base prices, no marketplace commission) — never the
// legacy v1 routes shared with the commission-bearing marketplace.
export async function fetchCollections(vendorSlug: string, storefrontOnly = true): Promise<Collection[]> {
  const client = createServerStoreClient(vendorSlug, await getRequestOrigin());

  try {
    const response = await client.get<ApiResponse<Collection[]>>(`/collections`, {
      storefront: storefrontOnly ? 1 : 0,
    });

    return response.data ?? [];
  } catch (error) {
    // A timeout here cascades: the collection page reads null and calls
    // notFound(), 404-ing a collection that exists.
    return swallowNotFound(error) ?? [];
  }
}

export async function fetchCollection(vendorSlug: string, slug: string): Promise<Collection | null> {
  const collections = await fetchCollections(vendorSlug);

  return collections.find((collection) => collection.slug === slug) ?? null;
}

export async function fetchCollectionProducts(
  vendorSlug: string,
  slug: string,
  options?: FetchCollectionProductsOptions,
): Promise<{
  collection: Collection | null;
  products: ReturnType<typeof normalizeProduct>[];
  pagination?: Pagination;
}> {
  const client = createServerStoreClient(vendorSlug, await getRequestOrigin());

  const query: Record<string, string | number> = {};
  if (options?.sort) query.sort = options.sort;
  if (options?.keyword?.trim()) query.keyword = options.keyword.trim();
  if (options?.perPage) query.per_page = options.perPage;
  // Laravel's paginator reads the CURRENT page off the `page` query param
  // implicitly (there is no `page` field in VendorCollectionProductsRequest's
  // own validation rules) — it must be sent as a plain query param, not
  // folded into the validated filters the backend actually reads.
  if (options?.page && options.page > 1) query.page = options.page;

  try {
    const [collection, response] = await Promise.all([
      fetchCollection(vendorSlug, slug),
      client.get<ApiResponse<unknown, Record<string, unknown>>>(`/collections/${slug}/products`, query),
    ]);

    const meta = response.meta ?? {};

    return {
      collection,
      products: extractProducts(response.data).map((product) => normalizeProduct(product)),
      pagination: {
        current_page: (meta.current_page as number) ?? options?.page ?? 1,
        per_page: (meta.per_page as number) ?? options?.perPage,
        // No `total`/`last_page` — this endpoint uses `simplePaginate()`
        // (deliberately, to avoid a COUNT query on large catalogues), so
        // `links.next` (a URL or null) is the only real "is there another
        // page" signal. `CollectionPager` already treats total/last_page as
        // optional and falls back to a plain "Page N" label without them.
        has_more: Boolean(response.links?.next),
        next_page_url: response.links?.next ?? null,
        prev_page_url: response.links?.prev ?? null,
      },
    };
  } catch (error) {
    swallowNotFound(error);

    return { collection: null, products: [] };
  }
}
