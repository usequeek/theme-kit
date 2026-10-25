// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { gtagPush } from '../apps/gtag';

const tag = (value: unknown): string => Object.prototype.toString.call(value);

/**
 * gtag.js's consumer rule, as Google documents it: the page snippet is
 * `function gtag(){dataLayer.push(arguments);}` and the library acts only on
 * `arguments` objects it finds on dataLayer (it ignores a plain array, which is
 * why an array push silently loses the event). This replays dataLayer the same way.
 */
function processLikeGtagJs(layer: unknown[]): unknown[][] {
  return layer.filter((entry) => tag(entry) === '[object Arguments]').map((entry) => Array.from(entry as ArrayLike<unknown>));
}

beforeEach(() => {
  delete window.dataLayer;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gtagPush', () => {
  it('pushes an arguments object, the same shape as Google\'s own snippet', () => {
    // Google's documented bootstrap, verbatim.
    new Function('window', 'window.dataLayer = window.dataLayer || []; function gtag(){window.dataLayer.push(arguments);} gtag("js", 1);')(window);
    gtagPush('event', 'add_to_cart', { value: 1 });

    expect(window.dataLayer?.map(tag)).toEqual(['[object Arguments]', '[object Arguments]']);
  });

  it('is processed by a gtag.js-style consumer, in call order', () => {
    gtagPush('consent', 'default', { analytics_storage: 'denied' });
    gtagPush('js', new Date(0));
    gtagPush('config', 'G-TEST1234');
    gtagPush('set', { currency: 'NGN' });
    gtagPush('event', 'add_to_cart', { currency: 'NGN', value: 2000 });

    expect(window.dataLayer).toHaveLength(5);
    expect(processLikeGtagJs(window.dataLayer ?? [])).toEqual([
      ['consent', 'default', { analytics_storage: 'denied' }],
      ['js', new Date(0)],
      ['config', 'G-TEST1234'],
      ['set', { currency: 'NGN' }],
      ['event', 'add_to_cart', { currency: 'NGN', value: 2000 }],
    ]);
  });

  it('a plain array would be dropped by that consumer (the shape this guards against)', () => {
    const layer: unknown[] = [['event', 'add_to_cart', {}]];

    expect(processLikeGtagJs(layer)).toEqual([]);
  });

  it('queues before gtag.js has loaded: creates dataLayer, and keeps entries already on it', () => {
    window.dataLayer = [];
    gtagPush('event', 'search', { search_term: 'mug' });
    expect(window.dataLayer).toHaveLength(1);

    delete window.dataLayer;
    gtagPush('event', 'search', { search_term: 'mug' });
    expect(window.dataLayer).toHaveLength(1);
  });

  it('is a no-op without a window (server render)', () => {
    vi.stubGlobal('window', undefined);

    expect(() => gtagPush('event', 'search', { search_term: 'mug' })).not.toThrow();
  });
});
