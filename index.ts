/**
 * The public surface a theme is allowed to build against.
 *
 * The package is `@usequeek/theme-kit`: what a theme is built AGAINST.
 *
 * Themes import the kit through deep paths (`@usequeek/theme-kit/hooks/use-cart`).
 * These two barrels name which of those paths are API, so the boundary is written
 * down. Anything NOT re-exported here is the kit's own plumbing and may change
 * without notice.
 *
 * Two entries because the split is real, not cosmetic: this one is types and
 * pure functions, importable from anywhere including node tooling; `client.ts`
 * is React state and components and needs a client boundary at the consumer.
 * Core also holds one `next/headers` caller, which belongs in neither and is
 * deliberately unreachable from both.
 *
 * THESE ARE A DECLARATION, NOT AN IMPORT PATH. Do not migrate themes onto them.
 * Pointing a theme's files at `client.ts` fails the build outright: tooling that
 * imports theme components under tsx (a theme registry generator, for example)
 * would reach a gallery block through the barrel, which transitively pulls the
 * SDK, and the SDK does not resolve outside a bundler. It is the same reason a barrel would bloat every
 * theme chunk: the stores call `create()` at import time and package.json
 * declares no `sideEffects`, so webpack must treat every re-export as live and
 * cannot drop the unused ones. Themes keep importing the exact module they use;
 * these barrels stay the machine-checkable statement of what is in the public
 * surface.
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
export * from './utils/locale';

// Theme strings — the pure/server-safe i18n core (no next/*, no React).
export * from './strings/theme-strings';
// Pseudo-locale QA — dev/test-only dictionary transform + English-leak scan
// (pure/server-safe: no next/*, no React, so Node tooling can import it too).
export * from './strings/pseudo-locale';

// Rendering a theme's own demo.json — what makes local preview possible.
export * from './demo';
