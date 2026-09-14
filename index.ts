/**
 * The public surface a theme is allowed to build against.
 *
 * The package is `@usequeek/theme-kit`: what a theme is built AGAINST, named for
 * the job rather than for our internals — "storefront core" describes where the
 * code lives here, which is meaningless to someone who has never seen this repo.
 *
 * Themes currently import core through deep paths (`@/lib/core/hooks/use-cart`).
 * These two barrels name which of those paths are API — the set that would ship
 * as `@usequeek/theme-kit` — so the boundary is written down before it is
 * published and frozen. Anything NOT re-exported here is core's own plumbing and
 * may change without notice.
 *
 * Two entries because the split is real, not cosmetic: this one is types and
 * pure functions, importable from anywhere including node tooling; `client.ts`
 * is React state and components and needs a client boundary at the consumer.
 * Core also holds one `next/headers` caller, which belongs in neither and is
 * deliberately unreachable from both.
 *
 * THESE ARE A DECLARATION, NOT AN IMPORT PATH. Do not migrate themes onto them.
 * Measured 9/9/26: pointing one theme's 28 files at `client.ts` fails the build
 * outright — `theme:generate-registry` imports theme components under tsx, and
 * through the barrel a gallery block transitively pulls the SDK, which does not
 * resolve outside a bundler. It is the same reason a barrel would bloat every
 * theme chunk: the stores call `create()` at import time and package.json
 * declares no `sideEffects`, so webpack must treat every re-export as live and
 * cannot drop the unused ones. Themes keep importing the exact module they use;
 * when core is published it should expose SUBPATH exports
 * (`@usequeek/theme-kit/hooks/use-cart`) and these barrels stay the
 * machine-checkable statement of what is in the contract.
 */

export * from './types/theme';
export * from './types/block';
export * from './types/product';
export * from './types/cart';
export * from './types/order';
export * from './types/page';
export * from './types/menu';
export * from './utils/format';
export * from './utils/markdown';
export * from './utils/menu-link';
export * from './utils/product-media';
export * from './utils/hero-content';
export * from './utils/addon-selection';
export * from './utils/contact-location';
export * from './utils/benefit-icon';
export * from './utils/video-embed';
export * from './utils/match-variant';
export * from './utils/announcement';

// Rendering a theme's own demo.json — what makes local preview possible.
export * from './demo';
