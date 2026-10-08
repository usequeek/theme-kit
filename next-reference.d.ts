/**
 * Pulls in Next.js's own published global types (RequestInit.next, image
 * types, …) from the `next` PEER dependency — the same
 * `/// <reference types="next" />` every Next app gets via next-env.d.ts.
 *
 * The kit runs inside Next apps, so depending on Next's own type package is
 * correct. Depending on a host app's own next-env.d.ts would break every
 * consumer that does not have one. This file is that dependency, written down.
 */
/// <reference types="next" />
