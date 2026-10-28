// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  user: { id: 'u1' } as { id: string } | null,
}));

vi.mock('../sdk/queek-client', () => ({
  getQueekClient: () => ({ get: sdk.get, post: sdk.post }),
}));
vi.mock('../stores/user-store', () => ({
  useUserStore: (select: (s: { user: unknown }) => unknown) => select({ user: sdk.user }),
}));
vi.mock('../stores/auth-modal-store', () => ({
  useAuthModalStore: (select: (s: { open: () => void }) => unknown) => select({ open: () => {} }),
}));

import { FollowCard } from '../apps/follow-card';
import { StorefrontProvider } from '../provider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Setting {
  enabled?: boolean;
  display?: string;
  position?: string;
}

function Store({
  follow,
  strings,
  locale,
  children,
}: {
  follow: Setting;
  strings?: Record<string, unknown>;
  locale?: string;
  children: ReactNode;
}) {
  return (
    <StorefrontProvider
      vendor={{ id: 'v1', slug: 'acme', name: 'Acme' } as never}
      config={{ apps: { follow_card: follow }, followers_count: 1200 } as never}
      menus={[]}
      {...(locale ? { locale } : {})}
      {...(strings ? { strings: strings as never } : {})}
    >
      {children}
    </StorefrontProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

async function mount(follow: Setting, nodes: ReactNode, strings?: Record<string, unknown>, locale?: string): Promise<void> {
  await act(async () => {
    root.render(
      <Store follow={follow} {...(strings ? { strings } : {})} {...(locale ? { locale } : {})}>
        {nodes}
      </Store>,
    );
  });
}

const cards = (): NodeListOf<Element> => container.querySelectorAll('.core-follow-card');

beforeEach(() => {
  sdk.user = { id: 'u1' };
  sdk.get.mockReset().mockResolvedValue({ data: { following: false, shared_contact: false, followers_count: 1200 } });
  sdk.post.mockReset().mockResolvedValue({ data: { following: true, shared_contact: false, followers_count: 1201 } });
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('FollowCard: contact sharing is the shopper\'s own choice', () => {
  it('starts with the share box unticked', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    const box = container.querySelector<HTMLInputElement>('.core-follow-card__checkbox');

    expect(box).not.toBeNull();
    expect(box?.checked).toBe(false);
  });

  it('follows without sharing unless the shopper ticks the box', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.core-follow-card__btn')?.click();
    });

    expect(sdk.post).toHaveBeenCalledWith('/client/store/follow', { contact_opt_in: false });
  });

  it('sends the contact only after the shopper ticks the box', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    await act(async () => {
      container.querySelector<HTMLInputElement>('.core-follow-card__checkbox')?.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.core-follow-card__btn')?.click();
    });

    expect(sdk.post).toHaveBeenCalledWith('/client/store/follow', { contact_opt_in: true });
  });

  it('never sends the older share_contact key, which the API does not read as consent', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.core-follow-card__btn')?.click();
    });

    expect(sdk.post.mock.calls[0]?.[1]).not.toHaveProperty('share_contact');
  });

  it('says what is shared and with whom', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    expect(container.querySelector('.core-follow-card__consent')?.textContent).toBe(
      'Optional: share my name, email and phone number with Acme, so they can contact me.',
    );
  });
});

describe('FollowCard: shown once, where the merchant chose', () => {
  it('shows only the floating mount when the setting is floating', async () => {
    await mount(
      { enabled: true, display: 'floating' },
      <>
        <FollowCard display="floating" />
        <FollowCard display="inline" />
      </>,
    );

    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.className).toContain('core-follow-card--floating');
  });

  it('reads the retired block setting as floating', async () => {
    await mount(
      { enabled: true, display: 'block' },
      <>
        <FollowCard display="floating" />
        <FollowCard display="inline" />
      </>,
    );

    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.className).toContain('core-follow-card--floating');
  });

  it('shows only the footer mount when the setting is footer', async () => {
    await mount(
      { enabled: true, display: 'footer' },
      <>
        <FollowCard display="floating" />
        <FollowCard display="inline" />
      </>,
    );

    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.className).toContain('core-follow-card--inline');
  });

  it('falls back to the floating card when the theme has no footer mount', async () => {
    await mount({ enabled: true, display: 'footer' }, <FollowCard display="floating" />);

    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.className).toContain('core-follow-card--floating');
  });

  it('shows nothing when the app is off', async () => {
    await mount(
      { enabled: false, display: 'footer' },
      <>
        <FollowCard display="floating" />
        <FollowCard display="inline" />
      </>,
    );

    expect(cards()).toHaveLength(0);
  });

  it('checks the follow status once, not once per mount', async () => {
    await mount(
      { enabled: true, display: 'floating' },
      <>
        <FollowCard display="floating" />
        <FollowCard display="inline" />
      </>,
    );

    expect(sdk.get).toHaveBeenCalledTimes(1);
  });
});

describe('FollowCard: a shopper who follows can unfollow', () => {
  beforeEach(() => {
    sdk.get.mockResolvedValue({ data: { following: true, shared_contact: false, followers_count: 1200 } });
    sdk.post.mockResolvedValue({ data: { following: false, followers_count: 1199 } });
  });

  it('shows a compact Following state with Unfollow instead of hiding', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.className).toContain('core-follow-card--compact');
    expect(container.querySelector('.core-follow-card__state')?.textContent).toBe('Following');
    expect(container.querySelector('.core-follow-card__unfollow')?.textContent).toBe('Unfollow');
    expect(container.querySelector('.core-follow-card__checkbox')).toBeNull();
  });

  it('unfollows through the follow endpoint and offers the prompt again, box unticked', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.core-follow-card__unfollow')?.click();
    });

    expect(sdk.post).toHaveBeenCalledWith('/client/store/follow?_method=DELETE', {});
    expect(container.querySelector('.core-follow-card__unfollow')).toBeNull();
    expect(container.querySelector<HTMLInputElement>('.core-follow-card__checkbox')?.checked).toBe(false);
  });

  it('keeps the Following state even after the prompt was dismissed', async () => {
    window.localStorage.setItem('queek_follow_card_dismissed', JSON.stringify(['v1']));
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />);

    expect(container.querySelector('.core-follow-card__unfollow')).not.toBeNull();
  });

  it('shows the Following state once, in the footer, when that is where the merchant put the card', async () => {
    await mount(
      { enabled: true, display: 'footer' },
      <>
        <FollowCard display="floating" />
        <FollowCard display="inline" />
      </>,
    );

    expect(container.querySelectorAll('.core-follow-card__unfollow')).toHaveLength(1);
    expect(cards()[0]?.className).toContain('core-follow-card--inline');
  });

  it('says Following and Unfollow in the shopper\'s language', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />, {
      follow: { following: 'Abonné', unfollow: 'Se désabonner', leaving: 'Désabonnement…' },
    });

    expect(container.textContent).toContain('Abonné');
    expect(container.textContent).toContain('Se désabonner');
  });
});

describe('FollowCard: every word is a theme string', () => {
  it('reads the words from the dictionary the host supplies, with CLDR plurals', async () => {
    const fr = {
      follow: {
        aria: 'Suivre cette boutique',
        dismiss: 'Ne plus afficher',
        title: 'Suivre {name}',
        thisstore: 'cette boutique',
        tagline: 'Soyez informé des nouveautés.',
        count: { one: '{n} abonné', other: '{n} abonnés' },
        share: 'Facultatif : partager mon nom avec {name}.',
        action: 'Suivre',
        busy: 'Abonnement…',
      },
    };
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />, fr);

    const text = container.textContent ?? '';

    expect(text).toContain('Suivre Acme');
    expect(text).toContain('Soyez informé des nouveautés.');
    expect(text).toContain('abonnés');
    expect(text).toContain('Facultatif : partager mon nom avec Acme.');
    expect(container.querySelector('.core-follow-card')?.getAttribute('aria-label')).toBe('Suivre cette boutique');
    expect(container.querySelector('.core-follow-card__dismiss')?.getAttribute('aria-label')).toBe('Ne plus afficher');
  });

  it('formats the follower count in the shopper\'s locale', async () => {
    await mount({ enabled: true, display: 'floating' }, <FollowCard display="floating" />, undefined, 'fr');

    const count = container.querySelector('.core-follow-card__count')?.textContent ?? '';

    expect(count).toContain('1');
    expect(count).not.toContain('1,200');
    expect(count).toMatch(/1[\u202f\u00a0 ]200/);
  });

  it('keeps no English literal in the component', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(`${process.cwd()}/apps/follow-card.tsx`, 'utf8');

    expect(source).not.toMatch(/Follow this store|Don't show again|exclusive offers|Share my contact|Following\.\.\./);
  });
});
