/**
 * Was hardcoded to `maximumFractionDigits: 0` — which, per Intl's own
 * resolution rules, also clamps the (otherwise currency-default 2) minimum
 * down to 0, so it silently truncated EVERY fractional-naira amount to a
 * whole number, everywhere in the storefront. A ₦0.28 balance (e.g. a tiny
 * residual left after a near-100% discount) displayed as "₦0" — the customer
 * saw a free checkout, then got asked to actually pay something. The POS
 * always shows two decimals.
 *
 * Deliberately NOT matching the POS's always-2-decimals format here: the
 * overwhelming majority of storefront prices are whole naira, and putting
 * ".00" on every single one would be a large, unrequested visual change
 * across every theme. `minimumFractionDigits: 0, maximumFractionDigits: 2`
 * shows decimals only when the amount genuinely has them — ₦5,000 stays
 * ₦5,000, ₦0.28 now correctly shows as ₦0.28.
 */
import {
  ENGLISH_DISPLAY_LOCALE,
  resolveIntlLocale,
  resolveSupportedLocale,
} from './locale';

/**
 * The locale and zone every date/number the kit DISPLAYS is formatted in.
 * Fixed on purpose: storefront pages render on the server first, and a runtime
 * default prints differently there (Node in UTC, en-US) than in the shopper's
 * browser (Africa/Lagos, en-NG/en-GB) — "Feb 14, 2026" vs "14 Feb 2026". React
 * then fails hydration and re-renders the whole page on the client. Queek's
 * stores and shoppers are Nigerian, so that is the one answer both sides give.
 *
 * Aliases `ENGLISH_DISPLAY_LOCALE` (`utils/locale.ts`) — the value lives in
 * exactly one place. `resolveIntlLocale` maps every English storefront code
 * here, so English output is byte-identical with or without a locale.
 */
export const DISPLAY_LOCALE: string = ENGLISH_DISPLAY_LOCALE;
export const DISPLAY_TIME_ZONE = 'Africa/Lagos';

/**
 * Pick the Intl tag for one formatting call: the storefront locale through
 * the canonical mapping, or English when the runtime's ICU lacks the locale.
 * Never throws.
 */
function displayTagFor(
  locale: string | null | undefined,
  supportedLocalesOf: (locales: string[]) => readonly string[],
): string {
  return resolveSupportedLocale(resolveIntlLocale(locale), supportedLocalesOf);
}

/**
 * A date for display (default "14 Feb 2026"), identical on server and browser.
 * '' if unparseable. The locale parameter is routed through the canonical
 * mapping (English is British/Nigerian order, never US order), so even an explicit 'en'/'en-US' renders "15 February 2026" — no
 * exported formatter lets an 'en*' tag reach Intl unmapped.
 */
export function formatDisplayDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale: string = DISPLAY_LOCALE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(resolveIntlLocale(locale), {
    ...options,
    timeZone: DISPLAY_TIME_ZONE,
  });
}

/**
 * A date for display in the SHOPPER's locale: `formatDisplayDate` with the
 * storefront locale (from `useStorefrontLocale()`) already resolved through
 * the canonical mapping. English renders exactly as `formatDisplayDate`
 * ("14 Feb 2026"); `fr` renders "14 févr. 2026", and so on. Time zone and
 * invalid-date handling are `formatDisplayDate`'s. Never throws.
 */
export function formatShopperDate(
  value: string | number | Date,
  locale: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
): string {
  return formatDisplayDate(
    value,
    options,
    displayTagFor(locale, (l) => Intl.DateTimeFormat.supportedLocalesOf(l)),
  );
}

/** A count for display ("1,234"), identical on server and browser. */
export function formatCount(value: number, locale?: string | null): string {
  const tag = displayTagFor(locale, (l) => Intl.NumberFormat.supportedLocalesOf(l));
  try {
    return value.toLocaleString(tag);
  } catch {
    return value.toLocaleString(DISPLAY_LOCALE);
  }
}

/**
 * Relative time for display ("yesterday", "il y a 3 jours") in the shopper's
 * locale — `numeric: 'auto'` so whole days read as words where the language
 * has them. Falls back to English on a missing ICU locale or a bad unit;
 * never throws.
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit = 'day',
  locale?: string | null,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  const tag = displayTagFor(locale, (l) => Intl.RelativeTimeFormat.supportedLocalesOf(l));
  try {
    return new Intl.RelativeTimeFormat(tag, { numeric: 'auto', ...options }).format(value, unit);
  } catch {
    try {
      return new Intl.RelativeTimeFormat(DISPLAY_LOCALE, { numeric: 'auto', ...options }).format(
        value,
        unit,
      );
    } catch {
      return `${value} ${unit}`;
    }
  }
}

/**
 * Platform default — the LAST resort only. Item rows carry their own
 * `currency` code (see normalizeProduct) and store-wide display uses the
 * vendor's currency (cart-store, set from vendor-shell on mount). A missing
 * or malformed code must resolve through this function, never a bare
 * `?? 'NGN'` at a call site, so the fallback stays in exactly one place.
 */
export const PLATFORM_DEFAULT_CURRENCY = 'NGN';

/**
 * The ONE currency-code resolver: trims/uppercases the item or vendor code,
 * accepts it when it is a 3-letter code, and returns the platform default
 * otherwise. List-level `meta.currency` is never consulted — it stamps the
 * platform default even on non-NGN stores.
 */
export function normalizeCurrencyCode(value: unknown, fallback: string = PLATFORM_DEFAULT_CURRENCY): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (/^[A-Z]{3}$/.test(code)) return code;
  const cleanFallback = typeof fallback === 'string' ? fallback.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(cleanFallback) ? cleanFallback : PLATFORM_DEFAULT_CURRENCY;
}

export function formatMoney(
  amount: number,
  currency = PLATFORM_DEFAULT_CURRENCY,
  locale?: string | null,
): string {
  const code = normalizeCurrencyCode(currency);
  const tag = displayTagFor(locale, (l) => Intl.NumberFormat.supportedLocalesOf(l));
  try {
    return new Intl.NumberFormat(tag, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString(DISPLAY_LOCALE)}`;
  }
}

export function toPercent(value: number): string {
  return `${Math.max(0, Math.round(value))}%`;
}

/**
 * Turn a backend status string ("ready_for_pickup", "pending_payment") into a
 * human-readable label ("Ready For Pickup", "Pending Payment"). Falls back to
 * the original when given an empty value.
 */
export function humanizeStatus(value?: string | null): string {
  const v = (value ?? '').toString().trim();
  if (!v) return '';
  return v
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Order status label, aware of the offline-payment confirmation gate: plain
 * "Pending Payment" reads as "nothing has happened yet," but for a bank-
 * transfer order the customer already sent the money — it's the vendor's
 * confirmation that's pending, not the payment itself. Every other status
 * (including pending_payment for an online-gateway order, where the
 * customer genuinely hasn't paid yet) is untouched.
 */
export function orderStatusLabel(order: { status?: string | null; status_label?: string | null; payment_status?: string | null }): string {
  if (order.payment_status === 'awaiting_confirmation') {
    return 'Pending Payment Confirmation';
  }
  return order.status_label || humanizeStatus(order.status);
}
