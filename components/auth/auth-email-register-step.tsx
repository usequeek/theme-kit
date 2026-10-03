'use client';
import type { JSX } from 'react';
import { useAuthFlow } from '../../hooks/use-auth-flow';
import { useThemeStrings } from '../../provider';

export function AuthEmailRegisterStep(): JSX.Element {
  const { firstName, setFirstName, lastName, setLastName, email, setEmail, password, setPassword, submitEmailRegister, loading, error, goToEmailLogin } = useAuthFlow();
  const t = useThemeStrings();

  return (
    <div className="core-auth__step core-auth__step--email-register">
      <h2 className="core-auth__title">{t('auth.register.title')}</h2>
      <p className="core-auth__sub">{t('auth.register.subtitle')}</p>
      <input
        type="text"
        className="core-input"
        placeholder={t('auth.register.first')}
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        autoComplete="given-name"
        autoFocus
      />
      <input
        type="text"
        className="core-input"
        placeholder={t('auth.register.last')}
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        autoComplete="family-name"
      />
      <input
        type="email"
        className="core-input"
        placeholder={t('auth.register.email')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <input
        type="password"
        className="core-input"
        placeholder={t('auth.register.password')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submitEmailRegister(); }}
        autoComplete="new-password"
      />
      {error ? <p className="core-auth__error">{error}</p> : null}
      <button
        type="button"
        className="core-submit-btn"
        onClick={() => void submitEmailRegister()}
        disabled={loading || !firstName.trim() || !email.trim() || password.length < 8}
      >
        {loading ? t('auth.register.creating') : t('auth.register.title')}
      </button>
      <button type="button" className="core-auth__link" onClick={goToEmailLogin}>
        {t('auth.register.signin')}
      </button>
    </div>
  );
}
