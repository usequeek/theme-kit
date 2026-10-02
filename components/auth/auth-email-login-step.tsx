'use client';
import type { JSX } from 'react';
import { useAuthFlow } from '../../hooks/use-auth-flow';
import { useThemeStrings } from '../../provider';

export function AuthEmailLoginStep(): JSX.Element {
  const { email, setEmail, password, setPassword, submitEmailLogin, loading, error, goToEmailRegister, goToEmailOtp } = useAuthFlow();
  const t = useThemeStrings();

  return (
    <div className="core-auth__step core-auth__step--email-login">
      <h2 className="core-auth__title">{t('auth.login.title')}</h2>
      <p className="core-auth__sub">{t('auth.login.subtitle')}</p>
      <input
        type="email"
        className="core-input"
        placeholder={t('auth.login.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        autoFocus
      />
      <input
        type="password"
        className="core-input"
        placeholder={t('auth.login.password')}
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
        {loading ? t('auth.login.signing') : t('auth.login.title')}
      </button>
      <button type="button" className="core-auth__link" onClick={goToEmailRegister}>
        {t('auth.login.create')}
      </button>
      <button type="button" className="core-auth__link" onClick={goToEmailOtp}>
        {t('auth.login.code')}
      </button>
    </div>
  );
}
