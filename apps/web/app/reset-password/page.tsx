'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError, apiFetch } from '@/lib/api';
import { isPasswordStrong } from '@/lib/password';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordStrength } from '@/components/auth/password-strength';
import { FieldError } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';

export default function ResetPasswordPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError(t('resetInvalid'));
      return;
    }
    if (!isPasswordStrong(password)) {
      setError(t('passwordWeak'));
      return;
    }
    if (password !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
        skipRefresh: true,
      });
      router.push('/login?reset=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('resetFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell imageSrc="/images/prizren/old-town.jpg" imageAlt={t('loginPanelAlt')}>
      <h1 className="text-h1 tracking-tight text-foreground">{t('resetTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('resetBody')}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="reset-password">{t('password')}</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
        </div>
        <div>
          <Label htmlFor="reset-confirm">{t('confirmPassword')}</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <FieldError message={error ?? undefined} />
        <Button type="submit" className="w-full" size="lg" loading={submitting} disabled={!token}>
          {t('savePassword')}
        </Button>
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
