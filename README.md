# @usequeek/theme-kit

The framework a Queek storefront theme is built against: hooks, stores, headless
flows (auth, cart, checkout), types and the block renderer.

**Ships TypeScript source, not a build.** Most of its modules carry a
`'use client'` directive, and that directive is the whole contract with the React
Server Components boundary — bundlers routinely strip or hoist it when a library
is pre-compiled, which turns a client module into a server one silently. The
consumer transpiles instead (`transpilePackages: ['@usequeek/theme-kit']`), so the
directives survive to the bundler that actually enforces them.

Deep subpaths resolve off the filesystem — there is deliberately NO `exports`
map. One was tried: with source-shipped `.ts`/`.tsx` an extensionless wildcard
target does not resolve, and spelling out extensions cannot cover both. Legacy
resolution under `moduleResolution: bundler` handles it. The cost is that the
package has no subpath encapsulation, so what a theme may import is enforced by
convention plus tests: `tests/public-surface.test.ts` here (barrels declare
only modules that exist) and `core-public-surface.test.ts` in the storefront
repo (barrels cover every module the themes actually import).

Every module that annotates a return as `JSX.Element` does
`import type { JSX } from 'react'` — React 19 removed the global `JSX`
namespace, and 0.1.0 shipped broken for every external consumer by relying on
the storefront app's `next-env.d.ts` to provide it. `scripts/verify-package.ts`
packs the current source and typechecks a real theme against it from a sandbox,
so that class of breakage fails here instead of after publishing.

## Use

```ts
import { useCart } from '@usequeek/theme-kit/hooks/use-cart';
import type { ThemeModule } from '@usequeek/theme-kit/types/theme';
```

Deep paths, mirroring the old `@/lib/core/*`. Barrels exist (`.` and `./client`)
to DECLARE the public surface — what a theme is allowed to build against — but
importing through them pulls every client module into one chunk and was measured
to break the app's build. Import the module you want.

Theme CSS ships with the package: `@usequeek/theme-kit/shared-blocks/core-blocks.css`
(framework-owned blocks), plus per-component CSS next to its component
(`components/variant-picker.css`, `apps/apps.css`).

## Consumers

- **The Queek storefront** (`usequeek/queek-storefront`) installs this package
  from the npm registry (`"@usequeek/theme-kit": "^x.y.z"`) and transpiles it
  via `transpilePackages`. Its vitest config inlines the package
  (`server.deps.inline: ['@usequeek/theme-kit']`) so the shipped `.tsx`
  source is transformed like first-party code.
- **External theme developers** start from `packages/theme-starter` in the
  storefront repo, which builds standalone against a packed tarball of this
  source. Anyone testing a theme with vitest needs the same `inline` line;
  anyone compiling one needs `moduleResolution: bundler` + `jsx: react-jsx`.

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
  product page. `target` is product-only in phase 1 — no other slot exists.
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

Every storefront is a billboard — every footer variant of every theme renders
the core-owned attribution link:

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
  where it sits. `theme-check` rule `theme/footer-shows-powered-by` enforces
  this, so a theme cannot ship without it.
- Style only: the link emits `core-powered-by` with a
  `core-powered-by__brand` hook on the `Queek` wordmark; an optional
  `className` passthrough lets a footer position it (e.g.
  `<PoweredByQueek className="my-footer__powered" />`). No kit CSS ships for
  it — style the classes in your theme.
- The href (`https://usequeek.com/business`), `target="_blank"` and
  `rel="noopener noreferrer"` are the contract — never re-implement the
  markup by hand.
- `hidden` (default false) takes the component's visibility from a prop as
  the seam for a possible future plan perk. There is no merchant-facing
  toggle for it in v1 — always render it visible.

## Links and navigation

```ts
import { Link, useRouter, usePathname } from '@usequeek/theme-kit/navigation';
```

A theme links and navigates through these, never through `next/link` or
`next/navigation`. Which framework runs the storefront is Queek's decision: the
kit is the one place that knows it, so a change there is a kit release, not an
update to every theme. `Link` is an `<a>` that moves inside the store without a
full page load (`href`, `prefetch`, `replace`, plus any anchor attribute);
`useRouter()` gives `push`, `replace`, `back` and `refresh`; `usePathname()`
returns the current path. The theme check rejects a theme that imports `next`.

## Boundary

The kit must never import the storefront app, its themes, or `lib/storefront`.
That one-way rule is what makes this package extractable at all. The reverse
also holds for the framework: the kit may import `next`, a theme may not.

## Develop

```bash
npm install
npm run typecheck   # tsc --noEmit, standalone — no storefront files
npm test            # vitest run
npm run verify-package  # pack current source, typecheck a real theme against it
```

## Release

The package is public on npm; the repo is private. Publishing runs on tags via
`.github/workflows/publish.yml` (needs the `NPM_TOKEN` secret):

```bash
# 1. Bump version in package.json and commit
# 2. Tag and push the tag — the workflow typechecks, tests, verify-packages,
#    then `npm publish --access public`:
git tag v0.1.6
git push origin main --tags
```

The storefront then bumps its dependency to match the published version
(`yarn add @usequeek/theme-kit@^0.1.6` + lockfile) and pushes separately —
never the other way round: the app must only ever depend on a version that
actually exists on the registry.
