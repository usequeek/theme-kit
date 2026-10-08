/**
 * Turns a theme's `demo.json` into the props its components expect.
 *
 * Shipped with the kit so a theme developer can render the demo data every
 * theme carries in its `demo.json`: these are the functions that resolve its
 * block references into real products, categories, posts and collections, so a
 * theme can be previewed running against its own data.
 *
 * Pure and type-only by construction: no `fs`, no `next`, no app imports, so
 * these work identically in any preview.
 */
import type { Block, ReviewItem } from './types/block';
import type { Menu } from './types/menu';
import type { Collection, Page, Post } from './types/page';
import type { Product } from './types/product';
import type { StorefrontConfig, VendorProfile } from './types/vendor';

/**
 * Pure demo-data transforms — no filesystem access, so this file is safe to
 * import from a 'use client' component (unlike `demo.ts`, which pulls in
 * Node's `fs`/`path` for `loadDemoData` and will break the browser bundle if
 * a client component imports a value from it). `demo.ts` re-exports
 * everything here for existing server-component call sites; new client-side
 * code should import from here directly.
 */

export type DemoCategory = { id: string; slug: string; name: string; image?: string | null };

export interface PreviewDemoData {
  profile: VendorProfile;
  config: StorefrontConfig;
  menus: Menu[];
  pages: Record<string, Page>;
  products?: Product[];
  categories?: DemoCategory[];
  // Raw shape varies across themes that predate the `content: Block[]` /
  // `cover_image_url` convention (see `normalizePost`) — kept loose here and
  // normalized on read via `getPosts`/`getPost`.
  posts?: Record<string, unknown>[];
}

export function enrichBlocks(blocks: Block[], demo: PreviewDemoData): Block[] {
  return blocks.map((block) => {
    if (block.type === 'products' && demo.products) {
      const data = (block.data ?? {}) as Record<string, unknown>;
      const title = (data.title as string) ?? '';
      const limit = (data.limit as number) ?? demo.products.length;
      const ids = data.ids as string[] | undefined;
      let items = demo.products;

      if (Array.isArray(ids) && ids.length > 0) {
        // Explicit ids field — preserve order from ids array for section variety
        const byId = new Map(demo.products.map((p) => [p.id, p]));
        items = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
      } else if (/new|arrival/i.test(title)) {
        items = demo.products.filter((product) => product.flags?.is_new);
      } else if (/featured|popular|best|focus|lookbook/i.test(title)) {
        items = demo.products.filter((product) => product.flags?.featured);
      }

      if (items.length === 0) items = demo.products;
      return { ...block, data: { ...block.data, products: items.slice(0, limit) } };
    }

    if (block.type === 'categories' && demo.categories) {
      return { ...block, data: { ...block.data, categories: demo.categories } };
    }

    return block;
  });
}

export function getEnrichedPage<T extends Page>(page: T, demo: PreviewDemoData): T {
  return {
    ...page,
    content: enrichBlocks(page.content ?? [], demo),
  };
}

/**
 * `demo.json`'s `posts` array must mirror the shape of a store's blog posts
 * (`content: Block[]`, `cover_image_url`). Some themes authored it before that
 * convention settled, so this tolerates the older shapes instead of assuming
 * every theme's data is current.
 */
function normalizePost(raw: Record<string, unknown>): Post {
  const legacyMedia = raw.media as { image?: string; thumbnail?: string } | undefined;
  const coverImageUrl =
    (raw.cover_image_url as string | undefined) ?? legacyMedia?.image ?? legacyMedia?.thumbnail ?? null;

  let content = raw.content;
  if (typeof content === 'string') {
    // Legacy raw-HTML content string — convert the handful of tags these
    // themes actually used into one markdown content block rather than
    // rendering literal "<p>"/"<h2>" text.
    const markdown = content
      .replace(/<h2>(.*?)<\/h2>/gi, '\n\n## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/gi, '\n\n### $1\n\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    content = [{ type: 'content', data: { markdown } }];
  }

  return {
    ...raw,
    type: 'post',
    content: Array.isArray(content) ? (content as Block[]) : [],
    cover_image_url: coverImageUrl,
  } as Post;
}

export function getPosts(demo: PreviewDemoData): Post[] {
  return (demo.posts ?? [])
    .map(normalizePost)
    .sort((left, right) => {
      const leftDate = left.published_at ? new Date(left.published_at).getTime() : 0;
      const rightDate = right.published_at ? new Date(right.published_at).getTime() : 0;
      return rightDate - leftDate;
    });
}

/**
 * Vendor-scope reviews for preview surfaces, flattened from the demo's own
 * product reviews.
 *
 * Review-backed sections (beaurify's `content/testimonials`) render real vendor
 * reviews rather than merchant-authored copy — deliberately, see its manifest.
 * But nothing seeded them in preview, so the section returned null everywhere a
 * vendor evaluates it: theme preview, style guide, and the section-library
 * thumbnails. Themes already ship product reviews in demo.json; this exposes
 * them at vendor scope instead of asking every theme to duplicate the data.
 *
 * Demo review records predate `ReviewItem` (`user` is a bare name, the body is
 * `comment`), so both spellings are accepted.
 */
export function getVendorReviews(demo: PreviewDemoData): ReviewItem[] {
  return (demo.products ?? []).flatMap((product) => {
    const raw = (product as unknown as { reviews?: Record<string, unknown>[] }).reviews ?? [];

    return raw.map((review, index): ReviewItem => {
      const author = typeof review.user === 'string'
        ? review.user
        : (review.customer_name as string | null) ?? 'Verified buyer';

      return {
        id: String(review.id ?? `${product.id}-review-${index}`),
        rating: Number(review.rating ?? 5),
        title: (review.title as string | null) ?? null,
        description: (review.description as string | null) ?? (review.comment as string | null) ?? null,
        media: [],
        is_verified_purchase: review.is_verified_purchase !== false,
        created_at: String(review.created_at ?? ''),
        user: { id: `${product.id}-reviewer-${index}`, name: author, avatar: null },
        product: { id: product.id, slug: product.slug, title: product.title, thumbnail: product.media?.thumbnail ?? null },
      };
    });
  });
}

export function getPost(demo: PreviewDemoData, slug: string): Post | null {
  return getPosts(demo).find((post) => post.slug === slug) ?? null;
}

export function getPolicies(demo: PreviewDemoData): Page[] {
  return Object.values(demo.pages).filter((page) => page.type === 'policy');
}

export function getCollections(demo: PreviewDemoData): Collection[] {
  const categories = demo.categories ?? [];
  const products = demo.products ?? [];

  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    name: category.name,
    description: `${category.name} — curated picks from this collection.`,
    image: category.image ?? null,
    mode: 'manual',
    products_count: products.filter((product) => product.categories.some((item) => item.slug === category.slug)).length,
  }));
}

export function getCollection(demo: PreviewDemoData, slug: string): { collection: Collection; products: Product[] } | null {
  const collection = getCollections(demo).find((item) => item.slug === slug);
  if (!collection) return null;

  const products = (demo.products ?? []).filter((product) => product.categories.some((category) => category.slug === slug));

  return {
    collection: {
      ...collection,
      products,
    },
    products,
  };
}
