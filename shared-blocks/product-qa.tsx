'use client';

import type { JSX } from 'react';
import { useState } from 'react';
import type { ProductQaBlockData, ProductQuestionItem } from '../types/block';
import { Image } from '../components/image';
import { useProductQuestions } from '../hooks/use-product-questions';
import { useAuth } from '../hooks/use-auth';
import { useStorefront } from '../provider';
import { getQueekClient } from '../sdk/queek-client';

const MAX_QUESTION_LENGTH = 1000;

/**
 * Framework-owned Product Q&A block. Renders answered customer questions
 * fetched from `GET /client/store/products/{slug}/questions` and lets
 * authenticated customers ask new ones via `POST` to the same path. Themes
 * style via `.core-block-product-qa` and its `__` sub-elements.
 */
export function CoreProductQaBlock(props: ProductQaBlockData): JSX.Element {
  const { questions, isLoading } = useProductQuestions(props);
  const title = props.title;
  const hasQuestions = questions.length > 0;

  return (
    <section className="core-block core-block-product-qa" data-loading={isLoading ? 'true' : undefined}>
      <header className="core-block-product-qa__header">
        {title ? <h2 className="core-block-product-qa__title">{title}</h2> : null}
        <AskQuestionPanel productSlug={props.product_slug} />
      </header>

      {!hasQuestions && !isLoading && (
        <p className="core-block-product-qa__empty">No questions yet — be the first to ask.</p>
      )}

      {hasQuestions && (
        <div className="core-block-product-qa__list">
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </div>
      )}
    </section>
  );
}

function AskQuestionPanel({ productSlug }: { productSlug: string }): JSX.Element {
  const { vendor } = useStorefront();
  const { user, openAuthModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleOpen = (): void => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    setSubmitted(false);
    setOpen(true);
  };

  const handleCancel = (): void => {
    setOpen(false);
    setError(null);
    setQuestion('');
  };

  const handleSubmit = async (): Promise<void> => {
    const trimmed = question.trim();
    if (!trimmed) {
      setError('Please write a question.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const client = getQueekClient(vendor.slug ?? undefined);
      await client.post(`/client/store/products/${productSlug}/questions`, { question: trimmed });
      setOpen(false);
      setQuestion('');
      setSubmitted(true);
    } catch {
      setError('Could not submit your question. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="core-block-product-qa__ask">
        <p className="core-block-product-qa__thanks">
          Thanks — we&apos;ll notify you when the vendor answers.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="core-block-product-qa__ask">
        <button type="button" className="core-block-product-qa__ask-btn" onClick={handleOpen}>
          Ask a question
        </button>
      </div>
    );
  }

  return (
    <div className="core-block-product-qa__ask core-block-product-qa__ask--open">
      <textarea
        className="core-block-product-qa__textarea"
        rows={3}
        maxLength={MAX_QUESTION_LENGTH}
        placeholder="What would you like to know about this product?"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        disabled={submitting}
      />
      {error ? <p className="core-block-product-qa__error">{error}</p> : null}
      <div className="core-block-product-qa__ask-actions">
        <button
          type="button"
          className="core-block-product-qa__cancel-btn"
          onClick={handleCancel}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="core-block-product-qa__submit-btn"
          onClick={() => void handleSubmit()}
          disabled={submitting || question.trim().length === 0}
        >
          {submitting ? 'Submitting…' : 'Submit question'}
        </button>
      </div>
    </div>
  );
}

function QuestionCard({ question }: { question: ProductQuestionItem }): JSX.Element {
  return (
    <article className="core-block-product-qa__card">
      <header className="core-block-product-qa__card-head">
        <div className="core-block-product-qa__avatar">
          {question.user.avatar ? (
            <Image
              src={question.user.avatar}
              alt={question.user.name}
              className="core-block-product-qa__avatar-img"
            />
          ) : (
            <span className="core-block-product-qa__avatar-initials" aria-hidden="true">
              {initialsFor(question.user.name)}
            </span>
          )}
        </div>
        <div className="core-block-product-qa__card-meta">
          <p className="core-block-product-qa__author">{question.user.name}</p>
          <p className="core-block-product-qa__date">{formatDate(question.created_at)}</p>
        </div>
      </header>

      <p className="core-block-product-qa__question">{question.question}</p>

      {question.answer ? (
        <div className="core-block-product-qa__answer">
          <p className="core-block-product-qa__answer-label">
            Answered{question.answered_at ? ` · ${formatDate(question.answered_at)}` : ''}
          </p>
          <p className="core-block-product-qa__answer-body">{question.answer}</p>
        </div>
      ) : null}
    </article>
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
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}
