'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { registerFormSchema } from '@prizren/shared-types';
import { issueMessage, zodResolver } from '@/lib/form-validation';
import { useAuth } from '@/components/auth-provider';
import { AuthShell } from '@/components/auth/auth-shell';
import { ConnectingHint } from '@/components/auth/connecting-hint';
import { OAuthButtons } from '@/components/auth/oauth-buttons';
import { PasswordStrength } from '@/components/auth/password-strength';
import { Checkbox, FieldError, FormError, PasswordInput } from '@/components/ui';
import { Button, type ButtonStatus } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';
import { useErrorMessage } from '@/lib/use-error-message';

type RegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirm: string;
  acceptedTerms: boolean;
  website?: string;
};

export default function RegisterPage() {
  const t = useTranslations('Auth');
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const errorMessage = useErrorMessage();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<ButtonStatus>('idle');
  const [oauthBusy, setOauthBusy] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirm: '',
      acceptedTerms: false,
      website: '',
    },
  });

  const password = watch('password');
  const acceptedTerms = watch('acceptedTerms');

  async function onValid(values: RegisterFormValues) {
    if (submitStatus === 'loading' || submitStatus === 'success' || oauthBusy) return;
    setFormError(null);
    setSubmitStatus('loading');
    try {
      await registerAccount({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
        phone: values.phone?.trim() || undefined,
        acceptedTerms: true,
        website: values.website,
      });
      setSubmitStatus('success');
      router.push(`/verify-email?email=${encodeURIComponent(values.email.trim())}`);
    } catch (err) {
      setFormError(errorMessage(err, t('registerFailed')));
      setSubmitStatus('error');
    }
  }

  return (
    <AuthShell headline={t('panelHeadline')} body={t('panelBody')}>
      <h1 className="ds-page-title">{t('registerTitle')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('registerSubtitle')}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {t('accountType')}: <span className="font-medium text-foreground">{t('citizenRole')}</span>
      </p>

      <form onSubmit={handleSubmit(onValid)} className="relative mt-8 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first-name">{t('firstName')}</Label>
            <Input
              id="first-name"
              autoComplete="given-name"
              invalid={Boolean(errors.firstName)}
              aria-describedby={errors.firstName ? 'register-first-name-error' : undefined}
              {...register('firstName')}
            />
            <FieldError
              id="register-first-name-error"
              message={issueMessage(errors.firstName, t)}
            />
          </div>
          <div>
            <Label htmlFor="last-name">{t('lastName')}</Label>
            <Input
              id="last-name"
              autoComplete="family-name"
              invalid={Boolean(errors.lastName)}
              aria-describedby={errors.lastName ? 'register-last-name-error' : undefined}
              {...register('lastName')}
            />
            <FieldError id="register-last-name-error" message={issueMessage(errors.lastName, t)} />
          </div>
        </div>
        <div>
          <Label htmlFor="register-email">{t('email')}</Label>
          <Input
            id="register-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'register-email-error' : undefined}
            {...register('email')}
          />
          <FieldError id="register-email-error" message={issueMessage(errors.email, t)} />
        </div>
        <div>
          <Label htmlFor="register-phone">{t('phoneOptional')}</Label>
          <Input
            id="register-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            {...register('phone')}
          />
        </div>
        <div>
          <Label htmlFor="register-password">{t('password')}</Label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'register-password-error' : undefined}
            {...register('password')}
          />
          <PasswordStrength password={password} />
          <FieldError id="register-password-error" message={issueMessage(errors.password, t)} />
        </div>
        <div>
          <Label htmlFor="register-confirm">{t('confirmPassword')}</Label>
          <PasswordInput
            id="register-confirm"
            autoComplete="new-password"
            invalid={Boolean(errors.confirm)}
            aria-describedby={errors.confirm ? 'register-confirm-error' : undefined}
            {...register('confirm')}
          />
          <FieldError id="register-confirm-error" message={issueMessage(errors.confirm, t)} />
        </div>

        <Checkbox
          id="terms"
          checked={acceptedTerms}
          invalid={Boolean(errors.acceptedTerms)}
          describedBy={errors.acceptedTerms ? 'register-terms-error' : undefined}
          onChange={(checked) => setValue('acceptedTerms', checked, { shouldValidate: true })}
        >
          {t('agreePrefix')}{' '}
          <Link href="/privacy" className="font-medium text-primary hover:underline">
            {t('privacy')}
          </Link>{' '}
          {t('and')}{' '}
          <Link href="/terms" className="font-medium text-primary hover:underline">
            {t('terms')}
          </Link>
        </Checkbox>
        <FieldError id="register-terms-error" message={issueMessage(errors.acceptedTerms, t)} />

        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
          </label>
        </div>

        <FormError message={formError} />
        <ConnectingHint active={submitStatus === 'loading'} />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          status={submitStatus}
          disabled={oauthBusy}
        >
          {submitStatus === 'loading' ? t('registering') : t('submitRegister')}
        </Button>
      </form>

      <OAuthButtons
        disabled={submitStatus === 'loading' || submitStatus === 'success'}
        onBusyChange={setOauthBusy}
      />

      <p className="mt-6 text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t('loginCta')}
        </Link>
      </p>
    </AuthShell>
  );
}
