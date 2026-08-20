'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslations } from 'next-intl';
import { totpCodeRequestSchema } from '@prizren/shared-types';
import { apiFetch } from '@/lib/api';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { FieldError } from '@/components/ui';
import { useErrorMessage } from '@/lib/use-error-message';

type TotpFormValues = { code: string };

function TotpCodeForm({
  id,
  onValid,
  submitLabel,
  variant = 'primary',
  busy,
}: {
  id: string;
  onValid: (code: string) => Promise<void>;
  submitLabel: string;
  variant?: 'primary' | 'secondary';
  busy: boolean;
}) {
  const t = useTranslations('Auth');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TotpFormValues>({
    resolver: zodResolver(totpCodeRequestSchema),
    defaultValues: { code: '' },
  });

  async function submit(values: TotpFormValues) {
    if (busy) return;
    try {
      await onValid(values.code);
    } catch (err) {
      setError('code', {
        type: 'server',
        message: err instanceof Error ? err.message : t('twoFactorInvalid'),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3" noValidate>
      <Label htmlFor={id}>{t('twoFactorCode')}</Label>
      <Input
        id={id}
        inputMode="numeric"
        invalid={Boolean(errors.code)}
        aria-describedby={errors.code ? `${id}-error` : undefined}
        {...register('code')}
      />
      <FieldError id={`${id}-error`} message={issueMessage(errors.code, t)} />
      <Button
        type="submit"
        variant={variant === 'secondary' ? 'secondary' : 'primary'}
        loading={busy}
      >
        {submitLabel}
      </Button>
    </form>
  );
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const t = useTranslations('Auth');
  const errorMessage = useErrorMessage();
  const [active, setActive] = useState(enabled);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ otpauthUrl: string }>('/auth/2fa/setup', {
        method: 'POST',
        auth: true,
      });
      setOtpauthUrl(data.otpauthUrl);
    } catch (err) {
      setError(errorMessage(err, t('twoFactorInvalid')));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(code: string) {
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
    } catch (err) {
      throw new Error(errorMessage(err, t('twoFactorInvalid')));
    } finally {
      setBusy(false);
    }
  }

  async function disable(code: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/2fa/disable', {
        method: 'POST',
        auth: true,
        body: { code },
      });
      setActive(false);
    } catch (err) {
      throw new Error(errorMessage(err, t('twoFactorInvalid')));
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
          <TotpCodeForm
            id="disable-2fa"
            busy={busy}
            variant="secondary"
            submitLabel="Disable 2FA"
            onValid={disable}
          />
        </div>
      ) : otpauthUrl ? (
        <div className="mt-4 space-y-3">
          <div className="inline-flex rounded-lg bg-white p-3">
            <QRCodeSVG value={otpauthUrl} size={160} />
          </div>
          <TotpCodeForm id="confirm-2fa" busy={busy} submitLabel={t('verify')} onValid={confirm} />
        </div>
      ) : (
        <Button type="button" className="mt-4" loading={busy} onClick={() => void start()}>
          Enable 2FA
        </Button>
      )}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
