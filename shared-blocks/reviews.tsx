'use client';

import type { JSX } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ReviewItem, ReviewsBlockData, ReviewsSummary } from '../types/block';
import { Image } from '../components/image';
import { useReviews } from '../hooks/use-reviews';
import { useStorefront } from '../provider';
import { formatDisplayDate } from '../utils/format';

/**
 * Framework-owned reviews block. Renders verified, platform-generated reviews
 * fetched from `GET /client/store/reviews`. Themes style via `.core-block-reviews`
 * and `.core-block-reviews--{layout}`.
 */
export function CoreReviewsBlock(props: ReviewsBlockData): JSX.Element {
  const layout = props.layout ?? 'grid';
  const { reviews, summary, isLoading } = useReviews(props);
  const title = props.title;

  const hasReviews = reviews.length > 0;

  return (
    <section
      className={`core-block core-block-reviews core-block-reviews--${layout}`}
      data-loading={isLoading ? 'true' : undefined}
    >
      {(title || summary.total_reviews > 0) && (
        <header className="core-block-reviews__header">
          {title ? <h2 className="core-block-reviews__title">{title}</h2> : null}
          {summary.total_reviews > 0 && (
            <div className="core-block-reviews__summary" aria-label="Average rating">
              <Stars rating={summary.average_rating} />
              <span className="core-block-reviews__summary-text">
                <strong>{summary.average_rating.toFixed(1)}</strong>
                <span>·</span>
                <span>{summary.total_reviews} review{summary.total_reviews === 1 ? '' : 's'}</span>
              </span>
            </div>
          )}
        </header>
      )}

      {!hasReviews && !isLoading && (
        <p className="core-block-reviews__empty">No reviews yet.</p>
      )}

      {hasReviews && layout === 'compact' && <CompactList reviews={reviews} summary={summary} />}
      {hasReviews && layout === 'carousel' && <ReviewsCarousel reviews={reviews} />}
      {hasReviews && layout === 'spotlight' && <SpotlightReviews reviews={reviews} />}
      {hasReviews && layout === 'minimal' && <MinimalList reviews={reviews} />}
      {hasReviews && layout !== 'compact' && layout !== 'carousel' && layout !== 'spotlight' && layout !== 'minimal' && (
        <div className={`core-block-reviews__list core-block-reviews__list--${layout}`}>
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Carousel layout with prev/next controls. The list keeps its native
 * scroll-snap (touch swipe still works); the arrows scroll by one card width
 * for pointer users. Arrows are hidden on small screens (swipe instead) AND
 * whenever the list doesn't actually overflow its container — a handful of
 * reviews that already fit in full has nothing to scroll to, so showing
 * "scroll" affordances there is just decorative noise.
 */
function ReviewsCarousel({ reviews }: { reviews: ReviewItem[] }): JSX.Element {
  const listRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ prev: false, next: false });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const update = (): void => {
      const overflows = el.scrollWidth - el.clientWidth > 4;
      setCanScroll({
        prev: overflows && el.scrollLeft > 4,
        next: overflows && el.scrollLeft < el.scrollWidth - el.clientWidth - 4,
      });
    };

    update();
    el.addEventListener('scroll', update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [reviews]);

  const scrollByCards = (dir: number): void => {
    const el = listRef.current;
    if (!el) {
      return;
    }
    const card = el.querySelector<HTMLElement>('.core-block-reviews__card');
    const amount = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };

  return (
    <div className="core-block-reviews__carousel">
      {canScroll.prev ? (
        <button
          type="button"
          className="core-block-reviews__nav core-block-reviews__nav--prev"
          onClick={() => scrollByCards(-1)}
          aria-label="Previous reviews"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : null}
      <div ref={listRef} className="core-block-reviews__list core-block-reviews__list--carousel">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
      {canScroll.next ? (
        <button
          type="button"
          className="core-block-reviews__nav core-block-reviews__nav--next"
          onClick={() => scrollByCards(1)}
          aria-label="Next reviews"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/**
 * Spotlight layout — one quote at a time, large and editorial. A genuinely
 * different visual language from the card grid (no card chrome, one voice
 * at a time), not just the same card rearranged.
 */
function SpotlightReviews({ reviews }: { reviews: ReviewItem[] }): JSX.Element {
  const [index, setIndex] = useState(0);
  const active = reviews[index];
  const canNavigate = reviews.length > 1;

  const go = (dir: number): void => {
    setIndex((i) => (i + dir + reviews.length) % reviews.length);
  };

  return (
    <div className="core-block-reviews__spotlight">
      <div className="core-block-reviews__spotlight-row">
        <button
          type="button"
          className="core-block-reviews__spotlight-arrow core-block-reviews__spotlight-arrow--prev"
          onClick={() => go(-1)}
          aria-label="Previous review"
          hidden={!canNavigate}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="core-block-reviews__spotlight-stage">
          <blockquote key={active.id} className="core-block-reviews__spotlight-slide">
            <span className="core-block-reviews__spotlight-glyph" aria-hidden="true">&#8220;</span>
            <Stars rating={active.rating} />
            {active.title ? <p className="core-block-reviews__spotlight-title">{active.title}</p> : null}
            {active.description ? (
              <p className="core-block-reviews__spotlight-body">{active.description}</p>
            ) : null}
            <footer className="core-block-reviews__spotlight-footer">
              <div className="core-block-reviews__avatar">
                {active.user.avatar ? (
                  <Image src={active.user.avatar} alt={active.user.name} className="core-block-reviews__avatar-img" />
                ) : (
                  <span className="core-block-reviews__avatar-initials" aria-hidden="true">
                    {initialsFor(active.user.name)}
                  </span>
                )}
              </div>
              <div className="core-block-reviews__spotlight-meta">
                <p className="core-block-reviews__author">{active.user.name}</p>
                {active.is_verified_purchase ? (
                  <span className="core-block-reviews__pill core-block-reviews__pill--verified">
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                      <path d="M5 8.5 2.5 6l-.7.7L5 9.9l6.7-6.7-.7-.7z" fill="currentColor" />
                    </svg>
                    Verified buyer
                  </span>
                ) : null}
              </div>
            </footer>
          </blockquote>
        </div>

        <button
          type="button"
          className="core-block-reviews__spotlight-arrow core-block-reviews__spotlight-arrow--next"
          onClick={() => go(1)}
          aria-label="Next review"
          hidden={!canNavigate}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {canNavigate ? (
        <div className="core-block-reviews__spotlight-dots" role="tablist" aria-label="Choose a review">
          {reviews.map((r, i) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Review ${i + 1} of ${reviews.length}`}
              className={`core-block-reviews__spotlight-dot${i === index ? ' is-active' : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Minimal layout — no card chrome at all, a tight text-forward list divided
 * by hairlines. For brands whose whole language is restraint (industrial,
 * quiet-luxury) where card backgrounds/shadows would read as noise.
 */
function MinimalList({ reviews }: { reviews: ReviewItem[] }): JSX.Element {
  return (
    <ul className="core-block-reviews__minimal">
      {reviews.map((review) => (
        <li key={review.id} className="core-block-reviews__minimal-item">
          <div className="core-block-reviews__minimal-head">
            <Stars rating={review.rating} small />
            <p className="core-block-reviews__author">{review.user.name}</p>
            <p className="core-block-reviews__date">{formatDate(review.created_at)}</p>
            {review.is_verified_purchase ? (
              <span className="core-block-reviews__pill core-block-reviews__pill--verified">Verified buyer</span>
            ) : null}
          </div>
          {review.title ? <p className="core-block-reviews__minimal-title">{review.title}</p> : null}
          {review.description ? (
            <p className="core-block-reviews__minimal-body">{review.description}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ReviewCard({ review }: { review: ReviewItem }): JSX.Element {
  return (
    <article className="core-block-reviews__card">
      <header className="core-block-reviews__card-head">
        <div className="core-block-reviews__avatar">
          {review.user.avatar ? (
            <Image src={review.user.avatar} alt={review.user.name} className="core-block-reviews__avatar-img" />
          ) : (
            <span className="core-block-reviews__avatar-initials" aria-hidden="true">
              {initialsFor(review.user.name)}
            </span>
          )}
        </div>
        <div className="core-block-reviews__card-meta">
          <p className="core-block-reviews__author">{review.user.name}</p>
          <p className="core-block-reviews__date">{formatDate(review.created_at)}</p>
        </div>
        <Stars rating={review.rating} />
      </header>

      {review.title ? <h3 className="core-block-reviews__card-title">{review.title}</h3> : null}
      {review.description ? <p className="core-block-reviews__card-body">{review.description}</p> : null}

      {review.media && review.media.length > 0 && (
        <div className="core-block-reviews__media">
          {review.media.map((m, i) =>
            m.type === 'image' ? (
              <Image
                key={i}
                src={m.url}
                alt={review.title ?? review.user.name}
                className="core-block-reviews__media-img"
              />
            ) : (
              <video key={i} src={m.url} className="core-block-reviews__media-video" controls />
            ),
          )}
        </div>
      )}

      {review.vendor_response ? <VendorReply review={review} /> : null}

      <footer className="core-block-reviews__card-foot">
        {review.is_verified_purchase ? (
          <span className="core-block-reviews__pill core-block-reviews__pill--verified">
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path
                d="M5 8.5 2.5 6l-.7.7L5 9.9l6.7-6.7-.7-.7z"
                fill="currentColor"
              />
            </svg>
            Verified buyer
          </span>
        ) : null}
        {review.product ? (
          <span className="core-block-reviews__product">
            {review.product.thumbnail ? (
              <Image
                src={review.product.thumbnail}
                alt={review.product.title}
                className="core-block-reviews__product-thumb"
              />
            ) : null}
            <span className="core-block-reviews__product-title">{review.product.title}</span>
          </span>
        ) : null}
      </footer>
    </article>
  );
}

function VendorReply({ review }: { review: ReviewItem }): JSX.Element {
  const { vendor } = useStorefront();
  return (
    <div className="core-block-reviews__reply">
      <p className="core-block-reviews__reply-label">Reply from {vendor.name ?? 'the vendor'}</p>
      <p className="core-block-reviews__reply-body">{review.vendor_response}</p>
    </div>
  );
}

function CompactList({
  reviews,
  summary,
}: {
  reviews: ReviewItem[];
  summary: ReviewsSummary;
}): JSX.Element {
  const total = summary.total_reviews || reviews.length;

  return (
    <div className="core-block-reviews__compact">
      <div className="core-block-reviews__compact-breakdown">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = summary.rating_breakdown?.[String(star)] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={star} className="core-block-reviews__compact-row">
              <span className="core-block-reviews__compact-label">{star}★</span>
              <span className="core-block-reviews__compact-bar">
                <span className="core-block-reviews__compact-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="core-block-reviews__compact-count">{count}</span>
            </div>
          );
        })}
      </div>
      <ul className="core-block-reviews__compact-list">
        {reviews.map((review) => (
          <li key={review.id} className="core-block-reviews__compact-item">
            <div className="core-block-reviews__compact-head">
              <Stars rating={review.rating} small />
              <span className="core-block-reviews__compact-author">{review.user.name}</span>
              {review.is_verified_purchase ? (
                <span className="core-block-reviews__pill core-block-reviews__pill--verified">Verified</span>
              ) : null}
            </div>
            {review.title ? <p className="core-block-reviews__compact-title">{review.title}</p> : null}
            {review.description ? (
              <p className="core-block-reviews__compact-body">{review.description}</p>
            ) : null}
            {review.vendor_response ? <VendorReply review={review} /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stars({ rating, small }: { rating: number; small?: boolean }): JSX.Element {
  const rounded = Math.round(rating);
  return (
    <span
      className={`core-block-reviews__stars${small ? ' core-block-reviews__stars--sm' : ''}`}
      aria-label={`${rating} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className="core-block-reviews__star"
          data-filled={i <= rounded ? 'true' : 'false'}
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9 4.8 17.7l1-5.9L1.5 7.7l5.9-.8z" />
        </svg>
      ))}
    </span>
  );
}

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(iso: string): string {
  // Fixed locale + zone: this block renders on the server too (see formatDisplayDate).
  return formatDisplayDate(iso);
}
