/**
 * Vendor resolution from a hostname: which store is this request for?
 *
 * Nothing here is app-specific: it reads env and resolves a slug, so the kit's
 * server fetchers and a host app's proxy can both import it.
 */

// Mirrors the API's reserved store slugs. Keep in sync.
// These are subdomains the storefront proxy must NOT treat as vendor slugs.
export const RESERVED_VENDOR_SLUGS = new Set([
  // Live platform subdomains
  'dokploy', 'dashboard', 'pos', 'qr', 'themes', 'preview', 'edge', 'api',
  // Standard reserved
  'www', 'app', 'admin', 'root', 'shop', 'store',
  // Common technical / infra
  'cdn', 'assets', 'media', 'static', 'health', 'status',
  // Common platform-service subdomains
  'mail', 'smtp', 'webmail', 'email', 'blog', 'help', 'docs', 'support',
  'billing', 'accounts', 'auth', 'login', 'signup', 'register', 'logout',
  // Internal / brand
  'staff', 'team', 'queek', 'merchant', 'vendor', 'rider', 'customer',
]);

// Every sluggable API model (Vendor, Product, Category, Region, Service)
// produces lowercase alphanumeric slugs, optionally hyphen-separated, never a
// dot/underscore/uppercase. Anything else cannot be a real slug of any kind, so
// reject it before any API round-trip instead of burning calls that all 404. This is what stops
// scanners probing `.env`, `.ssh`, `docker-compose.yaml`, `*.php` etc —
// RESERVED_VENDOR_SLUGS alone only covers known words, not the infinite space
// of file-extension guesses.
const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlugFormat(slug: string): boolean {
  return SLUG_FORMAT.test(slug);
}

const REMOTE_RESOLVE_REVALIDATE_SECONDS = 300;
const REMOTE_RESOLVE_TIMEOUT_MS = 3000;

let lastRemoteFailureLoggedAt = 0;
const REMOTE_FAILURE_LOG_WINDOW_MS = 60_000;

export function shouldBypassVendorProxy(pathname: string): boolean {
  return pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.');
}

export function resolveSubdomainVendorSlug(hostname: string): string | null {
  const storefrontDomain = process.env.STOREFRONT_DOMAIN ?? 'queek.com.ng';
  const domains = [`.${storefrontDomain}`, '.localhost'];

  const matchedDomain = domains.find((d) => hostname.endsWith(d));
  if (!matchedDomain) {
    return null;
  }

  const slug = hostname.slice(0, -matchedDomain.length);

  if (!slug || slug.includes('.') || RESERVED_VENDOR_SLUGS.has(slug)) {
    return null;
  }

  return slug;
}

export function resolveCustomDomainVendorSlug(hostname: string): string | null {
  const raw = process.env.CUSTOM_DOMAIN_VENDOR_MAP;
  if (!raw) {
    return null;
  }

  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const slug = map[hostname];

    return typeof slug === 'string' && slug !== '' ? slug : null;
  } catch {
    return null;
  }
}

export async function resolveCustomDomainVendorSlugRemote(hostname: string): Promise<string | null> {
  if (!hostname) {
    return null;
  }

  // Middleware runs server-side — prefer the server-only absolute URL. The
  // public var can be a same-origin relative path (checkout-proxy rollout),
  // which `fetch()` can't resolve without a document origin here.
  const baseUrl = process.env.QUEEK_API_URL ?? process.env.NEXT_PUBLIC_QUEEK_API_URL;
  if (!baseUrl) {
    return null;
  }

  const url = `${baseUrl.replace(/\/+$/, '')}/client/resolve-by-host?host=${encodeURIComponent(hostname)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REMOTE_RESOLVE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      next: {
        revalidate: REMOTE_RESOLVE_REVALIDATE_SECONDS,
        tags: [`host:${hostname}`],
      },
    });

    if (!response.ok) {
      logRemoteFailure(`status ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as { data?: { slug?: unknown } };
    const slug = payload?.data?.slug;

    return typeof slug === 'string' && slug !== '' ? slug : null;
  } catch (error) {
    logRemoteFailure(error instanceof Error ? error.message : 'unknown');
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function logRemoteFailure(reason: string): void {
  const now = Date.now();
  if (now - lastRemoteFailureLoggedAt < REMOTE_FAILURE_LOG_WINDOW_MS) {
    return;
  }
  lastRemoteFailureLoggedAt = now;
  console.warn(`[middleware] resolve-by-host failed: ${reason}`);
}

export function isPreviewSubdomain(hostname: string): boolean {
  const storefrontDomain = process.env.STOREFRONT_DOMAIN ?? 'queek.com.ng';
  const domains = [`.${storefrontDomain}`, '.localhost'];

  return domains.some((d) => {
    if (!hostname.endsWith(d)) return false;
    return hostname.slice(0, -d.length) === 'preview';
  });
}

export async function resolveVendorSlug(options: {
  host: string | null;
  searchVendor: string | null;
}): Promise<string | null> {
  const hostname = options.host?.split(':')[0] ?? '';
  const subdomainSlug = resolveSubdomainVendorSlug(hostname);

  if (subdomainSlug) {
    return subdomainSlug;
  }

  const staticCustomDomainSlug = resolveCustomDomainVendorSlug(hostname);
  if (staticCustomDomainSlug) {
    return staticCustomDomainSlug;
  }

  if (hostname) {
    const remoteCustomDomainSlug = await resolveCustomDomainVendorSlugRemote(hostname);
    if (remoteCustomDomainSlug) {
      return remoteCustomDomainSlug;
    }
  }

  return options.searchVendor;
}
