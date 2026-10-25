'use client';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

type GtagParams = Record<string, unknown>;

/**
 * Pushes to `dataLayer` rather than calling `window.gtag()` directly — this
 * queues correctly even before gtag.js has finished loading (the same
 * mechanism the inline bootstrap snippet in the storefront's analytics host
 * relies on), so callers never need to guard on load order.
 *
 * It MUST push the function's `arguments` object, never an array built from it.
 * gtag.js only processes `arguments` objects found on `dataLayer`; Google's own
 * snippet is `function gtag(){dataLayer.push(arguments);}` for exactly that
 * reason, and a plain array is silently ignored (the event is never sent). That
 * is why this is a non-arrow `function` with no rest parameter: the overloads
 * below carry the types, and the implementation forwards `arguments` untouched.
 */
export function gtagPush(command: 'js', date: Date): void;
export function gtagPush(command: 'config', targetId: string, params?: GtagParams): void;
export function gtagPush(command: 'set', params: GtagParams): void;
export function gtagPush(command: 'event', eventName: string, params?: GtagParams): void;
export function gtagPush(command: 'consent', action: 'default' | 'update', params: GtagParams): void;
export function gtagPush(): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params -- gtag.js reads only `arguments` objects (see above)
  window.dataLayer.push(arguments);
}
