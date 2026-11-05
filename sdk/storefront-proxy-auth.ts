/**
 * The two headers a storefront SERVER sends the Queek API so the API can tell its own storefront from a
 * shopper, and which shopper a request belongs to (S8-B). Server-only: the secret is a plain env var that
 * never reaches a browser bundle, and this module returns nothing when it runs in one.
 *
 *  - `X-Storefront-Proxy-Secret`: the shared secret (`STOREFRONT_PROXY_SECRET`, the same value as on the API).
 *    With it the API trusts the next header; without it both are ignored.
 *  - `X-Shopper-IP`: the shopper's public address, so the API's per-address limits count that shopper and not
 *    this server. Sent only when the caller has a real one (Cloudflare's `cf-connecting-ip`); never guessed from
 *    `x-forwarded-for` or `x-real-ip`, and never empty or malformed (the API logs a warning for those).
 *
 * `STOREFRONT_PROXY_SECRET` empty or unset: nothing is sent, which is exactly how the storefront behaved before.
 *
 * Pure on purpose (no `next/headers`): the host app's proxy runs here too and reads `cf-connecting-ip` from its
 * own request. Reads that sit in Next's data cache must pass NO shopper: the cache key includes the request
 * headers, so a per-shopper header would give every visitor their own entry. The secret is one constant value
 * and does not split it.
 */

export const PROXY_SECRET_HEADER = 'X-Storefront-Proxy-Secret';
export const SHOPPER_IP_HEADER = 'X-Shopper-IP';

/** The configured secret, or null when unset/blank (and always null in a browser). */
export function readProxySecret(): string | null {
  if (typeof window !== 'undefined') return null;
  const secret = process.env.STOREFRONT_PROXY_SECRET?.trim();

  return secret ? secret : null;
}

/**
 * `value` as a shopper address worth sending, else null. A cheap shape check only (hex digits, `.` and `:`, one of
 * the last two present, at most 45 characters, the longest IPv6 text form): the API validates for real, and ignores
 * a private or reserved address.
 */
export function usableShopperIp(value: string | null | undefined): string | null {
  const ip = value?.trim();
  if (!ip || ip.length > 45) return null;
  if (!/^[0-9a-fA-F:.]+$/.test(ip) || !/[.:]/.test(ip)) return null;

  return ip;
}

/**
 * The headers to add to one API call: `{}` without a secret, the secret alone, or the secret plus the shopper.
 * Pass `shopperIp` only for a call that is NOT in Next's data cache.
 */
export function storefrontProxyHeaders(options: { shopperIp?: string | null } = {}): Record<string, string> {
  const secret = readProxySecret();
  if (!secret) return {};

  const shopper = usableShopperIp(options.shopperIp);

  return shopper ? { [PROXY_SECRET_HEADER]: secret, [SHOPPER_IP_HEADER]: shopper } : { [PROXY_SECRET_HEADER]: secret };
}
