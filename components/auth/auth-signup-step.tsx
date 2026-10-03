'use client';

import type { JSX } from 'react';
import { useAuthFlow } from '../../hooks/use-auth-flow';
import { useThemeStrings } from '../../provider';

export function AuthSignupStep(): JSX.Element {
  const {
    firstName, setFirstName,
    lastName, setLastName,
    submitRegister,
    loading, error,
    goToEmailOtp,
  } = useAuthFlow();
  const t = useThemeStrings();

  return (
    <div className="core-auth__step core-auth__step--signup">
      <h2 className="core-auth__title">{t('auth.signup.title')}</h2>
      <p className="core-auth__sub">{t('auth.signup.subtitle')}</p>

      <input
        type="text"
        className="core-input"
        placeholder={t('auth.signup.first')}
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        autoComplete="given-name"
        autoFocus
      />
      <input
        type="text"
        className="core-input"
        placeholder={t('auth.signup.last')}
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        autoComplete="family-name"
      />
      {error ? <p className="core-auth__error">{error}</p> : null}

      <button
        type="button"
        className="core-submit-btn"
        onClick={() => void submitRegister()}
        onKeyDown={(e) => { if (e.key === 'Enter') void submitRegister(); }}
        disabled={loading || !firstName.trim()}
      >
        {loading ? t('auth.signup.creating') : t('auth.signup.create')}
      </button>

      <button type="button" className="core-auth__link" onClick={goToEmailOtp}>
        {t('auth.signup.different')}
      </button>
    </div>
  );
}
