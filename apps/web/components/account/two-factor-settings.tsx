'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslations } from 'next-intl';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { FieldError } from '@/components/ui';

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const t = useTranslations('Auth');
  const [active, setActive] = useState(enabled);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ otpauthUrl: string }>('/auth/2fa/setup', {
        method: 'POST',
        auth: true,
      });
      setOtpauthUrl(data.otpauthUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('twoFactorInvalid'));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/2fa/confirm', {
        method: 'POST',
        auth: true,
        body: { code },
      });
      setActive(true);
      setOtpauthUrl(null);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('twoFactorInvalid'));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/2fa/disable', {
        method: 'POST',
        auth: true,
        body: { code },
      });
      setActive(false);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('twoFactorInvalid'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-h3 text-foreground">{t('twoFactorTitle')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('twoFactorBody')}</p>
      {active && !otpauthUrl ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-river-700 dark:text-river-300">{t('verify')}</p>
          <Label htmlFor="disable-2fa">{t('twoFactorCode')}</Label>
          <Input
            id="disable-2fa"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <FieldError message={error ?? undefined} />
          <Button type="button" variant="secondary" loading={busy} onClick={() => void disable()}>
            Disable 2FA
          </Button>
        </div>
      ) : otpauthUrl ? (
        <div className="mt-4 space-y-3">
          <div className="inline-flex rounded-lg bg-white p-3">
            <QRCodeSVG value={otpauthUrl} size={160} />
          </div>
          <Label htmlFor="confirm-2fa">{t('twoFactorCode')}</Label>
          <Input
            id="confirm-2fa"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <FieldError message={error ?? undefined} />
          <Button type="button" loading={busy} onClick={() => void confirm()}>
            {t('verify')}
          </Button>
        </div>
      ) : (
        <Button type="button" className="mt-4" loading={busy} onClick={() => void start()}>
          Enable 2FA
        </Button>
      )}
    </section>
  );
}
