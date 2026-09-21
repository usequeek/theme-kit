'use client';

import type { JSX } from 'react';
import { Component, Suspense, use, useEffect, useMemo, type ComponentType, type ReactNode } from 'react';
import type { Block, BlockDataMap, MetaobjectsResolved } from './types/block';
import type { Product } from './types/product';
import { useTheme } from './theme-context';
import { useStorefront } from './provider';
import { expandDesignTokensPartial } from './utils/brand';
import {
  CoreButtonBlock,
  CoreCalloutBlock,
  CoreContentDefaultBlock,
  CoreDividerBlock,
  CoreEmbedBlock,
  CoreQuoteBlock,
  CoreFaqBlock,
  CoreImageBlock,
  CoreMetaobjectsBlock,
  CoreProductQaBlock,
  CoreReviewsBlock,
  CoreTableBlock,
  CoreVideoBlock,
} from './shared-blocks';
import { EditableBlock, useEditMode } from './edit-mode';
import { useEditPreviewStore } from './stores/edit-preview-store';

/**
 * Contains a single section while the merchant is editing.
 *
 * The server sends `_normalized_content` — the same sanitiser the write path
 * uses — so a malformed section (the canonical case being a gallery with a null
 * slide) never reaches a theme component in normal rendering. Sections streamed
 * live from the editor skip that sanitiser by definition: they are mid-edit and
 * have not been saved yet.
 *
 * So one half-typed section must not blank the whole page the vendor is working
 * on. It fails in place, the rest of the page keeps rendering, and the next
 * server payload heals it.
 */
class DraftSectionBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.warn('[edit] a draft section failed to render:', error.message);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <div className="core-draft-section-error" role="status">This section can’t be previewed yet — keep editing.</div>;
  }
}

export function PageRenderer({ blocks }: { blocks: Block[] }): JSX.Element {
  const draftBlocks = useEditPreviewStore((state) => state.blocks);
  const reconcileDraftBlocks = useEditPreviewStore((state) => state.reconcile);

  // A new server payload is authoritative — drop the streamed draft so the
  // debounced save reconciles and a drifted preview cannot outlive a refresh.
  const serverSignature = useMemo(() => JSON.stringify(blocks), [blocks]);
  useEffect(() => {
    reconcileDraftBlocks();
  }, [serverSignature, reconcileDraftBlocks]);

  const theme = useTheme();
  const { config } = useStorefront();
  const defaultVariants = config.default_variants ?? {};
  const editMode = useEditMode();

  const renderBlock = (block: Block, index: number): JSX.Element | null => {
    const variant = block.variant ?? defaultVariants[block.type] ?? undefined;
    const key = `${block.type}-${index}`;
    const node = renderInner(block, variant, key);
    if (node === null) return null;

    // Section-scoped design-token override: only wraps in an extra div when
    // the section actually sets `tokens` — no-override sections render
    // byte-identical to before (no wrapper, no style attribute).
    const tokenVars = block.tokens ? expandDesignTokensPartial(block.tokens) : null;
    const hasTokenVars = !!tokenVars && Object.keys(tokenVars).length > 0;
    // Generic per-section background override. Applied at this single shared
    // wrapper (not per-theme-component) so every block type/theme honors it
    // uniformly instead of each component having to opt in individually.
    const rawBgColor = (block.data as Record<string, unknown> | undefined)?.bg_color;
    const bgColor = typeof rawBgColor === 'string' && rawBgColor ? rawBgColor : undefined;
    // bg_image takes over from bg_color when set (same mutual-exclusion the
    // theme-level content variants already use for their own image/color
    // pairs, e.g. brand-story's video-takes-over-image). Rendered as a real
    // background-image (not an <img>) so it never disturbs the section's own
    // document flow/height — the section sizes itself exactly as it would
    // with a solid bg_color.
    const rawBgImage = (block.data as Record<string, unknown> | undefined)?.bg_image;
    const bgImage = typeof rawBgImage === 'string' && rawBgImage ? rawBgImage : undefined;
    const rawBgOverlay = (block.data as Record<string, unknown> | undefined)?.bg_overlay;
    const bgOverlay = (['none', 'light', 'medium', 'strong'] as const).includes(rawBgOverlay as never)
      ? (rawBgOverlay as 'none' | 'light' | 'medium' | 'strong')
      : 'medium';
    // A flat scrim, not a directional gradient — unlike a theme's own hero
    // (fixed copy position, so a gradient can be tuned to sit exactly under
    // the text), this wrapper hosts arbitrary block content in an unknown
    // position, so a uniform darken is the only overlay that's guaranteed to
    // help regardless of where the section's own text ends up. Forcing
    // `color: #fff` alongside it is deliberate, not decorative — the same
    // "on_accent independently defaulting to something unrelated" trap that
    // broke Taylor's checkout (2026-08-21, see brand.ts's
    // ensureReadableOnAccent) applies here too: a theme's own default text
    // color was never chosen with an arbitrary vendor photo behind it, so
    // legibility can't be left to inherit from wherever the theme happens to
    // default to. `!important`-equivalent isn't needed — this is the
    // closest ancestor rule, and CSS3 UI text is dark by default in every
    // theme (see brand.ts's own comment on directly-matched rules winning
    // over inherited ones for exactly the fix this exists to preempt).
    const OVERLAY_ALPHA: Record<'none' | 'light' | 'medium' | 'strong', number> = {
      none: 0,
      light: 0.25,
      medium: 0.45,
      strong: 0.65,
    };

    let content = node;
    if (bgColor || bgImage) {
      // Full-bleed band: `.content-stack`'s ancestor (`.ql-page-body`) is a
      // centered, padded reading column (max-width + margin:auto), so a plain
      // background-color here would only paint that narrow column, not a true
      // edge-to-edge band. The standard breakout (100vw + negative margins)
      // escapes that constraint; the block's own `.ql-container` (rendered by
      // every theme's section components, itself self-centering/self-capped —
      // app/storefront.css) keeps the actual content at the normal reading
      // width, so only the color bleeds full-width, not the content.
      content = (
        <div
          style={{
            ...(hasTokenVars ? tokenVars : {}),
            ...(bgImage
              ? {
                  backgroundImage: `url(${bgImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  color: '#fff',
                }
              : { backgroundColor: bgColor }),
            position: 'relative',
            width: '100vw',
            marginLeft: 'calc(50% - 50vw)',
            marginRight: 'calc(50% - 50vw)',
            // `.content-stack` (globals.css) is `display:grid`, gapped by
            // the `--content-stack-gap` custom property (1rem by default) —
            // a sensible default for a plain content page's paragraphs/
            // images, but for a colored band it leaves a seam of the page's
            // own background between adjacent sections, breaking the "solid
            // band" look (confirmed live: 16px, exactly the default gap).
            // Pull this section half a gap into the space above/below it;
            // when the neighbor is ALSO a bg_color band doing the same, the
            // two halves meet and the seam closes to zero. Derives from the
            // SAME variable `.content-stack` sets — never a hardcoded
            // number — so a theme override of the gap (e.g. nova zeroes it
            // entirely) can't silently desync this from the real value and
            // cause an overlap instead of a clean seam-close. Plain
            // (non-colored) blocks are untouched either way.
            marginBlock: 'calc(var(--content-stack-gap, 1rem) / -2)',
          }}
        >
          {bgImage && OVERLAY_ALPHA[bgOverlay] > 0 ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: `rgba(0, 0, 0, ${OVERLAY_ALPHA[bgOverlay]})`,
                pointerEvents: 'none',
              }}
            />
          ) : null}
          <div style={bgImage ? { position: 'relative', zIndex: 1 } : undefined}>{node}</div>
        </div>
      );
    } else if (hasTokenVars) {
      content = <div style={tokenVars}>{node}</div>;
    }

    const wrapped = (
      <EditableBlock key={key} index={index} type={block.type} variant={variant} enabled={editMode}>
        {content}
      </EditableBlock>
    );

    // `display: contents` (app/storefront.css) — draws no box of its own, so
    // it never disturbs the section's own layout. Only wraps when the section
    // actually has an anchor_id (menu-linked landing-page sections); every
    // other section renders byte-identical to before.
    if (!block.anchor_id) return wrapped;
    return (
      <div key={`anchor-${key}`} id={block.anchor_id} className="qk-anchor">
        {wrapped}
      </div>
    );
  };

  const rendered = editMode && draftBlocks ? draftBlocks : blocks;

  const usingDraft = editMode && !!draftBlocks;

  return (
    <div className="content-stack">
      {rendered.map((block, index) =>
        usingDraft
          ? <DraftSectionBoundary key={`draft-${index}`}>{renderBlock(block, index)}</DraftSectionBoundary>
          : renderBlock(block, index),
      )}
    </div>
  );

  function renderInner(block: Block, variant: string | undefined, key: string): JSX.Element | null {
    switch (block.type) {
          case 'content': {
            // Ensure `markdown` is always a string — structured variants (promo,
            // brand-story, testimonials) may omit it, but theme components
            // destructure it from ContentBlockData and call .split()/.trim().
            // Spreading with a default prevents undefined crashes across all themes.
            const data = { markdown: '', ...(block.data as Record<string, unknown>) } as BlockDataMap['content'] & Record<string, unknown>;
            if (!variant || variant === 'default') {
              return <CoreContentDefaultBlock key={key} {...data} />;
            }
            const Component = theme.getBlock('content', variant);
            return <Component key={key} {...data} />;
          }
          case 'image': {
            // Framework-owned.
            const data = block.data as BlockDataMap['image'];
            return <CoreImageBlock key={key} {...data} />;
          }
          case 'gallery': {
            const Component = theme.getBlock('gallery', variant);
            const data = block.data as BlockDataMap['gallery'];
            return <Component key={key} {...data} />;
          }
          case 'video': {
            // Framework-owned.
            const data = block.data as BlockDataMap['video'];
            return <CoreVideoBlock key={key} {...data} />;
          }
          case 'table': {
            // Framework-owned.
            const data = block.data as BlockDataMap['table'];
            return <CoreTableBlock key={key} {...data} />;
          }
          case 'button': {
            // Framework-owned.
            const data = block.data as BlockDataMap['button'];
            return <CoreButtonBlock key={key} {...data} />;
          }
          case 'embed': {
            // Framework-owned.
            const data = block.data as BlockDataMap['embed'];
            return <CoreEmbedBlock key={key} {...data} />;
          }
          case 'divider': {
            // Framework-owned.
            const data = block.data as BlockDataMap['divider'];
            return <CoreDividerBlock key={key} {...data} />;
          }
          case 'callout': {
            // Framework-owned.
            const data = { markdown: '', ...(block.data as Record<string, unknown>) } as BlockDataMap['callout'];
            return <CoreCalloutBlock key={key} {...data} />;
          }
          case 'quote': {
            // Framework-owned.
            const data = block.data as BlockDataMap['quote'];
            return <CoreQuoteBlock key={key} {...data} />;
          }
          case 'products': {
            const Component = theme.getBlock('products', variant);
            const data = block.data as BlockDataMap['products'];

            if (!block.productsPromise) {
              // No server-seeded promise (a route that hasn't called
              // `hydrateProductBlocks` yet) — theme falls back to its own
              // `useProducts()` client fetch, unchanged from before.
              return <Component key={key} {...data} />;
            }

            return (
              <Suspense key={key} fallback={<ProductsBlockFallback title={data.title} limit={data.limit} />}>
                <ProductsBlockResolved Component={Component} data={data} promise={block.productsPromise} />
              </Suspense>
            );
          }
          case 'categories': {
            const Component = theme.getBlock('categories', variant);
            const data = block.data as BlockDataMap['categories'];
            return <Component key={key} {...data} />;
          }
          case 'contact': {
            const Component = theme.getBlock('contact', variant);
            const data = block.data as BlockDataMap['contact'];
            return <Component key={key} {...data} />;
          }
          case 'blog': {
            const Component = theme.getBlock('blog', variant);
            const data = block.data as BlockDataMap['blog'];
            return <Component key={key} {...data} />;
          }
          case 'reviews': {
            // Framework-owned.
            const data = block.data as BlockDataMap['reviews'];
            const dataWithLayout = { ...data, layout: data.layout ?? (variant as BlockDataMap['reviews']['layout']) ?? 'grid' };
            return <CoreReviewsBlock key={key} {...dataWithLayout} />;
          }
          case 'faq': {
            // Framework-owned.
            const data = block.data as BlockDataMap['faq'];
            return <CoreFaqBlock key={key} {...data} />;
          }
          case 'product_qa': {
            // Framework-owned.
            const data = block.data as BlockDataMap['product_qa'];
            return <CoreProductQaBlock key={key} {...data} />;
          }
          case 'metaobjects': {
            // Framework-owned. Themes never fetch metaobjects client-side —
            // without a server-seeded promise (a route that hasn't called
            // `hydrateProductBlocks`), the block renders nothing rather than
            // falling back to a client fetch (mirrors `products`' fallback
            // being a THEME concern only because that block is theme-owned).
            const data = block.data as BlockDataMap['metaobjects'];
            if (!block.metaobjectsPromise) return null;

            return (
              <Suspense key={key} fallback={<MetaobjectsBlockFallback title={data.title} limit={data.limit} />}>
                <MetaobjectsBlockResolved data={data} promise={block.metaobjectsPromise} />
              </Suspense>
            );
          }
          default:
            return null;
    }
  }
}

/** Unwraps a server-seeded product promise and hands the result straight to
 *  the theme's `products` component as its `products` prop — the same prop
 *  every theme block already treats as "I have data, skip my own fetch". */
function ProductsBlockResolved({
  Component,
  data,
  promise,
}: {
  Component: ComponentType<BlockDataMap['products'] & { products?: Product[] }>;
  data: BlockDataMap['products'];
  promise: Promise<Product[]>;
}): JSX.Element {
  const products = use(promise);
  return <Component {...data} products={products} />;
}

/**
 * Shown only while a `products` block's server-side fetch is still pending —
 * in practice, only on a cache-cold request (a vendor's first hit after the
 * 60s TTL). A warm cache resolves before this ever paints. Deliberately
 * theme-neutral (not a per-theme skeleton) since it is the rare-path
 * placeholder for a boundary that sits above every theme's own component.
 */
function ProductsBlockFallback({ title, limit }: { title?: string | null; limit?: number }): JSX.Element {
  return (
    <section aria-hidden="true">
      {title ? <h2>{title}</h2> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: limit ?? 4 }).map((_, i) => (
          <div key={i} style={{ aspectRatio: '3 / 4', borderRadius: 8, background: 'rgba(127,127,127,0.15)' }} />
        ))}
      </div>
    </section>
  );
}

/** Unwraps a server-seeded metaobjects promise and hands the resolved entries
 *  + definition straight to `CoreMetaobjectsBlock`. */
function MetaobjectsBlockResolved({
  data,
  promise,
}: {
  data: BlockDataMap['metaobjects'];
  promise: Promise<MetaobjectsResolved>;
}): JSX.Element | null {
  const resolved = use(promise);
  return (
    <CoreMetaobjectsBlock
      title={data.title}
      layout={data.layout ?? 'grid'}
      entries={resolved.entries}
      definition={resolved.definition}
    />
  );
}

/**
 * Shown only while a `metaobjects` block's server-side fetch is still
 * pending (cache-cold request). Deliberately theme-neutral, same rationale
 * as `ProductsBlockFallback`.
 */
function MetaobjectsBlockFallback({ title, limit }: { title?: string | null; limit?: number }): JSX.Element {
  return (
    <section aria-hidden="true">
      {title ? <h2>{title}</h2> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: limit ?? 12 }).map((_, i) => (
          <div key={i} style={{ minHeight: 160, borderRadius: 8, background: 'rgba(127,127,127,0.15)' }} />
        ))}
      </div>
    </section>
  );
}
