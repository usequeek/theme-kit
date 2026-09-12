'use client';

import { AuthFlowProvider, useAuthFlow } from '../../hooks/use-auth-flow';
import { AuthEmailOtpStep } from './auth-email-otp-step';
import { AuthEmailOtpVerifyStep } from './auth-email-otp-verify-step';
import { AuthSignupStep } from './auth-signup-step';
import { AuthEmailLoginStep } from './auth-email-login-step';
import { AuthEmailRegisterStep } from './auth-email-register-step';

function AuthFlowInner(): JSX.Element | null {
  const { step } = useAuthFlow();
  if (step === 'email-otp') return <AuthEmailOtpStep />;
  if (step === 'email-otp-verify') return <AuthEmailOtpVerifyStep />;
  if (step === 'signup') return <AuthSignupStep />;
  if (step === 'email-login') return <AuthEmailLoginStep />;
  if (step === 'email-register') return <AuthEmailRegisterStep />;
  return null;
}

export function AuthFlow(): JSX.Element {
  return (
    <AuthFlowProvider>
      <AuthFlowInner />
    </AuthFlowProvider>
  );
}
