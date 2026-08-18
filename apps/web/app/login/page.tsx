'use client';

import { LoginForm } from '@/components/auth/login-form';
import { LoginQueryEffects } from '@/components/auth/login-query-effects';

export default function LoginPage() {
  return (
    <>
      <LoginQueryEffects />
      <LoginForm />
    </>
  );
}
