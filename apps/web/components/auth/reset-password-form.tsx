'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { resetPasswordFormSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordStrength } from '@/components/auth/password-strength';
import { FieldError, FormError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';

type ResetFormValues = {
  password: string;
  confirm: string;
};

export function ResetPasswordForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const [token, setToken] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: '', confirm: '' },
  });

  const password = watch('password');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
  }, []);

  async function onValid(values: ResetFormValues) {
    if (submitStatus === 'loading' || submitStatus === 'success') return;
    setFormError(null);
    if (!token) {
      setFormError(t('resetInvalid'));
      setSubmitStatus('error');
      return;
    }
    setSubmitStatus('loading');
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, password: values.password },
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

      <form onSubmit={handleSubmit(onValid)} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="reset-password">{t('password')}</Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
            {...register('password')}
          />
          <PasswordStrength password={password} />
          <FieldError id="reset-password-error" message={issueMessage(errors.password, t)} />
        </div>
        <div>
          <Label htmlFor="reset-confirm">{t('confirmPassword')}</Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'reset-confirm-error' : undefined}
            {...register('confirm')}
          />
          <FieldError id="reset-confirm-error" message={issueMessage(errors.confirm, t)} />
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
