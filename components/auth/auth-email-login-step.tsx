'use client';
import type { JSX } from 'react';
import { useAuthFlow } from '../../hooks/use-auth-flow';

export function AuthEmailLoginStep(): JSX.Element {
  const { email, setEmail, password, setPassword, submitEmailLogin, loading, error, goToEmailRegister, goToEmailOtp } = useAuthFlow();

  return (
    <div className="core-auth__step core-auth__step--email-login">
      <h2 className="core-auth__title">Sign in</h2>
      <p className="core-auth__sub">Enter your email and password</p>
      <input
        type="email"
        className="core-input"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoFocus
      />
      <input
        type="password"
        className="core-input"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submitEmailLogin(); }}
        autoComplete="current-password"
      />
      {error ? <p className="core-auth__error">{error}</p> : null}
      <button
        type="button"
        className="core-submit-btn"
        onClick={() => void submitEmailLogin()}
        disabled={loading || !email.trim() || !password}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <button type="button" className="core-auth__link" onClick={goToEmailRegister}>
        Don&apos;t have an account? Create one
      </button>
      <button type="button" className="core-auth__link" onClick={goToEmailOtp}>
        Use an email code instead
      </button>
    </div>
  );
}
