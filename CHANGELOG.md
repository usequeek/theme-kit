# Changelog

All notable changes to `@usequeek/theme-kit`. See the README for the versioning
policy. Versions before this file started are in the git tags.

## Unreleased

### Added

- Line text. An app can ask the shopper for text on a product (for example an
  engraving). The line text store (`useLineTextStore` in `stores/line-text-store`)
  has `registerLineText`, `setLineText` and `clearLineText` actions that hold what
  the shopper typed for the product on screen; nothing is persisted or sent anywhere
  by the store itself. `addProduct` and `addItemWithAddons` write the cleaned text on
  the new cart line as `properties` with its labels in `property_labels`, refuse a
  required field left blank with an "Add your {label} before adding to cart" toast,
  and keep lines with different text apart. Text made only of spaces or invisible
  characters counts as blank. A line without text keeps exactly the id and shape it
  had before.
- `makeItemId` takes an optional fourth argument, the line's text properties.
- `CartItem.properties` and `CartItem.property_labels` (both optional).
- `visibleLineProperties` (from `utils/line-properties`) returns the rows of line
  text that may be shown: only keys that carry a label, with a non-blank text value.
  The default cart page shows them under the product title.

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
