'use client';

import { useAuthFlow } from '../../hooks/use-auth-flow';

export function AuthSignupStep(): JSX.Element {
  const {
    firstName, setFirstName,
    lastName, setLastName,
    submitRegister,
    loading, error,
    goToEmailOtp,
  } = useAuthFlow();

  return (
    <div className="core-auth__step core-auth__step--signup">
      <h2 className="core-auth__title">Create your account</h2>
      <p className="core-auth__sub">Just a few details to get you started</p>

      <input
        type="text"
        className="core-input"
        placeholder="First name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        autoComplete="given-name"
        autoFocus
      />
      <input
        type="text"
        className="core-input"
        placeholder="Last name (optional)"
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
        {loading ? 'Creating account…' : 'Create account'}
      </button>

      <button type="button" className="core-auth__link" onClick={goToEmailOtp}>
        ← Use a different email
      </button>
    </div>
  );
}
