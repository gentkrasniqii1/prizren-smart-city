'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { OAuthProvidersStatus } from '@prizren/shared-types';
import { Button } from '@/components/ui/button';

type Provider = keyof OAuthProvidersStatus;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.3 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.9 39.4 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 20" aria-hidden className="fill-current">
      <path d="M13.3 10.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.7-2.8-.7-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7c1.2 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.3-3.5zM11.2 4.3c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.7 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2-.6 2.7-1.4z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.32 0 2.7.24 2.7.24v2.97h-1.52c-1.5 0-1.97.93-1.97 1.89v2.26h3.34l-.53 3.49h-2.81V24C19.61 23.09 24 18.1 24 12.07z"
      />
    </svg>
  );
}

export function OAuthButtons({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('Auth');
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const [status, setStatus] = useState<OAuthProvidersStatus>({
    google: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true',
    apple: false,
    facebook: false,
  });
  const [busy, setBusy] = useState<Provider | null>(null);

  useEffect(() => {
    void fetch(`${api}/auth/providers`)
      .then((r) => r.json())
      .then((data: Partial<OAuthProvidersStatus>) => {
        setStatus({
          google: Boolean(data.google),
          apple: Boolean(data.apple),
          facebook: Boolean(data.facebook),
        });
      })
      .catch(() => {
        /* keep defaults */
      });
  }, [api]);

  function start(provider: Provider) {
    if (disabled || busy) return;
    if (!status[provider]) {
      toast.error(t('oauthNotConfigured'));
      return;
    }
    setBusy(provider);
    window.location.href = `${api}/auth/${provider}`;
  }

  const items: { id: Provider; label: string; connecting: string; icon: ReactNode }[] = [
    { id: 'google', label: t('google'), connecting: t('googleConnecting'), icon: <GoogleIcon /> },
    { id: 'apple', label: t('apple'), connecting: t('appleConnecting'), icon: <AppleIcon /> },
    {
      id: 'facebook',
      label: t('facebook'),
      connecting: t('facebookConnecting'),
      icon: <FacebookIcon />,
    },
  ];

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="secondary"
          className="w-full min-h-11"
          loading={busy === item.id}
          disabled={disabled || Boolean(busy)}
          onClick={() => start(item.id)}
        >
          {busy === item.id ? null : item.icon}
          {busy === item.id ? item.connecting : item.label}
        </Button>
      ))}
    </div>
  );
}
