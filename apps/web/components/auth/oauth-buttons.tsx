'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { OAuthProvidersStatus } from '@prizren/shared-types';
import { Button, type ButtonStatus } from '@/components/ui/button';

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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.37 12.64c.02 2.37 2.08 3.16 2.1 3.17-.02.05-.33 1.12-1.08 2.22-.65.95-1.33 1.9-2.4 1.92-1.05.02-1.39-.62-2.59-.62-1.2 0-1.57.6-2.57.64-1.03.04-1.82-1.03-2.48-1.98-1.34-1.94-2.37-5.48-1-7.9.69-1.2 1.91-1.96 3.24-1.98 1.01-.02 1.97.68 2.59.68.62 0 1.78-.84 3.01-.72.51.02 1.95.21 2.88 1.56-.07.05-1.72 1-1.7 2.99zM14.5 6.9c.55-.66.92-1.58.82-2.5-.8.03-1.76.53-2.33 1.2-.51.58-.96 1.52-.84 2.41.89.07 1.8-.45 2.35-1.11z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.61 23.09 24 18.1 24 12.07z"
      />
    </svg>
  );
}

const PROVIDERS: {
  id: Provider;
  icon: typeof GoogleIcon;
  labelKey: 'google' | 'apple' | 'facebook';
  connectingKey: 'googleConnecting' | 'appleConnecting' | 'facebookConnecting';
}[] = [
  { id: 'google', icon: GoogleIcon, labelKey: 'google', connectingKey: 'googleConnecting' },
  { id: 'apple', icon: AppleIcon, labelKey: 'apple', connectingKey: 'appleConnecting' },
  { id: 'facebook', icon: FacebookIcon, labelKey: 'facebook', connectingKey: 'facebookConnecting' },
];

const IDLE: Record<Provider, ButtonStatus> = {
  google: 'idle',
  apple: 'idle',
  facebook: 'idle',
};

export function OAuthButtons({
  disabled,
  onBusyChange,
}: {
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const t = useTranslations('Auth');
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const [enabled, setEnabled] = useState<OAuthProvidersStatus>({
    google: process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true',
    apple: false,
    facebook: false,
  });
  const [statuses, setStatuses] = useState<Record<Provider, ButtonStatus>>(IDLE);
  const lockRef = useRef(false);

  useEffect(() => {
    void fetch(`${api}/auth/providers`)
      .then((r) => r.json())
      .then((data: OAuthProvidersStatus) => {
        setEnabled({
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
    if (disabled || lockRef.current) return;
    if (!enabled[provider]) {
      setStatuses((current) => ({ ...current, [provider]: 'error' }));
      toast.error(t('oauthNotConfigured'));
      return;
    }
    lockRef.current = true;
    onBusyChange?.(true);
    setStatuses({
      google: provider === 'google' ? 'loading' : 'idle',
      apple: provider === 'apple' ? 'loading' : 'idle',
      facebook: provider === 'facebook' ? 'loading' : 'idle',
    });
    window.location.assign(`${api}/auth/${provider}`);
  }

  const anyLoading = Object.values(statuses).some((value) => value === 'loading');

  return (
    <>
      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {t('orContinue')}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="space-y-2.5">
        {PROVIDERS.map((provider) => {
          const Icon = provider.icon;
          const status = statuses[provider.id];
          const connecting = status === 'loading';
          const showBrandIcon = status === 'idle';
          return (
            <Button
              key={provider.id}
              type="button"
              variant="secondary"
              className="w-full min-h-11 font-medium"
              status={status}
              disabled={disabled || anyLoading}
              onClick={() => start(provider.id)}
            >
              {showBrandIcon ? <Icon /> : null}
              {connecting ? t(provider.connectingKey) : t(provider.labelKey)}
            </Button>
          );
        })}
      </div>
    </>
  );
}
