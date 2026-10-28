// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQueekClient, setAuthTokens } from '../sdk/queek-client';
import { useUserStore } from '../stores/user-store';

/**
 * The SDK reads the tokens once, when a client is created. A tab whose cached
 * client predates a sign-in in ANOTHER tab (which writes the same localStorage
 * keys, while the user store syncs across tabs) must not keep sending requests
 * bare: their 401 signed the shopper out in every tab right after they signed in.
 */
function authHeaderOf(call: unknown[]): string | null {
  const init = call[1] as RequestInit | undefined;
  return new Headers(init?.headers).get('Authorization');
}

describe('getQueekClient token cache', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    setAuthTokens('', '');
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ data: { following: false } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useUserStore.getState().logout();
  });

  it('sends the token another tab stored after this tab cached its client', async () => {
    await getQueekClient('shop').get('/client/store/follow/status');
    expect(authHeaderOf(fetchMock.mock.calls[0])).toBeNull();

    // Another tab signs in: same keys, no call to this tab's setAuthTokens.
    localStorage.setItem('queek_client_access_token', 'tab-a-access');
    localStorage.setItem('queek_client_refresh_token', 'tab-a-refresh');

    await getQueekClient('shop').get('/client/store/follow/status');
    expect(authHeaderOf(fetchMock.mock.calls[1])).toBe('Bearer tab-a-access');
  });

  it('stops sending a token another tab removed', async () => {
    localStorage.setItem('queek_client_access_token', 'old-access');
    localStorage.setItem('queek_client_refresh_token', 'old-refresh');
    await getQueekClient('shop').get('/client/store/follow/status');
    expect(authHeaderOf(fetchMock.mock.calls[0])).toBe('Bearer old-access');

    localStorage.removeItem('queek_client_access_token');
    localStorage.removeItem('queek_client_refresh_token');

    await getQueekClient('shop').get('/client/store/follow/status');
    expect(authHeaderOf(fetchMock.mock.calls[1])).toBeNull();
  });

  it('keeps one client while the stored tokens and the store stay the same', () => {
    localStorage.setItem('queek_client_access_token', 'a');
    localStorage.setItem('queek_client_refresh_token', 'r');
    expect(getQueekClient('shop')).toBe(getQueekClient('shop'));
  });
});
