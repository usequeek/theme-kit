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

What this means for themes: nothing to handle for the content itself. Never
read the header and never append `locale` yourself — locale routing and
`basePath` prefixing are core-owned in the storefront, and links built from
`basePath` keep their locale prefix with zero theme changes. To let shoppers
change language, place the kit's `LanguageSwitcher` (next section); do not
build your own URL logic.

## Language switcher

A store can serve several languages. Its default language lives at the store
root; every other language, English included when it is not the default, lives
under its bare lower-case code (`/fr`, `/en`, `/zh-cn`). Changing language
keeps the page, the query string and the hash.

```tsx
import { LanguageSwitcher } from '@usequeek/theme-kit/components/language-switcher';

<LanguageSwitcher variant="menu" />                  // button + popover (sheet on phones) — recommended
<LanguageSwitcher variant="menu" side="top" />       // a footer: opens upward
<LanguageSwitcher variant="inline-list" />           // every language as a link (footer, up to four)
<LanguageSwitcher />                                 // native <select> — legacy
```

Place it unconditionally, in the header or the footer: it renders nothing on a
single-language store, outside a storefront, and until the host passes the
store's languages.

| Prop | Default | |
| --- | --- | --- |
| `className` | | Extra class on the root, to position or restyle it. |
| `variant` | `'select'` | `'menu'`: a trigger button and a list of language links (below). `'inline-list'`: a link per language that wraps on narrow screens. `'select'`: one native dropdown, **legacy** — it works and is unchanged, but its open list is the operating system's menu and cannot be styled; prefer `menu`. |
| `side` | `'bottom'` | `menu` only. `'top'` opens above the trigger, for footers. Flips by itself when the preferred side does not fit. |
| `align` | `'end'` | `menu` only. Line the popover up with the trigger's inline `'end'` or `'start'` edge (mirrors in right-to-left). Flips and shifts to stay inside the viewport. |
| `showNativeName` | `true` | Label languages in their own language (`Français`) instead of English (`French`). |
| `showCode` | `false` | Show the language code (`FR`) next to the name. |
| `children` | | Render-prop `(state) => ReactNode`: replaces the default control entirely (never called on a single-language store). `state` is `useLocales()` plus `label`, `labelFor(locale)`, `displayName(locale)`, `open` and `setOpen`. |

### The `menu` variant

A real `<button>` opens a list of language **links** (`<a href>` built from the
current page, so open-in-new-tab and copy-link work). On screens wider than
640px it is a popover under the trigger; below 640px it becomes a bottom sheet
with a scrim, safe-area padding, and page scroll locked while it is open. The
wide/narrow layout switch is CSS only (one media query), so the markup is the
same on both and server and client agree; JavaScript only consults the media
query while the menu opens, to lock scroll and to place the popover.
With more than four languages in a footer, use `menu` with `side="top"` rather
than `inline-list`. 2 to 20 languages are fine: the list scrolls past about
eight rows, and a long list can use two columns on wide screens (below).

It is the *disclosure* pattern, not a listbox, because choosing an item
navigates: the button has `aria-expanded` and `aria-controls` and the name
"Language: English"; the list is a `<ul>` labelled by its title; the current
language's link has `aria-current="true"`; there are no `option` roles.

| Key | |
| --- | --- |
| Enter, Space, ArrowDown on the button | Open, focus on the current language |
| ArrowUp on the button | Open, focus on the last language |
| ArrowDown / ArrowUp in the list | Next / previous link (wraps) |
| Home / End | First / last link |
| Typing letters | Jump to the language whose name or code starts with them (500 ms buffer) |
| Enter on a link | Follow it (native); Space does the same |
| Escape | Close and return focus to the button |
| Tab | Close the menu |
| Click outside, scrim tap | Close |

Only the focused link is in the tab order (roving tabindex), so Tab leaves the
list and closes it. Choosing a language closes the menu, returns focus to the
button and navigates (a modified click — new tab, copy link — is left to the
browser). Motion respects `prefers-reduced-motion` (an 80 ms fade only).

**Styling surface.** Every part has a class and a `data-part` attribute; the
root also carries state attributes:

| Part | Class | `data-part` |
| --- | --- | --- |
| Root | `qn-lang qn-lang--menu` | `data-qn-language-switcher`, `data-variant="menu"` |
| Trigger button | `qn-lang__trigger` | `trigger` |
| Trigger name / code / chevron | `qn-lang__trigger-label` / `__trigger-code` / `__chevron` | `trigger-label` / `trigger-code` / `chevron` |
| Scrim (sheet) | `qn-lang__scrim` | `scrim` |
| Popover / sheet | `qn-lang__popover` | `popover` |
| Sheet grabber | `qn-lang__handle` | `handle` |
| Group label | `qn-lang__title` | `title` |
| List / item | `qn-lang__options` / `__item` | `list` / `item` |
| Link (current: `aria-current="true"`, `data-current="true"`) | `qn-lang__option` | `option` |
| Name / code / current marker | `qn-lang__name` / `__code` / `__mark` | `name` / `code` / `mark` |

Root attributes: `data-state="open|closed"`, `data-side="bottom|top"`,
`data-align="start|end"`, `data-mode="popover|sheet"` (while open),
`data-count="<n>"`, `data-many="true"` (more than ten languages),
`data-show-code="true"`. The code spans are always rendered and hidden by
default, so a theme can show a code-only trigger with
`.my-header [data-part='trigger-label'] { display: none }` plus
`.my-header [data-part='trigger-code'] { display: inline }`.

| Variable | Default | Controls |
| --- | --- | --- |
| `--qn-lang-surface` | `--qn-surface` | popover / sheet background |
| `--qn-lang-ink` | `--qn-text` | text colour |
| `--qn-lang-muted` | `--qn-text-muted` | title and code colour |
| `--qn-lang-border` | `--qn-border` | hairlines |
| `--qn-lang-radius` | `--qn-radius-md` (8px) | trigger / popover corners |
| `--qn-lang-item-radius` | `--qn-radius-sm` (6px) | link corners |
| `--qn-lang-item-hover` / `--qn-lang-current-bg` | 6% ink / none | hover and current-link backgrounds |
| `--qn-lang-accent` | `--qn-accent` | current marker colour |
| `--qn-lang-focus` | `--qn-focus` | focus ring |
| `--qn-lang-shadow` | subtle | popover shadow |
| `--qn-lang-row-height` / `--qn-lang-sheet-row-height` | 44px / 52px | link height (popover / sheet) |
| `--qn-lang-gap` / `--qn-lang-pad` | 0 / 4px | space between links / inside the popover |
| `--qn-lang-offset` | 8px | gap between trigger and popover |
| `--qn-lang-popover-width` | 240px | popover width |
| `--qn-lang-many-width` / `--qn-lang-many-columns` | popover width / 1 | width and columns when `data-many="true"` (set `--qn-lang-many-columns: 2` and a wider width for two columns) |
| `--qn-lang-list-max` | 8.5 rows | height at which the list scrolls |
| `--qn-lang-sheet-radius` | 16px | sheet top corners |
| `--qn-lang-scrim` | 40% black | scrim colour |
| `--qn-lang-z` | 50 | z-index |
| `--qn-lang-duration` / `--qn-lang-ease` | 160ms / ease-out curve | open motion |

Each variable falls back to the matching `--qn-*` token, then a neutral
value, and is never set by the kit itself — set it on the root, on an
ancestor, or on `:root`. The sheet breakpoint (640px) is fixed.

Restyling recipe — no override of internals needed:

```css
.site-header [data-qn-language-switcher] {
  --qn-lang-surface: #f3f0e9;
  --qn-lang-ink: #1b2029;
  --qn-lang-radius: 0;
  --qn-lang-item-radius: 0;
  --qn-lang-popover-width: 280px;
  --qn-lang-sheet-radius: 0;
  --qn-lang-duration: 120ms;
}
.site-header [data-part='trigger'] { border: 0; letter-spacing: 0.12em; text-transform: uppercase; }
.site-header [data-part='option'][aria-current='true'] { font-style: italic; }
```

**Tell the storefront the theme places it.** Set `languageSwitcher: 'theme'` in
the theme manifest. Without it the storefront keeps rendering its own floating
language control next to yours; with it the storefront renders none and the
shopper sees exactly one.

```ts
// in the theme module
manifest: { /* … */ languageSwitcher: 'theme' }   // ThemeManifest.languageSwitcher
```

**Fully custom markup.** `useLocales()` (from
`@usequeek/theme-kit/hooks/use-locales`) returns:

| Field | |
| --- | --- |
| `locales` | The store's languages, default first. One entry, or none, on a single-language store. |
| `active` | The language the page renders in. |
| `defaultLocale` | The language served at the store root. |
| `hasMultiple` | `locales.length > 1`. |
| `hrefFor(locale)` | The current page in another language (takes a row or a code), e.g. `/fr/shop?sort=new`. The first render carries no query string or hash, so server and client markup match; they are added right after mount. |
| `switchTo(locale)` | Navigate to it, reading the live query string and hash. Use it for `onClick`/`onChange`. |

Each language is `{ locale, name, native_name, is_primary, is_default,
path_prefix, hreflang, html_lang, dir }`. Use `lang={l.html_lang}` and
`dir={l.dir}` on a label written in that language. The pure URL rules are also
exported (`localeHref`, `normalizeStoreLocales`, `defaultStoreLocale`,
`resolveActiveLocale` from `@usequeek/theme-kit/utils/locale-switch`).

**Strings.** `language.label` ("Language") names the control and
`language.named` ("Language: {name}") names the select and the current
language. Both are kit core strings with English defaults; a theme can
override them in its manifest `strings`, and merchants and translators in
their locale packs.

**Styling.** The default control reads only these tokens, each with a neutral
fallback, and uses logical properties, so it mirrors in right-to-left
storefronts and sits in a header or footer unstyled:

| Token | Used for | Fallback |
| --- | --- | --- |
| `--qn-text` | text and icon colour | inherited |
| `--qn-border` | select border | 22% of the text colour |
| `--qn-border-strong` | select border on hover | the text colour |
| `--qn-surface` | select background | transparent |
| `--qn-radius-sm` | corner radius | `6px` |
| `--qn-focus` | focus ring | the text colour |

Class names for deeper overrides: `qn-lang`, `qn-lang--select`,
`qn-lang--inline-list`, `qn-lang__select`, `qn-lang__list`, `qn-lang__link`.
Targets are at least 44px. The root carries `data-qn-language-switcher`.

**Host side.** The host passes the store's languages to
`StorefrontProvider` as the optional `locales` prop (the rows as it already
holds them; extra fields are ignored, and a row without `is_default` falls
back to `is_primary`). `basePath` must already carry the active language
prefix, as in the Locales section. No prop, or one language: no switcher, and
everything behaves as before.

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
