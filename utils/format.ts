/**
 * Was hardcoded to `maximumFractionDigits: 0` — which, per Intl's own
 * resolution rules, also clamps the (otherwise currency-default 2) minimum
 * down to 0, so it silently truncated EVERY fractional-naira amount to a
 * whole number, everywhere in the storefront. A ₦0.28 balance (e.g. a tiny
 * residual left after a near-100% discount) displayed as "₦0" — the customer
 * saw a free checkout, then got asked to actually pay something. POS already
 * shows real money correctly (lib/currency.ts: minimumFractionDigits: 2,
 * maximumFractionDigits: 2, always).
 *
 * Deliberately NOT matching POS's always-2-decimals contract here: the
 * overwhelming majority of storefront prices are whole naira, and putting
 * ".00" on every single one would be a large, unrequested visual change
 * across every theme. `minimumFractionDigits: 0, maximumFractionDigits: 2`
 * shows decimals only when the amount genuinely has them — ₦5,000 stays
 * ₦5,000, ₦0.28 now correctly shows as ₦0.28.
 */
/**
 * The locale and zone every date/number the kit DISPLAYS is formatted in.
 * Fixed on purpose: storefront pages render on the server first, and a runtime
 * default prints differently there (Node in UTC, en-US) than in the shopper's
 * browser (Africa/Lagos, en-NG/en-GB) — "Feb 14, 2026" vs "14 Feb 2026". React
 * then fails hydration and re-renders the whole page on the client. Queek's
 * stores and shoppers are Nigerian, so that is the one answer both sides give.
 */
export const DISPLAY_LOCALE = 'en-NG';
export const DISPLAY_TIME_ZONE = 'Africa/Lagos';

/** A date for display (default "14 Feb 2026"), identical on server and browser. '' if unparseable. */
export function formatDisplayDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale: string = DISPLAY_LOCALE,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, { ...options, timeZone: DISPLAY_TIME_ZONE });
}

/** A count for display ("1,234"), identical on server and browser. */
export function formatCount(value: number): string {
  return value.toLocaleString(DISPLAY_LOCALE);
}

export function formatMoney(amount: number, currency = 'NGN'): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(DISPLAY_LOCALE)}`;
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
