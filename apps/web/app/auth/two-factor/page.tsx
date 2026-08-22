'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { twoFactorFormSchema } from '@prizren/shared-types';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { Checkbox, FieldError } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';
import { consumeLoginNext } from '@/lib/login-next';

type TwoFactorFormValues = {
  code: string;
  trustDevice?: boolean;
};

export default function TwoFactorPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { completeTwoFactor } = useAuth();
  const errorMessage = useErrorMessage();
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');
  const [challenge, setChallenge] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<TwoFactorFormValues>({
    resolver: zodResolver(twoFactorFormSchema),
    defaultValues: { code: '', trustDevice: false },
  });

  const trustDevice = watch('trustDevice') ?? false;

  useEffect(() => {
    const stored = sessionStorage.getItem('psc.2fa');
    if (!stored) {
      router.replace('/login');
      return;
    }
    setChallenge(stored);
  }, [router]);

  async function onValid(values: TwoFactorFormValues) {
    if (!challenge) return;
    if (submitStatus === 'loading' || submitStatus === 'success') return;
    setSubmitStatus('loading');
    try {
      await completeTwoFactor(challenge, values.code, values.trustDevice);
      sessionStorage.removeItem('psc.2fa');
      setSubmitStatus('success');
      router.push(consumeLoginNext() ?? '/account');
    } catch (err) {
      setError('code', { type: 'server', message: errorMessage(err, t('twoFactorInvalid')) });
      setSubmitStatus('error');
    }
  }

  return (
    <AuthShell headline={t('panelHeadline')} body={t('panelBody')}>
      <h1 className="ds-page-title">{t('twoFactorTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('twoFactorBody')}</p>

      <form onSubmit={handleSubmit(onValid)} className="mt-8 space-y-4" noValidate>
        <div>
          <Label htmlFor="otp">{t('twoFactorCode')}</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            invalid={Boolean(errors.code)}
            aria-describedby={errors.code ? 'otp-error' : undefined}
            className="tracking-[0.4em]"
            {...register('code')}
          />
        </div>
        <Checkbox
          id="trust-device"
          checked={trustDevice}
          onChange={(checked) => setValue('trustDevice', checked)}
        >
          {t('trustDevice')}
        </Checkbox>
        <FieldError id="otp-error" message={issueMessage(errors.code, t)} />
        <Button
          type="submit"
          className="w-full"
          size="lg"
          status={submitStatus}
          disabled={!challenge}
        >
          {t('verify')}
        </Button>
      </form>
    </AuthShell>
  );
}
