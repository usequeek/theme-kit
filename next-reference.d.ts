/**
 * Pulls in Next.js's own published global types (RequestInit.next, image
 * types, …) from the `next` PEER dependency — the same
 * `/// <reference types="next" />` every Next app gets via next-env.d.ts.
 *
 * The kit runs inside Next apps, so depending on Next's own type package is
 * correct. Depending on the storefront's next-env.d.ts (as the kit implicitly
 * did before extraction — the file the kit free-rode on when 0.1.0 shipped
 * broken) is what must never happen again. This file is that dependency,
 * written down.
 */
/// <reference types="next" />
