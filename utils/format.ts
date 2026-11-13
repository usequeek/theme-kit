/**
 * Money display rule (one rule, every formatter in this file): a whole amount
 * shows no decimals (₦5,000, $5), any other amount shows ALL of its currency's
 * minor-unit digits ($11.50, never $11.5; KWD 1.250; JPY never has decimals).
 * The digits come from Intl's own currency data, not a fixed 2.
 *
 * History: a hardcoded `maximumFractionDigits: 0` once truncated a ₦0.28
 * balance to "₦0"; the next fix (`minimum 0, maximum 2`) printed "$11.5" and
 * rounded a KWD amount to 2 digits.
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
 * vendor's currency (held in the cart store, which the storefront host sets on mount). A missing
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

/**
 * What one (locale, currency) needs, built once: `full` at the currency's own
 * minor units (Intl's default for a currency), `whole` with no decimals, and
 * `zeroFraction`, the fraction text of a whole amount in that locale's own
 * digits ("00", Arabic-Indic "٠٠", `undefined` for JPY). Intl.NumberFormat
 * construction is the expensive part of formatting, and a product grid formats
 * the same pair hundreds of times.
 */
interface MoneyFormatters {
  full: Intl.NumberFormat;
  whole: Intl.NumberFormat;
  zeroFraction: string | undefined;
}

const moneyFormatterCache = new Map<string, MoneyFormatters>();

function moneyFormatters(tag: string, code: string): MoneyFormatters {
  const key = `${tag}|${code}`;
  let formatters = moneyFormatterCache.get(key);
  if (!formatters) {
    const full = new Intl.NumberFormat(tag, { style: 'currency', currency: code });
    formatters = {
      full,
      whole: new Intl.NumberFormat(tag, { style: 'currency', currency: code, minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      zeroFraction: full.formatToParts(0).find((part) => part.type === 'fraction')?.value,
    };
    moneyFormatterCache.set(key, formatters);
  }
  return formatters;
}

/**
 * The money display rule (see the top of this file). "Whole" is decided by
 * Intl itself AFTER rounding to the currency's digits, so $11.999 prints "$12"
 * and $11.5 prints "$11.50" — never a float test that disagrees with what is
 * printed. A decimal string reaches Intl untouched (exact, no float round trip);
 * the cast only satisfies the lib typing. Throws what Intl throws.
 */
function formatAtMinorUnits(amount: number | string, code: string, tag: string): string {
  const { full, whole, zeroFraction } = moneyFormatters(tag, code);
  const value = amount as number;
  const fraction = full.formatToParts(value).find((part) => part.type === 'fraction')?.value;
  return fraction !== undefined && fraction !== zeroFraction ? full.format(value) : whole.format(value);
}

/**
 * Format an amount in a currency (ISO 4217 code), in the shopper's locale.
 * A whole amount shows no decimals (`₦5,000`, `$5`); any other amount shows
 * all of the currency's minor-unit digits (`$11.50`, `₦0.28`, KWD `1.250`).
 * An invalid currency code falls back to the platform default. Never throws.
 *
 * @example
 * formatMoney(5000, 'NGN'); // "₦5,000"
 * formatMoney(11.5, 'USD'); // "US$11.50"
 */
export function formatMoney(
  amount: number,
  currency = PLATFORM_DEFAULT_CURRENCY,
  locale?: string | null,
): string {
  const code = normalizeCurrencyCode(currency);
  const tag = displayTagFor(locale, (l) => Intl.NumberFormat.supportedLocalesOf(l));
  try {
    return formatAtMinorUnits(amount, code, tag);
  } catch {
    return `${code} ${amount.toLocaleString(DISPLAY_LOCALE)}`;
  }
}

/**
 * Format a money amount the server sent as a decimal STRING ("4500.00",
 * KWD "1.250", a refund "-5.00") without a float round trip: the string reaches
 * Intl untouched, under the same rule as `formatMoney` (whole amounts without
 * decimals, any other amount at the currency's full minor units). Returns an
 * empty string for anything that is not a plain decimal. Never computes, never throws.
 *
 * @example
 * formatWireMoney('4500.00', 'NGN'); // "₦4,500"
 * formatWireMoney('11.50', 'USD'); // "US$11.50"
 */
export function formatWireMoney(
  amount: string,
  currency = PLATFORM_DEFAULT_CURRENCY,
  locale?: string | null,
): string {
  if (typeof amount !== 'string' || !/^-?\d+(\.\d+)?$/.test(amount)) {
    return '';
  }

  const code = normalizeCurrencyCode(currency);
  const tag = displayTagFor(locale, (l) => Intl.NumberFormat.supportedLocalesOf(l));
  try {
    return formatAtMinorUnits(amount, code, tag);
  } catch {
    return `${code} ${amount}`;
  }
}

/** A whole-number percentage string, e.g. `toPercent(12.4)` is `"12%"`. */
/**
 * The one rounding for an amount the kit computes (event values, line totals):
 * three decimals, enough for KWD/BHD/OMR, and it strips float noise such as
 * 59.970000000000006. A non-finite input stays non-finite so callers can omit it.
 */
export function roundAmount(amount: number): number {
  return Number(amount.toFixed(3));
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
