# Changelog

All notable changes to `@usequeek/theme-kit`. See the README for the versioning
policy. Versions before this file started are in the git tags.

## 0.1.36 - 2026-10-28

### Changed

- The follow card no longer pre-ticks "share my contact": `shareContact` starts `false`, so following a store shares
  nothing unless the shopper ticks the box, and the label says what is shared and with whom (name, email and phone
  number, with the store). `POST /client/store/follow` still carries `share_contact` explicitly.
- The follow card shows once, where the merchant chose. The shell's `<FollowCard display="floating" />` renders only
  when the setting is `floating` (the retired `block` reads as `floating`); a theme footer's
  `<FollowCard display="inline" />` renders only when it is `footer`. A theme with no footer mount shows the floating
  card instead, so an enabled card is never missing and never doubled. `display` on the component now names the mount,
  no longer overrides the merchant's setting.
- Every word of the card is a theme string (`follow.*` in `locales/en.default.json`, with a CLDR plural for the
  follower count), so it translates with the rest of the storefront.

## 0.1.35 - 2026-10-28

### Fixed

- Signing in no longer signs the shopper straight back out when the store is open in another tab.
  `getQueekClient()` rebuilds its cached SDK client whenever the stored token pair changed since it was
  created (another tab signing in, out, or refreshing writes the same `localStorage` keys). Before, a tab
  whose client predated the sign-in kept sending requests without a token while the user store had already
  synced the signed-in user across tabs; the first such request (the follow card's status check) answered
  401, `triggerReauth` signed the shopper out, and that sign-out synced back to the tab they signed in on.

## 0.1.34 - 2026-10-28

### Fixed

- A merchant's own hero/slideshow slide shows exactly what they typed. `resolveHeroContent(slide, fallback)` no
  longer fills a blank slide title, subtitle or button label with the store name, the slogan or "Shop now": a blank
  field (empty, whitespace, or only zero-width/format characters) comes back as `title: ''`, `subtitle: null`,
  `ctaLabel: ''`, so a busy slide image can stay bare. The store name, slogan and "Shop now" still fill the
  zero-image placeholder hero (`slide` undefined). `ctaHref` and `slideHref` are unchanged. A theme renders the
  heading, subtitle and button only when each is non-empty.

## 0.1.33 - 2026-10-25

### Fixed

- Google Analytics events were never sent. `gtagPush` pushed a plain array onto `dataLayer`, and gtag.js only
  processes `arguments` objects (the shape of Google's own `function gtag(){dataLayer.push(arguments);}`), so every
  storefront event (`view_item`, `search`, `add_to_cart`, `begin_checkout`, `purchase`) and every Consent Mode
  `consent update` made through it was silently dropped. It now pushes the real `arguments` object, with typed
  overloads for `js`, `config`, `set`, `event` and `consent`, and still queues correctly before gtag.js loads.
  Verified in a real browser against the live gtag.js: a `gtagPush('event', 'add_to_cart', ...)` now reaches
  `google-analytics.com/g/collect` with `en=add_to_cart`.

## 0.1.32 - 2026-10-24

### Fixed

- A light button label that fails 4.5:1 on a mid-tone accent (the default theme's white on `#229879`) keeps its
  colour: the fill under it is deepened by the smallest step that reads (at most 25%) and emitted as
  `--brand-accent-fill`. `--brand-accent` is unchanged. A pale accent that would need more still gets a black
  label. Nothing is emitted when the pairing already reads, so existing markup is byte-identical.
- The same rule covers the primary button: `--brand-button-bg` (and its hover) deepens under a light label that
  fails 4.5:1.
- An explicit merchant `button_text` opts out of every deepening: the fill stays the plain accent under it.

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
