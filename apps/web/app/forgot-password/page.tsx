'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiFetch } from '@/lib/api';
import { AuthShell } from '@/components/auth/auth-shell';
import { FieldError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitStatus === 'loading' || submitStatus === 'success') return;
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('emailInvalid'));
      setSubmitStatus('error');
      return;
    }
    setSubmitStatus('loading');
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim(), website },
        skipRefresh: true,
      });
      setSubmitStatus('success');
      setSent(true);
    } catch {
      setSubmitStatus('success');
      setSent(true);
    }
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
        <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
          <div>
            <Label htmlFor="forgot-email">{t('email')}</Label>
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              invalid={Boolean(error)}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
            <FieldError message={error ?? undefined} />
          </div>
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
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
