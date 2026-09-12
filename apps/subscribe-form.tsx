'use client';

import type { JSX } from 'react';
import { useCallback, useId, useState } from 'react';
import { useStorefront } from '../provider';
import { getQueekClient } from '../sdk/queek-client';
import type { SubscribeFormProps } from '../types/theme';

type Status = 'idle' | 'saving' | 'done' | 'error';

/**
 * Newsletter capture — the storefront's only way to hand a vendor an email
 * without forcing a full account signup. `FollowCard` requires an account
 * (it opens the auth modal), so before this the cheapest path into a
 * vendor's campaign audience was a whole registration flow.
 *
 * Backed by `POST /client/store/subscribe`, which is public by design: no
 * auth, one field. It answers identically whether the address is new,
 * already subscribed, or previously opted out, so this form can never be
 * used to probe who shops here.
 *
 * The `subscribe` app's `inline` variant (the theme-declared default) — a
 * theme's own `getSubscribeForm` dispatch renders this directly, passing
 * heading/tagline/cta straight through with no gate of its own; gating on
 * `config.apps?.subscribe?.enabled` happens once, centrally, in whichever
 * variant dispatch mounts it (see vendor-shell.tsx / a theme's footer).
 */
export function SubscribeForm({
  heading = 'Stay in the loop',
  tagline = 'New arrivals and offers, straight to your inbox.',
  cta = 'Subscribe',
  layout = 'stacked',
  onSuccess,
}: SubscribeFormProps & { layout?: 'stacked' | 'inline'; onSuccess?: () => void } = {}): JSX.Element {
  const { vendor } = useStorefront();
  const emailId = useId();
  const nameId = useId();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (status === 'saving' || email.trim() === '') return;

      setStatus('saving');
      try {
        const res = await getQueekClient(vendor.slug ?? undefined).post<{ message?: string }>(
          '/client/store/subscribe',
          { email: email.trim(), name: name.trim() || undefined },
        );
        setStatus('done');
        setMessage(res.data?.message ?? "You're subscribed.");
        setName('');
        setEmail('');
        onSuccess?.();
      } catch {
        setStatus('error');
        setMessage('That didn’t go through. Please check the address and try again.');
      }
    },
    [name, email, status, vendor.slug, onSuccess],
  );

  if (status === 'done') {
    return (
      <div className="core-subscribe core-subscribe--done" role="status">
        <p className="core-subscribe__done">{message}</p>
      </div>
    );
  }

  return (
    <div className={`core-subscribe core-subscribe--${layout}`}>
      {heading ? <p className="core-subscribe__heading">{heading}</p> : null}
      {tagline ? <p className="core-subscribe__tagline">{tagline}</p> : null}

      <form className="core-subscribe__form" onSubmit={handleSubmit} noValidate>
        <label className="core-subscribe__label" htmlFor={nameId}>
          Name
        </label>
        <input
          id={nameId}
          className="core-subscribe__input"
          type="text"
          name="name"
          autoComplete="name"
          placeholder="Name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="core-subscribe__label" htmlFor={emailId}>
          Email address
        </label>
        <input
          id={emailId}
          className="core-subscribe__input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === 'error') setStatus('idle');
          }}
          required
        />
        <button className="core-subscribe__button" type="submit" disabled={status === 'saving'}>
          {status === 'saving' ? 'Subscribing…' : cta}
        </button>
      </form>

      {status === 'error' ? (
        <p className="core-subscribe__error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
