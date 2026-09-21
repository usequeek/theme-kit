import { headers } from 'next/headers';
import { resolveCustomDomainVendorSlug, resolveCustomDomainVendorSlugRemote, resolveSubdomainVendorSlug } from '../utils/vendor-host';
import { API_BASE_URL, request, type RequestCachePolicy, type RequestOptions } from './client';
import { getActivePlatform } from './platform';

/**
 * Origin of the incoming storefront request, forwarded to the backend so it
 * resolves the vendor exactly as it does for a real browser request (subdomain,
 * apex/path and custom-domain storefronts all work with zero configuration).
 *
 * MUST be read OUTSIDE a React `cache()` scope — `headers()` is a dynamic API
 * and throws when called inside a cached function. Callers read it here, then
 * pass the value into the cached fetchers.
 */
export async function getRequestOrigin(): Promise<string | undefined> {
  const h = await headers();
  const host = h.get('host');
  if (!host) return undefined;
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Absolute store base URL for the current request — the single source of truth
 * for the subdomain-vs-path `basePath` resolution (subdomain/custom-domain
 * storefronts serve at the bare origin; path-based access serves under
 * `/vendor-slug`). Every canonical URL, sitemap entry, and JSON-LD `url` field
 * must derive from this instead of re-deriving `basePath` inline — see
 * `app/[vendor]/layout.tsx` and `app/[vendor]/products/[slug]/page.tsx`, which
 * used to duplicate this logic before it was extracted here.
 */
export async function resolveStoreBaseUrl(vendor: string): Promise<string | null> {
  const origin = await getRequestOrigin();
  if (!origin) return null;

  const h = await headers();
  const host = h.get('host')?.split(':')[0] ?? '';
  const isSubdomain = !!(
    resolveSubdomainVendorSlug(host) ??
    resolveCustomDomainVendorSlug(host) ??
    (host ? await resolveCustomDomainVendorSlugRemote(host) : null)
  );
  const basePath = isSubdomain ? '' : `/${vendor}`;

  return `${origin}${basePath}`;
}

/**
 * Server-side client for the unified `/client/store/*` scope — SSR CMS content
 * (theme, menus, pages, posts, galleries, policies). The vendor is resolved from
 * the forwarded request `Origin` (+ `X-Vendor-Slug`); pass `origin` from
 * {@link getRequestOrigin}. Replaces the legacy v1 `/vendors/{slug}/store/*` routes.
 */
/**
 * Abort budget for SSR reads. Sized above the observed p99 of the slowest
 * bootstrap call (`/theme`, ~4.4s) with headroom, so it never fails a legitimate
 * slow response — its job is to stop in-flight renders accumulating without
 * bound when the backend hangs, not to enforce an SLA.
 */
const SSR_TIMEOUT_MS = 8_000;

/**
 * Which SSR reads may be cached, for how long, and under which tags.
 *
 * ALLOWLIST BY DESIGN — anything unmatched returns null and always hits the
 * origin. Never add cart, checkout, fulfillment, follow-status, reviews or
 * questions here: they are per-visitor or must be live, and the data cache is
 * shared across every visitor of a store.
 *
 * Tags are per vendor so one store's edit never flushes another's. The TTL is a
 * safety net, not the primary mechanism — `POST /api/revalidate?tag=…` from the
 * backend is what makes an edit show up immediately.
 */
function resolveCachePolicy(vendorSlug: string, path: string): RequestCachePolicy | null {
  const vendor = `v:${vendorSlug}`;
  const policy = (revalidate: number, suffix: string, extra?: string): RequestCachePolicy => ({
    revalidate,
    tags: extra ? [vendor, `${vendor}:${suffix}`, `${vendor}:${extra}`] : [vendor, `${vendor}:${suffix}`],
  });

  // `/config` is deliberately NOT here: nothing fetches it server-side today, and
  // its response varies by platform (VendorConfigRequest), so allowlisting it
  // would let a future SSR caller that omits `platform` collapse two platforms
  // onto one cached entry.
  if (path === '/info') return policy(300, 'profile');
  // Combines /theme + /menus + /pages-chrome into one backend round trip (see
  // StoreContentController::bootstrapForClient). Tagged with all three resource
  // suffixes so a merchant edit to any one of them busts this entry — the
  // existing observers (MenuObserver, PostObserver, VendorConfigObserver)
  // already emit exactly these suffixes, no backend change needed.
  if (path === '/bootstrap') return { revalidate: 300, tags: [vendor, `${vendor}:theme`, `${vendor}:menus`, `${vendor}:pages`] };
  if (path === '/blog-categories') return policy(300, 'posts');
  if (/^\/pages(\/[^/]+)?$/.test(path)) return policy(300, 'pages');
  if (/^\/posts(\/[^/]+)?$/.test(path)) return policy(300, 'posts');
  if (/^\/policies(\/[^/]+)?$/.test(path)) return policy(300, 'policies');
  if (/^\/galleries(\/[^/]+)?$/.test(path)) return policy(300, 'galleries');
  if (/^\/categories(\/[^/]+\/products)?$/.test(path)) return policy(300, 'categories');
  if (/^\/collections(\/[^/]+\/products)?$/.test(path)) return policy(300, 'collections');

  // Shorter, because price and stock live here: a stale card that a shopper then
  // cannot buy at the shown price is a trust problem, even though the backend
  // recomputes both at order time.
  if (path === '/products') return policy(60, 'products');

  const product = /^\/products\/([^/]+)(?:\/related)?$/.exec(path);
  if (product) return policy(60, 'products', `product:${product[1]}`);

  // Product metafield definitions (the labels/types the core-owned
  // <ProductMetafields /> section renders values under). Merchant-edited,
  // shared across visitors — cached like pages, busted by revalidation.
  if (path === '/metafield-definitions') return policy(300, 'metafields');

  // Metaobject definitions (storefront-visible types + their field labels)
  // and entry lists/detail reads for the `metaobjects` block and its entry
  // pages. Merchant-edited, shared across visitors — same tag for both so
  // a definition edit (e.g. has_pages) and an entry write both bust the
  // same cache entries.
  if (path === '/metaobject-definitions') return policy(300, 'metaobjects');
  if (/^\/metaobjects(\/.+)?$/.test(path)) return policy(300, 'metaobjects');

  return null;
}

/**
 * True when this render is the merchant editor's preview iframe, which loads the
 * storefront with `?preview=true&id=<vendorId>`. Set by `proxy.ts`, which is the only
 * place that can see query params before the fetch layer runs.
 *
 * A preview render MUST bypass the cache outright rather than rely on the backend's
 * invalidation call. Invalidation is a distributed handshake — it needs two env vars
 * to match across two repos and a live HTTP round trip — and when any part of that
 * is wrong it fails SILENTLY, leaving a merchant staring at an unchanged store for
 * the full TTL. The editor is the one surface where "eventually" is not acceptable,
 * and it already knows it is the editor, so it should not have to ask anyone.
 *
 * The backend still flushes tags on save; that is what keeps the PUBLIC store fresh.
 * This just removes the editor's dependence on it.
 */
async function isPreviewRender(): Promise<boolean> {
  const h = await headers();

  return h.get('x-queek-preview') === '1';
}

export function createServerStoreClient(vendorSlug: string, origin?: string): {
  get: <T>(path: string, query?: RequestOptions['query']) => Promise<T>;
  post: <T>(path: string, body?: unknown) => Promise<T>;
} {
  const buildHeaders = (): Record<string, string> => {
    const out: Record<string, string> = {
      'X-Platform': getActivePlatform(),
      'X-Vendor-Slug': vendorSlug,
    };
    if (origin) out.Origin = origin;
    return out;
  };

  return {
    get: async <T>(path: string, query?: RequestOptions['query']) =>
      request<T>(
        API_BASE_URL,
        `/client/store${path}`,
        {
          query,
          timeoutMs: SSR_TIMEOUT_MS,
          cachePolicy: (await isPreviewRender()) ? null : resolveCachePolicy(vendorSlug, path),
        },
        buildHeaders(),
      ),
    post: <T>(path: string, body?: unknown) =>
      request<T>(API_BASE_URL, `/client/store${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        timeoutMs: SSR_TIMEOUT_MS,
        cachePolicy: null,
      }, buildHeaders()),
  };
}
