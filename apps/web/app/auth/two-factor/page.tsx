'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Checkbox, FieldError } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';

export default function TwoFactorPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { completeTwoFactor } = useAuth();
  const [code, setCode] = useState('');
  const [trust, setTrust] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('psc.2fa');
    if (!stored) {
      router.replace('/login');
      return;
    }
    setChallenge(stored);
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      setError(t('twoFactorInvalid'));
      return;
    }
    setSubmitting(true);
    try {
      await completeTwoFactor(challenge, code.replace(/\s/g, ''));
      sessionStorage.removeItem('psc.2fa');
      router.push('/account');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('twoFactorInvalid'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell imageSrc="/images/prizren/sinan-pasha.jpg" imageAlt={t('loginPanelAlt')}>
      <h1 className="text-h1 tracking-tight text-foreground">{t('twoFactorTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('twoFactorBody')}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="otp">{t('twoFactorCode')}</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="tracking-[0.4em]"
          />
        </div>
        <Checkbox id="trust-device" checked={trust} onChange={setTrust}>
          {t('trustDevice')}
        </Checkbox>
        <FieldError message={error ?? undefined} />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          loading={submitting}
          disabled={!challenge}
        >
          {t('verify')}
        </Button>
      </form>
    </AuthShell>
  );
}
