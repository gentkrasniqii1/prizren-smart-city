'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { forgotPasswordRequestSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { AuthShell } from '@/components/auth/auth-shell';
import { FieldError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';

type ForgotFormValues = {
  email: string;
  website?: string;
};

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const [sent, setSent] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '', website: '' },
  });

  async function onValid(values: ForgotFormValues) {
    if (submitStatus === 'loading' || submitStatus === 'success') return;
    setSubmitStatus('loading');
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: values.email.trim(), website: values.website },
        skipRefresh: true,
      });
    } catch {
      // Always show the same success screen so emails cannot be enumerated.
    }
    setSubmitStatus('success');
    setSent(true);
  }

  return (
    <AuthShell
      imageSrc="/images/prizren/kalaja.jpg"
      imageAlt={t('loginPanelAlt')}
      headline={t('panelHeadline')}
      body={t('panelBody')}
    >
      <h1 className="ds-page-title">{t('forgotTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('forgotBody')}</p>

      {sent ? (
        <div className="mt-8 rounded-lg border border-border bg-card p-5">
          <p className="font-medium text-foreground">{t('forgotSentTitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('forgotSentBody')}</p>
          <Link
            href="/login"
            className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
          >
            {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onValid)} className="mt-8 space-y-4" noValidate>
          <div>
            <Label htmlFor="forgot-email">{t('email')}</Label>
            <Input
              id="forgot-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'forgot-email-error' : undefined}
              {...register('email')}
            />
            <FieldError id="forgot-email-error" message={issueMessage(errors.email, t)} />
          </div>
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>
          <Button type="submit" className="w-full" size="lg" status={submitStatus}>
            {t('sendResetLink')}
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
