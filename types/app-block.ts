/**
 * The add-to-cart app block: what the storefront reads for it and what adding
 * its lines to the cart reports back. Pure types, importable from anywhere.
 */

/**
 * One line of the add-to-cart read
 * (`GET v1/client/apps/{slug}/{path}?target=add-to-cart&block={key}`), already
 * vetted and resolved by the platform. A line names a product, a quantity and
 * nothing else that matters here: it never carries a price.
 */
export interface AppBlockLine {
  /** The product's `p_id`. */
  product: number;
  slug: string;
  /** The product's id, the one the cart stores. */
  product_id: string;
  /** Units, a whole number from 1 to 20. */
  quantity: number;
  /** The variant's `p_id`; present only for a variant product. */
  variant?: number;
  /** The variant's id, the one the cart stores. */
  variant_id?: string;
  /** App-namespaced text for the line. The kit does not put it on the cart line (see `useAddAppBlockLines`). */
  properties?: Record<string, string>;
}

/** A line the platform left out of the read, with why (`reason` is a stable code, not shopper text). */
export interface AppBlockSkippedLine {
  index: number;
  reason: string;
}

/** The answer of the add-to-cart read. */
export interface AppBlockAddToCartRead {
  lines: AppBlockLine[];
  skipped: AppBlockSkippedLine[];
}

/**
 * What happened to one line.
 *
 * - `added`: the line is on the cart (or its quantity grew).
 * - `customise`: nothing added; the shopper must choose first (any required add-on
 *   group, pack groups included, or a required line text field).
 * - `variant_required`: nothing added; a variant product with no variant on the line.
 * - `unavailable`: nothing added; the product or variant is gone, inactive, out of
 *   stock (a tracked variant with fewer left than the quantity too), from another store, or not the product the line named.
 * - `failed`: nothing added; the product could not be read (network or server
 *   error) or the line is malformed. Trying again can help.
 * - `over_limit`: nothing added; the line is past the 20th of the press.
 */
export type AppBlockLineStatus = 'added' | 'customise' | 'variant_required' | 'unavailable' | 'failed' | 'over_limit';

export interface AppBlockLineOutcome {
  /** Position of the line in the array given to `addLines`. */
  index: number;
  status: AppBlockLineStatus;
  product_id: string;
  variant_id: string | null;
  /** The product's title when it was read, for naming the line in a notice; else `null`. */
  title: string | null;
  /** True when the line carried `properties`, which the kit never writes to the cart. */
  properties_dropped?: true;
}

/** The result of one press. */
export interface AddAppBlockLinesResult {
  /** Lines added to the cart (not units). */
  added: number;
  /** One entry per given line, in order. */
  outcomes: AppBlockLineOutcome[];
  /**
   * True only when there is at least one line and every one was `added`. Say
   * "added" to the shopper only when this is true; otherwise name what was not
   * added from `outcomes`.
   */
  complete: boolean;
  /**
   * True when a line that was added carried `properties` the kit did not write
   * to the cart (it writes none in this version). A renderer whose app relies on
   * them should say so instead of reporting a plain success.
   */
  propertiesDropped: boolean;
}
