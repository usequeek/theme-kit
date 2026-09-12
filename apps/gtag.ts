'use client';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Pushes straight to `dataLayer` rather than calling `window.gtag()` directly —
 * this queues correctly even before gtag.js has finished loading (the same
 * mechanism the inline bootstrap snippet in analytics.tsx relies on), so
 * callers never need to guard on load order.
 */
export function gtagPush(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}
