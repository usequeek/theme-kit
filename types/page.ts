import type { Block } from './block';
import type { ImageVariants, MediaIndex } from './media';
import type { Product } from './product';

export type PageType = 'page' | 'post' | 'gallery' | 'policy';

/**
 * A list page's walk state, as the page-mode storefront routes render it.
 * `current_page` is the page the storefront ASKED for (the API echoes no page
 * number, total or page count) — label it "Page N"; `has_more` from the API
 * decides whether a next page exists.
 */
export interface Pagination {
  current_page?: number;
  per_page?: number;
  has_more?: boolean;
  next_cursor?: string | null;
}

export interface SeoData {
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

export interface Page {
  id: string;
  slug: string;
  type: PageType;
  title: string;
  content: Block[];
  excerpt: string | null;
  cover_image_url: string | null;
  /** StorePageResource:50 — tier map for cover_image_url. */
  cover_image_variants?: ImageVariants | null;
  /**
   * StorePageResource:47 — flat url→tier-map sidecar for every image url
   * referenced inside `content[]`. `content[]` itself is byte-identical to
   * before (block schemas unchanged); a block consumer looks up
   * `mediaIndex[rawUrl] ?? null`. Serialized as an object, so it is `{}` when
   * empty and never null — optional here only because older cached responses
   * and preview/demo fixtures predate the field.
   */
  media_index?: MediaIndex;
  tags: string[];
  seo: SeoData;
  published_at: string | null;
  created_at: string | null;
  /** 'bare' hides the storefront header/nav/footer — a standalone landing
   * page with nothing but its own content. Defaults to 'full' server-side. */
  chrome?: 'full' | 'bare';
  /** Whether the theme's page-title band (the title as a large heading
   * under the nav, above the section content) should render for this page.
   * Defaults to true server-side; the landing-page skill sets it false. */
  show_page_title?: boolean;
}

export interface BlogCategory {
  name: string;
  slug: string;
  posts_count?: number;
}

export interface PostAuthor {
  name: string;
  avatar_url?: string | null;
}

export interface Post extends Page {
  type: 'post';
  blog_categories?: BlogCategory[];
  reading_time?: number | null;
  author?: PostAuthor | null;
  related?: Post[];
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image: string | null;
  /** CollectionResource:27 — beside the unchanged `image`. */
  image_variants?: ImageVariants | null;
  mode: string | null;
  products_count: number;
  products?: Product[];
}
