# Changelog

All notable changes to `@usequeek/theme-kit`. See the README for the versioning
policy. Versions before this file started are in the git tags.

## 0.1.31 - 2026-10-24

### Added

- Markets (a store's published countries-and-currency sets): `MarketSwitcher` (one select: the store's own
  currency plus each published market), `useMarkets()` and `useDisplayCurrency()`. The `StorefrontProvider`
  takes `markets` and `market` (the host resolves both) and renders nothing market-related when a store has no
  published market. The choice is explicit and stored in a per-store cookie; choosing reloads the page so every
  price is in the new currency.
- The browser transports (`createBrowserClient`, `getQueekClient`) send `?market=<id>` on priced store calls
  (reads, cart, quote, order), never on the in-store QR channel. `createServerStoreClient` does the same from the
  market cookie and takes those reads out of the shared data cache.
- `asMarketRefusal(error)` reads the market refusal codes (`market_rate_changed` with its fresh market block and
  quote, `market_unavailable`, `market_payment_unavailable`, `market_price_unusable`, ...).
- `ThemeManifest.marketSwitcher: 'theme'`, like `languageSwitcher`.
- `CartPanelController` hands `currency` as the shopper's display currency.

## 0.1.25 - 2026-10-14

### Packaging

- The customer SDK moved to the Queek scope: the peer dependency is now
  `@usequeek/client-sdk` `^0.4.0` (was `@queekai/client-sdk`, which is deprecated).
  Install `@usequeek/client-sdk` alongside the kit and remove `@queekai/client-sdk`.

## 0.1.24 - 2026-10-12

### Added

- `ApiRequestError` and `ApiTimeoutError` carry a stable `code` (`unauthenticated`,
  `forbidden`, `not_found`, `rate_limited`, `client_error`, `server_error`,
  `timeout`) and a `retryable` flag. `ApiRequestError` also carries `requestId`,
  `retryAfterSeconds` and `detail`. Their messages say what happened and what to do
  next, and never include the query string.
- The fetching hooks (`useProducts`, `useProductBySlug`, `useShop`, `usePosts`,
  `useReviews`, `useProductQuestions`, `useCategories`, `useRelatedProducts`,
  `useProductDetail`) return an `error` field (`Error | null`).
- One warning, in production builds only, when `QUEEK_API_URL` is not set.
- JSDoc with examples on the hooks, providers, clients, stores and the main
  components.

### Fixed

- `useProducts` and `useShop` no longer leave an unhandled promise rejection when
  the request fails.
- Slugs and ids are URL-encoded when they are placed in a request path
  (products, collections, related products, questions, orders).
- Google sign-in no longer logs the sign-in URL or the response body.
- Hook errors raised outside a provider name the missing provider and the fix.

### Packaging

- The published package no longer contains `tests/` or `scripts/`.
- Peer dependency `@queekai/client-sdk` is `^0.3.1 || ^0.4.0` (was `*`); `engines.node` is
  `>=22`; `bugs`, `homepage`, `author` and `keywords` are set; releases publish
  with npm provenance.
- The licence names the legal entity, Queekx Technology LTD.
