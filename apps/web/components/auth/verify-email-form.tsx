'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { resendVerificationRequestSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { setAccessToken, setSessionHint } from '@/lib/auth-token';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { FieldError } from '@/components/ui/field-error';
import { FormError } from '@/components/ui/form-error';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useToast } from '@/components/toast-provider';
import { useErrorMessage } from '@/lib/use-error-message';
import type { AuthResponse } from '@prizren/shared-types';

type ResendFormValues = {
  email: string;
  website?: string;
};

export function VerifyEmailForm() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { refreshSession } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<ButtonStatus>('idle');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResendFormValues>({
    resolver: zodResolver(resendVerificationRequestSchema),
    defaultValues: { email: '', website: '' },
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setToken(search.get('token'));
    reset({ email: search.get('email') ?? '', website: '' });
  }, [reset]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setStatus('verifying');
    void (async () => {
      try {
        const data = await apiFetch<AuthResponse>('/auth/verify-email', {
          method: 'POST',
          body: { token },
          skipRefresh: true,
        });
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setSessionHint(true);
        await refreshSession({ force: true });
        setStatus('ok');
        router.replace('/account');
      } catch (err) {
        if (cancelled) return;
        setStatus('error');
        setMessage(errorMessage(err, t('verifyFailed')));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshSession, router, t, errorMessage]);

  async function onResend(values: ResendFormValues) {
    if (resendStatus === 'loading' || resendStatus === 'success') return;
    setResendStatus('loading');
    setMessage(null);
    try {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: { email: values.email.trim(), website: values.website },
        skipRefresh: true,
      });
      toast.push(t('verifyResent'), 'success');
      setResendStatus('success');
      window.setTimeout(() => setResendStatus('idle'), 1600);
    } catch (err) {
      setMessage(errorMessage(err, t('verifyFailed')));
      setResendStatus('error');
    }
  }

  return (
    <AuthShell headline={t('panelHeadline')} body={t('panelBody')}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mosque-100 text-mosque-800 dark:bg-mosque-950 dark:text-mosque-200">
        <Mail className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="ds-page-title mt-4">{t('verifyTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('verifyBody')}</p>

      {status === 'verifying' ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('verifying')}</p>
      ) : null}
      {status === 'error' ? <FormError className="mt-6" message={message} /> : null}

      <form onSubmit={handleSubmit(onResend)} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="verify-email">{t('email')}</Label>
          <Input
            id="verify-email"
            type="email"
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'verify-email-error' : undefined}
            {...register('email')}
          />
          <FieldError id="verify-email-error" message={issueMessage(errors.email, t)} />
        </div>
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
        </div>
        <Button type="submit" className="w-full" status={resendStatus}>
          {t('resendVerification')}
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
