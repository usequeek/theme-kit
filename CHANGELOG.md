# Changelog

All notable changes to `@usequeek/theme-kit`. See the README for the versioning
policy. Versions before this file started are in the git tags.

## Unreleased

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
- Peer dependency `@queekai/client-sdk` is `^0.3.0` (was `*`); `engines.node` is
  `>=22`; `bugs`, `homepage`, `author` and `keywords` are set; releases publish
  with npm provenance.
- The licence names the legal entity, Queekx Technology LTD.
