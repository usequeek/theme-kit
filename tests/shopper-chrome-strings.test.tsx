/**
 * Shopper-chrome theme strings (checkout / auth / blog) — English-safety guard.
 *
 * Each state below is rendered and compared with the markup stored in
 * `tests/fixtures/shopper-chrome-baseline.json` (`.toBe` equality), so ANY
 * English change (value, markup, attribute, plural) fails here.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';
import { StorefrontProvider } from '../provider';
import { CheckoutContactSection } from '../components/checkout/checkout-contact';
import { DefaultCheckoutShell } from '../components/checkout/default-checkout-shell';
import { PolicyLinks } from '../components/checkout/policy-links';
import { AuthEmailLoginStep } from '../components/auth/auth-email-login-step';
import { AuthEmailOtpStep } from '../components/auth/auth-email-otp-step';
import { AuthEmailOtpVerifyStep } from '../components/auth/auth-email-otp-verify-step';
import { AuthEmailRegisterStep } from '../components/auth/auth-email-register-step';
import { AuthSignupStep } from '../components/auth/auth-signup-step';
import { CategoryFilter } from '../components/blog/category-filter';
import { BlogPagination } from '../components/blog/pagination';
import { RelatedPosts } from '../components/blog/related-posts';
import { ShareButtons } from '../components/blog/share-buttons';
import { PostMeta } from '../components/blog/post-meta';
import type { Page } from '../types/page';
import { t, defaultThemeStrings } from '../strings/theme-strings';

vi.mock('../hooks/use-auth-flow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/use-auth-flow')>();
  return {
    ...actual,
    useAuthFlow: () => (globalThis as unknown as { __flow: unknown }).__flow,
  };
});

vi.mock('../hooks/use-auth', () => ({
  useAuth: () => (globalThis as unknown as { __auth: unknown }).__auth,
}));

const G = globalThis as unknown as { __flow: unknown; __auth: unknown };

function baseFlow(over: Record<string, unknown> = {}): void {
  G.__flow = {
    step: 'email-otp',
    otp: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    loading: false,
    error: null,
    setOtp: vi.fn(),
    setFirstName: vi.fn(),
    setLastName: vi.fn(),
    setEmail: vi.fn(),
    setPassword: vi.fn(),
    submitEmailRequestOtp: vi.fn(),
    submitEmailVerifyOtp: vi.fn(),
    submitRegister: vi.fn(),
    submitEmailLogin: vi.fn(),
    submitEmailRegister: vi.fn(),
    initiateGoogleAuth: vi.fn(),
    reset: vi.fn(),
    goToEmailOtp: vi.fn(),
    goToEmailLogin: vi.fn(),
    goToEmailRegister: vi.fn(),
    ...over,
  };
}

function signedOut(): void {
  G.__auth = {
    user: null,
    isAuthenticated: false,
    openAuthModal: vi.fn(),
    logout: vi.fn(),
  };
}

function signedIn(over: Record<string, unknown> = {}): void {
  G.__auth = {
    user: {
      id: 'u1',
      name: 'Adaeze Okafor',
      first_name: 'Adaeze',
      last_name: 'Okafor',
      email: 'ada@example.com',
      phone: '',
      avatar: null,
    },
    isAuthenticated: true,
    openAuthModal: vi.fn(),
    logout: vi.fn(),
    ...over,
  };
}

const AVATAR_USER = {
  id: 'u1',
  name: 'Adaeze Okafor',
  first_name: 'Adaeze',
  last_name: 'Okafor',
  email: 'ada@example.com',
  phone: '',
  avatar: 'https://cdn.example.com/a.png',
};

function render(children: ReactNode): string {
  return renderToStaticMarkup(
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'demo-store', name: 'Demo Store' } as never}
      config={{} as never}
      menus={[]}
    >
      {children}
    </StorefrontProvider>,
  );
}

function PICK({ label }: { label: string }): JSX.Element {
  return <span data-pick={label}>{label}</span>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shellProps(over: Record<string, unknown> = {}): any {
  return {
    cartItems: <PICK label="items" />,
    deliveryModes: <PICK label="modes" />,
    addressPicker: <PICK label="address" />,
    deliverySourcePicker: null,
    shippingZonePicker: <PICK label="zone" />,
    schedulePicker: <PICK label="schedule" />,
    paymentPicker: <PICK label="pay" />,
    promoInput: <PICK label="promo" />,
    noteInputs: <PICK label="notes" />,
    feesBreakdown: <PICK label="fees" />,
    deliveryMessage: null,
    submitButton: <PICK label="submit" />,
    activeTab: 'summary',
    onTabChange: () => {},
    totalCount: 0,
    subtotal: 0,
    currency: 'NGN',
    mode: 'page',
    policies: [],
    ...over,
  };
}

const POLICIES = [
  { id: 'p1', slug: 'refund', type: 'page', title: 'Refund policy', content: [], excerpt: null, cover_image_url: null },
  { id: 'p2', slug: 'shipping', type: 'page', title: 'Shipping policy', content: [], excerpt: null, cover_image_url: null },
] as unknown as Page[];

const CATS = [
  { slug: 'news', name: 'News', posts_count: 4 },
  { slug: 'recipes', name: 'Recipes' },
];

function post(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'post1',
    slug: 'hello-world',
    type: 'post',
    title: 'Hello world',
    content: [],
    excerpt: null,
    cover_image_url: null,
    author: { name: 'Adaeze Okafor', avatar_url: null },
    published_at: '2026-09-15T12:00:00.000Z',
    reading_time: 5,
    ...over,
  };
}

const REL = [
  post({ id: 'r1', slug: 'p-one' }),
  post({ id: 'r2', slug: 'p-two' }),
];

/** Every covered state: mock setup + element. Keys match the JSON fixture. */
const STATES: Record<string, () => string> = {
  'contact.out': () => { signedOut(); return render(<CheckoutContactSection />); },
  'contact.in.initial': () => { signedIn(); return render(<CheckoutContactSection />); },
  'contact.in.avatar': () => { signedIn({ user: AVATAR_USER }); return render(<CheckoutContactSection />); },

  'shell.page.empty': () => { signedOut(); return render(<DefaultCheckoutShell {...shellProps({ totalCount: 0 })} />); },
  'shell.page.full': () => { signedOut(); return render(<DefaultCheckoutShell {...shellProps({ totalCount: 3, subtotal: 4500, policies: POLICIES })} />); },
  'shell.page.minimal': () => { signedOut(); return render(<DefaultCheckoutShell {...shellProps({ totalCount: 2, subtotal: 1000, addressPicker: null, shippingZonePicker: null, schedulePicker: null, deliveryMessage: { type: 'warning', message: 'Slow courier' } })} />); },
  'shell.panel.summary.empty': () => { signedOut(); return render(<DefaultCheckoutShell {...shellProps({ mode: 'panel', activeTab: 'summary', totalCount: 0 })} />); },
  'shell.panel.summary.items3': () => { signedOut(); return render(<DefaultCheckoutShell {...shellProps({ mode: 'panel', activeTab: 'summary', totalCount: 3, subtotal: 4500 })} />); },
  'shell.panel.summary.items1': () => { signedOut(); return render(<DefaultCheckoutShell {...shellProps({ mode: 'panel', activeTab: 'summary', totalCount: 1, subtotal: 1500 })} />); },
  'shell.panel.checkout': () => { signedOut(); return render(<DefaultCheckoutShell {...shellProps({ mode: 'panel', activeTab: 'checkout', totalCount: 2, subtotal: 2000 })} />); },

  'policies.empty': () => { signedOut(); return render(<PolicyLinks policies={[]} />); },
  'policies.list': () => { signedOut(); return render(<PolicyLinks policies={POLICIES} />); },

  'login.default': () => { baseFlow(); return render(<AuthEmailLoginStep />); },
  'login.loading': () => { baseFlow({ loading: true, email: 'ada@example.com', password: 'secret123' }); return render(<AuthEmailLoginStep />); },
  'login.error': () => { baseFlow({ email: 'ada@example.com', password: 'secret123', error: 'Wrong email or password. Please try again.' }); return render(<AuthEmailLoginStep />); },

  'otp.default': () => { baseFlow(); return render(<AuthEmailOtpStep />); },
  'otp.loading': () => { baseFlow({ loading: true, email: 'ada@example.com' }); return render(<AuthEmailOtpStep />); },
  'otp.error': () => { baseFlow({ email: 'ada@example.com', error: 'Something went wrong. Please try again.' }); return render(<AuthEmailOtpStep />); },

  'verify.empty': () => { baseFlow({ email: 'ada@example.com', otp: '' }); return render(<AuthEmailOtpVerifyStep />); },
  'verify.partial': () => { baseFlow({ email: 'ada@example.com', otp: '123' }); return render(<AuthEmailOtpVerifyStep />); },
  'verify.loading': () => { baseFlow({ email: 'ada@example.com', otp: '123456', loading: true }); return render(<AuthEmailOtpVerifyStep />); },
  'verify.error': () => { baseFlow({ email: 'ada@example.com', otp: '12', error: 'Incorrect code. Please try again.' }); return render(<AuthEmailOtpVerifyStep />); },

  'register.default': () => { baseFlow(); return render(<AuthEmailRegisterStep />); },
  'register.loading': () => { baseFlow({ loading: true, firstName: 'Adaeze', email: 'ada@example.com', password: 'secret123' }); return render(<AuthEmailRegisterStep />); },
  'register.error': () => { baseFlow({ firstName: 'Adaeze', email: 'ada@example.com', password: 'secret123', error: 'Email already registered. Please sign in instead.' }); return render(<AuthEmailRegisterStep />); },

  'signup.default': () => { baseFlow(); return render(<AuthSignupStep />); },
  'signup.loading': () => { baseFlow({ loading: true, firstName: 'Adaeze', lastName: 'Okafor' }); return render(<AuthSignupStep />); },
  'signup.error': () => { baseFlow({ firstName: 'Adaeze', error: 'Please enter your first name.' }); return render(<AuthSignupStep />); },

  'filter.pills': () => render(<CategoryFilter categories={CATS} />),
  'filter.pills.active': () => render(<CategoryFilter categories={CATS} active="news" />),
  'filter.tabs': () => render(<CategoryFilter categories={CATS} variant="tabs" />),
  'filter.tabs.active': () => render(<CategoryFilter categories={CATS} variant="tabs" active="recipes" />),
  'filter.empty': () => render(<CategoryFilter categories={[]} />),
  'filter.null': () => render(<CategoryFilter categories={null} />),

  'page.mid': () => render(<BlogPagination pagination={{ current_page: 2, per_page: 12, has_more: true }} category="news" />),
  'page.last': () => render(<BlogPagination pagination={{ current_page: 4, has_more: false }} />),
  'page.first.next': () => render(<BlogPagination pagination={{ current_page: 1, has_more: true }} />),
  'page.lone': () => render(<BlogPagination pagination={{ current_page: 1, has_more: false }} />),
  'page.unset': () => render(<BlogPagination pagination={undefined} />),

  'related.default': () => render(<RelatedPosts posts={REL as never} />),
  'related.custom': () => render(<RelatedPosts posts={REL as never} heading="Keep reading" />),
  'related.empty': () => render(<RelatedPosts posts={[]} />),
  'related.null': () => render(<RelatedPosts posts={null} />),

  'share.default': () => render(<ShareButtons title="Hello world" />),

  'meta.full': () => render(<PostMeta post={post() as never} />),
  'meta.reading1': () => render(<PostMeta post={post({ reading_time: 1 }) as never} />),
  'meta.noauthor': () => render(<PostMeta post={post({ author: null }) as never} />),
  'meta.minimal': () => render(<PostMeta post={post({ author: null, published_at: null, reading_time: 0 }) as never} />),
};

const root = dirname(fileURLToPath(import.meta.url));
const BASELINES = JSON.parse(
  readFileSync(join(root, 'fixtures', 'shopper-chrome-baseline.json'), 'utf-8'),
) as Record<string, string>;

describe('shopper chrome English safety (checkout/auth/blog)', () => {
  it('covers every baseline state (fixture and STATES map stay in sync)', () => {
    expect(Object.keys(STATES).sort()).toEqual(Object.keys(BASELINES).sort());
  });

  for (const [name, renderState] of Object.entries(STATES)) {
    it(`${name}: byte-identical to the stored OLD markup`, () => {
      expect(renderState()).toBe(BASELINES[name]);
    });
  }

  // Value guard: ShareButtons renders its copied branch only after a
  // client-side clipboard write (internal useState, no prop), so no static
  // baseline can capture it. Pin the English through the real `t` instead —
  // any change to blog.share.copied fails here.
  it("share.copied: English value pinned ('Copied')", () => {
    expect(t(defaultThemeStrings, 'blog.share.copied')).toBe('Copied');
  });
});
