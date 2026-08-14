'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Mail } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { setAccessToken, setSessionHint } from '@/lib/auth-token';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import type { AuthResponse } from '@prizren/shared-types';

export default function VerifyEmailPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const search = useSearchParams();
  const { refreshSession } = useAuth();
  const token = search.get('token');
  const presetEmail = search.get('email') ?? '';
  const [email, setEmail] = useState(presetEmail);
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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
        setMessage(err instanceof ApiError ? err.message : t('verifyFailed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, refreshSession, router, t]);

  async function resend() {
    if (!email.trim()) return;
    setSending(true);
    setMessage(null);
    try {
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: { email: email.trim(), website },
        skipRefresh: true,
      });
      setMessage(t('verifyResent'));
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('verifyFailed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthShell imageSrc="/images/prizren/bistrica.jpg" imageAlt={t('loginPanelAlt')}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-mosque-100 text-mosque-800 dark:bg-mosque-950 dark:text-mosque-200">
        <Mail className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="mt-4 text-h1 tracking-tight text-foreground">{t('verifyTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('verifyBody')}</p>

      {status === 'verifying' ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('verifying')}</p>
      ) : null}
      {status === 'error' ? (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      <div className="mt-8 space-y-4">
        <div>
          <Label htmlFor="verify-email">{t('email')}</Label>
          <Input
            id="verify-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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
        {message && status !== 'error' ? (
          <p className="text-sm text-river-700 dark:text-river-300">{message}</p>
        ) : null}
        <Button type="button" className="w-full" loading={sending} onClick={() => void resend()}>
          {t('resendVerification')}
        </Button>
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t('backToLogin')}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
