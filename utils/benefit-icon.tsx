/**
 * Shared icon-keyword vocabulary for "benefit row" content blocks (glow's
 * `trust-badges`, any theme's `features-columns`, and similar icon+title+text
 * item lists). qee generates a short keyword per item (e.g. "star", "truck"),
 * never raw SVG markup — themes render that keyword through this resolver
 * instead of each theme re-declaring its own switch (glow and allure both
 * had one, independently, before this was extracted) or a theme trying to
 * `dangerouslySetInnerHTML` the keyword directly (renders as literal text,
 * not an icon — the bug that prompted this).
 *
 * `currentColor` throughout — the caller controls color via CSS `color` on
 * an ancestor, same convention every existing usage already followed.
 */
export const BENEFIT_ICON_KEYS = [
  'check',
  'shipping',
  'leaf',
  'shield',
  'star',
  'wallet',
  'refresh',
  'heart',
  'gift',
  'clock',
  'lock',
  'sparkle',
] as const;

export type BenefitIconKey = (typeof BENEFIT_ICON_KEYS)[number];

const PATHS: Record<BenefitIconKey, JSX.Element> = {
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  shipping: (
    <>
      <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
      <circle cx="7.5" cy="18" r="1.6" />
      <circle cx="17.5" cy="18" r="1.6" />
    </>
  ),
  leaf: (
    <>
      <path d="M20 4C10 4 4 10 4 18c8 0 14-6 14-14z" />
      <path d="M6 18c4-4 8-6 12-10" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6z" />,
  star: <path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z" />,
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.66 5.66L4 16" />
      <path d="M4 20v-4h4" />
    </>
  ),
  heart: <path d="M12 20.5S3.5 15 3.5 9a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2c0 6-8.5 11.5-8.5 11.5z" />,
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1" />
      <path d="M4 13h16M12 9v11" />
      <path d="M12 9c-1.5-4-6-4-6-1.5S9 9 12 9zM12 9c1.5-4 6-4 6-1.5S15 9 12 9z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" />
    </>
  ),
};

// Synonyms qee has actually generated in practice for a key in BENEFIT_ICON_KEYS
// (confirmed live: "truck" for a shipping/delivery benefit) — the AI is given
// the canonical keyword list in the manifest/prompt, but a close synonym
// should still resolve to the right icon instead of silently falling back.
const ALIASES: Record<string, BenefitIconKey> = {
  truck: 'shipping',
  delivery: 'shipping',
  return: 'refresh',
  returns: 'refresh',
  secure: 'shield',
  security: 'shield',
  guarantee: 'shield',
  quality: 'star',
  payment: 'wallet',
  price: 'wallet',
  // Carried over from glow's pre-shared TrustIcon switch — real demo data
  // and, presumably, real qee-generated pages already use this word.
  sustainability: 'leaf',
};

/** A vendor-uploaded icon takes over from the fixed keyword vocabulary — checked
 *  on the ORIGINAL casing (a URL path can be case-sensitive) before the
 *  keyword lookup below lowercases its own input. */
function isImageUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

export function BenefitIcon({ icon, className }: { icon?: string; className?: string }): JSX.Element {
  const trimmed = (icon ?? '').trim();

  if (isImageUrl(trimmed)) {
    // Fixed-size icon slot, not a content photo — the shared <Image>
    // wrapper's placeholder/lazy-load machinery is built for larger,
    // layout-affecting media.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={trimmed} alt="" className={className} loading="lazy" />;
  }

  const raw = trimmed.toLowerCase();
  const key = ALIASES[raw] ?? raw;
  const body = PATHS[key as BenefitIconKey] ?? PATHS.check;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}
