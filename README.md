# @queek/theme-kit

The framework a Queek storefront theme is built against: hooks, stores, headless
flows (auth, cart, checkout), types and the block renderer.

**Ships TypeScript source, not a build.** 78 of its 118 modules carry a
`'use client'` directive, and that directive is the whole contract with the React
Server Components boundary — bundlers routinely strip or hoist it when a library
is pre-compiled, which turns a client module into a server one silently. The
consumer transpiles instead (`transpilePackages: ['@queek/theme-kit']`), so the
directives survive to the bundler that actually enforces them.

Resolution relies on `moduleResolution: bundler`; the `./*` export is
extensionless so one pattern covers `.ts`, `.tsx` and `.css`.

## Use

```ts
import { useCart } from '@queek/theme-kit/hooks/use-cart';
import type { ThemeModule } from '@queek/theme-kit/types/theme';
```

Deep paths, mirroring the old `@/lib/core/*`. Barrels exist (`.` and `./client`)
to DECLARE the public surface — what a theme is allowed to build against — but
importing through them pulls every client module into one chunk and was measured
to break the app's build. Import the module you want.

## Boundary

The kit must never import the storefront app, its themes, or `lib/storefront`.
That one-way rule is enforced by `tests/core-storefront-boundary.test.ts` in the
storefront repo, and it is why this package can be extracted at all.
