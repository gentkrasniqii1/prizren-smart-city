'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

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

export function OAuthButtons({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('Auth');
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const [enabled, setEnabled] = useState(process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`${api}/auth/providers`)
      .then((r) => r.json())
      .then((data: { google?: boolean }) => {
        setEnabled(Boolean(data.google));
      })
      .catch(() => {
        /* keep default */
      });
  }, [api]);

  if (!enabled) return null;

  function start() {
    if (disabled || busy) return;
    setBusy(true);
    window.location.href = `${api}/auth/google`;
  }

  return (
    <>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t('orContinue')}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="secondary"
        className="w-full min-h-11"
        loading={busy}
        disabled={disabled || busy}
        onClick={start}
      >
        {busy ? null : <GoogleIcon />}
        {busy ? t('googleConnecting') : t('google')}
      </Button>
    </>
  );
}
