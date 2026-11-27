/**
 * G7 S1: Google sign-in starts on the store's own `/auth/google` handler. The kit never calls the sign-in service itself and
 * never hands it the page's full URL: the browser navigates to `<basePath>/auth/google?return_to=<this page, relative>`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthFlowProvider, googleSignInStartHref, useAuthFlow } from '../hooks/use-auth-flow';
import { StorefrontProvider } from '../provider';

describe('googleSignInStartHref', () => {
  it('is the store-relative handler with the page as a relative return_to', () => {
    expect(googleSignInStartHref('', { pathname: '/products/mug', search: '?variant=2' })).toBe('/auth/google?return_to=%2Fproducts%2Fmug%3Fvariant%3D2');
  });

  it('keeps a path-prefixed store and locale prefix on the handler', () => {
    expect(googleSignInStartHref('/acme/fr', { pathname: '/acme/fr/shop', search: '' })).toBe('/acme/fr/auth/google?return_to=%2Facme%2Ffr%2Fshop');
  });

  it('falls back to / for an empty path', () => {
    expect(googleSignInStartHref('', { pathname: '', search: '' })).toBe('/auth/google?return_to=%2F');
  });
});

describe('initiateGoogleAuth', () => {
  const assign = vi.fn();
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('window', { location: { pathname: '/p/matte', search: '?ref=chat', href: 'https://acme.queek.app/p/matte?ref=chat', assign } });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    assign.mockReset();
    fetchSpy.mockReset();
  });

  function captureFlow(basePath: string): ReturnType<typeof useAuthFlow> {
    let flow: ReturnType<typeof useAuthFlow> | null = null;
    function Capture(): null {
      flow = useAuthFlow();
      return null;
    }
    renderToStaticMarkup(
      <StorefrontProvider vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never} config={{} as never} menus={[]} basePath={basePath}>
        <AuthFlowProvider>
          <Capture />
        </AuthFlowProvider>
      </StorefrontProvider>,
    );
    if (!flow) throw new Error('no auth flow captured');
    return flow;
  }

  it('navigates to the store handler and calls no sign-in service', async () => {
    await captureFlow('').initiateGoogleAuth();

    expect(assign).toHaveBeenCalledWith('/auth/google?return_to=%2Fp%2Fmatte%3Fref%3Dchat');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('never sends the full page URL anywhere', () => {
    const source = readFileSync(join(__dirname, '../hooks/use-auth-flow.tsx'), 'utf8');

    expect(source).not.toContain('oauth/google/start');
    expect(source).not.toContain('location.href');
    expect(source).toContain('navigateTo(googleSignInStartHref(');
  });
});
