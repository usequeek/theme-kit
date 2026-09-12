'use client';
import { useAuthFlow } from '../../hooks/use-auth-flow';

export function AuthEmailRegisterStep(): JSX.Element {
  const { firstName, setFirstName, lastName, setLastName, email, setEmail, password, setPassword, submitEmailRegister, loading, error, goToEmailLogin } = useAuthFlow();

  return (
    <div className="core-auth__step core-auth__step--email-register">
      <h2 className="core-auth__title">Create account</h2>
      <p className="core-auth__sub">Fill in your details to get started</p>
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
      <input
        type="email"
        className="core-input"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <input
        type="password"
        className="core-input"
        placeholder="Password (min 8 characters)"
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
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <button type="button" className="core-auth__link" onClick={goToEmailLogin}>
        Already have an account? Sign in
      </button>
    </div>
  );
}
