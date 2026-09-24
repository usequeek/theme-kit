import { createServerStoreClient, getRequestOrigin } from '../sdk/server-store-client';
import type { ApiResponse } from '../types/product';
import { parseShopResponse, shopRequestParams, type ShopPrefetch, type ShopQuery } from '../utils/shop-query';

/**
 * The shop page's first page of products, fetched while the server renders
 * `/shop`, for `ShopPrefetchProvider` to hand to `useShop` — so the product grid
 * is in the HTML instead of appearing after the browser has run the JS and
 * fetched it (kili-foods' `/shop` main content landed at 2.8 s that way).
 *
 * Same request and the same parsing as the browser's `useShop` (both come from
 * utils/shop-query). Reads go through `/client/store/*` like every SSR read, so
 * pricing is the storefront's, never the marketplace's.
 *
 * Returns null on ANY failure: the page must never break over a head start —
 * `useShop` then fetches in the browser exactly as it did before.
 */
export async function fetchShopPrefetch(vendorSlug: string, query: ShopQuery): Promise<ShopPrefetch | null> {
  try {
    const client = createServerStoreClient(vendorSlug, await getRequestOrigin());
    const response = await client.get<ApiResponse<unknown, Record<string, unknown>>>('/products', shopRequestParams(query));
    return { query, ...parseShopResponse(response, query) };
  } catch {
    return null;
  }
}
