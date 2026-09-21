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

## Boundary

The kit must never import the storefront app, its themes, or `lib/storefront`.
That one-way rule is what makes this package extractable at all.

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
