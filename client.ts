'use client';

/**
 * The client half of the public theme surface — hooks, stores and components.
 * See ./index.ts for why this is split.
 */

export * from './provider';
export * from './page-renderer';
export * from './edit-mode';
export * from './theme-variant-resolver';
export * from './shared-blocks';
export * from './components/blog';
export * from './components/image';
export * from './components/product-metafields';
export * from './components/powered-by-queek';
export * from './components/default-metaobject-page';
export * from './components/product-media-frame';
export * from './components/variant-picker';
export * from './components/auth/auth-flow';
export * from './components/cart/default-cart-shell';
export * from './components/cart/cart-panel-controller';
export * from './components/checkout/default-checkout-shell';
export * from './components/checkout/checkout-contact';
export * from './components/checkout/policy-links';
export * from './apps/follow-card';
export * from './apps/subscribe-form';
export * from './api/collections';
export * from './api/orders';
export * from './hooks/use-href';
export * from './hooks/use-auth';
export * from './hooks/use-cart';
export * from './hooks/use-shop-cart';
export * from './hooks/use-products';
export * from './hooks/use-product-detail';
export * from './hooks/use-product-sections';
export * from './hooks/use-related-products';
export * from './hooks/use-categories';
export * from './hooks/use-collection-params';
export * from './hooks/use-shop';
export * from './hooks/use-shop-params';
export * from './hooks/use-search';
export * from './hooks/use-posts';
export * from './hooks/use-reviews';
export * from './hooks/use-variant-selection';
export * from './hooks/use-address-autocomplete';
export * from './hooks/use-resolve-coordinates';
export * from './stores/cart-panel-store';
export * from './stores/product-modal-store';
export * from './stores/search-modal-store';
export * from './stores/orders-sheet-store';
export * from './stores/location-store';
export * from './stores/address-modal-store';
export * from './stores/auth-modal-store';
export * from './stores/cart-store';

// Mounting a theme — the piece a theme developer cannot build without.
export * from './theme-mount';
export * from './theme-context';
