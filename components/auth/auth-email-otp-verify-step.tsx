'use client';

import { useRef } from 'react';
import { useAuthFlow } from '../../hooks/use-auth-flow';

const OTP_LENGTH = 6;

export function AuthEmailOtpVerifyStep(): JSX.Element {
  const { email, otp, setOtp, submitEmailVerifyOtp, submitEmailRequestOtp, goToEmailOtp, loading, error } = useAuthFlow();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (i: number): void => {
    refs.current[i]?.focus();
  };

  const handleChange = (i: number, raw: string): void => {
    const char = raw.replace(/\D/g, '').slice(-1);
    const next = otp.split('');
    next[i] = char;
    const joined = next.join('').slice(0, OTP_LENGTH);
    setOtp(joined);
    if (char && i < OTP_LENGTH - 1) focus(i + 1);
    if (joined.length === OTP_LENGTH) void submitEmailVerifyOtp();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace') {
      if (otp[i]) {
        const next = otp.split('');
        next[i] = '';
        setOtp(next.join(''));
      } else if (i > 0) {
        focus(i - 1);
      }
    } else if (e.key === 'Enter' && otp.length === OTP_LENGTH) {
      void submitEmailVerifyOtp();
    }
  };

  return (
    <div className="core-auth__step core-auth__step--email-otp-verify">
      <h2 className="core-auth__title">Enter code</h2>
      <p className="core-auth__sub">
        {OTP_LENGTH}-digit code sent to <strong>{email}</strong>
      </p>
      <div className="core-auth-otp">
        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="core-auth-otp__box"
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={otp[i] ?? ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            disabled={loading}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>
      {error ? <p className="core-auth__error">{error}</p> : null}
      <button
        type="button"
        className="core-submit-btn"
        onClick={() => void submitEmailVerifyOtp()}
        disabled={loading || otp.length < OTP_LENGTH}
      >
        {loading ? 'Verifying…' : 'Verify'}
      </button>
      <button type="button" className="core-auth__link" onClick={() => void submitEmailRequestOtp()}>
        Resend code
      </button>
      <button type="button" className="core-auth__link" onClick={goToEmailOtp}>
        ← Change email
      </button>
    </div>
  );
}
