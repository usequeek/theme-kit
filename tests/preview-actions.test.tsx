// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StorefrontProvider } from '../provider';
import type { ThemeStringsDictionary } from '../strings/theme-strings';
import type { ProductQaBlockData } from '../types/block';
import { SubscribeForm } from '../apps/subscribe-form';
import { FollowCard } from '../apps/follow-card';
import { CoreProductQaBlock } from '../shared-blocks/product-qa';
import { AuthFlowProvider, useAuthFlow, type AuthFlowValue } from '../hooks/use-auth-flow';
import { useAddressAutocomplete } from '../hooks/use-address-autocomplete';
import { useResolveCoordinates } from '../hooks/use-resolve-coordinates';
import { useUserStore } from '../stores/user-store';
import { useLocationStore } from '../stores/location-store';

const sdk = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), client: vi.fn(), tokens: vi.fn(),
  emailRequestOtp: vi.fn(), emailVerifyOtp: vi.fn(), emailRegisterOtp: vi.fn(),
}));
vi.mock('../sdk/queek-client', () => ({
  getQueekClient: sdk.client,
  setAuthTokens: sdk.tokens,
  QUEEK_AUTH_URL: 'https://auth.example.test',
}));
// Keep Q&A read traffic separate from the shopper write under test.
vi.mock('../sdk/client', () => ({ createBrowserClient: () => ({ get: vi.fn().mockResolvedValue({ data: { questions: [] } }) }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const notice = 'This is a theme preview, so nothing was sent.';
const authNotice = "Signing in isn't available in a theme preview.";
const addressNotice = "Address lookup isn't available in a theme preview.";
let host: HTMLDivElement;
let root: Root;
let flow: AuthFlowValue;
let geo: ReturnType<typeof useResolveCoordinates>;
let address: ReturnType<typeof useAddressAutocomplete>;
function AuthProbe() {
  flow = useAuthFlow();
  return <p role="alert">{flow.error}</p>;
}
function AddressProbe() {
  address = useAddressAutocomplete('  Lagos & road  ');
  geo = useResolveCoordinates();
  return <p role="status">{address.error ?? geo.error ?? address.suggestions.map(s => s.description).join(',')}</p>;
}
async function mount(node: ReactNode, preview = true, strings?: ThemeStringsDictionary) {
  await act(async () => root.render(
    <StorefrontProvider vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never}
      config={{ apps: { follow_card: { enabled: true, display: 'floating' } } } as never}
      menus={[]} previewData={preview ? {} : undefined} strings={strings}>
      {node}
    </StorefrontProvider>,
  ));
}
async function input(selector: string, value: string) {
  await act(async () => {
    const el = host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(selector: string) {
  await act(async () => (host.querySelector(selector) as HTMLButtonElement).click());
}
async function submit() {
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
function noRequests() {
  expect(sdk.client).not.toHaveBeenCalled();
  expect(sdk.get).not.toHaveBeenCalled();
  expect(sdk.post).not.toHaveBeenCalled();
  expect(sdk.emailRequestOtp).not.toHaveBeenCalled();
  expect(sdk.emailVerifyOtp).not.toHaveBeenCalled();
  expect(sdk.emailRegisterOtp).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.resetAllMocks();
  sdk.client.mockReturnValue({ get: sdk.get, post: sdk.post, auth: sdk });
  sdk.get.mockResolvedValue({ data: { following: false } });
  sdk.post.mockResolvedValue({ data: {} });
  vi.stubGlobal('fetch', vi.fn());
  useUserStore.getState().logout();
  localStorage.clear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals();
});
function signedIn() {
  useUserStore.getState().setUser({ id: 'u1', name: 'A', first_name: 'A', last_name: '', email: 'a@b.test', phone: '123', avatar: null });
}

describe('subscribe preview and live', () => {
  it('shows the honest done state and invokes the modal/floating-card close callback once', async () => {
    const onSuccess = vi.fn();
    await mount(<SubscribeForm onSuccess={onSuccess} />);
    await input('[name=email]', ' a@b.test '); await submit();
    expect(host.querySelector('[role=status]')?.textContent).toBe(notice);
    expect(onSuccess).toHaveBeenCalledTimes(1); noRequests();
  });
  it('closes a subscribe modal through onSuccess in preview', async () => {
    function Modal() {
      const [open, setOpen] = useState(true);
      return open ? <div role="dialog"><SubscribeForm onSuccess={() => setOpen(false)} /></div> : <p>Closed</p>;
    }
    await mount(<Modal />); await input('[name=email]', 'a@b.test'); await submit();
    expect(host.querySelector('[role=dialog]')).toBeNull(); expect(host.textContent).toBe('Closed'); noRequests();
  });
  it('uses the host translation for the preview done state', async () => {
    await mount(<SubscribeForm />, true, { preview: { action: 'Preview translation' } });
    await input('[name=email]', 'a@b.test'); await submit();
    expect(host.textContent).toContain('Preview translation'); noRequests();
  });
  it('still sends the exact live path/body and displays the API message', async () => {
    sdk.post.mockResolvedValue({ data: { message: 'Welcome!' } });
    const close = vi.fn(); await mount(<SubscribeForm onSuccess={close} />, false);
    await input('[name=name]', ' Ada '); await input('[name=email]', ' a@b.test '); await submit();
    expect(sdk.post).toHaveBeenCalledExactlyOnceWith('/client/store/subscribe', { email: 'a@b.test', name: 'Ada' });
    expect(host.querySelector('[role=status]')?.textContent).toBe('Welcome!'); expect(close).toHaveBeenCalledTimes(1);
  });
});

const authActions = ['submitEmailRequestOtp', 'submitEmailVerifyOtp', 'submitRegister', 'submitEmailLogin', 'submitEmailRegister', 'initiateGoogleAuth'] as const;
async function authMount(preview: boolean, strings?: ThemeStringsDictionary) {
  await mount(<AuthFlowProvider><AuthProbe /></AuthFlowProvider>, preview, strings);
  await act(async () => { flow.setEmail(' a@b.test '); flow.setPassword('password123'); flow.setFirstName(' Ada '); flow.setLastName(' Lovelace '); flow.setOtp('123456'); });
}
describe('all auth entry points', () => {
  it.each(authActions)('%s stops before any SDK/fetch call in preview', async action => {
    await authMount(true); const url = location.href;
    await act(async () => flow[action]());
    expect(host.querySelector('[role=alert]')?.textContent).toBe(authNotice);
    expect(flow.loading).toBe(false); expect(location.href).toBe(url); noRequests();
  });
  it('translates the shared preview auth error', async () => {
    await authMount(true, { auth: { error: { preview: 'Auth translation' } } });
    await act(async () => flow.initiateGoogleAuth()); expect(flow.error).toBe('Auth translation'); noRequests();
  });
  it.each(authActions)('%s retains its live request contract', async action => {
    const user = { id: 'u1', name: 'Ada', email: 'a@b.test', avatar: null };
    sdk.emailRequestOtp.mockResolvedValue({});
    sdk.emailVerifyOtp.mockResolvedValue({ needs_registration: true, verified_token: 'verified' });
    sdk.emailRegisterOtp.mockResolvedValue({ user });
    sdk.post.mockResolvedValue({ data: { user, access_token: 'access', refresh_token: 'refresh' } });
    // A same-document redirect exercises the Google success branch without browser navigation.
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ data: { url: location.href } }) } as Response);
    await authMount(false);
    if (action === 'submitRegister') { await act(async () => flow.submitEmailVerifyOtp()); sdk.client.mockClear(); }
    await act(async () => flow[action]());
    if (action === 'submitEmailRequestOtp') expect(sdk.emailRequestOtp).toHaveBeenCalledExactlyOnceWith({ email: 'a@b.test' });
    if (action === 'submitEmailVerifyOtp') expect(sdk.emailVerifyOtp).toHaveBeenCalledExactlyOnceWith({ email: 'a@b.test', otpCode: '123456' });
    if (action === 'submitRegister') expect(sdk.emailRegisterOtp).toHaveBeenCalledExactlyOnceWith({ firstName: 'Ada', lastName: 'Lovelace', verifiedToken: 'verified' });
    if (action === 'submitEmailLogin') expect(sdk.post).toHaveBeenCalledExactlyOnceWith('/client/auth/email/login', { email: 'a@b.test', password: 'password123', platform: 'client_web' });
    if (action === 'submitEmailRegister') expect(sdk.post).toHaveBeenCalledExactlyOnceWith('/client/auth/email/register-password', { first_name: 'Ada', last_name: 'Lovelace', email: 'a@b.test', password: 'password123', phone: '', platform: 'client_web' });
    if (action === 'initiateGoogleAuth') expect(fetch).toHaveBeenCalledExactlyOnceWith(`https://auth.example.test/oauth/google/start?channel=storefront&vendor_slug=acme&return_to=${encodeURIComponent(location.href)}`);
    expect(flow.error).toBeNull();
  });
});

describe('follow with a saved shopper session', () => {
  it('skips status and follow in preview and explains why', async () => {
    signedIn(); await mount(<FollowCard />); await click('.core-follow-card__btn');
    expect(host.querySelector('[role=status]')?.textContent).toBe(notice); noRequests();
  });
  it('skips unfollow even if a following card survives a switch into preview', async () => {
    signedIn(); sdk.get.mockResolvedValue({ data: { following: true } });
    await mount(<FollowCard />, false); sdk.client.mockClear(); sdk.get.mockClear();
    await mount(<FollowCard />); await click('.core-follow-card__unfollow');
    expect(host.querySelector('[role=status]')?.textContent).toBe(notice); noRequests();
  });
  it('retains live status, follow and unfollow paths and consent body', async () => {
    signedIn(); await mount(<FollowCard />, false);
    expect(sdk.get).toHaveBeenCalledExactlyOnceWith('/client/store/follow/status');
    sdk.post.mockResolvedValueOnce({ data: { following: true } });
    await click('.core-follow-card__checkbox'); await click('.core-follow-card__btn');
    expect(sdk.post).toHaveBeenLastCalledWith('/client/store/follow', { contact_opt_in: true });
    await click('.core-follow-card__unfollow');
    expect(sdk.post).toHaveBeenLastCalledWith('/client/store/follow?_method=DELETE', {}); expect(sdk.post).toHaveBeenCalledTimes(2);
  });
});

describe('product Q&A with a saved shopper session', () => {
  it.each([true, false])('preview=%s submits honestly with the existing live contract', async preview => {
    signedIn(); await mount(<CoreProductQaBlock {...{ product_slug: 'chair / blue' } as ProductQaBlockData} />, preview);
    await click('.core-block-product-qa__ask-btn'); await input('textarea', ' Will it fit? '); await click('.core-block-product-qa__submit-btn');
    if (preview) { expect(host.textContent).toContain(notice); noRequests(); }
    else { expect(sdk.post).toHaveBeenCalledExactlyOnceWith('/client/store/products/chair%20%2F%20blue/questions', { question: 'Will it fit?' }); expect(host.textContent).toContain('Thanks'); }
  });
});

describe('public address actions', () => {
  it.each([true, false])('preview=%s autocomplete and geo resolution', async preview => {
    vi.useFakeTimers(); sdk.get.mockResolvedValue({ data: [{ place_id: 'place', description: 'Lagos' }] });
    sdk.post.mockResolvedValue({ data: { lat: 6, lng: 3, formatted_address: 'Lagos', state_id: 'state' } });
    const before = useLocationStore.getState(); await mount(<AddressProbe />, preview);
    await act(async () => { await vi.advanceTimersByTimeAsync(350); });
    let resolved: boolean | undefined; await act(async () => { resolved = await geo.resolve('place', 'fallback'); });
    expect(address.loading).toBe(false); expect(geo.resolving).toBe(false);
    if (preview) {
      noRequests(); expect(resolved).toBe(false); expect(address.suggestions).toEqual([]);
      expect(host.textContent).toBe(addressNotice); expect(geo.error).toBe(addressNotice); expect(useLocationStore.getState()).toBe(before);
    } else {
      expect(sdk.get).toHaveBeenCalledExactlyOnceWith('/client/address/autocomplete?query=Lagos%20%26%20road');
      expect(sdk.post).toHaveBeenCalledExactlyOnceWith('/client/geo/resolve', { place_id: 'place' });
      expect(resolved).toBe(true); expect(host.textContent).toBe('Lagos'); expect(address.error).toBeNull(); expect(geo.error).toBeNull();
    }
  });
});
