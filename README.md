# @usequeek/theme-kit

The framework a Queek storefront theme is built against: hooks, stores, headless
flows (auth, cart, checkout), types and the block renderer. See the
[theme documentation](https://docs.usequeek.com/docs/themes) for how themes
work end to end.

## Install

```bash
npm install @usequeek/theme-kit
```

Peer dependencies: `next` (>=15), `react` and `react-dom` (>=19) and
`@queekai/client-sdk`.

The package ships TypeScript source, not a build. Most modules carry a
`'use client'` directive, and that directive is the whole contract with the
React Server Components boundary; bundlers routinely strip or hoist it when a
library is pre-compiled, which silently turns a client module into a server
one. The consumer transpiles the package instead, so the directives reach the
bundler that enforces them:

```ts
// next.config.ts
export default { transpilePackages: ['@usequeek/theme-kit'] };
```

Compiling a theme against it needs `moduleResolution: bundler` and
`jsx: react-jsx`. A vitest setup that renders kit components needs the package
inlined (`server.deps.inline: ['@usequeek/theme-kit']`) so the shipped `.tsx`
source is transformed like first-party code.

## Use

```ts
import { useCart } from '@usequeek/theme-kit/hooks/use-cart';
import type { ThemeModule } from '@usequeek/theme-kit/types/theme';
```

Import the module you need by its deep path. The barrels (`.` and `./client`)
declare the public surface, meaning what a theme is allowed to build against,
but importing through them pulls every client module into one chunk and can
break an app's build.

There is no `exports` map: with source-shipped `.ts`/`.tsx`, an extensionless
wildcard target does not resolve, so subpaths resolve off the filesystem under
`moduleResolution: bundler`. The package therefore has no subpath
encapsulation; what a theme may import is the surface the barrels declare,
checked by `tests/public-surface.test.ts`.

Theme CSS ships with the package: `@usequeek/theme-kit/shared-blocks/core-blocks.css`
(framework-owned blocks), plus per-component CSS next to its component
(`components/variant-picker.css`, `apps/apps.css`).

## Theme strings

The kit's UI-string mechanism (`strings/theme-strings.ts`; pure, with no
`next/*` and no React). A theme or provider that passes nothing renders in
English. See also [Translating your theme](https://docs.usequeek.com/docs/themes/translations).

- **Authoring contract.** `t(dictionaries, key, vars?, locale?)`: dot-path
  lookup (`cart.title`), `{var}` interpolation (`{{`/`}}` escape to literal
  braces; a missing var keeps its `{placeholder}`), CLDR plurals via
  `Intl.PluralRules` — a key holding `{ one, two, few, many, other }`
  (nested, or flat `key.one` … `key.other` suffix keys) selects by
  `vars.count`, defaulting to `other`. Locale-aware `formatThemeNumber`,
  `formatThemeDate` and `formatThemeMoney` replace hardcoded `en-GB`
  formatting; an unknown locale falls back to English. Keys are dotted
  lowercase `scope.thing.state`, max **40 chars**; values max **1000 chars**.
  Merchant overrides are stored as `<theme-slug>.<key>` in a 64-character
  field, so the key budget leaves 23 chars for the slug plus the dot.
- **Two surfaces.** Server (provider-free): the host supplies per-locale
  loaders and calls
  `createThemeStrings({ locale, loaders })` — `{ override, theme, core }`,
  each `(locale) => Promise<dict | null>` — usually a per-locale dynamic
  `import()` with a try/catch returning null when the file is absent — then
  passes the bound `t` via props/closure. A throwing loader simply drops
  out of the chain.
  Client: `<StorefrontProvider strings={…}>` (optional, no-op when absent)
  plus `useThemeStrings()` returning the same bound `t`; works inside
  `ThemeMount`. The kit ships `locales/en.default.json` (cart, checkout,
  auth, blog) as the last-resort English default.
- **Fallback.** Ordered dictionaries (merchant override → host-loaded
  locale dictionaries → `manifest.strings` → kit core English default);
  first hit wins. The last fallback is the English default *value* —
  never the raw key, never "translation missing". Absent everywhere
  renders `""` (and warns once per key in development only — an empty
  string would otherwise leak internal key names into the UI).
- **Theme English travels with the theme.** A theme ships its own English
  defaults in its manifest: `import strings from './locales/en.default.json'`
  inside the theme, then `manifest: { …, strings }` (`ThemeManifest.strings`,
  ENGLISH ONLY — never other locales). `useThemeStrings()` layers it
  between the host's `strings` prop and the kit core English, so hosts that
  mount a theme with no `strings` (e.g. theme previews) still render the
  theme's English with zero host cooperation. Host dictionaries always win
  where present; keys missing there fall back to manifest English, never
  to `""`.
- **Per-locale loading.** `createThemeStrings` reads ONLY the active
  locale's dictionaries, and the host passes ONLY that locale to the
  provider — other `{lang}.json` files never enter the client bundle.
  Only `locales/en.default.json` may be statically imported (by
  `strings/theme-strings.ts` itself); every other locale arrives via the
  host's dynamic `import()` per locale.
- **Typed keys (optional, compile-time).** A theme opts in per call site —
  untyped `t(key)` callers keep compiling unchanged.
  `ThemeStringKey<typeof strings>` derives the key union from the theme's
  English dictionary object (nested objects flatten to dotted keys, a
  plural map counts as ONE key, flat literal dotted keys stay one key),
  and `createThemeT` binds it to any `t`:

  ```ts
  import enDefault from './locales/en.default.json';
  import { createThemeT } from '@usequeek/theme-kit/strings/theme-strings';

  const { t } = await createThemeStrings({ locale });
  const tt = createThemeT<typeof enDefault>(t); // server …
  // … or client: const tt = createThemeT<typeof enDefault>(useThemeStrings());
  tt('cart.title'); // ok
  // tt('cart.titl'); // type error — typo keys fail, valid keys pass
  ```

- **Pseudo-locale QA (dev/test only, never shipped).**
  `pseudoLocalize(dictionary, options?)`
  (`strings/pseudo-locale.ts`, pure: no `next/*`, no React) returns a
  pseudo dictionary with identical keys and plural-map shape — every
  value accent-mapped, ~30% longer, wrapped in `[!! … !!]` markers —
  while `{placeholders}` and `{{`/`}}` escapes pass through and keys are
  never touched. Use it two ways. As a dev-only locale, mount with the
  pseudo dictionary as the `strings` prop: everything that went through
  `t()` renders pseudo, so any text that remains plain English next to
  pseudo text is a hard-coded (un-wrapped) string. In tests, render with
  the pseudo dictionary and run the English-leak scan over the HTML:

  ```tsx
  import { pseudoLocalize, assertNoEnglishLeak } from '@usequeek/theme-kit/strings/pseudo-locale';

  const pseudo = pseudoLocalize(enDefault, { rtl: true }); // spot-check RTL too
  const html = renderToStaticMarkup(
    <StorefrontProvider vendor={…} config={…} menus={[]} strings={pseudo}>
      <MySection />
    </StorefrontProvider>,
  );
  assertNoEnglishLeak(html, { allowlist: ['Queek'] }); // throws on any plain-English node
  ```

  `findEnglishLeaks(html, { allowlist, includeAttributes })` returns the
  offending node texts instead of throwing; the scan covers visible text
  nodes plus `aria-label`/`placeholder`/`title`/`alt` (opt out with
  `includeAttributes: false`). Pseudo dictionaries are built on demand
  in dev/test and never enter a client bundle.

## Locale-aware dates, numbers and relative time

Dates, counts, money and relative time follow the SHOPPER's locale. English
renders in the British/Nigerian style — `2 October 2026`, never US
`October 2, 2026`.

- **One mapping.** `resolveIntlLocale(locale)` (`utils/locale.ts`, pure: no
  `next/*`, no React) is the single canonical storefront-code → Intl-locale
  mapping every formatter goes through. Missing/invalid codes and every
  English variant (`en`, `en-GB`, `en-NG`, `en-US`, …) become `en-NG`;
  everything else passes through (`fr`, `ar`, `pt-BR`, `zh-CN`, `yo`, `ha`,
  `sw`, …). `en-NG` — not `en-GB` — because it renders NGN as `₦12,500`
  where `en-GB` renders `NGN 12,500` (both print dates as `2 October 2026`;
  checked on Node 22 with full ICU). `resolveSupportedLocale` falls back to
  English when the runtime's ICU lacks a locale — formatting never throws.
- **What themes call.** `formatThemeDate(value, locale?, options?)`
  (`strings/theme-strings.ts`) instead of a hardcoded-`'en-GB'`
  `toLocaleDateString`: pass the storefront locale — client components via
  `useStorefrontLocale()`, server components via the request locale the host
  already holds. Siblings: `formatThemeNumber`, `formatThemeMoney`, and
  `formatThemeRelativeTime(-1, 'day', locale)` (`hier`, `أمس`, `ontem`, …,
  `numeric: 'auto'`). `formatThemeMoney` uses the currency's default
  decimals (`₦5,000.00`); `formatMoney` shows decimals only when present
  (`₦5,000`, `₦0.28`). The fixed-zone display path is `formatShopperDate`
  (`utils/format.ts`, Africa/Lagos, `''` for invalid dates);
  `formatCount`/`formatMoney` take an optional locale, defaulting to English
  output. `PostMeta` (`components/blog/post-meta.tsx`) renders its byline
  through the provider locale.
- **Fallbacks.** Unknown locale → English style; invalid date → `''`;
  minimal-ICU runtimes render English rather than throwing.
- **Plural selection stays separate.** `canonicalThemeLocale`
  (`strings/theme-strings.ts`) is for `t()` plural selection ONLY: it returns
  a bare `'en'` tag, which is a US-order Intl tag. Never pass it to a date,
  number, money or relative-time formatter — formatters use
  `resolveIntlLocale` (en* → `en-NG`) instead.

```tsx
import { useStorefrontLocale } from '@usequeek/theme-kit/provider';
import { formatThemeDate } from '@usequeek/theme-kit/strings/theme-strings';

const locale = useStorefrontLocale(); // null on the primary (English) locale
formatThemeDate(post.published_at, locale, { year: 'numeric', month: 'long', day: 'numeric' });
// en → "2 October 2026" · fr → "2 octobre 2026" · ar → "2 أكتوبر 2026"
```

## Consumers

- **Queek storefronts** install this package from npm
  (`"@usequeek/theme-kit": "^x.y.z"`) and transpile it via
  `transpilePackages`.
- **Theme developers** start from
  [`usequeek/theme-starter`](https://github.com/usequeek/theme-starter), which
  builds against this package.

## Custom data: metafields & metaobjects

Product pages receive custom data already resolved — never fetch it:

```tsx
import { ProductMetafields } from '@usequeek/theme-kit/components/product-metafields';
import type { ProductPageProps } from '@usequeek/theme-kit/types/theme';

export default function ProductPage({ product, metafieldDefinitions }: ProductPageProps) {
  return <ProductMetafields product={product} definitions={metafieldDefinitions} />;
}
```

- MUST: place `<ProductMetafields product definitions={metafieldDefinitions} />`
  on the product page. `product.metafields` (`types/product.ts`) arrives as
  presented values — a scalar, scalar list, `MetaobjectEntry`, or
  `MetaobjectEntry[]`; labels come via `metafieldDefinitions` (unknown keys
  fall back to a humanised key). The component renders nothing when there is
  nothing visible to show.
- MAY: compose your own layout with the exported `EntryCard` and `renderValue`
  from the same module instead of placing the section.
- Style only: the section emits `core-metafields*` classes (`core-metafields`,
  `__field`, `__label`, `__value`, `__text`, `__link`, `__image`, `__pre`,
  `__list`, `__list-item`, `__entry-card`, `__entry-title`, `__entry-field`,
  `__entry-field-label`, `__entry-field-value`, `__entry-grid`);
  `DefaultMetaobjectPage` emits `core-metaobject-page*`. No kit CSS ships for
  these — style them in your theme.
- The `metaobjects` section block (`shared-blocks/metaobjects`,
  framework-owned) renders a merchant-picked type's entries when the page
  supplies its data; it emits `core-block-metaobjects` with `--grid`/`--list`
  modifiers, `core-block-metaobjects__list` with `--grid`/`--list` variants,
  plus `__title` and `__card-link`. Never re-implement it — style the classes.
- Optional entry pages: provide `pages.Metaobject: FC<MetaobjectPageProps>`
  (`entry` plus `definition { type; name; fields: [{ key; name; type }] }`).
  When absent, core `DefaultMetaobjectPage`
  (`components/default-metaobject-page`) is used.
- Dynamic sources (`$source` refs) resolve server-side; block data always
  reaches the theme as literals — nothing to handle.

## App blocks slot

Product pages render merchant-placed app blocks through the slot — never app
code:

```tsx
import { AppBlocks } from '@usequeek/theme-kit/apps';

export default function ProductPage({ product }: ProductPageProps) {
  return <AppBlocks target="product" productId={product.slug} />;
}
```

- MUST: place `<AppBlocks target="product" productId={...} />` on the
  product page. `target` is product-only: no other slot exists.
  `productId` scopes availability reads and deep links to the shown product;
  omit `vendorSlug` (the host resolves the store itself).
- The host registers its placement component once through `AppBlocksProvider`
  (`renderBlocks`); the slot renders whatever the host registered, or nothing
  when no provider is mounted — never an error, never a shifted layout.
- Empty and error states render nothing: a store with no placements ships no
  markup and fires no request; a slow or dead app collapses to its fallback
  and never breaks the page. No app HTML/JS ever reaches the theme — blocks
  are Queek-rendered primitives (date/time/select) plus a deep-link CTA.
- Style only: blocks emit `core-app-block` with `__title`, `__description`,
  `__box`, `__skeleton*`, `__fallback*`, `__field`, `__label`, `__input`,
  `__slots`/`__slot`, `__empty`, `__cta`, `__retry` and `__image` hooks. No
  kit CSS ships for these — style them in your theme.

## Attribution: Powered by Queek

Every theme footer renders the core-owned attribution link:

```tsx
import { PoweredByQueek } from '@usequeek/theme-kit/components/powered-by-queek';

export default function Footer() {
  return (
    <footer>
      {/* ... */}
      <PoweredByQueek />
    </footer>
  );
}
```

- MUST: place `<PoweredByQueek />` on every footer variant (`footers/*.tsx`,
  or `footer.tsx` where a theme has no `footers/` dir). The placement and
  spacing are the theme's — the component is the content, the footer owns
  where it sits. The theme check rule `theme/footer-shows-powered-by`
  ([checks reference](https://docs.usequeek.com/docs/themes/checks)) enforces
  this, so a theme cannot ship without it.
- Style only: the link emits `core-powered-by` with a
  `core-powered-by__brand` hook on the `Queek` wordmark; an optional
  `className` passthrough lets a footer position it (e.g.
  `<PoweredByQueek className="my-footer__powered" />`). No kit CSS ships for
  it — style the classes in your theme.
- The href (`https://usequeek.com/business`), `target="_blank"` and
  `rel="noopener noreferrer"` are the contract — never re-implement the
  markup by hand. The href is tagged for attribution by `poweredByQueekUrl`
  (`utm_source=powered_by&utm_medium=storefront&utm_campaign=<store slug>`,
  campaign omitted when the store has no slug); the component reads the slug
  from the storefront context, so themes pass nothing.
- `hidden` (default false) takes the component's visibility from a prop.
  There is no merchant-facing toggle for it — always render it visible.

## Locales

Customer-facing reads accept `?locale=<code>` and answer translated text
(unknown/unpublished locale → source text, no error). The kit forwards the
request locale on every catalogue/content transport, server and browser:

- Server: `createServerStoreClient().get()` reads the incoming request's
  `x-queek-locale` header (set by the storefront proxy for published
  non-primary locales only — absent on the primary), appends `locale=<code>`
  to the API URL, and suffixes every cache tag with `:locale:<code>` so
  locales never share a cache entry. `fetchShopPrefetch`, `fetchCollections`,
  `fetchCollection` and `fetchCollectionProducts` take the same behaviour plus
  an optional explicit override. No header → byte-identical requests and tags.
- Browser: `StorefrontProvider` takes an optional `locale` prop (the host
  passes its request header through) and `useStorefrontLocale()` exposes it.
  `useShop`, `useProducts`/`useProductBySlug`, `useRelatedProducts`,
  `useProductSections`, `useCategories`, `usePosts`, `useReviews`,
  `useProductQuestions` and `useProductDetail` send `?locale=` when it is set
  and key their client caches by it. No prop → unchanged.

What this means for themes: nothing to handle. Never read the header, never
append `locale` yourself, and never build a language switcher — locale
routing, `basePath` prefixing and the switcher are core-owned in the
storefront. Links built from `basePath` keep their locale prefix with zero
theme changes.

## Links and navigation

```ts
import { Link, useRouter, usePathname } from '@usequeek/theme-kit/navigation';
```

A theme links and navigates through these, never through `next/link` or
`next/navigation`. Which framework runs the storefront is Queek's decision, so
the kit is the one place that knows it, and a framework change is a kit
release, not an update to every theme. `Link` is an `<a>` that moves inside the
store without a full page load (`href`, `prefetch`, `replace`, plus any anchor
attribute); `useRouter()` gives `push`, `replace`, `back` and `refresh`;
`usePathname()` returns the current path. The theme check rejects a theme that
imports `next`.

## Boundary

The kit never imports a host app or any theme. The reverse rule holds for the
framework: the kit may import `next`, a theme may not.

## Develop

```bash
npm install
npm run typecheck       # tsc --noEmit
npm test                # public-text check, then vitest run
npm run verify-package  # pack current source, typecheck a real theme against it
```

`verify-package` packs the current source and typechecks a real theme against
it from a sandbox, so a break that only external consumers would see (for
example a module relying on the global `JSX` namespace, which React 19 removed)
fails here instead of after publishing.

## Release

Publishing runs on tags via `.github/workflows/publish.yml`, which needs the
`NPM_TOKEN` repository secret:

```bash
# 1. Bump version in package.json and commit
# 2. Tag and push the tag — the workflow typechecks, tests, runs verify-package,
#    then `npm publish --access public`:
git tag vX.Y.Z
git push origin main --tags
```

## License

MIT
