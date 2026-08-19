'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { isPasswordStrong } from '@/lib/password';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordStrength } from '@/components/auth/password-strength';
import { FieldError, FormError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';

export function ResetPasswordForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitStatus === 'loading' || submitStatus === 'success') return;
    setFormError(null);
    setFieldErrors({});
    if (!token) {
      setFormError(t('resetInvalid'));
      setSubmitStatus('error');
      return;
    }
    const next: { password?: string; confirm?: string } = {};
    if (!isPasswordStrong(password)) next.password = t('passwordWeak');
    if (password !== confirm) next.confirm = t('passwordMismatch');
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      setSubmitStatus('error');
      return;
    }
    setSubmitStatus('loading');
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, password },
        skipRefresh: true,
      });
      setSubmitStatus('success');
      router.push('/login?reset=1');
    } catch (err) {
      setFormError(errorMessage(err, t('resetFailed')));
      setSubmitStatus('error');
    }
  }

  return (
    <AuthShell
      imageSrc="/images/prizren/old-town.jpg"
      imageAlt={t('loginPanelAlt')}
      headline={t('panelHeadline')}
      body={t('panelBody')}
    >
      <h1 className="ds-page-title">{t('resetTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('resetBody')}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="reset-password">{t('password')}</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            invalid={Boolean(fieldErrors.password)}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((f) => ({ ...f, password: undefined }));
            }}
          />
          <PasswordStrength password={password} />
          <FieldError message={fieldErrors.password} />
        </div>
        <div>
          <Label htmlFor="reset-confirm">{t('confirmPassword')}</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            invalid={Boolean(fieldErrors.confirm)}
            onChange={(e) => {
              setConfirm(e.target.value);
              setFieldErrors((f) => ({ ...f, confirm: undefined }));
            }}
          />
          <FieldError message={fieldErrors.confirm} />
        </div>
        <FormError message={formError} />
        <Button type="submit" className="w-full" size="lg" status={submitStatus} disabled={!token}>
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
