/**
 * What the server charges for the cart on screen, as the host app read it
 * (quantity-break and spend-gate discounts included). The kit only DISPLAYS it:
 * every amount is a decimal string exactly as the server sent it ("4500.00"),
 * and nothing here ever computes a price, a discount or a total.
 */

/** One cart line as the server prices it. Matched to a local line by `line_id` AND `quantity`. */
export interface CartLinePricing {
  /** The local cart line id (`CartItem.id`). */
  line_id: string;
  /** The quantity the server priced; a line whose quantity differs is not covered. */
  quantity: number;
  /** One unit with its add-ons, as charged. */
  unit_price: string;
  /** The line total as charged. */
  line_total: string;
  /** The list (undiscounted) line total, only when the server charges less than it; otherwise null. */
  list_line_total: string | null;
}

/** The server's pricing of one whole cart. */
export interface CartServerPricing {
  lines: readonly CartLinePricing[];
  /** The cart total as charged (before coupons and delivery). */
  total: string;
  /** The list (undiscounted) cart total, only when the server charges less than it; otherwise null. */
  list_total: string | null;
}

const DECIMAL = /^\d+(\.\d+)?$/;

function isDecimal(value: unknown): value is string {
  return typeof value === 'string' && DECIMAL.test(value);
}

/** Digit-exact `a > b` for two non-negative decimal strings (no float round trip). */
function isGreater(a: string, b: string): boolean {
  const [aWhole, aFraction = ''] = a.split('.');
  const [bWhole, bFraction = ''] = b.split('.');
  const left = aWhole.replace(/^0+(?=\d)/, '');
  const right = bWhole.replace(/^0+(?=\d)/, '');

  if (left.length !== right.length) {
    return left.length > right.length;
  }

  const width = Math.max(aFraction.length, bFraction.length);
  const leftDigits = left + aFraction.padEnd(width, '0');
  const rightDigits = right + bFraction.padEnd(width, '0');

  return leftDigits > rightDigits;
}

/** A struck list amount is kept only when it is a well-formed decimal HIGHER than what is charged. */
function strikeOf(list: unknown, charged: string): string | null {
  return isDecimal(list) && isGreater(list, charged) ? list : null;
}

/**
 * The server pricing that may stand for these cart lines, or null.
 *
 * It stands only when it covers the lines one to one: same count, every line
 * found by id with the same quantity, no id twice, and every amount a plain
 * non-negative decimal string. Anything else (no pricing, a line added or
 * re-quantified since the server read, a malformed amount) is null, and the
 * caller prints its own list prices exactly as it always has: nothing is
 * guessed and nothing is mixed. A struck list amount that is not higher than
 * the amount charged is dropped to null. Amounts are returned as received.
 */
export function resolveCartPricing(
  pricing: CartServerPricing | null | undefined,
  lines: readonly { id: string; quantity: number }[],
): CartServerPricing | null {
  if (!pricing || !Array.isArray(pricing.lines) || !isDecimal(pricing.total)) {
    return null;
  }

  if (lines.length === 0 || pricing.lines.length !== lines.length) {
    return null;
  }

  const byId = new Map<string, CartLinePricing>();

  for (const entry of pricing.lines) {
    if (
      !entry
      || typeof entry.line_id !== 'string'
      || byId.has(entry.line_id)
      || !isDecimal(entry.unit_price)
      || !isDecimal(entry.line_total)
    ) {
      return null;
    }

    byId.set(entry.line_id, entry);
  }

  const covered: CartLinePricing[] = [];

  for (const line of lines) {
    const entry = byId.get(line.id);

    if (!entry || entry.quantity !== line.quantity) {
      return null;
    }

    covered.push({ ...entry, list_line_total: strikeOf(entry.list_line_total, entry.line_total) });
  }

  return { lines: covered, total: pricing.total, list_total: strikeOf(pricing.list_total, pricing.total) };
}

/** The server pricing of one cart line from a resolved overlay, or null when there is none for it. */
export function cartLinePricing(
  pricing: CartServerPricing | null | undefined,
  lineId: string,
): CartLinePricing | null {
  return pricing?.lines.find((entry) => entry.line_id === lineId) ?? null;
}
