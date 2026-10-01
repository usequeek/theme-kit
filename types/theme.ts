import type { FC, ReactNode } from 'react';
import type { Block, BlockDataMap, BlockType, BlogBlockData, CategoriesBlockData, ProductsBlockData } from './block';
import type { CartItem as CartLineItem } from './cart';
import type { ImageVariants } from './media';
import type { MenuItem } from './menu';
import type { BlogCategory, Collection, Page, Pagination, Post } from './page';
import type { MetaobjectEntry, Product } from './product';
import type { DesignTokenAxisPath, DesignTokens, StorefrontConfig, VendorProfile } from './vendor';
import type { ThemeStringsDictionary } from '../strings/theme-strings';

export interface HomePageProps {
  blocks: Block[];
}

export interface GenericPageProps {
  page: Page;
}

export interface BlogPageProps {
  posts: Post[];
  pagination?: Pagination;
  /** Vendor blog categories with >=1 live post (for the filter bar). */
  categories?: BlogCategory[];
  /** Currently-filtered category slug, if any. */
  activeCategory?: string;
}

export interface PostPageProps {
  post: Post;
}

export interface CollectionsPageProps {
  collections: Collection[];
}

export interface PoliciesPageProps {
  /** Published policies (returns, shipping, privacy, terms, …). Each is a
   *  `Page` with `type: 'policy'`; its detail view resolves through the
   *  generic `/[vendor]/[slug]` route. */
  policies: Page[];
}

/** Field label/type metadata for a metaobject entry page — the same shape
 *  `GET store/metaobject-definitions` sends, scoped to one definition. */
export interface MetaobjectPageDefinition {
  type: string;
  name: string;
  fields: Array<{ key: string; name: string; type: string }>;
}

export interface MetaobjectPageProps {
  entry: MetaobjectEntry;
  definition: MetaobjectPageDefinition;
}

export interface ShopCategory {
  id: string;
  slug: string;
  name: string;
  image?: string | null;
  /** TaxonomyCategoryResource:22 — attached to every node of the tree
   *  (MediaVariantMap::attachUrlVariants walks `children` too). */
  image_variants?: ImageVariants | null;
  products_count?: number;
  children?: ShopCategory[];
}

export interface ShopPageProps {
  categories: ShopCategory[];
}

export interface CollectionPageProps {
  collection: Collection;
  products: Product[];
  pagination?: Pagination;
}

export interface ProductPageProps {
  product: Product;
  /**
   * Product metafield definitions keyed by metafield key — the labels (and
   * types) the core-owned `<ProductMetafields />` section renders values
   * under. OPTIONAL so external themes that destructure `{ product }` keep
   * compiling; unknown keys fall back to a humanised key label.
   */
  metafieldDefinitions?: Record<string, { name: string; type: string }>;
}

export interface GalleryPageProps {
  gallery: Page;
}

export interface LayoutProps {
  children: ReactNode;
}

export interface SubscribeFormProps {
  heading?: string;
  tagline?: string;
  cta?: string;
}

export interface HeaderProps {
  menu: MenuItem[];
  logo?: string | null;
  /**
   * `text` is the message currently showing — the shell rotates it through
   * the `|`/newline-separated list the vendor wrote (see
   * hooks/use-announcement). A header that wants its own pager reads
   * `messages`/`index` and calls `next`/`prev`; outside the shell (style
   * guide, variant previews) only `text` is set.
   */
  announcement?: {
    enabled: boolean;
    text: string;
    link?: string | null;
    messages?: string[];
    index?: number;
    next?: () => void;
    prev?: () => void;
  } | null;
  /** Site-wide header icon visibility — all default true (see config.header.show_*). */
  showSearch?: boolean;
  showCart?: boolean;
  showAccount?: boolean;
  /** Theme-specific extra header icon (currently only glow/overlay's "Offers" shortcut). */
  showOffers?: boolean;
}

export interface FooterProps {
  /** Footer brand heading override; falls back to the vendor name. */
  heading?: string | null;
  /** Footer brand description/tagline override; falls back to vendor.tagline. */
  tagline?: string | null;
  columns?: Array<{ heading: string; content: string }>;
  socials?: Record<string, string>;
  copyright?: string | null;
}

export interface CartShellProps {
  items: CartLineItem[];
  currency: string;
  total: number;
  empty: boolean;
  onIncrease: (id: string, shopId: string) => void;
  onDecrease: (id: string, shopId: string) => void;
  onRemove: (id: string, shopId: string) => void;
}

export interface CheckoutShellProps {
  cartItems: ReactNode;
  deliveryModes: ReactNode;
  addressPicker: ReactNode | null;
  /** Rendered when two delivery options (queek/vendor) are available for customer selection */
  deliverySourcePicker: ReactNode | null;
  /** Rendered when delivery_mode is 'shipping' — lets customer pick a shipping zone */
  shippingZonePicker: ReactNode | null;
  schedulePicker: ReactNode | null;
  paymentPicker: ReactNode;
  promoInput: ReactNode;
  noteInputs: ReactNode;
  feesBreakdown: ReactNode;
  deliveryMessage: { type: 'warning' | 'danger'; message: string } | null;
  submitButton: ReactNode;
  /** Whether the customer is signed in. Shells that skip the summary→checkout
   *  step (e.g. the QR single-modal sheet) use this to show a sign-in CTA that
   *  routes guests into the auth flow via `onTabChange('checkout')`. */
  isAuthenticated?: boolean;
  activeTab: 'summary' | 'checkout';
  onTabChange: (tab: 'summary' | 'checkout') => void;
  onBack?: () => void;
  totalCount: number;
  subtotal: number;
  currency: string;
  mode?: 'page' | 'panel';
  /** Published policies (refund/shipping/privacy/terms) for the checkout footer links. */
  policies: Page[];
}

export interface LoginShellProps {
  children: ReactNode;
}

export interface SignupShellProps {
  children: ReactNode;
}

export interface AccountShellProps {
  children: ReactNode;
}

export interface ProductCardProps {
  product: Product;
  href?: string;
}

export interface ThemeContextValue {
  vendor: VendorProfile;
  config: StorefrontConfig;
}

export interface ProductsBlockProps extends ProductsBlockData {
  products?: Product[];
}

export interface CategoriesBlockProps extends CategoriesBlockData {
  categories?: Array<{ id: string; slug: string; name: string; image?: string | null }>;
}

export interface BlogBlockProps extends BlogBlockData {
  posts?: Post[];
}

export type ThemeManifestFieldType =
  | 'string'
  | 'text'
  | 'markdown'
  | 'image'
  | 'url'
  | 'int'
  | 'number'
  | 'boolean'
  | 'color'
  | 'string[]'
  /** A list of image urls (plain strings) — e.g. photographs between a marquee's phrases. The merchant editor renders a media picker per entry. */
  | 'image[]'
  | 'object'
  | 'object[]'
  | 'enum';

export interface ThemeManifestField {
  type: ThemeManifestFieldType;
  required?: boolean;
  note?: string;
  default?: string | number | boolean | null;
  options?: string[];
  of?: Record<string, ThemeManifestField>;
}

export interface ThemeManifestVariant {
  id: string;
  label: string;
  default?: boolean;
  purpose?: string;
  /**
   * The data fields this variant's component actually renders. During the
   * incremental migration, an existing prose string remains valid. Converted
   * content fields use FieldDefinition so the merchant editor reads a closed
   * control type while Qee receives the same explanatory note from the backend.
   */
  fields?: Record<string, string | ThemeManifestField>;
  /**
   * Which design-token LEAVES (`DesignTokenAxisPath` — see its doc comment
   * in vendor.ts) this variant's rendered markup actually consumes via CSS
   * vars, i.e. which controls a per-section `block.tokens` override on THIS
   * variant will visibly change. Authored next to the component/CSS that
   * consumes the vars so it can't drift — flows verbatim through
   * generate-theme-registry.ts → registry.json → Laravel's Theme.variants →
   * ThemeManifestService (mirrors `fields`).
   *
   * Granular per sub-control, NOT per parent dimension — `'shape'` is not a
   * valid entry; declare `'shape.radius'` and/or `'shape.border_weight'`
   * independently, since one can be CSS-var-driven while the other is a
   * hardcoded literal on the same or a sibling element (same for `image.*`
   * and `color.*`). Declare `image.*` entries only once that variant's image
   * element(s) are actually wired to the corresponding `--image-*` var (see
   * each theme's own theme.css). If a variant renders no image, omit all
   * `image.*` entries.
   *
   * No back-compat default: an omitted `editable` (or an omitted leaf) means
   * NOT stylable for that control — every variant in every theme has an
   * explicit, audited array as of the 2026-08-03 granular pass.
   */
  editable?: DesignTokenAxisPath[];
  /**
   * Business buckets this variant is a strong fit for, as
   * `config/category_packs.php` keys ONLY (queek_backend): food | supermarket |
   * product | pharmacy | laundry | delivery | service | gas-refill |
   * local_market. Omitted = universal. Authored next to the component (same
   * anti-drift placement as `fields`/`editable`) and flows verbatim through
   * generate-theme-registry.ts -> registry.json -> Laravel's Theme.variants ->
   * ThemeManifestService, where BuildHomepageTool's scored resolver boosts a
   * bucket match when auto-building a store. The backend matches buckets with
   * `_`/`-` treated as equivalent.
   */
  best_for?: string[];
  /**
   * Default true. false = the AI store builder must never auto-select this
   * variant (special-purpose layouts: review-screenshot walls, decorative
   * galleries, checkout/focused chrome). Manual/qee selection stays allowed.
   */
  auto_pick?: boolean;
  /**
   * Gallery scope only: minimum slides this variant needs to render well
   * (e.g. mosaic collages need 3). The builder gates on the vendor's actual
   * hero slide count. Omitted = 1.
   */
  min_images?: number;
  /**
   * Gallery hero variants only, in a theme that also declares an "overlay"
   * header: does this hero present a dark, full-bleed area directly behind
   * the nav, so a transparent header with white text reads clearly over it?
   * The backend resolves the `header` scope per vendor from this — a hero
   * declaring `true` gets the overlay header, everything else gets a solid
   * one. Declared per variant (audited against the actual component/CSS),
   * never inferred from the id — "does it have images" is not the same
   * question, and "does it have a photo" isn't either: a variant can be
   * full of photos and still have no dark band under the nav (a side-by-side
   * split with a light copy panel, a gapped multi-panel diptych).
   */
  supports_overlay_header?: boolean;
  /**
   * Header scope only: the inverse of `supports_overlay_header` — does THIS
   * header variant need a hero that can carry a transparent bar to make
   * sense at all? Omitted = false (a solid/always-visible header works
   * regardless of what hero, if any, precedes it). The backend resolver
   * reads both flags without ever checking a header's own id, so a theme is
   * free to name its transparent header anything, or make a solid one the
   * default, without breaking resolution.
   */
  requires_overlay_hero?: boolean;
}

export interface ThemeImageSpec {
  width: number;
  height: number;
  label: string;
}

export interface ThemeManifest {
  name: string;
  slug: string;
  description: string;
  version: string;
  variants: Record<string, ThemeManifestVariant[]>;
  /**
   * A per-scope migration marker. A marked scope may only contain structured
   * field metadata; an unmarked scope remains transitional. More scopes can
   * be added without creating a parallel top-level marker for each one.
   */
  fields_contract?: Partial<Record<string, 'structured'>>;
  features?: string[];
  images?: Record<string, ThemeImageSpec>;
  /**
   * Theme's default semantic design-token set (design-token-contract.md,
   * queek_backend `.agent/.tmp/`) — the theme's current look expressed as
   * tokens. Surfaced via `ThemeManifestService`/registry.json as the
   * baseline the backend resolver layers vendor `tokens` overrides onto
   * (theme defaults ← legacy fields ← vendor overrides). Optional during
   * the pilot rollout — themes without it fall back to the storefront
   * injector's own hardcoded defaults (`lib/core/utils/brand.ts`).
   */
  tokens?: DesignTokens;
  /**
   * The theme's English default dictionary — the theme's own English
   * locale file (authored as `en.default.json` in the theme's `locales/`
   * dir and imported as an object) referenced here.
   * Same shape as the kit core English default
   * (nested objects by dot-path, or flat dotted keys; CLDR plural maps
   * allowed); keys follow the shared grammar (dotted lowercase, <= 40
   * chars) because the backend overlay stores `<theme-slug>.<key>` in a
   * varchar(64).
   *
   * The kit layers it between the host-loaded locale dictionaries and the
   * kit core English, so ANY host that mounts the theme (vendor layout,
   * theme preview, CLI dev preview) renders the theme's English with zero
   * host cooperation — a host that passes nothing still shows English,
   * never empty labels. ENGLISH ONLY: non-English packs stay host-loaded
   * per locale and are never bundled into the theme. Optional during the
   * migration — a manifest without it behaves exactly as before (kit core
   * English, then `''` for unknown keys).
   */
  strings?: ThemeStringsDictionary;
}

/**
 * Block types that are framework-owned (React logic ships in core, themes
 * only style via `.core-block-*` CSS). Themes do NOT implement these.
 */
export type FrameworkBlockType = 'divider' | 'embed' | 'video' | 'table' | 'button' | 'image' | 'reviews' | 'faq' | 'callout' | 'quote' | 'product_qa' | 'metaobjects';

/**
 * Block types the theme is responsible for implementing. Framework-owned
 * types are excluded — page-renderer routes those directly to core.
 *
 * `content` is theme-owned for structured variants (promo, brand-story,
 * testimonials, marquee, etc.), but the default markdown variant is
 * framework-owned at the renderer level.
 */
export type ThemeBlockType = Exclude<BlockType, FrameworkBlockType>;

export type ThemeBlocks = {
  [K in ThemeBlockType]: FC<BlockDataMap[K]>;
};

export interface ThemeModule {
  Layout: FC<LayoutProps>;
  /** @deprecated Use getHeader(variant) instead */
  Header: FC<HeaderProps>;
  /** @deprecated Use getFooter(variant) instead */
  Footer: FC<FooterProps>;
  /** @deprecated Use getBlock(type, variant) instead */
  blocks: ThemeBlocks;
  getHeader: (variant?: string) => FC<HeaderProps>;
  getFooter: (variant?: string) => FC<FooterProps>;
  getBlock: <T extends ThemeBlockType>(type: T, variant?: string) => ThemeBlocks[T];
  pages: {
    Home: FC<HomePageProps>;
    Page: FC<GenericPageProps>;
    Blog: FC<BlogPageProps>;
    Post: FC<PostPageProps>;
    Shop?: FC<ShopPageProps>;
    Collections?: FC<CollectionsPageProps>;
    /** Optional override for the `/policies` listing. When absent, core renders
     *  `DefaultPoliciesPage` (themeable via `.core-policies-*` CSS). */
    Policies?: FC<PoliciesPageProps>;
    Collection: FC<CollectionPageProps>;
    Product: FC<ProductPageProps>;
    Gallery: FC<GalleryPageProps>;
    /** Optional override for a metaobject entry's own page (`/{type}/{handle}`,
     *  only routed when the definition has `has_pages`). When absent, core
     *  renders `DefaultMetaobjectPage` (themeable via `.core-metaobject-page-*`
     *  CSS), same fallback pattern as `Policies`. */
    Metaobject?: FC<MetaobjectPageProps>;
  };
  shells?: {
    CartShell?: FC<CartShellProps>;
    CheckoutShell?: FC<CheckoutShellProps>;
    LoginShell?: FC<LoginShellProps>;
    SignupShell?: FC<SignupShellProps>;
    AccountShell?: FC<AccountShellProps>;
  };
  productCard?: FC<ProductCardProps>;
  ModalLayer?: FC;
  /** Optional override for the default auth modal presentation. Theme can
   *  wrap <AuthFlow /> in any layout (sidebar, full-page split, inline card, etc). */
  AuthRenderer?: FC;
  manifest: ThemeManifest;
}
