'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AuthResponse } from '@prizren/shared-types';
import { completeFacebookRequestSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { setAccessToken, setSessionHint } from '@/lib/auth-token';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { FieldError } from '@/components/ui/field-error';
import { FormError } from '@/components/ui/form-error';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';

type CompleteFormValues = {
  email: string;
  website?: string;
};

export function CompleteFacebookForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { refreshSession } = useAuth();
  const errorMessage = useErrorMessage();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'form' | 'verifying' | 'sent'>('form');
  const [message, setMessage] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteFormValues>({
    resolver: zodResolver(completeFacebookRequestSchema),
    defaultValues: { email: '', website: '' },
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setToken(search.get('token'));
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus('verifying');
    void (async () => {
      try {
        const data = await apiFetch<AuthResponse>('/auth/facebook/verify', {
          method: 'POST',
          body: { token },
          skipRefresh: true,
        });
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setSessionHint(true);
        await refreshSession({ force: true });
        router.replace('/account');
      } catch (err) {
        if (cancelled) return;
        setStatus('form');
        setMessage(errorMessage(err, t('verifyFailed')));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshSession, router, t, errorMessage]);

  async function onSubmit(values: CompleteFormValues) {
    if (submitStatus === 'loading' || submitStatus === 'success') return;
    setSubmitStatus('loading');
    setMessage(null);
    try {
      await apiFetch('/auth/facebook/complete', {
        method: 'POST',
        body: { email: values.email.trim(), website: values.website },
        skipRefresh: true,
      });
      setStatus('sent');
      setSubmitStatus('success');
    } catch (err) {
      setMessage(errorMessage(err, t('completeFacebookMissing')));
      setSubmitStatus('error');
    }
  }

  return (
    <AuthShell headline={t('panelHeadline')} body={t('panelBody')}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mosque-100 text-mosque-800 dark:bg-mosque-950 dark:text-mosque-200">
        <Mail className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="ds-page-title mt-4">{t('completeFacebookTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('completeFacebookBody')}</p>

      {status === 'verifying' ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('verifying')}</p>
      ) : null}
      {status === 'sent' ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('completeFacebookSent')}</p>
      ) : null}
      {message ? <FormError className="mt-6" message={message} /> : null}

      {status === 'form' ? (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <div>
            <Label htmlFor="complete-facebook-email">{t('email')}</Label>
            <Input
              id="complete-facebook-email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'complete-facebook-email-error' : undefined}
              {...register('email')}
            />
            <FieldError
              id="complete-facebook-email-error"
              message={issueMessage(errors.email, t)}
            />
          </div>
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </div>
          <Button type="submit" className="w-full" status={submitStatus}>
            {t('completeFacebookCta')}
          </Button>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t('backToLogin')}
            </Link>
          </p>
        </form>
      ) : status === 'sent' ? (
        <p className="mt-8 text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      ) : null}
    </AuthShell>
  );
}
